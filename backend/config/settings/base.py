"""
Base settings for StoreScore project.
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

import sentry_sdk

_sentry_dsn = config('SENTRY_DSN', default='')
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        send_default_pii=False,
        enable_logs=True,
        traces_sample_rate=config('SENTRY_TRACES_RATE', default=0.1, cast=float),
        profile_session_sample_rate=config('SENTRY_PROFILE_RATE', default=0.1, cast=float),
        profile_lifecycle="trace",
    )

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('DJANGO_SECRET_KEY', default='change-me-in-dev-only')

DEBUG = config('DJANGO_DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    'django_celery_beat',
    'storages',
    'rest_framework_simplejwt.token_blacklist',
    # Local apps
    'apps.core',
    'apps.accounts',
    'apps.stores',
    'apps.walks',
    'apps.billing',
    'apps.kb',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.OrgMiddleware',
    'apps.billing.middleware.SubscriptionMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB', default='storescore'),
        'USER': config('POSTGRES_USER', default='storescore'),
        'PASSWORD': config('POSTGRES_PASSWORD', default=''),
        'HOST': config('POSTGRES_HOST', default='db'),
        'PORT': config('POSTGRES_PORT', default='5432'),
    }
}

# Auth
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# File upload limits (support video uploads up to 100 MB)
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB in memory before disk
DATA_UPLOAD_MAX_MEMORY_SIZE = 105 * 1024 * 1024  # 105 MB total

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '120/minute',
        'login': '5/minute',
        'password_reset': '3/minute',
        'signup': '5/minute',
        'lead_capture': '10/minute',
    },
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 25,
}

# Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Celery
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_BEAT_SCHEDULE = {
    'send-scheduled-digest-reports': {
        'task': 'apps.walks.tasks.send_scheduled_digest_reports',
        'schedule': 60 * 60 * 6,  # Run every 6 hours
    },
    'check-evaluation-schedules': {
        'task': 'apps.walks.tasks.check_evaluation_schedules',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'send-evaluation-reminders': {
        'task': 'apps.walks.tasks.send_evaluation_reminders',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'check-overdue-action-items': {
        'task': 'apps.walks.tasks.check_overdue_action_items',
        'schedule': 60 * 60 * 24 * 7,  # Run weekly
    },
    'check-trial-expirations': {
        'task': 'apps.billing.tasks.check_trial_expirations',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'sync-store-counts': {
        'task': 'apps.billing.tasks.sync_store_counts',
        'schedule': 60 * 60 * 6,  # Run every 6 hours
    },
    'process-drip-emails': {
        'task': 'apps.accounts.tasks.process_drip_emails',
        'schedule': 60 * 60,  # Run every hour
    },
    'cleanup-expired-demos': {
        'task': 'apps.accounts.tasks.cleanup_expired_demos',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'check-trial-engagement': {
        'task': 'apps.accounts.tasks.check_trial_engagement',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'check-trial-expired': {
        'task': 'apps.billing.tasks.check_trial_expired',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'send-onboarding-reminders': {
        'task': 'apps.accounts.tasks.send_onboarding_reminder_emails',
        'schedule': 60 * 60 * 24,  # Run daily
    },
    'check-pending-review-action-items': {
        'task': 'apps.walks.tasks.check_pending_review_action_items',
        'schedule': 60 * 60 * 24,  # Run daily
    },
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    'DJANGO_CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:5173',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# Claude API (Anthropic)
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')

# Gemini API (Google)
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')

# Stripe
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')

# Sentry integration
SENTRY_WEBHOOK_SECRET = config('SENTRY_WEBHOOK_SECRET', default='')
SENTRY_AUTH_TOKEN = config('SENTRY_AUTH_TOKEN', default='')
SENTRY_ORG_SLUG = config('SENTRY_ORG_SLUG', default='storescore')

# Email (Resend)
RESEND_API_KEY = config('RESEND_API_KEY', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@storescore.app')
LEAD_NOTIFICATION_EMAIL = config('LEAD_NOTIFICATION_EMAIL', default='')  # Falls back to DEFAULT_FROM_EMAIL if empty

# DigitalOcean Spaces (S3-compatible object storage)
DO_SPACES_ACCESS_KEY = config('DO_SPACES_ACCESS_KEY', default='')
DO_SPACES_SECRET_KEY = config('DO_SPACES_SECRET_KEY', default='')
DO_SPACES_BUCKET_NAME = config('DO_SPACES_BUCKET_NAME', default='images-media')
DO_SPACES_REGION = config('DO_SPACES_REGION', default='nyc3')
DO_SPACES_ENDPOINT_URL = f'https://{DO_SPACES_REGION}.digitaloceanspaces.com'
DO_SPACES_CDN_DOMAIN = config('DO_SPACES_CDN_DOMAIN', default='')
DO_SPACES_LOCATION = config('DO_SPACES_LOCATION', default='storescore')

# Only configure S3 storage if credentials are provided
if DO_SPACES_ACCESS_KEY:
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }

    AWS_ACCESS_KEY_ID = DO_SPACES_ACCESS_KEY
    AWS_SECRET_ACCESS_KEY = DO_SPACES_SECRET_KEY
    AWS_STORAGE_BUCKET_NAME = DO_SPACES_BUCKET_NAME
    AWS_S3_ENDPOINT_URL = DO_SPACES_ENDPOINT_URL
    AWS_S3_REGION_NAME = DO_SPACES_REGION
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'public-read'
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False
    AWS_LOCATION = DO_SPACES_LOCATION  # prefix all files under storescore/

    # Use CDN domain if configured, otherwise direct Spaces URL
    if DO_SPACES_CDN_DOMAIN:
        AWS_S3_CUSTOM_DOMAIN = DO_SPACES_CDN_DOMAIN
    else:
        AWS_S3_CUSTOM_DOMAIN = f'{DO_SPACES_BUCKET_NAME}.{DO_SPACES_REGION}.digitaloceanspaces.com'

    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{DO_SPACES_LOCATION}/'
else:
    # Fallback to local file storage for development
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'
