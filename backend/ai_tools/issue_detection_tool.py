from .base import generate_json_response
from insight_prompts import build_issue_detection_prompt

def detect_issue(feedback_text: str) -> dict:
    """Identify the main issue mentioned in the feedback."""
    prompt = build_issue_detection_prompt(feedback_text)
    result = generate_json_response(prompt)

    cat = result.get("issue_category", "other")
    desc = result.get("issue_description", "")
    valid_cats = {"bug", "performance", "usability", "feature_request", "billing", "support", "other"}

    journey_stage = str(result.get("journey_stage", "unknown") or "unknown").lower()
    customer_action = str(result.get("customer_action", "none") or "none").lower()
    urgency = str(result.get("urgency", "medium") or "medium").lower()
    churn_risk = str(result.get("churn_risk", "low") or "low").lower()

    if journey_stage not in {"onboarding", "active_use", "support", "renewal", "cancellation", "advocacy", "unknown"}:
        journey_stage = "unknown"
    if customer_action not in {"cancel", "switch", "refund", "complain", "request_feature", "none"}:
        customer_action = "none"
    if urgency not in {"low", "medium", "high"}:
        urgency = "medium"
    if churn_risk not in {"low", "medium", "high"}:
        churn_risk = "low"

    return {
        "issue_category": cat if cat in valid_cats else "other",
        "issue_description": desc,
        "root_cause": str(result.get("root_cause", "") or ""),
        "theme": str(result.get("theme", "") or ""),
        "journey_stage": journey_stage,
        "customer_action": customer_action,
        "urgency": urgency,
        "churn_risk": churn_risk,
    }
