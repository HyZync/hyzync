from .base import generate_json_response
from typing import List

def extract_quotes(feedback_samples: List[str]) -> dict:
    """Select representative feedback quotes."""
    samples_text = "\n".join([f"- {s}" for s in feedback_samples[:10]])
    
    prompt = f"""TASK: Select 1 to 3 representative quotes from the feedback.

INPUT:
{samples_text}

OUTPUT FORMAT (JSON ONLY):
{{
  "quotes": [
    "quote 1 here",
    "quote 2 here"
  ]
}}"""
    
    result = generate_json_response(prompt)
    quotes = result.get("quotes", [])
    if not isinstance(quotes, list):
        return {"quotes": []}
    return {"quotes": quotes[:3]}
