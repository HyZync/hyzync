from .base import generate_json_response
from typing import List, Dict

def generate_insight_summary(top_issues: List[Dict], sentiment_distribution: Dict) -> dict:
    """Generate a short insight summary for product teams."""
    issues_text = "\n".join([f"- {i['name']} ({i['mention_count']} mentions)" for i in top_issues])
    sent_text = f"Pos: {sentiment_distribution.get('positive', 0)}, Neut: {sentiment_distribution.get('neutral', 0)}, Neg: {sentiment_distribution.get('negative', 0)}"
    
    prompt = f"""TASK: Generate a short insight summary for product teams.

INPUT:
Top Issues:
{issues_text}

Sentiment Distribution:
{sent_text}

OUTPUT FORMAT (JSON ONLY):
{{
  "summary": "1-2 sentence product insight summary here."
}}"""
    
    result = generate_json_response(prompt)
    if "summary" not in result:
        return {"summary": "Insufficient data to generate summary."}
    return result
