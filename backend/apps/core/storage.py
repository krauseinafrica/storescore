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

import uuid
from django.utils.text import slugify


def _safe_slug(name):
    """Generate a filesystem-safe slug from a name."""
    return slugify(name) or 'unknown'


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
