"""
Celery tasks for walk processing — AI summary generation, email notifications,
evaluation scheduling, reminders, action items, and self-assessment AI evaluation.
"""

import logging
from datetime import date, timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_walk_completion(self, walk_id: str, recipient_emails: list[str]):
    """
    After a walk is completed:
    1. Generate an AI summary via Claude API
    2. Store the summary on the walk
    3. Send the results email to specified recipients
    4. Auto-generate action items for low-scoring criteria
    """
    from .models import Walk
    from .services import generate_walk_summary, send_walk_email

    try:
        walk = Walk.objects.select_related(
            'store__organization',
            'template',
            'conducted_by',
        ).get(id=walk_id)
    except Walk.DoesNotExist:
        logger.error(f'Walk {walk_id} not found')
        return

    # Generate AI summary (skip if evaluator already provided one)
    if walk.ai_summary:
        summary = walk.ai_summary
        logger.info(f'Using evaluator-provided summary for walk {walk_id}')
    else:
        logger.info(f'Generating AI summary for walk {walk_id}')
        summary = generate_walk_summary(walk)
        walk.ai_summary = summary
        walk.save(update_fields=['ai_summary'])
        logger.info(f'AI summary saved for walk {walk_id}')

    # Send email
    if recipient_emails:
        logger.info(f'Sending walk email to {recipient_emails}')
        send_walk_email(walk, summary, recipient_emails)

    # Auto-generate action items for low scores
    from .services import auto_generate_action_items
    auto_generate_action_items(walk)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def send_scheduled_digest_reports(self):
    """
    Periodic task: check all active ReportSchedule entries
    and send digest emails where due.
    - Weekly: sent if last_sent_at is >6 days ago (or never sent)
    - Monthly: sent if last_sent_at is >27 days ago (or never sent)
    """
    from .models import ReportSchedule
    from .services import send_digest_email

    now = timezone.now()
    schedules = ReportSchedule.objects.filter(is_active=True).select_related(
        'user', 'organization'
    )

    sent_count = 0
    for schedule in schedules:
        if schedule.frequency == 'weekly':
            threshold = now - timedelta(days=6)
        else:  # monthly
            threshold = now - timedelta(days=27)

        if schedule.last_sent_at and schedule.last_sent_at > threshold:
            continue  # not due yet

        try:
            success = send_digest_email(schedule)
            if success:
                schedule.last_sent_at = now
                schedule.save(update_fields=['last_sent_at'])
                sent_count += 1
        except Exception as e:
            logger.error(
                f'Failed to send {schedule.frequency} digest to '
                f'{schedule.user.email} for org {schedule.organization.name}: {e}'
            )

    logger.info(f'Scheduled digest reports: sent {sent_count} emails')


# ==================== Feature 1: Evaluation Schedules ====================


