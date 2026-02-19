"""
Deep comparison of Claude vs Gemini models on a single store photo
with a production-quality retail evaluation prompt.

Usage:
  docker compose exec backend python manage.py deep_compare_vision
  docker compose exec backend python manage.py deep_compare_vision --photo-id <uuid>
  docker compose exec backend python manage.py deep_compare_vision --max-width 1024
"""

import base64
import io
import json
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image


EVAL_PROMPT = """You are a retail store quality evaluator analyzing a photo of store conditions.

**Store area being evaluated:** {area_name}

**Evaluate this photo on the following criteria:**
1. Product alignment and facing (are items pulled forward, labels facing out?)
2. Shelf fullness (are there visible gaps, empty spots, or overstocked areas?)
3. Organization (are products grouped logically, not mixed randomly?)
4. Cleanliness (are shelves free of debris, damaged packaging, spills?)
5. Safety (are items stacked safely, nothing falling or blocking the aisle?)

**Respond in this exact JSON format:**
{{
  "overall_rating": "GOOD" or "FAIR" or "POOR",
  "score": <number 1-10>,
  "summary": "<2-3 sentence overall assessment>",
  "criteria_scores": {{
    "product_alignment": {{ "score": <1-10>, "observation": "<specific detail>" }},
    "shelf_fullness": {{ "score": <1-10>, "observation": "<specific detail>" }},
    "organization": {{ "score": <1-10>, "observation": "<specific detail>" }},
    "cleanliness": {{ "score": <1-10>, "observation": "<specific detail>" }},
    "safety": {{ "score": <1-10>, "observation": "<specific detail>" }}
  }},
  "action_items": [
    {{ "priority": "HIGH" or "MEDIUM" or "LOW", "action": "<specific corrective action>" }}
  ]
}}

Be specific about what you actually see in the image. Reference actual products, shelf positions, and conditions visible in the photo. Do not make up details you cannot see."""


def downsample_image(image_bytes: bytes, max_width: int = 768) -> tuple[bytes, dict]:
    """Downsample image, return (jpeg_bytes, info_dict)."""
    img = Image.open(io.BytesIO(image_bytes))
    orig_w, orig_h = img.width, img.height
    orig_size_kb = len(image_bytes) // 1024

    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    new_bytes = buf.getvalue()

    return new_bytes, {
        'original': f'{orig_w}x{orig_h} ({orig_size_kb}KB)',
        'downsampled': f'{img.width}x{img.height} ({len(new_bytes) // 1024}KB)',
    }


def call_claude(image_b64: str, prompt: str) -> tuple[str, float, dict]:
    """Claude Sonnet 4.5."""
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    start = time.time()
    message = client.messages.create(
        model='claude-sonnet-4-5-20250929',
        max_tokens=800,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': image_b64},
                },
                {'type': 'text', 'text': prompt},
            ],
        }],
    )
    elapsed = time.time() - start
    text = message.content[0].text
    usage = {
        'input_tokens': message.usage.input_tokens,
        'output_tokens': message.usage.output_tokens,
    }
    return text, elapsed, usage


def call_gemini(image_bytes: bytes, prompt: str, model: str) -> tuple[str, float, dict]:
    """Gemini (any model)."""
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    start = time.time()
    response = client.models.generate_content(
        model=model,
        contents=[
            genai.types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
            prompt,
        ],
    )
    elapsed = time.time() - start
    usage = {}
    if response.usage_metadata:
        usage = {
            'input_tokens': response.usage_metadata.prompt_token_count,
            'output_tokens': response.usage_metadata.candidates_token_count,
        }
    return response.text, elapsed, usage


def parse_json_response(text: str) -> dict | None:
    """Try to extract JSON from response text."""
    # Strip markdown code fences if present
    cleaned = text.strip()
    if cleaned.startswith('```'):
        lines = cleaned.split('\n')
        # Remove first and last lines (``` markers)
        lines = [l for l in lines[1:] if not l.strip().startswith('```')]
        cleaned = '\n'.join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def print_result(stdout, model_name: str, text: str, elapsed: float, usage: dict):
    """Pretty-print a model's result."""
    stdout.write(f'\n{"━" * 70}')
    stdout.write(f'  {model_name}')
    stdout.write(f'{"━" * 70}')

    tokens_str = ''
    if usage:
        tokens_str = f' | Tokens: {usage.get("input_tokens", "?")} in / {usage.get("output_tokens", "?")} out'
    stdout.write(f'  Time: {elapsed:.1f}s{tokens_str}')

    parsed = parse_json_response(text)
    if parsed:
        stdout.write(f'\n  Rating: {parsed.get("overall_rating", "?")}  |  Score: {parsed.get("score", "?")}/10')
        stdout.write(f'  Summary: {parsed.get("summary", "")}')

        criteria = parsed.get('criteria_scores', {})
        if criteria:
            stdout.write(f'\n  {"Criterion":<22} {"Score":>5}  Observation')
            stdout.write(f'  {"─" * 66}')
            for key, val in criteria.items():
                name = key.replace('_', ' ').title()
                score = val.get('score', '?')
                obs = val.get('observation', '')
                stdout.write(f'  {name:<22} {score:>5}  {obs}')

        actions = parsed.get('action_items', [])
        if actions:
            stdout.write(f'\n  Action Items:')
            for a in actions:
                prio = a.get('priority', '?')
                act = a.get('action', '')
                stdout.write(f'    [{prio}] {act}')
    else:
        stdout.write(f'\n  (Could not parse JSON — raw response below)')
        for line in text.strip().split('\n'):
            stdout.write(f'    {line}')


