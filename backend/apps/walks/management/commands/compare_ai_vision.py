"""
Compare Claude vs Gemini image analysis on walk/assessment photos.

Usage:
  docker compose exec backend python manage.py compare_ai_vision
  docker compose exec backend python manage.py compare_ai_vision --max-width 800
  docker compose exec backend python manage.py compare_ai_vision --photo-id <uuid>
"""

import base64
import io
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image


def downsample_image(image_bytes: bytes, max_width: int = 1024) -> tuple[bytes, str]:
    """Downsample image to max_width, return (jpeg_bytes, dimensions_str)."""
    img = Image.open(io.BytesIO(image_bytes))
    orig_size = f"{img.width}x{img.height}"

    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Convert to RGB if needed (e.g. RGBA PNGs)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    new_bytes = buf.getvalue()
    new_size_str = f"{img.width}x{img.height}"
    return new_bytes, f"{orig_size} -> {new_size_str} ({len(new_bytes) // 1024}KB)"


def analyze_with_claude(image_b64: str, prompt: str) -> tuple[str, float]:
    """Send image to Claude, return (response_text, elapsed_seconds)."""
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    start = time.time()
    message = client.messages.create(
        model='claude-sonnet-4-5-20250929',
        max_tokens=400,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/jpeg',
                        'data': image_b64,
                    },
                },
                {'type': 'text', 'text': prompt},
            ],
        }],
    )
    elapsed = time.time() - start
    return message.content[0].text, elapsed


def analyze_with_gemini(image_bytes: bytes, prompt: str) -> tuple[str, float]:
    """Send image to Gemini, return (response_text, elapsed_seconds)."""
    from google import genai

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    start = time.time()

    # Upload inline as Part
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=[
            genai.types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
            prompt,
        ],
    )
    elapsed = time.time() - start
    return response.text, elapsed


class Command(BaseCommand):
    help = 'Compare Claude vs Gemini vision analysis on store photos'

    def add_arguments(self, parser):
        parser.add_argument('--photo-id', type=str, help='Specific WalkPhoto UUID')
        parser.add_argument('--max-width', type=int, default=1024,
                            help='Max image width for downsampling (default: 1024)')
        parser.add_argument('--limit', type=int, default=5,
                            help='Max photos to compare (default: 5)')

    def handle(self, *args, **options):
        from apps.walks.models import WalkPhoto

        if not settings.ANTHROPIC_API_KEY:
            self.stderr.write('ANTHROPIC_API_KEY not configured')
            return
        if not settings.GEMINI_API_KEY:
            self.stderr.write('GEMINI_API_KEY not configured')
            return

        max_width = options['max_width']

        # Get photos
        if options['photo_id']:
            photos = WalkPhoto.objects.filter(id=options['photo_id']).select_related(
                'criterion', 'walk__store')
        else:
            photos = WalkPhoto.objects.exclude(image='').select_related(
                'criterion', 'walk__store')[:options['limit']]

        if not photos:
            self.stderr.write('No walk photos found. Upload some photos first.')
            return

        self.stdout.write(f'\n{"=" * 70}')
        self.stdout.write(f'  CLAUDE vs GEMINI — Image Analysis Comparison')
        self.stdout.write(f'  Downsampling to max {max_width}px width')
        self.stdout.write(f'{"=" * 70}\n')

        for photo in photos:
            criterion_name = photo.criterion.name if photo.criterion else 'Unknown'
            store_name = photo.walk.store.name

            self.stdout.write(f'\n{"─" * 70}')
            self.stdout.write(f'  Photo: {photo.image.name}')
            self.stdout.write(f'  Store: {store_name} | Criterion: {criterion_name}')

            # Read and downsample
            try:
                raw_bytes = photo.image.read()
                photo.image.seek(0)
            except Exception as e:
                self.stderr.write(f'  Could not read image: {e}')
                continue

            jpeg_bytes, size_info = downsample_image(raw_bytes, max_width)
            image_b64 = base64.standard_b64encode(jpeg_bytes).decode('utf-8')
            self.stdout.write(f'  Downsampled: {size_info}')

            prompt = (
                f'You are evaluating a retail store photo for "{criterion_name}" '
                f'at {store_name}.\n\n'
                f'Respond in this exact format:\n'
                f'RATING: [GOOD or FAIR or POOR]\n'
                f'[2-3 sentence analysis of what you observe in the image. '
                f'Be specific about what you see.]'
            )

            # Claude
            self.stdout.write(f'\n  CLAUDE (claude-sonnet-4-5):')
            try:
                claude_text, claude_time = analyze_with_claude(image_b64, prompt)
                self.stdout.write(f'  Time: {claude_time:.1f}s')
                for line in claude_text.strip().split('\n'):
                    self.stdout.write(f'    {line}')
            except Exception as e:
                self.stdout.write(f'    ERROR: {e}')
                claude_text, claude_time = '', 0

            # Gemini
            self.stdout.write(f'\n  GEMINI (gemini-2.0-flash):')
            try:
                gemini_text, gemini_time = analyze_with_gemini(jpeg_bytes, prompt)
                self.stdout.write(f'  Time: {gemini_time:.1f}s')
                for line in gemini_text.strip().split('\n'):
                    self.stdout.write(f'    {line}')
            except Exception as e:
                self.stdout.write(f'    ERROR: {e}')
                gemini_text, gemini_time = '', 0

            # Speed comparison
            if claude_time and gemini_time:
                faster = 'Gemini' if gemini_time < claude_time else 'Claude'
                ratio = max(claude_time, gemini_time) / min(claude_time, gemini_time)
                self.stdout.write(f'\n  >>> {faster} was {ratio:.1f}x faster')

        self.stdout.write(f'\n{"=" * 70}')
        self.stdout.write(f'  Comparison complete.')
        self.stdout.write(f'{"=" * 70}\n')
