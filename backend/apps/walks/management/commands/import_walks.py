"""
Import historical walk data from TSV export (Google Forms/Sheets).

Usage:
    python manage.py import_walks /path/to/walk_data.tsv
"""

import csv
import logging
from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Membership
from apps.stores.models import Store
from apps.walks.models import Criterion, Score, ScoringTemplate, Section, Walk, WalkSectionNote

User = get_user_model()
logger = logging.getLogger(__name__)

# Column index mapping from the TSV
COL_TIMESTAMP = 0
COL_WALK_DATE = 1
COL_STORE = 2
COL_EMAIL = 42
COL_FINAL_NOTES = 34

# Criterion columns: (column_index, section_key)
# Curb Appeal criteria (cols 5-9)
# Store Cleanliness criteria (cols 11-16)
# Shelf Maintenance criteria (cols 18-23)
# Backroom/Warehouse criteria (cols 26-29)
# Safety criteria (cols 31-32)

# Section notes columns
SECTION_NOTES = {
    'curb_appeal': 10,
    'store_cleanliness': 17,
    'shelf_maintenance': 25,
    'backroom': 30,
    'safety': 33,
}

# Areas needing attention (only shelf maintenance has a separate column)
SECTION_AREAS = {
    'shelf_maintenance': 24,
}

# Store name normalization
STORE_NAME_MAP = {
    'Clifton': 'Clifton Forge',
}