def _advance_next_run_date(schedule):
    """Calculate the next run date based on frequency."""
    current = schedule.next_run_date
    if schedule.frequency == 'weekly':
        return current + timedelta(weeks=1)
    elif schedule.frequency == 'biweekly':
        return current + timedelta(weeks=2)
    elif schedule.frequency == 'monthly':
        # Same day next month
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        day = min(schedule.day_of_month or current.day, 28)
        return date(year, month, day)
    elif schedule.frequency == 'quarterly':
        month = current.month + 3
        year = current.year
        while month > 12:
            month -= 12
            year += 1
        day = min(schedule.day_of_month or current.day, 28)
        return date(year, month, day)
    return current + timedelta(weeks=1)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def check_evaluation_schedules(self):
    """
    Runs daily at 6am UTC. For each active schedule where next_run_date <= today:
    - Create Walk records (status=SCHEDULED) for applicable stores
    - Advance next_run_date
    - Send notification email to assigned evaluator
    """
    from apps.accounts.models import StoreAssignment
    from apps.stores.models import Store

    from .models import EvaluationSchedule, Walk
    from .services import send_schedule_notification_email

    today = date.today()
    schedules = EvaluationSchedule.objects.filter(
        is_active=True, next_run_date__lte=today,
    ).select_related('template', 'assigned_evaluator', 'region', 'store', 'organization')

    created_count = 0
    for schedule in schedules:
        org = schedule.organization

        # Determine which stores to create walks for
        if schedule.scope == 'store' and schedule.store:
            stores = [schedule.store]
        elif schedule.scope == 'region' and schedule.region:
            stores = list(Store.objects.filter(
                organization=org, region=schedule.region, is_active=True,
            ))
        else:  # organization-wide
            stores = list(Store.objects.filter(
                organization=org, is_active=True,
            ))

        for store in stores:
            # Determine evaluator: use assigned_evaluator, or fall back to store manager
            evaluator = schedule.assigned_evaluator
            if not evaluator:
                # Find a store manager assigned to this store
                assignment = StoreAssignment.objects.filter(
                    store=store,
                    membership__organization=org,
                    membership__role='store_manager',
                ).select_related('membership__user').first()
                if assignment:
                    evaluator = assignment.membership.user

            if not evaluator:
                logger.warning(
                    f'No evaluator found for schedule {schedule.id}, store {store.name}. Skipping.'
                )
                continue

            Walk.objects.create(
                organization=org,
                store=store,
                template=schedule.template,
                conducted_by=evaluator,
                scheduled_date=schedule.next_run_date,
                status=Walk.Status.SCHEDULED,
            )
            created_count += 1

            # Send notification
            send_schedule_notification_email(
                evaluator=evaluator,
                store=store,
                template=schedule.template,
                scheduled_date=schedule.next_run_date,
                org_name=org.name,
            )

        # Advance schedule
        schedule.last_run_date = today
        schedule.next_run_date = _advance_next_run_date(schedule)
        schedule.save(update_fields=['last_run_date', 'next_run_date'])

    logger.info(f'Evaluation schedules: created {created_count} walks')


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def send_evaluation_reminders(self):
    """
    Runs daily. Sends reminder emails for upcoming and overdue scheduled walks.
    """
    from apps.accounts.models import Membership

    from .models import EvaluationSchedule, Walk
    from .services import send_overdue_notification_email, send_reminder_email

    today = date.today()
    reminder_count = 0
    overdue_count = 0

    # Get all active schedules to check reminder_days_before
    schedules_by_org = {}
    for sched in EvaluationSchedule.objects.filter(is_active=True):
        schedules_by_org.setdefault(sched.organization_id, sched.reminder_days_before)

    # Upcoming reminders
    scheduled_walks = Walk.objects.filter(
        status=Walk.Status.SCHEDULED,
    ).select_related('store', 'template', 'conducted_by', 'organization')

    for walk in scheduled_walks:
        reminder_days = schedules_by_org.get(walk.organization_id, 3)
        days_until = (walk.scheduled_date - today).days

        if days_until == reminder_days:
            send_reminder_email(walk)
            reminder_count += 1

    # Overdue walks
    overdue_walks = Walk.objects.filter(
        status=Walk.Status.SCHEDULED,
        scheduled_date__lt=today,
    ).select_related('store', 'template', 'conducted_by', 'organization')

    for walk in overdue_walks:
        days_overdue = (today - walk.scheduled_date).days
        # Send overdue notification weekly (every 7 days overdue)
        if days_overdue > 0 and days_overdue % 7 == 0:
            # Find regional managers for this store
            regional_emails = []
            if walk.store.region:
                rm_memberships = Membership.objects.filter(
                    organization=walk.organization,
                    role='regional_manager',
                    region_assignments__region=walk.store.region,
                ).select_related('user')
                regional_emails = [m.user.email for m in rm_memberships]

            send_overdue_notification_email(walk, regional_emails)
            overdue_count += 1

    logger.info(f'Reminders: sent {reminder_count} reminders, {overdue_count} overdue notices')

    # === Corrective Action Escalation for Overdue Walks ===
    from .models import CorrectiveAction

    THRESHOLDS = [
        (14, 'critical'),
        (7, 'escalated'),
        (3, 'reminder'),
    ]

    for walk in Walk.objects.filter(
        status=Walk.Status.SCHEDULED,
        scheduled_date__lt=today,
    ).select_related('store', 'conducted_by', 'organization'):
        days_overdue = (today - walk.scheduled_date).days
        if days_overdue < 3:
            continue

        # Determine escalation level
        level = 'reminder'
        for threshold_days, threshold_level in THRESHOLDS:
            if days_overdue >= threshold_days:
                level = threshold_level
                break

        ca, created = CorrectiveAction.objects.update_or_create(
            walk=walk,
            action_type='overdue_evaluation',
            status='open',
            defaults={
                'organization': walk.organization,
                'store': walk.store,
                'responsible_user': walk.conducted_by,
                'escalation_level': level,
                'days_overdue': days_overdue,
            },
        )
        if not created and ca.escalation_level != level:
            ca.escalation_level = level
            ca.days_overdue = days_overdue
            ca.save(update_fields=['escalation_level', 'days_overdue'])

        # Send escalation email at threshold crossings
        if created or (not created and ca.escalation_level == level):
            from .services import send_escalation_email
            send_escalation_email(ca)

    logger.info('Corrective action escalation check complete')


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def check_unacknowledged_walks(self):
    """
    Daily task: check completed walks where the manager hasn't reviewed/acknowledged.
    Creates CorrectiveAction records with escalating severity.
    """
    from .models import CorrectiveAction, Walk
    from .services import send_escalation_email

    today = date.today()
    THRESHOLDS = [
        (14, 'critical'),
        (7, 'escalated'),
        (3, 'reminder'),
    ]

    pending_walks = Walk.objects.filter(
        status=Walk.Status.COMPLETED,
        manager_review_status='pending_review',
        completed_date__isnull=False,
    ).select_related('store', 'organization')

    for walk in pending_walks:
        days_since = (today - walk.completed_date.date()).days
        if days_since < 3:
            continue

        level = 'reminder'
        for threshold_days, threshold_level in THRESHOLDS:
            if days_since >= threshold_days:
                level = threshold_level
                break

        # Find store manager
        from apps.accounts.models import StoreAssignment
        assignment = StoreAssignment.objects.filter(
            store=walk.store,
            membership__organization=walk.organization,
            membership__role='store_manager',
        ).select_related('membership__user').first()
        responsible = assignment.membership.user if assignment else None

        ca, created = CorrectiveAction.objects.update_or_create(
            walk=walk,
            action_type='unacknowledged_walk',
            status='open',
            defaults={
                'organization': walk.organization,
                'store': walk.store,
                'responsible_user': responsible,
                'escalation_level': level,
                'days_overdue': days_since,
            },
        )
        if not created and ca.escalation_level != level:
            ca.escalation_level = level
            ca.days_overdue = days_since
            ca.save(update_fields=['escalation_level', 'days_overdue'])

        if created or (not created and ca.escalation_level == level):
            send_escalation_email(ca)

    logger.info('Unacknowledged walks check complete')


