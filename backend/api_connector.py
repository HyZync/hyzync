"""
CXM Generic API Connector
--------------------------
Enables any external CRM / CXM / helpdesk / e-commerce platform to feed
review / feedback data into the system in two ways:

1. **Outbound pull** (source_type = "generic_api")
   - Periodically GETs or POSTs a user-configured endpoint.
   - Supports Bearer token, API-Key header, Basic Auth, or no auth.
   - Field mapping configured in source.config so content, score,
     author, date, and external_id can be plucked from any JSON shape.

2. **Inbound webhook** (source_type = "webhook")
   - Third-party CRM pushes to:
       POST /cxm/sources/{source_id}/webhook/{token}
   - Supports any JSON body; field mapping configured the same way.

The normalise_record() helper is shared by both paths.
"""
import logging
import requests
import time
from datetime import datetime
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

# ── Default field-name mappings (used when config doesn't override) ──────────
DEFAULT_MAP = {
    'content_field': 'content',    # or 'text', 'body', 'review', 'message'
    'score_field':   'score',      # or 'rating', 'stars', 'satisfaction'
    'author_field':  'author',     # or 'name', 'user', 'customer_name'
    'date_field':    'date',       # or 'created_at', 'timestamp', 'reviewed_at'
    'id_field':      'id',         # or 'review_id', 'external_id'
}

# Common field-name aliases that many CRMs use
_CONTENT_ALIASES = ['content', 'text', 'body', 'review', 'message', 'feedback',
                    'comment', 'description', 'note', 'review_text', 'review_body']
_SCORE_ALIASES   = ['score', 'rating', 'stars', 'satisfaction', 'nps_score',
                    'star_rating', 'csat', 'value', 'rate']
_AUTHOR_ALIASES  = ['author', 'name', 'user', 'username', 'customer_name',
                    'reviewer', 'reviewer_name', 'user_name', 'display_name',
                    'full_name', 'contact_name', 'email']
_DATE_ALIASES    = ['date', 'created_at', 'timestamp', 'reviewed_at', 'at',
                    'review_date', 'submitted_at', 'created', 'time']
_ID_ALIASES      = ['id', 'review_id', 'external_id', 'uid', 'uuid', 'record_id']


def _pick(record: dict, field_name: str, aliases: list) -> Any:
    """Try config-specified field name, then common aliases, then return None."""
    if field_name and field_name in record:
        return record[field_name]
    for alias in aliases:
        if alias in record:
            return record[alias]
    return None


def normalise_record(record: dict, config: dict) -> Optional[dict]:
    """
    Map an arbitrary dict from a 3rd-party API/webhook to our canonical
    review schema.  Returns None if no usable content can be extracted.
    """
    content = _pick(record, config.get('content_field', ''), _CONTENT_ALIASES)
    if not content:
        return None

    score_raw = _pick(record, config.get('score_field', ''), _SCORE_ALIASES)
    score = 3  # default: neutral
    if score_raw is not None:
        try:
            score_f = float(score_raw)
            # Detect scale: NPS (0-10), percentage (0-100), or 1-5 stars
            if score_f > 10:  # likely 0-100 scale (CSAT %)
                score = max(1, min(5, round(score_f / 20)))
            elif score_f > 5:  # likely NPS / 0-10 scale
                score = max(1, min(5, round((score_f / 10) * 4 + 1)))
            else:              # standard 1-5 stars
                score = max(1, min(5, round(score_f)))
        except (TypeError, ValueError):
            score = 3

    author = str(_pick(record, config.get('author_field', ''), _AUTHOR_ALIASES) or 'Anonymous')
    date_raw = _pick(record, config.get('date_field', ''), _DATE_ALIASES)
    date_str = str(date_raw) if date_raw else datetime.now().isoformat()
    ext_id  = str(_pick(record, config.get('id_field', ''), _ID_ALIASES) or '')

    return {
        'external_id': ext_id,
        'author':      author,
        'content':     str(content)[:4000],
        'score':       score,
        'reviewed_at': date_str,
    }


