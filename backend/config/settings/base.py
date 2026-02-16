"""
Base settings for StoreScore project.
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('DJANGO_SECRET_KEY', default='change-me-in-production')

DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='*', cast=Csv())

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
    # Local apps
    'apps.core',
    'apps.accounts',
    'apps.stores',
    'apps.walks',
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
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 25,
}

# Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
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

# Email (Resend)
RESEND_API_KEY = config('RESEND_API_KEY', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@storescore.app')

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
    AWS_DEFAULT_ACL = 'private'
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600  # signed URLs expire in 1 hour
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
