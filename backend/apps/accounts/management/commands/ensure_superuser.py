from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from decouple import config


class Command(BaseCommand):
    help = 'Creates a superuser from environment variables if one does not already exist.'

    def handle(self, *args, **options):
        User = get_user_model()
        email = config('DJANGO_SUPERUSER_EMAIL', default='admin@storescore.app')
        password = config('DJANGO_SUPERUSER_PASSWORD', default='changeme123!')

        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                email=email,
                password=password,
                first_name='Admin',
                last_name='User',
            )
            self.stdout.write(self.style.SUCCESS(f'Superuser {email} created'))
        else:
            self.stdout.write(self.style.WARNING(f'Superuser {email} already exists'))