class Command(BaseCommand):
    help = 'Deep comparison: Claude vs Gemini 2.0 Flash vs Gemini 2.5 Flash on a store photo'

    def add_arguments(self, parser):
        parser.add_argument('--photo-id', type=str, help='Specific WalkPhoto UUID')
        parser.add_argument('--submission-id', type=str, help='Specific AssessmentSubmission UUID')
        parser.add_argument('--assessment', action='store_true', help='Use latest assessment submission')
        parser.add_argument('--max-width', type=int, default=768,
                            help='Max image width (default: 768)')

    def handle(self, *args, **options):
        from apps.walks.models import AssessmentSubmission, WalkPhoto

        if not settings.ANTHROPIC_API_KEY or not settings.GEMINI_API_KEY:
            self.stderr.write('Both ANTHROPIC_API_KEY and GEMINI_API_KEY are required')
            return

        max_width = options['max_width']
        image_field = None
        area_name = None
        store_name = None
        caption = None

        if options['submission_id'] or options['assessment']:
            if options['submission_id']:
                sub = AssessmentSubmission.objects.filter(
                    id=options['submission_id']
                ).select_related('prompt', 'assessment__store').first()
            else:
                sub = AssessmentSubmission.objects.exclude(
                    image=''
                ).select_related('prompt', 'assessment__store').order_by('-submitted_at').first()

            if not sub:
                self.stderr.write('No assessment submissions found.')
                return

            image_field = sub.image
            area_name = sub.prompt.name
            store_name = sub.assessment.store.name
            caption = sub.caption
        else:
            if options['photo_id']:
                photo = WalkPhoto.objects.filter(id=options['photo_id']).select_related(
                    'criterion', 'walk__store').first()
            else:
                photo = WalkPhoto.objects.filter(
                    criterion__name__icontains='shelf'
                ).exclude(image='').select_related('criterion', 'walk__store').first()
                if not photo:
                    photo = WalkPhoto.objects.exclude(image='').select_related(
                        'criterion', 'walk__store').first()

            if not photo:
                self.stderr.write('No photos found.')
                return

            image_field = photo.image
            area_name = photo.criterion.name if photo.criterion else 'Unknown'
            store_name = photo.walk.store.name

        self.stdout.write(f'\n{"=" * 70}')
        self.stdout.write(f'  DEEP VISION COMPARISON — {area_name}')
        self.stdout.write(f'{"=" * 70}')
        self.stdout.write(f'  Photo: {image_field.name}')
        self.stdout.write(f'  Store: {store_name} | Area: {area_name}')
        if caption:
            self.stdout.write(f'  Caption: {caption}')

        # Read and downsample
        try:
            raw_bytes = image_field.read()
            image_field.seek(0)
        except Exception as e:
            self.stderr.write(f'Could not read image: {e}')
            return

        jpeg_bytes, size_info = downsample_image(raw_bytes, max_width)
        image_b64 = base64.standard_b64encode(jpeg_bytes).decode('utf-8')
        self.stdout.write(f'  Original: {size_info["original"]}')
        self.stdout.write(f'  Sent as:  {size_info["downsampled"]}')

        prompt = EVAL_PROMPT.format(area_name=area_name)

        # --- Model 1: Claude Sonnet 4.5 ---
        self.stdout.write(f'\n  Running Claude Sonnet 4.5...')
        try:
            claude_text, claude_time, claude_usage = call_claude(image_b64, prompt)
            print_result(self.stdout, 'CLAUDE SONNET 4.5', claude_text, claude_time, claude_usage)
        except Exception as e:
            self.stdout.write(f'  Claude ERROR: {e}')

        # --- Model 2: Gemini 2.0 Flash ---
        self.stdout.write(f'\n  Running Gemini 2.0 Flash...')
        try:
            g20_text, g20_time, g20_usage = call_gemini(jpeg_bytes, prompt, 'gemini-2.0-flash')
            print_result(self.stdout, 'GEMINI 2.0 FLASH', g20_text, g20_time, g20_usage)
        except Exception as e:
            self.stdout.write(f'  Gemini 2.0 Flash ERROR: {e}')

        # --- Model 3: Gemini 2.5 Flash ---
        self.stdout.write(f'\n  Running Gemini 2.5 Flash...')
        try:
            g25_text, g25_time, g25_usage = call_gemini(jpeg_bytes, prompt, 'gemini-2.5-flash')
            print_result(self.stdout, 'GEMINI 2.5 FLASH', g25_text, g25_time, g25_usage)
        except Exception as e:
            self.stdout.write(f'  Gemini 2.5 Flash ERROR: {e}')

        # --- Summary ---
        self.stdout.write(f'\n{"=" * 70}')
        self.stdout.write(f'  SPEED COMPARISON')
        self.stdout.write(f'{"=" * 70}')
        times = {}
        for name, var in [('Claude Sonnet 4.5', 'claude_time'), ('Gemini 2.0 Flash', 'g20_time'), ('Gemini 2.5 Flash', 'g25_time')]:
            t = locals().get(var, 0)
            if t:
                times[name] = t
                self.stdout.write(f'  {name:<22} {t:.1f}s')

        if times:
            fastest = min(times, key=times.get)
            slowest = max(times, key=times.get)
            self.stdout.write(f'\n  Fastest: {fastest} ({times[fastest]:.1f}s)')
            if times[slowest] and times[fastest]:
                self.stdout.write(f'  Slowest: {slowest} ({times[slowest]:.1f}s) — {times[slowest]/times[fastest]:.1f}x slower')

        self.stdout.write(f'\n{"=" * 70}\n')
