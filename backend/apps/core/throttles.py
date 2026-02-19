"""
Custom rate throttle classes for sensitive endpoints.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Strict rate limit for login attempts."""
    scope = 'login'


class PasswordResetRateThrottle(AnonRateThrottle):
    """Strict rate limit for password reset requests."""
    scope = 'password_reset'


class SignupRateThrottle(AnonRateThrottle):
    """Rate limit for account creation."""
    scope = 'signup'


class LeadCaptureRateThrottle(AnonRateThrottle):
    """Rate limit for public lead capture endpoints."""
    scope = 'lead_capture'
