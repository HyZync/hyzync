import logging
import concurrent.futures
from typing import List, Dict, Any
import sys
import os

# Ensure backend is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from processor import query_ollama

logger = logging.getLogger(__name__)

def synthesize_cluster_label(cluster_name: str, reviews: List[Dict[str, Any]], vertical: str = "generic") -> str:
    """
    Uses LLM to generate a definite, understandable label for a cluster of reviews.
    Especially useful for clusters currently labeled "Other", "UX", etc.
    """
    if not reviews:
        return cluster_name

    # Sample up to 10 reviews to provide context without overloading
    sample_size = min(10, len(reviews))
    sample = reviews[:sample_size]
    
    # Extract key snippets
    snippets = []
    for r in sample:
        content = r.get('content', '')
        if len(str(content)) > 100:
            content = str(content)[:100] + "..."
        snippets.append(f"- {content}")
        
    context_text = "\n".join(snippets)
    
    prompt = f"""
    SYSTEM: You are a Expert Business Intelligence Analyst.
    TASK: Generate a DEFINITE and EASILY UNDERSTANDABLE label for a group of customer reviews.
    
    CURRENT VAGUE LABEL: "{cluster_name}"
    VERTICAL: {vertical.upper()}
    
    SAMPLED REVIEWS:
    {context_text}
    
    RULES:
    1. Your output MUST be a single, punchy, descriptive label (MAX 4 WORDS).
    2. Be SPECIFIC. Instead of "UX", say "Unintuitive Navigation". Instead of "Bug", say "System Crash on Startup".
    3. Ensure a non-expert can understand exactly what the users are talking about.
    4. ONLY return the label text. No explanations.
    
    DEFINITE LABEL:
    """
    
    try:
        new_label = query_ollama(prompt)
        if new_label:
            # Clean up the response (remove quotes, etc.)
            new_label = new_label.strip().strip('"').strip("'").split('\n')[0]
            # If it's still too long or weird, fall back
            if len(new_label) > 50 or not new_label:
                return cluster_name
            return new_label
    except Exception as e:
        logger.error(f"Error synthesizing cluster label: {e}")
        
    return cluster_name

def batch_synthesize_labels(categorized_data: Dict[str, Any], raw_reviews: List[Dict[str, Any]], vertical: str = "generic") -> Dict[str, Any]:
    """
    Iterates through categorized strengths/weaknesses and attempts to improve vague labels.
    """
    vague_threshold = ["Other", "UX", "Bug", "Support", "Feature", "Performance", "General"]
    
    # Support for quadrants (categorize_metrics output)
    sections = ['important_strengths', 'important_weaknesses', 'unimportant_strengths', 'unimportant_weaknesses']
    # Support for thematic aggregation (get_thematic_aggregates output)
    list_sections = ['top_issues', 'top_features']
    
    tasks = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        # Process Quadrants
        for section in sections:
            for item in categorized_data.get(section, []):
                label = item.get('category')
                # ... same as before
                process_item(item, label, 'category', tasks, executor, vague_threshold, raw_reviews, vertical)
        
        # Process Lists (Thematic)
        for section in list_sections:
            for item in categorized_data.get(section, []):
                label = item.get('name')
                indices = item.get('review_indices', [])
                
                if (label in vague_threshold or len(label.split()) < 2):
                    # For thematic aggregates, we might not have indices yet.
                    # Fallback to searching raw_reviews for mentions of this label if indices missing
                    if not indices and raw_reviews:
                        indices = [i for i, r in enumerate(raw_reviews) if label.lower() in str(r.get('content', '')).lower()]
                    
                    if indices:
                        cluster_reviews = [raw_reviews[i] for i in indices if i < len(raw_reviews)]
                        if cluster_reviews:
                            future = executor.submit(synthesize_cluster_label, label, cluster_reviews, vertical)
                            tasks.append((item, future, label, 'name'))
        
        # Process any other nested structures if needed...
        
        # Collect results
        for item, future, old_label, key_name in tasks:
            try:
                new_label = future.result(timeout=45)
                if new_label and new_label != old_label:
                    logger.info(f"Synthesized label: '{old_label}' -> '{new_label}'")
                    item[key_name] = new_label
            except Exception as e:
                logger.error(f"Synthesis task failed for {old_label}: {e}")
    
    return categorized_data

def process_item(item, label, key_name, tasks, executor, vague_threshold, raw_reviews, vertical):
    indices = item.get('review_indices', [])
    if (label in vague_threshold or len(label.split()) < 2) and indices:
        cluster_reviews = [raw_reviews[i] for i in indices if i < len(raw_reviews)]
        if cluster_reviews:
            future = executor.submit(synthesize_cluster_label, label, cluster_reviews, vertical)
            tasks.append((item, future, label, key_name))
