"""
Seed the onboarding course with lessons linked to existing KB sections.

Usage:
    python manage.py seed_onboarding
    python manage.py seed_onboarding --clear  # Delete existing lessons first
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.kb.models import KnowledgeSection, OnboardingLesson

logger = logging.getLogger(__name__)


LESSONS = [
    {
        'order': 1,
        'title': 'Welcome to StoreScore',
        'summary': 'Get oriented with the dashboard and key platform concepts.',
        'section_anchor': 'dashboard-overview',
        'app_route': '/dashboard',
        'action_label': 'Explore your dashboard',
        'roles': '',
        'feature_tier': 'starter',
    },
    {
        'order': 2,
        'title': 'Navigating the Platform',
        'summary': 'Learn how the sidebar, pages, and role-based navigation work.',
        'section_anchor': 'platform-navigation',
        'app_route': '/dashboard',
        'action_label': '',
        'roles': '',
        'feature_tier': 'starter',
    },
    {
        'order': 3,
        'title': 'Understanding Roles & Permissions',
        'summary': 'See how roles control access across the platform.',
        'section_anchor': 'team-roles',
        'app_route': '/team',
        'action_label': 'View your team',
        'roles': '',
        'feature_tier': 'starter',
    },
    {
        'order': 4,
        'title': 'Understanding Plans & Features',
        'summary': 'Compare Starter, Pro, and Enterprise features.',
        'section_anchor': 'tier-comparison',
        'app_route': '/billing',
        'action_label': 'View your plan',
        'roles': 'owner,admin,finance',
        'feature_tier': 'starter',
    },
    {
        'order': 5,
        'title': 'Add Your First Store',
        'summary': 'Create a store location to start evaluating.',
        'section_anchor': 'stores-overview',
        'app_route': '/stores',
        'action_label': 'Add a store',
        'roles': 'owner,admin',
        'feature_tier': 'starter',
    },
    {
        'order': 6,
        'title': 'Organize with Regions',
        'summary': 'Group stores by geography or business unit.',
        'section_anchor': 'stores-regions',
        'app_route': '/stores?manage-regions',
        'action_label': 'Manage Regions',
        'roles': 'owner,admin,regional_manager',
        'feature_tier': 'starter',
    },
    {
        'order': 7,
        'title': 'Create a Scoring Template',
        'summary': 'Build your first evaluation checklist with sections and criteria.',
        'section_anchor': 'templates-overview',
        'app_route': '/settings',
        'action_label': 'Create a template',
        'roles': 'owner,admin',
        'feature_tier': 'starter',
    },
    {
        'order': 8,
        'title': 'Configure Scoring Drivers',
        'summary': 'Set up root cause categories for low-scoring criteria.',
        'section_anchor': 'drivers-overview',
        'app_route': '/settings',
        'action_label': 'Set up drivers',
        'roles': 'owner,admin',
        'feature_tier': 'starter',
    },
    {
        'order': 9,
        'title': 'Conduct Your First Walk',
        'summary': 'Start an in-store evaluation from beginning to end.',
        'section_anchor': 'walks-overview',
        'app_route': '/walks/new',
        'action_label': 'Start a walk',
        'roles': 'owner,admin,regional_manager,evaluator',
        'feature_tier': 'starter',
    },
    {
        'order': 10,
        'title': 'Scoring During a Walk',
        'summary': 'Learn how to score criteria, add notes, and select drivers.',
        'section_anchor': 'walks-scoring',
        'app_route': '',
        'action_label': '',
        'roles': 'owner,admin,regional_manager,evaluator',
        'feature_tier': 'starter',
    },
    {
        'order': 11,
        'title': 'Adding Photos to Walks',
        'summary': 'Attach photo evidence to criteria during evaluations.',
        'section_anchor': 'walks-photos',
        'app_route': '',
        'action_label': '',
        'roles': 'owner,admin,regional_manager,evaluator',
        'feature_tier': 'starter',
    },
    {
        'order': 12,
        'title': 'Reviewing Walk Results',
        'summary': 'View scores, AI summaries, and section breakdowns after a walk.',
        'section_anchor': 'walk-results',
        'app_route': '/walks',
        'action_label': 'View recent walks',
        'roles': 'owner,admin,regional_manager,store_manager',
        'feature_tier': 'starter',
    },
    {
        'order': 13,
        'title': 'Setting Performance Goals',
        'summary': 'Define score and frequency targets for your organization.',
        'section_anchor': 'settings-goals',
        'app_route': '/settings',
        'action_label': 'Set a goal',
        'roles': 'owner,admin',
        'feature_tier': 'starter',
    },
    {
        'order': 14,
        'title': 'Using Reports & Analytics',
        'summary': 'Explore score trends, store comparisons, and driver analysis.',
        'section_anchor': 'reports-overview',
        'app_route': '/reports',
        'action_label': 'View reports',
        'roles': 'owner,admin,regional_manager,finance',
        'feature_tier': 'starter',
    },
    {
        'order': 15,
        'title': 'Managing Action Items',
        'summary': 'Track follow-up tasks from walk findings with assignments and due dates.',
        'section_anchor': 'action-items-overview',
        'app_route': '/action-items',
        'action_label': 'View action items',
        'roles': 'owner,admin,regional_manager,store_manager',
        'feature_tier': 'pro',
    },
    {
        'order': 16,
        'title': 'Setting Up Schedules',
        'summary': 'Automate recurring walk schedules for stores or regions.',
        'section_anchor': 'schedules-overview',
        'app_route': '/schedules',
        'action_label': 'Create a schedule',
        'roles': 'owner,admin',
        'feature_tier': 'pro',
    },
    {
        'order': 17,
        'title': 'Uploading SOP Documents',
        'summary': 'Upload standard operating procedures and link them to criteria.',
        'section_anchor': 'sop-documents-overview',
        'app_route': '/sop-documents',
        'action_label': 'Upload an SOP',
        'roles': 'owner,admin',
        'feature_tier': 'pro',
    },
    {
        'order': 18,
        'title': 'Self-Assessments',
        'summary': 'Photo-based self-checks submitted by store managers between walks.',
        'section_anchor': 'self-assessments-overview',
        'app_route': '/self-assessments',
        'action_label': 'View assessments',
        'roles': 'owner,admin,store_manager',
        'feature_tier': 'starter',
    },
]


class Command(BaseCommand):
    help = 'Seed onboarding lessons linked to existing KB sections.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing onboarding lessons before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            count = OnboardingLesson.objects.count()
            OnboardingLesson.objects.all().delete()
            self.stdout.write(f'Deleted {count} existing onboarding lesson(s).')

        # Build a lookup of section anchors
        section_map = {
            s.anchor: s
            for s in KnowledgeSection.objects.all()
        }

        created = 0
        updated = 0

        for lesson_data in LESSONS:
            anchor = lesson_data.pop('section_anchor')
            section = section_map.get(anchor)

            if not section:
                self.stdout.write(self.style.WARNING(
                    f'  Section anchor "{anchor}" not found — lesson "{lesson_data["title"]}" will have no linked section.'
                ))

            obj, was_created = OnboardingLesson.objects.update_or_create(
                order=lesson_data['order'],
                defaults={
                    'section': section,
                    **lesson_data,
                },
            )

            if was_created:
                created += 1
            else:
                updated += 1

            # Restore key for safety
            lesson_data['section_anchor'] = anchor

        self.stdout.write(self.style.SUCCESS(
            f'Done! Created {created}, updated {updated} onboarding lessons.'
        ))
