from .base import generate_json_response
from typing import List
from insight_prompts import build_issue_title_prompt

def generate_issue_title(feedback_samples: List[str]) -> dict:
    """Create a short issue title summarizing similar feedback."""
    prompt = build_issue_title_prompt(feedback_samples)
    return generate_json_response(prompt)