# ==================== Feature 2: Overdue Action Items ====================


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def check_overdue_action_items(self):
    """
    Weekly task: find overdue action items and send notifications.
    """
    from .models import ActionItem
    from .services import send_overdue_action_items_email

    today = date.today()
    overdue_items = ActionItem.objects.filter(
        status__in=[ActionItem.Status.OPEN, ActionItem.Status.IN_PROGRESS],
        due_date__lt=today,
    ).select_related(
        'walk__store', 'criterion', 'assigned_to', 'organization',
    )

    if not overdue_items.exists():
        logger.info('No overdue action items found.')
        return

    # Group by assigned_to user
    by_user = {}
    for item in overdue_items:
        if item.assigned_to:
            by_user.setdefault(item.assigned_to.email, []).append(item)

    for email, items in by_user.items():
        send_overdue_action_items_email(email, items)

    logger.info(f'Overdue action items: notified {len(by_user)} users')


@shared_task(bind=True)
def check_pending_review_action_items(self):
    """
    Daily task: remind reviewers about action items stuck in pending_review for 3+ days.
    """
    from .models import ActionItem
    from .services import send_pending_review_reminder

    threshold = date.today() - timedelta(days=3)
    stale_items = ActionItem.objects.filter(
        status=ActionItem.Status.PENDING_REVIEW,
        resolved_at__date__lte=threshold,
    ).select_related(
        'walk__store', 'store', 'resolved_by', 'assigned_to', 'organization',
    )

    count = 0
    for item in stale_items:
        send_pending_review_reminder(item)
        count += 1

    logger.info(f'Pending review reminders: sent {count} reminders')


