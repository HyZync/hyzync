import os
import logging
import json
import time
import re
import threading
import concurrent.futures
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import jsonschema
import ast
import uuid
from config import settings
import telemetry
import llm_gateway
try:
    import json_repair
except ImportError:
    pass
from insight_prompts import (
    build_record_analysis_batch_prompt,
    build_record_analysis_prompt,
    infer_analysis_mode,
)

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import re
import concurrent.futures
from datetime import datetime, timedelta
from typing import List, Dict, Any
import threading
import jsonschema
import time
import ast
import uuid
import telemetry
try:
    import json_repair
except ImportError:
    pass
from database import DB_PATH
# Try to import advanced modules (graceful fallback if missing)
try:
    from pattern_matcher import PatternMatcher
    from context_graph import ContextGraphBuilder, ContextGraphManager
    ADVANCED_FEATURES_AVAILABLE = True
except ImportError:
    ADVANCED_FEATURES_AVAILABLE = False
    print("Warning: Advanced W4 features (PatternMatcher, ContextGraph) not available.")
import logging
from datetime import datetime, timedelta

# Initialize logger
logger = logging.getLogger("hyzync.processor")

def log_debug(msg: str) -> None:
    """Standard logging at INFO level."""
    logger.info(msg)

# Configuration defaults
TREND_WINDOW_DAYS = 30
BASELINE_WINDOW_DAYS = 60

# --- Global HTTP Session (reused across all LLM calls) ---
_session = requests.Session()
_retry_strategy = Retry(
    total=2,
    connect=2,
    read=0,
    status=1,
    other=0,
    backoff_factor=0.5,
    status_forcelist=[502, 503, 504],
    allowed_methods=["POST"],
)
_adapter = HTTPAdapter(max_retries=_retry_strategy, pool_connections=4, pool_maxsize=4)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)

_active_llm_base_url_lock = threading.Lock()
_active_llm_base_url = str(getattr(settings, "OLLAMA_URL", "") or "").strip().rstrip("/")


def _normalize_base_url(value: Any) -> str:
    return str(value or "").strip().rstrip("/")


def _configured_fallback_urls() -> List[str]:
    raw = str(getattr(settings, "OLLAMA_FALLBACK_URLS", "") or "").strip()
    if not raw:
        return []
    return [url.strip() for url in raw.split(",") if url.strip()]


def _candidate_llm_base_urls() -> List[str]:
    seen = set()
    candidates: List[str] = []
    for raw_url in [
        getattr(settings, "OLLAMA_URL", ""),
        *_configured_fallback_urls(),
        "http://127.0.0.1:11434",
        "http://localhost:11434",
    ]:
        normalized = _normalize_base_url(raw_url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        candidates.append(normalized)
    return candidates


def _ordered_llm_base_urls() -> List[str]:
    candidates = _candidate_llm_base_urls()
    with _active_llm_base_url_lock:
        active = _active_llm_base_url
    if active and active in candidates:
        return [active] + [url for url in candidates if url != active]
    return candidates


def _remember_active_llm_base_url(base_url: str) -> None:
    normalized = _normalize_base_url(base_url)
    if not normalized:
        return
    global _active_llm_base_url
    with _active_llm_base_url_lock:
        _active_llm_base_url = normalized


def _is_vllm_url(base_url: str) -> bool:
    return "/v1" in str(base_url or "").lower()


def _compact_llm_error_text(error: Any) -> str:
    return re.sub(r"\s+", " ", str(error or "")).strip()


def _friendly_llm_endpoint_error(base_url: str, error: Any) -> str:
    text = _compact_llm_error_text(error)
    lower = text.lower()
    endpoint = _normalize_base_url(base_url) or "configured endpoint"
    is_local = ("127.0.0.1" in endpoint) or ("localhost" in endpoint)

    if any(token in lower for token in ["10054", "forcibly closed", "connection reset", "connection aborted", "protocolerror"]):
        return f"{endpoint}: Remote host closed the connection unexpectedly."
    if "524" in lower or "a timeout occurred" in lower:
        return f"{endpoint}: Gateway timed out while waiting for the LLM service."
    if "502" in lower or "bad gateway" in lower:
        return f"{endpoint}: Gateway reported the LLM service as unavailable."
    if "503" in lower or "service unavailable" in lower:
        return f"{endpoint}: LLM service is temporarily unavailable."
    if any(token in lower for token in ["read timed out", "readtimeout", "connecttimeout", "timed out"]):
        return f"{endpoint}: LLM request timed out."
    if any(token in lower for token in ["10061", "actively refused", "connection refused", "failed to establish a new connection"]):
        if is_local:
            return f"{endpoint}: Local fallback endpoint is not running."
        return f"{endpoint}: Connection was refused by the endpoint."
    if "empty response" in lower:
        return f"{endpoint}: LLM returned an empty response."
    if "did not return probe text" in lower:
        return f"{endpoint}: LLM health probe did not return usable output."
    if "not valid json" in lower:
        return f"{endpoint}: LLM health probe returned invalid JSON."
    if not text:
        return f"{endpoint}: Unknown LLM connectivity error."
    return f"{endpoint}: {text[:180]}"

# --- Global LLM Concurrency Limiter ---
# Initialized after settings parsing below.
_llm_semaphore = threading.Semaphore(1)

# --- Pre-compiled Regex Patterns for JSON Parsing ---
_RE_MARKDOWN_FENCE = re.compile(r'^\s*```(json)?\s*|```\s*$', re.IGNORECASE | re.MULTILINE)
_RE_INVALID_ESCAPE = re.compile(r'(?<!\\)\\(?![\\/bfnrtu"])')
_RE_UNQUOTED_KEY = re.compile(r',\s*([a-zA-Z_][a-zA-Z0-9_]*)"\s*:')
_RE_TRAILING_COMMA_OBJ = re.compile(r',\s*\}')
_RE_TRAILING_COMMA_ARR = re.compile(r',\s*\]')
_RE_ORPHAN_QUOTE_KEY = re.compile(r',\s*""\s*([a-zA-Z_][a-zA-Z0-9_]*)":')
_RE_ORPHAN_QUOTE = re.compile(r',\s*""\s*,')
_RE_MISSING_VALUE = re.compile(r':\s*,')
_RE_MISSING_VALUE_END = re.compile(r':\s*\}')
_RE_DOUBLE_COMMA = re.compile(r',\s*,+')
_RE_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]')
MIN_REVIEW_CHAR_LENGTH = 2

# --- Context-Window Sliding Window Config ---
def _safe_int(value, default: int, minimum: int = 1) -> int:
    """Parse an int safely and enforce a lower bound."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(parsed, minimum)


def _safe_float(value, default: float, minimum: float, maximum: float) -> float:
    """Parse a float safely and clamp to a range."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return min(max(parsed, minimum), maximum)


# Context controls are configurable via settings/env.
# Prefer practical defaults for remote inference latency/stability.
OLLAMA_NUM_CTX = _safe_int(getattr(settings, "OLLAMA_NUM_CTX", 8192), 8192, 1024)
_configured_ctx_window = _safe_int(
    getattr(settings, "ANALYSIS_CONTEXT_WINDOW_TOKENS", OLLAMA_NUM_CTX),
    OLLAMA_NUM_CTX,
    1024,
)
CTX_WINDOW_TOKENS = min(_configured_ctx_window, OLLAMA_NUM_CTX)
CONTEXT_HEADROOM = _safe_float(getattr(settings, "ANALYSIS_CONTEXT_HEADROOM", 0.85), 0.85, 0.50, 0.98)
CONTEXT_REFRESH_TOKENS = max(1024, int(CTX_WINDOW_TOKENS * CONTEXT_HEADROOM))

PROMPT_OVERHEAD_TOKENS = 320       # Fixed per call: persona + rules + schema tokens
OUTPUT_TOKENS_PER_REVIEW = _safe_int(
    getattr(settings, "ANALYSIS_OUTPUT_TOKENS_PER_REVIEW", 192),
    192,
    96,
)
TOKENS_PER_CHAR = 0.30             # ~3 chars per token for English text
MAX_PROMPT_REVIEW_CHARS = _safe_int(
    getattr(settings, "ANALYSIS_MAX_PROMPT_REVIEW_CHARS", 520),
    520,
    200,
)

# Total token budget for a single review slot (prompt + content + output)
_TOKENS_PER_SLOT = PROMPT_OVERHEAD_TOKENS + int(MAX_PROMPT_REVIEW_CHARS * TOKENS_PER_CHAR) + OUTPUT_TOKENS_PER_REVIEW
# Estimated reviews that safely fit in one context-refresh cycle
MAX_REVIEWS_PER_WINDOW = max(1, int(CONTEXT_REFRESH_TOKENS / max(_TOKENS_PER_SLOT, 1)))
MAX_RETRY_PASSES = _safe_int(
    getattr(settings, "ANALYSIS_RETRY_PASSES", 1),
    1,
    0,
)  # Retry failed reviews this many extra passes
OLLAMA_REQUEST_TIMEOUT_SECONDS = _safe_int(
    getattr(settings, "OLLAMA_REQUEST_TIMEOUT_SECONDS", 90),
    90,
    5,
)
OLLAMA_REQUEST_RETRIES = _safe_int(
    getattr(settings, "OLLAMA_REQUEST_RETRIES", 1),
    1,
    1,
)
_default_idle_fallback_seconds = max((OLLAMA_REQUEST_TIMEOUT_SECONDS * 2) + 30, 180)
_raw_idle_fallback_seconds = getattr(settings, "WINDOW_IDLE_FALLBACK_SECONDS", 0)
try:
    _raw_idle_fallback_seconds = int(_raw_idle_fallback_seconds or 0)
except (TypeError, ValueError):
    _raw_idle_fallback_seconds = 0
if _raw_idle_fallback_seconds <= 0:
    _raw_idle_fallback_seconds = _default_idle_fallback_seconds
WINDOW_IDLE_FALLBACK_SECONDS = _safe_int(
    _raw_idle_fallback_seconds,
    _default_idle_fallback_seconds,
    30,
)
OLLAMA_PREFLIGHT_TIMEOUT_SECONDS = _safe_int(
    getattr(settings, "OLLAMA_PREFLIGHT_TIMEOUT_SECONDS", 12),
    12,
    3,
)
_ollama_url_lc = str(getattr(settings, "OLLAMA_URL", "") or "").lower()
_llm_is_local = ("localhost" in _ollama_url_lc) or ("127.0.0.1" in _ollama_url_lc)
LLM_MAX_CONCURRENCY = _safe_int(
    getattr(settings, "LLM_MAX_CONCURRENCY", 8 if _llm_is_local else 1),
    8 if _llm_is_local else 1,
    1,
)
LLM_WINDOW_MAX_WORKERS_REMOTE = _safe_int(
    getattr(settings, "LLM_WINDOW_MAX_WORKERS_REMOTE", 1),
    1,
    1,
)
LLM_WINDOW_MAX_WORKERS_LOCAL = _safe_int(
    getattr(settings, "LLM_WINDOW_MAX_WORKERS_LOCAL", 4),
    4,
    1,
)
LLM_BATCHING_ENABLED = bool(getattr(settings, "LLM_BATCHING_ENABLED", True))
LLM_BATCH_MAX_ITEMS = _safe_int(
    getattr(settings, "LLM_BATCH_MAX_ITEMS", 4),
    4,
    1,
)
LLM_BATCH_MAX_WAIT_MS = _safe_int(
    getattr(settings, "LLM_BATCH_MAX_WAIT_MS", 40),
    40,
    5,
)
LLM_BATCH_DISABLED_MODELS = [
    token.strip().lower()
    for token in str(getattr(settings, "LLM_BATCH_DISABLED_MODELS", "phi4-mini,phi4-free,phi-4-mini") or "").split(",")
    if token and token.strip()
]
STRICT_LLM_ANALYSIS = bool(getattr(settings, "STRICT_LLM_ANALYSIS", True))
STRICT_ANALYSIS_MAX_ATTEMPTS = _safe_int(
    getattr(settings, "STRICT_ANALYSIS_MAX_ATTEMPTS", 5),
    5,
    1,
)
STRICT_ANALYSIS_FAIL_ON_UNRESOLVED = bool(
    getattr(settings, "STRICT_ANALYSIS_FAIL_ON_UNRESOLVED", True)
)


def _resolve_analysis_llm_timeout_seconds(configured_timeout: Any, request_timeout_seconds: int, is_local: bool) -> int:
    resolved = _safe_int(configured_timeout, request_timeout_seconds, 10)
    if is_local:
        return min(resolved, request_timeout_seconds)
    return max(10, resolved)


ANALYSIS_LLM_TIMEOUT_SECONDS = _resolve_analysis_llm_timeout_seconds(
    getattr(settings, "ANALYSIS_LLM_TIMEOUT_SECONDS", OLLAMA_REQUEST_TIMEOUT_SECONDS),
    OLLAMA_REQUEST_TIMEOUT_SECONDS,
    _llm_is_local,
)
ANALYSIS_LLM_REQUEST_RETRIES = _safe_int(
    getattr(
        settings,
        "ANALYSIS_LLM_REQUEST_RETRIES",
        1 if not _llm_is_local else min(2, OLLAMA_REQUEST_RETRIES),
    ),
    1 if not _llm_is_local else min(2, OLLAMA_REQUEST_RETRIES),
    1,
)
_analysis_batch_remote_max_items = _safe_int(
    getattr(settings, "ANALYSIS_BATCH_MAX_ITEMS_REMOTE", 1),
    1,
    1,
)
ANALYSIS_BATCH_MAX_ITEMS = (
    min(LLM_BATCH_MAX_ITEMS, _analysis_batch_remote_max_items)
    if not _llm_is_local
    else LLM_BATCH_MAX_ITEMS
)
ANALYSIS_BATCH_MAX_WAIT_MS = _safe_int(
    getattr(settings, "ANALYSIS_BATCH_MAX_WAIT_MS", 30 if not _llm_is_local else LLM_BATCH_MAX_WAIT_MS),
    30 if not _llm_is_local else LLM_BATCH_MAX_WAIT_MS,
    5,
)
if not _llm_is_local:
    WINDOW_IDLE_FALLBACK_SECONDS = min(
        WINDOW_IDLE_FALLBACK_SECONDS,
        max(90, ANALYSIS_LLM_TIMEOUT_SECONDS * 2),
    )
_llm_semaphore = threading.Semaphore(LLM_MAX_CONCURRENCY)
_llm_health_cache_lock = threading.Lock()
_llm_health_cache: Dict[str, Any] = {"expires_at": 0.0, "value": None}


def _estimate_prompt_tokens(prompt: Any) -> int:
    text = str(prompt or "")
    # Keep this conservative and cheap; 0.30 ~ 3 chars/token.
    return max(1, int(len(text) * TOKENS_PER_CHAR))


def _effective_num_ctx(prompt: Any, num_predict: int) -> int:
    estimated_prompt_tokens = _estimate_prompt_tokens(prompt)
    completion_budget = max(64, int(num_predict or OUTPUT_TOKENS_PER_REVIEW))
    # Prompt + completion + buffer for system scaffolding/tooling overhead.
    required = estimated_prompt_tokens + completion_budget + 2048
    floor = 4096
    ceiling = max(floor, int(OLLAMA_NUM_CTX))
    if not _llm_is_local:
        # Remote endpoints are often slower/less stable at very high context windows.
        ceiling = min(ceiling, 16384)
    return min(ceiling, max(floor, required))


def estimate_review_token_cost(review: Dict[str, Any]) -> int:
    """Rough token estimator used for context-refresh checkpointing."""
    raw_content = (
        review.get('content')
        or review.get('text')
        or review.get('body')
        or review.get('review')
        or ''
    )
    content_chars = min(len(str(raw_content)), MAX_PROMPT_REVIEW_CHARS)
    content_tokens = int(content_chars * TOKENS_PER_CHAR)
    baseline = PROMPT_OVERHEAD_TOKENS + OUTPUT_TOKENS_PER_REVIEW
    return max(baseline, baseline + content_tokens)


