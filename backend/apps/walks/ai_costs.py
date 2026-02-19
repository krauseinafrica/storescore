"""
AI usage cost tracking utilities.

Provides helpers to log token usage and estimated cost after each AI API call.
Pricing constants are at the top for easy updates.
"""

import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

# ---------- Pricing (USD per 1M tokens) ----------

ANTHROPIC_PRICING = {
    # model_name_prefix: (input_per_million, output_per_million)
    'claude-sonnet-4-5': (Decimal('3.00'), Decimal('15.00')),
    'claude-sonnet-4': (Decimal('3.00'), Decimal('15.00')),
    'claude-haiku': (Decimal('0.80'), Decimal('4.00')),
}

GOOGLE_PRICING = {
    'gemini-2.5-flash': (Decimal('0.15'), Decimal('0.60')),
    'gemini-2.0-flash': (Decimal('0.10'), Decimal('0.40')),
}

MILLION = Decimal('1000000')


def _get_anthropic_pricing(model_name: str):
    """Look up pricing by matching model name prefix."""
    for prefix, pricing in ANTHROPIC_PRICING.items():
        if model_name.startswith(prefix):
            return pricing
    # Fallback to Sonnet pricing
    return ANTHROPIC_PRICING['claude-sonnet-4-5']


def _get_google_pricing(model_name: str):
    """Look up pricing by matching model name prefix."""
    for prefix, pricing in GOOGLE_PRICING.items():
        if model_name.startswith(prefix):
            return pricing
    return GOOGLE_PRICING['gemini-2.5-flash']


def log_anthropic_usage(message, call_type, organization=None, user=None):
    """
    Log token usage from an Anthropic API response.

    Args:
        message: The response from client.messages.create()
        call_type: e.g. 'walk_summary', 'photo_score', 'action_verify', 'sop_link'
        organization: Optional Organization instance
        user: Optional User instance
    """
    from .models import AIUsageLog

    try:
        model_name = message.model or ''
        input_tokens = message.usage.input_tokens or 0
        output_tokens = message.usage.output_tokens or 0

        input_price, output_price = _get_anthropic_pricing(model_name)
        cost = (
            Decimal(input_tokens) * input_price / MILLION
            + Decimal(output_tokens) * output_price / MILLION
        )

        AIUsageLog.objects.create(
            organization=organization,
            user=user,
            provider='anthropic',
            model_name=model_name,
            call_type=call_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=cost,
        )
    except Exception as e:
        logger.warning(f'Failed to log Anthropic usage for {call_type}: {e}')


def log_gemini_usage(response, call_type, organization=None, user=None):
    """
    Log token usage from a Google Gemini API response.

    Args:
        response: The response from client.models.generate_content()
        call_type: e.g. 'assessment'
        organization: Optional Organization instance
        user: Optional User instance
    """
    from .models import AIUsageLog

    try:
        metadata = response.usage_metadata
        input_tokens = metadata.prompt_token_count or 0
        output_tokens = metadata.candidates_token_count or 0
        model_name = getattr(response, 'model', '') or 'gemini-2.5-flash'

        input_price, output_price = _get_google_pricing(model_name)
        cost = (
            Decimal(input_tokens) * input_price / MILLION
            + Decimal(output_tokens) * output_price / MILLION
        )

        AIUsageLog.objects.create(
            organization=organization,
            user=user,
            provider='google',
            model_name=model_name,
            call_type=call_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=cost,
        )
    except Exception as e:
        logger.warning(f'Failed to log Gemini usage for {call_type}: {e}')
