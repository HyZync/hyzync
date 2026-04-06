"""
Feedback Intelligence CRM Module
================================
Provides the CRM layer: Feedback Inbox, Issue Tracking, Customer Entities,
Impact Scoring, Trend Detection, Product Health Dashboard, and AI Response Generation.

All database operations use the existing SQLite infrastructure from database.py.
"""

import json
import hashlib
import logging
import math
import re
import smtplib
import ssl
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, List, Optional, Tuple

from database import get_db_connection

logger = logging.getLogger("hyzync.feedback_crm")

FI_CRM_PROMPT_VERSION = "feedback_crm_v5"
FI_CRM_CLEANING_VERSION = "feedback_crm_clean_v2"
VALID_KB_CHANNELS = {"any", "email", "sms", "both"}
ALL_SEGMENT_TOKENS = {"all", "any", "default", "*"}
GENERIC_ISSUE_LABELS = {
    "",
    "none",
    "null",
    "n/a",
    "na",
    "unknown",
    "unclassified",
    "other",
    "feature",
    "features",
    "feature request",
    "feature requests",
    "feature gap",
    "feature gaps",
    "missing feature",
    "missing features",
    "feature request or gap",
    "requested improvement",
    "requested capability",
    "missing capability",
    "customer suggested a missing capability",
    "issue",
    "issues",
    "problem",
    "problems",
    "complaint",
    "complaints",
    "bugs",
    "bug",
    "pricing",
    "support",
    "ux",
    "ui",
    "performance",
    "reliability",
    "onboarding",
    "cancellation",
    "renewal",
    "value",
    "mixed experience",
    "user dissatisfaction",
    "no major issues reported",
    "general satisfaction",
    "unspecified product issue",
    "general feedback",
}
GENERIC_ISSUE_TOKENS = {
    "feature",
    "features",
    "request",
    "requests",
    "gap",
    "gaps",
    "missing",
    "issue",
    "issues",
    "problem",
    "problems",
    "bug",
    "bugs",
    "complaint",
    "complaints",
    "support",
    "pricing",
    "billing",
    "ux",
    "ui",
    "performance",
    "reliability",
    "onboarding",
    "value",
    "general",
    "feedback",
    "experience",
    "user",
    "dissatisfaction",
    "mixed",
    "major",
    "reported",
    "improvement",
    "requested",
    "capability",
}
GENERIC_ISSUE_FILLER_TOKENS = {"a", "an", "the", "and", "or", "to", "for", "of", "in", "with", "without"}
FEATURE_HINT_PATTERNS = [
    re.compile(r"(?:please\s+add|add|support(?:\s+for)?|integration\s+with)\s+([a-z0-9][a-z0-9/&+\-\s]{3,70})", re.IGNORECASE),
    re.compile(r"(?:missing|lack(?:ing|s)?|need(?:ed|s)?|want(?:ed)?|wish(?:ed)?(?:\s+for)?|without|no)\s+(?:an?\s+|the\s+)?([a-z0-9][a-z0-9/&+\-\s]{3,70})", re.IGNORECASE),
]
NONE_LIKE_TOKENS = {"", "none", "n/a", "na", "null", "unknown", "not sure"}

CONTACT_EMAIL_KEYS = {
    "email",
    "user_email",
    "customer_email",
    "respondent_email",
    "contact_email",
    "mail",
}
CONTACT_PHONE_KEYS = {
    "phone",
    "phone_number",
    "mobile",
    "mobile_number",
    "contact_number",
    "contact_phone",
    "whatsapp",
    "msisdn",
}
CONTACT_NAME_KEYS = {
    "name",
    "full_name",
    "customer_name",
    "user_name",
    "username",
    "author",
    "reviewer_name",
    "respondent_name",
    "first_name",
    "display_name",
}


def _safe_json_dumps(value: Any) -> str:
    return json.dumps({} if value is None else value, ensure_ascii=False)


