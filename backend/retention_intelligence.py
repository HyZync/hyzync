from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional
from urllib import error, request

from ai_tools.base import generate_json_response

logger = logging.getLogger("hyzync.retention_intelligence")

VALID_SENTIMENTS = {"positive", "neutral", "negative"}
VALID_CHURN_RISKS = {"low", "medium", "high"}
DISCOUNT_KEYWORDS = {
    "discount",
    "coupon",
    "credit",
    "waive",
    "free month",
    "offer",
    "promo",
}


def _text(value: Any, fallback: str = "", limit: int = 400) -> str:
    cleaned = " ".join(str(value or "").split()).strip()
    if not cleaned:
        return fallback
    return cleaned[:limit]


def _normalize_choice(value: Any, allowed: set, fallback: str) -> str:
    candidate = _text(value, fallback, 40).lower()
    if candidate not in allowed:
        return fallback
    return candidate


def _heuristic_sentiment(feedback: str) -> str:
    lower_feedback = feedback.lower()
    negative_terms = sum(
        1
        for term in ("bad", "broken", "hate", "frustrating", "slow", "expensive", "cancel")
        if term in lower_feedback
    )
    positive_terms = sum(
        1
        for term in ("love", "great", "helpful", "smooth", "excellent", "good")
        if term in lower_feedback
    )
    if negative_terms > positive_terms:
        return "negative"
    if positive_terms > negative_terms:
        return "positive"
    return "neutral"


def _default_reason(primary_issue: str, churn_risk: str) -> str:
    if primary_issue:
        return _text(f"user is frustrated by {primary_issue} and may stop using the product", "", 220)
    if churn_risk == "high":
        return "user shows strong dissatisfaction and may churn soon"
    if churn_risk == "medium":
        return "user is experiencing unresolved friction that could increase churn risk"
    return "no immediate churn signal, but sentiment should be monitored"


def _default_action(primary_issue: str, churn_risk: str) -> str:
    if churn_risk == "high":
        if primary_issue:
            return _text(f"prioritize a fast fix for {primary_issue} and proactively reach out with support", "", 220)
        return "proactively reach out, acknowledge the issue, and offer immediate support"
    if primary_issue:
        return _text(f"acknowledge the {primary_issue} concern and share a clear improvement timeline", "", 220)
    return "acknowledge feedback and monitor upcoming user activity for escalation"


def _default_message(primary_issue: str) -> str:
    issue_line = f" around {primary_issue}" if primary_issue else ""
    return _text(
        f"Thanks for sharing this feedback. We understand the frustration{issue_line}. "
        "Our team is on it, and we would like to help make this right for you.",
        "",
        320,
    )


def _discount_recommended(best_action: str, suggested_message: str) -> bool:
    combined = f"{best_action} {suggested_message}".lower()
    return any(keyword in combined for keyword in DISCOUNT_KEYWORDS)


def _build_prompt(feedback: str) -> str:
    return f"""
You are a customer retention AI.

Analyze this user feedback and return JSON:

1. sentiment: positive | neutral | negative
2. churn_risk: low | medium | high
3. primary_issue: short label
4. reason: why user may churn
5. best_action: what should we do to retain them
6. suggested_message: a short personalized message

Feedback: "{feedback}"
""".strip()


def analyze_feedback(feedback: str, fallback: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    fallback_payload = fallback if isinstance(fallback, dict) else {}
    feedback_text = _text(feedback, "No feedback provided.", 3200)

    raw: Dict[str, Any] = {}
    try:
        raw = generate_json_response(_build_prompt(feedback_text), max_retries=2) or {}
    except Exception as exc:
        logger.warning("[Retention] LLM analysis failed: %s", exc)

    inferred_sentiment = _heuristic_sentiment(feedback_text)
    sentiment = _normalize_choice(
        raw.get("sentiment") or fallback_payload.get("sentiment"),
        VALID_SENTIMENTS,
        inferred_sentiment,
    )
    churn_risk = _normalize_choice(
        raw.get("churn_risk") or fallback_payload.get("churn_risk"),
        VALID_CHURN_RISKS,
        "high" if sentiment == "negative" and "cancel" in feedback_text.lower() else "low",
    )

    primary_issue = _text(
        raw.get("primary_issue")
        or fallback_payload.get("primary_issue")
        or fallback_payload.get("issue")
        or fallback_payload.get("pain_point_category"),
        "general frustration",
        120,
    )
    reason = _text(
        raw.get("reason") or fallback_payload.get("reason"),
        _default_reason(primary_issue, churn_risk),
        260,
    )
    best_action = _text(
        raw.get("best_action") or fallback_payload.get("best_action") or fallback_payload.get("action_recommendation"),
        _default_action(primary_issue, churn_risk),
        260,
    )
    suggested_message = _text(
        raw.get("suggested_message") or fallback_payload.get("suggested_message"),
        _default_message(primary_issue),
        500,
    )

    return {
        "sentiment": sentiment,
        "churn_risk": churn_risk,
        "primary_issue": primary_issue,
        "reason": reason,
        "best_action": best_action,
        "suggested_message": suggested_message,
    }


def _send_via_sendgrid(
    *,
    to_email: str,
    subject: str,
    body: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    api_key = _text(os.getenv("SENDGRID_API_KEY"), "", 500)
    from_email = _text(os.getenv("SENDGRID_FROM_EMAIL"), "", 200)
    if not api_key or not from_email:
        return {"ok": False, "error": "sendgrid_not_configured"}

    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email}],
                "custom_args": {k: str(v) for k, v in (metadata or {}).items()},
            }
        ],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }
    req = request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=15) as response:
            status_code = int(getattr(response, "status", 0) or 0)
            if 200 <= status_code < 300:
                return {"ok": True, "provider": "sendgrid", "status_code": status_code}
            return {"ok": False, "error": f"sendgrid_status_{status_code}"}
    except error.HTTPError as exc:
        return {"ok": False, "error": f"sendgrid_http_{exc.code}"}
    except Exception as exc:
        return {"ok": False, "error": f"sendgrid_error:{exc}"}