# ==================== Feature 3: Self-Assessment AI Evaluation ====================


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_assessment_submissions(self, assessment_id: str):
    """
    After a self-assessment is submitted, run AI evaluation on each photo.
    Uses Gemini 2.5 Flash for vision analysis with 768px downsampling.
    """
    import io
    import re

    from django.conf import settings
    from PIL import Image

    from .models import SelfAssessment

    try:
        assessment = SelfAssessment.objects.select_related(
            'template', 'store',
        ).get(id=assessment_id)
    except SelfAssessment.DoesNotExist:
        logger.error(f'SelfAssessment {assessment_id} not found')
        return

    if not settings.GEMINI_API_KEY:
        logger.warning('GEMINI_API_KEY not configured, skipping AI evaluation')
        return

    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    submissions = assessment.submissions.select_related('prompt').all()

    for submission in submissions:
        if submission.ai_analysis:
            continue  # Already evaluated

        is_video = getattr(submission, 'is_video', False)
        media_type = 'video' if is_video else 'photo'

        prompt_text = submission.prompt.ai_evaluation_prompt or (
            f'Evaluate this {media_type} of "{submission.prompt.name}" at a retail store. '
            f'Is it in good, fair, or poor condition?'
        )

        try:
            file_bytes = submission.image.read()
            submission.image.seek(0)

            if is_video:
                # Upload video via Gemini Files API for processing
                import tempfile
                import os
                import time as time_mod

                content_type = 'video/mp4'
                ext = os.path.splitext(submission.image.name)[1] or '.mp4'
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                try:
                    uploaded_file = client.files.upload(file=tmp_path)
                    # Wait for video processing to complete
                    for _ in range(60):
                        status_check = client.files.get(name=uploaded_file.name)
                        if status_check.state.name == 'ACTIVE':
                            break
                        time_mod.sleep(2)
                    media_part = uploaded_file
                finally:
                    os.unlink(tmp_path)
            else:
                # Read and downsample image to 768px for cost efficiency
                img = Image.open(io.BytesIO(file_bytes))
                max_width = 768
                if img.width > max_width:
                    ratio = max_width / img.width
                    img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=85)
                jpeg_bytes = buf.getvalue()
                media_part = genai.types.Part.from_bytes(data=jpeg_bytes, mime_type='image/jpeg')

            video_context = (
                '\nThis is a video walkthrough. Analyze the entire video for setup, organization, '
                'display quality, signage, cleanliness, and overall condition of the area shown.'
            ) if is_video else ''

            full_prompt = f"""{prompt_text}{video_context}

Store: {assessment.store.name}
Area: {submission.prompt.name}
{f'Manager notes: {submission.caption}' if submission.caption else ''}

Respond with ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{{
  "rating": "GOOD" or "FAIR" or "POOR",
  "summary": "2-3 sentence overall assessment of what you observe. Be specific about products and conditions visible.",
  "findings": [
    "Specific observation about what you see (e.g. 'Products are well-faced and pulled forward on the top shelf')",
    "Another specific finding"
  ],
  "action_items": [
    {{"priority": "HIGH" or "MEDIUM" or "LOW", "action": "Specific corrective action needed"}},
    {{"priority": "HIGH" or "MEDIUM" or "LOW", "action": "Another action"}}
  ]
}}

Be specific about what you actually see. Reference actual products, shelf positions, and conditions visible in the {media_type}."""

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    media_part,
                    full_prompt,
                ],
            )

            raw_text = response.text.strip()

            # Parse structured JSON response
            import json
            # Strip markdown code fences if present
            cleaned = raw_text
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1].rsplit('```', 1)[0].strip()

            try:
                parsed = json.loads(cleaned)
                submission.ai_rating = parsed.get('rating', '').lower()
                if submission.ai_rating not in ('good', 'fair', 'poor'):
                    submission.ai_rating = ''
                # Store full JSON as ai_analysis for frontend rendering
                submission.ai_analysis = json.dumps(parsed)
            except json.JSONDecodeError:
                logger.warning(f'Could not parse JSON from AI for submission {submission.id}, using raw text')
                submission.ai_analysis = raw_text
                # Try to extract rating from raw text
                rating_match = re.match(r'.*?"rating"\s*:\s*"(GOOD|FAIR|POOR)"', raw_text, re.IGNORECASE | re.DOTALL)
                if rating_match:
                    submission.ai_rating = rating_match.group(1).lower()

            submission.save(update_fields=['ai_analysis', 'ai_rating'])
            logger.info(f'AI evaluation complete for submission {submission.id}')

        except Exception as e:
            logger.error(f'AI evaluation error for submission {submission.id}: {e}')

    logger.info(f'Assessment {assessment_id}: AI evaluation complete for {submissions.count()} submissions')

    # Send review notification email
    try:
        from .services import send_assessment_review_notification
        assessment.refresh_from_db()
        send_assessment_review_notification(assessment)
    except Exception as e:
        logger.error(f'Failed to send assessment review notification for {assessment_id}: {e}')


