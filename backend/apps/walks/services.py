"""
Walk summary generation (Claude API) and email notification (Resend).
"""

import logging

import anthropic
import resend
from django.conf import settings

from .models import Walk, WalkSectionNote

logger = logging.getLogger(__name__)


def generate_walk_summary(walk: Walk) -> str:
    """
    Use Claude API to generate a narrative summary of a completed walk.
    Returns the summary text, or a fallback if the API is unavailable.
    """
    if not settings.ANTHROPIC_API_KEY:
        return _build_fallback_summary(walk)

    walk_data = _build_walk_data(walk)
    prompt = _build_summary_prompt(walk_data)

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model='claude-sonnet-4-5-20250929',
            max_tokens=1500,
            messages=[{'role': 'user', 'content': prompt}],
        )
        return message.content[0].text
    except Exception as e:
        logger.error(f'Claude API error for walk {walk.id}: {e}')
        return _build_fallback_summary(walk)


def send_walk_email(
    walk: Walk,
    summary: str,
    recipient_emails: list[str],
) -> bool:
    """
    Send the walk summary email to the specified recipients via Resend.
    Returns True if sent successfully.
    """
    if not settings.RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping email')
        return False

    if not recipient_emails:
        logger.warning(f'No recipients for walk {walk.id}, skipping email')
        return False

    resend.api_key = settings.RESEND_API_KEY

    store_name = walk.store.name
    walk_date = walk.scheduled_date.strftime('%B %d, %Y')
    score_display = f'{walk.total_score:.1f}%' if walk.total_score else 'N/A'
    conducted_by = walk.conducted_by.full_name

    subject = f'Store Walk Results: {store_name} - {walk_date} ({score_display})'

    html_body = _build_email_html(
        walk=walk,
        summary=summary,
        store_name=store_name,
        walk_date=walk_date,
        score_display=score_display,
        conducted_by=conducted_by,
    )

    # Reply-to is the evaluator who conducted the walk
    evaluator_email = walk.conducted_by.email

    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': recipient_emails,
            'reply_to': evaluator_email,
            'subject': subject,
            'html': html_body,
        })
        logger.info(f'Walk summary email sent for walk {walk.id} to {recipient_emails}')
        return True
    except Exception as e:
        logger.error(f'Resend email error for walk {walk.id}: {e}')
        return False


def _build_walk_data(walk: Walk) -> dict:
    """Gather all walk data into a structured dict for the AI prompt."""
    scores = walk.scores.select_related('criterion__section').all()
    section_notes = {
        sn.section_id: sn
        for sn in WalkSectionNote.objects.filter(walk=walk)
    }

    sections = walk.template.sections.prefetch_related('criteria').order_by('order')
    sections_data = []

    for section in sections:
        criteria_data = []
        section_earned = 0
        section_max = 0

        for criterion in section.criteria.order_by('order'):
            score = next(
                (s for s in scores if s.criterion_id == criterion.id), None
            )
            points = score.points if score else None
            notes = score.notes if score and score.notes else ''
            criteria_data.append({
                'name': criterion.name,
                'points': points,
                'max_points': criterion.max_points,
                'notes': notes,
            })
            if points is not None:
                section_earned += points
                section_max += criterion.max_points

        sn = section_notes.get(section.id)
        sections_data.append({
            'name': section.name,
            'weight': float(section.weight),
            'criteria': criteria_data,
            'earned': section_earned,
            'max': section_max,
            'percentage': round((section_earned / section_max * 100), 1) if section_max > 0 else None,
            'notes': sn.notes if sn else '',
            'areas_needing_attention': sn.areas_needing_attention if sn else '',
        })

    return {
        'store': walk.store.name,
        'date': str(walk.scheduled_date),
        'conducted_by': walk.conducted_by.full_name,
        'total_score': float(walk.total_score) if walk.total_score else None,
        'sections': sections_data,
        'walk_notes': walk.notes,
    }


