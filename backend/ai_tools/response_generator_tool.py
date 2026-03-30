from .base import generate_json_response

def generate_customer_response(feedback_text: str, issue_name: str, issue_status: str) -> dict:
    """Generate a professional reply to the customer."""
    prompt = f"""TASK: Generate a professional reply to the customer. Responses must be polite, empathetic, and concise.

INPUT:
Feedback: {feedback_text}
Issue: {issue_name}
Status: {issue_status}

OUTPUT FORMAT (JSON ONLY):
{{
  "response": "Polite response text here."
}}"""
    
    result = generate_json_response(prompt)
    if "response" not in result:
        return {"response": "Thank you for sharing your feedback. We appreciate your input and are looking into it."}
    return result
