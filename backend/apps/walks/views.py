import hashlib
import logging
import math
import uuid
from datetime import datetime, timedelta

from django.http import HttpResponse
from django.utils import timezone as dj_timezone
from PIL import Image
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.billing.permissions import HasFeature
from apps.core.permissions import IsOrgAdmin, IsOrgManagerOrAbove, IsOrgMember, IsWalkEvaluatorOrAdmin, get_accessible_store_ids
from apps.core.storage import process_uploaded_image

from .models import (
    ActionItem,
    ActionItemPhoto,
    ActionItemResponse,
    AssessmentSubmission,
    CalendarToken,
    CorrectiveAction,
    Criterion,
    Department,
    DepartmentType,
    Driver,
    EvaluationSchedule,
    IndustryTemplate,
    Score,
    ScoringTemplate,
    Section,
    SelfAssessment,
    SelfAssessmentTemplate,
    SOPCriterionLink,
    SOPDocument,
    Walk,
    WalkPhoto,
    WalkSectionNote,
)
from .serializers import (
    ActionItemDetailSerializer,
    ActionItemListSerializer,
    ActionItemResponseSerializer,
    AssessmentSubmissionSerializer,
    CalendarTokenSerializer,
    CorrectiveActionListSerializer,
    DepartmentDetailSerializer,
    DepartmentListSerializer,
    DepartmentTypeDetailSerializer,
    DepartmentTypeListSerializer,
    DriverSerializer,
    EvaluationScheduleSerializer,
    IndustryTemplateDetailSerializer,
    IndustryTemplateListSerializer,
    ScoreSerializer,
    ScoringTemplateDetailSerializer,
    ScoringTemplateListSerializer,
    SelfAssessmentDetailSerializer,
    SelfAssessmentListSerializer,
    SelfAssessmentTemplateDetailSerializer,
    SelfAssessmentTemplateListSerializer,
    SOPCriterionLinkSerializer,
    SOPDocumentDetailSerializer,
    SOPDocumentListSerializer,
    WalkDetailSerializer,
    WalkListSerializer,
    WalkPhotoSerializer,
    WalkSectionNoteSerializer,
)

logger = logging.getLogger(__name__)


def extract_exif_date(image_file):
    """Extract the original date from photo EXIF data."""
    try:
        image_file.seek(0)
        img = Image.open(image_file)
        exif_data = img._getexif()
        if exif_data:
            # DateTimeOriginal (36867), DateTimeDigitized (36868), DateTime (306)
            date_str = exif_data.get(36867) or exif_data.get(36868) or exif_data.get(306)
            if date_str:
                return datetime.strptime(date_str, '%Y:%m:%d %H:%M:%S')
    except Exception:
        pass
    return None


def compute_image_hash(image_file):
    """Compute SHA-256 hash of image file."""
    image_file.seek(0)
    hasher = hashlib.sha256()
    for chunk in image_file.chunks():
        hasher.update(chunk)
    image_file.seek(0)
    return hasher.hexdigest()


