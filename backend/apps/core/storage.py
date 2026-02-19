"""
File storage utilities for org/store-scoped uploads.

Folder structure in DO Spaces:
    {org_slug}/
    ├── _org/                        # Org-level assets (logo, docs)
    ├── {store_slug}/
    │   ├── walks/{walk_id}/         # Walk evidence photos
    │   ├── docs/                    # Store documents
    │   └── photos/                  # General store photos
"""

import io
import uuid

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.utils.text import slugify
from PIL import Image, ImageOps

# Max dimension (width or height) for uploaded photos
MAX_IMAGE_DIMENSION = 1920
JPEG_QUALITY = 85


def _safe_slug(name):
    """Generate a filesystem-safe slug from a name."""
    return slugify(name) or 'unknown'


def user_avatar_path(instance, filename):
    """Upload path for user profile photos.
    Result: avatars/{user_id}/{uuid}_{filename}
    """
    unique = uuid.uuid4().hex[:8]
    return f'avatars/{instance.id}/{unique}_{filename}'


def org_file_path(instance, filename):
    """Upload path for organization-level files.
    Use on FileField/ImageField on a model with an `organization` FK.
    Result: {org_slug}/_org/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.organization.slug)
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/_org/{unique}_{filename}'


def store_photo_path(instance, filename):
    """Upload path for general store photos.
    Use on a model with a `store` FK (store must have an `organization`).
    Result: {org_slug}/{store_slug}/photos/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.store.organization.slug)
    store_slug = _safe_slug(instance.store.name)
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/{store_slug}/photos/{unique}_{filename}'


def walk_evidence_path(instance, filename):
    """Upload path for walk evidence/photos.
    Use on a model with a `walk` FK (walk must have `store` and `organization`).
    Result: {org_slug}/{store_slug}/walks/{walk_id}/{uuid}_{filename}
    """
    walk = instance.walk
    org_slug = _safe_slug(walk.organization.slug)
    store_slug = _safe_slug(walk.store.name)
    walk_id = str(walk.id)[:8]
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/{store_slug}/walks/{walk_id}/{unique}_{filename}'


def store_doc_path(instance, filename):
    """Upload path for store documents.
    Use on a model with a `store` FK.
    Result: {org_slug}/{store_slug}/docs/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.store.organization.slug)
    store_slug = _safe_slug(instance.store.name)
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/{store_slug}/docs/{unique}_{filename}'


def action_item_photo_path(instance, filename):
    """Upload path for action item follow-up photos.
    Result: {org_slug}/_action_items/{response_id}/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.organization.slug)
    response_id = str(instance.response.id)[:8]
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/_action_items/{response_id}/{unique}_{filename}'


def assessment_photo_path(instance, filename):
    """Upload path for self-assessment submission photos.
    Result: {org_slug}/{store_slug}/assessments/{assessment_id}/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.organization.slug)
    store_slug = _safe_slug(instance.assessment.store.name)
    assessment_id = str(instance.assessment.id)[:8]
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/{store_slug}/assessments/{assessment_id}/{unique}_{filename}'


def criterion_reference_image_path(instance, filename):
    """Upload path for criterion reference images.
    Result: {org_slug}/_reference_images/{criterion_id}/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.criterion.section.template.organization.slug
                          if instance.criterion.section.template
                          else instance.criterion.section.department.organization.slug)
    criterion_id = str(instance.criterion.id)[:8]
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/_reference_images/{criterion_id}/{unique}_{filename}'


def sop_document_path(instance, filename):
    """Upload path for SOP documents.
    Result: {org_slug}/_sop_documents/{uuid}_{filename}
    """
    org_slug = _safe_slug(instance.organization.slug)
    unique = uuid.uuid4().hex[:8]
    return f'{org_slug}/_sop_documents/{unique}_{filename}'


def process_uploaded_image(image_file):
    """Resize and compress an uploaded image to save storage while maintaining detail.

    - Resizes so the longest side is at most MAX_IMAGE_DIMENSION (1920px).
    - Converts to JPEG at JPEG_QUALITY (85) for a good quality/size ratio.
    - Auto-rotates based on EXIF orientation.
    - Returns a new InMemoryUploadedFile ready for saving.
    """
    img = Image.open(image_file)

    # Auto-rotate based on EXIF data (e.g., phone camera rotation)
    img = ImageOps.exif_transpose(img)

    # Convert to RGB if needed (e.g., RGBA PNGs, palette images)
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')

    # Resize if larger than max dimension
    if max(img.size) > MAX_IMAGE_DIMENSION:
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)

    # Save to buffer as JPEG
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    buffer.seek(0)

    # Build a new filename with .jpg extension
    base_name = image_file.name.rsplit('.', 1)[0] if '.' in image_file.name else image_file.name
    new_name = f'{base_name}.jpg'

    return InMemoryUploadedFile(
        file=buffer,
        field_name='image',
        name=new_name,
        content_type='image/jpeg',
        size=buffer.getbuffer().nbytes,
        charset=None,
    )
