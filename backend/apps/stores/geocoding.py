"""
Geocoding utility using Nominatim/OpenStreetMap.
Free, no API key required, rate-limited to 1 req/sec.
"""
import logging
import time
import urllib.parse
import urllib.request
import json

logger = logging.getLogger(__name__)

_last_request_time = 0


def geocode_address(address='', city='', state='', zip_code=''):
    """
    Geocode an address using Nominatim (OpenStreetMap).
    Returns (latitude, longitude) as floats, or (None, None) on failure.
    Rate-limited to 1 request per second per Nominatim usage policy.
    """
    global _last_request_time

    parts = [p for p in [address, city, state, zip_code] if p.strip()]
    if not parts:
        return None, None

    query = ', '.join(parts)

    # Rate limiting
    elapsed = time.time() - _last_request_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)

    params = urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1,
    })
    url = f'https://nominatim.openstreetmap.org/search?{params}'

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'StoreScore/1.0 (store quality management)'},
        )
        _last_request_time = time.time()
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())

        if data and len(data) > 0:
            lat = float(data[0]['lat'])
            lng = float(data[0]['lon'])
            logger.info(f'Geocoded "{query}" -> ({lat}, {lng})')
            return lat, lng
        else:
            logger.warning(f'No geocoding results for "{query}"')
            return None, None

    except Exception as e:
        logger.error(f'Geocoding error for "{query}": {e}')
        return None, None