# ==================== Feature 4: SOP Document Processing ====================


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def extract_sop_text(self, sop_id: str):
    """
    Extract text content from an uploaded SOP document (PDF, DOCX, TXT).
    Stores the extracted text on the SOPDocument model for AI analysis.
    """
    from .models import SOPDocument

    try:
        sop = SOPDocument.objects.get(id=sop_id)
    except SOPDocument.DoesNotExist:
        logger.error(f'SOPDocument {sop_id} not found')
        return

    if not sop.file:
        logger.warning(f'SOPDocument {sop_id} has no file')
        return

    extracted = ''
    try:
        if sop.file_type == 'pdf':
            from PyPDF2 import PdfReader
            reader = PdfReader(sop.file)
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            extracted = '\n\n'.join(pages)

        elif sop.file_type == 'docx':
            import docx
            doc = docx.Document(sop.file)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted = '\n\n'.join(paragraphs)

        elif sop.file_type == 'txt':
            sop.file.seek(0)
            extracted = sop.file.read().decode('utf-8', errors='replace')

        else:
            logger.warning(f'Unsupported file type "{sop.file_type}" for SOP {sop_id}')
            return

    except Exception as e:
        logger.error(f'Text extraction error for SOP {sop_id}: {e}')
        self.retry(exc=e)
        return

    # Truncate to ~50k chars to stay within reasonable AI prompt limits
    if len(extracted) > 50000:
        extracted = extracted[:50000] + '\n\n[... truncated ...]'

    sop.extracted_text = extracted
    sop.save(update_fields=['extracted_text'])
    logger.info(f'Text extracted for SOP {sop_id}: {len(extracted)} chars')


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def analyze_sop_criteria_match(self, sop_id: str):
    """
    Use Claude API to analyze SOP text against all org criteria
    and create SOPCriterionLink records with AI suggestions.
    """
    import json

    import anthropic
    from django.conf import settings

    from .models import Criterion, SOPCriterionLink, SOPDocument

    try:
        sop = SOPDocument.objects.select_related('organization').get(id=sop_id)
    except SOPDocument.DoesNotExist:
        logger.error(f'SOPDocument {sop_id} not found')
        return

    if not sop.extracted_text:
        logger.warning(f'SOP {sop_id} has no extracted text')
        return

    if not settings.ANTHROPIC_API_KEY:
        logger.warning('ANTHROPIC_API_KEY not configured, skipping SOP analysis')
        return

    # Get all criteria for this org (across all active templates)
    criteria = list(
        Criterion.objects.filter(
            section__template__organization=sop.organization,
            section__template__is_active=True,
        ).select_related('section').values('id', 'name', 'description', 'section__name')
    )

    if not criteria:
        logger.info(f'No criteria found for org, skipping SOP analysis')
        return

    criteria_list = '\n'.join([
        f'- ID: {c["id"]}, Section: {c["section__name"]}, '
        f'Name: {c["name"]}, Description: {c["description"] or "N/A"}'
        for c in criteria
    ])

    # Truncate SOP text for the prompt
    sop_text = sop.extracted_text[:30000]

    prompt = f"""Analyze this SOP document and determine which evaluation criteria it relates to.

SOP Document: "{sop.title}"
{f'Description: {sop.description}' if sop.description else ''}

SOP Content:
{sop_text}

Available Evaluation Criteria:
{criteria_list}

For each criterion that this SOP document is relevant to, provide a JSON array with objects containing:
- "criterion_id": the UUID of the criterion
- "confidence": a number from 0.0 to 1.0 indicating how confident you are
- "reasoning": a brief explanation of why this SOP relates to this criterion
- "excerpt": a relevant excerpt from the SOP (max 200 chars)

Only include criteria with confidence >= 0.5. Return ONLY the JSON array, no other text.
If no criteria match, return an empty array: []"""

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model='claude-sonnet-4-5-20250929',
            max_tokens=2000,
            messages=[{'role': 'user', 'content': prompt}],
        )

        raw = message.content[0].text.strip()
        # Extract JSON from response (handle markdown code blocks)
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[1].rsplit('```', 1)[0].strip()

        matches = json.loads(raw)

        created_count = 0
        for match in matches:
            criterion_id = match.get('criterion_id')
            if not criterion_id:
                continue

            # Verify criterion exists in our list
            if not any(str(c['id']) == str(criterion_id) for c in criteria):
                continue

            SOPCriterionLink.objects.update_or_create(
                sop_document=sop,
                criterion_id=criterion_id,
                defaults={
                    'is_ai_suggested': True,
                    'ai_confidence': min(max(float(match.get('confidence', 0.5)), 0), 1),
                    'ai_reasoning': match.get('reasoning', '')[:500],
                    'relevant_excerpt': match.get('excerpt', '')[:500],
                    'is_confirmed': False,
                },
            )
            created_count += 1

        logger.info(f'SOP {sop_id}: AI created {created_count} criterion links')

    except json.JSONDecodeError as e:
        logger.error(f'JSON parse error for SOP {sop_id} AI response: {e}')
    except Exception as e:
        logger.error(f'AI SOP analysis error for {sop_id}: {e}')
        self.retry(exc=e)
