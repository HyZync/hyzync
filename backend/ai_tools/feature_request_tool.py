from .base import generate_json_response
from insight_prompts import build_feature_request_prompt

def detect_feature_request(feedback_text: str) -> dict:
    """Detect whether feedback is requesting a feature."""
    prompt = build_feature_request_prompt(feedback_text)
    result = generate_json_response(prompt)
    if "feature_request" not in result:
        return {"feature_request": False, "requested_feature": "", "desired_outcome": ""}
    return {
        "feature_request": bool(result.get("feature_request")),
        "requested_feature": str(result.get("requested_feature", "") or ""),
        "desired_outcome": str(result.get("desired_outcome", "") or ""),
    }
