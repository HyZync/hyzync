"""
Review Cache Integration Module
Wraps review fetching with local file caching logic.
"""

from datetime import datetime
from typing import Optional, Dict, Any
import pandas as pd

from local_cache import get_cache_manager
from source_tracker import (
    generate_source_fingerprint,
    create_source_metadata
)


def add_cache_metadata(df: pd.DataFrame, source_fingerprint: str) -> pd.DataFrame:
    """
    Add timestamp and source fingerprint columns to DataFrame.
    
    Args:
        df: Reviews DataFrame
        source_fingerprint: Source fingerprint
        
    Returns:
        Modified DataFrame
    """
    df = df.copy()
    df['fetch_timestamp'] = datetime.now().isoformat()
    df['source_fingerprint'] = source_fingerprint
    return df


def fetch_with_cache(
    source_type: str,
    source_params: Dict[str, Any],
    fetch_function: callable,
    *fetch_args,
    **fetch_kwargs
) -> Optional[pd.DataFrame]:
    """
    Fetch reviews with local file caching.
    
    Workflow:
    1. Generate source fingerprint
    2. Check if cached locally
    3. If cached, load and return
    4. If not cached, call fetch_function, save to cache, and return
    
    Args:
        source_type: Type of source ('playstore', 'appstore', etc.)
        source_params: Source parameters dict
        fetch_function: Function to call if cache miss
        *fetch_args: Positional args for fetch_function
        **fetch_kwargs: Keyword args for fetch_function
        
    Returns:
        DataFrame with reviews (from cache or fresh fetch)
    """
    cache = get_cache_manager()
    
    # Generate fingerprint
    fingerprint = generate_source_fingerprint(source_type, source_params)
    
    # Check cache
    try:
        cached_df = cache.download_reviews_from_cache(fingerprint)
        
        if cached_df is not None:
            print(f"[CACHE HIT] Loading {len(cached_df)} reviews from local cache")
            return cached_df, 'cache', fingerprint
    except Exception as e:
        print(f"[CACHE] Error checking cache: {e}")
    
    # Cache miss - fetch fresh data
    print(f"[CACHE MISS] Fetching fresh data from {source_type}")
    
    try:
        # Call the original fetch function
        fetch_result = fetch_function(*fetch_args, **fetch_kwargs)
        
        # Handle different return formats
        if isinstance(fetch_result, dict):
            df = fetch_result.get('raw_reviews_df')
            review_count = fetch_result.get('total_records', len(df) if df is not None else 0)
        elif isinstance(fetch_result, pd.DataFrame):
            df = fetch_result
            review_count = len(df)
        else:
            print(f"[CACHE] Unexpected fetch result type: {type(fetch_result)}")
            return None, 'fetch_error', fingerprint
        
        if df is None or df.empty:
            print("[CACHE] No reviews fetched")
            return None, 'no_data', fingerprint
        
        # Add cache metadata
        df = add_cache_metadata(df, fingerprint)
        
        # Save to local cache
        try:
            metadata = create_source_metadata(source_type, source_params, review_count)
            filepath = cache.upload_reviews_to_cache(df, fingerprint, metadata)
            
            if filepath:
                print(f"[CACHE] Saved {review_count} reviews to local cache")
            else:
                print("[CACHE] Failed to save to cache")
        except Exception as e:
            print(f"[CACHE] Error saving to cache: {e}")
        
        return df, 'fresh', fingerprint
        
    except Exception as e:
        print(f"[CACHE] Error during fetch: {e}")
        return None, 'fetch_error', fingerprint


def get_cache_status_message(status: str, review_count: int = 0, fingerprint: str = "") -> str:
    """
    Generate user-friendly cache status message.
    
    Args:
        status: Cache status ('cache', 'fresh', 'no_data', 'fetch_error')
        review_count: Number of reviews
        fingerprint: Source fingerprint (first 8 chars shown)
        
    Returns:
        Formatted message string
    """
    fingerprint_short = fingerprint[:8] if fingerprint else "unknown"
    
    if status == 'cache':
        return f"✅ **Loaded {review_count:,} reviews from cache** (Source: `{fingerprint_short}...`)"
    elif status == 'fresh':
        return f"✅ **Fetched and cached {review_count:,} reviews** (Source: `{fingerprint_short}...`)"
    elif status == 'no_data':
        return f"⚠️ **No reviews found** for this source"
    elif status == 'fetch_error':
        return f"❌ **Error fetching reviews**. Please check your connection and try again."
    else:
        return f"ℹ️ **Unknown status**: {status}"