class ScoringTemplateViewSet(ModelViewSet):
    """CRUD operations for scoring templates, scoped to the current organization."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return ScoringTemplateListSerializer
        return ScoringTemplateDetailSerializer

    def get_queryset(self):
        queryset = ScoringTemplate.objects.filter(
            organization=self.request.org,
        ).prefetch_related('sections__criteria__drivers')

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        # Feature-gate: only Enterprise (custom_templates) can create from scratch
        if not HasFeature('custom_templates').has_permission(self.request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Creating custom templates requires an Enterprise plan. '
                'Install a template from the Template Library instead.'
            )
        serializer.save(organization=self.request.org)

    def perform_update(self, serializer):
        if not HasFeature('custom_templates').has_permission(self.request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Editing templates requires an Enterprise plan.'
            )
        serializer.save()

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """
        Duplicate an existing template with all sections, criteria, and drivers.
        No Enterprise gate — any org admin can duplicate.
        """
        source = self.get_object()

        # Generate unique name
        base_name = f'{source.name} (Copy)'
        name = base_name
        counter = 2
        while ScoringTemplate.objects.filter(
            organization=request.org, name=name,
        ).exists():
            name = f'{source.name} (Copy {counter})'
            counter += 1

        # Deep-clone
        new_template = ScoringTemplate.objects.create(
            organization=request.org,
            name=name,
            is_active=True,
            source_template=source,
            source_industry_template=source.source_industry_template,
        )

        for section in source.sections.all().order_by('order'):
            new_section = Section.objects.create(
                template=new_template,
                name=section.name,
                order=section.order,
                weight=section.weight,
            )
            for criterion in section.criteria.all().order_by('order'):
                new_criterion = Criterion.objects.create(
                    section=new_section,
                    name=criterion.name,
                    description=criterion.description,
                    order=criterion.order,
                    max_points=criterion.max_points,
                    sop_text=criterion.sop_text,
                    sop_url=criterion.sop_url,
                    scoring_guidance=criterion.scoring_guidance,
                )
                for driver in criterion.drivers.filter(is_active=True).order_by('order'):
                    Driver.objects.create(
                        organization=request.org,
                        criterion=new_criterion,
                        name=driver.name,
                        order=driver.order,
                        is_active=True,
                    )

        serializer = ScoringTemplateDetailSerializer(new_template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WalkViewSet(ModelViewSet):
    """CRUD operations for walks, scoped to the current organization."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        if self.action in ('create', 'submit_scores', 'complete_walk', 'generate_summary', 'destroy', 'start_walk'):
            return [IsAuthenticated(), IsOrgManagerOrAbove()]
        if self.action == 'manager_review':
            return [IsAuthenticated(), IsOrgMember()]
        # update, partial_update
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return WalkListSerializer
        return WalkDetailSerializer

    def get_queryset(self):
        queryset = Walk.objects.filter(
            organization=self.request.org,
        ).select_related('store', 'template', 'conducted_by', 'department')

        # Apply role-based store scoping (pass request so platform admins see all)
        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(store_id__in=accessible_ids)

        # Filter by walk type: 'standard' (default), 'department', or 'all'
        walk_type = self.request.query_params.get('walk_type', 'standard')
        if walk_type == 'standard':
            queryset = queryset.filter(department__isnull=True)
        elif walk_type == 'department':
            queryset = queryset.filter(department__isnull=False)
        # walk_type == 'all' returns everything

        # Optional filters
        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        walk_status = self.request.query_params.get('status')
        if walk_status:
            queryset = queryset.filter(status=walk_status)

        conducted_by = self.request.query_params.get('conducted_by')
        if conducted_by:
            queryset = queryset.filter(conducted_by_id=conducted_by)

        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department_id=department)

        # Evaluators can only see walks they personally conducted
        membership = getattr(self.request, 'membership', None)
        if membership and membership.role == 'evaluator':
            queryset = queryset.filter(conducted_by=self.request.user)

        return queryset

    def perform_create(self, serializer):
        walk = serializer.save(organization=self.request.org)

        # If GPS coords provided at creation time, verify location immediately
        lat = self.request.data.get('start_latitude')
        lng = self.request.data.get('start_longitude')
        if lat is not None and lng is not None:
            try:
                lat = float(lat)
                lng = float(lng)
                walk.start_latitude = lat
                walk.start_longitude = lng

                store = walk.store
                if store.latitude is not None and store.longitude is not None:
                    distance = self._haversine_distance(
                        lat, lng, float(store.latitude), float(store.longitude),
                    )
                    walk.location_distance_meters = int(distance)
                    walk.location_verified = distance <= 500

                walk.save(update_fields=[
                    'start_latitude', 'start_longitude',
                    'location_verified', 'location_distance_meters',
                ])
            except (TypeError, ValueError):
                pass

    def update(self, request, *args, **kwargs):
        walk = self.get_object()
        if walk.is_locked:
            return Response(
                {'detail': 'This walk is locked and can no longer be edited.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        walk = self.get_object()
        if walk.is_locked:
            return Response(
                {'detail': 'This walk is locked and can no longer be edited.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='scores')
    def submit_scores(self, request, pk=None):
        """Submit or update scores for a walk. Only the walk's evaluator can do this."""
        walk = self.get_object()
        # Enforce evaluator-only editing
        if not IsWalkEvaluatorOrAdmin().has_object_permission(request, self, walk):
            return Response(
                {'detail': IsWalkEvaluatorOrAdmin.message},
                status=status.HTTP_403_FORBIDDEN,
            )
        if walk.is_locked:
            return Response(
                {'detail': 'This walk is locked and can no longer be edited.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        scores_data = request.data.get('scores', [])

        if not scores_data:
            return Response(
                {'detail': 'No scores provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_scores = []
        errors = []

        for score_data in scores_data:
            score_data['walk'] = walk.id
            # Check if score already exists for this criterion
            existing = Score.objects.filter(
                walk=walk,
                criterion_id=score_data.get('criterion'),
            ).first()

            if existing:
                serializer = ScoreSerializer(existing, data=score_data, partial=True)
            else:
                serializer = ScoreSerializer(data=score_data)

            if serializer.is_valid():
                serializer.save(walk=walk)
                created_scores.append(serializer.data)
            else:
                errors.append({
                    'criterion': score_data.get('criterion'),
                    'errors': serializer.errors,
                })

        # Recalculate total score
        walk.total_score = walk.calculate_total_score()
        walk.save(update_fields=['total_score'])

        response_data = {
            'scores': created_scores,
            'total_score': walk.total_score,
        }
        if errors:
            response_data['errors'] = errors

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='generate-summary')
    def generate_summary(self, request, pk=None):
        """Generate an AI summary preview without completing the walk."""
        if not HasFeature('ai_summaries').has_permission(request, self):
            return Response(
                {'detail': 'AI summaries require a Pro or Enterprise plan.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        walk = self.get_object()

        # Enforce evaluator-only editing
        if not IsWalkEvaluatorOrAdmin().has_object_permission(request, self, walk):
            return Response(
                {'detail': IsWalkEvaluatorOrAdmin.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .services import generate_walk_summary
        summary = generate_walk_summary(walk)

        return Response({'summary': summary})

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_walk(self, request, pk=None):
        """
        Mark a walk as completed and trigger AI summary + email.
        Only the walk's evaluator can complete it.

        Accepts optional JSON body:
        {
            "notify_manager": true,            // email the store manager (default true)
            "notify_evaluator": true,           // email the person who conducted the walk
            "additional_emails": ["a@b.com"]    // extra recipients
        }
        """
        walk = self.get_object()

        # Enforce evaluator-only editing
        if not IsWalkEvaluatorOrAdmin().has_object_permission(request, self, walk):
            return Response(
                {'detail': IsWalkEvaluatorOrAdmin.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        if walk.status == Walk.Status.COMPLETED:
            return Response(
                {'detail': 'Walk is already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        walk.status = Walk.Status.COMPLETED
        walk.completed_date = timezone.now()
        walk.total_score = walk.calculate_total_score()

        # If the evaluator provided an edited summary, use it
        provided_summary = request.data.get('summary', '').strip()
        if provided_summary:
            walk.ai_summary = provided_summary

        update_fields = ['status', 'completed_date', 'total_score', 'ai_summary']

        # Handle evaluator signature (base64 PNG data)
        signature_data = request.data.get('signature', '').strip()
        if signature_data:
            import base64
            from django.core.files.base import ContentFile

            # Strip data URL prefix if present
            if ',' in signature_data:
                signature_data = signature_data.split(',', 1)[1]

            try:
                image_data = base64.b64decode(signature_data)
                filename = f'evaluator_{walk.id}_{uuid.uuid4().hex[:8]}.png'
                walk.evaluator_signature.save(filename, ContentFile(image_data), save=False)
                walk.evaluator_signed_at = timezone.now()
                update_fields.extend(['evaluator_signature', 'evaluator_signed_at'])
            except Exception as e:
                logger.warning(f'Failed to save evaluator signature for walk {walk.id}: {e}')

        # Set manager review status to pending_review now that walk is completed
        walk.manager_review_status = Walk.ManagerReviewStatus.PENDING_REVIEW
        update_fields.append('manager_review_status')

        walk.save(update_fields=update_fields)

        # Build recipient list
        recipient_emails = []

        notify_manager = request.data.get('notify_manager', True)
        notify_evaluator = request.data.get('notify_evaluator', False)
        additional_emails = request.data.get('additional_emails', [])

        # Add evaluator email
        if notify_evaluator and walk.conducted_by.email:
            recipient_emails.append(walk.conducted_by.email)

        # Add any additional emails
        if additional_emails:
            recipient_emails.extend(additional_emails)

        # Add the requesting user if they're the manager and opted in
        if notify_manager and request.user.email not in recipient_emails:
            recipient_emails.append(request.user.email)

        # Deduplicate
        recipient_emails = list(set(recipient_emails))

        # Trigger async summary generation + email
        from .tasks import process_walk_completion
        process_walk_completion.delay(str(walk.id), recipient_emails)

        serializer = WalkDetailSerializer(walk, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='manager-review')
    def manager_review(self, request, pk=None):
        """
        Submit a manager review for a completed walk.

        POST /walks/{walk_id}/manager-review/
        Accepts:
          - signature: base64 image data (PNG)
          - notes: text
          - status: 'reviewed' or 'disputed'
        Permission: Any org member who is NOT the evaluator.
        """
        walk = self.get_object()

        # Walk must be completed
        if walk.status != Walk.Status.COMPLETED:
            return Response(
                {'detail': 'Walk must be completed before it can be reviewed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The evaluator cannot review their own walk
        if request.user.id == walk.conducted_by_id:
            return Response(
                {'detail': 'The evaluator cannot review their own walk.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate review status
        review_status = request.data.get('status', '').strip()
        if review_status not in ('reviewed', 'disputed'):
            return Response(
                {'detail': 'Status must be "reviewed" or "disputed".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Disputed requires notes
        notes = request.data.get('notes', '').strip()
        if review_status == 'disputed' and not notes:
            return Response(
                {'detail': 'Notes are required when disputing a walk.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate and save signature
        signature_data = request.data.get('signature', '').strip()
        if not signature_data:
            return Response(
                {'detail': 'Signature is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import base64
        from django.core.files.base import ContentFile
        from django.utils import timezone

        # Strip data URL prefix if present
        if ',' in signature_data:
            signature_data = signature_data.split(',', 1)[1]

        try:
            image_data = base64.b64decode(signature_data)
        except Exception:
            return Response(
                {'detail': 'Invalid signature data.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filename = f'manager_{walk.id}_{uuid.uuid4().hex[:8]}.png'
        walk.manager_signature.save(filename, ContentFile(image_data), save=False)
        walk.manager_signed_at = timezone.now()
        walk.manager_reviewed_by = request.user
        walk.manager_review_notes = notes
        walk.manager_review_status = review_status
        walk.save(update_fields=[
            'manager_signature', 'manager_signed_at',
            'manager_reviewed_by', 'manager_review_notes',
            'manager_review_status',
        ])

        serializer = WalkDetailSerializer(walk, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='start')
    def start_walk(self, request, pk=None):
        """
        Record the walk start with GPS coordinates for geolocation verification.

        POST /walks/{walk_id}/start/
        Accepts:
          - latitude: float
          - longitude: float
        """
        walk = self.get_object()

        if walk.status == Walk.Status.COMPLETED:
            return Response(
                {'detail': 'Walk is already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lat = request.data.get('latitude')
        lng = request.data.get('longitude')

        if lat is None or lng is None:
            return Response(
                {'detail': 'latitude and longitude are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Invalid latitude or longitude values.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        walk.status = Walk.Status.IN_PROGRESS
        walk.started_at = timezone.now()
        walk.start_latitude = lat
        walk.start_longitude = lng

        # Calculate distance from store using Haversine formula
        store = walk.store
        distance_meters = None
        location_verified = False
        VERIFICATION_RADIUS_METERS = 500  # 500m radius

        if store.latitude is not None and store.longitude is not None:
            distance_meters = self._haversine_distance(
                lat, lng,
                float(store.latitude), float(store.longitude),
            )
            location_verified = distance_meters <= VERIFICATION_RADIUS_METERS

        walk.location_distance_meters = int(distance_meters) if distance_meters is not None else None
        walk.location_verified = location_verified
        walk.save(update_fields=[
            'status', 'started_at',
            'start_latitude', 'start_longitude',
            'location_verified', 'location_distance_meters',
        ])

        serializer = WalkDetailSerializer(walk, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='verify-qr')
    def verify_qr(self, request, pk=None):
        """
        Verify a walk via QR code token.
        POST /walks/{walk_id}/verify-qr/
        Accepts: { "qr_token": "<uuid>" }
        """
        walk = self.get_object()
        qr_token = request.data.get('qr_token', '').strip()

        if not qr_token:
            return Response(
                {'detail': 'qr_token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        store = walk.store
        if str(store.qr_verification_token) != qr_token:
            return Response(
                {'detail': 'Invalid QR code. Token does not match this store.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        walk.qr_verified = True
        walk.qr_scanned_at = timezone.now()
        walk.save(update_fields=['qr_verified', 'qr_scanned_at'])

        serializer = WalkDetailSerializer(walk, context={'request': request})
        return Response(serializer.data)

    @staticmethod
    def _haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS points in meters using Haversine formula."""
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2) ** 2
             + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


class WalkPhotoView(APIView):
    """
    GET  /api/v1/walks/:walk_id/photos/        - List photos for a walk
    POST /api/v1/walks/:walk_id/photos/         - Upload a photo (multipart form)
    DELETE /api/v1/walks/:walk_id/photos/:id/   - Delete a photo
    """
    permission_classes = [IsAuthenticated, IsOrgMember]
    parser_classes = [MultiPartParser, FormParser]

    def _get_walk(self, request, walk_id):
        try:
            walk = Walk.objects.get(id=walk_id, organization=request.org)
        except Walk.DoesNotExist:
            return None
        # Check store-level access (pass request so platform admins see all)
        accessible = get_accessible_store_ids(request)
        if accessible is not None and walk.store_id not in accessible:
            return None
        return walk

    def get(self, request, walk_id):
        walk = self._get_walk(request, walk_id)
        if not walk:
            return Response({'detail': 'Not found.'}, status=404)
        photos = WalkPhoto.objects.filter(walk=walk).order_by('created_at')
        return Response(WalkPhotoSerializer(photos, many=True).data)

    def post(self, request, walk_id):
        walk = self._get_walk(request, walk_id)
        if not walk:
            return Response({'detail': 'Not found.'}, status=404)
        if walk.is_locked:
            return Response(
                {'detail': 'This walk is locked and can no longer be edited.'},
                status=403,
            )
        # Only the evaluator who conducted the walk can add photos
        if not IsWalkEvaluatorOrAdmin().has_object_permission(request, self, walk):
            return Response(
                {'detail': IsWalkEvaluatorOrAdmin.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=400)

        # Extract EXIF date and compute hash BEFORE processing
        exif_date = extract_exif_date(image_file)
        image_hash = compute_image_hash(image_file)

        # Check for duplicate: reject if same hash already exists for this walk
        if image_hash and WalkPhoto.objects.filter(walk=walk, image_hash=image_hash).exists():
            return Response(
                {'detail': 'This photo has already been uploaded to this walk.'},
                status=400,
            )

        # Check freshness: if EXIF date exists and is older than 24 hours, flag it
        is_fresh = True
        if exif_date:
            now = dj_timezone.now()
            # Make exif_date timezone-aware if it isn't
            if dj_timezone.is_naive(exif_date):
                exif_date = dj_timezone.make_aware(exif_date)
            if now - exif_date > timedelta(hours=24):
                is_fresh = False

        # Process: resize and compress
        processed = process_uploaded_image(image_file)

        photo = WalkPhoto(
            walk=walk,
            section_id=request.data.get('section') or None,
            criterion_id=request.data.get('criterion') or None,
            score_id=request.data.get('score') or None,
            caption=request.data.get('caption', ''),
            exif_date=exif_date,
            image_hash=image_hash,
            is_fresh=is_fresh,
        )
        photo.image.save(processed.name, processed, save=True)

        return Response(WalkPhotoSerializer(photo).data, status=201)

    def delete(self, request, walk_id, photo_id=None):
        walk = self._get_walk(request, walk_id)
        if not walk:
            return Response({'detail': 'Not found.'}, status=404)
        if not photo_id:
            return Response({'detail': 'Photo ID required.'}, status=400)
        try:
            photo = WalkPhoto.objects.get(id=photo_id, walk=walk)
        except WalkPhoto.DoesNotExist:
            return Response({'detail': 'Photo not found.'}, status=404)
        # Delete the file from storage
        if photo.image:
            photo.image.delete(save=False)
        photo.delete()
        return Response(status=204)


class WalkSectionNoteView(APIView):
    """
    GET  /api/v1/walks/:walk_id/section-notes/    - List section notes
    POST /api/v1/walks/:walk_id/section-notes/     - Create/update a section note
    """
    permission_classes = [IsAuthenticated, IsOrgManagerOrAbove]

    def _get_walk(self, request, walk_id):
        try:
            return Walk.objects.get(id=walk_id, organization=request.org)
        except Walk.DoesNotExist:
            return None

    def get(self, request, walk_id):
        walk = self._get_walk(request, walk_id)
        if not walk:
            return Response({'detail': 'Not found.'}, status=404)
        notes = WalkSectionNote.objects.filter(walk=walk)
        return Response(WalkSectionNoteSerializer(notes, many=True).data)

    def post(self, request, walk_id):
        walk = self._get_walk(request, walk_id)
        if not walk:
            return Response({'detail': 'Not found.'}, status=404)
        if walk.is_locked:
            return Response(
                {'detail': 'This walk is locked and can no longer be edited.'},
                status=403,
            )
        # Only the evaluator who conducted the walk can edit notes
        if not IsWalkEvaluatorOrAdmin().has_object_permission(request, self, walk):
            return Response(
                {'detail': IsWalkEvaluatorOrAdmin.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        section_id = request.data.get('section')
        if not section_id:
            return Response({'detail': 'Section ID is required.'}, status=400)

        note, _created = WalkSectionNote.objects.update_or_create(
            walk=walk,
            section_id=section_id,
            defaults={
                'notes': request.data.get('notes', ''),
                'areas_needing_attention': request.data.get('areas_needing_attention', ''),
            },
        )
        return Response(WalkSectionNoteSerializer(note).data, status=200)


class AnalyzePhotoView(APIView):
    """
    POST /api/v1/walks/analyze-photo/
    Accepts a photo (multipart) + optional context and returns AI analysis.
    Enterprise feature — gated by plan.
    """
    permission_classes = [IsAuthenticated, IsOrgManagerOrAbove]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not HasFeature('ai_photo_analysis').has_permission(request, self):
            return Response(
                {'detail': 'AI photo analysis requires an Enterprise plan.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=400)

        criterion_name = request.data.get('criterion_name', '')
        section_name = request.data.get('section_name', '')
        evaluator_notes = request.data.get('caption', '').strip()

        # Read image bytes and determine media type
        image_bytes = image_file.read()
        content_type = image_file.content_type or 'image/jpeg'

        import base64
        import anthropic
        from django.conf import settings as django_settings

        if not django_settings.ANTHROPIC_API_KEY:
            return Response(
                {'detail': 'AI service not configured.'},
                status=503,
            )

        # Build context prompt
        context_parts = []
        if section_name:
            context_parts.append(f'Section: {section_name}')
        if criterion_name:
            context_parts.append(f'Criterion: {criterion_name}')
        context = ', '.join(context_parts) if context_parts else 'General store observation'

        evaluator_context = ''
        if evaluator_notes:
            evaluator_context = f'\n\nThe evaluator noted: "{evaluator_notes}"\nPlease incorporate their observation into your analysis and assess whether the photo supports their concern.'

        prompt = f"""You are analyzing a photo for a retail store quality walk-through evaluation.

You are specifically evaluating: {criterion_name or 'General observation'}
Store area category: {section_name or 'General'}
Note: Category names describe the evaluation topic, not literal objects. For example "Curb Appeal" means the store's overall exterior appearance and first impression, not an actual curb.
{evaluator_context}

Provide your response in exactly this format:
SCORE: [number 1-5]
[Your 2-3 sentence analysis of what you see related to "{criterion_name or 'this area'}". Mention any issues needing attention and anything done well.]

The score must be on the first line as "SCORE: X" where X is 1-5 (1=Poor, 2=Fair, 3=Average, 4=Good, 5=Great).
Keep the analysis concise and actionable. Do not use markdown headers or bullet points. Write in plain sentences."""

        try:
            image_b64 = base64.standard_b64encode(image_bytes).decode('utf-8')

            client = anthropic.Anthropic(api_key=django_settings.ANTHROPIC_API_KEY)
            message = client.messages.create(
                model='claude-sonnet-4-5-20250929',
                max_tokens=300,
                messages=[{
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': content_type,
                                'data': image_b64,
                            },
                        },
                        {
                            'type': 'text',
                            'text': prompt,
                        },
                    ],
                }],
            )

            raw_text = message.content[0].text

            # Parse score from response
            import re
            suggested_score = None
            analysis = raw_text
            score_match = re.match(r'SCORE:\s*(\d)', raw_text)
            if score_match:
                suggested_score = int(score_match.group(1))
                if suggested_score < 1 or suggested_score > 5:
                    suggested_score = None
                # Remove the SCORE line from the analysis text
                analysis = re.sub(r'^SCORE:\s*\d\s*\n?', '', raw_text).strip()

            response_data = {'analysis': analysis}
            if suggested_score is not None:
                response_data['suggested_score'] = suggested_score
            return Response(response_data)

        except Exception as e:
            logger.error(f'AI photo analysis error: {e}')
            return Response(
                {'detail': 'Failed to analyze photo. Please try again.'},
                status=500,
            )


# ==================== Feature 1: Evaluation Schedules ====================


class EvaluationScheduleViewSet(ModelViewSet):
    """CRUD for evaluation schedules. Admin+ can create/edit. Pro+ feature."""
    serializer_class = EvaluationScheduleSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgManagerOrAbove(), HasFeature('evaluation_schedules')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('evaluation_schedules')]

    def get_queryset(self):
        return EvaluationSchedule.objects.filter(
            organization=self.request.org,
        ).select_related('template', 'assigned_evaluator', 'created_by', 'region', 'store')

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.org,
            created_by=self.request.user,
        )


class CalendarFeedTokenView(APIView):
    """Get or regenerate the user's calendar feed token. Pro+ feature."""
    permission_classes = [IsAuthenticated, IsOrgMember]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not HasFeature('calendar_feeds').has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Calendar feeds require a Pro or Enterprise plan.')

    def get(self, request):
        token, _created = CalendarToken.objects.get_or_create(user=request.user)
        return Response(CalendarTokenSerializer(token).data)

    def post(self, request):
        """Regenerate the calendar token."""
        from django.utils.crypto import get_random_string
        token, _created = CalendarToken.objects.get_or_create(user=request.user)
        token.token = get_random_string(length=48)
        token.save(update_fields=['token'])
        return Response(CalendarTokenSerializer(token).data)


class CalendarFeedView(APIView):
    """
    GET /api/v1/walks/calendar-feed/<token>/
    Returns an iCal (.ics) file with scheduled walks for the token's user.
    No authentication required — the token itself is the auth.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        try:
            cal_token = CalendarToken.objects.select_related('user').get(token=token)
        except CalendarToken.DoesNotExist:
            return HttpResponse('Invalid token', status=404, content_type='text/plain')

        user = cal_token.user

        # Get all organizations the user belongs to
        from apps.accounts.models import Membership
        memberships = Membership.objects.filter(user=user).select_related('organization')

        walks = Walk.objects.filter(
            organization__in=[m.organization for m in memberships],
            status__in=[Walk.Status.SCHEDULED, Walk.Status.IN_PROGRESS],
            department__isnull=True,  # Exclude department evaluations
        ).select_related('store', 'template').order_by('scheduled_date')

        # Build iCal
        lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//StoreScore//Walk Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:StoreScore Walks',
        ]

        for walk in walks:
            date_str = walk.scheduled_date.strftime('%Y%m%d')
            uid = f'{walk.id}@storescore.app'
            summary = f'Walk: {walk.store.name}'
            description = f'Template: {walk.template.name}'
            if walk.store.address:
                description += f'\\nLocation: {walk.store.address}'

            lines.extend([
                'BEGIN:VEVENT',
                f'UID:{uid}',
                f'DTSTART;VALUE=DATE:{date_str}',
                f'DTEND;VALUE=DATE:{date_str}',
                f'SUMMARY:{summary}',
                f'DESCRIPTION:{description}',
                'BEGIN:VALARM',
                'TRIGGER:-P1D',
                'ACTION:DISPLAY',
                f'DESCRIPTION:Walk reminder: {walk.store.name}',
                'END:VALARM',
                'END:VEVENT',
            ])

        lines.append('END:VCALENDAR')
        ical_content = '\r\n'.join(lines)

        response = HttpResponse(ical_content, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="storescore-walks.ics"'
        return response


# ==================== Feature 2: Action Items ====================


class ActionItemViewSet(ModelViewSet):
    """CRUD for action items with role-based access. Pro+ feature."""
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('action_items')]
        return [IsAuthenticated(), IsOrgManagerOrAbove(), HasFeature('action_items')]

    def get_serializer_class(self):
        if self.action == 'list':
            return ActionItemListSerializer
        return ActionItemDetailSerializer

    def get_queryset(self):
        queryset = ActionItem.objects.filter(
            organization=self.request.org,
        ).select_related(
            'walk__store', 'criterion', 'score',
            'assigned_to', 'created_by', 'original_photo',
        )

        # Apply store-level scoping
        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(walk__store_id__in=accessible_ids)

        # Filters
        item_status = self.request.query_params.get('status')
        if item_status:
            queryset = queryset.filter(status=item_status)

        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(walk__store_id=store)

        walk = self.request.query_params.get('walk')
        if walk:
            queryset = queryset.filter(walk_id=walk)

        assigned_to = self.request.query_params.get('assigned_to')
        if assigned_to:
            if assigned_to == 'me':
                queryset = queryset.filter(assigned_to=self.request.user)
            else:
                queryset = queryset.filter(assigned_to_id=assigned_to)

        return queryset

    def perform_update(self, serializer):
        from django.utils import timezone
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')
        if new_status == ActionItem.Status.RESOLVED and instance.status != ActionItem.Status.RESOLVED:
            serializer.save(
                resolved_at=timezone.now(),
                resolved_by=self.request.user,
            )
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='respond')
    def submit_response(self, request, pk=None):
        """Submit a response (with optional photos) for an action item."""
        action_item = self.get_object()

        response_serializer = ActionItemResponseSerializer(data={
            'action_item': action_item.id,
            'notes': request.data.get('notes', ''),
        })
        response_serializer.is_valid(raise_exception=True)
        response_obj = response_serializer.save(
            submitted_by=request.user,
            organization=request.org,
        )

        # Update status to in_progress if it was open
        if action_item.status == ActionItem.Status.OPEN:
            action_item.status = ActionItem.Status.IN_PROGRESS
            action_item.save(update_fields=['status'])

        return Response(
            ActionItemResponseSerializer(response_obj).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True, methods=['post'], url_path='verify-photo',
        parser_classes=[MultiPartParser, FormParser],
    )
    def verify_photo(self, request, pk=None):
        """
        Upload a follow-up photo and get AI verification against the original.
        Also saves it as an ActionItemPhoto on the latest response.
        Enterprise feature (AI photo analysis).
        """
        action_item = self.get_object()
        # AI verification requires Enterprise plan
        skip_ai = not HasFeature('ai_photo_analysis').has_permission(request, self)

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=400)

        # Get or create a response to attach the photo to
        response_obj = action_item.responses.last()
        if not response_obj:
            response_obj = ActionItemResponse.objects.create(
                action_item=action_item,
                submitted_by=request.user,
                organization=request.org,
                notes='Photo follow-up',
            )

        processed = process_uploaded_image(image_file)
        photo = ActionItemPhoto(
            response=response_obj,
            organization=request.org,
            caption=request.data.get('caption', ''),
        )
        photo.image.save(processed.name, processed, save=True)

        # AI verification (Enterprise only)
        import base64
        import anthropic
        from django.conf import settings as django_settings

        ai_analysis = ''
        if not skip_ai and django_settings.ANTHROPIC_API_KEY:
            try:
                image_file.seek(0)
                image_bytes = image_file.read()
                content_type = image_file.content_type or 'image/jpeg'
                image_b64 = base64.standard_b64encode(image_bytes).decode('utf-8')

                prompt = f"""You are verifying whether a corrective action was completed at a retail store.

The original issue was: "{action_item.criterion.name}" scored {action_item.score.points}/{action_item.criterion.max_points} points.
Issue description: {action_item.description}

Please analyze this follow-up photo and determine:
1. Does the photo show the relevant area/issue has been addressed?
2. What is the current state?

Respond in this format:
STATUS: [RESOLVED or NEEDS_MORE_WORK]
[2-3 sentence analysis of what you see and whether the issue appears to be fixed.]"""

                client = anthropic.Anthropic(api_key=django_settings.ANTHROPIC_API_KEY)
                message = client.messages.create(
                    model='claude-sonnet-4-5-20250929',
                    max_tokens=300,
                    messages=[{
                        'role': 'user',
                        'content': [
                            {
                                'type': 'image',
                                'source': {
                                    'type': 'base64',
                                    'media_type': content_type,
                                    'data': image_b64,
                                },
                            },
                            {'type': 'text', 'text': prompt},
                        ],
                    }],
                )

                ai_analysis = message.content[0].text
                photo.ai_analysis = ai_analysis
                photo.save(update_fields=['ai_analysis'])

            except Exception as e:
                logger.error(f'AI verification error for action item {action_item.id}: {e}')
                ai_analysis = 'AI analysis unavailable.'

        return Response({
            'photo_id': str(photo.id),
            'ai_analysis': ai_analysis,
        })


# ==================== Feature 3: Self-Assessments ====================


class SelfAssessmentTemplateViewSet(ModelViewSet):
    """CRUD for self-assessment templates. Admin+ can create/edit. Pro+ feature."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgManagerOrAbove(), HasFeature('self_assessments')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('self_assessments')]

    def get_serializer_class(self):
        if self.action == 'list':
            return SelfAssessmentTemplateListSerializer
        return SelfAssessmentTemplateDetailSerializer

    def get_queryset(self):
        return SelfAssessmentTemplate.objects.filter(
            organization=self.request.org,
        ).prefetch_related('prompts')

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.org,
            created_by=self.request.user,
        )


class SelfAssessmentViewSet(ModelViewSet):
    """CRUD for self-assessment instances. Pro+ feature."""
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('self_assessments')]
        if self.action == 'create':
            return [IsAuthenticated(), IsOrgAdmin(), HasFeature('self_assessments')]
        return [IsAuthenticated(), IsOrgManagerOrAbove(), HasFeature('self_assessments')]

    def get_serializer_class(self):
        if self.action == 'list':
            return SelfAssessmentListSerializer
        return SelfAssessmentDetailSerializer

    def get_queryset(self):
        queryset = SelfAssessment.objects.filter(
            organization=self.request.org,
        ).select_related('template', 'store', 'submitted_by', 'reviewed_by')

        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(store_id__in=accessible_ids)

        sa_status = self.request.query_params.get('status')
        if sa_status:
            queryset = queryset.filter(status=sa_status)

        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_assessment(self, request, pk=None):
        """Mark a self-assessment as submitted and trigger AI evaluation."""
        assessment = self.get_object()
        if assessment.status != SelfAssessment.Status.PENDING:
            return Response(
                {'detail': 'Assessment has already been submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        assessment.status = SelfAssessment.Status.SUBMITTED
        assessment.submitted_at = timezone.now()
        assessment.save(update_fields=['status', 'submitted_at'])

        # Trigger async AI evaluation
        from .tasks import process_assessment_submissions
        process_assessment_submissions.delay(str(assessment.id))

        return Response(SelfAssessmentDetailSerializer(assessment).data)

    @action(detail=True, methods=['post'], url_path='review')
    def review_assessment(self, request, pk=None):
        """Regional manager reviews a submitted assessment."""
        assessment = self.get_object()
        if assessment.status != SelfAssessment.Status.SUBMITTED:
            return Response(
                {'detail': 'Assessment must be submitted before review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        assessment.status = SelfAssessment.Status.REVIEWED
        assessment.reviewed_by = request.user
        assessment.reviewed_at = timezone.now()
        assessment.reviewer_notes = request.data.get('reviewer_notes', '')
        assessment.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'reviewer_notes'])

        return Response(SelfAssessmentDetailSerializer(assessment).data)


# ==================== Corrective Actions ====================


class CorrectiveActionViewSet(ModelViewSet):
    """
    List and resolve corrective actions (overdue evaluations, unacknowledged walks).
    Pro+ feature. Admin+ can view; PATCH to resolve.
    """
    serializer_class = CorrectiveActionListSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        return [IsAuthenticated(), IsOrgManagerOrAbove(), HasFeature('corrective_actions')]

    def get_queryset(self):
        queryset = CorrectiveAction.objects.filter(
            organization=self.request.org,
        ).select_related('walk__store', 'store', 'responsible_user')

        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(store_id__in=accessible_ids)

        ca_status = self.request.query_params.get('status')
        if ca_status:
            queryset = queryset.filter(status=ca_status)

        action_type = self.request.query_params.get('action_type')
        if action_type:
            queryset = queryset.filter(action_type=action_type)

        escalation_level = self.request.query_params.get('escalation_level')
        if escalation_level:
            queryset = queryset.filter(escalation_level=escalation_level)

        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        return queryset.order_by('-created_at')

    def perform_update(self, serializer):
        from django.utils import timezone
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')
        if new_status == 'resolved' and instance.status != 'resolved':
            serializer.save(resolved_at=timezone.now())
        else:
            serializer.save()


class CorrectiveActionSummaryView(APIView):
    """GET /api/v1/walks/corrective-actions/summary/ — counts for dashboard widget."""
    permission_classes = [IsAuthenticated, IsOrgManagerOrAbove]

    def get(self, request):
        from django.db.models import Count, Q

        qs = CorrectiveAction.objects.filter(
            organization=request.org,
            status='open',
        )

        accessible_ids = get_accessible_store_ids(request)
        if accessible_ids is not None:
            qs = qs.filter(store_id__in=accessible_ids)

        counts = qs.aggregate(
            total=Count('id'),
            critical=Count('id', filter=Q(escalation_level='critical')),
            escalated=Count('id', filter=Q(escalation_level='escalated')),
            reminder=Count('id', filter=Q(escalation_level='reminder')),
            overdue_evaluations=Count('id', filter=Q(action_type='overdue_evaluation')),
            unacknowledged_walks=Count('id', filter=Q(action_type='unacknowledged_walk')),
        )

        return Response(counts)


# ==================== SOP Documents ====================


class SOPDocumentViewSet(ModelViewSet):
    """CRUD for SOP documents. Pro+ feature. Admin+ can create/edit."""
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('sop_documents')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('sop_documents')]

    def get_serializer_class(self):
        if self.action in ('list',):
            return SOPDocumentListSerializer
        return SOPDocumentDetailSerializer

    def get_queryset(self):
        return SOPDocument.objects.filter(
            organization=self.request.org,
        ).select_related('uploaded_by').prefetch_related('criterion_links__criterion')

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get('file')
        extra = {'organization': self.request.org, 'uploaded_by': self.request.user}
        if file_obj:
            extra['file_size_bytes'] = file_obj.size
            name = file_obj.name.lower()
            if name.endswith('.pdf'):
                extra['file_type'] = 'pdf'
            elif name.endswith('.docx'):
                extra['file_type'] = 'docx'
            elif name.endswith('.txt'):
                extra['file_type'] = 'txt'
            else:
                extra['file_type'] = 'other'
        instance = serializer.save(**extra)

        # Trigger async text extraction
        from .tasks import extract_sop_text
        extract_sop_text.delay(str(instance.id))

    @action(detail=True, methods=['post'], url_path='analyze')
    def analyze(self, request, pk=None):
        """Trigger AI analysis to match SOP content to criteria. Enterprise feature."""
        if not HasFeature('ai_sop_analysis').has_permission(request, self):
            return Response(
                {'detail': 'AI SOP analysis requires an Enterprise plan.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        sop = self.get_object()
        if not sop.extracted_text:
            return Response(
                {'detail': 'Text has not been extracted yet. Please wait and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .tasks import analyze_sop_criteria_match
        analyze_sop_criteria_match.delay(str(sop.id))
        return Response({'detail': 'AI analysis started. Results will appear shortly.'})


class SOPCriterionLinkViewSet(ModelViewSet):
    """CRUD for SOP-criterion links. Admin+ can create/edit. Pro+ feature."""
    serializer_class = SOPCriterionLinkSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('sop_documents')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('sop_documents')]

    def get_queryset(self):
        queryset = SOPCriterionLink.objects.filter(
            sop_document__organization=self.request.org,
        ).select_related('sop_document', 'criterion')

        sop = self.request.query_params.get('sop_document')
        if sop:
            queryset = queryset.filter(sop_document_id=sop)

        criterion = self.request.query_params.get('criterion')
        if criterion:
            queryset = queryset.filter(criterion_id=criterion)

        return queryset


# ==================== Scoring Drivers ====================


class DriverViewSet(ModelViewSet):
    """CRUD for scoring drivers. Admin+ can create/edit."""
    serializer_class = DriverSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        queryset = Driver.objects.filter(
            organization=self.request.org,
        )

        criterion = self.request.query_params.get('criterion')
        if criterion:
            queryset = queryset.filter(criterion_id=criterion)

        return queryset.order_by('criterion', 'order')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


class AssessmentSubmissionView(APIView):
    """
    POST /api/v1/walks/assessments/:assessment_id/submissions/
    Upload a photo submission for a specific prompt. Pro+ feature.
    """
    permission_classes = [IsAuthenticated, IsOrgManagerOrAbove]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not HasFeature('self_assessments').has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Self-assessments require a Pro or Enterprise plan.')
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, assessment_id):
        try:
            assessment = SelfAssessment.objects.get(
                id=assessment_id, organization=request.org,
            )
        except SelfAssessment.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if assessment.status != SelfAssessment.Status.PENDING:
            return Response(
                {'detail': 'Assessment has already been submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=400)

        prompt_id = request.data.get('prompt')
        if not prompt_id:
            return Response({'detail': 'Prompt ID is required.'}, status=400)

        processed = process_uploaded_image(image_file)
        submission = AssessmentSubmission(
            assessment=assessment,
            prompt_id=prompt_id,
            organization=request.org,
            caption=request.data.get('caption', ''),
            self_rating=request.data.get('self_rating', ''),
        )
        submission.image.save(processed.name, processed, save=True)

        return Response(AssessmentSubmissionSerializer(submission).data, status=201)


# ==================== Departments ====================


class DepartmentTypeViewSet(ModelViewSet):
    """
    Department type catalog (platform-level).
    Any authenticated user can browse. Org admins can install.
    Platform admins can CRUD.
    """

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action == 'install':
            return [IsAuthenticated(), IsOrgAdmin()]
        return [IsAuthenticated()]

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action not in ('list', 'retrieve', 'install'):
            if not (request.user.is_staff or request.user.is_superuser):
                self.permission_denied(request, message='Platform admin access required.')

    def get_serializer_class(self):
        if self.action == 'list':
            return DepartmentTypeListSerializer
        return DepartmentTypeDetailSerializer

    def get_queryset(self):
        queryset = DepartmentType.objects.all()
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            queryset = queryset.filter(is_active=True)

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        industry = self.request.query_params.get('industry')
        if industry:
            queryset = queryset.filter(industry=industry)

        return queryset

    @action(detail=True, methods=['post'], url_path='install')
    def install(self, request, pk=None):
        """
        Clone this department type into the requesting org as a Department
        with pre-built sections and criteria.
        """
        dept_type = self.get_object()
        org = request.org
        structure = dept_type.default_structure or {}
        sections_data = structure.get('sections', [])

        department = Department.objects.create(
            organization=org,
            department_type=dept_type,
            name=dept_type.name,
            description=dept_type.description,
            is_active=True,
        )

        for sec_data in sections_data:
            section = Section.objects.create(
                department=department,
                name=sec_data.get('name', ''),
                order=sec_data.get('order', 0),
                weight=sec_data.get('weight', '0.00'),
            )
            for crit_data in sec_data.get('criteria', []):
                Criterion.objects.create(
                    section=section,
                    name=crit_data.get('name', ''),
                    description=crit_data.get('description', ''),
                    order=crit_data.get('order', 0),
                    max_points=crit_data.get('max_points', 5),
                    scoring_guidance=crit_data.get('scoring_guidance', ''),
                )

        DepartmentType.objects.filter(pk=dept_type.pk).update(
            install_count=models.F('install_count') + 1,
        )

        serializer = DepartmentDetailSerializer(department)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DepartmentViewSet(ModelViewSet):
    """CRUD for org-scoped departments. Admin+ can create/edit."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return DepartmentListSerializer
        return DepartmentDetailSerializer

    def get_queryset(self):
        queryset = Department.objects.filter(
            organization=self.request.org,
        ).prefetch_related('sections__criteria')

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


# ==================== Industry Template Library ====================


class IndustryTemplateViewSet(ModelViewSet):
    """
    Public-read template library. Platform admins (staff/superuser) can
    create / edit / delete.  Any authenticated org member can browse and
    install (clone) a template into their organisation.
    """

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action == 'install':
            return [IsAuthenticated(), IsOrgAdmin()]
        # create / update / destroy — platform admin only
        return [IsAuthenticated()]

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action not in ('list', 'retrieve', 'install', 'export_template'):
            if not (request.user.is_staff or request.user.is_superuser):
                self.permission_denied(request, message='Platform admin access required.')

    def get_serializer_class(self):
        if self.action == 'list':
            return IndustryTemplateListSerializer
        return IndustryTemplateDetailSerializer

    def get_queryset(self):
        queryset = IndustryTemplate.objects.all()

        # Non-platform-admins only see active templates
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            queryset = queryset.filter(is_active=True)

        industry = self.request.query_params.get('industry')
        if industry:
            queryset = queryset.filter(industry=industry)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='install')
    def install(self, request, pk=None):
        """
        Clone this library template into the requesting org's ScoringTemplate.

        POST /walks/library/{id}/install/
        Returns the newly created ScoringTemplate.
        """
        industry_template = self.get_object()
        org = request.org
        structure = industry_template.structure or {}
        sections_data = structure.get('sections', [])

        # Create the ScoringTemplate
        scoring_template = ScoringTemplate.objects.create(
            organization=org,
            name=industry_template.name,
            is_active=True,
            source_industry_template=industry_template,
        )

        # Deep-clone sections → criteria → drivers
        from apps.walks.models import Criterion as CriterionModel, Driver as DriverModel
        for sec_data in sections_data:
            section = Section.objects.create(
                template=scoring_template,
                name=sec_data.get('name', ''),
                order=sec_data.get('order', 0),
                weight=sec_data.get('weight', '0.00'),
            )
            for crit_data in sec_data.get('criteria', []):
                criterion = CriterionModel.objects.create(
                    section=section,
                    name=crit_data.get('name', ''),
                    description=crit_data.get('description', ''),
                    order=crit_data.get('order', 0),
                    max_points=crit_data.get('max_points', 5),
                    sop_text=crit_data.get('sop_text', ''),
                    sop_url=crit_data.get('sop_url', ''),
                    scoring_guidance=crit_data.get('scoring_guidance', ''),
                )
                for drv_data in crit_data.get('drivers', []):
                    DriverModel.objects.create(
                        organization=org,
                        criterion=criterion,
                        name=drv_data.get('name', ''),
                        order=drv_data.get('order', 0),
                        is_active=True,
                    )

        # Increment install count
        IndustryTemplate.objects.filter(pk=industry_template.pk).update(
            install_count=models.F('install_count') + 1,
        )

        serializer = ScoringTemplateDetailSerializer(scoring_template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='export')
    def export_template(self, request, pk=None):
        """
        Platform admin: snapshot an existing org ScoringTemplate into the
        library as a new IndustryTemplate.  Expects JSON body:
        { "scoring_template_id": "<uuid>" }

        Alternatively, if called on an existing IndustryTemplate, refreshes
        the structure from the linked ScoringTemplate.
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': 'Platform admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        scoring_template_id = request.data.get('scoring_template_id')
        if not scoring_template_id:
            return Response(
                {'detail': 'scoring_template_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            st = ScoringTemplate.objects.prefetch_related(
                'sections__criteria__drivers',
            ).get(pk=scoring_template_id)
        except ScoringTemplate.DoesNotExist:
            return Response({'detail': 'ScoringTemplate not found.'}, status=404)

        # Build the structure JSON
        structure = {'sections': []}
        for section in st.sections.all().order_by('order'):
            sec_dict = {
                'name': section.name,
                'order': section.order,
                'weight': str(section.weight),
                'criteria': [],
            }
            for criterion in section.criteria.all().order_by('order'):
                crit_dict = {
                    'name': criterion.name,
                    'description': criterion.description,
                    'order': criterion.order,
                    'max_points': criterion.max_points,
                    'sop_text': criterion.sop_text,
                    'sop_url': criterion.sop_url,
                    'scoring_guidance': criterion.scoring_guidance,
                    'drivers': [],
                }
                for driver in criterion.drivers.filter(is_active=True).order_by('order'):
                    crit_dict['drivers'].append({
                        'name': driver.name,
                        'order': driver.order,
                    })
                sec_dict['criteria'].append(crit_dict)
            structure['sections'].append(sec_dict)

        # Update or create
        industry_template = self.get_object()
        industry_template.structure = structure
        industry_template.version = (industry_template.version or 0) + 1
        industry_template.save(update_fields=['structure', 'version', 'updated_at'])

        serializer = IndustryTemplateDetailSerializer(industry_template)
        return Response(serializer.data)
