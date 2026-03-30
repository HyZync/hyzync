"""
Source Tracker Module
Generates unique fingerprints for review sources and manages source metadata.
"""

import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Optional


def generate_source_fingerprint(source_type: str, source_params: Dict[str, Any]) -> str:
    """
    Generate a unique fingerprint for a review source based on its parameters.
    
    Args:
        source_type: Type of source ('playstore', 'appstore', 'salesforce', etc.)
        source_params: Dict of source-specific parameters
        
    Returns:
        str: SHA256 hash fingerprint
        
    Example:
        >>> generate_source_fingerprint('playstore', {
        ...     'package': 'com.example.app',
        ...     'country': 'us',
        ...     'count': 100
        ... })
        'a3f5d8e9...'
    """
    # Normalize source type
    source_type = source_type.lower().strip()
    
    # Create a deterministic string from parameters
    # Sort keys to ensure consistent ordering
    param_str = json.dumps(source_params, sort_keys=True, default=str)
    
    # Combine source type and params
    fingerprint_input = f"{source_type}:{param_str}"
    
    # Generate SHA256 hash
    fingerprint = hashlib.sha256(fingerprint_input.encode('utf-8')).hexdigest()
    
    return fingerprint


def create_source_metadata(
    source_type: str, 
    source_params: Dict[str, Any], 
    review_count: int,
    additional_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create metadata dict for a review source.
    
    Args:
        source_type: Type of source
        source_params: Source parameters
        review_count: Number of reviews fetched
        additional_info: Optional additional metadata
        
    Returns:
        Dict with complete source metadata
    """
    metadata = {
        'source_type': source_type,
        'source_params': source_params,
        'review_count': review_count,
        'fetch_timestamp': datetime.now().isoformat(),
        'fingerprint': generate_source_fingerprint(source_type, source_params)
    }
    
    if additional_info:
        metadata.update(additional_info)
    
    return metadata


def is_duplicate_source(
    fingerprint: str, 
    cached_sources: List[Dict[str, Any]]
) -> bool:
    """
    Check if a source fingerprint already exists in cache.
    
    Args:
        fingerprint: Source fingerprint to check
        cached_sources: List of cached source metadata dicts
        
    Returns:
        bool: True if duplicate exists
    """
    for cached in cached_sources:
        if cached.get('source_fingerprint') == fingerprint:
            return True
    return False


def extract_source_params_from_playstore(
    package: str, 
    country: str, 
    count: int
) -> Dict[str, Any]:
    """
    Extract standardized parameters for Google Play Store source.
    
    Args:
        package: App package name
        country: Country code
        count: Number of reviews to fetch
        
    Returns:
        Dict of normalized parameters
    """
    return {
        'package': package.strip().lower(),
        'country': country.strip().lower(),
        'count': count
    }


def extract_source_params_from_appstore(
    app_name: str, 
    country: str, 
    max_pages: int
) -> Dict[str, Any]:
    """
    Extract standardized parameters for App Store source.
    
    Args:
        app_name: App name
        country: Country code
        max_pages: Maximum pages to scrape
        
    Returns:
        Dict of normalized parameters
    """
    return {
        'app_name': app_name.strip().lower(),
        'country': country.strip().lower(),
        'max_pages': max_pages
    }


def extract_source_params_from_salesforce(
    instance_url: str, 
    soql_query: str
) -> Dict[str, Any]:
    """
    Extract standardized parameters for Salesforce source.
    
    Args:
        instance_url: Salesforce instance URL
        soql_query: SOQL query string
        
    Returns:
        Dict of normalized parameters
    """
    # Hash the SOQL query to avoid storing sensitive data
    query_hash = hashlib.md5(soql_query.encode('utf-8')).hexdigest()
    
    return {
        'instance_url': instance_url.strip().lower(),
        'query_hash': query_hash
    }


def extract_source_params_from_gsheets(
    sheet_url: str, 
    sheet_name: str = None
) -> Dict[str, Any]:
    """
    Extract standardized parameters for Google Sheets source.
    
    Args:
        sheet_url: Google Sheets URL
        sheet_name: Optional sheet name/index
        
    Returns:
        Dict of normalized parameters
    """
    # Extract sheet ID from URL
    import re
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', sheet_url)
    sheet_id = match.group(1) if match else hashlib.md5(sheet_url.encode()).hexdigest()
    
    return {
        'sheet_id': sheet_id,
        'sheet_name': sheet_name or 'default'
    }


def extract_source_params_from_surveymonkey(
    survey_id: str, 
    score_qid: str, 
    content_qid: str
) -> Dict[str, Any]:
    """
    Extract standardized parameters for SurveyMonkey source.
    
    Args:
        survey_id: Survey ID
        score_qid: Score question ID
        content_qid: Content question ID
        
    Returns:
        Dict of normalized parameters
    """
    return {
        'survey_id': survey_id.strip(),
        'score_qid': score_qid.strip(),
        'content_qid': content_qid.strip()
    }


def extract_source_params_from_trustpilot(
    company_name: str, 
    max_reviews: int
) -> Dict[str, Any]:
    """
    Extract standardized parameters for Trustpilot source.
    
    Args:
        company_name: Company name or domain
        max_reviews: Maximum number of reviews to fetch
        
    Returns:
        Dict of normalized parameters
    """
    return {
        'company': company_name.strip().lower(),
        'max_reviews': max_reviews
    }


def get_cache_summary(cached_sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate summary statistics from cached sources.
    
    Args:
        cached_sources: List of cached source metadata
        
    Returns:
        Dict with summary stats
    """
    if not cached_sources:
        return {
            'total_cached_sources': 0,
            'total_cached_reviews': 0,
            'sources_by_type': {},
            'oldest_cache': None,
            'newest_cache': None
        }
    
    total_reviews = sum(s.get('review_count', 0) for s in cached_sources)
    
    sources_by_type = {}
    for source in cached_sources:
        source_type = source.get('source_type', 'unknown')
        sources_by_type[source_type] = sources_by_type.get(source_type, 0) + 1
    
    timestamps = [s.get('fetch_timestamp', '') for s in cached_sources if s.get('fetch_timestamp')]
    timestamps.sort()
    
    return {
        'total_cached_sources': len(cached_sources),
        'total_cached_reviews': total_reviews,
        'sources_by_type': sources_by_type,
        'oldest_cache': timestamps[0] if timestamps else None,
        'newest_cache': timestamps[-1] if timestamps else None
    }