def _send_via_resend(
    *,
    to_email: str,
    subject: str,
    body: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    api_key = _text(os.getenv("RESEND_API_KEY"), "", 500)
    from_email = _text(os.getenv("RESEND_FROM_EMAIL"), "", 200)
    if not api_key or not from_email:
        return {"ok": False, "error": "resend_not_configured"}

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": body,
        "tags": [{"name": str(k), "value": str(v)} for k, v in (metadata or {}).items()],
    }
    req = request.Request(
        "https://api.resend.com/emails",
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=15) as response:
            status_code = int(getattr(response, "status", 0) or 0)
            if 200 <= status_code < 300:
                return {"ok": True, "provider": "resend", "status_code": status_code}
            return {"ok": False, "error": f"resend_status_{status_code}"}
    except error.HTTPError as exc:
        return {"ok": False, "error": f"resend_http_{exc.code}"}
    except Exception as exc:
        return {"ok": False, "error": f"resend_error:{exc}"}


def trigger_rescue(
    *,
    tenant_id: int,
    user_id: int,
    feedback_id: Optional[int],
    contact: Optional[Dict[str, str]],
    intelligence: Dict[str, str],
    source: str = "feedback_crm",
) -> Dict[str, Any]:
    churn_risk = _normalize_choice(intelligence.get("churn_risk"), VALID_CHURN_RISKS, "low")
    if churn_risk != "high":
        return {
            "status": "not_triggered",
            "provider": "none",
            "reason": "churn_risk_not_high",
            "discount_attached": False,
        }

    recipient = _text((contact or {}).get("email"), "", 200).lower()
    if not recipient:
        return {
            "status": "queued",
            "provider": "none",
            "reason": "missing_recipient_email",
            "discount_attached": _discount_recommended(
                intelligence.get("best_action", ""),
                intelligence.get("suggested_message", ""),
            ),
        }

    subject_issue = _text(intelligence.get("primary_issue"), "", 80)
    subject = f"We are fixing {subject_issue}" if subject_issue else "We want to make this right"
    message = _text(intelligence.get("suggested_message"), "", 900)
    if not message:
        message = _default_message(subject_issue)

    discount_attached = _discount_recommended(
        intelligence.get("best_action", ""),
        intelligence.get("suggested_message", ""),
    )
    if discount_attached and "discount" not in message.lower():
        message = (
            f"{message}\n\n"
            "If helpful, we can also apply a loyalty discount while we resolve this."
        )

    metadata = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "feedback_id": feedback_id or "",
        "source": source,
    }

    sendgrid_result = _send_via_sendgrid(
        to_email=recipient,
        subject=subject,
        body=message,
        metadata=metadata,
    )
    if sendgrid_result.get("ok"):
        return {
            "status": "sent",
            "provider": "sendgrid",
            "reason": "high_risk_rescue_sent",
            "discount_attached": discount_attached,
            "recipient": recipient,
        }

    resend_result = _send_via_resend(
        to_email=recipient,
        subject=subject,
        body=message,
        metadata=metadata,
    )
    if resend_result.get("ok"):
        return {
            "status": "sent",
            "provider": "resend",
            "reason": "high_risk_rescue_sent",
            "discount_attached": discount_attached,
            "recipient": recipient,
        }

    return {
        "status": "queued",
        "provider": "none",
        "reason": "delivery_provider_unavailable",
        "discount_attached": discount_attached,
        "recipient": recipient,
        "errors": [sendgrid_result.get("error"), resend_result.get("error")],
    }