def _build_headers(config: dict) -> dict:
    """Build auth headers from config."""
    auth_type  = config.get('auth_type', 'none')   # none | bearer | apikey | basic
    auth_value = config.get('auth_value', '')
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}

    if auth_type == 'bearer' and auth_value:
        headers['Authorization'] = f'Bearer {auth_value}'
    elif auth_type == 'apikey' and auth_value:
        key_header = config.get('auth_header_name', 'X-Api-Key')
        headers[key_header] = auth_value
    elif auth_type == 'basic' and auth_value:
        import base64
        headers['Authorization'] = 'Basic ' + base64.b64encode(auth_value.encode()).decode()

    # Any extra static headers the user configured
    extra = config.get('extra_headers', {})
    if isinstance(extra, dict):
        headers.update(extra)

    return headers


def _extract_records(data: Any, config: dict) -> list:
    """
    Dig into the response JSON to find the list of records.
    config['data_path'] can be a dot-separated key path, e.g. "data.reviews".
    Falls back to auto-detection: picks the largest list value in the dict
    (not just the first) to avoid accidentally picking a metadata/tags array.
    """
    path = config.get('data_path', '')
    if path:
        node = data
        for key in path.split('.'):
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                node = None
                break
        if isinstance(node, list):
            return node

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Pick the largest list value (most likely to be the review array)
        best: list = []
        for v in data.values():
            if isinstance(v, list) and len(v) > len(best):
                best = v
        return best
    return []


def fetch_generic_api_reviews(source: dict) -> List[dict]:
    """
    Pull reviews / feedback from any REST API endpoint.
    source['identifier'] = the API URL.
    source['config'] holds auth, field mapping, pagination options.

    Returns a list of normalised review dicts ready for cxm_insert_reviews().
    """
    config     = source.get('config', {})
    url        = source.get('identifier', '')
    method     = config.get('method', 'GET').upper()
    headers    = _build_headers(config)
    params     = config.get('query_params', {})   # e.g. {"page": 1, "limit": 100}
    body       = config.get('request_body', None) # for POST-based APIs

    if not url:
        logger.warning('[CXM Generic API] No URL configured')
        return []

    try:
        for attempt in range(3):
            if method == 'POST':
                resp = requests.post(url, headers=headers, params=params, json=body, timeout=30)
            else:
                resp = requests.get(url, headers=headers, params=params, timeout=30)

            if resp.status_code == 429:
                retry_after = int(resp.headers.get('Retry-After', 10 * (attempt + 1)))
                logger.warning(f'[CXM Generic API] Rate-limited by {url}, waiting {retry_after}s')
                time.sleep(retry_after)
                continue

            resp.raise_for_status()
            raw_data = resp.json()
            break
        else:
            logger.error(f'[CXM Generic API] Exhausted retries due to rate limiting: {url}')
            return []
    except requests.RequestException as e:
        logger.error(f'[CXM Generic API] HTTP error for {url}: {e}')
        return []
    except ValueError as e:
        logger.error(f'[CXM Generic API] JSON decode error for {url}: {e}')
        return []

    records = _extract_records(raw_data, config)
    limit   = int(config.get('count', 200))
    normalised = []
    for rec in records[:limit]:
        n = normalise_record(rec, config)
        if n:
            normalised.append(n)

    logger.info(f'[CXM Generic API] {url} → {len(normalised)} usable records')
    return normalised


def ingest_webhook_payload(payload: Any, config: dict) -> List[dict]:
    """
    Process an inbound webhook payload (from POST /cxm/sources/{id}/webhook/{token}).
    payload can be a list of records, a dict with an array, or a single record dict.

    Returns a list of normalised review dicts.
    """
    records = _extract_records(payload, config)
    if not records:
        # Single-record webhook
        if isinstance(payload, dict):
            records = [payload]

    normalised = []
    for rec in records:
        n = normalise_record(rec, config)
        if n:
            normalised.append(n)

    logger.info(f'[CXM Webhook] Ingested {len(normalised)} records from payload')
    return normalised
