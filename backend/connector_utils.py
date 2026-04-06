from typing import Any, Dict, Optional, Tuple


VALID_INTERVALS = {"manual", "hourly", "daily", "weekly", "on_new"}


def normalize_interval(value: Optional[str], fallback: str) -> str:
    candidate = str(value or "").strip().lower()
    if candidate in VALID_INTERVALS:
        return candidate
    normalized_fallback = str(fallback or "manual").strip().lower()
    return normalized_fallback if normalized_fallback in VALID_INTERVALS else "manual"


def normalize_max_reviews(value: Optional[int], config: Optional[Dict[str, Any]], default: int = 100) -> int:
    cfg = config or {}
    raw_value = value if value is not None else cfg.get("count") or cfg.get("max_reviews") or default
    try:
        return max(1, min(int(raw_value), 5000))
    except (TypeError, ValueError):
        return default


def resolve_connector_create_settings(
    config: Optional[Dict[str, Any]],
    *,
    fetch_interval: Optional[str],
    analysis_interval: Optional[str],
    max_reviews: Optional[int],
    default_fetch_interval: str,
    follow_fetch_for_analysis: bool,
) -> Tuple[Dict[str, Any], str, str, int]:
    cfg = dict(config or {})
    resolved_max_reviews = normalize_max_reviews(max_reviews, cfg)
    cfg["count"] = resolved_max_reviews
    cfg["max_reviews"] = resolved_max_reviews

    resolved_fetch_interval = normalize_interval(
        fetch_interval if fetch_interval is not None else cfg.get("fetch_interval"),
        default_fetch_interval,
    )
    default_analysis = resolved_fetch_interval if follow_fetch_for_analysis and resolved_fetch_interval != "manual" else "manual"
    resolved_analysis_interval = normalize_interval(
        analysis_interval if analysis_interval is not None else cfg.get("analysis_interval"),
        default_analysis,
    )
    return cfg, resolved_fetch_interval, resolved_analysis_interval, resolved_max_reviews
