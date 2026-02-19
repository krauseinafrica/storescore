from django.core.management.base import BaseCommand

from apps.stores.models import Achievement


ACHIEVEMENTS = [
    # ----- Basic tier (Pro plan) -----
    {
        'name': 'First Walk',
        'description': 'Complete your first store walk',
        'icon_name': 'footprints',
        'tier': 'bronze',
        'criteria_type': 'walk_count',
        'criteria_value': 1,
        'plan_tier': 'basic',
    },
    {
        'name': 'Walk Warrior',
        'description': 'Complete 25 store walks',
        'icon_name': 'shield',
        'tier': 'silver',
        'criteria_type': 'walk_count',
        'criteria_value': 25,
        'plan_tier': 'basic',
    },
    {
        'name': 'Walk Legend',
        'description': 'Complete 100 store walks',
        'icon_name': 'crown',
        'tier': 'gold',
        'criteria_type': 'walk_count',
        'criteria_value': 100,
        'plan_tier': 'basic',
    },
    {
        'name': 'Perfect Score',
        'description': 'Score 100% on a store walk',
        'icon_name': 'star',
        'tier': 'gold',
        'criteria_type': 'perfect_score',
        'criteria_value': 1,
        'plan_tier': 'basic',
    },
    {
        'name': 'Rising Star',
        'description': 'Improve your average score by 15%',
        'icon_name': 'trending-up',
        'tier': 'silver',
        'criteria_type': 'improvement',
        'criteria_value': 15,
        'plan_tier': 'basic',
    },
    # ----- Advanced tier (Enterprise plan) -----
    {
        'name': 'Triple Perfect',
        'description': 'Score 100% on 3 different walks',
        'icon_name': 'stars',
        'tier': 'platinum',
        'criteria_type': 'perfect_score',
        'criteria_value': 3,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Consistency Star',
        'description': 'Score above 80% on 5 consecutive walks',
        'icon_name': 'target',
        'tier': 'silver',
        'criteria_type': 'score_streak',
        'criteria_value': 5,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Iron Streak',
        'description': 'Score above 80% on 10 consecutive walks',
        'icon_name': 'flame',
        'tier': 'gold',
        'criteria_type': 'score_streak',
        'criteria_value': 10,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Quick Fix',
        'description': 'Resolve 3 action items within 48 hours',
        'icon_name': 'zap',
        'tier': 'bronze',
        'criteria_type': 'action_speed',
        'criteria_value': 3,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Speed Demon',
        'description': 'Resolve 10 action items within 48 hours',
        'icon_name': 'bolt',
        'tier': 'silver',
        'criteria_type': 'action_speed',
        'criteria_value': 10,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Weekly Regular',
        'description': 'Complete at least 1 walk every week for 4 weeks',
        'icon_name': 'calendar',
        'tier': 'silver',
        'criteria_type': 'walk_streak',
        'criteria_value': 4,
        'plan_tier': 'advanced',
    },
    {
        'name': 'Elite 90',
        'description': 'Score above 90% on 5 different walks',
        'icon_name': 'trophy',
        'tier': 'gold',
        'criteria_type': 'score_above_90',
        'criteria_value': 5,
        'plan_tier': 'advanced',
    },
]


class Command(BaseCommand):
    help = 'Seed the platform with default achievement definitions'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        for data in ACHIEVEMENTS:
            obj, created = Achievement.objects.update_or_create(
                name=data['name'],
                defaults=data,
            )
            if created:
                created_count += 1
                self.stdout.write(f'  Created: {data["name"]} ({data["plan_tier"]})')
            else:
                updated_count += 1
                self.stdout.write(f'  Updated: {data["name"]} ({data["plan_tier"]})')

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {created_count} created, {updated_count} updated ({len(ACHIEVEMENTS)} total).'
            )
        )
