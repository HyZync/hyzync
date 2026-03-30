from .base import generate_json_response
from insight_prompts import build_sentiment_prompt

def analyze_sentiment(feedback_text: str) -> dict:
    """Classify the sentiment of the feedback."""
    prompt = build_sentiment_prompt(feedback_text)
    result = generate_json_response(prompt)
    if not result or result.get("sentiment") not in ["positive", "neutral", "negative"]:
        return {"sentiment": "neutral"}
    return result
