import logging
import sys
import os

# The duckduckgo_search library writes a deprecation warning directly to stderr on import.
# We briefly redirect stderr to null to suppress this noisy warning.
_stderr = sys.stderr
sys.stderr = open(os.devnull, 'w')
try:
    from duckduckgo_search import DDGS
finally:
    sys.stderr.close()
    sys.stderr = _stderr

logger = logging.getLogger(__name__)

def perform_web_search(query: str, max_results: int = 3) -> str:
    """
    Performs a real-time web search using DuckDuckGo and formats the results.
    Returns a formatted string suitable for LLM context inclusion.
    """
    logger.info(f"Performing web search for: '{query}'")
    
    try:
        with DDGS() as ddgs:
            # Drop the explicitly defined backend argument to allow DDGS to pick its optimal default (usually 'api' or 'html')
            raw_results = list(ddgs.text(query, max_results=max_results))
            
        if not raw_results:
            return "Web Search yielded no results."
            
        formatted_results = []
        for i, r in enumerate(raw_results, 1):
            title = r.get('title', 'Unknown Title')
            body = r.get('body', 'No snippet available.')
            href = r.get('href', 'No URL')
            
            formatted_results.append(f"[Result {i}]\nTitle: {title}\nSummary: {body}\nURL: {href}")
            
        return "\n\n".join(formatted_results)
        
    except Exception as e:
        logger.error(f"Web search failed for query '{query}': {e}")
        return f"Web Search is currently unavailable due to an error: {str(e)}"