def build_token_windows(reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Split reviews into context-safe windows.
    Each window stays under CONTEXT_REFRESH_TOKENS so we can checkpoint and refresh prompts.
    """
    windows: List[Dict[str, Any]] = []
    current_indices: List[int] = []
    current_tokens = 0

    for idx, review in enumerate(reviews):
        est_tokens = estimate_review_token_cost(review)
        if current_indices and (current_tokens + est_tokens) > CONTEXT_REFRESH_TOKENS:
            windows.append({
                "indices": current_indices,
                "estimated_tokens": current_tokens
            })
            current_indices = []
            current_tokens = 0
        current_indices.append(idx)
        current_tokens += est_tokens

    if current_indices:
        windows.append({
            "indices": current_indices,
            "estimated_tokens": current_tokens
        })

    return windows

# --- Emoji-to-Text Mapping ---
EMOJI_MAP = {
    '😀': 'happy', '😃': 'happy', '😄': 'happy', '😁': 'grinning', '😆': 'laughing',
    '😅': 'relieved', '🤣': 'laughing', '😂': 'laughing', '🙂': 'slightly happy',
    '🙃': 'sarcastic', '😉': 'playful', '😊': 'pleased', '😇': 'blessed',
    '😍': 'love', '🥰': 'adored', '😘': 'love', '😗': 'kiss',
    '😋': 'delicious', '😛': 'playful', '😜': 'playful', '🤪': 'silly',
    '🤨': 'skeptical', '🧐': 'curious', '🤓': 'nerdy', '😎': 'cool',
    '🤩': 'amazed', '🥳': 'celebrating',
    '😏': 'smirking', '😒': 'unamused', '🙄': 'eye roll annoyed',
    '😞': 'disappointed', '😔': 'sad', '😟': 'worried', '🙁': 'unhappy',
    '😣': 'frustrated', '😖': 'frustrated', '😫': 'exhausted', '😩': 'weary',
    '🥺': 'pleading', '😢': 'crying', '😭': 'sobbing very sad', '😤': 'angry frustrated',
    '😠': 'angry', '😡': 'very angry furious', '🤬': 'cursing angry',
    '😱': 'shocked scared', '😨': 'fearful', '😰': 'anxious',
    '😥': 'sad relieved', '😓': 'disappointed', '🤗': 'hugging happy',
    '🤔': 'thinking confused', '🤭': 'oops', '🤫': 'shushing', '🤥': 'lying',
    '💀': 'dead hilarious', '💩': 'terrible crap', '👻': 'ghost fun',
    '👍': 'thumbs up good', '👎': 'thumbs down bad', '👏': 'clapping great',
    '🙏': 'please thankful', '❤️': 'love', '💔': 'heartbroken', '💯': 'perfect',
    '🔥': 'fire amazing', '⭐': 'star great', '✨': 'sparkle amazing',
    '✅': 'approved good', '❌': 'rejected bad', '⚠️': 'warning problem',
    '🚫': 'prohibited bad', '💪': 'strong powerful', '🎉': 'party celebration',
    '😴': 'bored sleepy', '🤮': 'disgusted', '🤢': 'sick nauseated',
    '💰': 'money expensive', '📉': 'declining bad', '📈': 'growing good',
}

def emoji_to_text(text: str) -> str:
    """Replace emoji characters with descriptive English words."""
    if not text:
        return text
    for emoji_char, description in EMOJI_MAP.items():
        text = text.replace(emoji_char, f' {description} ')
    # Also convert any remaining non-ASCII emoji-like chars to a generic description
    import unicodedata
    result = []
    for char in text:
        if ord(char) > 127:
            try:
                name = unicodedata.name(char, '')
                if name:
                    result.append(f' {name.lower()} ')
                else:
                    result.append(' ')
            except (ValueError, TypeError):
                result.append(' ')
        else:
            result.append(char)
    return re.sub(r'\s+', ' ', ''.join(result)).strip()

def detect_non_english(text: str) -> bool:
    """Aggressive detection: if ANY significant non-ASCII content exists, translate it.
    Threshold: if less than 85% of non-space chars are basic ASCII, trigger translation.
    This catches: fully non-English, mixed-language, accented text, etc."""
    if not text or len(text) < 3:
        return False
    ascii_chars = sum(1 for c in text if c.isascii() and (c.isalpha() or c.isdigit() or c in ' .,!?'))
    total_chars = sum(1 for c in text if not c.isspace())
    if total_chars == 0:
        return False
    return (ascii_chars / total_chars) < 0.85

def translate_to_english(text: str) -> str:
    """Translate ANY non-English text to English using the LLM. Always returns usable text."""
    try:
        # Pre-clean for the translation prompt — remove chars that would break the prompt
        safe_text = text[:500].replace('\\', ' ').replace('"', "'").replace('\n', ' ')
        safe_text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', safe_text)
        
        prompt = f"""You are a translator. Translate the following text to English. Return ONLY the plain English translation. Do not add explanations, quotes, or formatting.

Text: {safe_text}

English:"""
        result = query_ollama(prompt, num_predict=250, response_format=None, return_tokens=False)
        if result and len(result.strip()) > 2:
            translated = result.strip().strip('"').strip("'").strip()
            # Verify translation isn't garbage (should be mostly ASCII)
            ascii_ratio = sum(1 for c in translated if c.isascii()) / max(len(translated), 1)
            if ascii_ratio > 0.7:
                return translated
    except Exception as e:
        log_debug(f"Translation failed: {e}")
    return text  # Return original if translation fails

def sanitize_for_prompt(text: str) -> str:
    """Nuclear sanitizer: strips ALL characters that could break JSON/prompt embedding.
    Call this right before inserting text into the LLM prompt."""
    if not text:
        return ''
    # Remove null bytes and control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Remove unicode surrogates and private use area chars
    text = re.sub(r'[\ud800-\udfff]', '', text)
    # Escape backslashes and quotes for JSON safety
    text = text.replace('\\', ' ').replace('"', "'")
    # Remove any remaining non-printable unicode
    text = ''.join(c for c in text if c.isprintable() or c in '\n\t ')
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def rule_based_fallback_analysis(review_data: dict, content: str, rating: int) -> dict:
    """Generate a basic analysis from the star rating when LLM completely fails.
    This ensures NO review is ever left unanalyzed."""
    obj = DEFAULT_VALUES.copy()
    
    # Derive sentiment from rating
    if rating >= 4:
        obj['sentiment'] = 'positive'
        obj['sentiment_score'] = 0.3 + (rating - 4) * 0.3  # 4→0.3, 5→0.6
        obj['churn_risk'] = 'low'
        obj['churn_impact'] = 'none'
        obj['intent'] = 'Praise'
        obj['user_segment'] = 'Promoter'
        obj['urgency'] = 'None'
        obj['issue'] = 'No major issues reported'
        obj['theme_primary'] = 'Positive experience'
        obj['theme_cluster'] = 'Positive experience'
        obj['cluster_label'] = 'promoters positive experience'
        obj['trending_theme'] = 'Positive experience'
    elif rating == 3:
        obj['sentiment'] = 'neutral'
        obj['sentiment_score'] = 0.0
        obj['churn_risk'] = 'low'  # 3-star = neutral, not at churn risk by default
        obj['churn_impact'] = 'low'
        obj['intent'] = 'Inform'
        obj['user_segment'] = 'Neutral'
        obj['urgency'] = 'Low'
        obj['issue'] = 'Mixed experience'
        obj['theme_primary'] = 'Mixed experience'
        obj['theme_cluster'] = 'Mixed experience'
    else:  # 1-2
        obj['sentiment'] = 'negative'
        obj['sentiment_score'] = -0.3 - (2 - min(rating, 2)) * 0.3  # 2→-0.3, 1→-0.6
        obj['churn_risk'] = 'high' if rating == 1 else 'medium'
        obj['churn_impact'] = 'high' if rating == 1 else 'medium'
        obj['intent'] = 'Complaint'
        obj['user_segment'] = 'Detractor'
        obj['urgency'] = 'High' if rating == 1 else 'Medium'
        obj['issue'] = 'User dissatisfaction'
        obj['theme_primary'] = 'User dissatisfaction'
        obj['theme_cluster'] = 'User dissatisfaction'
        obj['cluster_label'] = 'detractors dissatisfaction'
    
    obj['solving_priority'] = 'critical' if obj['churn_impact'] == 'high' else ('high' if obj['urgency'] == 'High' else 'medium')
    obj['journey_stage'] = 'unknown'
    obj['action_owner'] = 'Unknown'
    obj['action_recommendation'] = 'Review repeated signal and route to owner'
    
    # Try to extract basic keywords from content
    content_lower = (content or '').lower()
    if any(w in content_lower for w in ['bug', 'crash', 'error', 'broken', 'glitch']):
        obj['pain_point_category'] = 'Bug'
        obj['issue'] = 'Bug or technical issue'
        obj['theme_primary'] = 'Reliability'
        obj['theme_cluster'] = 'Reliability issues'
        obj['cluster_label'] = f"{obj['user_segment'].lower()} reliability issues"
        obj['action_owner'] = 'Engineering'
        obj['action_recommendation'] = 'Fix recurring reliability blocker'
    elif any(w in content_lower for w in ['price', 'expensive', 'cost', 'billing', 'charge']):
        obj['pain_point_category'] = 'Billing'
        obj['issue'] = 'Pricing or billing concern'
        obj['theme_primary'] = 'Billing'
        obj['theme_cluster'] = 'Billing friction'
        obj['cluster_label'] = f"{obj['user_segment'].lower()} billing friction"
        obj['action_owner'] = 'Billing'
        obj['action_recommendation'] = 'Resolve pricing or charge confusion'
        obj['revenue_sensitivity'] = True
    elif any(w in content_lower for w in ['support', 'help', 'response', 'customer service']):
        obj['pain_point_category'] = 'Support'
        obj['issue'] = 'Customer support experience'
        obj['theme_primary'] = 'Support'
        obj['theme_cluster'] = 'Support friction'
        obj['cluster_label'] = f"{obj['user_segment'].lower()} support friction"
        obj['action_owner'] = 'Support'
        obj['action_recommendation'] = 'Improve support response handling'
    elif any(w in content_lower for w in ['feature', 'missing', 'need', 'want', 'wish', 'add']):
        obj['pain_point_category'] = 'Feature'
        obj['issue'] = 'Feature request or gap'
        obj['feature_request'] = 'Requested improvement'
        obj['user_suggestion'] = 'Customer suggested a missing capability'
        obj['theme_primary'] = 'Feature gap'
        obj['theme_cluster'] = 'Feature gap'
        obj['cluster_label'] = f"{obj['user_segment'].lower()} feature gap"
        obj['action_owner'] = 'Product'
        obj['action_recommendation'] = 'Review feature gap for roadmap'
    elif any(w in content_lower for w in ['slow', 'confusing', 'difficult', 'ui', 'interface', 'design']):
        obj['pain_point_category'] = 'UX'
        obj['issue'] = 'Usability or UX concern'
        obj['theme_primary'] = 'Usability'
        obj['theme_cluster'] = 'Usability friction'
        obj['cluster_label'] = f"{obj['user_segment'].lower()} usability friction"
        obj['action_owner'] = 'Product'
        obj['action_recommendation'] = 'Reduce UX friction in flow'

    if any(w in content_lower for w in ['cancel', 'refund', 'switch', 'leave', 'churn', 'renewal']):
        obj['journey_stage'] = 'cancellation' if ('cancel' in content_lower or 'refund' in content_lower) else 'renewal'
        obj['churn_impact'] = 'high'
        obj['solving_priority'] = 'critical'
    elif any(w in content_lower for w in ['onboard', 'setup', 'first time', 'getting started']):
        obj['journey_stage'] = 'onboarding'
    elif any(w in content_lower for w in ['support', 'ticket', 'agent']):
        obj['journey_stage'] = 'support'
    
    obj['confidence'] = 0.4  # Low confidence for rule-based
    obj['domain_insight'] = 'Analyzed via rule-based fallback'
    
    return {**review_data, **obj, '_meta_tokens': 0, '_meta_fallback': True}


def run_fallback_analysis_batch(
    reviews_list: List[Dict[str, Any]],
    progress_callback=None,
    reason: str = "llm_unavailable",
) -> List[Dict[str, Any]]:
    """
    Fast deterministic fallback when the LLM backend is unavailable.
    """
    total = len(reviews_list)
    results: List[Dict[str, Any]] = []
    progress_emit_every = max(1, total // 20) if total else 1

    for idx, review in enumerate(reviews_list):
        raw_content = (
            review.get('content')
            or review.get('text')
            or review.get('body')
            or review.get('review')
            or ''
        )
        rating = review.get('score', review.get('rating', 3))
        try:
            rating_value = int(float(rating))
        except (TypeError, ValueError):
            rating_value = 3

        fallback = rule_based_fallback_analysis(review, str(raw_content), rating_value)
        fallback['_meta_fallback'] = True
        fallback['_meta_error'] = False
        fallback['_meta_reason'] = reason
        results.append(fallback)

        completed = idx + 1
        if progress_callback and (
            completed == 1
            or completed == total
            or completed % progress_emit_every == 0
        ):
            pct = 15 + int((completed / max(total, 1)) * 70)
            progress_callback(
                pct,
                f"LLM unavailable. Generated fallback analysis for {completed}/{total} reviews...",
                meta={
                    "tokens": 0,
                    "failed_reviews": [],
                    "processed_reviews": completed,
                    "total_reviews": total,
                    "fetched_reviews": total,
                    "analyzed_reviews": completed,
                    "fallback_reviews": completed,
                    "unresolved_reviews": 0,
                    "dropped_reviews": max(0, total - completed),
                    "in_flight_reviews": max(0, total - completed),
                    "coverage_pct": round((completed / max(total, 1)) * 100, 2),
                    "analysis_summary": (
                        "LLM backend unavailable. Returned deterministic fallback analysis."
                        if completed == total
                        else None
                    ),
                    "context_refreshes": 0,
                    "context_window_budget_tokens": CONTEXT_REFRESH_TOKENS,
                    "context_checkpoint": {
                        "window": 1,
                        "range_start": 0,
                        "range_end": max(0, total - 1),
                        "processed_reviews": completed,
                        "estimated_tokens": 0,
                        "context_refreshes": 0,
                    },
                },
            )

    return results

def fix_unescaped_quotes(json_str: str) -> str:
    """Iterates through JSON string and escapes unescaped internal double quotes."""
    escape_next = False
    fixed_chars = []
    
    for i, char in enumerate(json_str):
        if escape_next:
            fixed_chars.append(char)
            escape_next = False
            continue
            
        if char == '\\':
            fixed_chars.append(char)
            escape_next = True
            continue
            
        if char == '"':
            # Check context to see if it's a structural quote
            prev_char = ''
            for j in range(i - 1, -1, -1):
                if not json_str[j].isspace():
                    prev_char = json_str[j]
                    break
                    
            next_char = ''
            for j in range(i + 1, len(json_str)):
                if not json_str[j].isspace():
                    next_char = json_str[j]
                    break
            
            is_structural_start = prev_char in ('{', ',', ':', '[')
            is_structural_end = next_char in ('}', ',', ':', ']')
            
            if is_structural_start or is_structural_end:
                 fixed_chars.append('"') 
            else:
                 fixed_chars.append('\\"') 
        else:
            fixed_chars.append(char)
             
    return "".join(fixed_chars)

def _strip_markdown_fences(raw_response: str) -> str:
    return _RE_MARKDOWN_FENCE.sub('', str(raw_response or '').strip())


def _extract_balanced_json_chunk(candidate: str) -> str:
    if not candidate:
        return ""

    pairs = {'{': '}', '[': ']'}
    start_char = candidate[0]
    expected_end = pairs.get(start_char)
    if not expected_end:
        return ""

    stack = [expected_end]
    in_string = False
    escape_next = False

    for idx, char in enumerate(candidate[1:], start=1):
        if escape_next:
            escape_next = False
            continue

        if char == '\\':
            escape_next = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char in pairs:
            stack.append(pairs[char])
            continue

        if stack and char == stack[-1]:
            stack.pop()
            if not stack:
                return candidate[:idx + 1]

    return ""


def _extract_structured_candidates(raw_response: str) -> List[str]:
    raw_text = str(raw_response or '').strip()
    stripped = _strip_markdown_fences(raw_text)
    candidates: List[str] = []
    seen = set()

    def _push(value: str) -> None:
        cleaned_value = str(value or '').strip()
        if not cleaned_value or cleaned_value in seen:
            return
        seen.add(cleaned_value)
        candidates.append(cleaned_value)

    for seed in (stripped, raw_text):
        if not seed:
            continue

        object_start = seed.find('{')
        array_start = seed.find('[')
        start_positions = [idx for idx in (object_start, array_start) if idx != -1]
        if not start_positions:
            _push(seed)
            continue

        start_idx = min(start_positions)
        fragment = seed[start_idx:]
        _push(fragment)

        balanced = _extract_balanced_json_chunk(fragment)
        if balanced:
            _push(balanced)
        else:
            end_char = '}' if seed[start_idx] == '{' else ']'
            search_end = min(len(seed), start_idx + 20000)
            fallback_end = seed.rfind(end_char, start_idx, search_end)
            if fallback_end != -1 and fallback_end >= start_idx:
                _push(seed[start_idx:fallback_end + 1])

        _push(seed)

    return candidates


def _json_candidate_variants(candidate: str) -> List[str]:
    base = str(candidate or '').strip().lstrip('\ufeff')
    if not base:
        return []

    variants: List[str] = []
    seen = set()

    def _push(value: str) -> None:
        cleaned_value = str(value or '').strip()
        if not cleaned_value or cleaned_value in seen:
            return
        seen.add(cleaned_value)
        variants.append(cleaned_value)

    _push(base)

    cleaned = base.replace('\udfe7', '').strip()
    cleaned = _RE_CONTROL_CHARS.sub(' ', cleaned)
    cleaned = cleaned.replace('\r', ' ').replace('\n', ' ')
    cleaned = _RE_INVALID_ESCAPE.sub('', cleaned)
    cleaned = _RE_UNQUOTED_KEY.sub(r',"\1":', cleaned)
    cleaned = _RE_TRAILING_COMMA_OBJ.sub('}', cleaned)
    cleaned = _RE_TRAILING_COMMA_ARR.sub(']', cleaned)
    cleaned = _RE_ORPHAN_QUOTE_KEY.sub(r',"\1":', cleaned)
    cleaned = _RE_ORPHAN_QUOTE.sub(',', cleaned)
    cleaned = _RE_MISSING_VALUE.sub(':"None",', cleaned)
    cleaned = _RE_MISSING_VALUE_END.sub(':"None"}', cleaned)
    cleaned = _RE_DOUBLE_COMMA.sub(',', cleaned)
    _push(cleaned)

    quote_fixed = fix_unescaped_quotes(cleaned)
    _push(quote_fixed)

    return variants


def _unwrap_nested_json_payload(value: Any, max_depth: int = 2) -> Any:
    current = value
    for _ in range(max_depth):
        if not isinstance(current, str):
            break
        inner = _strip_markdown_fences(current).strip()
        if not inner or inner == current and not inner.startswith(('{', '[', '"')):
            break
        try:
            current = json.loads(inner)
        except Exception:
            break
    return current


def _decode_json_candidate(candidate: str) -> Any:
    last_error = None
    variants = _json_candidate_variants(candidate)

    for variant in variants:
        try:
            decoded = _unwrap_nested_json_payload(json.loads(variant))
            if isinstance(decoded, (dict, list)):
                return decoded
        except Exception as exc:
            last_error = exc

    for variant in variants:
        try:
            if 'json_repair' in globals():
                decoded = _unwrap_nested_json_payload(json_repair.loads(variant))
                if isinstance(decoded, (dict, list)):
                    return decoded
        except Exception as exc:
            last_error = exc

    for variant in variants:
        try:
            decoded = _unwrap_nested_json_payload(ast.literal_eval(variant))
            if isinstance(decoded, (dict, list)):
                return decoded
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    raise ValueError("No decodable JSON candidate found")


def parse_llm_json_payload(response: str) -> Any:
    """Robustly extracts, cleans, and parses JSON payloads from LLM responses."""
    if not response or not str(response).strip():
        raise ValueError("Empty response from LLM")

    raw_response = str(response).strip()
    parse_errors: List[str] = []

    for candidate in _extract_structured_candidates(raw_response):
        try:
            decoded = _decode_json_candidate(candidate)
            if isinstance(decoded, (dict, list)):
                return decoded
        except Exception as exc:
            parse_errors.append(str(exc))

    hint = parse_errors[-1] if parse_errors else "unknown parsing error"
    raise ValueError(
        f"Failed to parse JSON even after robust cleanup ({hint}). Snippet: {raw_response[:100]}..."
    )


def parse_llm_json(response: str) -> dict:
    """Robustly extracts, cleans, and parses JSON objects from LLM responses."""
    payload = parse_llm_json_payload(response)
    if isinstance(payload, dict):
        return payload
    raise ValueError("Parsed JSON payload was not an object")


def parse_llm_batch_json(response: str) -> Dict[str, Dict[str, Any]]:
    """Parse a batched JSON payload and index it by request_id."""
    payload = parse_llm_json_payload(response)

    def _normalize_batch_item(item: Any, fallback_request_id: str = "") -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None

        normalized = dict(item)
        for nested_key in ("result", "analysis", "payload", "data"):
            nested = normalized.get(nested_key)
            if isinstance(nested, dict):
                merged = dict(nested)
                for passthrough_key in ("request_id", "requestId", "review_id", "reviewId"):
                    passthrough_value = normalized.get(passthrough_key)
                    if passthrough_value and not merged.get(passthrough_key):
                        merged[passthrough_key] = passthrough_value
                normalized = merged
                break

        request_id = str(
            normalized.get("request_id")
            or normalized.get("requestId")
            or fallback_request_id
            or ""
        ).strip()
        if not request_id:
            return None

        normalized["request_id"] = request_id
        return normalized

    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = None
        if isinstance(payload.get("results"), list):
            items = payload.get("results")
        elif isinstance(payload.get("results"), dict):
            items = [
                _normalize_batch_item(value, fallback_request_id=str(key))
                for key, value in payload.get("results", {}).items()
            ]
        elif isinstance(payload.get("items"), list):
            items = payload.get("items")
        elif isinstance(payload.get("items"), dict):
            items = [
                _normalize_batch_item(value, fallback_request_id=str(key))
                for key, value in payload.get("items", {}).items()
            ]
        elif isinstance(payload.get("data"), list):
            items = payload.get("data")
        elif isinstance(payload.get("data"), dict):
            items = [
                _normalize_batch_item(value, fallback_request_id=str(key))
                for key, value in payload.get("data", {}).items()
            ]
        if items is None and str(payload.get("request_id", "")).strip():
            items = [payload]
        if items is None and payload and all(isinstance(value, dict) for value in payload.values()):
            items = [
                _normalize_batch_item(value, fallback_request_id=str(key))
                for key, value in payload.items()
            ]
    else:
        items = None

    if not isinstance(items, list):
        raise ValueError("Batch response did not contain a results array")

    indexed: Dict[str, Dict[str, Any]] = {}
    for item in items:
        normalized = _normalize_batch_item(item)
        if not isinstance(normalized, dict):
            continue
        request_id = str(normalized.get("request_id", "")).strip()
        if not request_id:
            continue
        if request_id in indexed:
            raise ValueError(f"Duplicate request_id returned in batch response: {request_id}")
        indexed[request_id] = normalized

    if not indexed:
        raise ValueError("Batch response contained no request_id-indexed objects")

    return indexed

# Domain Configuration (Matched with W4.py)
# Load Prompts Data
try:
    PROMPTS_PATH = os.path.join(os.path.dirname(__file__), 'prompts.json')
    with open(PROMPTS_PATH, 'r', encoding='utf-8') as f:
        PROMPTS_DATA = json.load(f)
        VERTICAL_TERMINOLOGY = PROMPTS_DATA.get('vertical_terminology', {})
        # Load schemas from strings in JSON if used there, or use constants. 
        # W4.py had schema config in python code but template in JSON.
        # We will follow W4's pattern: Schema is defined in code usually, but W4 has it in `REVIEW_ANALYSIS_SCHEMA` constant.
except Exception as e:
    print(f"Warning: Could not load prompts.json: {e}")
    PROMPTS_DATA = {}
    VERTICAL_TERMINOLOGY = {}

# Re-define Domain Config from JSON if available, else keep fallback
if PROMPTS_DATA.get('domain_config'):
    DOMAIN_CONFIG = PROMPTS_DATA.get('domain_config')
else:
    DOMAIN_CONFIG = {
    "generic": {
        "focus_keywords": "general usability, price, customer support, features, bugs",
        "retention_keywords": ["cancel", "refund", "price", "disappointed", "slow", "bug"],
        "retention_alert_threshold": 2.0
    },
    "saas": {
         "focus_keywords": "cancel, renewal, price, feature set, performance, support response time, technical bugs",
        "retention_keywords": ["cancel", "unsubscribe", "renewal notice", "switch", "waste of money", "not worth the price"],
        "retention_alert_threshold": 3.0
    },
    "subscription": {
        "focus_keywords": "cancel, renewal, price, content library, ad experience, customer support response time, technical bugs",
        "retention_keywords": ["cancel", "unsubscribe", "renewal notice", "switch", "waste of money", "not worth the price", "content bored"],
        "retention_alert_threshold": 3.0
    },
    "ecommerce": {
        "focus_keywords": "checkout process, refund policy, payment gateway, delivery tracking, customer support experience, item availability",
        "retention_keywords": ["cancel order", "refund delay", "payment failed", "checkout error", "never received", "wrong item sent"],
        "retention_alert_threshold": 4.0
    }
}

# START JSON SCHEMAS (Optimized for Speed)
REVIEW_ANALYSIS_SCHEMA = {
    "type": "object",
    "required": [
        "sentiment", "sentiment_score", "churn_risk",
        "pain_point_category", "issue", "root_cause",
        "intent", "emotions", "urgency"
    ],
    "properties": {
        "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
        "sentiment_score": {"type": "number", "minimum": -1.0, "maximum": 1.0},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "action_confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "impact_score": {"type": "number", "minimum": 0.0, "maximum": 100.0},
        "churn_risk": {"type": "string", "enum": ["high", "medium", "low", "null"]},
        "churn_impact": {"type": "string", "enum": ["high", "medium", "low", "none"]},
        "pain_point_category": {"type": "string", "enum": ["Billing", "Feature", "UX", "Bug", "Support", "Other", "Value"]},
        "issue": {"type": "string"},
        "root_cause": {"type": "string"},
        "solving_priority": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
        "action_owner": {"type": "string", "enum": ["Product", "Support", "Growth", "CX", "Billing", "Engineering", "Leadership", "Unknown"]},
        "action_recommendation": {"type": "string"},
        "feature_request": {"type": "string"},
        "user_suggestion": {"type": "string"},
        "theme_primary": {"type": "string"},
        "theme_cluster": {"type": "string"},
        "cluster_label": {"type": "string"},
        "trending_theme": {"type": "string"},
        "emerging_theme": {"type": "string"},
        "intent": {"type": "string", "enum": ["Praise", "Complaint", "Suggest", "Recommend", "Question", "Inform", "Informative"]},
        "emotions": {"type": "array", "items": {"type": "string"}},
        "urgency": {"type": "string", "enum": ["High", "Medium", "Low", "None"]},
        "user_segment": {"type": "string", "enum": ["New", "Veteran", "Detractor", "Promoter", "Neutral"]},
        "journey_stage": {"type": "string", "enum": ["onboarding", "active_use", "support", "renewal", "cancellation", "advocacy", "unknown"]},
        "domain_insight": {"type": "string"},
        "revenue_sensitivity": {"type": "boolean"}
    }
}

DEFAULT_VALUES = {
    "sentiment": "neutral",
    "sentiment_score": 0.0,
    "confidence": 0.5,
    "action_confidence": 0.5,
    "impact_score": 0.0,
    "churn_risk": "null",
    "churn_impact": "none",
    "pain_point_category": "Other",
    "issue": "N/A",
    "root_cause": "N/A",
    "solving_priority": "medium",
    "action_owner": "Unknown",
    "action_recommendation": "None",
    "feature_request": "None",
    "user_suggestion": "None",
    "theme_primary": "None",
    "theme_cluster": "None",
    "cluster_label": "None",
    "trending_theme": "None",
    "emerging_theme": "None",
    "intent": "Inform",
    "emotions": [],
    "urgency": "None",
    "user_segment": "Neutral",
    "journey_stage": "unknown",
    "domain_insight": "N/A",
    "revenue_sensitivity": False
}


def _build_unresolved_result(
    review_data: Dict[str, Any],
    *,
    reason: str,
    raw_content: str = "",
    error_detail: str = "",
    noise_score: float = 0.0,
    clean_flags: Optional[List[str]] = None,
    cleaned_text: str = "",
    clean_token_estimate: int = 0,
    tokens: int = 0,
    batched: bool = False,
    batch_size: int = 1,
) -> Dict[str, Any]:
    payload = {
        **review_data,
        **DEFAULT_VALUES.copy(),
        "_meta_tokens": int(tokens or 0),
        "_meta_error": True,
        "_meta_fallback": False,
        "_meta_reason": str(reason or "llm_unresolved"),
        "_meta_raw_content": str(raw_content or review_data.get("content") or ""),
        "_noise_score": float(noise_score or 0.0),
        "_clean_flags": list(clean_flags or []),
        "_cleaned_text": str(cleaned_text or ""),
        "_clean_token_estimate": int(clean_token_estimate or 0),
        "_meta_batched": bool(batched),
        "_meta_batch_size": int(batch_size or 1),
    }
    if error_detail:
        payload["_meta_error_detail"] = str(error_detail)[:600]
    return payload

# --- Utility Functions ---

def sanitize_custom_instructions(text):
    """
    Clean and normalize custom user instructions for safe prompt injection.
    Handles typos, excessive whitespace, and limits length.
    """
    if not text or not text.strip():
        return None
    # Remove excessive whitespace
    cleaned = ' '.join(text.split())
    # Truncate to reasonable length (500 chars max)
    if len(cleaned) > 500:
        cleaned = cleaned[:500] + "..."
    return cleaned

def clean_review_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""
    # Save original for fallback before aggressive stripping
    original_truncated = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text[:700]).strip()
    
    # Truncate before expensive regex
    text = text[:1500]
    
    text = text.lower()
    text = re.sub(r'<[^>]+>', ' ', text)    # Strip HTML tags
    text = re.sub(r'&[^;]+;', ' ', text)    # Strip HTML entities
    text = re.sub(r'[\*]{2,}', ' ', text)  # Remove markdown bold
    text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text)  # Control chars
    text = re.sub(r'https?://\S+|www\.\S+', ' (link) ', text)  # URLs
    # Replace non-ASCII with space instead of removing — preserves review length for non-Latin scripts
    text = re.sub(r'[^\x20-\x7E]', ' ', text)
    text = re.sub(r"[^a-z0-9\s.,?!:;'\"()$&@#%/+=<>{}|\[\]\-]", ' ', text)

    text = re.sub(r'([.!?])\1+', r'\1', text)

    text = re.sub(r'\s+', ' ', text).strip()
    cleaned = text[:700]
    
    # Fallback: if cleaning destroyed too much (e.g. Japanese/Arabic/emoji review),
    # return lightly-cleaned original so the review is not silently lost
    if len(cleaned.strip()) < 10 and len(original_truncated) >= 10:
        return original_truncated[:700]
    
    return cleaned


# ─────────────────────────────────────────────────────────────
#  ADVANCED CLEANING ENGINE
#  Provides token-efficient, JSON-safe review preparation.
#  Used by analyze_single_review_task before LLM dispatch.
# ─────────────────────────────────────────────────────────────

import hashlib

# Boilerplate phrases frequently seen in app store reviews that add zero signal
_BOILERPLATE_PATTERNS = re.compile(
    r'\b(read more|see full review|show more|tap to expand|'
    r'translated by google|original language|this review was|'
    r'helpful\?|was this helpful|report review|flag review|'
    r'developer response|response from developer|'
    r'edited by author|last edited|verified purchase)\b',
    re.IGNORECASE
)

# Consecutive punctuation spam that wastes tokens (e.g., "!!!!!!!" → "!")
_PUNCT_SPAM = re.compile(r'([!?.]){2,}')

# Orphan JSON-breaking characters that confuse small LLMs
_JSON_BREAKERS = re.compile(r'[\\"\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

# Characters that indicate near-duplicate boilerplate content
_WHITESPACE_NORMALIZE = re.compile(r'\s{2,}')
_CRM_HEADER_PREFIX = re.compile(r'^\s*(from|to|cc|bcc|subject|sent|ticket|case|conversation|thread|attachments?)\s*[:#-]', re.IGNORECASE)
_CRM_QUOTED_LINE = re.compile(r'^\s*>')
_CRM_SIGNATURE_LINE = re.compile(r'^\s*(thanks|thank you|best regards|kind regards|regards|cheers|warm regards|sent from my)\b', re.IGNORECASE)
_CRM_REFERENCE_TOKEN = re.compile(r'\b(ticket|case|conversation|thread|incident|reference)\s*[#: -]*[a-z0-9\-]{4,}\b', re.IGNORECASE)
_HEX_LIKE_NOISE = re.compile(r'\b[a-f0-9]{16,}\b', re.IGNORECASE)

class DedupRegistry:
    """Thread-safe per-batch duplicate tracker."""

    def __init__(self):
        self._fingerprints: set[str] = set()
        self._lock = threading.Lock()

    def check_and_register(self, fingerprint: str) -> bool:
        with self._lock:
            if fingerprint in self._fingerprints:
                return True
            self._fingerprints.add(fingerprint)
            return False


def create_dedup_registry() -> DedupRegistry:
    return DedupRegistry()

def _content_fingerprint(text: str) -> str:
    """SHA-1 fingerprint of first 80 lowercased alphanum chars for near-dupe detection."""
    normalized = re.sub(r'[^a-z0-9]', '', text.lower())[:80]
    return hashlib.sha1(normalized.encode()).hexdigest()


def _check_duplicate_with_registry(text: str, dedup_registry: Any) -> bool:
    if not dedup_registry or not text:
        return False
    try:
        return bool(dedup_registry.check_and_register(_content_fingerprint(text)))
    except Exception:
        return False

def _estimate_tokens(text: str) -> int:
    """Fast token estimate: average 3 chars per English token."""
    return max(1, int(len(text) * TOKENS_PER_CHAR))

def _truncate_to_sentence(text: str, max_chars: int = 700) -> str:
    """Truncate at sentence boundary rather than mid-word if possible."""
    if len(text) <= max_chars:
        return text
    # Try to cut at last sentence-ending punctuation before limit
    window = text[:max_chars + 50]
    match = None
    for m in re.finditer(r'[.!?]\s', window):
        if m.end() <= max_chars:
            match = m
    if match:
        return text[:match.end()].rstrip()
    # Fallback: word boundary
    cut = text[:max_chars]
    last_space = cut.rfind(' ')
    return cut[:last_space] if last_space > max_chars * 0.7 else cut


def _clean_feedback_crm_artifacts(text: str) -> str:
    """Strip common CRM email/ticket boilerplate without removing core complaint text."""
    if not text:
        return ""

    lines = re.split(r'[\r\n]+', text)
    kept_lines = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if _CRM_QUOTED_LINE.match(line):
            continue
        if _CRM_HEADER_PREFIX.match(line):
            continue
        if _CRM_SIGNATURE_LINE.match(line):
            continue
        kept_lines.append(line)

    merged = " ".join(kept_lines) if kept_lines else text
    merged = _CRM_REFERENCE_TOKEN.sub(" ", merged)
    merged = _HEX_LIKE_NOISE.sub(" ", merged)
    return _WHITESPACE_NORMALIZE.sub(" ", merged).strip()


def advanced_clean_review(
    text: str,
    rating: int = 3,
    options: dict = None
) -> dict:
    """
    Token-efficient, JSON-safe review cleaning pipeline.

    Returns a dict:
      {
        'cleaned_text': str,        # Ready-for-prompt text
        'noise_score': float,       # 0.0=clean, 1.0=noisy (magic cleaning)
        'token_estimate': int,      # Estimated tokens for this review
        'was_truncated': bool,
        'was_duplicate': bool,
        'flags': list[str],         # Human-readable quality flags
      }
    """
    if options is None:
        options = {}

    token_efficiency = options.get('token_efficiency', True)
    magic_clean      = options.get('magic_clean', True)
    language_focus   = options.get('language_focus', False)
    html_shield      = options.get('html_shield', True)
    crm_mode         = options.get('crm_mode', False)

    flags = []
    was_duplicate = False
    was_truncated = False
    noise_score = 0.0

    if not text or not isinstance(text, str):
        return {
            'cleaned_text': '',
            'noise_score': 1.0,
            'token_estimate': 0,
            'was_truncated': False,
            'was_duplicate': False,
            'flags': ['empty_input'],
        }

    # ── Step 1: Base text cleaning (always applied) ──────────────────
    cleaned = clean_review_text(text)

    # ── Step 2: HTML shield ──────────────────────────────────────────
    if html_shield:
        # Extra pass: strip residual HTML-like artifacts
        cleaned = re.sub(r'&(?:amp|lt|gt|nbsp|quot|apos);', ' ', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'&#\d+;', ' ', cleaned)

    # ── Step 3: Token efficiency cleaning ────────────────────────────
    if token_efficiency:
        # Remove boilerplate phrases
        before_len = len(cleaned)
        cleaned = _BOILERPLATE_PATTERNS.sub('', cleaned)
        if len(cleaned) < before_len - 5:
            flags.append('boilerplate_removed')

        # Compress punctuation spam: "!!!" → "!"
        cleaned = _PUNCT_SPAM.sub(r'\1', cleaned)

        # Normalize excessive whitespace
        cleaned = _WHITESPACE_NORMALIZE.sub(' ', cleaned).strip()

    if crm_mode:
        crm_before = cleaned
        cleaned = _clean_feedback_crm_artifacts(cleaned)
        cleaned = _WHITESPACE_NORMALIZE.sub(' ', cleaned).strip()
        if cleaned != crm_before:
            flags.append('crm_artifacts_removed')

    # ── Step 4: Language focus (English-only filter) ──────────────────
    if language_focus:
        # Count non-ASCII characters — if >30% of content, skip (non-English)
        non_ascii_ratio = sum(1 for c in cleaned if ord(c) > 127) / max(len(cleaned), 1)
        if non_ascii_ratio > 0.30:
            flags.append('non_english_filtered')
            return {
                'cleaned_text': '',
                'noise_score': 0.5,
                'token_estimate': 0,
                'was_truncated': False,
                'was_duplicate': False,
                'flags': flags,
            }

    # ── Step 5: JSON-safety cleaning ─────────────────────────────────
    # Strip characters that cause LLM JSON output corruption
    cleaned = _JSON_BREAKERS.sub(' ', cleaned)
    # Collapse multiple spaces after JSON-breaker removal
    cleaned = _WHITESPACE_NORMALIZE.sub(' ', cleaned).strip()

    # ── Step 6: Smart truncation to token budget ──────────────────────
    MAX_CONTENT_CHARS = 520 if crm_mode else 600  # CRM keeps a tighter budget for JSON stability
    if len(cleaned) > MAX_CONTENT_CHARS:
        cleaned = _truncate_to_sentence(cleaned, MAX_CONTENT_CHARS)
        was_truncated = True
        flags.append('truncated')

    # ── Step 7: Deduplication fingerprint check ───────────────────────
    if token_efficiency and cleaned:
        dedup_registry = options.get('dedup_registry')
        if _check_duplicate_with_registry(cleaned, dedup_registry):
            was_duplicate = True
            flags.append('duplicate')

    # ── Step 8: Magic cleaning — noise scoring ────────────────────────
    if magic_clean and cleaned:
        try:
            from pattern_intelligence import PatternIntelligence
            import sqlite3
            from database import DB_PATH as _db_path
            conn = sqlite3.connect(_db_path, check_same_thread=False)
            pi = PatternIntelligence(conn)
            # Build lightweight mock result for noise calculation
            mock_llm_result = {
                'sentiment': 'positive' if rating >= 4 else ('negative' if rating <= 2 else 'neutral'),
                'sentiment_score': (rating - 3) / 2.0,
                'confidence': 0.5 if len(cleaned) < 30 else 0.75,
            }
            noise_score = pi.calculate_noise_score(
                {'content': cleaned, 'rating': rating},
                mock_llm_result
            )
            conn.close()
            if noise_score > 0.74:
                flags.append('high_noise')
            elif noise_score > 0.49:
                flags.append('medium_noise')
        except Exception:
            noise_score = 0.0  # Fail silently — noise scoring is optional enrichment

    token_est = _estimate_tokens(cleaned)

    return {
        'cleaned_text': cleaned,
        'noise_score': round(noise_score, 3),
        'token_estimate': token_est,
        'was_truncated': was_truncated,
        'was_duplicate': was_duplicate,
        'flags': flags,
    }


def validate_and_repair_json(obj):
    """
    Validates JSON against schema and auto-repairs missing/invalid fields.
    Guarantees that output structure never changes and never throws parsing errors.
    """
    try:
        # Validate against schema
        jsonschema.validate(obj, REVIEW_ANALYSIS_SCHEMA)
        return obj
    except (jsonschema.ValidationError, Exception):
        # Auto-repair: Fill missing or invalid fields with defaults
        if not isinstance(obj, dict):
            obj = {}
        
        enum_fields = {
            "sentiment",
            "churn_risk",
            "churn_impact",
            "pain_point_category",
            "solving_priority",
            "action_owner",
            "intent",
            "urgency",
            "user_segment",
            "journey_stage",
        }
        string_fields = {
            "issue",
            "root_cause",
            "action_recommendation",
            "feature_request",
            "user_suggestion",
            "theme_primary",
            "theme_cluster",
            "cluster_label",
            "trending_theme",
            "emerging_theme",
            "domain_insight",
        }

        for field, default in DEFAULT_VALUES.items():
            if field not in obj or obj[field] is None:
                obj[field] = default
            # Fix invalid enum values
            elif field in enum_fields:
                valid_values = REVIEW_ANALYSIS_SCHEMA["properties"][field].get("enum", [])
                if obj[field] not in valid_values:
                    obj[field] = default
            # Ensure sentiment_score and confidence are within bounds
            elif field == "sentiment_score":
                if not isinstance(obj[field], (int, float)) or obj[field] < -1.0 or obj[field] > 1.0:
                    obj[field] = default
            elif field == "confidence":
                if not isinstance(obj[field], (int, float)) or obj[field] < 0.0 or obj[field] > 1.0:
                    obj[field] = default
            elif field == "action_confidence":
                if not isinstance(obj[field], (int, float)) or obj[field] < 0.0 or obj[field] > 1.0:
                    obj[field] = default
            elif field == "impact_score":
                if not isinstance(obj[field], (int, float)) or obj[field] < 0.0 or obj[field] > 100.0:
                    obj[field] = default
            elif field in string_fields:
                if isinstance(obj[field], (list, dict)):
                    obj[field] = default
                else:
                    cleaned = str(obj[field]).strip()
                    obj[field] = cleaned[:180] if cleaned else default
            # Ensure emissions is a list of strings
            elif field == "emotions":
                if not isinstance(obj[field], list):
                    obj[field] = default
                else:
                    # Coerce all items to strings, remove empties
                    obj[field] = [str(e).strip() for e in obj[field] if e is not None and str(e).strip()]
            # Ensure revenue_sensitivity is boolean
            elif field == "revenue_sensitivity":
                if isinstance(obj[field], str):
                    obj[field] = obj[field].lower() in ('true', '1', 'yes')
                elif not isinstance(obj[field], bool):
                    obj[field] = default
        
        return obj


def query_ollama(
    prompt,
    model=None,
    stop_event=None,
    num_predict=256,
    response_format=None,
    return_tokens=False,
    system_prompt=None,
    temperature=0.05,
    top_p=0.9,
    timeout_seconds=None,
    retries=None,
    num_ctx=None,
):
    effective_model = model or settings.OLLAMA_MODEL
    effective_timeout = _safe_int(
        timeout_seconds if timeout_seconds is not None else OLLAMA_REQUEST_TIMEOUT_SECONDS,
        OLLAMA_REQUEST_TIMEOUT_SECONDS,
        5,
    )
    effective_retries = _safe_int(
        retries if retries is not None else OLLAMA_REQUEST_RETRIES,
        OLLAMA_REQUEST_RETRIES,
        1,
    )
    effective_num_ctx = _safe_int(
        num_ctx if num_ctx is not None else _effective_num_ctx(prompt, num_predict),
        _effective_num_ctx(prompt, num_predict),
        1024,
    )
    result = llm_gateway.request_completion(
        prompt,
        model=effective_model,
        num_predict=num_predict,
        response_format=response_format,
        timeout_seconds=effective_timeout,
        retries=effective_retries,
        num_ctx=effective_num_ctx,
        stop_event=stop_event,
        system_prompt=system_prompt,
        temperature=temperature,
        top_p=top_p,
    )
    if result.get("ok"):
        if return_tokens:
            return result.get("text"), int(result.get("tokens", 0) or 0)
        return result.get("text")
    final_error = str(result.get("error") or "Unknown LLM request failure.")
    logger.warning("LLM request failed: %s", final_error)
    if return_tokens:
        return None, 0
    return None


def check_llm_connectivity(timeout_seconds: Optional[int] = None, force_refresh: bool = False) -> Dict[str, Any]:
    return llm_gateway.probe_connectivity(
        timeout_seconds=timeout_seconds or OLLAMA_PREFLIGHT_TIMEOUT_SECONDS,
        force_refresh=force_refresh,
        model=settings.OLLAMA_MODEL,
        num_ctx=_effective_num_ctx('Return only valid JSON: {"ok": true, "probe": "analysis"}', 64),
    )


def _should_use_review_batching() -> bool:
    if not (LLM_BATCHING_ENABLED and ANALYSIS_BATCH_MAX_ITEMS > 1):
        return False
    model_name = str(getattr(settings, "OLLAMA_MODEL", "") or "").strip().lower()
    if any(marker for marker in LLM_BATCH_DISABLED_MODELS if marker and marker in model_name):
        return False
    # phi4 family is much more reliable in strict single-review mode.
    if STRICT_LLM_ANALYSIS and "phi4" in model_name:
        return False
    return True


def _allocate_batch_tokens(total_tokens: int, batch_size: int) -> List[int]:
    if batch_size <= 0:
        return []
    safe_total = max(0, int(total_tokens or 0))
    base, remainder = divmod(safe_total, batch_size)
    return [base + (1 if idx < remainder else 0) for idx in range(batch_size)]


def _review_batch_key(payload: Dict[str, Any]) -> tuple:
    return (
        str(payload.get("analysis_mode", "workspace") or "workspace"),
        str(payload.get("vertical", "generic") or "generic"),
        str(payload.get("custom_instructions", "") or ""),
        str(settings.OLLAMA_MODEL or ""),
    )


def _prompt_list_values() -> Dict[str, Any]:
    lists = PROMPTS_DATA.get('lists', {})
    return {
        "all_emotions": lists.get('all_emotions', [
            "Satisfaction", "Delight", "Excitement", "Trust", "Empathy", "Gratitude",
            "Surprise", "Curiosity", "Hopefulness", "Skepticism", "Frustration",
            "Disappointment", "Sadness", "Disgust", "Anger", "Confusion",
            "Anxiety", "Dissatisfied"
        ]),
        "pain_points": lists.get('pain_points', "Billing/Feature/UX/Bug/Support/Other/Value"),
        "intents": lists.get('intents', "Praise/Complaint/Suggest/Recommend/Question/Inform/Informative"),
        "urgency_levels": lists.get('urgency_levels', "High/Medium/Low/None"),
        "segments": lists.get('segments', "New/Veteran/Detractor/Promoter/Neutral"),
        "churn_risks": lists.get('churn_risks', "high/medium/low/null"),
        "sentiments": lists.get('sentiments', "positive/negative/neutral"),
    }


def _build_review_analysis_batch_prompt(items: List[Dict[str, Any]]) -> str:
    first = items[0]["payload"]
    list_values = _prompt_list_values()
    return build_record_analysis_batch_prompt(
        analysis_mode=str(first.get("analysis_mode", "workspace") or "workspace"),
        vertical=str(first.get("vertical", "generic") or "generic"),
        focus_keywords=str(first.get("focus_keywords", "") or ""),
        custom_instructions=str(first.get("custom_instructions", "") or ""),
        emotions_list=list_values["all_emotions"],
        sentiments=list_values["sentiments"],
        churn_risks=list_values["churn_risks"],
        pain_points=list_values["pain_points"],
        intents=list_values["intents"],
        urgency_levels=list_values["urgency_levels"],
        segments=list_values["segments"],
        records=[
            {
                "request_id": item["request_id"],
                "review_id": item["payload"].get("review_id", "unknown"),
                "rating": item["payload"].get("rating", 3),
                "content": item["payload"].get("content", ""),
                "record_context": item["payload"].get("record_context", {}),
            }
            for item in items
        ],
    )


class ReviewAnalysisBatcher:
    """Co-batches compatible review-analysis requests across concurrent users/jobs."""

    def __init__(self, max_items: int, max_wait_ms: int):
        self.max_items = max(1, int(max_items or 1))
        self.max_wait_ms = max(5, int(max_wait_ms or 5))
        self._lock = threading.Lock()
        self._pending: Dict[tuple, List[Dict[str, Any]]] = {}
        self._timers: Dict[tuple, threading.Timer] = {}

    def submit(self, payload: Dict[str, Any], stop_event=None) -> Dict[str, Any]:
        future = concurrent.futures.Future()
        request_id = str(payload.get("request_id", "") or "").strip()
        if not request_id:
            raise ValueError("Batched review-analysis payload requires request_id")

        key = _review_batch_key(payload)
        batch_item = {
            "request_id": request_id,
            "payload": dict(payload),
            "future": future,
            "submitted_at": time.time(),
        }

        to_flush: List[Dict[str, Any]] = []
        with self._lock:
            queue = self._pending.setdefault(key, [])
            queue.append(batch_item)
            if len(queue) >= self.max_items:
                to_flush = self._take_pending_locked(key)
                timer = self._timers.pop(key, None)
                if timer:
                    timer.cancel()
            elif key not in self._timers:
                timer = threading.Timer(self.max_wait_ms / 1000.0, self._flush_from_timer, args=(key,))
                timer.daemon = True
                self._timers[key] = timer
                timer.start()

        if to_flush:
            self._dispatch_flush(to_flush)

        while True:
            try:
                return future.result(timeout=0.25)
            except concurrent.futures.TimeoutError:
                if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
                    return {
                        "ok": False,
                        "error": "Analysis cancelled while waiting for batched LLM response.",
                        "fallback_reason": "analysis_cancelled",
                        "batched": True,
                        "batch_size": len(to_flush) or 1,
                    }

    def _take_pending_locked(self, key: tuple) -> List[Dict[str, Any]]:
        queued = list(self._pending.pop(key, []))
        return queued

    def _flush_from_timer(self, key: tuple) -> None:
        to_flush: List[Dict[str, Any]] = []
        with self._lock:
            self._timers.pop(key, None)
            to_flush = self._take_pending_locked(key)
        if to_flush:
            self._dispatch_flush(to_flush)

    def _dispatch_flush(self, items: List[Dict[str, Any]]) -> None:
        worker = threading.Thread(target=self._flush_batch, args=(items,), daemon=True)
        worker.start()

    def _resolve_items(self, items: List[Dict[str, Any]], response: Dict[str, Any]) -> None:
        for item in items:
            future = item["future"]
            if not future.done():
                future.set_result(dict(response))

    def _flush_batch(self, items: List[Dict[str, Any]]) -> None:
        batch_size = len(items)
        try:
            prompt = _build_review_analysis_batch_prompt(items)
            num_predict = max(192, min(900, 170 * batch_size + 72))
            llm_result = _request_review_llm_completion(
                prompt,
                num_predict=num_predict,
                timeout_seconds=ANALYSIS_LLM_TIMEOUT_SECONDS,
                retries=ANALYSIS_LLM_REQUEST_RETRIES,
                num_ctx=_effective_num_ctx(prompt, num_predict),
            )
            if not llm_result.get("ok"):
                self._resolve_items(
                    items,
                    {
                        "ok": False,
                        "error": str(llm_result.get("error") or "Unknown batched LLM request failure."),
                        "fallback_reason": "llm_batch_request_failed",
                        "batched": True,
                        "batch_size": batch_size,
                    },
                )
                return

            raw_text = str(llm_result.get("text") or "")
            parsed_by_request = parse_llm_batch_json(raw_text)
            token_shares = _allocate_batch_tokens(int(llm_result.get("tokens", 0) or 0), batch_size)

            for idx, item in enumerate(items):
                request_id = item["request_id"]
                parsed = parsed_by_request.get(request_id)
                if not isinstance(parsed, dict):
                    item["future"].set_result(
                        {
                            "ok": False,
                            "error": f"Batch response omitted request_id={request_id}.",
                            "fallback_reason": "llm_batch_missing_item",
                            "batched": True,
                            "batch_size": batch_size,
                            "raw_response": raw_text,
                        }
                    )
                    continue

                expected_review_id = str(item["payload"].get("review_id", "") or "").strip()
                actual_review_id = str(parsed.get("review_id", "") or "").strip()
                if expected_review_id and actual_review_id and actual_review_id != expected_review_id:
                    item["future"].set_result(
                        {
                            "ok": False,
                            "error": (
                                f"Batch response review_id mismatch for request_id={request_id}: "
                                f"expected {expected_review_id}, got {actual_review_id}."
                            ),
                            "fallback_reason": "llm_batch_identity_mismatch",
                            "batched": True,
                            "batch_size": batch_size,
                            "raw_response": raw_text,
                        }
                    )
                    continue

                item["future"].set_result(
                    {
                        "ok": True,
                        "parsed": parsed,
                        "tokens": token_shares[idx] if idx < len(token_shares) else 0,
                        "batched": True,
                        "batch_size": batch_size,
                    }
                )
        except Exception as error:
            error_text = str(error)
            telemetry.log_error(
                error_type="llm_batch_parse_error",
                message=error_text,
                raw_response=locals().get("raw_text"),
            )
            self._resolve_items(
                items,
                {
                    "ok": False,
                    "error": error_text,
                    "fallback_reason": "llm_batch_parse_error",
                    "batched": True,
                    "batch_size": batch_size,
                    "raw_response": locals().get("raw_text"),
                },
            )


_review_analysis_batcher_lock = threading.Lock()
_review_analysis_batcher: Optional[ReviewAnalysisBatcher] = None


def _get_review_analysis_batcher() -> ReviewAnalysisBatcher:
    global _review_analysis_batcher
    with _review_analysis_batcher_lock:
        if _review_analysis_batcher is None:
            _review_analysis_batcher = ReviewAnalysisBatcher(
                max_items=ANALYSIS_BATCH_MAX_ITEMS,
                max_wait_ms=ANALYSIS_BATCH_MAX_WAIT_MS,
            )
        return _review_analysis_batcher


def _request_review_llm_completion(
    prompt: str,
    *,
    num_predict: int,
    timeout_seconds: int,
    retries: int,
    num_ctx: int,
    stop_event=None,
) -> Dict[str, Any]:
    attempt_errors: List[str] = []
    last_result: Dict[str, Any] = {
        "ok": False,
        "text": "",
        "tokens": 0,
        "error": "Unknown LLM request failure.",
    }

    for label, response_format in (("json", "json"), ("plain", None)):
        if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
            break

        result = llm_gateway.request_completion(
            prompt,
            model=settings.OLLAMA_MODEL,
            num_predict=num_predict,
            response_format=response_format,
            timeout_seconds=timeout_seconds,
            retries=retries,
            num_ctx=num_ctx,
            stop_event=stop_event,
            temperature=0.05,
            top_p=0.9,
        )
        last_result = dict(result)

        if result.get("ok") and str(result.get("text") or "").strip():
            last_result["format_fallback_used"] = response_format is None
            last_result["response_format"] = "plain" if response_format is None else "json"
            return last_result

        attempt_errors.append(f"{label}: {str(result.get('error') or 'request failed')}")
        if response_format is None:
            break

    if attempt_errors:
        last_result["error"] = " | ".join(attempt_errors[:2])
    last_result["format_fallback_used"] = False
    last_result["response_format"] = ""
    return last_result


def request_review_analysis(payload: Dict[str, Any], stop_event=None) -> Dict[str, Any]:
    if _should_use_review_batching():
        return _get_review_analysis_batcher().submit(payload, stop_event=stop_event)

    prompt_lists = _prompt_list_values()
    prompt = build_record_analysis_prompt(
        analysis_mode=str(payload.get("analysis_mode", "workspace") or "workspace"),
        vertical=str(payload.get("vertical", "generic") or "generic"),
        focus_keywords=str(payload.get("focus_keywords", "") or ""),
        custom_instructions=str(payload.get("custom_instructions", "") or ""),
        emotions_list=prompt_lists["all_emotions"],
        sentiments=prompt_lists["sentiments"],
        churn_risks=prompt_lists["churn_risks"],
        pain_points=prompt_lists["pain_points"],
        intents=prompt_lists["intents"],
        urgency_levels=prompt_lists["urgency_levels"],
        segments=prompt_lists["segments"],
        rating=int(payload.get("rating", 3) or 3),
        content=str(payload.get("content", "") or ""),
        review_id=str(payload.get("review_id", "unknown") or "unknown"),
        record_context=dict(payload.get("record_context") or {}),
    )
    llm_result = _request_review_llm_completion(
        prompt,
        stop_event=stop_event,
        num_predict=256,
        timeout_seconds=ANALYSIS_LLM_TIMEOUT_SECONDS,
        retries=ANALYSIS_LLM_REQUEST_RETRIES,
        num_ctx=_effective_num_ctx(prompt, 256),
    )
    if not llm_result.get("ok"):
        return {
            "ok": False,
            "error": str(llm_result.get("error") or "LLM connected but returned an empty or unusable response."),
            "fallback_reason": str(llm_result.get("fallback_reason") or "llm_empty_response"),
            "batched": False,
            "batch_size": 1,
            "raw_error": llm_result.get("raw_error"),
        }
    response_text = str(llm_result.get("text") or "")
    tokens = int(llm_result.get("tokens", 0) or 0)
    if not response_text:
        return {
            "ok": False,
            "error": "LLM connected but returned an empty or unusable response.",
            "fallback_reason": "llm_empty_response",
            "batched": False,
            "batch_size": 1,
        }
    return {
        "ok": True,
        "text": response_text,
        "tokens": tokens,
        "batched": False,
        "batch_size": 1,
        "format_fallback_used": bool(llm_result.get("format_fallback_used")),
        "response_format": str(llm_result.get("response_format") or ""),
    }

def analyze_single_review_task(review_data, vertical, custom_instructions=None, stop_event=None, pause_event=None, pattern_matcher=None, analysis_mode="workspace"):
    """
    Worker function to process a single review.
    Running in a thread, so use thread-safe operations.
    """
    # Check stop signal
    if stop_event and stop_event.is_set():
        return None
        
    # Check pause signal - wait while paused
    if pause_event:
        while pause_event.is_set():
            if stop_event and stop_event.is_set():
                return None
            time.sleep(1) # Sleep in 1s intervals to check for resume/stop
            
    review_id = review_data.get('id', review_data.get('review_id', 'Unknown'))
    rating = review_data.get('score', review_data.get('rating', 3))
    try:
        rating_value = int(float(rating))
    except (TypeError, ValueError):
        rating_value = 3
    source = review_data.get('source', 'unknown')
    raw_content = review_data.get('content') or review_data.get('text') or review_data.get('body') or review_data.get('review', '')
    precleaned_content = review_data.get('_precleaned_content')
    preclean_noise_score = float(review_data.get('_preclean_noise_score', 0.0) or 0.0)
    preclean_flags = list(review_data.get('_preclean_flags') or [])
    preclean_token_estimate = int(review_data.get('_preclean_token_estimate', 0) or 0)
    
    # --- PIPELINE: Translate → Emoji → Clean → Sanitize ---
    
    # Step 0A: Force string and basic safety
    raw_content = str(raw_content) if raw_content else ''

    _adv_cleaning_options = review_data.get('_cleaning_options', {
        'token_efficiency': True,
        'magic_clean': True,
        'language_focus': False,
        'html_shield': True,
    })
    if not isinstance(_adv_cleaning_options, dict):
        _adv_cleaning_options = {
            'token_efficiency': True,
            'magic_clean': True,
            'language_focus': False,
            'html_shield': True,
        }
    dedup_registry = _adv_cleaning_options.get('dedup_registry')

    if isinstance(precleaned_content, str):
        content = precleaned_content.strip()
        _noise_score = preclean_noise_score
        _adv_flags = list(preclean_flags)
        _clean_token_estimate = preclean_token_estimate
        if content and 'duplicate' not in _adv_flags and _check_duplicate_with_registry(content, dedup_registry):
            _adv_flags.append('duplicate')
    else:
        # Step 0B: Translate non-English FIRST (before emoji/cleaning strips the original text)
        if raw_content and detect_non_english(raw_content):
            try:
                raw_content = translate_to_english(raw_content)
            except Exception:
                pass  # Keep original if translation fails
        
        # Step 0C: Emoji-to-Text Conversion (after translation, before cleaning)
        if raw_content:
            raw_content = emoji_to_text(raw_content)
        
        # Step 0D: Advanced cleaning (token efficiency + magic cleaning + JSON-safety)
        adv = advanced_clean_review(raw_content, rating=rating_value, options=_adv_cleaning_options)
        content = adv['cleaned_text']
        _noise_score = adv.get('noise_score', 0.0)
        _adv_flags = adv.get('flags', [])
        _clean_token_estimate = int(adv.get('token_estimate', 0) or 0)
    _cleaned_text = content

    # In strict mode we never shortcut to heuristic fallback.
    if isinstance(precleaned_content, str):
        is_duplicate = 'duplicate' in _adv_flags
    else:
        is_duplicate = bool(adv.get('was_duplicate'))
    if is_duplicate and 'duplicate' not in _adv_flags:
        _adv_flags.append('duplicate')

    # If language filtering blanked content, keep the original text for model analysis.
    if not content and 'non_english_filtered' in _adv_flags:
        content = str(raw_content or '').strip()
        _cleaned_text = content

    # If advanced cleaning wiped too much, fall back to base cleaned content.
    if not content:
        content = clean_review_text(raw_content) or str(raw_content or '').strip()
        _cleaned_text = content

    # --- Step 0: Pattern Matching (Cache Hit) ---
    if pattern_matcher:
        try:
            # 1. Exact Match (Fastest)
            cached = pattern_matcher.find_exact_match(content, rating, source, vertical)
            if cached:
                result_dict = {**review_data, **cached.to_dict()}
                result_dict['_noise_score'] = _noise_score
                result_dict['_clean_flags'] = _adv_flags
                result_dict['_cleaned_text'] = _cleaned_text
                result_dict['_clean_token_estimate'] = _clean_token_estimate
                return result_dict
            
            # 2. Similar Pattern Match (Smart)
            # Only if content is long enough to be meaningful
            if len(content) > 15:
                cached = pattern_matcher.find_similar_patterns(content, rating, vertical=vertical)
                if cached:
                    result_dict = {**review_data, **cached.to_dict()}
                    result_dict['_noise_score'] = _noise_score
                    result_dict['_clean_flags'] = _adv_flags
                    result_dict['_cleaned_text'] = _cleaned_text
                    result_dict['_clean_token_estimate'] = _clean_token_estimate
                    return result_dict
        except Exception as e:
            print(f"Pattern matcher error: {e}")

    # --- Nuclear Sanitization for LLM Prompt ---
    content_for_prompt = sanitize_for_prompt(content)[:MAX_PROMPT_REVIEW_CHARS]
    if not content_for_prompt:
        content_for_prompt = sanitize_for_prompt(raw_content)[:MAX_PROMPT_REVIEW_CHARS] or 'No text provided'

    
    # Safe review_id for use in prompt (string-coerce and escape)
    prompt_review_id = str(review_id).replace('"', '').replace('\\', '')[:50]
    
    # Detect if content is too short to be meaningful — still send to LLM but mark as low-confidence
    len(content.strip()) < 5
    
    # Get config for vertical
    vertical_config = DOMAIN_CONFIG.get(vertical, DOMAIN_CONFIG.get('generic', {}))
    focus_keywords = vertical_config.get('focus_keywords', '')
    sanitized_instructions = sanitize_custom_instructions(custom_instructions)
    resolved_mode = infer_analysis_mode(review_data, analysis_mode)
    analysis_payload = {
        "request_id": str(review_data.get("_analysis_request_id") or uuid.uuid4().hex),
        "analysis_mode": resolved_mode,
        "vertical": vertical,
        "focus_keywords": focus_keywords,
        "custom_instructions": sanitized_instructions or "",
        "rating": rating_value if str(rating).strip() else 3,
        "content": content_for_prompt,
        "review_id": prompt_review_id,
        "record_context": {
            "source": str(review_data.get('source', '') or ''),
            "source_type": str(review_data.get('source_type', review_data.get('connector_type', '')) or ''),
            "author": str(review_data.get('author', review_data.get('userName', '')) or ''),
            "customer_identifier": str(review_data.get('customer_identifier', '') or ''),
        },
    }

    attempt_errors: List[str] = []
    max_llm_attempts = max(
        1,
        STRICT_ANALYSIS_MAX_ATTEMPTS if STRICT_LLM_ANALYSIS else max(2, ANALYSIS_LLM_REQUEST_RETRIES),
    )
    last_tokens = 0
    last_batched = False
    last_batch_size = 1
    last_response = ""

    for attempt_idx in range(max_llm_attempts):
        if stop_event and stop_event.is_set():
            return None

        llm_response = request_review_analysis(analysis_payload, stop_event=stop_event)
        last_response = str(llm_response.get("text") or "")
        last_tokens = int(llm_response.get("tokens", 0) or 0)
        last_batched = bool(llm_response.get("batched"))
        last_batch_size = int(llm_response.get("batch_size", 1) or 1)

        if not llm_response.get("ok"):
            reason = str(llm_response.get("fallback_reason") or "llm_empty_response")
            message = str(llm_response.get("error") or "LLM connected but returned an empty or unusable response.")
            telemetry.log_error(
                error_type=reason,
                message=message,
                review_id=review_id,
                raw_response=llm_response.get("raw_response"),
            )
            attempt_errors.append(f"{reason}: {message}")
            continue

        try:
            obj = llm_response.get("parsed")
            if not isinstance(obj, dict):
                obj = parse_llm_json(last_response)
            result = validate_and_repair_json(obj)

            # Merge result with original review data to preserve metadata (ID, Date, Score, etc.)
            full_result = {
                **review_data,
                **map_result_to_schema(result),
                '_meta_tokens': last_tokens,
                '_noise_score': _noise_score,
                '_clean_flags': _adv_flags,
                '_cleaned_text': _cleaned_text,
                '_clean_token_estimate': _clean_token_estimate,
                '_meta_batched': last_batched,
                '_meta_batch_size': last_batch_size,
                '_meta_attempt': attempt_idx + 1,
            }
            if is_duplicate:
                full_result['_meta_duplicate'] = True

            # --- Step 2: Save successful result as Pattern & Context Graph ---
            if ADVANCED_FEATURES_AVAILABLE:
                try:
                    if pattern_matcher:
                        pattern_matcher.save_pattern(content, rating, result, source, vertical)

                    cg_node = ContextGraphBuilder.build_graph_from_llm_result(review_data, result)
                    if cg_node:
                        ContextGraphManager(db_path=DB_PATH).save_decision(cg_node)
                except Exception as e:
                    print(f"Error saving context/patterns: {e}")

            return full_result

        except ValueError as parse_err:
            err_text = str(parse_err)
            log_debug(f"[DEBUG PARSER FATAL ERROR FOR REVIEW {review_id} ATTEMPT {attempt_idx + 1}/{max_llm_attempts}]: {err_text}")
            log_debug(f"[DEBUG PARSER RAW LLM STRING]: {last_response}")
            telemetry.log_error(
                error_type="json_parse_error",
                message=err_text,
                review_id=review_id,
                raw_response=last_response,
            )
            attempt_errors.append(f"json_parse_error: {err_text}")
            continue

        except Exception as e:
            err_text = str(e)
            log_debug(f"[DEBUG GENERIC ERROR FOR REVIEW {review_id} ATTEMPT {attempt_idx + 1}/{max_llm_attempts}]: {err_text}")
            log_debug(f"[DEBUG GENERIC ERROR RAW LLM]: {last_response}")
            telemetry.log_error(
                error_type="worker_generic_error",
                message=err_text,
                review_id=review_id,
                raw_response=last_response,
            )
            attempt_errors.append(f"worker_exception: {err_text}")
            continue

    return _build_unresolved_result(
        review_data,
        reason="llm_exhausted",
        raw_content=raw_content,
        error_detail=" | ".join(attempt_errors[:4]) if attempt_errors else "LLM analysis exhausted all attempts without valid JSON output.",
        noise_score=_noise_score,
        clean_flags=_adv_flags,
        cleaned_text=_cleaned_text,
        clean_token_estimate=_clean_token_estimate,
        tokens=last_tokens,
        batched=last_batched,
        batch_size=last_batch_size,
    )

def map_result_to_schema(result):
    """Ensure result keys match what we expect, just in case."""
    return result

def _run_window(window_reviews, window_idx, global_results, index_map,
                vertical, custom_instructions, stop_event, pause_event,
                pattern_matcher, job_uuid, analysis_mode, on_result=None, on_idle=None):
    """
    Process one context-window-sized batch of reviews concurrently.
    Writes results directly into global_results at the mapped global index.
    Returns the count of successes and errors in this window.
    """
    ollama_url = str(getattr(settings, "OLLAMA_URL", "") or "")
    is_local = "localhost" in ollama_url or "127.0.0.1" in ollama_url
    # MAX_REVIEWS_PER_WINDOW already limits concurrency; mirror it as thread count
    max_workers = min(
        len(window_reviews),
        MAX_REVIEWS_PER_WINDOW,
        LLM_WINDOW_MAX_WORKERS_LOCAL if is_local else LLM_WINDOW_MAX_WORKERS_REMOTE,
    )

    succeeded = 0
    errored = 0

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers)
    future_to_local = {}
    pending = set()
    stop_requested = False
    idle_no_result_seconds = 0
    hard_idle_fallback_seconds = max(WINDOW_IDLE_FALLBACK_SECONDS, ANALYSIS_LLM_TIMEOUT_SECONDS * 3)
    try:
        for local_idx, review in enumerate(window_reviews):
            if stop_event and stop_event.is_set():
                stop_requested = True
                break
            future = executor.submit(
                analyze_single_review_task,
                review, vertical, custom_instructions,
                stop_event, pause_event, pattern_matcher, analysis_mode
            )
            future_to_local[future] = local_idx

        pending = set(future_to_local.keys())
        while pending:
            if stop_event and stop_event.is_set():
                stop_requested = True
                for pending_future in list(pending):
                    pending_future.cancel()
                break

            done, pending = concurrent.futures.wait(
                pending,
                timeout=2.0,
                return_when=concurrent.futures.FIRST_COMPLETED,
            )
            if not done:
                idle_no_result_seconds += 2
                if on_idle:
                    on_idle(window_idx, len(pending))
                # Avoid indefinite "all in-flight, 0 completed" windows when upstream stalls.
                if idle_no_result_seconds >= hard_idle_fallback_seconds:
                    log_debug(
                        f"[WINDOW {window_idx}] No completed futures for "
                        f"{idle_no_result_seconds}s; marking {len(pending)} pending review(s) as unresolved."
                    )
                    stop_requested = True
                    for pending_future in list(pending):
                        local_idx = future_to_local[pending_future]
                        global_idx = index_map[local_idx]
                        original_review = window_reviews[local_idx]
                        unresolved = _build_unresolved_result(
                            original_review,
                            reason='window_hard_timeout',
                            raw_content=str(original_review.get('content', '')),
                            error_detail=(
                                f"No completed worker futures for {idle_no_result_seconds}s "
                                f"(window timeout budget={hard_idle_fallback_seconds}s)."
                            ),
                        )
                        global_results[global_idx] = unresolved
                        if on_result:
                            on_result(global_idx, unresolved, window_idx, local_idx)
                        errored += 1
                        pending_future.cancel()
                    pending.clear()
                    break
                if idle_no_result_seconds % 30 == 0:
                    log_debug(
                        f"[WINDOW {window_idx}] Waiting on {len(pending)} in-flight review(s) "
                        f"for {idle_no_result_seconds}s (hard timeout={hard_idle_fallback_seconds}s)."
                    )
                continue
            idle_no_result_seconds = 0

            for future in done:
                local_idx = future_to_local[future]
                global_idx = index_map[local_idx]
                original_review = window_reviews[local_idx]
                try:
                    res = future.result(timeout=360)
                    if res is None:
                        res = _build_unresolved_result(
                            original_review,
                            reason='empty_worker_result',
                            raw_content=str(original_review.get('content', '')),
                            error_detail="Worker returned no payload.",
                        )
                    global_results[global_idx] = res
                    if on_result:
                        on_result(global_idx, res, window_idx, local_idx)
                    if res.get('_meta_error'):
                        errored += 1
                    else:
                        succeeded += 1
                except concurrent.futures.TimeoutError:
                    log_debug(f"[WINDOW {window_idx}] Task local={local_idx} global={global_idx} timed out")
                    global_results[global_idx] = _build_unresolved_result(
                        original_review,
                        reason='window_timeout',
                        raw_content=str(original_review.get('content', '')),
                        error_detail="Future timed out while waiting for worker result.",
                    )
                    if on_result:
                        on_result(global_idx, global_results[global_idx], window_idx, local_idx)
                    errored += 1
                except Exception as exc:
                    log_debug(f"[WINDOW {window_idx}] Task local={local_idx} exception: {exc}")
                    global_results[global_idx] = _build_unresolved_result(
                        original_review,
                        reason='window_exception',
                        raw_content=str(original_review.get('content', str(exc))),
                        error_detail=str(exc),
                    )
                    if on_result:
                        on_result(global_idx, global_results[global_idx], window_idx, local_idx)
                    errored += 1
                    telemetry.log_error(error_type="window_future_error", message=str(exc), job_uuid=job_uuid)
    finally:
        # Important: when stop is requested, do not block waiting for long-running LLM futures.
        if stop_requested:
            executor.shutdown(wait=False, cancel_futures=True)
        else:
            executor.shutdown(wait=True)

    return succeeded, errored


def run_analysis_batch(reviews_list: List[Dict[str, Any]], vertical: str, custom_instructions: str = None, progress_callback=None, stop_event=None, pause_event=None, analysis_mode: str = "workspace"):
    """
    Context-window-aware batch processor.

    Strategy:
      1. Split reviews into token-budget windows under CONTEXT_REFRESH_TOKENS.
      2. At each window boundary, checkpoint progress and refresh prompt context.
      3. Process each window sequentially; within a window calls run concurrently.
      4. After all windows, retry any _meta_error=True reviews up to
         MAX_RETRY_PASSES additional times using the same windowed approach.
    """
    job_uuid = str(uuid.uuid4())
    start_time = time.time()
    batch_dedup_registry = create_dedup_registry()
    prepared_reviews: List[Dict[str, Any]] = []
    for review in reviews_list:
        prepared_review = dict(review)
        cleaning_options = dict(prepared_review.get('_cleaning_options') or {})
        cleaning_options['dedup_registry'] = batch_dedup_registry
        prepared_review['_cleaning_options'] = cleaning_options
        prepared_reviews.append(prepared_review)

    reviews_list = prepared_reviews
    total = len(reviews_list)

    # Ordered result slots — None means not yet processed
    results = [None] * total
    completed: int = 0
    total_tokens_used: int = 0
    failed_reviews_meta: List[Dict[str, str]] = []  # For UI display
    last_progress_emit_at: float = 0.0
    last_progress_value: int = 15
    progress_emit_every: int = max(1, total // 200) if total else 1

    # PatternMatcher disabled — keeping flag for future re-enable
    pattern_matcher = None
    if False and ADVANCED_FEATURES_AVAILABLE:
        try:
            pattern_matcher = PatternMatcher(db_path=DB_PATH)
        except Exception as e:
            print(f"[ERROR] Failed to init PatternMatcher: {e}")

    if stop_event is None:
        stop_event = threading.Event()

    log_debug(f"run_analysis_batch started for {total} reviews. Vertical: {vertical}")
    print(
        f"[WINDOW] CTX={CTX_WINDOW_TOKENS} tokens | refresh_budget={CONTEXT_REFRESH_TOKENS} "
        f"| est_window_size={MAX_REVIEWS_PER_WINDOW} reviews | total={total}"
    )

    # ── PASS 0: Process all reviews in context-window-sized windows ──────────
    try:
        window_plans = build_token_windows(reviews_list)
        num_windows = len(window_plans)
        context_refreshes = 0
        context_checkpoints: List[Dict[str, Any]] = []
        current_window_progress: Dict[str, Any] = {
            "number": 0,
            "range_start": 0,
            "range_end": 0,
            "estimated_tokens": 0,
        }
        idle_heartbeat_ticks = 0

        def _emit_realtime_progress(
            message: str,
            extra_progress: int = 0,
            pending_reviews: Optional[int] = None,
            force: bool = False,
        ):
            nonlocal last_progress_emit_at, last_progress_value
            if not progress_callback:
                return
            now = time.time()
            pending_count = max(
                0,
                int(
                    pending_reviews
                    if pending_reviews is not None
                    else max(0, total - completed)
                ),
            )
            should_emit = (
                force
                or completed == 1
                or completed == total
                or completed % progress_emit_every == 0
                or (now - last_progress_emit_at) >= 0.8
            )
            if not should_emit:
                return
            checkpoint = {
                "window": current_window_progress["number"],
                "range_start": current_window_progress["range_start"],
                "range_end": current_window_progress["range_end"],
                "processed_reviews": completed,
                "estimated_tokens": current_window_progress["estimated_tokens"],
                "context_refreshes": context_refreshes,
            }
            analyzed_so_far = completed
            dropped_so_far = max(0, total - analyzed_so_far) if total else 0
            coverage_so_far = round((analyzed_so_far / max(total, 1)) * 100, 2)
            base_progress = 15 + int((analyzed_so_far / max(total, 1)) * 70)
            idle_bonus = max(0, int(extra_progress or 0))
            if analyzed_so_far == 0 and pending_count > 0:
                # Let the UI show bounded liveness before the first completion lands.
                effective_progress = 15 + min(7, max(1, idle_bonus or 1))
            else:
                effective_progress = base_progress + idle_bonus
            effective_progress = min(84, max(last_progress_value, effective_progress))
            progress_callback(
                effective_progress,
                message,
                meta={
                    "tokens": total_tokens_used,
                    "failed_reviews": failed_reviews_meta[-200:],
                    "processed_reviews": analyzed_so_far,
                    "total_reviews": total,
                    "fetched_reviews": total,
                    "analyzed_reviews": analyzed_so_far,
                    "fallback_reviews": sum(1 for r in results if r and r.get('_meta_fallback')),
                    "unresolved_reviews": sum(1 for r in results if r and r.get('_meta_error')),
                    "dropped_reviews": dropped_so_far,
                    "in_flight_reviews": pending_count,
                    "coverage_pct": coverage_so_far,
                    "context_refreshes": context_refreshes,
                    "context_window_budget_tokens": CONTEXT_REFRESH_TOKENS,
                    "context_checkpoint": checkpoint,
                }
            )
            last_progress_emit_at = now
            last_progress_value = effective_progress

        def _on_window_result(global_idx: int, res: Dict[str, Any], _window_idx: Any, _local_idx: int):
            nonlocal completed, total_tokens_used, idle_heartbeat_ticks
            completed += 1
            idle_heartbeat_ticks = 0
            total_tokens_used += int(res.get('_meta_tokens', 0) or 0)
            if res.get('_meta_error'):
                failed_reviews_meta.append({
                    "id": str(res.get("review_id", res.get("id", "Unknown"))),
                    "text": str(res.get("_meta_raw_content", "")),
                })
            _emit_realtime_progress(
                f"Processed {completed}/{total} reviews "
                f"(window {current_window_progress['number']}/{num_windows}, refreshes={context_refreshes})..."
            )

        def _on_window_idle(window_number: int, pending_count: int):
            nonlocal idle_heartbeat_ticks
            idle_heartbeat_ticks += 1
            idle_bonus = min(7, max(1, idle_heartbeat_ticks // 2 + 1))
            _emit_realtime_progress(
                f"Running analysis on window {window_number}/{num_windows}... "
                f"{pending_count} reviews in-flight, {completed}/{total} completed.",
                extra_progress=idle_bonus,
                pending_reviews=pending_count,
            )

        for win_idx, window_plan in enumerate(window_plans):
            if stop_event.is_set():
                break

            # Build local→global index map for this window
            window_indices = window_plan["indices"]
            window = [reviews_list[idx] for idx in window_indices]
            index_map = {local: global_idx for local, global_idx in enumerate(window_indices)}
            global_start = window_indices[0]
            global_end = window_indices[-1]
            window_est_tokens = int(window_plan.get("estimated_tokens", 0))
            current_window_progress["number"] = win_idx + 1
            current_window_progress["range_start"] = global_start
            current_window_progress["range_end"] = global_end
            current_window_progress["estimated_tokens"] = window_est_tokens
            if win_idx > 0:
                context_refreshes += 1

            print(
                f"[WINDOW {win_idx + 1}/{num_windows}] Processing {len(window)} reviews "
                f"(global {global_start}-{global_end}, est_tokens={window_est_tokens}/{CONTEXT_REFRESH_TOKENS})..."
            )
            _emit_realtime_progress(
                f"Dispatching window {win_idx + 1}/{num_windows} "
                f"({len(window)} reviews) to analysis workers...",
                extra_progress=1,
                pending_reviews=len(window),
                force=True,
            )
            succeeded_win, errored_win = _run_window(
                window, win_idx + 1, results, index_map,
                vertical, custom_instructions, stop_event, pause_event,
                pattern_matcher, job_uuid, analysis_mode, on_result=_on_window_result, on_idle=_on_window_idle
            )

            context_checkpoint = {
                "window": win_idx + 1,
                "range_start": global_start,
                "range_end": global_end,
                "processed_reviews": completed,
                "estimated_tokens": window_est_tokens,
                "context_refreshes": context_refreshes,
            }
            context_checkpoints.append(context_checkpoint)

            print(
                f"[WINDOW {win_idx + 1}/{num_windows}] Done - ok={succeeded_win} err={errored_win}; "
                f"context_refreshes={context_refreshes}"
            )

            # Incremental progress update
            if progress_callback:
                # Reserve 0–85% for analysis; last 15% for analytics/DB
                pct = 15 + int((completed / max(total, 1)) * 70)
                dropped_so_far = max(0, total - completed) if total else 0
                coverage_so_far = round((completed / max(total, 1)) * 100, 2)
                progress_callback(
                    pct,
                    f"Processed {completed}/{total} reviews (window {win_idx + 1}/{num_windows}, refreshes={context_refreshes})...",
                    meta={
                        "tokens": total_tokens_used,
                        "failed_reviews": failed_reviews_meta[-200:],
                        "processed_reviews": completed,
                        "total_reviews": total,
                        "fetched_reviews": total,
                        "analyzed_reviews": completed,
                        "fallback_reviews": sum(1 for r in results if r and r.get('_meta_fallback')),
                        "unresolved_reviews": sum(1 for r in results if r and r.get('_meta_error')),
                        "dropped_reviews": dropped_so_far,
                        "in_flight_reviews": 0,
                        "coverage_pct": coverage_so_far,
                        "context_refreshes": context_refreshes,
                        "context_window_budget_tokens": CONTEXT_REFRESH_TOKENS,
                        "context_checkpoint": context_checkpoint,
                    }
                )

        # ── RETRY PASSES: re-analyze any reviews that errored ─────────────────
        for retry_pass in range(1, MAX_RETRY_PASSES + 1):
            if stop_event.is_set():
                break

            # Collect indices of errored results
            error_indices = [
                i for i, r in enumerate(results)
                if r is not None and r.get('_meta_error')
            ]

            if not error_indices:
                logger.info(f"Pass {retry_pass}: No failed reviews — all clean.")
                break

            logger.info(f"Pass {retry_pass}/{MAX_RETRY_PASSES}: "
                  f"Retrying {len(error_indices)} failed review(s)...")

            retry_dedup_registry = create_dedup_registry()
            retry_reviews = []
            for i in error_indices:
                retry_review = dict(reviews_list[i])
                retry_cleaning_options = dict(retry_review.get('_cleaning_options') or {})
                retry_cleaning_options['dedup_registry'] = retry_dedup_registry
                retry_review['_cleaning_options'] = retry_cleaning_options
                retry_reviews.append(retry_review)
            retry_results_tmp = [None] * len(retry_reviews)

            # Process retry batch in token windows too
            retry_window_plans = build_token_windows(retry_reviews)
            for rw_idx, rw_plan in enumerate(retry_window_plans):
                if stop_event.is_set():
                    break
                rw_indices = rw_plan["indices"]
                rw = [retry_reviews[idx] for idx in rw_indices]
                rw_index_map = {local: retry_local_idx for local, retry_local_idx in enumerate(rw_indices)}
                succeeded_retry, errored_retry = _run_window(
                    rw, f"retry-{retry_pass}-{rw_idx + 1}", retry_results_tmp,
                    rw_index_map, vertical, custom_instructions,
                    stop_event, pause_event, pattern_matcher, job_uuid, analysis_mode
                )

            # Merge retry results back into main results
            newly_fixed = 0
            for local_idx, global_idx in enumerate(error_indices):
                if retry_results_tmp[local_idx] is not None:
                    retry_res = retry_results_tmp[local_idx]
                    results[global_idx] = retry_res
                    if not retry_res.get('_meta_error'):
                        newly_fixed += 1
                        total_tokens_used += retry_res.get('_meta_tokens', 0)

            print(f"[RETRY] Pass {retry_pass} complete — fixed {newly_fixed}/{len(error_indices)}")

        # ── Final failed_reviews_meta rebuild after retries ───────────────────
        # Safety net: ensure every non-stopped review has an analysis object.
        if not (stop_event and stop_event.is_set()):
            for idx, row in enumerate(results):
                if row is not None:
                    continue
                source_review = reviews_list[idx]
                source_text = (
                    source_review.get('content')
                    or source_review.get('text')
                    or source_review.get('body')
                    or source_review.get('review')
                    or ''
                )
                unresolved = _build_unresolved_result(
                    source_review,
                    reason='missing_result_slot',
                    raw_content=str(source_text),
                    error_detail="Result slot remained empty after retries.",
                )
                results[idx] = unresolved
                telemetry.log_error(
                    error_type="missing_result_slot",
                    message=f"Marked unresolved result slot for review index {idx}",
                    review_id=source_review.get('id', source_review.get('review_id', 'Unknown')),
                    job_uuid=job_uuid,
                )

        failed_reviews_meta = [
            {
                "id": r.get("review_id", r.get("id", "Unknown")),
                "text": r.get("_meta_raw_content", "")
            }
            for r in results if r and r.get('_meta_error')
        ]

        analyzed_count = sum(1 for r in results if r is not None)
        fallback_count = sum(1 for r in results if r and r.get('_meta_fallback'))
        unresolved_count = len(failed_reviews_meta)
        dropped_count = max(0, total - analyzed_count)
        coverage_pct = round((analyzed_count / max(total, 1)) * 100, 2)
        summary_text = (
            f"Analysis summary: fetched={total}, analyzed={analyzed_count}, "
            f"fallback={fallback_count}, unresolved={unresolved_count}, "
            f"dropped={dropped_count}, coverage={coverage_pct}%"
        )
        print(f"[SUMMARY] {summary_text}")
        logger.info(summary_text)

        if progress_callback:
            progress_callback(
                85,
                summary_text,
                meta={
                    "tokens": total_tokens_used,
                    "failed_reviews": failed_reviews_meta,
                    "processed_reviews": analyzed_count,
                    "total_reviews": total,
                    "fetched_reviews": total,
                    "analyzed_reviews": analyzed_count,
                    "fallback_reviews": fallback_count,
                    "unresolved_reviews": unresolved_count,
                    "dropped_reviews": dropped_count,
                    "in_flight_reviews": 0,
                    "coverage_pct": coverage_pct,
                    "analysis_summary": summary_text,
                    "context_refreshes": context_refreshes,
                    "context_window_budget_tokens": CONTEXT_REFRESH_TOKENS,
                    "context_checkpoint": context_checkpoints[-1] if context_checkpoints else None,
                }
            )

        elapsed_time = time.time() - start_time
        telemetry.log_analysis_job(
            job_uuid=job_uuid,
            user_id="default_user",
            total_reviews=total,
            successful=analyzed_count,
            failed=dropped_count,
            time_seconds=elapsed_time,
            vertical=vertical
        )

        log_debug("Windowed analysis batch complete.")
        return [r for r in results if r is not None]

    except Exception as e:
        print(f"Fatal error in run_analysis_batch: {e}")
        telemetry.log_error(error_type="batch_fatal_error", message=str(e), job_uuid=job_uuid)
        stop_event.set()

    return [r for r in results if r is not None]

# --- Metric Helpers ---

# --- Churn probability map (used by RAR and impact scoring) ---
CHURN_PROB_MAP = {'high': 0.80, 'medium': 0.35, 'low': 0.05, 'null': 0.01}

# Common stopwords to ignore when measuring theme overlap
_STOPWORDS = {'the','a','an','is','in','on','at','of','to','for','and','or','not','no',
              'with','my','its','it','this','that','was','be','are','i','we','they','has',
              'have','had','been','will','can','cant','wont','do','does','did','up','out'}

def _theme_similarity(a: str, b: str) -> float:
    """
    Combined similarity score between two short issue phrases:
      1. Jaccard over ALL tokens (0..1)
      2. Shared-noun-token bonus: if they share at least one meaningful content token
         (non-stopword), boost the score so short phrases cluster correctly.
    Returns the higher of Jaccard or the content-token overlap score.
    Final threshold for grouping: >= 0.30
    """
    ta = set(a.lower().split())
    tb = set(b.lower().split())
    if not ta or not tb:
        return 0.0

    # Standard Jaccard
    jaccard = len(ta & tb) / len(ta | tb)

    # Content-token overlap (stopwords excluded)
    ca = ta - _STOPWORDS
    cb = tb - _STOPWORDS
    if ca and cb:
        shared_content = len(ca & cb)
        total_content = len(ca | cb)
        # If at least 1 content token shared AND it covers most of the shorter set
        min_content = min(len(ca), len(cb))
        if shared_content > 0:
            content_score = shared_content / max(total_content, 1)
            # Strong signal: shared token covers >=50% of the smaller phrase
            if shared_content / max(min_content, 1) >= 0.50:
                content_score = max(content_score, 0.40)  # force above threshold
            return max(jaccard, content_score)

    return jaccard


def normalize_themes(issues: list, similarity_threshold: float = 0.30) -> dict:
    """
    Fuzzy-dedup a list of short issue/theme strings into canonical cluster labels.
    Groups near-duplicates (e.g. 'login problem', 'login failure', 'cant login')
    into a single canonical label (the most frequent member).

    Returns:
        dict mapping original_issue -> canonical_label
    Uses combined token-overlap similarity — zero new dependencies.
    Threshold 0.30 = >=30% shared content to be considered the same theme.
    """
    if not issues:
        return {}

    from collections import Counter
    issue_counts = Counter(issues)
    unique = list(issue_counts.keys())

    clusters: list = []
    assigned: set = set()

    for issue in unique:
        if issue in assigned:
            continue
        cluster = [issue]
        assigned.add(issue)
        for other in unique:
            if other in assigned:
                continue
            if _theme_similarity(issue, other) >= similarity_threshold:
                cluster.append(other)
                assigned.add(other)
        clusters.append(cluster)

    mapping: dict = {}
    for cluster in clusters:
        # Canonical = the most frequently mentioned member
        canonical = max(cluster, key=lambda x: issue_counts.get(x, 0))
        # Capitalise nicely
        canonical = canonical.strip().capitalize()
        for member in cluster:
            mapping[member] = canonical
    return mapping


def build_theme_hierarchy(df: pd.DataFrame) -> dict:
    """
    Two-level theme hierarchy:
        macro_category (pain_point_category)
          └─ sub_issues  [{label, mentions, sentiment, churn_probability, impact_score, confidence}]

    - impact_score  = mentions × |avg_sentiment_strength| × avg_churn_probability
    - confidence    = cluster_density × |avg_sentiment_strength|
                      where cluster_density = mentions / total_in_macro
    """
    if df.empty or 'pain_point_category' not in df.columns:
        return {}

    hierarchy: dict = {}
    total = len(df)

    for macro, grp in df.groupby('pain_point_category'):
        if macro in ['N/A', 'None', '', None]:
            continue

        macro_total = len(grp)

        # Collect raw issues within this macro category
        raw_issues = []
        if 'issue' in grp.columns:
            raw_issues = [
                str(i) for i in grp['issue'].dropna()
                if str(i).strip().lower() not in ('n/a', 'none', 'null', '', 'no major issues reported')
            ]

        if not raw_issues:
            hierarchy[str(macro)] = []
            continue

        canon_map = normalize_themes(raw_issues)

        # Build per-canonical aggregates
        sub_data: dict[str, dict] = {}
        for _, row in grp.iterrows():
            raw_issue = str(row.get('issue', '')).strip()
            if raw_issue.lower() in ('n/a', 'none', 'null', '', 'no major issues reported'):
                continue
            canonical = canon_map.get(raw_issue, raw_issue.capitalize())

            churn = str(row.get('churn_risk', 'low')).lower()
            churn_p = CHURN_PROB_MAP.get(churn, 0.05)
            sent = safe_num(row.get('sentiment_score', 0.0))
            sev = compute_issue_severity(dict(row))

            if canonical not in sub_data:
                sub_data[canonical] = {'mentions': 0, 'sentiments': [], 'churn_probs': [], 'severities': []}
            sub_data[canonical]['mentions'] += 1
            sub_data[canonical]['sentiments'].append(sent)
            sub_data[canonical]['churn_probs'].append(churn_p)
            sub_data[canonical]['severities'].append(sev)

        sub_issues = []
        for label, agg in sub_data.items():
            mentions   = agg['mentions']
            avg_sent   = sum(agg['sentiments'])  / max(len(agg['sentiments']), 1)
            avg_churn_p= sum(agg['churn_probs']) / max(len(agg['churn_probs']), 1)
            cluster_density = mentions / max(macro_total, 1)
            max_severity    = max(agg.get('severities', [2]))

            impact_score = round(mentions * abs(avg_sent) * avg_churn_p, 4)
            confidence   = round(min(cluster_density * abs(avg_sent) * 2, 1.0), 3)

            sub_issues.append({
                'label':               label,
                'mentions':            mentions,
                'pct_of_total':        round(mentions / total * 100, 1),
                'avg_sentiment':       round(avg_sent, 3),
                'avg_churn_probability': round(avg_churn_p, 3),
                'impact_score':        impact_score,
                'confidence':          confidence,
                'severity':            max_severity,
            })

        sub_issues.sort(key=lambda x: x['impact_score'], reverse=True)
        hierarchy[str(macro)] = sub_issues

    return hierarchy


def safe_num(val, default=0):
    """Convert any value to a safe finite float/int. Returns default for NaN/None/inf."""
    try:
        v = float(val)
        return default if (v != v or v == float('inf') or v == float('-inf')) else v
    except (TypeError, ValueError):
        return default


def compute_issue_severity(row: dict) -> int:
    """
    Returns severity level 1-5 for a single review/issue:
      5 = Product unusable  (negative + high churn + High urgency)
      4 = Core feature broken (negative + high churn)
      3 = Major friction     (negative + medium churn)
      2 = Minor issue        (neutral/negative + low churn)
      1 = Positive / strength
    """
    sentiment  = str(row.get('sentiment', '')).lower()
    churn      = str(row.get('churn_risk', 'low')).lower()
    urgency    = str(row.get('urgency', 'None')).lower()
    sent_score = safe_num(row.get('sentiment_score', 0.0))

    if sentiment == 'positive' or sent_score > 0.2:
        return 1
    if churn == 'high':
        return 5 if urgency == 'high' else 4
    if churn == 'medium':
        return 3
    return 2


def calculate_nps(df):
    if df.empty or 'sentiment_score' not in df.columns: return 0
    scores = pd.to_numeric(df['sentiment_score'], errors='coerce').fillna(0)
    promoters  = (scores > 0.5).sum()
    detractors = (scores < -0.5).sum()
    total = max(len(scores), 1)
    return int(round((promoters - detractors) / total * 100))

# --- Advanced Analytics (Ported from W4.py Modules) ---

def calculate_revenue_at_risk(
    df: pd.DataFrame,
    arpu: float = 50.0,
    time_horizon: str = '30d',
    vertical: str = 'generic'
) -> Dict:
    """
    Revenue at Risk = users_at_risk × ARPU × churn_probability.
    Churn probabilities per tier (empirically calibrated):
        high   = 0.80 (very likely to churn)
        medium = 0.35 (uncertain)
        low    = 0.05 (unlikely)
    Revenue label adapts to industry vertical.
    """
    if df.empty or 'churn_risk' not in df.columns:
        return {'total_revenue_at_risk': 0, 'high_risk_revenue': 0, 'affected_users': 0, 'revenue_label': 'Revenue at Risk'}
    
    CHURN_PROB = {'high': 0.80, 'medium': 0.35, 'low': 0.05}
    
    # Vertical-specific revenue label
    revenue_labels = {
        'saas': 'MRR Impact',
        'subscription': 'Subscription Revenue at Risk',
        'telecom': 'Monthly Plan Revenue at Risk',
        'insurance': 'Premium Renewal Revenue at Risk',
        'mobile_app': 'Subscription Revenue at Risk',
        'food_delivery': 'Order Revenue at Risk',
        'ecommerce': 'GMV at Risk',
        'financial_services': 'Account Revenue at Risk',
        'd2c': 'Repeat Purchase Revenue at Risk',
        'generic': 'Revenue at Risk'
    }
    revenue_label = revenue_labels.get(vertical, 'Revenue at Risk')
    
    horizon_map = {'30d': 1, '90d': 3, '180d': 6, '365d': 12}
    months = horizon_map.get(time_horizon, 1)
    
    counts = df['churn_risk'].str.lower().value_counts()
    high   = int(counts.get('high', 0))
    medium = int(counts.get('medium', 0))
    low    = int(counts.get('low', 0))
    
    # Revenue at Risk = users × ARPU × churn_probability × months
    high_rev = high   * arpu * CHURN_PROB['high']   * months
    med_rev  = medium * arpu * CHURN_PROB['medium']  * months
    low_rev  = low    * arpu * CHURN_PROB['low']    * months
    
    total = high_rev + med_rev + low_rev
    
    return {
        'total_revenue_at_risk': round(total, 2),
        'high_risk_revenue': round(high_rev, 2),
        'medium_risk_revenue': round(med_rev, 2),
        'low_risk_revenue': round(low_rev, 2),
        'affected_users': {
            'high': high,
            'medium': medium,
            'low': low
        },
        'churn_probabilities': CHURN_PROB,
        'revenue_label': revenue_label
    }

def calculate_sentiment_velocity(
    df: pd.DataFrame,
    topic_column: str = 'pain_point_category',
    date_column: str = 'at'
) -> List[Dict]:
    """Detects surging/trending topics over a 7-day window."""
    if df.empty or date_column not in df.columns:
        return []
    
    df[date_column] = pd.to_datetime(df[date_column])
    cutoff = datetime.now() - timedelta(days=7)
    
    # Group by topic and count recent vs historical
    recent = df[df[date_column] >= cutoff][topic_column].value_counts()
    historical = df[df[date_column] < cutoff][topic_column].value_counts()
    
    velocity_results = []
    all_topics = set(recent.index) | set(historical.index)
    
    for topic in all_topics:
        if topic in ['Other', 'N/A', None]: continue
        r_count = recent.get(topic, 0)
        h_count = historical.get(topic, 0)
        
        # Simple velocity calculation
        pct_change = ((r_count - h_count) / h_count * 100) if h_count > 0 else 100 if r_count > 0 else 0
        
        if r_count > 2: # Min threshold for trending
            velocity_results.append({
                "topic": topic,
                "recent_mentions": int(r_count),
                "percent_change": round(pct_change, 1),
                "is_trending": pct_change > 50
            })
    
    return sorted(velocity_results, key=lambda x: x['percent_change'], reverse=True)

def calculate_rating_drag(
    df: pd.DataFrame,
    topic_column: str = 'pain_point_category',
    rating_column: str = 'score'
) -> List[Dict]:
    """Calculates star rating impact for each topic."""
    if df.empty or rating_column not in df.columns:
        return []
        
    results = []
    overall_avg = df[rating_column].mean()
    
    for topic in df[topic_column].unique():
        if topic in ['Other', 'N/A', None]: continue
        topic_df = df[df[topic_column] == topic]
        if len(topic_df) < 3: continue
        
        topic_avg = topic_df[rating_column].mean()
        drag = topic_avg - overall_avg
        
        results.append({
            "topic": topic,
            "impact": round(drag, 2),
            "severity": "Severe" if drag < -1.0 else "High" if drag < -0.5 else "Moderate"
        })
        
    return sorted(results, key=lambda x: x['impact'])

def get_thematic_aggregates(df: pd.DataFrame) -> Dict:
    """Aggregates pain points, issues, and feature requests by category."""
    if df.empty:
        return {"pain_points": {}, "top_issues": [], "top_features": []}
    
    total = len(df)
    
    # Pain point distribution
    pain_points = {}
    if 'pain_point_category' in df.columns:
        pp_counts = df['pain_point_category'].value_counts()
        for cat, count in pp_counts.items():
            pain_points[cat] = {
                "count": int(count),
                "share": round(int(count) / total * 100, 1)
            }
    
    # Top issues
    top_issues = []
    if 'issue' in df.columns:
        issue_counts = df['issue'].value_counts().head(10)
        for issue, count in issue_counts.items():
            if issue in ['N/A', 'None', '', 'null', None]: continue
            top_issues.append({
                "name": issue, 
                "count": int(count),
                "share": round(int(count) / total * 100, 1)
            })
    
    # Top feature requests
    top_features = []
    if 'feature_request' in df.columns:
        feat_counts = df['feature_request'].value_counts().head(5)
        for feat, count in feat_counts.items():
            if feat in ['N/A', 'None', '', 'null', None]: continue
            top_features.append({
                "name": feat, 
                "count": int(count),
                "share": round(int(count) / total * 100, 1)
            })
    
    # Churn reasons: WHY customers are churning (root_cause for high/medium churn risk)
    churn_reasons = []
    if 'root_cause' in df.columns and 'churn_risk' in df.columns:
        churn_df = df[df['churn_risk'].str.lower().isin(['high', 'medium'])]
        if not churn_df.empty:
            rc_counts = churn_df['root_cause'].value_counts().head(10)
            for reason, count in rc_counts.items():
                if reason in ['N/A', 'None', '', 'null', None, 'n/a', 'none']: continue
                churn_reasons.append({
                    "reason": reason,
                    "count": int(count),
                    "share": round(int(count) / max(len(churn_df), 1) * 100, 1)
                })
    
    # Cancellation signals: reviews mentioning cancel/leave/switch/unsubscribe
    cancel_keywords = ['cancel', 'unsubscribe', 'leaving', 'switch', 'quit', 'stop using', 'delete account', 'refund']
    cancellation_signals = []
    if 'content' in df.columns:
        for kw in cancel_keywords:
            matches = df[df['content'].str.contains(kw, case=False, na=False)]
            if len(matches) > 0:
                # Get the root causes for these cancellation mentions
                if 'root_cause' in matches.columns:
                    reasons = matches['root_cause'].value_counts().head(3)
                    for reason, count in reasons.items():
                        if reason in ['N/A', 'None', '', 'null', None]: continue
                        cancellation_signals.append({
                            "trigger": kw,
                            "reason": reason,
                            "count": int(count)
                        })
    
    # Deduplicate cancellation signals by reason
    seen_reasons = set()
    unique_cancellations = []
    for sig in cancellation_signals:
        if sig['reason'] not in seen_reasons:
            seen_reasons.add(sig['reason'])
            unique_cancellations.append(sig)
    
    # --- Theme Hierarchy: two-level macro → sub-issue tree ---
    theme_hierarchy = build_theme_hierarchy(df)

    return {
        "pain_points": pain_points,
        "top_issues": top_issues,
        "top_features": top_features,
        "churn_reasons": churn_reasons,
        "cancellation_signals": unique_cancellations,
        "theme_hierarchy": theme_hierarchy,
    }

def get_decision_intelligence(df: pd.DataFrame, vertical: str = "generic") -> Dict:
    """Decision engine to identify the #1 issue to fix, using LLM for synthesis."""
    if df.empty: return {"primary_fix": "No data"}
    
    # Get sector-specific terminology
    terminology = VERTICAL_TERMINOLOGY.get(vertical, VERTICAL_TERMINOLOGY.get("generic", {}))
    churn_label = terminology.get('churn_label', 'Churn Risk')
    pain_label = terminology.get('pain_point_label', 'Failure Surface')
    
    # 1. Heuristic Fallback Calculation (Pre-calculated)
    high_churn_df = df[df['churn_risk'].str.lower() == 'high']
    if high_churn_df.empty:
        fallback_issue = df['issue'].mode()[0] if not df['issue'].mode().empty else "General UX"
    else:
        fallback_issue = high_churn_df['issue'].mode()[0]
    fallback_category = df[df['issue'] == fallback_issue]['pain_point_category'].iloc[0] if fallback_issue in df['issue'].values else "Other"
    
    # 2. LLM Synthesis
    try:
        # Prepare Context
        issue_counts = df['issue'].value_counts().head(5)
        if issue_counts.empty: return {"primary_fix": "No Data"}
        
        context_text = ""
        for issue, count in issue_counts.items():
            if issue.lower() in ['n/a', 'none', 'unknown']: continue
            # Get samples
            samples = df[df['issue'] == issue]['content'].head(2).tolist()
            sample_text = " | ".join([s[:60]+"..." for s in samples])
            context_text += f"- {pain_label}: '{issue}' ({count} occurrences). Sample: {sample_text}\n"
            
        if not context_text: raise ValueError("No valid issues to analyze")

        prompt = f"""
        Analyze these top user complaints and {pain_label}s in the {vertical.upper()} industry:
        {context_text}

        TASK: Synthesize the separate issues into ONE single "Primary Insight" that represents the biggest business risk.
        Focus on identifying the "burning platform" that is causing {churn_label}.
        
        CRITICAL INSTRUCTION: You MUST output ONLY valid JSON. Do not include ANY conversational text, preambles, or markdown formatting. Start your response immediately with the opening brace {{.
        
        OUTPUT FORMAT (JSON ONLY):
        {{
            "primary_fix": "A punchy, 2-4 word headline (e.g. 'Fix Broken Login', 'Reduce App Bloat')",
            "category": "Category name (Billing, Feature, UX, Bug, Support, Value)",
            "rationale": "A single, data-backed sentence explaining the impact on {vertical.upper()} metrics (e.g. 'Login failures are driving high {churn_label} among new users.')"
        }}
        """
        
        # Call LLM (using the global query_ollama) with increased token limit to ensure it completes
        response = query_ollama(prompt, num_predict=400)
        
        if response:
            try:
                obj = parse_llm_json(response)
                return {
                    "primary_fix": obj.get('primary_fix', fallback_issue),
                    "category": obj.get('category', fallback_category),
                    "rationale": obj.get('rationale', f"High impact issue affecting multiple users."),
                    "expected_nps_lift": "+15 points" # Estimate
                }
            except Exception as parse_e:
                print(f"[WARNING] Decision Engine JSON parse failed: {parse_e}")
                
    except Exception as e:
        print(f"[WARNING] LLM Decision Engine failed: {e}. Using heuristic.")
        
    # Fallback Return
    return {
        "primary_fix": fallback_issue,
        "category": fallback_category,
        "rationale": f"Affects {len(df[df['issue'] == fallback_issue])} users with high churn correlation.",
        "expected_nps_lift": "+12 points"
    }

def fix_now_prioritization(df: pd.DataFrame, vertical: str = "generic") -> List[Dict]:
    """
    Fix-Now Prioritization Engine.
    Ranks issues by impact_score = mentions × |avg_sentiment_strength| × avg_churn_probability.
    This ties all three business signals together cleanly:
      - volume (mentions) captures breadth
      - |sentiment_strength| captures severity
      - avg_churn_probability captures retention risk
    Confidence = cluster_density × |sentiment_strength| (how reliable the signal is).
    Revenue-sensitive issues get a 1.5× multiplier.
    """
    if df.empty or 'issue' not in df.columns:
        return []

    total = len(df)

    # First pass: normalize issue strings so near-duplicates group together
    raw_issues = [
        str(i) for i in df['issue'].dropna()
        if str(i).strip().lower() not in ('n/a', 'none', 'null', '', 'no major issues reported')
    ]
    canon_map = normalize_themes(raw_issues) if raw_issues else {}

    # Map each row to its canonical issue label
    df = df.copy()
    df['_canonical_issue'] = df['issue'].apply(
        lambda x: canon_map.get(str(x), str(x).capitalize()) if pd.notna(x) else None
    )

    scored_issues = []
    for issue_name, group in df.groupby('_canonical_issue'):
        if not issue_name or str(issue_name).lower() in ('n/a', 'none', 'null', 'no major issues reported', 'none'):
            continue
        if len(group) < 2:  # Skip one-off mentions
            continue

        volume = len(group)

        # Average sentiment strength (negative reviews pull this |higher|)
        avg_sentiment = 0.0
        if 'sentiment_score' in group.columns:
            avg_sentiment = float(group['sentiment_score'].mean())
        sentiment_strength = abs(avg_sentiment)  # 0=no signal, 1=very clear signal

        # Average churn probability (weighted from tier)
        avg_churn_p = 0.05
        if 'churn_risk' in group.columns:
            churn_probs = group['churn_risk'].str.lower().map(
                lambda r: CHURN_PROB_MAP.get(r, 0.05)
            )
            avg_churn_p = float(churn_probs.mean())

        # Revenue sensitivity multiplier
        rev_multiplier = 1.0
        if 'revenue_sensitivity' in group.columns:
            rev_sensitive_pct = group['revenue_sensitivity'].sum() / max(len(group), 1)
            if rev_sensitive_pct > 0.3:
                rev_multiplier = 1.5

        # Core impact score: mentions × |sentiment| × churn_probability
        impact_score = round(volume * sentiment_strength * avg_churn_p * rev_multiplier, 4)

        # Confidence: cluster_density × sentiment_strength (how reliable the signal is)
        cluster_density = volume / max(total, 1)
        confidence = round(min(cluster_density * sentiment_strength * 2, 1.0), 3)

        # Recent growth trend (bonus flag)
        is_trending = False
        if 'at' in df.columns:
            try:
                dates = pd.to_datetime(group['at'], errors='coerce').dropna()
                if len(dates) > 0:
                    cutoff = datetime.now() - timedelta(days=7)
                    recent = (dates >= cutoff).sum()
                    older = (dates < cutoff).sum()
                    if older > 0 and recent > older * 1.5:
                        is_trending = True
            except Exception:
                pass

        # Get pain point category
        category = "Other"
        if 'pain_point_category' in group.columns:
            mode_val = group['pain_point_category'].mode()
            if not mode_val.empty:
                category = mode_val.iloc[0]

        # High churn % (for display)
        high_churn_count = 0
        if 'churn_risk' in group.columns:
            high_churn_count = (group['churn_risk'].str.lower() == 'high').sum()
        high_churn_pct = round((high_churn_count / max(len(group), 1)) * 100, 1)

        scored_issues.append({
            "issue": str(issue_name),
            "category": str(category),
            "volume": int(volume),
            "volume_pct": round(volume / total * 100, 1),
            "high_churn_pct": high_churn_pct,
            "avg_sentiment": round(avg_sentiment, 3),
            "avg_churn_probability": round(avg_churn_p, 3),
            "revenue_sensitive": rev_multiplier > 1.0,
            "impact_score": impact_score,
            "confidence": confidence,
            "is_trending": is_trending,
            "priority_rank": 0
        })

    # Sort by impact score descending, take top 5
    scored_issues.sort(key=lambda x: float(x.get('impact_score', 0)), reverse=True)
    top_issues = scored_issues[:5]

    for i, item in enumerate(top_issues):
        item['priority_rank'] = i + 1

    return top_issues


def calculate_weekly_trends(df: pd.DataFrame) -> List[Dict]:
    """
    Sentiment & Retention Trend — Weekly Aggregation.
    Pure aggregation, no LLM.
    Returns: avg sentiment, % high-risk reviews, total volume per week.
    """
    if df.empty:
        return []
    
    # Ensure we have a date column
    date_col = None
    for col in ['at', 'date', 'timestamp']:
        if col in df.columns:
            date_col = col
            break
    
    if not date_col:
        return []
    
    try:
        df_copy = df.copy()
        df_copy['_date'] = pd.to_datetime(df_copy[date_col], errors='coerce')
        df_copy = df_copy.dropna(subset=['_date'])
        
        if df_copy.empty:
            return []
        
        # Create week bins
        df_copy['_week'] = df_copy['_date'].dt.to_period('W').apply(lambda r: r.start_time)
        
        weekly_data = []
        for week, group in df_copy.groupby('_week'):
            week_entry = {
                "week": week.strftime('%Y-%m-%d'),
                "total_reviews": len(group),
            }
            
            # Avg sentiment
            if 'sentiment_score' in group.columns:
                week_entry["avg_sentiment"] = round(group['sentiment_score'].mean(), 3)
            else:
                week_entry["avg_sentiment"] = 0.0
            
            # % high-risk reviews
            if 'churn_risk' in group.columns:
                high_risk = (group['churn_risk'].str.lower() == 'high').sum()
                week_entry["high_risk_pct"] = round(high_risk / max(len(group), 1) * 100, 1)
            else:
                week_entry["high_risk_pct"] = 0.0
            
            # % billing-related (revenue_sensitivity)
            if 'revenue_sensitivity' in group.columns:
                billing = group['revenue_sensitivity'].sum()
                week_entry["billing_pct"] = round(billing / max(len(group), 1) * 100, 1)
            else:
                week_entry["billing_pct"] = 0.0
            
            weekly_data.append(week_entry)
        
        # Sort by week
        weekly_data.sort(key=lambda x: x['week'])
        
        return weekly_data
    
    except Exception as e:
        print(f"[WARNING] calculate_weekly_trends error: {e}")
        return []


def generate_recommendations(fix_now: List[Dict], total_reviews: int, rev_at_risk: float) -> List[Dict]:
    """
    Structured Rule-Based Strategy Engine.
    Converts top 3 Fix-Now priorities into actionable strategic directives.
    Outputs: [ { directive, rationale, expected_nps_lift, revenue_protected, priority_rank } ]
    Deterministic and fast (no LLM needed).
    """
    recommendations = []
    
    for issue in fix_now[:3]:
        name = issue.get('issue', 'Issue')
        vol = issue.get('volume', 0)
        impact = issue.get('impact_score', 0)
        conf = issue.get('confidence', 0.5)
        
        # Simple heuristic lifts
        dist_pct = (vol / max(total_reviews, 1))
        nps_lift = max(1, int(dist_pct * 100 * 0.4))  # 40% of the volume impact
        
        # Revenue protected slice based on impact share
        rev_share = min(impact / 10, 0.5)  # Cap at 50%
        rev_protected = int(rev_at_risk * rev_share)
        
        # Generate Directive based on category & sentiment
        cat = issue.get('category', '').lower()
        if cat == 'bug':
            directive = f"Fix critical {name} bug"
        elif 'billing' in cat or 'payment' in cat:
            directive = f"Resolve {name} payment friction"
        elif 'support' in cat:
            directive = f"Improve response to {name}"
        else:
            directive = f"Address {name} to reduce friction"
            
        rationale = f"Impacting {vol} users with high churn risk. " \
                    f"Fixing this addresses a major {cat} pain point."
                    
        recommendations.append({
            "directive": directive,
            "rationale": rationale,
            "expected_nps_lift": f"+{nps_lift} points",
            "revenue_protected": rev_protected,
            "priority_rank": issue.get('priority_rank', 1),
            "confidence": conf
        })
        
    # Fallback if no issues
    if not recommendations:
        recommendations.append({
            "directive": "Collect more user feedback",
            "rationale": "Not enough strong signals detected yet to confidently recommend infrastructure changes.",
            "expected_nps_lift": "+0 points",
            "revenue_protected": 0,
            "priority_rank": 1,
            "confidence": 1.0
        })
        
    return recommendations


def generate_executive_summary(
    df: pd.DataFrame,
    analytics: Dict,
    vertical: str = "generic",
    audience: str = None
) -> Dict:
    """
    Executive Summary — Context-aware, LLM-generated.
    Same structure for all industries; only phrasing adapts.
    """
    if df.empty:
        return {
            "health": "Insufficient data for analysis.",
            "top_threat": "N/A",
            "revenue_exposure": "N/A",
            "vertical_insight": "N/A",
            "recommendation": "Collect more reviews for meaningful insights."
        }
    
    # Build context for LLM
    total_reviews = len(df)
    nps = analytics.get('nps', 0)
    csat = analytics.get('csat', 0)
    rev_at_risk = analytics.get('revenueAtRisk', 0)
    primary_insight = analytics.get('primaryInsight', 'Unknown')
    
    # Fix-now priorities to inform summary
    fix_now = analytics.get('fixNowPriorities', [])
    top_issues_text = ""
    for p in fix_now[:3]:
        top_issues_text += f"- {p['issue']} ({p['volume']} mentions, {p['high_churn_pct']}% high churn)\n"
    
    if not top_issues_text:
        top_issues_text = "- No significant issues identified\n"
    
    # Vertical context
    vertical_upper = vertical.replace('_', ' ').upper()
    audience_ctx = f" (Target audience: {audience.upper()})" if audience else ""
    
    terminology = VERTICAL_TERMINOLOGY.get(vertical, VERTICAL_TERMINOLOGY.get("generic", {}))
    churn_label = terminology.get('churn_label', 'Churn Risk')
    
    prompt = f"""SYSTEM: You are a strategic intelligence analyst generating an executive summary for a {vertical_upper}{audience_ctx} company.

DATA:
- Total Reviews Analyzed: {total_reviews}
- NPS: {nps}
- CSAT: {csat}%
- Revenue at Risk: ${rev_at_risk:,.0f}
- Primary Insight: {primary_insight}
- Top Issues:
{top_issues_text}

TASK: Generate a concise executive summary. Return ONLY valid JSON.

OUTPUT FORMAT:
{{
    "health": "One sentence on overall product health based on NPS/CSAT (MAX 25 WORDS)",
    "top_threat": "The #1 retention threat in this {vertical_upper} context (MAX 20 WORDS)",
    "revenue_exposure": "Revenue impact statement with dollar amount (MAX 20 WORDS)",
    "vertical_insight": "One {vertical_upper}-specific observation about the data (MAX 25 WORDS)",
    "recommendation": "One actionable recommendation for the {vertical_upper} team (MAX 25 WORDS)",
    "textual_answer": "A cohesive paragraph directly answering 'What is the main churn driver and what are the top pains?' Based on the data provided. (MAX 50 WORDS)"
}}

JSON:
"""
    
    try:
        response = query_ollama(prompt, num_predict=250)
        if response:
            try:
                obj = parse_llm_json(response)
                return {
                    "health": obj.get("health", "Analysis completed."),
                    "top_threat": obj.get("top_threat", primary_insight),
                    "revenue_exposure": obj.get("revenue_exposure", f"${rev_at_risk:,.0f} revenue at risk"),
                    "vertical_insight": obj.get("vertical_insight", "Review data shows mixed signals."),
                    "recommendation": obj.get("recommendation", "Focus on top pain points to improve retention."),
                    "textual_answer": obj.get("textual_answer", f"The primary driver of churn is {primary_insight}. Users are primarily experiencing issues with {fix_now[0]['issue'] if fix_now else 'general friction point'}s.")
                }
            except Exception as parse_e:
                print(f"[WARNING] Executive summary JSON parse failed: {parse_e}")
    except Exception as e:
        print(f"[WARNING] Executive summary LLM failed: {e}")
    
    # Fallback (non-LLM)
    health_status = "strong" if nps > 30 else "moderate" if nps > 0 else "concerning"
    return {
        "health": f"Product health is {health_status} with NPS {nps} and CSAT {csat}%.",
        "top_threat": primary_insight,
        "revenue_exposure": f"${rev_at_risk:,.0f} in estimated revenue at risk from {churn_label.lower()}.",
        "vertical_insight": f"{vertical_upper} analysis shows {len(fix_now)} critical priority issues.",
        "recommendation": f"Address '{fix_now[0]['issue']}' first to reduce {churn_label.lower()}." if fix_now else "Collect more data for actionable insights.",
        "textual_answer": f"The main driver of churn is {primary_insight}. The top pains reported by users include {fix_now[0]['issue'] if fix_now else 'general usability issues'}."
    }


def _default_churn_retention_summary() -> Dict[str, Any]:
    return {
        "at_risk_reviews": 0,
        "at_risk_pct": 0.0,
        "high_risk_reviews": 0,
        "medium_risk_reviews": 0,
        "low_risk_reviews": 0,
        "risk_distribution": {"high": 0, "medium": 0, "low": 0, "null": 0},
        "risk_percentages": {"high": 0.0, "medium": 0.0, "low": 0.0, "null": 0.0},
        "promoter_share_pct": 0.0,
        "detractor_share_pct": 0.0,
        "net_retention_signal_pct": 0.0,
        "top_churn_drivers": [],
        "top_retention_drivers": [],
        "alert_level": "stable",
    }


def build_churn_retention_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Build a deterministic churn/retention summary payload for production dashboards.
    Safe for sparse or partially malformed analysis frames.
    """
    summary = _default_churn_retention_summary()
    if df is None or df.empty:
        return summary

    total = int(len(df))
    if total <= 0:
        return summary

    churn_series = pd.Series(["null"] * total, index=df.index, dtype="object")
    if "churn_risk" in df.columns:
        churn_series = (
            df["churn_risk"]
            .fillna("null")
            .astype(str)
            .str.strip()
            .str.lower()
            .replace({"none": "null", "": "null", "nan": "null"})
        )
        churn_series = churn_series.where(churn_series.isin({"high", "medium", "low", "null"}), "null")

    risk_distribution = {
        "high": int((churn_series == "high").sum()),
        "medium": int((churn_series == "medium").sum()),
        "low": int((churn_series == "low").sum()),
        "null": int((churn_series == "null").sum()),
    }
    risk_percentages = {
        k: round((v / max(total, 1)) * 100, 1)
        for k, v in risk_distribution.items()
    }

    segment_series = pd.Series(["neutral"] * total, index=df.index, dtype="object")
    if "user_segment" in df.columns:
        segment_series = (
            df["user_segment"]
            .fillna("neutral")
            .astype(str)
            .str.strip()
            .str.lower()
            .replace({"": "neutral", "nan": "neutral"})
        )
    promoters = int((segment_series == "promoter").sum())
    detractors = int((segment_series == "detractor").sum())
    promoter_share_pct = round((promoters / max(total, 1)) * 100, 1)
    detractor_share_pct = round((detractors / max(total, 1)) * 100, 1)
    net_retention_signal_pct = round(promoter_share_pct - detractor_share_pct, 1)

    def _normalized_issue_series(frame: pd.DataFrame) -> pd.Series:
        for col in ("issue", "pain_point_category", "root_cause", "feature_request"):
            if col in frame.columns:
                s = frame[col].fillna("").astype(str).str.strip()
                s = s.replace({"": "Unspecified", "N/A": "Unspecified", "None": "Unspecified", "null": "Unspecified"})
                return s
        return pd.Series(["Unspecified"] * len(frame), index=frame.index, dtype="object")

    issue_series = _normalized_issue_series(df)
    churn_focus_mask = churn_series.isin({"high", "medium"})
    churn_focus = issue_series[churn_focus_mask]
    top_churn_drivers = []
    if not churn_focus.empty:
        churn_counts = churn_focus.value_counts().head(5)
        for issue, count in churn_counts.items():
            top_churn_drivers.append(
                {
                    "issue": str(issue),
                    "count": int(count),
                    "share_pct": round((int(count) / max(total, 1)) * 100, 1),
                }
            )

    sentiment_positive = pd.Series([False] * total, index=df.index, dtype="bool")
    if "sentiment" in df.columns:
        sentiment_positive = df["sentiment"].fillna("").astype(str).str.lower().eq("positive")
    elif "sentiment_score" in df.columns:
        sentiment_positive = pd.to_numeric(df["sentiment_score"], errors="coerce").fillna(0) > 0

    retention_mask = sentiment_positive | churn_series.eq("low") | segment_series.eq("promoter")
    retention_focus = issue_series[retention_mask]
    top_retention_drivers = []
    if not retention_focus.empty:
        retention_counts = retention_focus.value_counts().head(5)
        for issue, count in retention_counts.items():
            top_retention_drivers.append(
                {
                    "issue": str(issue),
                    "count": int(count),
                    "share_pct": round((int(count) / max(total, 1)) * 100, 1),
                }
            )

    high_pct = risk_percentages["high"]
    at_risk_reviews = risk_distribution["high"] + risk_distribution["medium"]
    at_risk_pct = round((at_risk_reviews / max(total, 1)) * 100, 1)
    if high_pct >= 25 or at_risk_pct >= 55:
        alert_level = "critical"
    elif high_pct >= 15 or at_risk_pct >= 35:
        alert_level = "high"
    elif high_pct >= 8 or at_risk_pct >= 20:
        alert_level = "moderate"
    else:
        alert_level = "stable"

    summary.update(
        {
            "at_risk_reviews": at_risk_reviews,
            "at_risk_pct": at_risk_pct,
            "high_risk_reviews": risk_distribution["high"],
            "medium_risk_reviews": risk_distribution["medium"],
            "low_risk_reviews": risk_distribution["low"] + risk_distribution["null"],
            "risk_distribution": risk_distribution,
            "risk_percentages": risk_percentages,
            "promoter_share_pct": promoter_share_pct,
            "detractor_share_pct": detractor_share_pct,
            "net_retention_signal_pct": net_retention_signal_pct,
            "top_churn_drivers": top_churn_drivers,
            "top_retention_drivers": top_retention_drivers,
            "alert_level": alert_level,
        }
    )
    return summary


def get_comprehensive_analytics(df: pd.DataFrame, arpu: float = 50.0, vertical: str = "generic", audience: str = None) -> Dict:
    """Main entry point for Step 4 Dashboard. Returns flat structure for frontend consumption."""
    if df.empty: 
        return {
            "healthMetrics": {"nps_score": 0, "csat_score": 0, "ces_score": 0, "health_score": 0},
            "categorizedMetrics": {},
            "sentimentDistribution": {"positive": 0, "neutral": 0, "negative": 0},
            "totalReviews": 0,
            "revenueAtRisk": 0,
            "trends": [],
            "thematic": {},
            "fixNowPriorities": [],
            "executiveSummary": {"health": "No data available."},
            "churnRetention": _default_churn_retention_summary(),
        }
    
    rev_risk = calculate_revenue_at_risk(df, arpu)
    decision = get_decision_intelligence(df, vertical=vertical)
    
    # Run post-analysis computations in parallel
    from predictive_intelligence import detect_acceleration_events, generate_crisis_alerts
    from analytics import calculate_sentiment_trends, get_health_metrics, categorize_metrics
    from synthesis_module import batch_synthesize_labels
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as post_exec:
        future_rising = post_exec.submit(detect_acceleration_events, df, topic_column='issue', min_mentions=3, threshold=1.5)
        future_sentiment = post_exec.submit(calculate_sentiment_trends, df)
        future_crisis = post_exec.submit(generate_crisis_alerts, df)
        
        try:
            rising_problems = future_rising.result()
        except Exception as e:
            print(f"Error in rising_problems: {e}")
            rising_problems = pd.DataFrame()
            
        try:
            sentiment_trends = future_sentiment.result()
        except Exception as e:
            print(f"Error in sentiment_trends: {e}")
            sentiment_trends = {"improving": [], "worsening": []}
            
        try:
            crisis_alerts = future_crisis.result()
        except Exception as e:
            print(f"Error in crisis_alerts: {e}")
            crisis_alerts = []
    
    # Get standardized metrics and theme quadrants
    try:
        health_metrics = get_health_metrics(df)
    except Exception as e:
        print(f"Health metrics error: {e}")
        health_metrics = {"health_score": 0, "nps_score": 0, "csat_score": 0, "ces_score": 0, "retention_risk_pct": 0, "total_reviews": len(df)}

    churn_retention = build_churn_retention_summary(df)
    health_metrics["high_risk_reviews"] = churn_retention.get("high_risk_reviews", 0)
    health_metrics["medium_risk_reviews"] = churn_retention.get("medium_risk_reviews", 0)
    health_metrics["low_risk_reviews"] = churn_retention.get("low_risk_reviews", 0)
    health_metrics["at_risk_pct"] = churn_retention.get("at_risk_pct", 0.0)
        
    try:
        categorized_metrics = categorize_metrics(df)
    except Exception as e:
        print(f"Categorization error: {e}")
        categorized_metrics = {}
    
    # Synthesize labels for better insights
    try:
        categorized_metrics = batch_synthesize_labels(categorized_metrics, df.to_dict('records'), vertical=vertical)
    except Exception as e:
        print(f"Label synthesis error: {e}")

    # Build trends list for frontend (name, sentiment, change, label)
    trends = []
    
    # Add Rising Problems
    if not rising_problems.empty:
        for _, row in rising_problems.head(3).iterrows():
            trends.append({
                "name": row['topic'],
                "sentiment": "Negative",
                "change": row['percent_change'],
                "label": "Rising Problem"
            })
            
    # Add Falling Satisfaction
    for item in sentiment_trends.get('worsening', [])[:3]:
        trends.append({
            "name": item['name'],
            "sentiment": "Negative",
            "change": item['change'],
            "label": "Falling Satisfaction"
        })
        
    # Add Emerging Risks
    for alert in crisis_alerts[:3]:
        trends.append({
            "name": alert['crisis_term'],
            "sentiment": "Critical",
            "change": alert['risk_score'],
            "label": "Emerging Risk"
        })
    
    # Fallback to simple velocity if no prioritized trends
    if not trends:
        velocity = calculate_sentiment_velocity(df)
        for v in velocity[:6]:
            sentiment = 'Positive' if v['percent_change'] > 0 else 'Negative'
            trends.append({
                "name": v['topic'],
                "sentiment": sentiment,
                "change": v['percent_change'],
                "label": "Trend"
            })
    
    # Thematic aggregation (Legacy)
    thematic = get_thematic_aggregates(df)
    
    # --- NEW: Fix-Now Prioritization ---
    fix_now = fix_now_prioritization(df, vertical=vertical)
    
    # --- NEW: Weekly Trends ---
    weekly_trends = calculate_weekly_trends(df)
    
    # --- NEW: Structured Recommendations ---
    recs = generate_recommendations(fix_now, len(df), rev_risk.get('total_revenue_at_risk', 0))
    
    # Sentiment distribution
    sentiment_dist = {"positive": 0, "neutral": 0, "negative": 0}
    if 'sentiment' in df.columns:
        dist = df['sentiment'].value_counts()
        for k, v in dist.items():
            k_lower = str(k).lower()
            if k_lower in sentiment_dist:
                sentiment_dist[k_lower] = int(v)
    
    # Build base analytics dict
    analytics = {
        # KPI Container for new formal UI
        "healthMetrics": health_metrics,
        "categorizedMetrics": categorized_metrics,
        "sentimentDistribution": sentiment_dist,
        "sentimentTrends": sentiment_trends,
        
        # Frontend Chart Compatibility
        "totalPositive": sentiment_dist.get('positive', 0),
        "totalNeutral": sentiment_dist.get('neutral', 0),
        "totalNegative": sentiment_dist.get('negative', 0),

        # Standard metrics for top-level access
        "nps": health_metrics['nps_score'],
        "csat": health_metrics['csat_score'],
        "totalReviews": len(df),
        "revenueAtRisk": rev_risk['total_revenue_at_risk'],
        "revenueBreakdown": rev_risk,
        "revenueLabel": rev_risk.get('revenue_label', 'Revenue at Risk'),
        
        # Primary insight for the hero card
        "primaryInsight": decision['primary_fix'],
        "primaryInsightCategory": decision.get('category', 'Other'),
        "primaryInsightRationale": decision.get('rationale', ''),
        
        # Trends for the emerging topics panel
        "trends": trends,
        
        # Thematic breakdown
        "thematic": thematic,
        
        # Impact data
        "ratingImpact": calculate_rating_drag(df),
        "decision": decision,
        
        # New Intelligence fields for raw consumption
        "intelligence": {
            "rising_problems": rising_problems.to_dict('records') if not rising_problems.empty else [],
            "falling_satisfaction": sentiment_trends.get('worsening', []),
            "emerging_risks": crisis_alerts
        },
        
        # --- NEW: Fix-Now Priorities ---
        "fixNowPriorities": fix_now,
        
        # --- NEW: Weekly Trends ---
        "weeklyTrends": weekly_trends,
        
        # --- NEW: Action Plan Recommendations ---
        "recommendations": recs,
        
        # --- NEW: Vertical context ---
        "vertical": vertical,
        "audience": audience,

        # Production-grade churn/retention summary block
        "churnRetention": churn_retention,
        "churn_retention": churn_retention,
    }
    
    # --- NEW: Executive Summary (requires analytics dict for context) ---
    exec_summary = generate_executive_summary(df, analytics, vertical=vertical, audience=audience)
    analytics["executiveSummary"] = exec_summary
    
    return analytics