def parse_date(date_str):
    """Parse date from various formats in the spreadsheet."""
    date_str = date_str.strip()
    if not date_str:
        return None
    for fmt in ('%m/%d/%Y', '%m/%d/%y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_score(value):
    """Parse a score value (1-5) from the spreadsheet."""
    value = value.strip().lstrip()
    if not value:
        return None
    try:
        score = int(value)
        if 1 <= score <= 5:
            return score
    except ValueError:
        pass
    return None


class Command(BaseCommand):
    help = 'Import historical walk data from a TSV file exported from Google Sheets'

    def add_arguments(self, parser):
        parser.add_argument('tsv_file', help='Path to the TSV file')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Parse and validate without writing to database',
        )

    def handle(self, *args, **options):
        tsv_file = options['tsv_file']
        dry_run = options['dry_run']

        # Load reference data
        org_id = 'ab07803e-bf18-404d-8462-c662fff3de29'  # Northwest
        template = ScoringTemplate.objects.get(id='dc068000-a3e8-40f3-8e5d-b299d122d5b6')

        stores = {s.name: s for s in Store.objects.filter(organization_id=org_id)}
        sections = {s.name: s for s in template.sections.all()}
        criteria_by_section = {}
        for section in sections.values():
            criteria_by_section[section.name] = {
                c.name: c for c in section.criteria.all()
            }

        # Build column-to-criterion mapping
        # Each entry: (col_index, section_name, criterion_name)
        score_columns = [
            (5, 'Curb Appeal', 'Parking Lot Cleanliness'),
            (6, 'Curb Appeal', 'Yard/Landscaping'),
            (7, 'Curb Appeal', 'Electronic Sign'),
            (8, 'Curb Appeal', 'Outdoor Merchandising'),
            (9, 'Curb Appeal', 'Safety'),
            (11, 'Store Cleanliness', 'Entry - First Look'),
            (12, 'Store Cleanliness', 'Checkout Area'),
            (13, 'Store Cleanliness', 'Helpful Hub'),
            (14, 'Store Cleanliness', 'Paint Desk/Paint Mixing Areas'),
            (15, 'Store Cleanliness', 'Floors'),
            (16, 'Store Cleanliness', 'Bathrooms'),
            (18, 'Shelf Maintenance', 'Old Pegs/Price Tags'),
            (19, 'Shelf Maintenance', 'Excessive Outs'),
            (20, 'Shelf Maintenance', 'Location/Peg Hook Maintenance'),
            (21, 'Shelf Maintenance', 'Back Stock Pulled'),
            (22, 'Shelf Maintenance', 'Base Deck Clean'),
            (23, 'Shelf Maintenance', 'Endcap Headers Displayed'),
            (26, 'Backroom/Warehouse', 'Clean and Organized'),
            (27, 'Backroom/Warehouse', 'Fire Lanes Clear'),
            (28, 'Backroom/Warehouse', 'Order Rec/Stocked 24hrs'),
            (29, 'Backroom/Warehouse', 'Cardboard/Trash Removed'),
            (31, 'Safety', 'Aisles Clear of Totes/Ladders'),
            (32, 'Safety', 'No Safety Violations'),
        ]

        # Section notes mapping: (col_index, section_name)
        section_notes_columns = [
            (10, 'Curb Appeal'),
            (17, 'Store Cleanliness'),
            (25, 'Shelf Maintenance'),
            (30, 'Backroom/Warehouse'),
            (33, 'Safety'),
        ]

        # Areas needing attention: (col_index, section_name)
        areas_columns = [
            (24, 'Shelf Maintenance'),
        ]

        # Resolve criteria objects
        score_map = []
        for col_idx, section_name, criterion_name in score_columns:
            criterion = criteria_by_section[section_name][criterion_name]
            score_map.append((col_idx, criterion))

        # Email-to-user cache
        user_cache = {}
        default_user = User.objects.get(email='admin@storescore.app')

        # Parse TSV
        with open(tsv_file, 'r') as f:
            reader = csv.reader(f, delimiter='\t')
            header = next(reader)
            rows = list(reader)

        self.stdout.write(f'Found {len(rows)} rows in TSV (including empty)')

        # Filter rows with actual data
        valid_rows = []
        skipped = 0
        for i, row in enumerate(rows, start=2):
            if len(row) < 33:
                continue
            store_name = row[COL_STORE].strip()
            if not store_name:
                continue
            walk_date = parse_date(row[COL_WALK_DATE])
            if not walk_date:
                self.stdout.write(self.style.WARNING(
                    f'  Row {i}: Could not parse date "{row[COL_WALK_DATE]}" for {store_name}, skipping'
                ))
                skipped += 1
                continue

            # Normalize store name
            store_name = STORE_NAME_MAP.get(store_name, store_name)
            if store_name not in stores:
                self.stdout.write(self.style.WARNING(
                    f'  Row {i}: Unknown store "{store_name}", skipping'
                ))
                skipped += 1
                continue

            valid_rows.append((i, row, store_name, walk_date))

        self.stdout.write(f'Valid rows: {len(valid_rows)}, skipped: {skipped}')

        if dry_run:
            self.stdout.write(self.style.SUCCESS('Dry run complete. No data written.'))
            for i, row, store_name, walk_date in valid_rows[:5]:
                self.stdout.write(f'  Sample: {walk_date} - {store_name}')
            return

        # Import
        created_walks = 0
        created_scores = 0
        created_notes = 0
        created_users = 0

        with transaction.atomic():
            for row_num, row, store_name, walk_date in valid_rows:
                store = stores[store_name]

                # Resolve evaluator
                email = row[COL_EMAIL].strip().lower() if len(row) > COL_EMAIL else ''
                # Fix common typos
                email = email.replace('nwacs.regional@gmail.com', 'nwace.regional@gmail.com')
                email = email.replace('nwace.regiona@gmail.com', 'nwace.regional@gmail.com')

                if email and email not in user_cache:
                    user, created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            'first_name': email.split('@')[0],
                            'last_name': '',
                        },
                    )
                    if created:
                        user.set_unusable_password()
                        user.save()
                        # Add to org
                        Membership.objects.get_or_create(
                            user=user,
                            organization_id=org_id,
                            defaults={'role': 'member'},
                        )
                        created_users += 1
                        self.stdout.write(f'  Created user: {email}')
                    user_cache[email] = user
                elif email:
                    pass  # already cached

                evaluator = user_cache.get(email, default_user)

                # Parse timestamp for started_at/completed_date
                timestamp_str = row[COL_TIMESTAMP].strip()
                completed_at = None
                if timestamp_str:
                    for fmt in ('%m/%d/%Y %H:%M:%S', '%m/%d/%y %H:%M:%S'):
                        try:
                            completed_at = timezone.make_aware(
                                datetime.strptime(timestamp_str, fmt)
                            )
                            break
                        except ValueError:
                            continue

                # Create walk
                walk = Walk.objects.create(
                    store=store,
                    template=template,
                    conducted_by=evaluator,
                    organization_id=org_id,
                    scheduled_date=walk_date,
                    started_at=completed_at,
                    completed_date=completed_at,
                    status='completed',
                    notes=row[COL_FINAL_NOTES].strip() if len(row) > COL_FINAL_NOTES else '',
                )
                created_walks += 1

                # Create scores
                total_earned = 0
                total_max = 0
                for col_idx, criterion in score_map:
                    value = row[col_idx] if len(row) > col_idx else ''
                    points = parse_score(value)
                    if points is not None:
                        Score.objects.create(
                            walk=walk,
                            criterion=criterion,
                            points=points,
                        )
                        created_scores += 1
                        total_earned += points
                        total_max += criterion.max_points

                # Calculate total score
                if total_max > 0:
                    walk.total_score = Decimal(str(round(total_earned / total_max * 100, 2)))
                    walk.save(update_fields=['total_score'])

                # Create section notes
                for col_idx, section_name in section_notes_columns:
                    notes_text = row[col_idx].strip() if len(row) > col_idx else ''
                    areas_text = ''
                    for area_col, area_section in areas_columns:
                        if area_section == section_name and len(row) > area_col:
                            areas_text = row[area_col].strip()

                    if notes_text or areas_text:
                        WalkSectionNote.objects.create(
                            walk=walk,
                            section=sections[section_name],
                            notes=notes_text,
                            areas_needing_attention=areas_text,
                        )
                        created_notes += 1

                if row_num % 20 == 0:
                    self.stdout.write(f'  Processed row {row_num}...')

        self.stdout.write(self.style.SUCCESS(
            f'\nImport complete:\n'
            f'  Walks created: {created_walks}\n'
            f'  Scores created: {created_scores}\n'
            f'  Section notes created: {created_notes}\n'
            f'  Users created: {created_users}'
        ))
