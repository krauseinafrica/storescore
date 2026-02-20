"""
Production settings for StoreScore project.
"""

from .base import *  # noqa: F401, F403

DEBUG = False

# Security settings for running behind Cloudflare / reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HSTS — enforce HTTPS for 1 year
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Rate limiting: tell DRF how many proxies sit in front of the app
# Traffic path: Client → Cloudflare → host nginx → gunicorn (2 proxies)
# This makes AnonRateThrottle read the real client IP from X-Forwarded-For
NUM_PROXIES = 2
