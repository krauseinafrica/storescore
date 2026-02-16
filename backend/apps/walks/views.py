from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsOrgAdmin, IsOrgManagerOrAbove, IsOrgMember

from .models import Score, ScoringTemplate, Walk
from .serializers import (
    ScoreSerializer,
    ScoringTemplateDetailSerializer,
    ScoringTemplateListSerializer,
    WalkDetailSerializer,
    WalkListSerializer,
)


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
        ).prefetch_related('sections__criteria')

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


class WalkViewSet(ModelViewSet):
    """CRUD operations for walks, scoped to the current organization."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        if self.action in ('create', 'submit_scores', 'complete_walk'):
            return [IsAuthenticated(), IsOrgManagerOrAbove()]
        # update, partial_update, destroy
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return WalkListSerializer
        return WalkDetailSerializer

    def get_queryset(self):
        queryset = Walk.objects.filter(
            organization=self.request.org,
        ).select_related('store', 'template', 'conducted_by')

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

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)

    @action(detail=True, methods=['post'], url_path='scores')
    def submit_scores(self, request, pk=None):
        """Submit or update scores for a walk."""
        walk = self.get_object()
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

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_walk(self, request, pk=None):
        """
        Mark a walk as completed and trigger AI summary + email.

        Accepts optional JSON body:
        {
            "notify_manager": true,            // email the store manager (default true)
            "notify_evaluator": true,           // email the person who conducted the walk
            "additional_emails": ["a@b.com"]    // extra recipients
        }
        """
        walk = self.get_object()

        if walk.status == Walk.Status.COMPLETED:
            return Response(
                {'detail': 'Walk is already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        walk.status = Walk.Status.COMPLETED
        walk.completed_date = timezone.now()
        walk.total_score = walk.calculate_total_score()
        walk.save(update_fields=['status', 'completed_date', 'total_score'])

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