def _build_summary_prompt(walk_data: dict) -> str:
    """Build the prompt for Claude to generate a walk summary."""
    sections_text = ''
    for section in walk_data['sections']:
        if not section['criteria']:
            continue
        sections_text += f"\n### {section['name']} ({section['percentage']}%)\n"
        for c in section['criteria']:
            score_str = f"{c['points']}/{c['max_points']}" if c['points'] is not None else 'Not scored'
            sections_text += f"  - {c['name']}: {score_str}"
            if c['notes']:
                sections_text += f" — {c['notes']}"
            sections_text += '\n'
        if section['notes']:
            sections_text += f"  Notes: {section['notes']}\n"
        if section['areas_needing_attention']:
            sections_text += f"  Areas needing attention: {section['areas_needing_attention']}\n"

    return f"""You are writing a professional store walk summary email for an Ace Hardware franchise.
Write a concise, actionable summary of this store walk evaluation. Use a professional but friendly tone.

Structure your response as:
1. **Overall Assessment** — 2-3 sentences on the store's overall performance
2. **Strengths** — bullet points of what scored well (4-5 out of 5)
3. **Areas for Improvement** — bullet points of what scored low (1-3 out of 5) with specific action items
4. **Priority Actions** — top 2-3 things to address before the next walk

Store: {walk_data['store']}
Date: {walk_data['date']}
Evaluated by: {walk_data['conducted_by']}
Overall Score: {walk_data['total_score']}%

{sections_text}

{f"Additional notes: {walk_data['walk_notes']}" if walk_data['walk_notes'] else ''}

Keep the summary under 400 words. Do not use markdown headers — use bold text for section labels instead. Write in plain language that a store manager can immediately act on."""


def _build_fallback_summary(walk: Walk) -> str:
    """Generate a simple summary without AI when the API key is not configured."""
    scores = walk.scores.select_related('criterion__section').all()
    sections = walk.template.sections.prefetch_related('criteria').order_by('order')

    lines = []
    for section in sections:
        criteria = section.criteria.order_by('order')
        if not criteria:
            continue
        earned = sum(s.points for s in scores if s.criterion.section_id == section.id)
        max_pts = sum(c.max_points for c in criteria)
        pct = round(earned / max_pts * 100, 1) if max_pts > 0 else 0
        lines.append(f'{section.name}: {earned}/{max_pts} ({pct}%)')

        for criterion in criteria:
            score = next((s for s in scores if s.criterion_id == criterion.id), None)
            if score and score.points <= 2:
                lines.append(f'  ⚠ {criterion.name}: {score.points}/{criterion.max_points}')

    return '\n'.join(lines)


def _build_email_html(
    walk: Walk,
    summary: str,
    store_name: str,
    walk_date: str,
    score_display: str,
    conducted_by: str,
) -> str:
    """Build the HTML email body."""
    # Get section scores for the breakdown table
    scores = walk.scores.select_related('criterion__section').all()
    sections = walk.template.sections.prefetch_related('criteria').order_by('order')

    section_rows = ''
    for section in sections:
        criteria = section.criteria.order_by('order')
        if not criteria:
            continue
        earned = sum(s.points for s in scores if s.criterion.section_id == section.id)
        max_pts = sum(c.max_points for c in criteria)
        pct = round(earned / max_pts * 100, 1) if max_pts > 0 else 0

        # Color based on score
        if pct >= 80:
            color = '#16a34a'  # green
        elif pct >= 60:
            color = '#d97706'  # amber
        else:
            color = '#dc2626'  # red

        section_rows += f'''
        <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{section.name}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: center;">{earned}/{max_pts}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: center; color: {color}; font-weight: 600;">{pct}%</td>
        </tr>'''

    # Convert summary newlines to <br> and bold text
    summary_html = summary.replace('\n', '<br>')

    # Score color
    total = walk.total_score
    if total and total >= 80:
        score_color = '#16a34a'
    elif total and total >= 60:
        score_color = '#d97706'
    else:
        score_color = '#dc2626'

    return f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background-color: #D40029; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Store Walk Results</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{store_name} — {walk_date}</p>
    </div>

    <!-- Score banner -->
    <div style="background-color: white; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Overall Score</p>
        <p style="margin: 0; font-size: 48px; font-weight: 800; color: {score_color};">{score_display}</p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #9ca3af;">Evaluated by {conducted_by}</p>
    </div>

    <!-- Section breakdown -->
    <div style="background-color: white; padding: 0;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f9fafb;">
                <th style="padding: 10px 16px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Section</th>
                <th style="padding: 10px 16px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Score</th>
                <th style="padding: 10px 16px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">%</th>
            </tr>
            {section_rows}
        </table>
    </div>

    <!-- AI Summary -->
    <div style="background-color: white; padding: 24px; border-top: 2px solid #D40029;">
        <h2 style="margin: 0 0 16px; font-size: 16px; color: #111827;">Walk Summary</h2>
        <div style="font-size: 14px; color: #374151; line-height: 1.6;">
            {summary_html}
        </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background-color: white;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            StoreScore by Ace Hardware — Store Quality Management
        </p>
    </div>

</div>
</body>
</html>'''
