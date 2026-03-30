
import processor
import logging
import hashlib
import pandas as pd

# Configure logging
logger = logging.getLogger(__name__)


class CopilotSession:
    def __init__(self, reviews_df: pd.DataFrame):
        self.reviews_df = reviews_df
        if not reviews_df.empty:
            # Deduplicate + cap at 25 unique reviews to keep prompt lean for Qwen 3.5 4B
            self.context_reviews = self._deduplicate(reviews_df.head(80).to_dict('records'), max_keep=25)
        else:
            self.context_reviews = []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _deduplicate(records: list, max_keep: int = 25) -> list:
        """
        Remove near-duplicate reviews by fingerprinting the first 120 chars
        of the content. Keeps the first occurrence of each unique fingerprint
        so varied reviews are preferred over repeated identical ones.
        """
        seen: set = set()
        unique: list = []
        for r in records:
            content = ""
            for key in ('content', 'text'):
                v = r.get(key)
                if v and str(v) not in ('nan', 'NaN', ''):
                    content = str(v)[:120].strip().lower()
                    break
            fp = hashlib.md5(content.encode()).hexdigest()
            if fp not in seen:
                seen.add(fp)
                unique.append(r)
            if len(unique) >= max_keep:
                break
        return unique

    def _format_context(self) -> str:
        """Format deduplicated reviews into a compact context block."""
        if not self.context_reviews:
            return "No reviews available."

        lines = []
        for r in self.context_reviews:
            def safe_get(*keys, default='N/A'):
                for k in keys:
                    v = r.get(k)
                    if v is not None and str(v) not in ('nan', 'NaN', ''):
                        return str(v)
                return default

            rating    = safe_get('score', 'rating')
            content   = safe_get('content', 'text', default='')[:300]
            sentiment = safe_get('sentiment')
            issue     = safe_get('issue')
            lines.append(f"[{rating}★ {sentiment}] {content} | issue: {issue}")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Core message handler
    # ------------------------------------------------------------------

    def process_message(self, user_message: str, source: str = "tab") -> str:
        """Send user message + deduplicated context to the LLM."""

        context = self._format_context()
        total_reviews = len(self.reviews_df) if not self.reviews_df.empty else 0
        unique_shown  = len(self.context_reviews)

        if source == "widget":
            format_rules = (
                "RULES: Be EXTREMELY brief. 2-3 bullet points MAX. "
                "No paragraphs. No repeating data points.\n"
                "- CHARTS/GRAPHS: If explicitly asked for a graph, chart, or visual representation, YOU MUST output a JSON block surrounded by ```chart and ```.\n"
                "  - Schema for Bar/Line: {\"type\": \"bar\"|\"line\", \"xKey\": \"name\", \"yKey\": \"value\", \"data\": [{\"name\": \"Feature A\", \"value\": 10}, ...]}\n"
                "  - Schema for Pie: {\"type\": \"pie\", \"nameKey\": \"name\", \"valKey\": \"value\", \"data\": [{\"name\": \"Positive\", \"value\": 45}, ...]}\n"
                "  - ONLY output the ```chart block if explicitly asked for a visual. Do not wrap normal text in it."
            )
            max_tokens = 500
        else:
            format_rules = (
                "RULES:\n"
                "- Write a SYNTHESIZED analysis — do NOT enumerate every review.\n"
                "- DEDUPLICATE: if multiple reviews share the same issue, count them once and note the frequency.\n"
                "- Group related issues into 3-5 distinct top-level themes at most.\n"
                "- Use Markdown: **bold** for theme names, bullet points for sub-details.\n"
                "- Be concise and analytical. Skip filler phrases.\n"
                "- CHARTS/GRAPHS: If the user explicitly asks for a graph, chart, or visual representation, YOU MUST output a JSON code block surrounded by ```chart and ``` containing the data.\n"
                "  - Schema for Bar/Line: {\"type\": \"bar\"|\"line\", \"xKey\": \"name\", \"yKey\": \"value\", \"data\": [{\"name\": \"Feature A\", \"value\": 10}, ...]}\n"
                "  - Schema for Pie: {\"type\": \"pie\", \"nameKey\": \"name\", \"valKey\": \"value\", \"data\": [{\"name\": \"Positive\", \"value\": 45}, ...]}\n"
                "  - ONLY output the ```chart block if explicitly asked for a visual. Do not wrap normal text in it."
            )
            max_tokens = 1500

        # ------------------------------------------------------------------
        # LLM Intent Router for Web RAG
        # ------------------------------------------------------------------
        search_prompt = (
            f"You are a search query generator. The user asked: '{user_message}'\n\n"
            f"If this query asks about external information NOT found in internal product reviews (like competitors, market trends, pricing of other tools, external news), "
            f"generate a 3-5 word search query to find this information via Google.\n\n"
            f"If the query only asks about internal reviews, user feedback, or internal issues, reply EXACTLY with the word 'NO_SEARCH'.\n\n"
            f"RULES:\n"
            f"- Reply with NOTHING ELSE but the search query or NO_SEARCH.\n"
            f"- Do NOT use quotes around your answer.\n"
            f"- Do NOT explain."
        )
        
        try:
            model = processor.OLLAMA_MODEL
            router_response = processor.query_ollama(
                prompt=search_prompt,
                model=model,
                num_predict=15
            )
            # Clean the router response
            router_response = router_response.strip().strip('"\'') if router_response else "NO_SEARCH"
            # It's a search if it's not NO_SEARCH and has some length
            needs_search = "NO_SEARCH" not in router_response.upper() and len(router_response) > 2
        except:
            needs_search = False
            router_response = "NO_SEARCH"
            
        web_context = ""
        if needs_search:
            from rag_search import perform_web_search
            search_query = router_response
            logger.info(f"Copilot executing Web Search for optimized query: '{search_query}'")
            search_results = perform_web_search(search_query)
            web_context = f"\n\nWEB SEARCH RESULTS for '{search_query}' (Use this latest market data!):\n{search_results}\n"

        # ------------------------------------------------------------------
        # Build Final Prompt
        # ------------------------------------------------------------------
        system_prompt = (
            f"You are an AI Copilot for a Review Analytics Platform called Horizon.\n"
            f"You have access to {total_reviews} customer reviews ({unique_shown} unique shown below).\n"
            f"Answer the user's question based on the review context"
            f"{' AND the provided web search results' if needs_search else ''}.\n"
            f"If the answer isn't in the provided contexts, say so.\n\n"
            f"{format_rules}\n\n"
            f"REVIEW CONTEXT (deduplicated):\n{context}"
            f"{web_context}"
        )

        full_prompt = (
            f"{system_prompt}\n\n"
            f"<user>\n{user_message}\n</user>\n\n"
            f"<assistant>"
        )

        try:
            response = processor.query_ollama(
                prompt=full_prompt,
                model=model,
                num_predict=max_tokens
            )
            return response if response and response.strip() else (
                "I'm having trouble connecting to the intelligence engine. Please try again."
            )
        except Exception as e:
            logger.error(f"Copilot error: {e}")
            return f"Error processing request: {str(e)}"


# Global helper
def chat_with_copilot(message: str, reviews_df: pd.DataFrame, source: str = "tab") -> str:
    session = CopilotSession(reviews_df)
    return session.process_message(message, source=source)

