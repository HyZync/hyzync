from .base import generate_json_response
import logging

logger = logging.getLogger("hyzync.ai_tools")

def draft_winback_email(customer_profile: dict, feedback_timeline: list) -> dict:
    """
    Drafts a personalized winback/engagement email based on customer history,
    optimized for Qwen 3.5 4B enforcing JSON output.
    """
    timeline_text = "\n".join([f"- {item.get('date', '')[:10]}: {item.get('feedback', '')}" for item in feedback_timeline[-5:]])
    
    prompt = f"""TASK: Draft a polite, professional, and empathetic email to this customer based on their feedback history. 
Acknowledge their past issues if any, emphasize product improvements, and offer to reconnect.

INPUT:
Customer Name: {customer_profile.get('name', customer_profile.get('customer_identifier', 'Customer'))}
Overall Sentiment: {customer_profile.get('overall_sentiment', 'neutral')}
Recent Feedback History:
{timeline_text}

OUTPUT FORMAT (JSON ONLY):
{{
  "subject": "Email subject line here",
  "body": "Full text of the email body here (plain text, use \\n for line breaks)"
}}"""

    result = generate_json_response(prompt)
    if "subject" not in result or "body" not in result:
        return {
            "subject": "Checking in on your experience",
            "body": "Hi there,\n\nWe wanted to reach out and thank you for your past feedback. We're constantly working on improving our platform and would love to hear how things are going for you lately.\n\nBest,\nThe Team"
        }
    return result
