import json
import logging

logger = logging.getLogger("hyzync.ai_tools")

def generate_json_response(prompt: str, max_retries: int = 2) -> dict:
    """Helper to call the shared LLM client, ask for JSON, and parse the result."""
    from processor import parse_llm_json, query_ollama

    for attempt in range(max_retries):
        try:
            text = query_ollama(
                prompt,
                num_predict=320,
                response_format="json",
            )
            if not text:
                continue
            try:
                parsed = parse_llm_json(text)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                try:
                    parsed = json.loads(str(text))
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.warning(f"LLM request failed (attempt {attempt+1}): {e}")
    
    return {}
