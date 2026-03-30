"""
CXM Feedback Intelligence scheduled fetch engine.
Uses APScheduler to pull reviews from connected sources.
"""
import hashlib
import json
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    HAS_APScheduler = True
except ImportError:
    HAS_APScheduler = False
    logger.warning(
        "[CXM Scheduler] apscheduler not installed - scheduled fetching disabled. "
        "Run: pip install apscheduler"
    )

_scheduler: Optional[object] = None

INTERVAL_MAP = {
    "hourly": {"hours": 1},
    "daily": {"hours": 24},
    "weekly": {"weeks": 1},
    "manual": None,
}

ANALYSIS_INTERVAL_SECONDS = {
    "hourly": 3600,
    "daily": 24 * 3600,
    "weekly": 7 * 24 * 3600,
    "manual": None,
}


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _review_timestamp(review: Dict[str, Any]) -> Optional[datetime]:
    for key in ("reviewed_at", "at", "date", "created_at", "updated_at", "timestamp"):
        parsed = _parse_timestamp(review.get(key))
        if parsed:
            return parsed
    return None


def _filter_incremental_reviews(source: Dict[str, Any], reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    After initial sync, keep only reviews newer than last_fetched_at when timestamp exists.
    Reviews without timestamps pass through and are handled by hash dedupe.
    """
    last_fetched = _parse_timestamp(source.get("last_fetched_at"))
    if not last_fetched:
        return reviews

    filtered: List[Dict[str, Any]] = []
    for review in reviews:
        review_ts = _review_timestamp(review)
        if review_ts is None or review_ts > last_fetched:
            filtered.append(review)
    return filtered


def _resolve_analysis_interval(source: Dict[str, Any]) -> str:
    config = source.get("config", {}) if isinstance(source.get("config"), dict) else {}
    raw = source.get("analysis_interval") or config.get("analysis_interval") or ""
    scope = str(config.get("_scope") or config.get("integration_scope") or "workspace").strip().lower()
    if not raw:
        raw = source.get("fetch_interval") if scope != "feedback_crm" else "manual"
    interval = str(raw).strip().lower() or "manual"
    if interval == "manual" and scope != "feedback_crm":
        fallback = str(source.get("fetch_interval") or "").strip().lower()
        if fallback in ANALYSIS_INTERVAL_SECONDS and fallback != "manual":
            interval = fallback
    return interval if interval in ANALYSIS_INTERVAL_SECONDS else "manual"


def _should_run_analysis(source: Dict[str, Any], *, force_analysis: bool = False) -> bool:
    if force_analysis:
        return True

    interval = _resolve_analysis_interval(source)
    seconds = ANALYSIS_INTERVAL_SECONDS.get(interval)
    if not seconds:
        return False

    last_analyzed = _parse_timestamp(source.get("last_analyzed_at"))
    if not last_analyzed:
        return True

    now = datetime.now(timezone.utc)
    return (now - last_analyzed) >= timedelta(seconds=seconds)


def _normalize_for_hash(review: Dict[str, Any]) -> str:
    return str(review.get("content") or review.get("text") or review.get("review") or "").strip()


def _filter_unseen_reviews(source_id: int, reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Avoid reprocessing duplicates by checking existing content hashes per source."""
    from database import get_db_connection

    if not reviews:
        return []

    review_hash_pairs = []
    for review in reviews:
        content = _normalize_for_hash(review)
        if not content:
            continue
        content_hash = hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest()
        review_hash_pairs.append((review, content_hash))

    if not review_hash_pairs:
        return []

    unique_hashes = sorted({h for _, h in review_hash_pairs})
    existing_hashes = set()
    conn = get_db_connection()
    cursor = conn.cursor()
    chunk_size = 400
    for idx in range(0, len(unique_hashes), chunk_size):
        chunk = unique_hashes[idx:idx + chunk_size]
        placeholders = ",".join(["?"] * len(chunk))
        cursor.execute(
            f"SELECT content_hash FROM cxm_reviews WHERE source_id=? AND content_hash IN ({placeholders})",
            [source_id] + chunk,
        )
        existing_hashes.update(row[0] for row in cursor.fetchall() if row and row[0])
    conn.close()

    return [review for review, h in review_hash_pairs if h not in existing_hashes]


def _fetch_reviews_for_source(source: Dict[str, Any], count: int, country: str) -> List[Dict[str, Any]]:
    source_type = source["source_type"]
    identifier = source["identifier"]
    config = source["config"]
    reviews: List[Dict[str, Any]] = []

    if source_type == "playstore":
        from playstore_connector import fetch_raw_playstore_reviews

        df = fetch_raw_playstore_reviews(identifier, country, count)
        if df is not None and not df.empty:
            reviews = df.to_dict("records")

    elif source_type == "appstore":
        from appstore_connector import fetch_appstore_reviews

        pages = max(1, math.ceil(count / 50))
        df = fetch_appstore_reviews(identifier, country, pages)
        if df is not None and not df.empty:
            reviews = df.to_dict("records")

    elif source_type == "trustpilot":
        from trustpilot_connector import TrustpilotScraper

        scraper = TrustpilotScraper()
        tp_pages = max(1, count // 20)
        df = scraper.scrape_reviews(identifier, max_pages=tp_pages)
        if df is not None and not df.empty:
            reviews = df.to_dict("records")

    elif source_type == "surveymonkey":
        token = config.get("token") or config.get("auth_value", "")
        if not token:
            raise ValueError("SurveyMonkey token is required")

        import requests as _req

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        details_url = f"https://api.surveymonkey.com/v3/surveys/{identifier}/details"
        details_resp = _req.get(details_url, headers=headers, timeout=15)
        details_resp.raise_for_status()

        resp_url = f"https://api.surveymonkey.com/v3/surveys/{identifier}/responses/bulk?per_page=100"
        resp = _req.get(resp_url, headers=headers, timeout=20)
        resp.raise_for_status()
        payload = resp.json()

        rows = []
        for item in payload.get("data", []):
            parts = []
            for page in item.get("pages", []):
                for question in page.get("questions", []):
                    for answer in question.get("answers", []):
                        if answer.get("text"):
                            parts.append(str(answer["text"]))
            content = " | ".join(parts)
            if content:
                rows.append(
                    {
                        "content": content,
                        "score": 3,
                        "at": item.get("date_created", datetime.now().isoformat()),
                        "userName": "Respondent",
                    }
                )
        reviews = rows[:count]

    elif source_type == "typeform":
        token = config.get("token") or config.get("auth_value", "")
        if not token:
            raise ValueError("Typeform token is required")

        import requests as _req

        headers = {"Authorization": f"Bearer {token}"}
        resp = _req.get(
            f"https://api.typeform.com/forms/{identifier}/responses?page_size=200",
            headers=headers,
            timeout=20,
        )
        resp.raise_for_status()
        payload = resp.json()

        rows = []
        for item in payload.get("items", []):
            parts = []
            score = 3
            for answer in item.get("answers", []):
                ans_type = answer.get("type", "")
                if ans_type == "text":
                    parts.append(answer.get("text", ""))
                elif ans_type == "choice":
                    parts.append(answer.get("choice", {}).get("label", ""))
                elif ans_type == "number":
                    try:
                        n = float(answer.get("number"))
                        if n > 10:
                            score = max(1, min(5, round(n / 20)))
                        elif n > 5:
                            score = max(1, min(5, round((n / 10) * 4 + 1)))
                        else:
                            score = max(1, min(5, round(n)))
                    except Exception:
                        pass
            content = " | ".join(p for p in parts if p)
            if content:
                rows.append(
                    {
                        "content": content,
                        "score": score,
                        "at": item.get("submitted_at", datetime.now().isoformat()),
                        "userName": item.get("hidden", {}).get("name", "Respondent"),
                    }
                )
        reviews = rows[:count]

    elif source_type in ("salesforce", "crm"):
        instance_url = config.get("instance_url", identifier)
        if not instance_url:
            raise ValueError("Salesforce instance URL is required")

        import requests as _req

        token_resp = _req.post(
            f"{instance_url.rstrip('/')}/services/oauth2/token",
            data={
                "grant_type": "password",
                "client_id": config.get("client_id", ""),
                "client_secret": config.get("client_secret", ""),
                "username": config.get("username", ""),
                "password": config.get("password", ""),
            },
            timeout=15,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        object_name = config.get("object_name", "Case")
        content_field = config.get("content_field", "Description")
        score_field = config.get("score_field", "")
        soql = (
            f"SELECT Id, {content_field}{', ' + score_field if score_field else ''}, CreatedDate "
            f"FROM {object_name} ORDER BY CreatedDate DESC LIMIT {count}"
        )
        query_resp = _req.get(
            f"{instance_url.rstrip('/')}/services/data/v57.0/query",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": soql},
            timeout=20,
        )
        query_resp.raise_for_status()

        rows = []
        for item in query_resp.json().get("records", []):
            content = str(item.get(content_field, "") or "")
            if not content:
                continue

            score = 3
            if score_field and item.get(score_field) is not None:
                try:
                    val = float(item.get(score_field))
                    if val > 10:
                        score = max(1, min(5, round(val / 20)))
                    elif val > 5:
                        score = max(1, min(5, round((val / 10) * 4 + 1)))
                    else:
                        score = max(1, min(5, round(val)))
                except Exception:
                    pass

            rows.append(
                {
                    "content": content,
                    "score": score,
                    "at": item.get("CreatedDate", datetime.now().isoformat()),
                    "userName": "Customer",
                }
            )
        reviews = rows[:count]

    elif source_type in ("generic_api", "webhook", "api"):
        if config.get("api_url") or source_type in ("generic_api", "api"):
            from api_connector import fetch_generic_api_reviews

            source_for_pull = dict(source)
            if config.get("api_url"):
                source_for_pull["identifier"] = config["api_url"]
            reviews = fetch_generic_api_reviews(source_for_pull)

    elif source_type == "csv":
        raise ValueError("CSV connectors require file uploads and cannot auto-fetch on schedule")

    return reviews


def _do_fetch(
    source_id: int,
    run_analysis_hooks: bool = True,
    run_crm_ingestion_hooks: bool = True,
    force_analysis: bool = False,
    ignore_last_fetched: bool = False,
) -> Dict[str, Any]:
    """Fetch reviews for a source, insert only new rows, and optionally run follow-up hooks."""
    from database import (
        cxm_insert_reviews,
        cxm_update_last_analyzed,
        cxm_update_last_fetched,
        get_db_connection,
    )

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cxm_sources WHERE id=? AND is_active=1", (source_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"ok": False, "error": "source_not_found", "fetched": 0, "inserted": 0}

    source = dict(row)
    try:
        source["config"] = json.loads(source.get("config") or "{}")
    except Exception:
        source["config"] = {}

    user_id = source["user_id"]
    tenant_id = source.get("tenant_id")
    source_type = source["source_type"]
    identifier = source["identifier"]
    config = source["config"]
    try:
        count = max(1, int(config.get("count", 50)))
    except (TypeError, ValueError):
        count = 50
    country = config.get("country", "us")

    analysis_due = bool(run_analysis_hooks and _should_run_analysis(source, force_analysis=force_analysis))

    logger.info(f"[CXM Scheduler] Fetching source {source_id} ({source_type}: {identifier})")

    try:
        reviews = _fetch_reviews_for_source(source, count, country)
    except Exception as e:
        logger.error(f"[CXM Scheduler] Fetch failed for source {source_id}: {e}")
        return {"ok": False, "error": str(e), "fetched": 0, "inserted": 0}

    if not ignore_last_fetched:
        reviews = _filter_incremental_reviews(source, reviews or [])
    else:
        reviews = reviews or []
    fetched_count = len(reviews)

    if not reviews:
        logger.info(f"[CXM Scheduler] Source {source_id}: no new reviews fetched")
        cxm_update_last_fetched(source_id)
        if analysis_due:
            try:
                _analyse_pending(user_id, tenant_id)
                cxm_update_last_analyzed(source_id)
            except Exception as e:
                logger.warning(f"[CXM Scheduler] LLM analysis failed for user {user_id}: {e}")
        return {"ok": True, "fetched": 0, "inserted": 0}

    new_reviews = _filter_unseen_reviews(source_id, reviews)
    if not new_reviews:
        cxm_update_last_fetched(source_id)
        if analysis_due:
            try:
                _analyse_pending(user_id, tenant_id)
                cxm_update_last_analyzed(source_id)
            except Exception as e:
                logger.warning(f"[CXM Scheduler] LLM analysis failed for user {user_id}: {e}")
        return {"ok": True, "fetched": fetched_count, "inserted": 0}

    inserted = cxm_insert_reviews(source_id, user_id, tenant_id, new_reviews)
    cxm_update_last_fetched(source_id)
    logger.info(f"[CXM Scheduler] Source {source_id}: {inserted} new reviews inserted out of {fetched_count} fetched")

    if analysis_due:
        try:
            _analyse_pending(user_id, tenant_id)
            cxm_update_last_analyzed(source_id)
        except Exception as e:
            logger.warning(f"[CXM Scheduler] LLM analysis failed for user {user_id}: {e}")

    if run_crm_ingestion_hooks:
        try:
            from feedback_ingestion import process_feedback

            if tenant_id:
                for review in new_reviews:
                    try:
                        process_feedback(tenant_id, source_type, review)
                    except Exception as fi_err:
                        logger.warning(f"[CRM Hook] Review ingest failed for source {source_id}: {fi_err}")
        except Exception as e:
            logger.error(f"[CRM Hook] FI pipeline trigger failed for source {source_id}: {e}")

    return {"ok": True, "fetched": fetched_count, "inserted": inserted}


def _analyse_pending(user_id: int, tenant_id: int, batch_size: int = 50):
    """
    Run LLM sentiment/churn analysis on ALL unanalyzed reviews for a user.
    Uses parallel LLM calls - see cxm_analyser.analyse_reviews_batch().
    Processes in chunks of batch_size to avoid memory spikes.
    """
    from database import cxm_get_unanalyzed_reviews, cxm_update_review_analysis_batch

    pending = cxm_get_unanalyzed_reviews(user_id=user_id, tenant_id=tenant_id, limit=batch_size)
    if not pending:
        return

    logger.info(f"[CXM Scheduler] Analysing {len(pending)} unanalyzed reviews for user {user_id}")

    try:
        from cxm_analyser import analyse_reviews_batch

        results = analyse_reviews_batch([r["content"] for r in pending])
    except Exception as e:
        logger.warning(f"[CXM Scheduler] LLM batch failed, using heuristic: {e}")
        from cxm_analyser import _heuristic_analyse

        results = [_heuristic_analyse(r["content"], r.get("score", 3)) for r in pending]

    updates = []
    for review, result in zip(pending, results):
        updates.append(
            {
                "review_id": review["id"],
                "sentiment": result.get("sentiment", "neutral"),
                "sentiment_score": float(result.get("sentiment_score", 0.0)),
                "churn_risk": result.get("churn_risk", "low"),
                "churn_probability": float(result.get("churn_probability", 0.1)),
                "themes": result.get("themes", []),
                "pain_point": result.get("pain_point", "other"),
                "churn_intent_cluster": result.get("churn_intent_cluster", "no_churn_signal"),
                "user_segment": result.get("user_segment", "unknown"),
                "growth_opportunity": result.get("growth_opportunity", "none"),
                "main_problem_flag": bool(result.get("main_problem_flag", False)),
            }
        )
    cxm_update_review_analysis_batch(updates)


def _heuristic_analyse(text: str, score: int) -> dict:
    """Fast keyword-based fallback analysis (no LLM required)."""
    text_lower = text.lower()
    negative_words = [
        "terrible",
        "awful",
        "broken",
        "crash",
        "bug",
        "hate",
        "worst",
        "useless",
        "cancel",
        "refund",
        "scam",
        "delete",
        "slow",
        "freeze",
        "error",
        "disappointed",
        "horrible",
    ]
    positive_words = [
        "love",
        "great",
        "excellent",
        "amazing",
        "perfect",
        "best",
        "awesome",
        "fantastic",
        "wonderful",
        "helpful",
        "easy",
    ]
    churn_words = [
        "cancel",
        "uninstall",
        "delete",
        "switch",
        "moving to",
        "leaving",
        "quit",
        "stop using",
        "refund",
        "subscription cancel",
    ]

    neg_hits = sum(1 for w in negative_words if w in text_lower)
    pos_hits = sum(1 for w in positive_words if w in text_lower)
    churn_hits = sum(1 for w in churn_words if w in text_lower)

    if score >= 4 or (pos_hits > neg_hits and score >= 3):
        sentiment = "positive"
        sentiment_score = min(1.0, 0.4 + pos_hits * 0.1 + (score - 3) * 0.2)
    elif score <= 2 or neg_hits > pos_hits:
        sentiment = "negative"
        sentiment_score = max(-1.0, -(0.4 + neg_hits * 0.1 + (3 - score) * 0.15))
    else:
        sentiment = "neutral"
        sentiment_score = 0.0

    if churn_hits >= 2 or (churn_hits >= 1 and score <= 2):
        churn_risk = "high"
        churn_probability = min(0.95, 0.6 + churn_hits * 0.1)
    elif churn_hits == 1 or score <= 2:
        churn_risk = "medium"
        churn_probability = 0.35
    else:
        churn_risk = "low"
        churn_probability = 0.08

    theme_map = {
        "Performance": ["slow", "lag", "freeze", "crash", "loading"],
        "UI/UX": ["ui", "design", "interface", "layout", "ugly", "confusing"],
        "Bugs": ["bug", "error", "broken", "glitch", "fix"],
        "Pricing": ["expensive", "price", "cheap", "cost", "refund", "subscription"],
        "Support": ["support", "help", "response", "customer service"],
        "Features": ["feature", "missing", "wish", "would be nice", "add"],
    }
    themes = [t for t, words in theme_map.items() if any(w in text_lower for w in words)]

    return {
        "sentiment": sentiment,
        "sentiment_score": round(sentiment_score, 3),
        "churn_risk": churn_risk,
        "churn_probability": round(churn_probability, 3),
        "themes": themes,
    }


def init_scheduler():
    """Initialize APScheduler and register jobs for all active sources."""
    global _scheduler
    if not HAS_APScheduler:
        logger.warning("[CXM Scheduler] Skipping - apscheduler not available")
        return

    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.start()
    logger.info("[CXM Scheduler] Started")

    try:
        from database import get_db_connection

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, fetch_interval, config FROM cxm_sources WHERE is_active=1")
        sources = cursor.fetchall()
        conn.close()
        for row in sources:
            try:
                cfg = json.loads(row["config"] or "{}")
            except Exception:
                cfg = {}
            scope = str(cfg.get("_scope") or cfg.get("integration_scope") or "workspace").strip().lower()
            if scope == "feedback_crm":
                continue
            schedule_source(row["id"], row["fetch_interval"])
    except Exception as e:
        logger.error(f"[CXM Scheduler] Failed to load sources on init: {e}")


def shutdown_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler and HAS_APScheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[CXM Scheduler] Shut down")


def schedule_source(source_id: int, fetch_interval: str):
    """Add or replace a scheduler job for a source."""
    if not HAS_APScheduler or not _scheduler:
        return
    interval_kwargs = INTERVAL_MAP.get(fetch_interval)
    if not interval_kwargs:
        return
    try:
        from database import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT config FROM cxm_sources WHERE id=?", (source_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            try:
                cfg = json.loads(row["config"] or "{}")
            except Exception:
                cfg = {}
            scope = str(cfg.get("_scope") or cfg.get("integration_scope") or "workspace").strip().lower()
            if scope == "feedback_crm":
                logger.info(f"[CXM Scheduler] Skipping auto-schedule for Feedback CRM source {source_id}")
                return
    except Exception:
        pass
    job_id = f"cxm_source_{source_id}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    _scheduler.add_job(
        _do_fetch,
        trigger=IntervalTrigger(**interval_kwargs),
        args=[source_id],
        id=job_id,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(f"[CXM Scheduler] Scheduled source {source_id} every {fetch_interval}")


def remove_source_job(source_id: int):
    """Remove the scheduler job for a deleted source."""
    if not HAS_APScheduler or not _scheduler:
        return
    job_id = f"cxm_source_{source_id}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
        logger.info(f"[CXM Scheduler] Removed job for source {source_id}")


def trigger_fetch_now(
    source_id: int,
    run_analysis_hooks: bool = True,
    run_crm_ingestion_hooks: bool = True,
    force_analysis: bool = False,
    ignore_last_fetched: bool = False,
) -> Dict[str, Any]:
    """Immediately run a fetch for a source (manual trigger)."""
    return _do_fetch(
        source_id,
        run_analysis_hooks=run_analysis_hooks,
        run_crm_ingestion_hooks=run_crm_ingestion_hooks,
        force_analysis=force_analysis,
        ignore_last_fetched=ignore_last_fetched,
    )