def _json_load_dict(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _json_load_list(raw: Optional[str]) -> List[Any]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _coerce_text(value: Any, fallback: str = "", limit: int = 180) -> str:
    text = " ".join(str(value or "").split()).strip()
    if not text:
        return fallback
    return text[:limit]


def _compact_issue_label(value: Any, limit: int = 120) -> str:
    text = _coerce_text(value, "", 240)
    if not text:
        return ""
    lowered = text.lower()
    split_index = None
    for token in (" because ", ". ", ";", " - ", ":", ","):
        idx = lowered.find(token)
        if idx > 18:
            split_index = idx
            break
    if split_index is not None:
        text = text[:split_index]
    text = text.strip(" .,:;!-_")
    return _coerce_text(text, "", limit)


def _is_generic_issue_label(value: Any) -> bool:
    label = _compact_issue_label(value, 120).lower()
    if not label:
        return True
    if label in GENERIC_ISSUE_LABELS:
        return True
    tokens = [
        token
        for token in re.split(r"[^a-z0-9]+", label)
        if token and token not in GENERIC_ISSUE_FILLER_TOKENS
    ]
    if tokens and all(token in GENERIC_ISSUE_TOKENS for token in tokens):
        return True
    if len(label) <= 3:
        return True
    return False


def _extract_feature_gap_label(*candidates: Any) -> str:
    for raw in candidates:
        text = _coerce_text(raw, "", 260)
        if not text:
            continue
        for pattern in FEATURE_HINT_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue
            fragment = _coerce_text(match.group(1), "", 90)
            fragment = re.split(r"[.,;!?]", fragment, maxsplit=1)[0].strip(" -_:")
            if not fragment:
                continue
            normalized_fragment = _coerce_text(fragment, "", 70)
            if _is_generic_issue_label(normalized_fragment):
                continue
            return _coerce_text(f"Missing {normalized_fragment}", "", 120)
    return ""


def _derive_actionable_issue_label(*candidates: Any) -> str:
    for candidate in candidates:
        label = _compact_issue_label(candidate, 120)
        if not label:
            continue
        if _is_generic_issue_label(label):
            continue
        return label
    return "Unspecified product issue"


def fi_is_analysis_stale(
    metadata_payload: Any,
    *,
    prompt_version: str = FI_CRM_PROMPT_VERSION,
    cleaning_version: str = FI_CRM_CLEANING_VERSION,
) -> bool:
    metadata = metadata_payload if isinstance(metadata_payload, dict) else _json_load_dict(metadata_payload)
    analysis_meta = metadata.get("analysis") if isinstance(metadata.get("analysis"), dict) else {}
    stored_prompt_version = _coerce_text(analysis_meta.get("prompt_version"), "", 80)
    stored_cleaning_version = _coerce_text(analysis_meta.get("cleaning_version"), "", 80)
    target_prompt_version = _coerce_text(prompt_version, "", 80)
    target_cleaning_version = _coerce_text(cleaning_version, "", 80)

    if not stored_prompt_version:
        return True
    if target_prompt_version and stored_prompt_version != target_prompt_version:
        return True
    if target_cleaning_version and not stored_cleaning_version:
        return True
    if target_cleaning_version and stored_cleaning_version and stored_cleaning_version != target_cleaning_version:
        return True
    return False


def fi_feedback_row_requires_reanalysis(row: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(row, dict):
        return True
    if not row.get("last_analyzed_at"):
        return True
    return fi_is_analysis_stale(
        row.get("metadata_json"),
        prompt_version=FI_CRM_PROMPT_VERSION,
        cleaning_version=FI_CRM_CLEANING_VERSION,
    )


def _normalize_filter_timestamp(value: Optional[str], *, end_of_day: bool = False) -> Optional[str]:
    text = _coerce_text(value, "", 64)
    if not text:
        return None
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return f"{text}T23:59:59.999999" if end_of_day else text
    return text


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _column_exists(cursor, table_name: str, column_name: str) -> bool:
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
    except Exception:
        return False
    wanted = str(column_name or "").strip().lower()
    for row in cursor.fetchall():
        name_value = ""
        if isinstance(row, dict):
            name_value = row.get("name", "")
        else:
            try:
                name_value = row["name"]
            except Exception:
                try:
                    name_value = row[1]
                except Exception:
                    name_value = ""
        if str(name_value).strip().lower() == wanted:
            return True
    return False


def _sentiment_numeric(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        pass
    text = str(value or "").strip().lower()
    if text == "positive":
        return 1.0
    if text == "negative":
        return -1.0
    return 0.0


def _sentiment_bucket_value(value: Any) -> int:
    text = str(value or "").strip().lower()
    return {"positive": 1, "neutral": 0, "negative": -1}.get(text, 0)


def _churn_bucket_value(value: Any) -> int:
    text = str(value or "").strip().lower()
    return {"high": 3, "medium": 2, "low": 1, "none": 0, "null": 0}.get(text, 0)


def _clamp_float(value: Any, lower: float, upper: float) -> float:
    try:
        numeric = float(value)
    except Exception:
        numeric = lower
    if numeric < lower:
        return lower
    if numeric > upper:
        return upper
    return numeric


def _normalize_date(value: Any) -> Optional[datetime.date]:
    text = _coerce_text(value, "", 40)
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        if len(text) == 10 and text[4] == "-" and text[7] == "-":
            return datetime.strptime(text, "%Y-%m-%d").date()
        return datetime.fromisoformat(text).date()
    except Exception:
        return None


def _is_none_like(value: Any) -> bool:
    text = _coerce_text(value, "", 180).strip().lower()
    return text in NONE_LIKE_TOKENS


def _is_churn_linked_signal(sentiment: Any, sentiment_score: Any, churn_risk: Any, churn_impact: Any) -> bool:
    sentiment_name = str(sentiment or "").strip().lower()
    sentiment_value = _sentiment_numeric(sentiment_score)
    churn_risk_value = _churn_bucket_value(churn_risk)
    churn_impact_value = _churn_bucket_value(churn_impact)
    return bool(
        churn_risk_value >= 2
        or churn_impact_value >= 2
        or sentiment_value < 0
        or sentiment_name == "negative"
    )


def _compute_business_impact_score(
    *,
    churn_risk: Any,
    revenue_sensitivity: Any,
    urgency: Any,
) -> float:
    churn_component = {"high": 100.0, "medium": 65.0, "low": 30.0, "null": 5.0, "none": 5.0}.get(
        str(churn_risk or "").strip().lower(),
        5.0,
    )
    urgency_component = {"high": 100.0, "medium": 65.0, "low": 30.0, "none": 5.0}.get(
        str(urgency or "").strip().lower(),
        5.0,
    )
    revenue_component = 100.0 if bool(revenue_sensitivity) else 0.0
    score = (churn_component * 0.55) + (revenue_component * 0.25) + (urgency_component * 0.20)
    return round(_clamp_float(score, 0.0, 100.0), 2)


def _compute_action_confidence(
    *,
    base_confidence: Any,
    issue: Any,
    root_cause: Any,
    action_recommendation: Any,
    noise_score: Any = 0.0,
    fallback_used: bool = False,
    errored: bool = False,
) -> float:
    confidence = _clamp_float(base_confidence, 0.0, 1.0)
    issue_text = _coerce_text(issue, "", 180)
    root_text = _coerce_text(root_cause, "", 220)
    action_text = _coerce_text(action_recommendation, "", 220)

    if _is_none_like(issue_text) or _is_generic_issue_label(issue_text):
        confidence -= 0.22
    else:
        confidence += 0.08

    if _is_none_like(root_text):
        confidence -= 0.08
    else:
        confidence += 0.03

    if _is_none_like(action_text):
        confidence -= 0.10
    else:
        confidence += 0.05

    confidence -= _clamp_float(noise_score, 0.0, 1.0) * 0.12

    if fallback_used:
        confidence = min(confidence, 0.45)
    if errored:
        confidence = min(confidence, 0.30)

    return round(_clamp_float(confidence, 0.05, 0.99), 4)


def _derive_actionable_pattern_label(
    *,
    issue: Any,
    feature_request: Any,
    user_suggestion: Any,
    root_cause: Any,
    theme_cluster: Any,
    theme_primary: Any,
    pain_point_category: Any,
    text: Any,
) -> str:
    feature_gap_hint = _extract_feature_gap_label(
        feature_request,
        user_suggestion,
        issue,
        root_cause,
        text,
    )
    label = _derive_actionable_issue_label(
        issue,
        feature_request,
        user_suggestion,
        feature_gap_hint,
        root_cause,
        theme_cluster,
        theme_primary,
        pain_point_category,
    )
    if _is_generic_issue_label(label):
        return ""
    return _compact_issue_label(label, 120)


def _pattern_trend_direction(latest_count: int, previous_count: int) -> str:
    latest = max(0, int(latest_count or 0))
    previous = max(0, int(previous_count or 0))
    if previous == 0:
        return "rising" if latest > 0 else "stable"
    change = (latest - previous) / previous
    if change > 0.2:
        return "rising"
    if change < -0.2:
        return "declining"
    return "stable"


def _pattern_recurrence_metrics(
    *,
    mention_count: int,
    active_days: int,
    avg_churn_risk: float,
    latest_count: int,
    previous_count: int,
) -> Dict[str, Any]:
    volume_component = min(1.0, max(0.0, float(mention_count) / 25.0))
    consistency_component = min(1.0, max(0.0, float(active_days) / 14.0))
    risk_component = min(1.0, max(0.0, float(avg_churn_risk) / 3.0))

    change_ratio = (
        1.0 if previous_count <= 0 and latest_count > 0
        else ((latest_count - previous_count) / max(previous_count, 1))
    )
    momentum_component = max(-1.0, min(1.0, change_ratio))
    trend_component = (momentum_component + 1.0) / 2.0

    recurrence_score = round(
        _clamp_float((volume_component * 0.50 + consistency_component * 0.20 + risk_component * 0.30) * 100.0, 0.0, 100.0),
        2,
    )
    trend_score = round(
        _clamp_float((trend_component * 0.55 + risk_component * 0.30 + min(1.0, latest_count / 10.0) * 0.15) * 100.0, 0.0, 100.0),
        2,
    )
    recurring = bool(mention_count >= 3 and active_days >= 2)
    return {
        "recurring": recurring,
        "recurrence_score": recurrence_score,
        "trend_score": trend_score,
        "trend_direction": _pattern_trend_direction(latest_count, previous_count),
    }


def _feedback_hash_text(value: Any) -> str:
    normalized = " ".join(str(value or "").lower().split()).strip()
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def _feedback_id_from_token(value: Any) -> Optional[int]:
    token = str(value or "").strip()
    if not token:
        return None
    if token.startswith("fi_"):
        token = token[3:]
    try:
        feedback_id = int(token)
    except Exception:
        return None
    if feedback_id <= 0:
        return None
    return feedback_id


def _trend_from_values(latest: List[float], previous: List[float], threshold: float = 0.15) -> str:
    if not latest or not previous:
        return "stable"
    latest_avg = sum(latest) / max(len(latest), 1)
    previous_avg = sum(previous) / max(len(previous), 1) if previous else 0.0
    delta = latest_avg - previous_avg
    if delta > threshold:
        return "improving"
    if delta < -threshold:
        return "degrading"
    return "stable"


def _normalize_segment(value: Any, fallback: str = "all") -> str:
    text = _coerce_text(value, fallback, 80).lower()
    return text or fallback


def _normalize_kb_channel(value: Any) -> str:
    text = _coerce_text(value, "any", 20).lower()
    if text not in VALID_KB_CHANNELS:
        return "any"
    return text


def _segment_tokens(value: Any) -> List[str]:
    raw = str(value or "").replace("|", ",").replace(";", ",")
    tokens = []
    for token in raw.split(","):
        normalized = _normalize_segment(token, "")
        if normalized:
            tokens.append(normalized)
    if not tokens:
        return ["all"]
    return tokens


def _normalize_customer_identifier(value: Any, fallback: str = "") -> str:
    return _coerce_text(value, fallback, 180).lower()


def _normalize_customer_identifier_list(value: Any) -> List[str]:
    if isinstance(value, str):
        raw_values = value.replace("|", ",").replace(";", ",").split(",")
    elif isinstance(value, (list, tuple, set)):
        raw_values = list(value)
    else:
        raw_values = []

    seen: set = set()
    normalized: List[str] = []
    for item in raw_values:
        text = _coerce_text(item, "", 180)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def _dict_values_deep(payload: Any):
    queue: List[Any] = [payload]
    while queue:
        current = queue.pop(0)
        if isinstance(current, dict):
            for key, value in current.items():
                yield str(key or "").strip().lower(), value
                if isinstance(value, (dict, list, tuple)):
                    queue.append(value)
        elif isinstance(current, (list, tuple)):
            for item in current:
                if isinstance(item, (dict, list, tuple)):
                    queue.append(item)


def _extract_contact_value(payload: Dict[str, Any], keys: set) -> str:
    for key, value in _dict_values_deep(payload):
        if key in keys and not isinstance(value, (dict, list, tuple)):
            text = _coerce_text(value, "", 180)
            if text:
                return text
    return ""


def _normalize_email(value: Any) -> str:
    text = _coerce_text(value, "", 180).lower()
    if "@" not in text:
        return ""
    local, _, domain = text.partition("@")
    if not local or "." not in domain:
        return ""
    return text


def _normalize_mobile(value: Any) -> str:
    raw = _coerce_text(value, "", 32)
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) < 7:
        return ""
    if raw.startswith("+"):
        return f"+{digits}"
    if digits.startswith("00") and len(digits) > 2:
        return f"+{digits[2:]}"
    return digits


def _guess_name_from_identifier(identifier: str) -> str:
    ident = _coerce_text(identifier, "", 120)
    if not ident:
        return ""
    if "@" in ident:
        stem = ident.split("@", 1)[0]
        stem = stem.replace(".", " ").replace("_", " ").replace("-", " ")
        return _coerce_text(stem.title(), "", 80)
    digits = "".join(ch for ch in ident if ch.isdigit())
    if len(digits) >= 7:
        return "Customer"
    return _coerce_text(ident, "", 80)


def _extract_feedback_contact(metadata: Dict[str, Any], customer_identifier: str = "") -> Dict[str, str]:
    email = _normalize_email(_extract_contact_value(metadata, CONTACT_EMAIL_KEYS))
    mobile = _normalize_mobile(_extract_contact_value(metadata, CONTACT_PHONE_KEYS))
    name = _coerce_text(_extract_contact_value(metadata, CONTACT_NAME_KEYS), "", 80)

    identifier = _coerce_text(customer_identifier, "", 180)
    if identifier:
        if not email:
            email = _normalize_email(identifier)
        if not mobile:
            mobile = _normalize_mobile(identifier)
        if not name:
            name = _guess_name_from_identifier(identifier)

    if not name and email:
        name = _guess_name_from_identifier(email)
    if not name:
        name = "Customer"

    return {
        "name": name,
        "email": email,
        "mobile": mobile,
    }


def _render_template(template: str, context: Dict[str, Any]) -> str:
    output = str(template or "")
    for key, value in context.items():
        output = output.replace("{" + str(key) + "}", str(value or ""))
    return output.strip()


def _is_offer_segment_match(offer_segment: str, feedback_segment: str) -> bool:
    offer_tokens = _segment_tokens(offer_segment)
    feedback = _normalize_segment(feedback_segment, "all")
    return feedback in offer_tokens or any(token in ALL_SEGMENT_TOKENS for token in offer_tokens)


def _serialize_kb_offer_row(row: Any) -> Dict[str, Any]:
    item = dict(row)
    item["channel"] = _normalize_kb_channel(item.get("channel"))
    item["segment"] = _normalize_segment(item.get("segment"), "all")
    item["customer_identifiers"] = _normalize_customer_identifier_list(
        _json_load_list(item.get("customer_identifiers_json"))
    )
    item["active"] = bool(item.get("active"))
    item["priority"] = int(item.get("priority") or 100)
    return item


def _list_kb_offer_rows(cursor, tenant_id: int, *, active_only: bool = False) -> List[Dict[str, Any]]:
    query = """
        SELECT
            id, tenant_id, name, segment, channel, offer_title, offer_details,
            discount_code, cta_text, email_subject, template_email, template_sms,
            customer_identifiers_json, priority, active, created_at, updated_at
        FROM fi_offer_knowledge_base
        WHERE tenant_id = ?
    """
    params: List[Any] = [tenant_id]
    if active_only:
        query += " AND active = 1"
    query += " ORDER BY priority ASC, id DESC"
    cursor.execute(query, params)
    return [_serialize_kb_offer_row(row) for row in cursor.fetchall()]


def _offer_targets_customer(offer: Dict[str, Any], customer_identifier: str) -> bool:
    normalized_identifier = _normalize_customer_identifier(customer_identifier, "")
    if not normalized_identifier:
        return False
    targets = {
        _normalize_customer_identifier(item, "")
        for item in (offer.get("customer_identifiers") or [])
        if _normalize_customer_identifier(item, "")
    }
    return normalized_identifier in targets


def _offer_sort_key(offer: Dict[str, Any]) -> Tuple[int, int]:
    return (int(offer.get("priority") or 100), -int(offer.get("id") or 0))


def _select_best_offer(
    offers: List[Dict[str, Any]],
    feedback_segment: str,
    customer_identifier: str = "",
) -> Optional[Dict[str, Any]]:
    if not offers:
        return None
    customer_specific = [offer for offer in offers if _offer_targets_customer(offer, customer_identifier)]
    if customer_specific:
        return sorted(customer_specific, key=_offer_sort_key)[0]
    normalized_segment = _normalize_segment(feedback_segment, "all")
    exact = [offer for offer in offers if _is_offer_segment_match(str(offer.get("segment") or "all"), normalized_segment)]
    if exact:
        return sorted(exact, key=_offer_sort_key)[0]
    fallback = [offer for offer in offers if _normalize_segment(offer.get("segment"), "all") in ALL_SEGMENT_TOKENS]
    if fallback:
        return sorted(fallback, key=_offer_sort_key)[0]
    return None


def _available_channels(channel: str, contact: Dict[str, str]) -> List[str]:
    selected_channel = _normalize_kb_channel(channel)
    email_ready = bool(contact.get("email"))
    sms_ready = bool(contact.get("mobile"))
    if selected_channel == "email":
        return ["email"] if email_ready else []
    if selected_channel == "sms":
        return ["sms"] if sms_ready else []
    if selected_channel == "both":
        channels: List[str] = []
        if email_ready:
            channels.append("email")
        if sms_ready:
            channels.append("sms")
        return channels
    channels = []
    if email_ready:
        channels.append("email")
    if sms_ready:
        channels.append("sms")
    return channels


def _upsert_outreach_draft(
    cursor,
    *,
    tenant_id: int,
    feedback_id: int,
    kb_offer_id: int,
    channel: str,
    recipient_name: str,
    recipient_email: str,
    recipient_mobile: str,
    subject: str,
    message: str,
    auto_generated: bool,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    cursor.execute(
        """
        DELETE FROM fi_outreach_drafts
        WHERE tenant_id = ? AND feedback_id = ? AND channel = ? AND auto_generated = ?
        """,
        (tenant_id, feedback_id, channel, 1 if auto_generated else 0),
    )
    cursor.execute(
        """
        INSERT INTO fi_outreach_drafts (
            tenant_id, feedback_id, kb_offer_id, channel,
            recipient_name, recipient_email, recipient_mobile,
            subject, message, status, auto_generated, metadata_json,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, CURRENT_TIMESTAMP)
        """,
        (
            tenant_id,
            feedback_id,
            kb_offer_id,
            channel,
            _coerce_text(recipient_name, "Customer", 80),
            _coerce_text(recipient_email, "", 180),
            _coerce_text(recipient_mobile, "", 32),
            _coerce_text(subject, "", 220),
            _coerce_text(message, "", 2400),
            1 if auto_generated else 0,
            _safe_json_dumps(metadata or {}),
        ),
    )
    return int(cursor.lastrowid or 0)


def _build_agentic_outreach(
    feedback_row: Dict[str, Any],
    *,
    metadata: Dict[str, Any],
    offers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    customer_identifier = _coerce_text(feedback_row.get("customer_identifier"), "", 180)
    feedback_segment = _normalize_segment(
        feedback_row.get("user_segment")
        or (metadata.get("analysis") or {}).get("user_segment")
        or metadata.get("user_segment"),
        "all",
    )
    selected_offer = _select_best_offer(offers, feedback_segment, customer_identifier)
    if not selected_offer:
        return {
            "status": "skipped",
            "reason": "No active offer available in the knowledge base for this segment.",
            "segment": feedback_segment,
            "drafts": {},
        }

    contact = _extract_feedback_contact(metadata, customer_identifier)
    if not contact.get("email") and not contact.get("mobile"):
        return {
            "status": "skipped",
            "reason": "No customer email or mobile number found in the feedback metadata.",
            "segment": feedback_segment,
            "offer_id": int(selected_offer.get("id") or 0),
            "offer_name": _coerce_text(selected_offer.get("name"), "", 120),
            "drafts": {},
        }

    channels = _available_channels(str(selected_offer.get("channel") or "any"), contact)
    if not channels:
        return {
            "status": "skipped",
            "reason": "Offer channel does not match available customer contact details.",
            "segment": feedback_segment,
            "offer_id": int(selected_offer.get("id") or 0),
            "offer_name": _coerce_text(selected_offer.get("name"), "", 120),
            "contact": contact,
            "drafts": {},
        }

    offer_title = _coerce_text(selected_offer.get("offer_title"), "Exclusive offer", 160)
    offer_details = _coerce_text(selected_offer.get("offer_details"), "", 420)
    discount_code = _coerce_text(selected_offer.get("discount_code"), "", 80)
    cta_text = _coerce_text(selected_offer.get("cta_text"), "Reply to this message and we will help right away.", 220)
    feedback_summary = _coerce_text(feedback_row.get("text"), "", 260)
    issue_name = _coerce_text(
        feedback_row.get("issue_name")
        or (metadata.get("analysis") or {}).get("theme_cluster")
        or (metadata.get("analysis") or {}).get("pain_point_category"),
        "your recent feedback",
        140,
    )
    source = _coerce_text(feedback_row.get("source"), "feedback", 80)
    sentiment = _coerce_text(feedback_row.get("sentiment"), "neutral", 20).lower()
    discount_line = f"Use code {discount_code}." if discount_code else ""

    context = {
        "customer_name": _coerce_text(contact.get("name"), "Customer", 80),
        "segment": feedback_segment,
        "offer_title": offer_title,
        "offer_details": offer_details,
        "discount_code": discount_code,
        "discount_line": discount_line,
        "cta_text": cta_text,
        "feedback_summary": feedback_summary,
        "issue_name": issue_name,
        "source": source,
        "sentiment": sentiment,
    }

    email_subject_template = _coerce_text(selected_offer.get("email_subject"), "{offer_title} for you", 220)
    email_template = _coerce_text(
        selected_offer.get("template_email"),
        (
            "Hi {customer_name},\n\n"
            "Thank you for sharing feedback about {issue_name}. We heard you and want to help immediately.\n\n"
            "{offer_title}\n"
            "{offer_details}\n"
            "{discount_line}\n\n"
            "{cta_text}\n\n"
            "Best regards,\nCustomer Experience Team"
        ),
        2200,
    )
    sms_template = _coerce_text(
        selected_offer.get("template_sms"),
        "Hi {customer_name}, thanks for your feedback. {offer_title}: {offer_details} {discount_line} {cta_text}",
        520,
    )

    drafts: Dict[str, Dict[str, str]] = {}
    if "email" in channels:
        email_subject = _render_template(email_subject_template, context)
        email_body = _render_template(email_template, context)
        drafts["email"] = {
            "subject": _coerce_text(email_subject, offer_title, 220),
            "message": _coerce_text(email_body, "", 2200),
            "to": contact.get("email", ""),
        }
    if "sms" in channels:
        sms_body = _render_template(sms_template, context)
        drafts["sms"] = {
            "subject": "",
            "message": _coerce_text(sms_body, "", 320),
            "to": contact.get("mobile", ""),
        }

    return {
        "status": "ready",
        "segment": feedback_segment,
        "offer_id": int(selected_offer.get("id") or 0),
        "offer_name": _coerce_text(selected_offer.get("name"), "", 120),
        "offer_title": offer_title,
        "offer_channel": _normalize_kb_channel(selected_offer.get("channel")),
        "contact": contact,
        "drafts": drafts,
    }


# ──────────────────────────────────────────────────────────────────────────────
# DATABASE SCHEMA — called once from init_database()
# ──────────────────────────────────────────────────────────────────────────────

def init_crm_tables():
    """Create the Feedback Intelligence CRM tables (idempotent)."""
    conn = get_db_connection()
    c = conn.cursor()

    # ── Customers ──────────────────────────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            customer_identifier TEXT NOT NULL,
            first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_feedback_at TIMESTAMP,
            total_feedback_count INTEGER DEFAULT 0,
            overall_sentiment TEXT DEFAULT 'neutral',
            sentiment_trend TEXT DEFAULT 'stable',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, customer_identifier),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    # ── Issues ─────────────────────────────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            mention_count INTEGER DEFAULT 0,
            negative_ratio REAL DEFAULT 0.0,
            impact_score REAL DEFAULT 0.0,
            trend TEXT DEFAULT 'stable',
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    # ── Feedback ───────────────────────────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            sentiment TEXT DEFAULT 'neutral',
            sentiment_score REAL DEFAULT 0.0,
            confidence REAL DEFAULT 0.0,
            action_confidence REAL DEFAULT 0.0,
            business_impact_score REAL DEFAULT 0.0,
            churn_risk TEXT DEFAULT 'null',
            churn_impact TEXT DEFAULT 'none',
            pain_point_category TEXT DEFAULT 'Other',
            theme_primary TEXT DEFAULT 'None',
            theme_cluster TEXT DEFAULT 'None',
            cluster_label TEXT DEFAULT 'None',
            user_segment TEXT DEFAULT 'Neutral',
            solving_priority TEXT DEFAULT 'medium',
            journey_stage TEXT DEFAULT 'unknown',
            action_owner TEXT DEFAULT 'Unknown',
            source TEXT DEFAULT 'manual',
            source_type TEXT DEFAULT 'other',
            rating INTEGER,
            metadata_json TEXT,
            customer_id INTEGER,
            issue_id INTEGER,
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'medium',
            last_analyzed_at TIMESTAMP,
            analysis_run_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES fi_customers(id) ON DELETE SET NULL,
            FOREIGN KEY (issue_id) REFERENCES fi_issues(id) ON DELETE SET NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_fetch_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER,
            status TEXT DEFAULT 'success',
            scope TEXT DEFAULT 'full',
            source_ids_json TEXT,
            start_date TEXT,
            end_date TEXT,
            fetched_count INTEGER DEFAULT 0,
            imported_count INTEGER DEFAULT 0,
            skipped_count INTEGER DEFAULT 0,
            connector_results_json TEXT,
            metadata_json TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_analysis_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER,
            status TEXT DEFAULT 'queued',
            source TEXT,
            source_ids_json TEXT,
            start_date TEXT,
            end_date TEXT,
            total_reviews INTEGER DEFAULT 0,
            analyzed_reviews INTEGER DEFAULT 0,
            fallback_reviews INTEGER DEFAULT 0,
            unresolved_reviews INTEGER DEFAULT 0,
            dropped_reviews INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            billable_tokens INTEGER DEFAULT 0,
            prompt_version TEXT DEFAULT '',
            cleaning_version TEXT DEFAULT '',
            summary_json TEXT,
            trends_json TEXT,
            metadata_json TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            analysis_run_id INTEGER NOT NULL,
            feedback_id INTEGER NOT NULL,
            source TEXT,
            source_type TEXT,
            sentiment TEXT DEFAULT 'neutral',
            sentiment_score REAL DEFAULT 0.0,
            churn_risk TEXT DEFAULT 'null',
            churn_impact TEXT DEFAULT 'none',
            pain_point_category TEXT DEFAULT 'Other',
            issue TEXT DEFAULT '',
            root_cause TEXT DEFAULT '',
            solving_priority TEXT DEFAULT 'medium',
            action_owner TEXT DEFAULT 'Unknown',
            action_confidence REAL DEFAULT 0.0,
            business_impact_score REAL DEFAULT 0.0,
            theme_primary TEXT DEFAULT 'None',
            theme_cluster TEXT DEFAULT 'None',
            cluster_label TEXT DEFAULT 'None',
            user_segment TEXT DEFAULT 'Neutral',
            journey_stage TEXT DEFAULT 'unknown',
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (analysis_run_id) REFERENCES fi_analysis_runs(id) ON DELETE CASCADE,
            FOREIGN KEY (feedback_id) REFERENCES fi_feedback(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_issue_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            pattern_key TEXT NOT NULL,
            pattern_label TEXT NOT NULL,
            mention_count INTEGER DEFAULT 0,
            churn_linked_count INTEGER DEFAULT 0,
            high_churn_count INTEGER DEFAULT 0,
            avg_sentiment_score REAL DEFAULT 0.0,
            avg_churn_risk REAL DEFAULT 0.0,
            latest_7d_count INTEGER DEFAULT 0,
            previous_7d_count INTEGER DEFAULT 0,
            recurring_flag INTEGER DEFAULT 0,
            recurrence_score REAL DEFAULT 0.0,
            trend_direction TEXT DEFAULT 'stable',
            trend_score REAL DEFAULT 0.0,
            first_seen_at TIMESTAMP,
            last_seen_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, pattern_key),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_offer_knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            segment TEXT DEFAULT 'all',
            channel TEXT DEFAULT 'any',
            offer_title TEXT NOT NULL,
            offer_details TEXT DEFAULT '',
            discount_code TEXT DEFAULT '',
            cta_text TEXT DEFAULT '',
            email_subject TEXT DEFAULT '',
            template_email TEXT DEFAULT '',
            template_sms TEXT DEFAULT '',
            customer_identifiers_json TEXT DEFAULT '[]',
            priority INTEGER DEFAULT 100,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_delivery_connectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            connector_type TEXT NOT NULL DEFAULT 'email',
            name TEXT NOT NULL DEFAULT 'Primary Email',
            config_json TEXT NOT NULL DEFAULT '{}',
            active INTEGER DEFAULT 1,
            last_error TEXT DEFAULT '',
            last_tested_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, connector_type),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS fi_outreach_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            feedback_id INTEGER NOT NULL,
            kb_offer_id INTEGER NOT NULL,
            channel TEXT NOT NULL,
            recipient_name TEXT DEFAULT '',
            recipient_email TEXT DEFAULT '',
            recipient_mobile TEXT DEFAULT '',
            subject TEXT DEFAULT '',
            message TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            auto_generated INTEGER DEFAULT 0,
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (feedback_id) REFERENCES fi_feedback(id) ON DELETE CASCADE,
            FOREIGN KEY (kb_offer_id) REFERENCES fi_offer_knowledge_base(id) ON DELETE CASCADE
        )
    ''')

    # ── Indexes ────────────────────────────────────────────────────────────
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_tenant ON fi_feedback(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_status ON fi_feedback(tenant_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_issue ON fi_feedback(issue_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_customer ON fi_feedback(customer_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_created ON fi_feedback(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_sentiment ON fi_feedback(tenant_id, sentiment)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issues_tenant ON fi_issues(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issues_impact ON fi_issues(tenant_id, impact_score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issue_memory_rank ON fi_issue_memory(tenant_id, recurrence_score DESC, trend_score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_customers_tenant ON fi_customers(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_kb_tenant ON fi_offer_knowledge_base(tenant_id, active, priority)",
        "CREATE INDEX IF NOT EXISTS idx_fi_delivery_connector ON fi_delivery_connectors(tenant_id, connector_type, active)",
        "CREATE INDEX IF NOT EXISTS idx_fi_outreach_tenant ON fi_outreach_drafts(tenant_id, feedback_id, created_at DESC)",
    ]:
        try:
            c.execute(idx_sql)
        except Exception:
            pass

    conn.commit()
    
    # ── Schema Migrations ──────────────────────────────────────────────────
    # Added conditionally for the Universal Connector Ingestion schema update
    try:
        c.execute("ALTER TABLE fi_feedback ADD COLUMN source_type TEXT DEFAULT 'other'")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE fi_feedback ADD COLUMN rating INTEGER")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE fi_feedback ADD COLUMN metadata_json TEXT")
    except Exception:
        pass
    for alter_sql in [
        "ALTER TABLE fi_feedback ADD COLUMN sentiment_score REAL DEFAULT 0.0",
        "ALTER TABLE fi_feedback ADD COLUMN confidence REAL DEFAULT 0.0",
        "ALTER TABLE fi_feedback ADD COLUMN churn_risk TEXT DEFAULT 'null'",
        "ALTER TABLE fi_feedback ADD COLUMN churn_impact TEXT DEFAULT 'none'",
        "ALTER TABLE fi_feedback ADD COLUMN pain_point_category TEXT DEFAULT 'Other'",
        "ALTER TABLE fi_feedback ADD COLUMN theme_primary TEXT DEFAULT 'None'",
        "ALTER TABLE fi_feedback ADD COLUMN theme_cluster TEXT DEFAULT 'None'",
        "ALTER TABLE fi_feedback ADD COLUMN cluster_label TEXT DEFAULT 'None'",
        "ALTER TABLE fi_feedback ADD COLUMN user_segment TEXT DEFAULT 'Neutral'",
        "ALTER TABLE fi_feedback ADD COLUMN solving_priority TEXT DEFAULT 'medium'",
        "ALTER TABLE fi_feedback ADD COLUMN journey_stage TEXT DEFAULT 'unknown'",
        "ALTER TABLE fi_feedback ADD COLUMN action_owner TEXT DEFAULT 'Unknown'",
        "ALTER TABLE fi_feedback ADD COLUMN action_confidence REAL DEFAULT 0.0",
        "ALTER TABLE fi_feedback ADD COLUMN business_impact_score REAL DEFAULT 0.0",
        "ALTER TABLE fi_feedback ADD COLUMN last_analyzed_at TIMESTAMP",
        "ALTER TABLE fi_feedback ADD COLUMN analysis_run_id INTEGER",
    ]:
        try:
            c.execute(alter_sql)
        except Exception:
            pass
    for alter_sql in [
        "ALTER TABLE fi_analysis_results ADD COLUMN action_confidence REAL DEFAULT 0.0",
        "ALTER TABLE fi_analysis_results ADD COLUMN business_impact_score REAL DEFAULT 0.0",
    ]:
        try:
            c.execute(alter_sql)
        except Exception:
            pass
    for alter_sql in [
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN email_subject TEXT DEFAULT ''",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN template_email TEXT DEFAULT ''",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN template_sms TEXT DEFAULT ''",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN customer_identifiers_json TEXT DEFAULT '[]'",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN priority INTEGER DEFAULT 100",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN active INTEGER DEFAULT 1",
        "ALTER TABLE fi_offer_knowledge_base ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ]:
        try:
            c.execute(alter_sql)
        except Exception:
            pass
    # Remove legacy Slack-seeded CRM records so they do not reappear in the inbox by default.
    try:
        c.execute("DELETE FROM fi_feedback WHERE LOWER(COALESCE(source_type, '')) = 'slack'")
        c.execute("DELETE FROM fi_feedback WHERE LOWER(COALESCE(source, '')) = 'slack'")
        c.execute("DELETE FROM fi_feedback WHERE LOWER(COALESCE(source, '')) LIKE 'slack (%'")
    except Exception:
        pass
    try:
        _backfill_feedback_analysis_columns(c)
    except Exception:
        logger.exception("[FI-CRM] Failed to backfill structured feedback analysis columns")
    try:
        c.execute("SELECT DISTINCT tenant_id FROM fi_feedback WHERE last_analyzed_at IS NOT NULL")
        for tenant_row in c.fetchall():
            tenant_value = int(tenant_row["tenant_id"])
            if tenant_value > 0:
                _refresh_issue_pattern_memory(c, tenant_value)
    except Exception:
        logger.exception("[FI-CRM] Failed to refresh issue pattern memory during initialization")
    conn.commit()

    
    c.execute('''
        CREATE TABLE IF NOT EXISTS feedback_intelligence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            feedback_id INTEGER,
            feedback TEXT NOT NULL,
            feedback_hash TEXT NOT NULL,
            sentiment TEXT DEFAULT 'neutral',
            churn_risk TEXT DEFAULT 'low',
            primary_issue TEXT DEFAULT '',
            reason TEXT DEFAULT '',
            best_action TEXT DEFAULT '',
            suggested_message TEXT DEFAULT '',
            rescue_status TEXT DEFAULT 'not_triggered',
            rescue_provider TEXT DEFAULT 'none',
            rescue_payload_json TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (feedback_id) REFERENCES fi_feedback(id) ON DELETE SET NULL,
            UNIQUE(tenant_id, user_id, feedback_id),
            UNIQUE(tenant_id, user_id, feedback_hash)
        )
    ''')
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_tenant ON fi_feedback(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_status ON fi_feedback(tenant_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_issue ON fi_feedback(issue_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_customer ON fi_feedback(customer_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_created ON fi_feedback(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_sentiment ON fi_feedback(tenant_id, sentiment)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_churn ON fi_feedback(tenant_id, churn_risk, churn_impact)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_theme ON fi_feedback(tenant_id, theme_primary, theme_cluster)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_priority ON fi_feedback(tenant_id, solving_priority, priority)",
        "CREATE INDEX IF NOT EXISTS idx_fi_feedback_analysis_state ON fi_feedback(tenant_id, last_analyzed_at, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issues_tenant ON fi_issues(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issues_impact ON fi_issues(tenant_id, impact_score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_issue_memory_rank ON fi_issue_memory(tenant_id, recurrence_score DESC, trend_score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_customers_tenant ON fi_customers(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_fetch_runs_tenant ON fi_fetch_runs(tenant_id, completed_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_analysis_runs_tenant ON fi_analysis_runs(tenant_id, completed_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_fi_analysis_results_run ON fi_analysis_results(analysis_run_id, feedback_id)",
        "CREATE INDEX IF NOT EXISTS idx_fi_kb_tenant ON fi_offer_knowledge_base(tenant_id, active, priority)",
        "CREATE INDEX IF NOT EXISTS idx_fi_outreach_tenant ON fi_outreach_drafts(tenant_id, feedback_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_feedback_intelligence_user ON feedback_intelligence(tenant_id, user_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_feedback_intelligence_churn ON feedback_intelligence(tenant_id, user_id, churn_risk, created_at DESC)",
    ]:
        try:
            c.execute(idx_sql)
        except Exception:
            pass
    conn.commit()
    
    conn.close()
    logger.info("[FI-CRM] Tables initialized")


def _backfill_feedback_analysis_columns(cursor) -> None:
    cursor.execute(
        """
        SELECT id, sentiment, metadata_json
        FROM fi_feedback
        WHERE metadata_json IS NOT NULL
        """
    )
    for row in cursor.fetchall():
        metadata = _json_load_dict(row["metadata_json"])
        analysis = metadata.get("analysis") if isinstance(metadata.get("analysis"), dict) else {}
        if not analysis:
            continue

        theme_primary = _coerce_text(
            analysis.get("theme_primary") or analysis.get("trending_theme"),
            "None",
            120,
        )
        theme_cluster = _coerce_text(
            analysis.get("theme_cluster") or analysis.get("trending_theme"),
            "None",
            120,
        )
        cluster_label = _coerce_text(
            analysis.get("cluster_label") or analysis.get("theme_cluster") or analysis.get("trending_theme"),
            "None",
            120,
        )

        cursor.execute(
            """
            UPDATE fi_feedback
            SET sentiment_score = ?,
                confidence = ?,
                action_confidence = ?,
                business_impact_score = ?,
                churn_risk = ?,
                churn_impact = ?,
                pain_point_category = ?,
                theme_primary = ?,
                theme_cluster = ?,
                cluster_label = ?,
                user_segment = ?,
                solving_priority = ?,
                journey_stage = ?,
                action_owner = ?,
                priority = ?,
                last_analyzed_at = COALESCE(last_analyzed_at, ?)
            WHERE id = ?
            """,
            (
                float(analysis.get("sentiment_score", 0.0) or 0.0),
                float(analysis.get("confidence", 0.0) or 0.0),
                _compute_action_confidence(
                    base_confidence=analysis.get("action_confidence", analysis.get("confidence", 0.0)),
                    issue=analysis.get("issue"),
                    root_cause=analysis.get("root_cause"),
                    action_recommendation=analysis.get("action_recommendation"),
                    noise_score=analysis.get("noise_score", 0.0),
                    fallback_used=bool(analysis.get("fallback_reason")),
                    errored=False,
                ),
                _compute_business_impact_score(
                    churn_risk=analysis.get("churn_risk"),
                    revenue_sensitivity=analysis.get("revenue_sensitivity", False),
                    urgency=analysis.get("urgency"),
                ),
                _coerce_text(analysis.get("churn_risk"), "null", 20).lower(),
                _coerce_text(analysis.get("churn_impact"), "none", 20).lower(),
                _coerce_text(analysis.get("pain_point_category"), "Other", 40),
                theme_primary,
                theme_cluster,
                cluster_label,
                _coerce_text(analysis.get("user_segment"), "Neutral", 30),
                _coerce_text(analysis.get("solving_priority"), "medium", 20).lower(),
                _coerce_text(analysis.get("journey_stage"), "unknown", 30).lower(),
                _coerce_text(analysis.get("action_owner"), "Unknown", 40),
                _coerce_text(analysis.get("solving_priority"), "medium", 20).lower(),
                metadata.get("analysis_updated_at") or datetime.utcnow().isoformat(),
                int(row["id"]),
            ),
        )


# ──────────────────────────────────────────────────────────────────────────────
# FEEDBACK CRUD
# ──────────────────────────────────────────────────────────────────────────────

def fi_list_feedback(
    tenant_id: int,
    *,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    sentiment: Optional[str] = None,
    source: Optional[str] = None,
    source_type: Optional[str] = None,
    issue_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """Return paginated feedback list with optional filters."""
    conn = get_db_connection()
    c = conn.cursor()

    where = [
        "f.tenant_id = ?",
        "LOWER(COALESCE(f.source_type, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) NOT LIKE 'slack (%'",
    ]
    params: list = [tenant_id]
    has_cxm_sources = _table_exists(c, "cxm_sources")
    if has_cxm_sources:
        where.append(
            """
            (
                COALESCE(f.metadata_json, '') = ''
                OR json_valid(f.metadata_json) = 0
                OR json_extract(f.metadata_json, '$.cxm_source_id') IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM cxm_sources s
                    WHERE s.id = CAST(json_extract(f.metadata_json, '$.cxm_source_id') AS INTEGER)
                      AND s.tenant_id = f.tenant_id
                      AND s.is_active = 1
                )
            )
            """
        )

    if status:
        where.append("f.status = ?")
        params.append(status)
    if priority:
        where.append("f.last_analyzed_at IS NOT NULL")
        where.append("f.priority = ?")
        params.append(priority)
    normalized_ratings: List[int] = []
    if rating_values:
        seen_ratings = set()
        for raw_rating in rating_values:
            try:
                rating_value = int(raw_rating)
            except Exception:
                continue
            if rating_value < 1 or rating_value > 5 or rating_value in seen_ratings:
                continue
            seen_ratings.add(rating_value)
            normalized_ratings.append(rating_value)
    if normalized_ratings:
        placeholders = ",".join(["?"] * len(normalized_ratings))
        where.append(f"f.rating IN ({placeholders})")
        params.extend(normalized_ratings)
    elif rating is not None:
        try:
            rating_value = int(rating)
        except Exception:
            rating_value = 0
        if 1 <= rating_value <= 5:
            where.append("f.rating = ?")
            params.append(rating_value)
    if sentiment:
        where.append("f.last_analyzed_at IS NOT NULL")
        where.append("LOWER(COALESCE(f.sentiment, '')) = ?")
        params.append(str(sentiment).strip().lower())
    if source:
        where.append("f.source = ?")
        params.append(source)
    if source_type:
        where.append("LOWER(COALESCE(f.source_type, '')) = ?")
        params.append(str(source_type).strip().lower())
    if issue_id is not None:
        where.append("f.issue_id = ?")
        params.append(issue_id)
    if customer_id is not None:
        where.append("f.customer_id = ?")
        params.append(customer_id)
    if search:
        where.append("f.text LIKE ?")
        params.append(f"%{search}%")
    normalized_start_date = _normalize_filter_timestamp(start_date)
    normalized_end_date = _normalize_filter_timestamp(end_date, end_of_day=True)
    if normalized_start_date:
        where.append("f.created_at >= ?")
        params.append(normalized_start_date)
    if normalized_end_date:
        where.append("f.created_at <= ?")
        params.append(normalized_end_date)

    where_clause = " AND ".join(where)

    # Count
    c.execute(f"SELECT COUNT(*) FROM fi_feedback f WHERE {where_clause}", params)
    total = c.fetchone()[0]

    # Fetch
    c.execute(f"""
        SELECT f.*,
               i.name AS issue_name,
               cu.customer_identifier
        FROM fi_feedback f
        LEFT JOIN fi_issues i ON i.id = f.issue_id
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE {where_clause}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])

    items = [dict(row) for row in c.fetchall()]

    source_where = [
        "f.tenant_id = ?",
        "LOWER(COALESCE(f.source_type, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) NOT LIKE 'slack (%'",
    ]
    if has_cxm_sources:
        source_where.append(
            """
            (
                COALESCE(f.metadata_json, '') = ''
                OR json_valid(f.metadata_json) = 0
                OR json_extract(f.metadata_json, '$.cxm_source_id') IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM cxm_sources s
                    WHERE s.id = CAST(json_extract(f.metadata_json, '$.cxm_source_id') AS INTEGER)
                      AND s.tenant_id = f.tenant_id
                      AND s.is_active = 1
                )
            )
            """
        )
    source_where_clause = " AND ".join(source_where)
    c.execute(
        f"""
        SELECT f.source, f.source_type, COUNT(*) AS count
        FROM fi_feedback f
        WHERE {source_where_clause}
        GROUP BY f.source, f.source_type
        ORDER BY count DESC, f.source ASC
        """,
        (tenant_id,),
    )
    source_options = [
        {
            "source": row["source"],
            "source_type": row["source_type"],
            "count": int(row["count"] or 0),
        }
        for row in c.fetchall()
        if row["source"]
    ]
    conn.close()
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "source_options": source_options,
    }


def fi_get_feedback(feedback_id: int, tenant_id: int) -> Optional[Dict]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT f.*, i.name AS issue_name, cu.customer_identifier
        FROM fi_feedback f
        LEFT JOIN fi_issues i ON i.id = f.issue_id
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE f.id = ? AND f.tenant_id = ?
    """, (feedback_id, tenant_id))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def fi_create_feedback(
    tenant_id: int,
    text: str,
    *,
    sentiment: str = "neutral",
    source: str = "manual",
    source_type: str = "other",
    rating: Optional[int] = None,
    metadata_json: Optional[str] = None,
    customer_identifier: Optional[str] = None,
    issue_id: Optional[int] = None,
    priority: str = "medium",
    created_at: Optional[str] = None,
) -> int:
    """Create a feedback item. Auto-creates/links customer if identifier provided."""
    conn = get_db_connection()
    c = conn.cursor()

    customer_id = None
    if customer_identifier:
        customer_id = _upsert_customer(c, tenant_id, customer_identifier)

    created_at_value = _coerce_text(created_at, "", 64)
    if created_at_value:
        c.execute("""
            INSERT INTO fi_feedback (tenant_id, text, sentiment, source, source_type, rating, metadata_json, customer_id, issue_id, status, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        """, (tenant_id, text, sentiment, source, source_type, rating, metadata_json, customer_id, issue_id, priority, created_at_value))
    else:
        c.execute("""
            INSERT INTO fi_feedback (tenant_id, text, sentiment, source, source_type, rating, metadata_json, customer_id, issue_id, status, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        """, (tenant_id, text, sentiment, source, source_type, rating, metadata_json, customer_id, issue_id, priority))
    fid = c.lastrowid

    # Update customer stats
    if customer_id:
        _refresh_customer_stats(c, customer_id)

    # Update issue stats if linked
    if issue_id:
        _refresh_issue_stats(c, tenant_id, issue_id)

    conn.commit()
    conn.close()
    return fid


def fi_update_feedback_status(feedback_id: int, tenant_id: int, status: str) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE fi_feedback SET status = ? WHERE id = ? AND tenant_id = ?",
              (status, feedback_id, tenant_id))
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def fi_update_feedback_priority(feedback_id: int, tenant_id: int, priority: str) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE fi_feedback SET priority = ? WHERE id = ? AND tenant_id = ?",
              (priority, feedback_id, tenant_id))
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def fi_get_feedback_records_for_analysis(
    tenant_id: int,
    *,
    feedback_ids: Optional[List[int]] = None,
    include_analyzed: bool = True,
    source: Optional[str] = None,
    source_ids: Optional[List[int]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return feedback rows with enough context for Feedback CRM analysis.

    Set include_analyzed=False to return only pending rows that have never been analyzed.
    """
    conn = get_db_connection()
    c = conn.cursor()

    query = """
        SELECT
            f.id,
            f.text,
            f.rating,
            f.source,
            f.source_type,
            f.created_at,
            f.last_analyzed_at,
            f.metadata_json,
            f.customer_id,
            cu.customer_identifier
        FROM fi_feedback f
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE f.tenant_id = ?
    """
    params: List[Any] = [tenant_id]

    normalized_feedback_ids: List[int] = []
    if feedback_ids:
        seen_feedback_ids = set()
        for raw_feedback_id in feedback_ids:
            try:
                value = int(raw_feedback_id)
            except Exception:
                continue
            if value <= 0 or value in seen_feedback_ids:
                continue
            seen_feedback_ids.add(value)
            normalized_feedback_ids.append(value)
    if normalized_feedback_ids:
        placeholders = ",".join(["?"] * len(normalized_feedback_ids))
        query += f" AND f.id IN ({placeholders})"
        params.extend(normalized_feedback_ids)

    if source:
        query += " AND f.source = ?"
        params.append(source)
    if source_ids:
        source_ids = [int(sid) for sid in source_ids if sid]
        if source_ids:
            placeholders = ",".join(["?"] * len(source_ids))
            query += (
                " AND json_extract(f.metadata_json, '$.cxm_source_id') IS NOT NULL"
                f" AND CAST(json_extract(f.metadata_json, '$.cxm_source_id') AS INTEGER) IN ({placeholders})"
            )
            params.extend(source_ids)
    normalized_start_date = _normalize_filter_timestamp(start_date)
    normalized_end_date = _normalize_filter_timestamp(end_date, end_of_day=True)
    if normalized_start_date:
        query += " AND f.created_at >= ?"
        params.append(normalized_start_date)
    if normalized_end_date:
        query += " AND f.created_at <= ?"
        params.append(normalized_end_date)
    normalized_ratings: List[int] = []
    if rating_values:
        seen_ratings = set()
        for raw_rating in rating_values:
            try:
                value = int(raw_rating)
            except Exception:
                continue
            if value < 1 or value > 5 or value in seen_ratings:
                continue
            seen_ratings.add(value)
            normalized_ratings.append(value)

    if normalized_ratings:
        placeholders = ",".join(["?"] * len(normalized_ratings))
        query += f" AND f.rating IN ({placeholders})"
        params.extend(normalized_ratings)
    elif rating is not None:
        try:
            rating_value = int(rating)
        except Exception:
            rating_value = 0
        if 1 <= rating_value <= 5:
            query += " AND f.rating = ?"
            params.append(rating_value)
    else:
        min_value = None
        max_value = None
        if rating_min is not None:
            try:
                min_value = int(rating_min)
            except Exception:
                min_value = None
        if rating_max is not None:
            try:
                max_value = int(rating_max)
            except Exception:
                max_value = None
        if min_value is not None:
            min_value = max(1, min(5, min_value))
        if max_value is not None:
            max_value = max(1, min(5, max_value))
        if min_value is not None and max_value is not None and min_value > max_value:
            min_value, max_value = max_value, min_value
        if min_value is not None:
            query += " AND f.rating >= ?"
            params.append(min_value)
        if max_value is not None:
            query += " AND f.rating <= ?"
            params.append(max_value)
    if status:
        query += " AND LOWER(COALESCE(f.status, 'open')) = ?"
        params.append(str(status).strip().lower())
    if not include_analyzed:
        query += " AND f.last_analyzed_at IS NULL"

    query += " ORDER BY f.created_at DESC"
    # Exact feedback-id selection already defines the full analysis set.
    # Do not re-apply pagination, or a selected review range gets sliced twice.
    resolved_offset = 0 if normalized_feedback_ids else max(0, int(offset or 0))
    resolved_limit = None if normalized_feedback_ids else limit
    if resolved_limit is not None:
        query += " LIMIT ?"
        params.append(max(1, int(resolved_limit)))
        query += " OFFSET ?"
        params.append(resolved_offset)
    elif resolved_offset > 0:
        query += " LIMIT -1 OFFSET ?"
        params.append(resolved_offset)

    c.execute(query, params)
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


def fi_record_fetch_run(
    tenant_id: int,
    user_id: int,
    *,
    scope: str,
    source_ids: Optional[List[int]],
    start_date: Optional[str],
    end_date: Optional[str],
    fetched_count: int,
    imported_count: int,
    skipped_count: int,
    status: str,
    connector_results: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO fi_fetch_runs (
            tenant_id, user_id, status, scope, source_ids_json, start_date, end_date,
            fetched_count, imported_count, skipped_count, connector_results_json, metadata_json,
            completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (
            tenant_id,
            user_id,
            _coerce_text(status, "success", 40),
            _coerce_text(scope, "full", 40),
            _safe_json_dumps(source_ids or []),
            start_date,
            end_date,
            int(fetched_count or 0),
            int(imported_count or 0),
            int(skipped_count or 0),
            _safe_json_dumps(connector_results or []),
            _safe_json_dumps(metadata or {}),
        ),
    )
    run_id = c.lastrowid
    conn.commit()
    conn.close()
    return run_id


def fi_create_analysis_run(
    tenant_id: int,
    user_id: int,
    *,
    source: Optional[str],
    source_ids: Optional[List[int]],
    start_date: Optional[str],
    end_date: Optional[str],
    total_reviews: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO fi_analysis_runs (
            tenant_id, user_id, status, source, source_ids_json, start_date, end_date,
            total_reviews, prompt_version, cleaning_version, metadata_json
        )
        VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tenant_id,
            user_id,
            source,
            _safe_json_dumps(source_ids or []),
            start_date,
            end_date,
            int(total_reviews or 0),
            FI_CRM_PROMPT_VERSION,
            FI_CRM_CLEANING_VERSION,
            _safe_json_dumps(metadata or {}),
        ),
    )
    run_id = c.lastrowid
    conn.commit()
    conn.close()
    return run_id


def fi_finish_analysis_run(
    analysis_run_id: int,
    tenant_id: int,
    *,
    status: str,
    analyzed_reviews: int = 0,
    fallback_reviews: int = 0,
    unresolved_reviews: int = 0,
    dropped_reviews: int = 0,
    total_tokens: int = 0,
    billable_tokens: int = 0,
    summary: Optional[Dict[str, Any]] = None,
    trends: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        UPDATE fi_analysis_runs
        SET status = ?,
            analyzed_reviews = ?,
            fallback_reviews = ?,
            unresolved_reviews = ?,
            dropped_reviews = ?,
            total_tokens = ?,
            billable_tokens = ?,
            summary_json = ?,
            trends_json = ?,
            metadata_json = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
        """,
        (
            _coerce_text(status, "completed", 40),
            int(analyzed_reviews or 0),
            int(fallback_reviews or 0),
            int(unresolved_reviews or 0),
            int(dropped_reviews or 0),
            int(total_tokens or 0),
            int(billable_tokens or 0),
            _safe_json_dumps(summary or {}),
            _safe_json_dumps(trends or []),
            _safe_json_dumps(metadata or {}),
            analysis_run_id,
            tenant_id,
        ),
    )
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def _normalize_issue_label(*candidates: Optional[str]) -> str:
    for value in candidates:
        text = " ".join(str(value or "").split()).strip(" .,:;")
        if text and text.lower() not in {"none", "null", "n/a", "unknown", "other"}:
            return text[:120]
    return ""


def fi_apply_analysis_results(
    tenant_id: int,
    analysis_results: List[Dict[str, Any]],
    *,
    analysis_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Apply Feedback CRM analysis results to fi_feedback and refresh linked entities.
    Stores rich analysis fields in metadata_json, hydrates structured CRM columns,
    links issue records for aggregation, and snapshots results per analysis run.
    """
    conn = get_db_connection()
    c = conn.cursor()

    touched_feedback = 0
    skipped_missing_feedback_id = 0
    skipped_not_found = 0
    auto_outreach_ready = 0
    auto_outreach_skipped = 0
    touched_issue_ids = set()
    touched_customer_ids = set()
    issue_cache: Dict[str, Optional[int]] = {}
    try:
        active_kb_offers = _list_kb_offer_rows(c, tenant_id, active_only=True)
    except Exception:
        active_kb_offers = []

    def get_or_create_issue_id(issue_label: str, description: str = "") -> Optional[int]:
        normalized = issue_label.strip().lower()
        if not normalized:
            return None
        if normalized in issue_cache:
            return issue_cache[normalized]

        c.execute(
            "SELECT id FROM fi_issues WHERE tenant_id = ? AND LOWER(name) = ?",
            (tenant_id, normalized),
        )
        row = c.fetchone()
        if row:
            issue_cache[normalized] = row["id"]
            return row["id"]

        c.execute(
            """
            INSERT INTO fi_issues (tenant_id, name, description)
            VALUES (?, ?, ?)
            """,
            (tenant_id, issue_label[:120], description[:240]),
        )
        issue_id = c.lastrowid
        issue_cache[normalized] = issue_id
        return issue_id

    for result in analysis_results or []:
        candidate_ids: List[str] = []
        for value in (result.get("id"), result.get("review_id")):
            text_value = str(value or "").strip()
            if text_value:
                candidate_ids.append(text_value)

        feedback_id: Optional[int] = None
        for candidate in candidate_ids:
            candidate_text = candidate[3:] if candidate.startswith("fi_") else candidate
            try:
                feedback_id = int(candidate_text)
                break
            except (TypeError, ValueError):
                continue
        if feedback_id is None:
            skipped_missing_feedback_id += 1
            continue

        c.execute(
            """
            SELECT
                f.customer_id,
                f.metadata_json,
                f.text,
                f.source,
                f.sentiment,
                f.user_segment,
                cu.customer_identifier,
                i.name AS issue_name
            FROM fi_feedback f
            LEFT JOIN fi_customers cu ON cu.id = f.customer_id
            LEFT JOIN fi_issues i ON i.id = f.issue_id
            WHERE f.id = ? AND f.tenant_id = ?
            """,
            (feedback_id, tenant_id),
        )
        current_row = c.fetchone()
        if not current_row:
            skipped_not_found += 1
            continue
        current = dict(current_row)

        try:
            metadata = json.loads(current.get("metadata_json") or "{}")
            if not isinstance(metadata, dict):
                metadata = {}
        except Exception:
            metadata = {}

        analysis_payload = {
            "sentiment_score": float(result.get("sentiment_score", 0.0) or 0.0),
            "confidence": float(result.get("confidence", 0.0) or 0.0),
            "churn_risk": _coerce_text(result.get("churn_risk"), "null", 20).lower(),
            "churn_impact": _coerce_text(result.get("churn_impact"), "none", 20).lower(),
            "pain_point_category": _coerce_text(result.get("pain_point_category"), "Other", 40),
            "issue": _coerce_text(result.get("issue"), "N/A", 180),
            "root_cause": _coerce_text(result.get("root_cause"), "N/A", 220),
            "solving_priority": _coerce_text(result.get("solving_priority"), "medium", 20).lower(),
            "action_owner": _coerce_text(result.get("action_owner"), "Unknown", 40),
            "action_recommendation": _coerce_text(result.get("action_recommendation"), "None", 220),
            "feature_request": _coerce_text(result.get("feature_request"), "None", 220),
            "user_suggestion": _coerce_text(result.get("user_suggestion"), "None", 220),
            "theme_primary": _coerce_text(result.get("theme_primary"), "None", 120),
            "theme_cluster": _coerce_text(result.get("theme_cluster"), "None", 120),
            "cluster_label": _coerce_text(result.get("cluster_label"), "None", 120),
            "trending_theme": _coerce_text(result.get("trending_theme"), "None", 120),
            "emerging_theme": _coerce_text(result.get("emerging_theme"), "None", 120),
            "intent": _coerce_text(result.get("intent"), "Inform", 30),
            "emotions": list(result.get("emotions") or []),
            "urgency": _coerce_text(result.get("urgency"), "None", 20),
            "user_segment": _coerce_text(result.get("user_segment"), "Neutral", 30),
            "journey_stage": _coerce_text(result.get("journey_stage"), "unknown", 30).lower(),
            "domain_insight": _coerce_text(result.get("domain_insight"), "N/A", 220),
            "revenue_sensitivity": bool(result.get("revenue_sensitivity", False)),
            "cleaned_text": _coerce_text(result.get("_cleaned_text"), "", 600),
            "clean_flags": list(result.get("_clean_flags") or []),
            "clean_token_estimate": int(result.get("_clean_token_estimate", 0) or 0),
            "noise_score": float(result.get("_noise_score", 0.0) or 0.0),
            "token_usage": int(result.get("_meta_tokens", 0) or 0),
            "fallback_reason": _coerce_text(result.get("_meta_reason"), "", 80),
            "prompt_version": FI_CRM_PROMPT_VERSION,
            "cleaning_version": FI_CRM_CLEANING_VERSION,
        }
        analysis_payload["action_confidence"] = _compute_action_confidence(
            base_confidence=result.get("action_confidence", analysis_payload.get("confidence", 0.0)),
            issue=analysis_payload.get("issue"),
            root_cause=analysis_payload.get("root_cause"),
            action_recommendation=analysis_payload.get("action_recommendation"),
            noise_score=analysis_payload.get("noise_score", 0.0),
            fallback_used=bool(result.get("_meta_fallback", False)),
            errored=bool(result.get("_meta_error", False)),
        )
        analysis_payload["impact_score"] = _compute_business_impact_score(
            churn_risk=analysis_payload.get("churn_risk"),
            revenue_sensitivity=analysis_payload.get("revenue_sensitivity", False),
            urgency=analysis_payload.get("urgency"),
        )
        pattern_label = _derive_actionable_pattern_label(
            issue=analysis_payload.get("issue"),
            feature_request=analysis_payload.get("feature_request"),
            user_suggestion=analysis_payload.get("user_suggestion"),
            root_cause=analysis_payload.get("root_cause"),
            theme_cluster=analysis_payload.get("theme_cluster"),
            theme_primary=analysis_payload.get("theme_primary"),
            pain_point_category=analysis_payload.get("pain_point_category"),
            text=current.get("text"),
        )
        analysis_payload["pattern_key"] = _coerce_text(pattern_label.lower(), "none", 120) if pattern_label else "none"
        metadata["analysis"] = analysis_payload
        metadata["analysis_last_run_id"] = analysis_run_id
        metadata["analysis_updated_at"] = datetime.utcnow().isoformat()

        issue_label = _normalize_issue_label(
            analysis_payload.get("theme_cluster"),
            analysis_payload.get("theme_primary"),
            result.get("trending_theme"),
            result.get("issue"),
            result.get("pain_point_category"),
        )
        issue_description = _normalize_issue_label(
            analysis_payload.get("root_cause"),
            analysis_payload.get("action_recommendation"),
            analysis_payload.get("domain_insight"),
        )
        issue_id = get_or_create_issue_id(issue_label, issue_description) if issue_label else None

        outreach_payload = _build_agentic_outreach(
            {
                "id": feedback_id,
                "text": _coerce_text(current.get("text"), "", 600),
                "sentiment": str(result.get("sentiment") or current.get("sentiment") or "neutral").strip().lower() or "neutral",
                "user_segment": analysis_payload["user_segment"] or current.get("user_segment"),
                "source": current.get("source"),
                "issue_name": issue_label or current.get("issue_name") or analysis_payload.get("issue"),
                "customer_identifier": current.get("customer_identifier"),
            },
            metadata=metadata,
            offers=active_kb_offers,
        )
        outreach_meta = {
            "status": outreach_payload.get("status"),
            "reason": outreach_payload.get("reason"),
            "segment": outreach_payload.get("segment"),
            "offer_id": outreach_payload.get("offer_id"),
            "offer_name": outreach_payload.get("offer_name"),
            "offer_title": outreach_payload.get("offer_title"),
            "offer_channel": outreach_payload.get("offer_channel"),
            "generated_at": datetime.utcnow().isoformat(),
            "contact": outreach_payload.get("contact") or {},
            "channels": sorted(list((outreach_payload.get("drafts") or {}).keys())),
            "source": "analysis_auto",
        }
        if outreach_payload.get("status") == "ready":
            offer_id = _to_int(outreach_payload.get("offer_id"), 0)
            saved_draft_ids: List[int] = []
            for channel, draft in (outreach_payload.get("drafts") or {}).items():
                draft_id = _upsert_outreach_draft(
                    c,
                    tenant_id=tenant_id,
                    feedback_id=feedback_id,
                    kb_offer_id=offer_id,
                    channel=channel,
                    recipient_name=_coerce_text((outreach_payload.get("contact") or {}).get("name"), "Customer", 80),
                    recipient_email=_coerce_text((outreach_payload.get("contact") or {}).get("email"), "", 180),
                    recipient_mobile=_coerce_text((outreach_payload.get("contact") or {}).get("mobile"), "", 32),
                    subject=_coerce_text(draft.get("subject"), "", 220),
                    message=_coerce_text(draft.get("message"), "", 2200),
                    auto_generated=True,
                    metadata={
                        "segment": outreach_payload.get("segment"),
                        "offer_id": offer_id,
                        "offer_name": outreach_payload.get("offer_name"),
                        "feedback_id": feedback_id,
                    },
                )
                if draft_id:
                    saved_draft_ids.append(draft_id)
            outreach_meta["saved_draft_ids"] = saved_draft_ids
            auto_outreach_ready += 1
        else:
            auto_outreach_skipped += 1
        metadata["agentic_outreach"] = outreach_meta

        c.execute(
            """
            UPDATE fi_feedback
            SET sentiment = ?,
                sentiment_score = ?,
                confidence = ?,
                churn_risk = ?,
                churn_impact = ?,
                pain_point_category = ?,
                theme_primary = ?,
                theme_cluster = ?,
                cluster_label = ?,
                user_segment = ?,
                solving_priority = ?,
                journey_stage = ?,
                action_owner = ?,
                action_confidence = ?,
                business_impact_score = ?,
                issue_id = ?,
                priority = ?,
                metadata_json = ?
                ,last_analyzed_at = CURRENT_TIMESTAMP
                ,analysis_run_id = ?
            WHERE id = ? AND tenant_id = ?
            """,
            (
                str(result.get("sentiment") or "neutral").strip().lower() or "neutral",
                analysis_payload["sentiment_score"],
                analysis_payload["confidence"],
                analysis_payload["churn_risk"],
                analysis_payload["churn_impact"],
                analysis_payload["pain_point_category"],
                analysis_payload["theme_primary"],
                analysis_payload["theme_cluster"],
                analysis_payload["cluster_label"],
                analysis_payload["user_segment"],
                analysis_payload["solving_priority"],
                analysis_payload["journey_stage"],
                analysis_payload["action_owner"],
                analysis_payload["action_confidence"],
                analysis_payload["impact_score"],
                issue_id,
                analysis_payload["solving_priority"],
                _safe_json_dumps(metadata),
                analysis_run_id,
                feedback_id,
                tenant_id,
            ),
        )
        if c.rowcount:
            touched_feedback += 1
            if issue_id:
                touched_issue_ids.add(issue_id)
            if current.get("customer_id"):
                touched_customer_ids.add(current["customer_id"])
            if analysis_run_id:
                c.execute(
                    """
                    SELECT id
                    FROM fi_analysis_results
                    WHERE tenant_id = ? AND analysis_run_id = ? AND feedback_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (tenant_id, analysis_run_id, feedback_id),
                )
                existing_snapshot = c.fetchone()
                snapshot_payload = (
                    _coerce_text(result.get("source"), "", 120),
                    _coerce_text(result.get("source_type"), "", 80),
                    str(result.get("sentiment") or "neutral").strip().lower() or "neutral",
                    analysis_payload["sentiment_score"],
                    analysis_payload["churn_risk"],
                    analysis_payload["churn_impact"],
                    analysis_payload["pain_point_category"],
                    analysis_payload["issue"],
                    analysis_payload["root_cause"],
                    analysis_payload["solving_priority"],
                    analysis_payload["action_owner"],
                    analysis_payload["action_confidence"],
                    analysis_payload["impact_score"],
                    analysis_payload["theme_primary"],
                    analysis_payload["theme_cluster"],
                    analysis_payload["cluster_label"],
                    analysis_payload["user_segment"],
                    analysis_payload["journey_stage"],
                    _safe_json_dumps(analysis_payload),
                )
                if existing_snapshot:
                    c.execute(
                        """
                        UPDATE fi_analysis_results
                        SET source = ?,
                            source_type = ?,
                            sentiment = ?,
                            sentiment_score = ?,
                            churn_risk = ?,
                            churn_impact = ?,
                            pain_point_category = ?,
                            issue = ?,
                            root_cause = ?,
                            solving_priority = ?,
                            action_owner = ?,
                            action_confidence = ?,
                            business_impact_score = ?,
                            theme_primary = ?,
                            theme_cluster = ?,
                            cluster_label = ?,
                            user_segment = ?,
                            journey_stage = ?,
                            metadata_json = ?
                        WHERE id = ? AND tenant_id = ?
                        """,
                        (*snapshot_payload, int(existing_snapshot["id"]), tenant_id),
                    )
                else:
                    c.execute(
                        """
                        INSERT INTO fi_analysis_results (
                            tenant_id, analysis_run_id, feedback_id, source, source_type,
                            sentiment, sentiment_score, churn_risk, churn_impact, pain_point_category,
                            issue, root_cause, solving_priority, action_owner,
                            action_confidence, business_impact_score,
                            theme_primary, theme_cluster, cluster_label, user_segment, journey_stage,
                            metadata_json
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            tenant_id,
                            analysis_run_id,
                            feedback_id,
                            *snapshot_payload,
                        ),
                    )

    for customer_id in touched_customer_ids:
        _refresh_customer_stats(c, customer_id)

    c.execute("SELECT id FROM fi_issues WHERE tenant_id = ?", (tenant_id,))
    all_issue_ids = {row["id"] for row in c.fetchall()}
    for issue_id in all_issue_ids:
        _refresh_issue_stats(c, tenant_id, issue_id)
        _refresh_issue_trend(c, tenant_id, issue_id)
    pattern_memory_count = _refresh_issue_pattern_memory(c, tenant_id)

    conn.commit()
    conn.close()
    return {
        "updated_feedback": touched_feedback,
        "issues_seen": len(all_issue_ids),
        "customers_updated": len(touched_customer_ids),
        "skipped_missing_feedback_id": skipped_missing_feedback_id,
        "skipped_not_found": skipped_not_found,
        "auto_outreach_ready": auto_outreach_ready,
        "auto_outreach_skipped": auto_outreach_skipped,
        "analysis_run_id": analysis_run_id,
        "pattern_memory_count": pattern_memory_count,
    }


def _feedback_analysis_filters_sql(
    tenant_id: int,
    *,
    feedback_ids: Optional[List[int]] = None,
    source_ids: Optional[List[int]] = None,
    source_id: Optional[int] = None,
    source: Optional[str] = None,
    sentiment: Optional[str] = None,
    churn_risk: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[str, List[Any]]:
    where = [
        "f.tenant_id = ?",
        "LOWER(COALESCE(f.source_type, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) != 'slack'",
        "LOWER(COALESCE(f.source, '')) NOT LIKE 'slack (%'",
        "f.last_analyzed_at IS NOT NULL",
    ]
    params: List[Any] = [tenant_id]

    normalized_feedback_ids: List[int] = []
    if feedback_ids:
        seen_feedback_ids = set()
        for raw_feedback_id in feedback_ids:
            try:
                feedback_id = int(raw_feedback_id)
            except Exception:
                continue
            if feedback_id <= 0 or feedback_id in seen_feedback_ids:
                continue
            seen_feedback_ids.add(feedback_id)
            normalized_feedback_ids.append(feedback_id)
    if normalized_feedback_ids:
        placeholders = ",".join(["?"] * len(normalized_feedback_ids))
        where.append(f"f.id IN ({placeholders})")
        params.extend(normalized_feedback_ids)

    scoped_ids = list(source_ids or [])
    if source_id is not None:
        scoped_ids = [int(source_id)]
    if scoped_ids:
        placeholders = ",".join(["?"] * len(scoped_ids))
        where.append(
            f"CAST(COALESCE(json_extract(f.metadata_json, '$.cxm_source_id'), 0) AS INTEGER) IN ({placeholders})"
        )
        params.extend([int(sid) for sid in scoped_ids])
    if source:
        where.append("f.source = ?")
        params.append(_coerce_text(source, "", 160))
    if sentiment:
        where.append("LOWER(COALESCE(f.sentiment, 'neutral')) = ?")
        params.append(str(sentiment).strip().lower())
    if churn_risk:
        where.append("LOWER(COALESCE(f.churn_risk, 'null')) = ?")
        params.append(str(churn_risk).strip().lower())
    normalized_ratings: List[int] = []
    if rating_values:
        seen_ratings = set()
        for raw_rating in rating_values:
            try:
                value = int(raw_rating)
            except Exception:
                continue
            if value < 1 or value > 5 or value in seen_ratings:
                continue
            seen_ratings.add(value)
            normalized_ratings.append(value)

    if normalized_ratings:
        placeholders = ",".join(["?"] * len(normalized_ratings))
        where.append(f"f.rating IN ({placeholders})")
        params.extend(normalized_ratings)
    elif rating is not None:
        try:
            rating_value = int(rating)
        except Exception:
            rating_value = 0
        if 1 <= rating_value <= 5:
            where.append("f.rating = ?")
            params.append(rating_value)
    else:
        min_value = None
        max_value = None
        if rating_min is not None:
            try:
                min_value = int(rating_min)
            except Exception:
                min_value = None
        if rating_max is not None:
            try:
                max_value = int(rating_max)
            except Exception:
                max_value = None
        if min_value is not None:
            min_value = max(1, min(5, min_value))
        if max_value is not None:
            max_value = max(1, min(5, max_value))
        if min_value is not None and max_value is not None and min_value > max_value:
            min_value, max_value = max_value, min_value
        if min_value is not None:
            where.append("f.rating >= ?")
            params.append(min_value)
        if max_value is not None:
            where.append("f.rating <= ?")
            params.append(max_value)
    normalized_start_date = _normalize_filter_timestamp(start_date)
    normalized_end_date = _normalize_filter_timestamp(end_date, end_of_day=True)
    if normalized_start_date:
        where.append("f.created_at >= ?")
        params.append(normalized_start_date)
    if normalized_end_date:
        where.append("f.created_at <= ?")
        params.append(normalized_end_date)

    return " AND ".join(where), params


def fi_get_analysis_reviews(
    tenant_id: int,
    *,
    source_id: int,
    sentiment: Optional[str] = None,
    churn_risk: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    c = conn.cursor()
    where_clause, params = _feedback_analysis_filters_sql(
        tenant_id,
        source_id=source_id,
        sentiment=sentiment,
        churn_risk=churn_risk,
        rating=rating,
        rating_values=rating_values,
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
    )
    c.execute(
        f"""
        SELECT
            f.id,
            f.text,
            f.sentiment,
            f.sentiment_score,
            f.churn_risk,
            f.churn_impact,
            f.pain_point_category,
            f.theme_primary,
            f.theme_cluster,
            f.cluster_label,
            f.user_segment,
            f.solving_priority,
            f.source,
            f.source_type,
            f.rating,
            f.created_at,
            f.created_at AS reviewed_at,
            cu.customer_identifier AS author
        FROM fi_feedback f
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE {where_clause}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [max(1, min(limit, 1000)), max(0, offset)],
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


def fi_get_analysis_trends(
    tenant_id: int,
    *,
    period: str = "day",
    days: int = 30,
    feedback_ids: Optional[List[int]] = None,
    source_ids: Optional[List[int]] = None,
    source: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    c = conn.cursor()

    where_clause, params = _feedback_analysis_filters_sql(
        tenant_id,
        feedback_ids=feedback_ids,
        source_ids=source_ids,
        source=source,
        rating=rating,
        rating_values=rating_values,
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
    )

    if not start_date and not end_date:
        start_date = (datetime.utcnow() - timedelta(days=max(1, int(days or 30)))).isoformat()
        where_clause, params = _feedback_analysis_filters_sql(
            tenant_id,
            feedback_ids=feedback_ids,
            source_ids=source_ids,
            source=source,
            rating=rating,
            rating_values=rating_values,
            rating_min=rating_min,
            rating_max=rating_max,
            start_date=start_date,
            end_date=end_date,
        )

    if str(period or "day").strip().lower() == "week":
        bucket_sql = "strftime('%Y-W%W', f.created_at)"
    elif str(period or "day").strip().lower() == "month":
        bucket_sql = "strftime('%Y-%m', f.created_at)"
    else:
        bucket_sql = "substr(f.created_at, 1, 10)"

    c.execute(
        f"""
        SELECT
            {bucket_sql} AS bucket,
            COUNT(*) AS total_reviews,
            AVG(COALESCE(f.sentiment_score, 0.0)) AS avg_sentiment,
            AVG(
                CASE LOWER(COALESCE(f.churn_risk, 'null'))
                    WHEN 'high' THEN 3
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 1
                    ELSE 0
                END
            ) AS avg_churn,
            SUM(CASE WHEN LOWER(COALESCE(f.sentiment, 'neutral')) = 'positive' THEN 1 ELSE 0 END) AS positive_count,
            SUM(CASE WHEN LOWER(COALESCE(f.sentiment, 'neutral')) = 'neutral' THEN 1 ELSE 0 END) AS neutral_count,
            SUM(CASE WHEN LOWER(COALESCE(f.sentiment, 'neutral')) = 'negative' THEN 1 ELSE 0 END) AS negative_count
        FROM fi_feedback f
        WHERE {where_clause}
        GROUP BY bucket
        ORDER BY bucket ASC
        """,
        params,
    )
    trends = []
    for row in c.fetchall():
        trends.append(
            {
                "bucket": row["bucket"],
                "label": row["bucket"],
                "total_reviews": int(row["total_reviews"] or 0),
                "avg_sentiment": round(float(row["avg_sentiment"] or 0.0), 4),
                "avg_churn": round(float(row["avg_churn"] or 0.0), 4),
                "positive_count": int(row["positive_count"] or 0),
                "neutral_count": int(row["neutral_count"] or 0),
                "negative_count": int(row["negative_count"] or 0),
            }
        )
    conn.close()
    return trends


def fi_get_analysis_summary(
    tenant_id: int,
    *,
    feedback_ids: Optional[List[int]] = None,
    source_ids: Optional[List[int]] = None,
    source: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[List[int]] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    where_clause, params = _feedback_analysis_filters_sql(
        tenant_id,
        feedback_ids=feedback_ids,
        source_ids=source_ids,
        source=source,
        rating=rating,
        rating_values=rating_values,
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
    )
    c.execute(
        f"""
        SELECT
            f.id,
            f.text,
            f.sentiment,
            f.sentiment_score,
            f.churn_risk,
            f.churn_impact,
            f.pain_point_category,
            f.theme_primary,
            f.theme_cluster,
            f.cluster_label,
            f.user_segment,
            f.solving_priority,
            f.created_at,
            f.metadata_json
        FROM fi_feedback f
        WHERE {where_clause}
        ORDER BY f.created_at DESC
        """,
        params,
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()

    total_reviews = len(rows)
    if total_reviews == 0:
        return {
            "total_reviews": 0,
            "avg_sentiment": 0.0,
            "avg_churn": 0.0,
            "avg_action_confidence": 0.0,
            "avg_business_impact_score": 0.0,
            "positive_count": 0,
            "neutral_count": 0,
            "negative_count": 0,
            "high_churn": 0,
            "medium_churn": 0,
            "low_churn": 0,
            "top_themes": [],
            "top_pain_points": [],
            "top_actionable_issues": [],
            "churn_intent_clusters": [],
            "recurring_issue_patterns": [],
            "recurring_issue_memory": [],
            "user_segments": [],
            "growth_opportunities": [],
            "main_problem_to_fix": {
                "pain_point": "none",
                "impact_score": 0.0,
                "affected_reviews": 0,
                "avg_churn_probability": 0.0,
                "why_now": "No analyzed feedback available for the selected connectors and date range.",
            },
            "sentiment_trend": "stable",
        }

    positive_count = sum(1 for row in rows if str(row.get("sentiment") or "").lower() == "positive")
    neutral_count = sum(1 for row in rows if str(row.get("sentiment") or "").lower() == "neutral")
    negative_count = sum(1 for row in rows if str(row.get("sentiment") or "").lower() == "negative")
    high_churn = sum(1 for row in rows if str(row.get("churn_risk") or "").lower() == "high")
    medium_churn = sum(1 for row in rows if str(row.get("churn_risk") or "").lower() == "medium")
    low_churn = sum(1 for row in rows if str(row.get("churn_risk") or "").lower() == "low")

    avg_sentiment = round(sum(_sentiment_numeric(row.get("sentiment_score")) for row in rows) / total_reviews, 4)
    avg_churn = round(sum(_churn_bucket_value(row.get("churn_risk")) for row in rows) / total_reviews, 4)

    theme_counts: Dict[str, Dict[str, Any]] = {}
    churn_theme_counts: Dict[str, Dict[str, Any]] = {}
    pain_counts: Dict[str, Dict[str, Any]] = {}
    cluster_counts: Dict[str, Dict[str, Any]] = {}
    churn_cluster_counts: Dict[str, Dict[str, Any]] = {}
    segment_counts: Dict[str, int] = {}
    suggestion_counts: Dict[str, int] = {}
    actionable_issue_counts: Dict[str, Dict[str, Any]] = {}
    churn_actionable_issue_counts: Dict[str, Dict[str, Any]] = {}
    recurring_pattern_counts: Dict[str, Dict[str, Any]] = {}
    action_confidence_total = 0.0
    business_impact_total = 0.0
    scored_rows = 0
    now_date = datetime.utcnow().date()
    latest_window_start = now_date - timedelta(days=6)
    previous_window_start = now_date - timedelta(days=13)
    previous_window_end = now_date - timedelta(days=7)

    ordered_sentiment_scores = [_sentiment_numeric(row.get("sentiment_score")) for row in rows]
    half = max(1, len(ordered_sentiment_scores) // 2)
    sentiment_trend = _trend_from_values(
        ordered_sentiment_scores[:half],
        ordered_sentiment_scores[half:half * 2],
    )

    for row in rows:
        pain = _coerce_text(row.get("pain_point_category"), "Other", 60)
        segment = _coerce_text(row.get("user_segment"), "Neutral", 60)
        sentiment_score = _sentiment_numeric(row.get("sentiment_score"))
        churn_impact = _churn_bucket_value(row.get("churn_impact"))
        churn_risk = _churn_bucket_value(row.get("churn_risk"))
        sentiment_name = str(row.get("sentiment") or "").strip().lower()
        churn_linked = bool(churn_risk >= 2 or churn_impact >= 2 or sentiment_score < 0 or sentiment_name == "negative")
        metadata = _json_load_dict(row.get("metadata_json"))
        analysis_meta = metadata.get("analysis") if isinstance(metadata.get("analysis"), dict) else {}
        analysis_issue = _coerce_text(analysis_meta.get("issue"), "", 180)
        analysis_root_cause = _coerce_text(analysis_meta.get("root_cause"), "", 220)
        analysis_theme_cluster = _coerce_text(analysis_meta.get("theme_cluster"), "", 140)
        analysis_theme_primary = _coerce_text(analysis_meta.get("theme_primary"), "", 140)
        feature_request = _coerce_text(analysis_meta.get("feature_request"), "", 160)
        user_suggestion = _coerce_text(analysis_meta.get("user_suggestion"), "", 160)
        action_recommendation = _coerce_text(analysis_meta.get("action_recommendation"), "", 220)
        urgency_value = _coerce_text(analysis_meta.get("urgency"), "None", 20)
        revenue_sensitive = bool(analysis_meta.get("revenue_sensitivity", False))
        row_action_confidence = _compute_action_confidence(
            base_confidence=analysis_meta.get("action_confidence", analysis_meta.get("confidence", row.get("confidence", 0.0))),
            issue=analysis_issue or row.get("pain_point_category"),
            root_cause=analysis_root_cause,
            action_recommendation=action_recommendation,
            noise_score=analysis_meta.get("noise_score", 0.0),
            fallback_used=bool(analysis_meta.get("fallback_reason")),
            errored=False,
        )
        row_business_impact = _compute_business_impact_score(
            churn_risk=row.get("churn_risk"),
            revenue_sensitivity=revenue_sensitive,
            urgency=urgency_value,
        )
        action_confidence_total += row_action_confidence
        business_impact_total += row_business_impact
        scored_rows += 1
        row["_action_confidence"] = row_action_confidence
        row["_business_impact_score"] = row_business_impact
        feature_gap_hint = _extract_feature_gap_label(
            feature_request,
            user_suggestion,
            analysis_issue,
            analysis_root_cause,
            row.get("text"),
        )
        suggestion = _derive_actionable_issue_label(user_suggestion, feature_request, feature_gap_hint)
        actionable_issue = _derive_actionable_issue_label(
            analysis_issue,
            feature_request,
            user_suggestion,
            feature_gap_hint,
            analysis_root_cause,
            analysis_theme_cluster,
            analysis_theme_primary,
            row.get("theme_cluster"),
            row.get("theme_primary"),
            row.get("pain_point_category"),
        )
        if _is_generic_issue_label(actionable_issue):
            actionable_issue = ""
        row["_actionable_issue_label"] = actionable_issue
        row["_is_churn_linked"] = churn_linked
        theme = _coerce_text(row.get("theme_cluster") or row.get("theme_primary"), "Unclassified", 120)
        if _is_generic_issue_label(theme) and actionable_issue:
            theme = actionable_issue
        cluster = _coerce_text(row.get("cluster_label") or row.get("theme_cluster"), "Unclassified", 120)
        if _is_generic_issue_label(cluster):
            cluster = actionable_issue or theme
        cluster = _coerce_text(cluster, "Unclassified", 120)

        theme_entry = theme_counts.setdefault(theme, {"theme": theme, "count": 0, "avg_churn": 0.0, "impact_score": 0.0})
        theme_entry["count"] += 1
        theme_entry["avg_churn"] += churn_risk
        theme_entry["impact_score"] += max(churn_impact, churn_risk, 1)
        if churn_linked:
            churn_theme_entry = churn_theme_counts.setdefault(
                theme,
                {"theme": theme, "count": 0, "avg_churn": 0.0, "impact_score": 0.0},
            )
            churn_theme_entry["count"] += 1
            churn_theme_entry["avg_churn"] += churn_risk
            churn_theme_entry["impact_score"] += max(churn_impact, churn_risk, 1)

        pain_entry = pain_counts.setdefault(
            pain,
            {"pain_point": pain, "count": 0, "avg_sentiment": 0.0, "impact_score": 0.0},
        )
        pain_entry["count"] += 1
        pain_entry["avg_sentiment"] += sentiment_score
        pain_entry["impact_score"] += max(churn_impact, churn_risk, 1)

        if actionable_issue:
            issue_entry = actionable_issue_counts.setdefault(
                actionable_issue,
                {"issue_label": actionable_issue, "count": 0, "avg_sentiment": 0.0, "impact_score": 0.0},
            )
            issue_entry["count"] += 1
            issue_entry["avg_sentiment"] += sentiment_score
            issue_entry["impact_score"] += max(churn_impact, churn_risk, 1)
            if churn_linked:
                churn_issue_entry = churn_actionable_issue_counts.setdefault(
                    actionable_issue,
                    {"issue_label": actionable_issue, "count": 0, "avg_sentiment": 0.0, "impact_score": 0.0},
                )
                churn_issue_entry["count"] += 1
                churn_issue_entry["avg_sentiment"] += sentiment_score
                churn_issue_entry["impact_score"] += max(churn_impact, churn_risk, 1)

            recurring_entry = recurring_pattern_counts.setdefault(
                actionable_issue.lower(),
                {
                    "pattern": actionable_issue,
                    "mention_count": 0,
                    "churn_linked_count": 0,
                    "high_churn_count": 0,
                    "sentiment_sum": 0.0,
                    "churn_risk_sum": 0.0,
                    "latest_7d_count": 0,
                    "previous_7d_count": 0,
                    "active_days": set(),
                    "first_seen_at": None,
                    "last_seen_at": None,
                },
            )
            recurring_entry["mention_count"] += 1
            recurring_entry["sentiment_sum"] += sentiment_score
            recurring_entry["churn_risk_sum"] += float(churn_risk)
            if churn_linked:
                recurring_entry["churn_linked_count"] += 1
            if churn_risk >= 3 or churn_impact >= 3:
                recurring_entry["high_churn_count"] += 1
            created_date = _normalize_date(row.get("created_at"))
            if created_date:
                iso_day = created_date.isoformat()
                recurring_entry["active_days"].add(iso_day)
                if recurring_entry["first_seen_at"] is None or iso_day < recurring_entry["first_seen_at"]:
                    recurring_entry["first_seen_at"] = iso_day
                if recurring_entry["last_seen_at"] is None or iso_day > recurring_entry["last_seen_at"]:
                    recurring_entry["last_seen_at"] = iso_day
                if created_date >= latest_window_start:
                    recurring_entry["latest_7d_count"] += 1
                elif previous_window_start <= created_date <= previous_window_end:
                    recurring_entry["previous_7d_count"] += 1

        cluster_entry = cluster_counts.setdefault(
            cluster,
            {"cluster": cluster, "count": 0, "high_churn_reviews": 0, "impact_score": 0.0},
        )
        cluster_entry["count"] += 1
        cluster_entry["high_churn_reviews"] += 1 if churn_risk >= 3 else 0
        cluster_entry["impact_score"] += max(churn_impact, churn_risk, 1)
        if churn_linked:
            churn_cluster_entry = churn_cluster_counts.setdefault(
                cluster,
                {"cluster": cluster, "count": 0, "high_churn_reviews": 0, "impact_score": 0.0},
            )
            churn_cluster_entry["count"] += 1
            churn_cluster_entry["high_churn_reviews"] += 1 if churn_risk >= 3 else 0
            churn_cluster_entry["impact_score"] += max(churn_impact, churn_risk, 1)

        segment_counts[segment] = segment_counts.get(segment, 0) + 1
        if suggestion and suggestion.lower() not in {"none", "n/a", "unknown"} and not _is_generic_issue_label(suggestion):
            suggestion_counts[suggestion] = suggestion_counts.get(suggestion, 0) + 1

    theme_source = churn_theme_counts if churn_theme_counts else theme_counts
    top_themes_all = sorted(
        (
            {
                "theme": value["theme"],
                "count": value["count"],
                "avg_churn": round(value["avg_churn"] / max(value["count"], 1), 4),
                "impact_score": round(value["impact_score"], 2),
            }
            for value in theme_source.values()
        ),
        key=lambda item: (-item["impact_score"], -item["count"], item["theme"]),
    )
    top_themes = [item for item in top_themes_all if not _is_generic_issue_label(item.get("theme"))][:8]
    if not top_themes:
        top_themes = top_themes_all[:8]

    top_pain_points = sorted(
        (
            {
                "pain_point": value["pain_point"],
                "count": value["count"],
                "avg_sentiment": round(value["avg_sentiment"] / max(value["count"], 1), 4),
                "impact_score": round(value["impact_score"], 2),
            }
            for value in pain_counts.values()
        ),
        key=lambda item: (-item["impact_score"], -item["count"], item["pain_point"]),
    )[:8]

    actionable_source = churn_actionable_issue_counts if churn_actionable_issue_counts else actionable_issue_counts
    top_actionable_issues = sorted(
        (
            {
                "pain_point": value["issue_label"],
                "count": value["count"],
                "avg_sentiment": round(value["avg_sentiment"] / max(value["count"], 1), 4),
                "impact_score": round(value["impact_score"], 2),
            }
            for value in actionable_source.values()
            if not _is_generic_issue_label(value.get("issue_label"))
        ),
        key=lambda item: (-item["impact_score"], -item["count"], item["pain_point"]),
    )[:8]

    cluster_source = churn_cluster_counts if churn_cluster_counts else cluster_counts
    churn_intent_clusters_all = sorted(
        (
            {
                "cluster": value["cluster"],
                "count": value["count"],
                "high_churn_reviews": value["high_churn_reviews"],
                "impact_score": round(value["impact_score"], 2),
            }
            for value in cluster_source.values()
        ),
        key=lambda item: (-item["impact_score"], -item["count"], item["cluster"]),
    )
    churn_intent_clusters = [item for item in churn_intent_clusters_all if not _is_generic_issue_label(item.get("cluster"))][:8]
    if not churn_intent_clusters:
        churn_intent_clusters = churn_intent_clusters_all[:8]

    user_segments = sorted(
        ({"segment": key, "count": value} for key, value in segment_counts.items()),
        key=lambda item: (-item["count"], item["segment"]),
    )

    growth_opportunities = sorted(
        ({"suggestion": key, "count": value} for key, value in suggestion_counts.items()),
        key=lambda item: (-item["count"], item["suggestion"]),
    )[:8]

    recurring_issue_patterns = []
    for bucket in recurring_pattern_counts.values():
        mention_count = int(bucket.get("mention_count") or 0)
        if mention_count <= 0:
            continue
        avg_sentiment = float(bucket.get("sentiment_sum") or 0.0) / mention_count
        avg_churn_risk = float(bucket.get("churn_risk_sum") or 0.0) / mention_count
        active_days_count = len(bucket.get("active_days") or set())
        metrics = _pattern_recurrence_metrics(
            mention_count=mention_count,
            active_days=active_days_count,
            avg_churn_risk=avg_churn_risk,
            latest_count=int(bucket.get("latest_7d_count") or 0),
            previous_count=int(bucket.get("previous_7d_count") or 0),
        )
        recurring_issue_patterns.append(
            {
                "pattern": bucket.get("pattern"),
                "mention_count": mention_count,
                "churn_linked_count": int(bucket.get("churn_linked_count") or 0),
                "high_churn_count": int(bucket.get("high_churn_count") or 0),
                "avg_sentiment_score": round(avg_sentiment, 4),
                "avg_churn_risk": round(avg_churn_risk, 4),
                "latest_7d_count": int(bucket.get("latest_7d_count") or 0),
                "previous_7d_count": int(bucket.get("previous_7d_count") or 0),
                "first_seen_at": bucket.get("first_seen_at"),
                "last_seen_at": bucket.get("last_seen_at"),
                "recurring": bool(metrics["recurring"]),
                "recurrence_score": float(metrics["recurrence_score"]),
                "trend_direction": metrics["trend_direction"],
                "trend_score": float(metrics["trend_score"]),
            }
        )
    recurring_issue_patterns.sort(
        key=lambda item: (
            -(1 if item.get("recurring") else 0),
            -float(item.get("recurrence_score") or 0.0),
            -float(item.get("trend_score") or 0.0),
            -int(item.get("mention_count") or 0),
            str(item.get("pattern") or ""),
        )
    )
    recurring_issue_patterns = recurring_issue_patterns[:10]
    recurring_issue_memory = fi_get_issue_pattern_memory(tenant_id, limit=10)

    avg_action_confidence = round(action_confidence_total / max(scored_rows, 1), 4) if scored_rows else 0.0
    avg_business_impact_score = round(business_impact_total / max(scored_rows, 1), 2) if scored_rows else 0.0

    main_problem_source = "none"
    main_problem = None
    if top_actionable_issues:
        main_problem_source = "actionable_issue"
        main_problem = top_actionable_issues[0]
    elif top_themes:
        main_problem_source = "theme_cluster"
        main_problem = {
            "pain_point": top_themes[0]["theme"],
            "count": top_themes[0]["count"],
            "impact_score": top_themes[0]["impact_score"],
        }
    elif top_pain_points:
        main_problem_source = "pain_point"
        main_problem = top_pain_points[0]

    main_problem_label = _compact_issue_label(main_problem["pain_point"], 120) if main_problem else "none"
    if main_problem and _is_generic_issue_label(main_problem_label):
        fallback_theme_label = _compact_issue_label(top_themes[0]["theme"], 120) if top_themes else ""
        fallback_growth_label = _compact_issue_label(growth_opportunities[0]["suggestion"], 120) if growth_opportunities else ""
        if fallback_theme_label and not _is_generic_issue_label(fallback_theme_label):
            main_problem_source = "theme_cluster"
            main_problem_label = fallback_theme_label
        elif fallback_growth_label and not _is_generic_issue_label(fallback_growth_label):
            main_problem_source = "growth_signal"
            main_problem_label = fallback_growth_label

    if main_problem and _is_generic_issue_label(main_problem_label):
        main_problem_source = "none"
        main_problem = None
        main_problem_label = "No specific churn driver identified"
        related_rows = []
    elif main_problem and main_problem_source == "actionable_issue":
        related_rows = [
            row
            for row in rows
            if _coerce_text(row.get("_actionable_issue_label"), "", 120) == main_problem_label
            and bool(row.get("_is_churn_linked"))
        ]
    elif main_problem and main_problem_source == "theme_cluster":
        related_rows = [
            row
            for row in rows
            if _coerce_text(row.get("theme_cluster") or row.get("theme_primary"), "", 120) == main_problem_label
            and bool(row.get("_is_churn_linked"))
        ]
    elif main_problem and main_problem_source == "growth_signal":
        related_rows = [
            row
            for row in rows
            if (
                _coerce_text((_json_load_dict(row.get("metadata_json")).get("analysis") or {}).get("feature_request"), "", 120) == main_problem_label
                or _coerce_text((_json_load_dict(row.get("metadata_json")).get("analysis") or {}).get("user_suggestion"), "", 120) == main_problem_label
            )
            and bool(row.get("_is_churn_linked"))
        ]
    elif main_problem:
        related_rows = [
            row
            for row in rows
            if _coerce_text(row.get("pain_point_category"), "Other", 60) == main_problem["pain_point"]
            and bool(row.get("_is_churn_linked"))
        ]
    else:
        related_rows = []

    related_count = len(related_rows) if related_rows else int(main_problem["count"]) if main_problem else 0
    avg_churn_probability = (
        round(
            (
                sum(_churn_bucket_value(row.get("churn_risk")) for row in related_rows)
                / max(related_count, 1)
            ) / 3.0,
            4,
        )
        if main_problem and related_count > 0
        else 0.0
    )
    main_problem_to_fix = {
        "pain_point": main_problem_label if (main_problem or main_problem_source == "none") else "none",
        "label_type": main_problem_source,
        "impact_score": float(main_problem["impact_score"]) if main_problem else 0.0,
        "affected_reviews": related_count if main_problem else 0,
        "avg_churn_probability": avg_churn_probability,
        "why_now": (
            (
                f"{main_problem_label} is the strongest churn-linked issue right now across {related_count} reviews."
                if main_problem_source in {"actionable_issue", "theme_cluster", "growth_signal"}
                else f"{main_problem_label} is currently the strongest churn-linked category across {related_count} reviews."
            )
            if main_problem
            else (
                "Specific feature gap details are missing in analyzed records. Re-run analysis with force_reanalyze=true for refreshed labels."
                if main_problem_source == "none"
                else "No dominant pain point detected."
            )
        ),
    }

    return {
        "total_reviews": total_reviews,
        "avg_sentiment": avg_sentiment,
        "avg_churn": avg_churn,
        "avg_action_confidence": avg_action_confidence,
        "avg_business_impact_score": avg_business_impact_score,
        "positive_count": positive_count,
        "neutral_count": neutral_count,
        "negative_count": negative_count,
        "high_churn": high_churn,
        "medium_churn": medium_churn,
        "low_churn": low_churn,
        "top_themes": top_themes,
        "top_pain_points": top_pain_points,
        "top_actionable_issues": top_actionable_issues,
        "churn_intent_clusters": churn_intent_clusters,
        "recurring_issue_patterns": recurring_issue_patterns,
        "recurring_issue_memory": recurring_issue_memory,
        "user_segments": user_segments,
        "growth_opportunities": growth_opportunities,
        "main_problem_to_fix": main_problem_to_fix,
        "sentiment_trend": sentiment_trend,
    }


# ──────────────────────────────────────────────────────────────────────────────
# ISSUE CRUD & SCORING
# ──────────────────────────────────────────────────────────────────────────────

def fi_list_issues(
    tenant_id: int,
    *,
    status: Optional[str] = None,
    sort_by: str = "impact_score",
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()

    where = ["tenant_id = ?"]
    params: list = [tenant_id]
    if status:
        where.append("status = ?")
        params.append(status)

    where_clause = " AND ".join(where)
    allowed_sort = {"impact_score", "mention_count", "negative_ratio", "created_at", "name"}
    sort_col = sort_by if sort_by in allowed_sort else "impact_score"

    c.execute(f"SELECT COUNT(*) FROM fi_issues WHERE {where_clause}", params)
    total = c.fetchone()[0]

    c.execute(f"""
        SELECT * FROM fi_issues
        WHERE {where_clause}
        ORDER BY {sort_col} DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    items = [dict(row) for row in c.fetchall()]
    conn.close()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def fi_get_issue_detail(issue_id: int, tenant_id: int) -> Optional[Dict]:
    """Return full issue detail with sentiment breakdown, quotes, and related feedback."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT * FROM fi_issues WHERE id = ? AND tenant_id = ?", (issue_id, tenant_id))
    issue_row = c.fetchone()
    if not issue_row:
        conn.close()
        return None

    issue = dict(issue_row)

    # Sentiment breakdown
    c.execute("""
        SELECT sentiment, COUNT(*) as cnt
        FROM fi_feedback
        WHERE issue_id = ? AND tenant_id = ?
        GROUP BY sentiment
    """, (issue_id, tenant_id))
    breakdown = {row["sentiment"]: row["cnt"] for row in c.fetchall()}
    issue["sentiment_breakdown"] = breakdown

    # Representative quotes (most recent negative feedback first)
    c.execute("""
        SELECT text FROM fi_feedback
        WHERE issue_id = ? AND tenant_id = ? AND sentiment = 'negative'
        ORDER BY created_at DESC LIMIT 5
    """, (issue_id, tenant_id))
    issue["quotes"] = [row["text"] for row in c.fetchall()]

    # If not enough quotes, fill from all
    if len(issue["quotes"]) < 3:
        c.execute("""
            SELECT text FROM fi_feedback
            WHERE issue_id = ? AND tenant_id = ?
            ORDER BY created_at DESC LIMIT 5
        """, (issue_id, tenant_id))
        all_quotes = [row["text"] for row in c.fetchall()]
        existing = set(issue["quotes"])
        for q in all_quotes:
            if q not in existing:
                issue["quotes"].append(q)
            if len(issue["quotes"]) >= 5:
                break

    # Related feedback items (most recent 20)
    c.execute("""
        SELECT f.*, cu.customer_identifier
        FROM fi_feedback f
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE f.issue_id = ? AND f.tenant_id = ?
        ORDER BY f.created_at DESC LIMIT 20
    """, (issue_id, tenant_id))
    issue["related_feedback"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return issue


def fi_create_issue(tenant_id: int, name: str, description: str = "") -> int:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO fi_issues (tenant_id, name, description)
        VALUES (?, ?, ?)
    """, (tenant_id, name, description))
    iid = c.lastrowid
    conn.commit()
    conn.close()
    return iid


def fi_update_issue_status(issue_id: int, tenant_id: int, status: str) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE fi_issues SET status = ? WHERE id = ? AND tenant_id = ?",
              (status, issue_id, tenant_id))
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def fi_link_feedback_to_issue(feedback_id: int, issue_id: int, tenant_id: int) -> bool:
    """Link a feedback item to an issue and refresh stats."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE fi_feedback SET issue_id = ? WHERE id = ? AND tenant_id = ?",
              (issue_id, feedback_id, tenant_id))
    ok = c.rowcount > 0
    if ok:
        _refresh_issue_stats(c, tenant_id, issue_id)
    conn.commit()
    conn.close()
    return ok


# ──────────────────────────────────────────────────────────────────────────────
# IMPACT SCORING  —  impact_score = mention_count × negative_ratio
# ──────────────────────────────────────────────────────────────────────────────

def _refresh_issue_stats(cursor, tenant_id: int, issue_id: int):
    """Recompute mention_count, negative_ratio, impact_score for one issue."""
    cursor.execute("""
        SELECT COUNT(*) as cnt,
               SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as neg
        FROM fi_feedback
        WHERE issue_id = ? AND tenant_id = ?
    """, (issue_id, tenant_id))
    row = cursor.fetchone()
    cnt = row["cnt"] or 0
    neg = row["neg"] or 0
    neg_ratio = round(neg / cnt, 2) if cnt > 0 else 0.0
    impact = round(cnt * neg_ratio, 1)

    cursor.execute("""
        UPDATE fi_issues
        SET mention_count = ?, negative_ratio = ?, impact_score = ?
        WHERE id = ? AND tenant_id = ?
    """, (cnt, neg_ratio, impact, issue_id, tenant_id))


def fi_recalculate_all_issues(tenant_id: int):
    """Batch-recalc scores and trends for ALL issues in a tenant."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM fi_issues WHERE tenant_id = ?", (tenant_id,))
    for row in c.fetchall():
        _refresh_issue_stats(c, tenant_id, row["id"])
        _refresh_issue_trend(c, tenant_id, row["id"])
    _refresh_issue_pattern_memory(c, tenant_id)
    conn.commit()
    conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# TREND DETECTION
# ──────────────────────────────────────────────────────────────────────────────

def _refresh_issue_trend(cursor, tenant_id: int, issue_id: int):
    """Compare last-7-days vs previous-7-days feedback count -> rising / declining / stable."""
    now = datetime.utcnow()
    d7 = (now - timedelta(days=7)).isoformat()
    d14 = (now - timedelta(days=14)).isoformat()

    cursor.execute("""
        SELECT COUNT(*) FROM fi_feedback
        WHERE issue_id = ? AND tenant_id = ? AND created_at >= ?
    """, (issue_id, tenant_id, d7))
    last_7 = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM fi_feedback
        WHERE issue_id = ? AND tenant_id = ? AND created_at >= ? AND created_at < ?
    """, (issue_id, tenant_id, d14, d7))
    prev_7 = cursor.fetchone()[0]

    if prev_7 == 0:
        trend = "rising" if last_7 > 0 else "stable"
    else:
        change = (last_7 - prev_7) / prev_7
        if change > 0.20:
            trend = "rising"
        elif change < -0.20:
            trend = "declining"
        else:
            trend = "stable"

    cursor.execute("UPDATE fi_issues SET trend = ? WHERE id = ? AND tenant_id = ?",
                   (trend, issue_id, tenant_id))


def fi_refresh_trends(tenant_id: int):
    """Refresh trend for every issue in a tenant."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM fi_issues WHERE tenant_id = ?", (tenant_id,))
    for row in c.fetchall():
        _refresh_issue_trend(c, tenant_id, row["id"])
    conn.commit()
    conn.close()


def _refresh_issue_pattern_memory(cursor, tenant_id: int) -> int:
    if not _table_exists(cursor, "fi_issue_memory"):
        return 0

    now_date = datetime.utcnow().date()
    latest_window_start = now_date - timedelta(days=6)
    previous_window_start = now_date - timedelta(days=13)
    previous_window_end = now_date - timedelta(days=7)

    cursor.execute(
        """
        SELECT
            f.id,
            f.text,
            f.sentiment,
            f.sentiment_score,
            f.churn_risk,
            f.churn_impact,
            f.created_at,
            f.metadata_json
        FROM fi_feedback f
        WHERE f.tenant_id = ?
          AND f.last_analyzed_at IS NOT NULL
        ORDER BY f.created_at DESC
        """,
        (tenant_id,),
    )
    rows = [dict(row) for row in cursor.fetchall()]

    buckets: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        metadata = _json_load_dict(row.get("metadata_json"))
        analysis = metadata.get("analysis") if isinstance(metadata.get("analysis"), dict) else {}
        label = _derive_actionable_pattern_label(
            issue=analysis.get("issue"),
            feature_request=analysis.get("feature_request"),
            user_suggestion=analysis.get("user_suggestion"),
            root_cause=analysis.get("root_cause"),
            theme_cluster=analysis.get("theme_cluster"),
            theme_primary=analysis.get("theme_primary"),
            pain_point_category=analysis.get("pain_point_category") or row.get("pain_point_category"),
            text=row.get("text"),
        )
        if not label:
            continue
        key = _coerce_text(label.lower(), "", 120)
        if not key:
            continue

        bucket = buckets.setdefault(
            key,
            {
                "pattern_key": key,
                "pattern_label": label,
                "mention_count": 0,
                "churn_linked_count": 0,
                "high_churn_count": 0,
                "sentiment_sum": 0.0,
                "churn_risk_sum": 0.0,
                "latest_7d_count": 0,
                "previous_7d_count": 0,
                "active_days": set(),
                "first_seen_at": None,
                "last_seen_at": None,
            },
        )

        created_date = _normalize_date(row.get("created_at"))
        if created_date:
            iso_day = created_date.isoformat()
            bucket["active_days"].add(iso_day)
            if bucket["first_seen_at"] is None or iso_day < bucket["first_seen_at"]:
                bucket["first_seen_at"] = iso_day
            if bucket["last_seen_at"] is None or iso_day > bucket["last_seen_at"]:
                bucket["last_seen_at"] = iso_day
            if created_date >= latest_window_start:
                bucket["latest_7d_count"] += 1
            elif previous_window_start <= created_date <= previous_window_end:
                bucket["previous_7d_count"] += 1

        sentiment_score = _sentiment_numeric(row.get("sentiment_score"))
        churn_risk_value = _churn_bucket_value(row.get("churn_risk"))
        churn_impact_value = _churn_bucket_value(row.get("churn_impact"))
        churn_linked = _is_churn_linked_signal(
            row.get("sentiment"),
            sentiment_score,
            row.get("churn_risk"),
            row.get("churn_impact"),
        )

        bucket["mention_count"] += 1
        bucket["sentiment_sum"] += sentiment_score
        bucket["churn_risk_sum"] += float(churn_risk_value)
        if churn_linked:
            bucket["churn_linked_count"] += 1
        if churn_risk_value >= 3 or churn_impact_value >= 3:
            bucket["high_churn_count"] += 1

    cursor.execute("DELETE FROM fi_issue_memory WHERE tenant_id = ?", (tenant_id,))

    inserted = 0
    for bucket in buckets.values():
        mention_count = int(bucket["mention_count"] or 0)
        if mention_count <= 0:
            continue
        avg_sentiment = float(bucket["sentiment_sum"]) / mention_count
        avg_churn_risk = float(bucket["churn_risk_sum"]) / mention_count
        active_days_count = len(bucket["active_days"])
        metrics = _pattern_recurrence_metrics(
            mention_count=mention_count,
            active_days=active_days_count,
            avg_churn_risk=avg_churn_risk,
            latest_count=int(bucket["latest_7d_count"] or 0),
            previous_count=int(bucket["previous_7d_count"] or 0),
        )

        cursor.execute(
            """
            INSERT INTO fi_issue_memory (
                tenant_id, pattern_key, pattern_label, mention_count, churn_linked_count,
                high_churn_count, avg_sentiment_score, avg_churn_risk,
                latest_7d_count, previous_7d_count, recurring_flag, recurrence_score,
                trend_direction, trend_score, first_seen_at, last_seen_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                tenant_id,
                bucket["pattern_key"],
                bucket["pattern_label"],
                mention_count,
                int(bucket["churn_linked_count"] or 0),
                int(bucket["high_churn_count"] or 0),
                round(avg_sentiment, 4),
                round(avg_churn_risk, 4),
                int(bucket["latest_7d_count"] or 0),
                int(bucket["previous_7d_count"] or 0),
                1 if metrics["recurring"] else 0,
                metrics["recurrence_score"],
                metrics["trend_direction"],
                metrics["trend_score"],
                bucket["first_seen_at"],
                bucket["last_seen_at"],
            ),
        )
        inserted += 1

    return inserted


def fi_get_issue_pattern_memory(tenant_id: int, limit: int = 12) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    c = conn.cursor()
    if not _table_exists(c, "fi_issue_memory"):
        conn.close()
        return []
    c.execute(
        """
        SELECT
            pattern_label, mention_count, churn_linked_count, high_churn_count,
            avg_sentiment_score, avg_churn_risk, latest_7d_count, previous_7d_count,
            recurring_flag, recurrence_score, trend_direction, trend_score,
            first_seen_at, last_seen_at
        FROM fi_issue_memory
        WHERE tenant_id = ?
        ORDER BY recurrence_score DESC, trend_score DESC, mention_count DESC
        LIMIT ?
        """,
        (tenant_id, max(1, int(limit or 12))),
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows


# ──────────────────────────────────────────────────────────────────────────────
# CUSTOMER ENTITY
# ──────────────────────────────────────────────────────────────────────────────

def _upsert_customer(cursor, tenant_id: int, identifier: str) -> int:
    """Get or create a customer by identifier. Returns customer id."""
    cursor.execute(
        "SELECT id FROM fi_customers WHERE tenant_id = ? AND customer_identifier = ?",
        (tenant_id, identifier),
    )
    row = cursor.fetchone()
    if row:
        return row["id"]

    cursor.execute("""
        INSERT INTO fi_customers (tenant_id, customer_identifier)
        VALUES (?, ?)
    """, (tenant_id, identifier))
    return cursor.lastrowid


def _refresh_customer_stats(cursor, customer_id: int):
    """Recompute aggregate stats for one customer."""
    cursor.execute("""
        SELECT COUNT(*) as cnt,
               MAX(created_at) as last_fb,
               MIN(created_at) as first_fb
        FROM fi_feedback WHERE customer_id = ?
    """, (customer_id,))
    row = cursor.fetchone()
    cnt = row["cnt"] or 0
    last_fb = row["last_fb"]
    first_fb = row["first_fb"]

    # Overall sentiment = majority vote
    cursor.execute("""
        SELECT sentiment, COUNT(*) as c
        FROM fi_feedback WHERE customer_id = ?
        GROUP BY sentiment ORDER BY c DESC LIMIT 1
    """, (customer_id,))
    sent_row = cursor.fetchone()
    overall = sent_row["sentiment"] if sent_row else "neutral"

    # Sentiment trend
    trend = _compute_customer_sentiment_trend(cursor, customer_id)

    cursor.execute("""
        UPDATE fi_customers
        SET total_feedback_count = ?,
            last_feedback_at = ?,
            first_seen_at = COALESCE(first_seen_at, ?),
            overall_sentiment = ?,
            sentiment_trend = ?
        WHERE id = ?
    """, (cnt, last_fb, first_fb, overall, trend, customer_id))


def _compute_customer_sentiment_trend(cursor, customer_id: int) -> str:
    """Compare last 3 vs previous 3 feedback sentiments => improving / degrading / stable."""
    cursor.execute("""
        SELECT sentiment FROM fi_feedback
        WHERE customer_id = ? ORDER BY created_at DESC LIMIT 6
    """, (customer_id,))
    rows = [r["sentiment"] for r in cursor.fetchall()]

    def score(s):
        return {"positive": 1, "neutral": 0, "negative": -1}.get(s, 0)

    last_3 = sum(score(s) for s in rows[:3])
    prev_3 = sum(score(s) for s in rows[3:6]) if len(rows) > 3 else 0

    if last_3 > prev_3:
        return "improving"
    elif last_3 < prev_3:
        return "degrading"
    return "stable"


def fi_list_customers(
    tenant_id: int,
    *,
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()

    where = ["tenant_id = ?"]
    params: list = [tenant_id]
    if search:
        where.append("customer_identifier LIKE ?")
        params.append(f"%{search}%")
    if sentiment:
        where.append("overall_sentiment = ?")
        params.append(sentiment)

    wc = " AND ".join(where)
    c.execute(f"SELECT COUNT(*) FROM fi_customers WHERE {wc}", params)
    total = c.fetchone()[0]

    c.execute(f"""
        SELECT * FROM fi_customers
        WHERE {wc}
        ORDER BY last_feedback_at DESC NULLS LAST
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    items = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def fi_get_customer(customer_id: int, tenant_id: int) -> Optional[Dict]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM fi_customers WHERE id = ? AND tenant_id = ?",
              (customer_id, tenant_id))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def fi_get_customer_timeline(customer_id: int, tenant_id: int) -> Dict:
    """Return customer profile + chronological feedback timeline."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT * FROM fi_customers WHERE id = ? AND tenant_id = ?",
              (customer_id, tenant_id))
    cust_row = c.fetchone()
    if not cust_row:
        conn.close()
        return {}

    customer = dict(cust_row)

    c.execute("""
        SELECT f.id, f.text AS feedback, f.sentiment, f.source, f.status,
               f.priority, f.rating, f.metadata_json, f.created_at AS date,
               f.last_analyzed_at,
               i.name AS issue_name
        FROM fi_feedback f
        LEFT JOIN fi_issues i ON i.id = f.issue_id
        WHERE f.customer_id = ? AND f.tenant_id = ?
        ORDER BY f.created_at ASC
    """, (customer_id, tenant_id))
    timeline = [dict(r) for r in c.fetchall()]

    conn.close()
    customer["timeline"] = timeline
    return customer


# ──────────────────────────────────────────────────────────────────────────────
# PRODUCT HEALTH DASHBOARD
# ──────────────────────────────────────────────────────────────────────────────

def fi_product_health(tenant_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()

    # Total feedback
    c.execute("SELECT COUNT(*) FROM fi_feedback WHERE tenant_id = ?", (tenant_id,))
    total = c.fetchone()[0]

    c.execute(
        "SELECT COUNT(*) FROM fi_feedback WHERE tenant_id = ? AND last_analyzed_at IS NOT NULL",
        (tenant_id,),
    )
    analyzed_total = c.fetchone()[0]
    pending_total = max(0, int(total or 0) - int(analyzed_total or 0))

    # Negative %
    c.execute("""
        SELECT COUNT(*) FROM fi_feedback
        WHERE tenant_id = ? AND last_analyzed_at IS NOT NULL AND sentiment = 'negative'
    """, (tenant_id,))
    neg = c.fetchone()[0]
    neg_pct = round((neg / analyzed_total) * 100, 1) if analyzed_total > 0 else 0

    # Sentiment breakdown
    c.execute("""
        SELECT sentiment, COUNT(*) as cnt
        FROM fi_feedback
        WHERE tenant_id = ? AND last_analyzed_at IS NOT NULL
        GROUP BY sentiment
    """, (tenant_id,))
    sentiment_counts = {r["sentiment"]: r["cnt"] for r in c.fetchall()}

    # Top issues by impact
    c.execute("""
        SELECT id, name, impact_score, trend, status, mention_count
        FROM fi_issues WHERE tenant_id = ?
        ORDER BY impact_score DESC LIMIT 10
    """, (tenant_id,))
    top_issues = [dict(r) for r in c.fetchall()]

    # Rising issues
    c.execute("""
        SELECT id, name, impact_score, mention_count
        FROM fi_issues WHERE tenant_id = ? AND trend = 'rising'
        ORDER BY impact_score DESC LIMIT 5
    """, (tenant_id,))
    rising = [dict(r) for r in c.fetchall()]

    # Recent feedback (last 10)
    c.execute("""
        SELECT f.id, f.text, f.sentiment, f.source, f.priority, f.created_at,
               f.last_analyzed_at,
               i.name AS issue_name
        FROM fi_feedback f
        LEFT JOIN fi_issues i ON i.id = f.issue_id
        WHERE f.tenant_id = ? AND f.last_analyzed_at IS NOT NULL
        ORDER BY f.created_at DESC LIMIT 10
    """, (tenant_id,))
    recent = [dict(r) for r in c.fetchall()]

    # Open vs resolved
    c.execute("""
        SELECT status, COUNT(*) as cnt
        FROM fi_feedback WHERE tenant_id = ?
        GROUP BY status
    """, (tenant_id,))
    status_counts = {r["status"]: r["cnt"] for r in c.fetchall()}

    # Customer count
    c.execute("SELECT COUNT(*) FROM fi_customers WHERE tenant_id = ?", (tenant_id,))
    customer_count = c.fetchone()[0]

    # Issue count
    c.execute("SELECT COUNT(*) FROM fi_issues WHERE tenant_id = ?", (tenant_id,))
    issue_count = c.fetchone()[0]

    # ------------------------------------------------------------------
    # Churn Intelligence (production dashboard answer set)
    # ------------------------------------------------------------------
    now = datetime.utcnow()
    driver_lookback_days = 90
    risk_lookback_days = 30
    trend_window_days = 7

    driver_cutoff_date = (now - timedelta(days=driver_lookback_days)).strftime("%Y-%m-%d")
    risk_cutoff_date = (now - timedelta(days=risk_lookback_days)).strftime("%Y-%m-%d")

    invalid_driver_tokens = {
        "",
        "none",
        "null",
        "n/a",
        "na",
        "unknown",
        "unclassified",
    }

    def _driver_label_from_row(row: Dict[str, Any]) -> str:
        metadata = _json_load_dict(row.get("metadata_json"))
        analysis_meta = metadata.get("analysis") if isinstance(metadata.get("analysis"), dict) else {}
        specific_label = _derive_actionable_issue_label(
            analysis_meta.get("issue"),
            analysis_meta.get("feature_request"),
            analysis_meta.get("user_suggestion"),
            _extract_feature_gap_label(
                analysis_meta.get("feature_request"),
                analysis_meta.get("user_suggestion"),
                analysis_meta.get("issue"),
                row.get("text"),
            ),
            row.get("issue_name"),
            row.get("theme_cluster"),
            row.get("theme_primary"),
        )
        if specific_label and not _is_generic_issue_label(specific_label):
            return specific_label
        candidates = [
            row.get("theme_cluster"),
            row.get("theme_primary"),
            row.get("pain_point_category"),
            row.get("issue_name"),
        ]
        for value in candidates:
            label = _coerce_text(value, "", 120)
            if not label:
                continue
            lowered = label.lower()
            if lowered in invalid_driver_tokens:
                continue
            if lowered == "other":
                continue
            return label
        for value in candidates:
            label = _coerce_text(value, "", 120)
            if label and label.lower() not in invalid_driver_tokens:
                return label
        return "General feedback"

    def _safe_int(value: Any, fallback: int = 0) -> int:
        try:
            return int(value)
        except Exception:
            return fallback

    def _extract_date(value: Any):
        text = _coerce_text(value, "", 32)
        if len(text) >= 10 and text[4] == "-" and text[7] == "-":
            try:
                return datetime.strptime(text[:10], "%Y-%m-%d").date()
            except Exception:
                return None
        return None

    def _normalize_sentiment_name(sentiment_value: Any, sentiment_score: Any) -> str:
        sentiment_name = str(sentiment_value or "").strip().lower()
        if sentiment_name in {"positive", "neutral", "negative"}:
            return sentiment_name
        score = _sentiment_numeric(sentiment_score)
        if score > 0.15:
            return "positive"
        if score < -0.15:
            return "negative"
        return "neutral"

    def _trend_from_counts(latest_count: int, previous_count: int) -> Tuple[str, float]:
        latest = max(0, int(latest_count or 0))
        previous = max(0, int(previous_count or 0))
        if previous == 0:
            if latest > 0:
                return "rising", 100.0
            return "stable", 0.0
        change = (latest - previous) / previous
        if change > 0.2:
            return "rising", round(change * 100.0, 1)
        if change < -0.2:
            return "declining", round(change * 100.0, 1)
        return "stable", round(change * 100.0, 1)

    def _risk_tier_from_score(
        risk_score: float,
        high_churn_flags: int,
        recent_negative_feedback: int,
        avg_sentiment_score: float,
    ) -> str:
        if high_churn_flags >= 2:
            return "high"
        if risk_score >= 8.0:
            return "high"
        if recent_negative_feedback >= 3 and avg_sentiment_score <= -0.4:
            return "high"
        if high_churn_flags >= 1:
            return "medium"
        if risk_score >= 4.0:
            return "medium"
        if recent_negative_feedback >= 2:
            return "medium"
        return "low"

    def _priority_tier(priority_score: float, negative_ratio: float, frequency: int) -> str:
        if priority_score >= 20.0 or (negative_ratio >= 0.75 and frequency >= 5):
            return "P0"
        if priority_score >= 10.0 or (negative_ratio >= 0.55 and frequency >= 3):
            return "P1"
        return "P2"

    def _action_template_for_driver(driver_name: str) -> str:
        key = str(driver_name or "").strip().lower()
        if any(token in key for token in ("pricing", "billing", "cost", "subscription", "plan", "renewal")):
            return "Reach out to users complaining about pricing and test packaging clarity or targeted offers."
        if any(token in key for token in ("onboarding", "setup", "activation", "getting started", "tutorial")):
            return "Improve onboarding step X by removing first-run friction and clarifying the value path."
        if any(token in key for token in ("crash", "bug", "error", "stability", "performance", "reliability", "slow")):
            return "Prioritize reliability fixes first to stop churn from unresolved product quality issues."
        if any(token in key for token in ("support", "response", "help", "ticket", "service")):
            return "Tighten support response SLAs and add proactive follow-up for unresolved complaints."
        if any(token in key for token in ("integration", "api", "sync", "workflow", "feature")):
            return "Close the highest-volume integration or feature gap blocking adoption."
        return "Assign this theme to a fix owner and ship one measurable improvement in the next sprint."

    has_feedback_metadata = _column_exists(c, "fi_feedback", "metadata_json")
    metadata_select_sql = "f.metadata_json" if has_feedback_metadata else "'' AS metadata_json"

    c.execute(
        f"""
        SELECT
            f.id,
            f.text,
            f.sentiment,
            f.sentiment_score,
            f.churn_risk,
            f.theme_cluster,
            f.theme_primary,
            f.pain_point_category,
            f.issue_id,
            f.created_at,
            {metadata_select_sql},
            i.name AS issue_name
        FROM fi_feedback f
        LEFT JOIN fi_issues i
            ON i.id = f.issue_id AND i.tenant_id = f.tenant_id
        WHERE f.tenant_id = ?
          AND f.last_analyzed_at IS NOT NULL
          AND DATE(COALESCE(f.created_at, '')) >= DATE(?)
        ORDER BY f.created_at DESC
        """,
        (tenant_id, driver_cutoff_date),
    )
    driver_rows = [dict(row) for row in c.fetchall()]

    latest_window_start = (now - timedelta(days=trend_window_days - 1)).date()
    previous_window_start = (now - timedelta(days=(trend_window_days * 2) - 1)).date()
    previous_window_end = (now - timedelta(days=trend_window_days)).date()

    driver_buckets: Dict[str, Dict[str, Any]] = {}
    for row in driver_rows:
        driver_name = _driver_label_from_row(row)
        bucket = driver_buckets.setdefault(
            driver_name,
            {
                "driver": driver_name,
                "count": 0,
                "positive_count": 0,
                "neutral_count": 0,
                "negative_count": 0,
                "high_risk_count": 0,
                "medium_risk_count": 0,
                "low_risk_count": 0,
                "sentiment_score_sum": 0.0,
                "latest_count": 0,
                "previous_count": 0,
                "issue_ref_counts": {},
            },
        )

        bucket["count"] += 1
        sentiment_name = _normalize_sentiment_name(row.get("sentiment"), row.get("sentiment_score"))
        bucket[f"{sentiment_name}_count"] += 1
        bucket["sentiment_score_sum"] += _sentiment_numeric(row.get("sentiment_score"))

        churn_risk = str(row.get("churn_risk") or "").strip().lower()
        if churn_risk == "high":
            bucket["high_risk_count"] += 1
        elif churn_risk == "medium":
            bucket["medium_risk_count"] += 1
        elif churn_risk == "low":
            bucket["low_risk_count"] += 1

        issue_id = _safe_int(row.get("issue_id"), 0)
        issue_name = _coerce_text(row.get("issue_name"), "", 120)
        if issue_id > 0:
            issue_key = f"{issue_id}:{issue_name or ''}"
            bucket["issue_ref_counts"][issue_key] = bucket["issue_ref_counts"].get(issue_key, 0) + 1

        created_date = _extract_date(row.get("created_at"))
        if created_date:
            if created_date >= latest_window_start:
                bucket["latest_count"] += 1
            elif previous_window_start <= created_date <= previous_window_end:
                bucket["previous_count"] += 1

    top_churn_drivers: List[Dict[str, Any]] = []
    fix_first_candidates: List[Dict[str, Any]] = []

    for bucket in driver_buckets.values():
        count = max(1, int(bucket["count"]))
        negative_ratio = float(bucket["negative_count"]) / count
        avg_sentiment = float(bucket["sentiment_score_sum"]) / count

        weighted_churn = (
            (bucket["high_risk_count"] * 3)
            + (bucket["medium_risk_count"] * 2)
            + (bucket["low_risk_count"] * 1)
        )
        sentiment_pressure = max(0.0, -avg_sentiment)
        churn_driver_score = weighted_churn * (1.0 + negative_ratio + sentiment_pressure)

        trend, trend_delta_pct = _trend_from_counts(bucket["latest_count"], bucket["previous_count"])

        dominant_issue_id = None
        dominant_issue_name = ""
        if bucket["issue_ref_counts"]:
            best_issue_key = max(
                bucket["issue_ref_counts"].items(),
                key=lambda item: (item[1], item[0]),
            )[0]
            issue_parts = best_issue_key.split(":", 1)
            dominant_issue_id = _safe_int(issue_parts[0], 0)
            dominant_issue_name = issue_parts[1] if len(issue_parts) > 1 else ""

        top_churn_drivers.append(
            {
                "driver": bucket["driver"],
                "feedback_count": bucket["count"],
                "negative_ratio": round(negative_ratio, 4),
                "avg_sentiment": round(avg_sentiment, 4),
                "high_risk_count": bucket["high_risk_count"],
                "medium_risk_count": bucket["medium_risk_count"],
                "low_risk_count": bucket["low_risk_count"],
                "trend": trend,
                "trend_delta_pct": trend_delta_pct,
                "driver_score": round(churn_driver_score, 2),
                "issue_id": dominant_issue_id if dominant_issue_id else None,
                "issue_name": dominant_issue_name,
            }
        )

        frequency = int(bucket["count"])
        negativity_score = frequency * negative_ratio
        sentiment_penalty = frequency * max(0.0, -avg_sentiment)
        priority_score = (
            frequency
            + (negativity_score * 1.4)
            + sentiment_penalty
            + (bucket["high_risk_count"] * 0.75)
        )
        fix_first_candidates.append(
            {
                "driver": bucket["driver"],
                "frequency": frequency,
                "negative_ratio": round(negative_ratio, 4),
                "avg_sentiment": round(avg_sentiment, 4),
                "high_risk_count": int(bucket["high_risk_count"]),
                "priority_score": round(priority_score, 2),
                "priority_tier": _priority_tier(priority_score, negative_ratio, frequency),
                "issue_id": dominant_issue_id if dominant_issue_id else None,
                "issue_name": dominant_issue_name,
            }
        )

    top_churn_drivers.sort(
        key=lambda item: (
            -float(item.get("driver_score") or 0.0),
            -int(item.get("feedback_count") or 0),
            item.get("driver") or "",
        )
    )
    top_churn_drivers = top_churn_drivers[:5]

    fix_first_candidates.sort(
        key=lambda item: (
            -float(item.get("priority_score") or 0.0),
            -int(item.get("frequency") or 0),
            item.get("driver") or "",
        )
    )
    fix_first_priorities = []
    for idx, item in enumerate(fix_first_candidates[:5], start=1):
        fix_first_priorities.append(
            {
                **item,
                "rank": idx,
                "why": (
                    f"{item['frequency']} mentions with "
                    f"{round(float(item['negative_ratio']) * 100.0, 1)}% negative sentiment."
                ),
            }
        )

    c.execute(
        """
        SELECT
            f.customer_id,
            COALESCE(cu.customer_identifier, ('customer-' || CAST(f.customer_id AS TEXT))) AS customer_identifier,
            f.sentiment,
            f.sentiment_score,
            f.churn_risk,
            f.created_at
        FROM fi_feedback f
        LEFT JOIN fi_customers cu
            ON cu.id = f.customer_id AND cu.tenant_id = f.tenant_id
        WHERE f.tenant_id = ?
          AND f.last_analyzed_at IS NOT NULL
          AND f.customer_id IS NOT NULL
          AND DATE(COALESCE(f.created_at, '')) >= DATE(?)
        ORDER BY f.customer_id ASC, f.created_at DESC
        """,
        (tenant_id, risk_cutoff_date),
    )
    risk_rows = [dict(row) for row in c.fetchall()]

    customer_risk_map: Dict[int, Dict[str, Any]] = {}
    for row in risk_rows:
        customer_id = _safe_int(row.get("customer_id"), 0)
        if customer_id <= 0:
            continue

        entry = customer_risk_map.setdefault(
            customer_id,
            {
                "customer_id": customer_id,
                "customer_identifier": _coerce_text(row.get("customer_identifier"), f"customer-{customer_id}", 180),
                "total_recent_feedback": 0,
                "recent_negative_feedback": 0,
                "high_churn_flags": 0,
                "medium_churn_flags": 0,
                "low_churn_flags": 0,
                "sentiment_sum": 0.0,
                "sentiment_scores": [],
                "last_feedback_at": _coerce_text(row.get("created_at"), "", 40),
            },
        )

        entry["total_recent_feedback"] += 1
        sentiment_name = _normalize_sentiment_name(row.get("sentiment"), row.get("sentiment_score"))
        if sentiment_name == "negative":
            entry["recent_negative_feedback"] += 1
        entry["sentiment_sum"] += _sentiment_numeric(row.get("sentiment_score"))
        entry["sentiment_scores"].append(_sentiment_numeric(row.get("sentiment_score")))

        churn_risk = str(row.get("churn_risk") or "").strip().lower()
        if churn_risk == "high":
            entry["high_churn_flags"] += 1
        elif churn_risk == "medium":
            entry["medium_churn_flags"] += 1
        elif churn_risk == "low":
            entry["low_churn_flags"] += 1

        last_feedback_at = _coerce_text(row.get("created_at"), "", 40)
        if last_feedback_at and (not entry["last_feedback_at"] or last_feedback_at > entry["last_feedback_at"]):
            entry["last_feedback_at"] = last_feedback_at

    risk_users: List[Dict[str, Any]] = []
    risk_summary = {"high": 0, "medium": 0, "low": 0, "total": 0}
    for entry in customer_risk_map.values():
        total_recent = max(1, int(entry["total_recent_feedback"]))
        avg_sentiment = float(entry["sentiment_sum"]) / total_recent
        sentiment_scores = entry["sentiment_scores"][:]
        latest_scores = sentiment_scores[:3]
        previous_scores = sentiment_scores[3:6]
        sentiment_trend = _trend_from_values(latest_scores, previous_scores, threshold=0.1)

        risk_score = (
            (entry["high_churn_flags"] * 4.0)
            + (entry["medium_churn_flags"] * 2.0)
            + (entry["recent_negative_feedback"] * 1.5)
            + max(0.0, -avg_sentiment * 3.0)
        )
        if sentiment_trend == "degrading":
            risk_score += 1.5
        elif sentiment_trend == "improving":
            risk_score = max(0.0, risk_score - 0.5)

        risk_level = _risk_tier_from_score(
            risk_score,
            entry["high_churn_flags"],
            entry["recent_negative_feedback"],
            avg_sentiment,
        )

        risk_summary[risk_level] += 1
        risk_summary["total"] += 1

        risk_users.append(
            {
                "customer_id": entry["customer_id"],
                "customer_identifier": entry["customer_identifier"],
                "risk_level": risk_level,
                "risk_score": round(risk_score, 2),
                "recent_negative_feedback": int(entry["recent_negative_feedback"]),
                "high_churn_flags": int(entry["high_churn_flags"]),
                "medium_churn_flags": int(entry["medium_churn_flags"]),
                "avg_sentiment": round(avg_sentiment, 4),
                "sentiment_trend": sentiment_trend,
                "total_recent_feedback": int(entry["total_recent_feedback"]),
                "last_feedback_at": entry["last_feedback_at"],
            }
        )

    risk_users.sort(
        key=lambda item: (
            {"high": 2, "medium": 1, "low": 0}.get(item.get("risk_level"), 0) * -1,
            -float(item.get("risk_score") or 0.0),
            -int(item.get("recent_negative_feedback") or 0),
            item.get("customer_identifier") or "",
        )
    )
    top_at_risk_users = [item for item in risk_users if item.get("risk_level") in {"high", "medium"}][:12]

    action_suggestions: List[Dict[str, Any]] = []
    if risk_summary["high"] > 0:
        action_suggestions.append(
            {
                "title": "Reach out to high-risk users immediately",
                "action": "Contact high-risk users within 24 hours and offer targeted help or retention incentives.",
                "priority": "immediate",
                "owner": "Customer Success",
                "reason": f"{risk_summary['high']} users are tagged high risk from recent negative feedback.",
            }
        )

    used_driver_names = set()
    for fix in fix_first_priorities[:3]:
        driver_name = _coerce_text(fix.get("driver"), "General feedback", 120)
        lowered = driver_name.lower()
        if lowered in used_driver_names:
            continue
        used_driver_names.add(lowered)
        action_suggestions.append(
            {
                "title": f"Address {driver_name}",
                "action": _action_template_for_driver(driver_name),
                "priority": "next sprint" if fix.get("priority_tier") == "P2" else "this sprint",
                "owner": "Product + Engineering",
                "reason": (
                    f"Rank #{fix.get('rank')} with {fix.get('frequency')} mentions and "
                    f"{round(float(fix.get('negative_ratio') or 0.0) * 100.0, 1)}% negative sentiment."
                ),
                "related_driver": driver_name,
                "priority_tier": fix.get("priority_tier"),
            }
        )

    if not action_suggestions:
        action_suggestions.append(
            {
                "title": "No urgent churn actions detected",
                "action": "Continue monitoring incoming feedback and rerun analysis after the next import cycle.",
                "priority": "monitor",
                "owner": "Product Operations",
                "reason": "Insufficient analyzed data for churn-focused recommendations.",
            }
        )

    issue_pattern_memory: List[Dict[str, Any]] = []
    if _table_exists(c, "fi_issue_memory"):
        c.execute(
            """
            SELECT
                pattern_label, mention_count, churn_linked_count, high_churn_count,
                recurrence_score, trend_direction, trend_score, latest_7d_count, previous_7d_count
            FROM fi_issue_memory
            WHERE tenant_id = ?
            ORDER BY recurrence_score DESC, trend_score DESC, mention_count DESC
            LIMIT 8
            """,
            (tenant_id,),
        )
        issue_pattern_memory = [dict(row) for row in c.fetchall()]

    conn.close()

    return {
        "total_feedback": total,
        "analyzed_feedback": analyzed_total,
        "pending_feedback": pending_total,
        "negative_sentiment": neg_pct,
        "sentiment_counts": sentiment_counts,
        "top_issues": top_issues,
        "rising_issues": rising,
        "recent_feedback": recent,
        "status_counts": status_counts,
        "customer_count": customer_count,
        "issue_count": issue_count,
        "churn_intelligence": {
            "lookback_days": driver_lookback_days,
            "risk_window_days": risk_lookback_days,
            "generated_at": now.isoformat(),
            "why_users_are_leaving": {
                "summary": (
                    "Top churn drivers ranked by risk-weighted volume, sentiment, and trend."
                    if top_churn_drivers
                    else "No analyzed feedback available to identify churn drivers."
                ),
                "top_drivers": top_churn_drivers,
            },
            "what_to_fix_first": {
                "summary": (
                    "Fix-first ranking blends issue frequency with negative sentiment pressure."
                    if fix_first_priorities
                    else "No fix-first priorities available yet."
                ),
                "prioritized_issues": fix_first_priorities,
            },
            "who_is_at_risk": {
                "summary": risk_summary,
                "users": top_at_risk_users,
            },
            "what_to_do_next": {
                "actions": action_suggestions[:5],
            },
            "issue_pattern_memory": issue_pattern_memory,
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# AGENTIC RESPONSE GENERATION
# ──────────────────────────────────────────────────────────────────────────────

def _to_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return fallback


def _to_bool(value: Any, fallback: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return fallback
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return fallback


def fi_list_offer_knowledge_base(
    tenant_id: int,
    *,
    segment: Optional[str] = None,
    active_only: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()

    where = ["tenant_id = ?"]
    params: List[Any] = [tenant_id]
    if active_only:
        where.append("active = 1")
    if segment:
        normalized_segment = _normalize_segment(segment, "all")
        where.append("(LOWER(segment) LIKE ? OR LOWER(segment) IN ('all','any','default','*'))")
        params.append(f"%{normalized_segment}%")

    where_clause = " AND ".join(where)
    c.execute(f"SELECT COUNT(*) FROM fi_offer_knowledge_base WHERE {where_clause}", params)
    total = _to_int(c.fetchone()[0], 0)

    c.execute(
        f"""
        SELECT
            id, tenant_id, name, segment, channel, offer_title, offer_details,
            discount_code, cta_text, email_subject, template_email, template_sms,
            customer_identifiers_json,
            priority, active, created_at, updated_at
        FROM fi_offer_knowledge_base
        WHERE {where_clause}
        ORDER BY active DESC, priority ASC, id DESC
        LIMIT ? OFFSET ?
        """,
        params + [max(1, min(limit, 500)), max(0, offset)],
    )
    items = [_serialize_kb_offer_row(row) for row in c.fetchall()]

    conn.close()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def fi_create_offer_knowledge_base(tenant_id: int, payload: Dict[str, Any]) -> int:
    name = _coerce_text(payload.get("name"), "", 120)
    offer_title = _coerce_text(payload.get("offer_title"), "", 160)
    if not name:
        raise ValueError("name is required")
    if not offer_title:
        raise ValueError("offer_title is required")

    segment = _normalize_segment(payload.get("segment"), "all")
    channel = _normalize_kb_channel(payload.get("channel"))
    offer_details = _coerce_text(payload.get("offer_details"), "", 500)
    discount_code = _coerce_text(payload.get("discount_code"), "", 80)
    cta_text = _coerce_text(payload.get("cta_text"), "", 220)
    email_subject = _coerce_text(payload.get("email_subject"), "", 220)
    template_email = _coerce_text(payload.get("template_email"), "", 2200)
    template_sms = _coerce_text(payload.get("template_sms"), "", 520)
    customer_identifiers = _normalize_customer_identifier_list(payload.get("customer_identifiers"))
    priority = max(1, min(_to_int(payload.get("priority"), 100), 9999))
    active = 1 if _to_bool(payload.get("active"), True) else 0

    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO fi_offer_knowledge_base (
            tenant_id, name, segment, channel, offer_title, offer_details,
            discount_code, cta_text, email_subject, template_email, template_sms,
            customer_identifiers_json,
            priority, active, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (
            tenant_id,
            name,
            segment,
            channel,
            offer_title,
            offer_details,
            discount_code,
            cta_text,
            email_subject,
            template_email,
            template_sms,
            _safe_json_dumps(customer_identifiers),
            priority,
            active,
        ),
    )
    offer_id = int(c.lastrowid or 0)
    conn.commit()
    conn.close()
    return offer_id


def fi_update_offer_knowledge_base(offer_id: int, tenant_id: int, payload: Dict[str, Any]) -> bool:
    allowed_fields = {
        "name": ("name", lambda value: _coerce_text(value, "", 120)),
        "segment": ("segment", lambda value: _normalize_segment(value, "all")),
        "channel": ("channel", lambda value: _normalize_kb_channel(value)),
        "offer_title": ("offer_title", lambda value: _coerce_text(value, "", 160)),
        "offer_details": ("offer_details", lambda value: _coerce_text(value, "", 500)),
        "discount_code": ("discount_code", lambda value: _coerce_text(value, "", 80)),
        "cta_text": ("cta_text", lambda value: _coerce_text(value, "", 220)),
        "email_subject": ("email_subject", lambda value: _coerce_text(value, "", 220)),
        "template_email": ("template_email", lambda value: _coerce_text(value, "", 2200)),
        "template_sms": ("template_sms", lambda value: _coerce_text(value, "", 520)),
        "customer_identifiers": ("customer_identifiers_json", lambda value: _safe_json_dumps(_normalize_customer_identifier_list(value))),
        "priority": ("priority", lambda value: max(1, min(_to_int(value, 100), 9999))),
        "active": ("active", lambda value: 1 if _to_bool(value, True) else 0),
    }

    updates: List[str] = []
    params: List[Any] = []
    for field, (db_field, transform) in allowed_fields.items():
        if field not in payload:
            continue
        value = transform(payload.get(field))
        if field in {"name", "offer_title"} and not value:
            raise ValueError(f"{field} cannot be empty")
        updates.append(f"{db_field} = ?")
        params.append(value)

    if not updates:
        return False

    updates.append("updated_at = CURRENT_TIMESTAMP")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        f"UPDATE fi_offer_knowledge_base SET {', '.join(updates)} WHERE id = ? AND tenant_id = ?",
        params + [offer_id, tenant_id],
    )
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def fi_delete_offer_knowledge_base(offer_id: int, tenant_id: int) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM fi_offer_knowledge_base WHERE id = ? AND tenant_id = ?", (offer_id, tenant_id))
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def _serialize_email_connector_row(row: Optional[Any]) -> Dict[str, Any]:
    if not row:
        return {
            "configured": False,
            "active": False,
            "connector_name": "Primary Email",
            "from_name": "",
            "from_email": "",
            "reply_to": "",
            "smtp_host": "",
            "smtp_port": 587,
            "smtp_security": "starttls",
            "smtp_username": "",
            "smtp_password": "",
            "has_password": False,
            "last_error": "",
            "last_tested_at": None,
        }

    item = dict(row)
    config = _json_load_dict(item.get("config_json"))
    smtp_security = _coerce_text(config.get("smtp_security"), "starttls", 16).lower()
    if smtp_security not in {"starttls", "ssl", "none"}:
        smtp_security = "starttls"
    return {
        "configured": True,
        "active": bool(item.get("active")),
        "connector_name": _coerce_text(item.get("name"), "Primary Email", 120),
        "from_name": _coerce_text(config.get("from_name"), "", 120),
        "from_email": _normalize_email(config.get("from_email")),
        "reply_to": _normalize_email(config.get("reply_to")),
        "smtp_host": _coerce_text(config.get("smtp_host"), "", 160),
        "smtp_port": max(1, min(_to_int(config.get("smtp_port"), 587), 65535)),
        "smtp_security": smtp_security,
        "smtp_username": _coerce_text(config.get("smtp_username"), "", 180),
        "smtp_password": "",
        "has_password": bool(_coerce_text(config.get("smtp_password"), "", 240)),
        "last_error": _coerce_text(item.get("last_error"), "", 320),
        "last_tested_at": item.get("last_tested_at"),
    }


def fi_get_email_connector(tenant_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, tenant_id, connector_type, name, config_json, active, last_error, last_tested_at
        FROM fi_delivery_connectors
        WHERE tenant_id = ? AND connector_type = 'email'
        """,
        (tenant_id,),
    )
    row = c.fetchone()
    conn.close()
    return _serialize_email_connector_row(row)


def fi_upsert_email_connector(tenant_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    connector_name = _coerce_text(payload.get("connector_name") or payload.get("name"), "Primary Email", 120)
    from_name = _coerce_text(payload.get("from_name"), "", 120)
    from_email = _normalize_email(payload.get("from_email"))
    reply_to = _normalize_email(payload.get("reply_to"))
    smtp_host = _coerce_text(payload.get("smtp_host"), "", 160)
    smtp_port = max(1, min(_to_int(payload.get("smtp_port"), 587), 65535))
    smtp_username = _coerce_text(payload.get("smtp_username"), "", 180)
    smtp_password = _coerce_text(payload.get("smtp_password"), "", 240)
    smtp_security = _coerce_text(payload.get("smtp_security"), "starttls", 16).lower()
    if smtp_security not in {"starttls", "ssl", "none"}:
        smtp_security = "starttls"
    active = 1 if _to_bool(payload.get("active"), True) else 0

    if not from_email:
        raise ValueError("from_email is required")
    if not smtp_host:
        raise ValueError("smtp_host is required")

    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, config_json
        FROM fi_delivery_connectors
        WHERE tenant_id = ? AND connector_type = 'email'
        """,
        (tenant_id,),
    )
    existing = c.fetchone()
    existing_config = _json_load_dict(existing["config_json"]) if existing else {}
    if not smtp_password:
        smtp_password = _coerce_text(existing_config.get("smtp_password"), "", 240)
    if not smtp_password:
        conn.close()
        raise ValueError("smtp_password is required")

    config = {
        "from_name": from_name,
        "from_email": from_email,
        "reply_to": reply_to,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_username": smtp_username,
        "smtp_password": smtp_password,
        "smtp_security": smtp_security,
    }
    if existing:
        c.execute(
            """
            UPDATE fi_delivery_connectors
            SET name = ?, config_json = ?, active = ?, last_error = '', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ?
            """,
            (connector_name, _safe_json_dumps(config), active, existing["id"], tenant_id),
        )
    else:
        c.execute(
            """
            INSERT INTO fi_delivery_connectors (
                tenant_id, connector_type, name, config_json, active, last_error, updated_at
            )
            VALUES (?, 'email', ?, ?, ?, '', CURRENT_TIMESTAMP)
            """,
            (tenant_id, connector_name, _safe_json_dumps(config), active),
        )
    conn.commit()
    conn.close()
    return fi_get_email_connector(tenant_id)


def _load_active_email_connector(tenant_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, tenant_id, connector_type, name, config_json, active, last_error, last_tested_at
        FROM fi_delivery_connectors
        WHERE tenant_id = ? AND connector_type = 'email' AND active = 1
        """,
        (tenant_id,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        raise ValueError("Configure and activate an email connector before sending direct email.")

    item = dict(row)
    config = _json_load_dict(item.get("config_json"))
    connector = _serialize_email_connector_row(row)
    connector["smtp_password"] = _coerce_text(config.get("smtp_password"), "", 240)
    if not connector["smtp_password"]:
        raise ValueError("The email connector is missing its SMTP password.")
    return connector


def _update_email_connector_status(tenant_id: int, *, error: str = "") -> None:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        UPDATE fi_delivery_connectors
        SET last_error = ?, last_tested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND connector_type = 'email'
        """,
        (_coerce_text(error, "", 500), tenant_id),
    )
    conn.commit()
    conn.close()


def _build_customer_offer_audience(tenant_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT
            cu.id AS customer_id,
            cu.customer_identifier,
            cu.overall_sentiment,
            f.user_segment,
            f.metadata_json,
            f.created_at
        FROM fi_feedback f
        JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE f.tenant_id = ? AND cu.tenant_id = ? AND f.last_analyzed_at IS NOT NULL
        ORDER BY f.created_at DESC, f.id DESC
        """,
        (tenant_id, tenant_id),
    )
    rows = [dict(row) for row in c.fetchall()]
    conn.close()

    if not rows:
        return {
            "segments": [],
            "customers": [],
            "total_segments": 0,
            "total_customers": 0,
            "contactable_customers": 0,
        }

    customers_by_id: Dict[int, Dict[str, Any]] = {}
    feedback_counts_by_segment: Dict[str, int] = {}

    for row in rows:
        customer_id = _to_int(row.get("customer_id"), 0)
        if customer_id <= 0:
            continue
        customer_identifier = _coerce_text(row.get("customer_identifier"), f"customer-{customer_id}", 180)
        segment = _normalize_segment(row.get("user_segment"), "unassigned")
        metadata = _json_load_dict(row.get("metadata_json"))
        contact = _extract_feedback_contact(metadata, customer_identifier)

        customer_entry = customers_by_id.setdefault(
            customer_id,
            {
                "id": customer_id,
                "customer_identifier": customer_identifier,
                "overall_sentiment": _coerce_text(row.get("overall_sentiment"), "neutral", 20),
                "feedback_count": 0,
                "segment_counts": {},
                "contact_email": "",
                "contact_mobile": "",
                "contact_name": "",
                "last_feedback_at": row.get("created_at"),
            },
        )
        customer_entry["feedback_count"] += 1
        customer_entry["segment_counts"][segment] = customer_entry["segment_counts"].get(segment, 0) + 1
        if not customer_entry["contact_email"] and contact.get("email"):
            customer_entry["contact_email"] = contact.get("email", "")
        if not customer_entry["contact_mobile"] and contact.get("mobile"):
            customer_entry["contact_mobile"] = contact.get("mobile", "")
        if not customer_entry["contact_name"] and contact.get("name"):
            customer_entry["contact_name"] = contact.get("name", "")
        if row.get("created_at") and str(row.get("created_at")) > str(customer_entry.get("last_feedback_at") or ""):
            customer_entry["last_feedback_at"] = row.get("created_at")

        feedback_counts_by_segment[segment] = feedback_counts_by_segment.get(segment, 0) + 1

    customers: List[Dict[str, Any]] = []
    segment_map: Dict[str, Dict[str, Any]] = {}

    for customer in customers_by_id.values():
        segment_counts = customer.get("segment_counts") or {}
        dominant_segment = "unassigned"
        if segment_counts:
            dominant_segment = sorted(
                segment_counts.items(),
                key=lambda item: (-item[1], item[0]),
            )[0][0]

        customer_item = {
            "id": customer["id"],
            "customer_identifier": customer["customer_identifier"],
            "contact_name": customer.get("contact_name") or _guess_name_from_identifier(customer["customer_identifier"]),
            "contact_email": customer.get("contact_email", ""),
            "contact_mobile": customer.get("contact_mobile", ""),
            "overall_sentiment": customer.get("overall_sentiment", "neutral"),
            "segment": dominant_segment,
            "feedback_count": int(customer.get("feedback_count") or 0),
            "contactable": bool(customer.get("contact_email")),
            "last_feedback_at": customer.get("last_feedback_at"),
        }
        customers.append(customer_item)

        segment_entry = segment_map.setdefault(
            dominant_segment,
            {
                "segment": dominant_segment,
                "customer_count": 0,
                "contactable_count": 0,
                "feedback_count": int(feedback_counts_by_segment.get(dominant_segment, 0)),
                "customers": [],
            },
        )
        segment_entry["customer_count"] += 1
        if customer_item["contactable"]:
            segment_entry["contactable_count"] += 1
        if len(segment_entry["customers"]) < 8:
            segment_entry["customers"].append(
                {
                    "id": customer_item["id"],
                    "customer_identifier": customer_item["customer_identifier"],
                    "contact_name": customer_item["contact_name"],
                    "contact_email": customer_item["contact_email"],
                    "feedback_count": customer_item["feedback_count"],
                    "overall_sentiment": customer_item["overall_sentiment"],
                }
            )

    customers.sort(key=lambda item: (-int(item.get("feedback_count") or 0), item.get("customer_identifier") or ""))
    segments = sorted(
        segment_map.values(),
        key=lambda item: (-int(item.get("customer_count") or 0), -int(item.get("feedback_count") or 0), item.get("segment") or ""),
    )
    contactable_customers = sum(1 for customer in customers if customer.get("contact_email"))
    return {
        "segments": segments,
        "customers": customers,
        "total_segments": len(segments),
        "total_customers": len(customers),
        "contactable_customers": contactable_customers,
    }


def fi_list_offer_audiences(tenant_id: int) -> Dict[str, Any]:
    return _build_customer_offer_audience(tenant_id)


def _resolve_offer_email_recipients(
    tenant_id: int,
    *,
    segment: Optional[str] = None,
    customer_identifiers: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    audience = _build_customer_offer_audience(tenant_id)
    requested_identifiers = {
        _normalize_customer_identifier(item, "")
        for item in _normalize_customer_identifier_list(customer_identifiers or [])
        if _normalize_customer_identifier(item, "")
    }
    requested_segments = {
        _normalize_segment(item, "")
        for item in _segment_tokens(segment or "all")
        if _normalize_segment(item, "")
    }
    include_all_segments = not requested_identifiers and (
        not requested_segments or any(token in ALL_SEGMENT_TOKENS for token in requested_segments)
    )

    recipients: List[Dict[str, Any]] = []
    seen_emails: set = set()
    for customer in audience.get("customers", []):
        email = _normalize_email(customer.get("contact_email"))
        if not email:
            continue
        normalized_identifier = _normalize_customer_identifier(customer.get("customer_identifier"), "")
        if requested_identifiers:
            if normalized_identifier not in requested_identifiers:
                continue
        elif not include_all_segments:
            if _normalize_segment(customer.get("segment"), "unassigned") not in requested_segments:
                continue
        if email in seen_emails:
            continue
        seen_emails.add(email)
        recipients.append(customer)
    return recipients


def _render_offer_email_template(
    offer: Dict[str, Any],
    recipient: Dict[str, Any],
    *,
    subject_override: str = "",
    message_override: str = "",
) -> Tuple[str, str]:
    offer_title = _coerce_text(offer.get("offer_title"), "Exclusive offer", 160)
    offer_details = _coerce_text(offer.get("offer_details"), "", 420)
    discount_code = _coerce_text(offer.get("discount_code"), "", 80)
    discount_line = f"Use code {discount_code}." if discount_code else ""
    cta_text = _coerce_text(offer.get("cta_text"), "Reply to this email and we will help right away.", 220)
    context = {
        "customer_name": _coerce_text(recipient.get("contact_name"), "Customer", 80),
        "customer_identifier": _coerce_text(recipient.get("customer_identifier"), "", 180),
        "segment": _normalize_segment(recipient.get("segment"), "all"),
        "offer_title": offer_title,
        "offer_details": offer_details,
        "discount_code": discount_code,
        "discount_line": discount_line,
        "cta_text": cta_text,
        "issue_name": "your recent experience",
        "feedback_summary": "",
        "source": "knowledge_base",
        "sentiment": _coerce_text(recipient.get("overall_sentiment"), "neutral", 20).lower(),
    }
    subject_template = _coerce_text(
        subject_override or offer.get("email_subject"),
        "{offer_title} for {customer_name}",
        220,
    )
    message_template = _coerce_text(
        message_override or offer.get("template_email"),
        (
            "Hi {customer_name},\n\n"
            "We wanted to share an offer that fits your recent experience.\n\n"
            "{offer_title}\n"
            "{offer_details}\n"
            "{discount_line}\n\n"
            "{cta_text}\n\n"
            "Best regards,\nCustomer Experience Team"
        ),
        2200,
    )
    subject = _coerce_text(_render_template(subject_template, context), offer_title, 220)
    body = _coerce_text(_render_template(message_template, context), "", 2200)
    return subject, body


def _send_email_via_connector(
    connector: Dict[str, Any],
    *,
    recipient_email: str,
    subject: str,
    message: str,
) -> None:
    smtp_host = _coerce_text(connector.get("smtp_host"), "", 160)
    smtp_port = max(1, min(_to_int(connector.get("smtp_port"), 587), 65535))
    smtp_username = _coerce_text(connector.get("smtp_username"), "", 180)
    smtp_password = _coerce_text(connector.get("smtp_password"), "", 240)
    smtp_security = _coerce_text(connector.get("smtp_security"), "starttls", 16).lower()
    from_email = _normalize_email(connector.get("from_email"))
    from_name = _coerce_text(connector.get("from_name"), "", 120)
    reply_to = _normalize_email(connector.get("reply_to"))

    if not smtp_host or not from_email:
        raise ValueError("The email connector is incomplete.")

    email_message = EmailMessage()
    email_message["From"] = formataddr((from_name, from_email)) if from_name else from_email
    email_message["To"] = recipient_email
    email_message["Subject"] = subject
    if reply_to:
        email_message["Reply-To"] = reply_to
    email_message.set_content(message)

    if smtp_security == "ssl":
        with smtplib.SMTP_SSL(
            smtp_host,
            smtp_port,
            timeout=30,
            context=ssl.create_default_context(),
        ) as smtp:
            if smtp_username:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(email_message)
        return

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
        smtp.ehlo()
        if smtp_security == "starttls":
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if smtp_username:
            smtp.login(smtp_username, smtp_password)
        smtp.send_message(email_message)


def fi_send_offer_email(
    tenant_id: int,
    offer_id: int,
    *,
    segment: Optional[str] = None,
    customer_identifiers: Optional[List[str]] = None,
    subject: str = "",
    message: str = "",
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT
            id, tenant_id, name, segment, channel, offer_title, offer_details,
            discount_code, cta_text, email_subject, template_email, template_sms,
            customer_identifiers_json, priority, active, created_at, updated_at
        FROM fi_offer_knowledge_base
        WHERE id = ? AND tenant_id = ?
        """,
        (offer_id, tenant_id),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        raise ValueError("Offer not found")

    offer = _serialize_kb_offer_row(row)
    if _normalize_kb_channel(offer.get("channel")) == "sms":
        raise ValueError("This offer is configured for SMS only. Change the offer channel before sending email.")
    requested_customer_identifiers = _normalize_customer_identifier_list(
        customer_identifiers or offer.get("customer_identifiers") or []
    )
    requested_segment = _normalize_segment(segment or offer.get("segment"), "all")
    recipients = _resolve_offer_email_recipients(
        tenant_id,
        segment=requested_segment,
        customer_identifiers=requested_customer_identifiers,
    )
    if not recipients:
        raise ValueError("No contactable customers found for the selected segment or individuals.")

    connector = _load_active_email_connector(tenant_id)
    sent: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []

    for recipient in recipients:
        recipient_email = _normalize_email(recipient.get("contact_email"))
        if not recipient_email:
            continue
        try:
            rendered_subject, rendered_message = _render_offer_email_template(
                offer,
                recipient,
                subject_override=subject,
                message_override=message,
            )
            _send_email_via_connector(
                connector,
                recipient_email=recipient_email,
                subject=rendered_subject,
                message=rendered_message,
            )
            sent.append(
                {
                    "customer_identifier": recipient.get("customer_identifier"),
                    "contact_name": recipient.get("contact_name"),
                    "contact_email": recipient_email,
                }
            )
        except Exception as exc:
            failures.append(
                {
                    "customer_identifier": recipient.get("customer_identifier"),
                    "contact_email": recipient_email,
                    "error": str(exc),
                }
            )

    _update_email_connector_status(
        tenant_id,
        error=failures[0]["error"] if failures else "",
    )

    status = "sent" if sent and not failures else "partial" if sent else "failed"
    return {
        "status": status,
        "offer_id": int(offer.get("id") or offer_id),
        "offer_name": offer.get("name"),
        "segment": requested_segment,
        "customer_identifiers": requested_customer_identifiers,
        "sent_count": len(sent),
        "failed_count": len(failures),
        "recipients": sent,
        "failures": failures,
    }


def fi_generate_agentic_outreach(
    feedback_id: int,
    tenant_id: int,
    *,
    persist: bool = True,
    auto_generated: bool = False,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        SELECT
            f.id,
            f.text,
            f.sentiment,
            f.user_segment,
            f.source,
            f.metadata_json,
            i.name AS issue_name,
            cu.customer_identifier
        FROM fi_feedback f
        LEFT JOIN fi_issues i ON i.id = f.issue_id
        LEFT JOIN fi_customers cu ON cu.id = f.customer_id
        WHERE f.id = ? AND f.tenant_id = ?
        """,
        (feedback_id, tenant_id),
    )
    row = c.fetchone()
    if not row:
        conn.close()
        return {"status": "error", "detail": "Feedback not found", "feedback_id": feedback_id}

    feedback_row = dict(row)
    metadata = _json_load_dict(feedback_row.get("metadata_json"))
    offers = _list_kb_offer_rows(c, tenant_id, active_only=True)
    result = _build_agentic_outreach(feedback_row, metadata=metadata, offers=offers)
    result["feedback_id"] = feedback_id
    result["auto_generated"] = bool(auto_generated)

    metadata["agentic_outreach"] = {
        "status": result.get("status"),
        "reason": result.get("reason"),
        "segment": result.get("segment"),
        "offer_id": result.get("offer_id"),
        "offer_name": result.get("offer_name"),
        "offer_title": result.get("offer_title"),
        "offer_channel": result.get("offer_channel"),
        "generated_at": datetime.utcnow().isoformat(),
        "contact": result.get("contact") or {},
        "channels": sorted(list((result.get("drafts") or {}).keys())),
    }

    saved_drafts: List[Dict[str, Any]] = []
    if result.get("status") == "ready" and persist:
        offer_id = _to_int(result.get("offer_id"), 0)
        for channel, draft in (result.get("drafts") or {}).items():
            draft_id = _upsert_outreach_draft(
                c,
                tenant_id=tenant_id,
                feedback_id=feedback_id,
                kb_offer_id=offer_id,
                channel=channel,
                recipient_name=_coerce_text((result.get("contact") or {}).get("name"), "Customer", 80),
                recipient_email=_coerce_text((result.get("contact") or {}).get("email"), "", 180),
                recipient_mobile=_coerce_text((result.get("contact") or {}).get("mobile"), "", 32),
                subject=_coerce_text(draft.get("subject"), "", 220),
                message=_coerce_text(draft.get("message"), "", 2200),
                auto_generated=auto_generated,
                metadata={
                    "segment": result.get("segment"),
                    "offer_id": offer_id,
                    "offer_name": result.get("offer_name"),
                    "feedback_id": feedback_id,
                },
            )
            saved_drafts.append(
                {
                    "id": draft_id,
                    "channel": channel,
                    "to": draft.get("to"),
                    "subject": draft.get("subject"),
                    "message": draft.get("message"),
                }
            )

    if persist:
        c.execute(
            "UPDATE fi_feedback SET metadata_json = ? WHERE id = ? AND tenant_id = ?",
            (_safe_json_dumps(metadata), feedback_id, tenant_id),
        )
        conn.commit()

    conn.close()
    result["saved_drafts"] = saved_drafts
    result["persisted"] = bool(persist)
    return result


def fi_generate_response(
    feedback_text: str,
    issue_name: str = "",
    issue_status: str = "",
    customer_name: str = "",
    response_type: str = "support_reply",
) -> Dict[str, str]:
    """
    Generate a professional response using the existing LLM pipeline.
    Falls back to a template if the LLM is unavailable.
    """
    try:
        from processor import query_ollama

        type_label = {
            "support_reply": "a professional customer support reply",
            "review_response": "a professional public review response",
            "product_update": "a product update notification",
        }.get(response_type, "a professional customer support reply")

        prompt = f"""You are a professional customer experience manager. Generate {type_label}.

Customer feedback: "{feedback_text}"
{"Related issue: " + issue_name if issue_name else ""}
{"Issue status: " + issue_status if issue_status else ""}
{"Customer name: " + customer_name if customer_name else ""}

Requirements:
- Be polite, empathetic, and professional
- Be concise (3-5 sentences max)
- If the issue is being investigated or resolved, mention that
- Offer a path forward or next steps
- Do NOT use placeholder brackets
- Return ONLY the response text, no JSON, no extra formatting"""

        generated = query_ollama(prompt, num_predict=220)
        if generated and str(generated).strip():
            return {"generated_response": str(generated).strip(), "type": response_type, "source": "llm"}

    except Exception as e:
        logger.warning(f"[FI-CRM] LLM response generation failed: {e}")

    # Template fallback
    name_part = f"Dear {customer_name}" if customer_name else "Dear Customer"
    issue_part = f" regarding {issue_name}" if issue_name else ""
    status_part = ""
    if issue_status == "investigating":
        status_part = " Our team is currently investigating this matter."
    elif issue_status == "resolved":
        status_part = " We're pleased to inform you that this issue has been resolved."

    template = (
        f"{name_part},\n\n"
        f"Thank you for sharing your feedback{issue_part}. "
        f"We take all customer feedback seriously and appreciate you bringing this to our attention."
        f"{status_part} "
        f"If you have any further concerns, please don't hesitate to reach out.\n\n"
        f"Best regards,\nCustomer Experience Team"
    )
    return {"generated_response": template, "type": response_type, "source": "template"}


# ──────────────────────────────────────────────────────────────────────────────

def _serialize_feedback_intelligence_row(row: Any) -> Dict[str, Any]:
    item = dict(row)
    item["rescue_payload"] = _json_load_dict(item.get("rescue_payload_json"))
    item.pop("rescue_payload_json", None)
    return item


def _upsert_feedback_intelligence_row(
    cursor,
    *,
    tenant_id: int,
    user_id: int,
    feedback_id: Optional[int],
    feedback_text: str,
    intelligence: Dict[str, Any],
    rescue_status: str,
    rescue_provider: str,
    rescue_payload: Optional[Dict[str, Any]] = None,
) -> int:
    feedback_hash = _feedback_hash_text(feedback_text)
    existing_id = None
    if feedback_id:
        cursor.execute(
            """
            SELECT id
            FROM feedback_intelligence
            WHERE tenant_id = ? AND user_id = ? AND feedback_id = ?
            """,
            (tenant_id, user_id, int(feedback_id)),
        )
        row = cursor.fetchone()
        if row:
            existing_id = int(row["id"])
    if not existing_id:
        cursor.execute(
            """
            SELECT id
            FROM feedback_intelligence
            WHERE tenant_id = ? AND user_id = ? AND feedback_hash = ?
            """,
            (tenant_id, user_id, feedback_hash),
        )
        row = cursor.fetchone()
        if row:
            existing_id = int(row["id"])

    payload_json = _safe_json_dumps(rescue_payload or {})
    sentiment = _coerce_text(intelligence.get("sentiment"), "neutral", 20).lower()
    churn_risk = _coerce_text(intelligence.get("churn_risk"), "low", 20).lower()
    primary_issue = _coerce_text(intelligence.get("primary_issue"), "general frustration", 120)
    reason = _coerce_text(intelligence.get("reason"), "", 260)
    best_action = _coerce_text(intelligence.get("best_action"), "", 260)
    suggested_message = _coerce_text(intelligence.get("suggested_message"), "", 500)
    rescue_status_value = _coerce_text(rescue_status, "not_triggered", 40).lower()
    rescue_provider_value = _coerce_text(rescue_provider, "none", 40).lower()

    if existing_id:
        cursor.execute(
            """
            UPDATE feedback_intelligence
            SET feedback_id = ?,
                feedback = ?,
                feedback_hash = ?,
                sentiment = ?,
                churn_risk = ?,
                primary_issue = ?,
                reason = ?,
                best_action = ?,
                suggested_message = ?,
                rescue_status = ?,
                rescue_provider = ?,
                rescue_payload_json = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ?
            """,
            (
                feedback_id,
                feedback_text,
                feedback_hash,
                sentiment,
                churn_risk,
                primary_issue,
                reason,
                best_action,
                suggested_message,
                rescue_status_value,
                rescue_provider_value,
                payload_json,
                existing_id,
                tenant_id,
            ),
        )
        return existing_id

    cursor.execute(
        """
        INSERT INTO feedback_intelligence (
            tenant_id,
            user_id,
            feedback_id,
            feedback,
            feedback_hash,
            sentiment,
            churn_risk,
            primary_issue,
            reason,
            best_action,
            suggested_message,
            rescue_status,
            rescue_provider,
            rescue_payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tenant_id,
            user_id,
            feedback_id,
            feedback_text,
            feedback_hash,
            sentiment,
            churn_risk,
            primary_issue,
            reason,
            best_action,
            suggested_message,
            rescue_status_value,
            rescue_provider_value,
            payload_json,
        ),
    )
    return int(cursor.lastrowid)


def fi_list_feedback_intelligence(
    tenant_id: int,
    user_id: int,
    *,
    churn_risk: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()

    where = ["tenant_id = ?", "user_id = ?"]
    params: List[Any] = [tenant_id, user_id]
    if churn_risk:
        where.append("LOWER(COALESCE(churn_risk, 'low')) = ?")
        params.append(_coerce_text(churn_risk, "low", 20).lower())
    clause = " AND ".join(where)
    resolved_limit = max(1, min(int(limit or 50), 200))
    resolved_offset = max(0, int(offset or 0))

    c.execute(f"SELECT COUNT(*) AS cnt FROM feedback_intelligence WHERE {clause}", params)
    total = int((c.fetchone()["cnt"] or 0))
    c.execute(
        f"""
        SELECT *
        FROM feedback_intelligence
        WHERE {clause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
        """,
        params + [resolved_limit, resolved_offset],
    )
    items = [_serialize_feedback_intelligence_row(row) for row in c.fetchall()]
    conn.close()
    return {
        "items": items,
        "total": total,
        "limit": resolved_limit,
        "offset": resolved_offset,
    }


def fi_analyze_feedback_intelligence(
    tenant_id: int,
    user_id: int,
    *,
    feedback_text: str = "",
    feedback_id: Optional[int] = None,
    customer_identifier: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    run_rescue: bool = True,
    source: str = "feedback_crm",
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from retention_intelligence import analyze_feedback, trigger_rescue

    conn = get_db_connection()
    c = conn.cursor()

    try:
        resolved_feedback_id = _feedback_id_from_token(feedback_id)
        resolved_feedback_text = _coerce_text(feedback_text, "", 4000)
        resolved_customer_identifier = _coerce_text(customer_identifier, "", 180)
        metadata_payload = metadata if isinstance(metadata, dict) else {}
        fallback_payload = fallback if isinstance(fallback, dict) else {}

        if resolved_feedback_id:
            c.execute(
                """
                SELECT
                    f.id,
                    f.text,
                    f.sentiment,
                    f.churn_risk,
                    f.pain_point_category,
                    f.metadata_json,
                    cu.customer_identifier,
                    i.name AS issue_name
                FROM fi_feedback f
                LEFT JOIN fi_customers cu ON cu.id = f.customer_id
                LEFT JOIN fi_issues i ON i.id = f.issue_id
                WHERE f.id = ? AND f.tenant_id = ?
                """,
                (resolved_feedback_id, tenant_id),
            )
            feedback_row = c.fetchone()
            if not feedback_row:
                raise ValueError("feedback_id not found")
            row_payload = dict(feedback_row)
            if not resolved_feedback_text:
                resolved_feedback_text = _coerce_text(row_payload.get("text"), "", 4000)
            db_metadata = _json_load_dict(row_payload.get("metadata_json"))
            if isinstance(db_metadata, dict):
                metadata_payload = {**db_metadata, **metadata_payload}
            if not resolved_customer_identifier:
                resolved_customer_identifier = _coerce_text(row_payload.get("customer_identifier"), "", 180)

            fallback_payload = {
                **{
                    "sentiment": row_payload.get("sentiment"),
                    "churn_risk": row_payload.get("churn_risk"),
                    "primary_issue": row_payload.get("issue_name") or row_payload.get("pain_point_category"),
                },
                **fallback_payload,
            }
            analysis_meta = metadata_payload.get("analysis")
            if isinstance(analysis_meta, dict):
                for key in (
                    "sentiment",
                    "churn_risk",
                    "primary_issue",
                    "reason",
                    "best_action",
                    "suggested_message",
                    "issue",
                    "action_recommendation",
                    "root_cause",
                    "pain_point_category",
                ):
                    if key in analysis_meta and key not in fallback_payload:
                        fallback_payload[key] = analysis_meta.get(key)

        if not resolved_feedback_text:
            raise ValueError("feedback_text is required")

        feedback_hash = _feedback_hash_text(resolved_feedback_text)
        if resolved_feedback_id:
            c.execute(
                """
                SELECT *
                FROM feedback_intelligence
                WHERE tenant_id = ? AND user_id = ? AND feedback_id = ? AND feedback_hash = ?
                """,
                (tenant_id, user_id, resolved_feedback_id, feedback_hash),
            )
        else:
            c.execute(
                """
                SELECT *
                FROM feedback_intelligence
                WHERE tenant_id = ? AND user_id = ? AND feedback_hash = ?
                """,
                (tenant_id, user_id, feedback_hash),
            )
        existing_row = c.fetchone()
        if existing_row:
            existing = _serialize_feedback_intelligence_row(existing_row)
            existing["skipped"] = True
            existing["rescue"] = {
                "status": existing.get("rescue_status") or "not_triggered",
                "provider": existing.get("rescue_provider") or "none",
            }
            return existing

        intelligence = analyze_feedback(resolved_feedback_text, fallback=fallback_payload)
        contact = _extract_feedback_contact(metadata_payload, resolved_customer_identifier)

        rescue_result: Dict[str, Any] = {
            "status": "not_triggered",
            "provider": "none",
            "reason": "churn_risk_not_high",
        }
        if run_rescue and _coerce_text(intelligence.get("churn_risk"), "low", 20).lower() == "high":
            rescue_result = trigger_rescue(
                tenant_id=tenant_id,
                user_id=user_id,
                feedback_id=resolved_feedback_id,
                contact=contact,
                intelligence=intelligence,
                source=source,
            )

        rescue_status = _coerce_text(rescue_result.get("status"), "not_triggered", 40)
        rescue_provider = _coerce_text(rescue_result.get("provider"), "none", 40)
        row_id = _upsert_feedback_intelligence_row(
            c,
            tenant_id=tenant_id,
            user_id=user_id,
            feedback_id=resolved_feedback_id,
            feedback_text=resolved_feedback_text,
            intelligence=intelligence,
            rescue_status=rescue_status,
            rescue_provider=rescue_provider,
            rescue_payload={
                **rescue_result,
                "contact": contact,
                "source": source,
            },
        )
        conn.commit()
        return {
            "id": row_id,
            "feedback_id": resolved_feedback_id,
            "feedback": resolved_feedback_text,
            **intelligence,
            "rescue": rescue_result,
            "skipped": False,
        }
    finally:
        conn.close()


def fi_process_retention_intelligence_from_analysis(
    tenant_id: int,
    user_id: int,
    analysis_results: List[Dict[str, Any]],
    *,
    run_rescue: bool = True,
    source: str = "analysis",
) -> Dict[str, Any]:
    fallback_by_feedback_id: Dict[int, Dict[str, Any]] = {}
    seen_feedback_ids = set()
    feedback_ids: List[int] = []

    for result in analysis_results or []:
        feedback_id = _feedback_id_from_token(result.get("id") or result.get("review_id"))
        if not feedback_id or feedback_id in seen_feedback_ids:
            continue
        seen_feedback_ids.add(feedback_id)
        feedback_ids.append(feedback_id)
        fallback_by_feedback_id[feedback_id] = {
            "sentiment": result.get("sentiment"),
            "churn_risk": result.get("churn_risk"),
            "primary_issue": result.get("issue") or result.get("theme_cluster") or result.get("pain_point_category"),
            "reason": result.get("root_cause"),
            "best_action": result.get("action_recommendation"),
            "suggested_message": result.get("suggested_message"),
            "issue": result.get("issue"),
            "action_recommendation": result.get("action_recommendation"),
            "root_cause": result.get("root_cause"),
            "pain_point_category": result.get("pain_point_category"),
        }

    if not feedback_ids:
        return {
            "processed": 0,
            "stored": 0,
            "skipped_existing": 0,
            "rescue_triggered": 0,
            "rescue_sent": 0,
            "rescue_queued": 0,
            "errors": [],
        }

    stored = 0
    skipped_existing = 0
    rescue_triggered = 0
    rescue_sent = 0
    rescue_queued = 0
    errors: List[Dict[str, Any]] = []

    for feedback_id in feedback_ids:
        try:
            outcome = fi_analyze_feedback_intelligence(
                tenant_id,
                user_id,
                feedback_id=feedback_id,
                run_rescue=run_rescue,
                source=source,
                fallback=fallback_by_feedback_id.get(feedback_id),
            )
            if outcome.get("skipped"):
                skipped_existing += 1
                continue
            stored += 1
            rescue = outcome.get("rescue") or {}
            rescue_status = _coerce_text(rescue.get("status"), "", 40).lower()
            if rescue_status in {"sent", "queued"}:
                rescue_triggered += 1
            if rescue_status == "sent":
                rescue_sent += 1
            elif rescue_status == "queued":
                rescue_queued += 1
        except Exception as exc:
            errors.append(
                {
                    "feedback_id": feedback_id,
                    "error": _coerce_text(exc, "retention_intelligence_failed", 220),
                }
            )

    return {
        "processed": len(feedback_ids),
        "stored": stored,
        "skipped_existing": skipped_existing,
        "rescue_triggered": rescue_triggered,
        "rescue_sent": rescue_sent,
        "rescue_queued": rescue_queued,
        "errors": errors,
    }
# BULK IMPORT — seed from existing cxm_reviews
# ──────────────────────────────────────────────────────────────────────────────

def fi_import_from_cxm(
    tenant_id: int,
    user_id: int,
    *,
    source_ids: Optional[List[int]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, int]:
    """
    Import existing CXM reviews into the Feedback Intelligence CRM layer.
    Supports optional source/date filters and skips duplicates.
    """
    conn = get_db_connection()
    c = conn.cursor()

    query = """
        SELECT
            r.content,
            r.score,
            r.sentiment,
            r.churn_risk,
            r.churn_probability,
            r.pain_point,
            r.churn_intent_cluster,
            r.user_segment,
            r.growth_opportunity,
            r.main_problem_flag,
            r.author,
            r.reviewed_at,
            r.external_id,
            s.id AS source_id,
            s.source_type,
            s.display_name,
            s.identifier
        FROM cxm_reviews r
        JOIN cxm_sources s ON s.id = r.source_id
        WHERE r.user_id = ? AND r.tenant_id = ?
    """
    params: List[Any] = [user_id, tenant_id]

    if source_ids:
        placeholders = ",".join(["?"] * len(source_ids))
        query += f" AND r.source_id IN ({placeholders})"
        params.extend(source_ids)
    normalized_start_date = _normalize_filter_timestamp(start_date)
    normalized_end_date = _normalize_filter_timestamp(end_date, end_of_day=True)
    if normalized_start_date:
        query += " AND r.reviewed_at >= ?"
        params.append(normalized_start_date)
    if normalized_end_date:
        query += " AND r.reviewed_at <= ?"
        params.append(normalized_end_date)

    query += " ORDER BY r.reviewed_at DESC"
    c.execute(query, params)
    source_rows = c.fetchall()

    # Preload existing CRM rows once and dedupe in-memory to keep import idempotent and fast.
    c.execute(
        """
        SELECT text, source, created_at, metadata_json
        FROM fi_feedback
        WHERE tenant_id = ?
        """,
        (tenant_id,),
    )
    existing_rows = c.fetchall()
    existing_by_external: set = set()
    existing_by_source_time: set = set()
    existing_legacy: set = set()
    for existing_row in existing_rows:
        existing_text = str(existing_row["text"] or "").strip()
        existing_source = str(existing_row["source"] or "").strip().lower()
        existing_created_at = str(existing_row["created_at"] or "").strip()
        if existing_text and existing_source and existing_created_at:
            existing_legacy.add((existing_source, existing_text, existing_created_at))

        try:
            metadata = json.loads(existing_row["metadata_json"] or "{}")
        except Exception:
            metadata = {}
        if not isinstance(metadata, dict):
            metadata = {}

        raw_source_id = metadata.get("cxm_source_id")
        source_id_value = None
        try:
            source_id_value = int(str(raw_source_id).strip())
        except (TypeError, ValueError):
            source_id_value = None

        external_id = str(
            metadata.get("cxm_external_id")
            or metadata.get("external_id")
            or metadata.get("reviewId")
            or metadata.get("id")
            or ""
        ).strip()
        if source_id_value and external_id:
            existing_by_external.add((source_id_value, external_id))

        reviewed_at = str(metadata.get("cxm_reviewed_at") or existing_created_at or "").strip()
        if source_id_value and existing_text and reviewed_at:
            existing_by_source_time.add((source_id_value, existing_text, reviewed_at))

    imported = 0
    skipped = 0
    for row in source_rows:
        text = row["content"]
        if not text or len(text.strip()) < 3:
            skipped += 1
            continue

        display_name = (row["display_name"] or "").strip()
        source_identifier = (row["identifier"] or "").strip()
        source_type = row["source_type"] or "import"
        if display_name and source_identifier and display_name.lower() != source_identifier.lower():
            source_label = f"{display_name} ({source_identifier})"
        else:
            source_label = display_name or source_identifier or source_type or "import"
        source_type = row["source_type"] or "import"
        author = row["author"]
        rating = row["score"] if row["score"] is not None else 3
        created_at = row["reviewed_at"] or datetime.utcnow().isoformat()
        created_at_key = str(created_at or "").strip()
        text_key = str(text or "").strip()
        source_id_key = int(row["source_id"])
        external_id_key = str(row["external_id"] or "").strip()
        source_key = str(source_label or "").strip().lower()

        if external_id_key and (source_id_key, external_id_key) in existing_by_external:
            skipped += 1
            continue
        if text_key and created_at_key and (source_id_key, text_key, created_at_key) in existing_by_source_time:
            skipped += 1
            continue
        if text_key and created_at_key and source_key and (source_key, text_key, created_at_key) in existing_legacy:
            skipped += 1
            continue

        metadata_json = json.dumps({
            "cxm_source_id": row["source_id"],
            "cxm_source_name": source_label,
            "cxm_source_identifier": source_identifier or None,
            "cxm_external_id": row["external_id"],
            "cxm_reviewed_at": row["reviewed_at"],
            "cxm_churn_risk": row["churn_risk"] or "low",
            "cxm_churn_probability": row["churn_probability"] if row["churn_probability"] is not None else 0.0,
            "cxm_pain_point": row["pain_point"] or "other",
            "cxm_churn_intent_cluster": row["churn_intent_cluster"] or "no_churn_signal",
            "cxm_user_segment": row["user_segment"] or "unknown",
            "cxm_growth_opportunity": row["growth_opportunity"] or "none",
            "cxm_main_problem_flag": bool(row["main_problem_flag"] or 0),
        })

        customer_id = None
        if author:
            customer_id = _upsert_customer(c, tenant_id, author)

        c.execute(
            """
            INSERT INTO fi_feedback (
                tenant_id, text,
                sentiment, sentiment_score, confidence, churn_risk, churn_impact,
                pain_point_category, theme_primary, theme_cluster, cluster_label,
                user_segment, solving_priority, journey_stage, action_owner,
                source, source_type, rating, metadata_json, customer_id,
                last_analyzed_at, analysis_run_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tenant_id,
                text,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                source_label,
                source_type,
                rating,
                metadata_json,
                customer_id,
                None,
                None,
                created_at,
            ),
        )
        imported += 1
        if external_id_key:
            existing_by_external.add((source_id_key, external_id_key))
        if text_key and created_at_key:
            existing_by_source_time.add((source_id_key, text_key, created_at_key))
            if source_key:
                existing_legacy.add((source_key, text_key, created_at_key))

    c.execute("SELECT DISTINCT id FROM fi_customers WHERE tenant_id = ?", (tenant_id,))
    for crow in c.fetchall():
        _refresh_customer_stats(c, crow["id"])

    conn.commit()
    conn.close()

    return {"imported": imported, "skipped": skipped}


# ──────────────────────────────────────────────────────────────────────────────
# CRM UTILS
# ──────────────────────────────────────────────────────────────────────────────


