"""
Trustpilot Review Connector (FastAPI-compatible)

Fetches reviews from Trustpilot public pages via web scraping.
No Streamlit dependency. No API key required.
"""

import requests
import pandas as pd
from datetime import datetime
import time
import re
import logging

logger = logging.getLogger(__name__)


def lookup_business_unit_id(company_identifier, api_key=None):
    """
    Resolves a company identifier to a Trustpilot domain slug.
    
    Args:
        company_identifier (str): Domain (e.g., 'example.com') or full URL.
        api_key (str, optional): Trustpilot API key. Defaults to None.
    
    Returns:
        str: Business Unit ID or None if not found.
    """
    # 1. Handle Full URL (extract domain)
    if "trustpilot.com/review/" in company_identifier:
        # e.g. https://www.trustpilot.com/review/www.apple.com
        try:
            from urllib.parse import urlparse
            path = urlparse(company_identifier).path
            # path is /review/www.apple.com
            parts = path.split('/')
            if len(parts) > 2 and parts[1] == 'review':
                company_identifier = parts[2]
        except:
            pass # Fallback to using as-is

    try:
        identifier = company_identifier.strip().lower()
        
        # Remove http/https and www prefix
        identifier = identifier.replace('http://', '').replace('https://', '')
        identifier = identifier.replace('www.', '')
        
        # Remove trustpilot.com/review/ prefix if user pasted full URL
        identifier = identifier.replace('trustpilot.com/review/', '')
        
        # Remove trailing slash
        identifier = identifier.rstrip('/')
        
        # If it looks like a domain (has known TLD), use it directly
        if '.' in identifier and any(tld in identifier for tld in ['.com', '.co', '.org', '.net', '.io', '.ai', '.uk', '.ca', '.so', '.app']):
            return identifier
        
        # Otherwise assume .com
        return f"{identifier}.com"
        
    except Exception as e:
        logger.error(f"Error looking up company: {e}")
        return None


def scrape_trustpilot_public(company_domain, max_reviews=200):
    """
    Scrapes public Trustpilot reviews without requiring API key.
    
    Args:
        company_domain (str): Company domain (e.g., "goodnotes.com")
        max_reviews (int): Maximum reviews to scrape
    
    Returns:
        list: List of review dicts with 'score', 'content', 'at'
    """
    from bs4 import BeautifulSoup
    import json
    
    reviews_list = []
    page = 1
    
    try:
        while len(reviews_list) < max_reviews and page <= 20:
            url = f"https://www.trustpilot.com/review/{company_domain}?page={page}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=8)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Strategy 1: JSON-LD (Most robust)
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            found_json_reviews = False
            
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.string)
                    # Data can be a list or a dict
                    if isinstance(data, list):
                        items = data
                    else:
                        items = [data]
                        
                    for item in items:
                        if item.get('@type') == 'Organization' and 'review' in item:
                            # Found the organization block with reviews
                            reviews = item['review']
                            if isinstance(reviews, dict): reviews = [reviews] # Normalize single review
                            
                            for review in reviews:
                                reviews_list.append({
                                    'score': int(review.get('reviewRating', {}).get('ratingValue', 0)),
                                    'content': review.get('reviewBody', ''),
                                    'at': review.get('datePublished', datetime.now().isoformat()),
                                    'userName': review.get('author', {}).get('name', 'Anonymous')
                                })
                            found_json_reviews = True
                            break
                    if found_json_reviews: break
                except Exception as e:
                    logger.debug(f"Error parsing JSON-LD: {e}")
                    continue
            
            if found_json_reviews:
                 # If we found reviews in JSON-LD, great. 
                 # However, pagination in Trustpilot with JSON-LD might duplicates or only show first page?
                 # Actually, Trustpilot's JSON-LD on page X typically contains reviews for page X.
                 logger.info(f"Page {page}: Found {len(reviews_list)} reviews via JSON-LD")
            else:
                # Strategy 2: Fallback to CSS Selectors (Updated)
                # Review Card: article
                review_cards = soup.find_all('article')
                
                if not review_cards:
                    logger.info(f"No review cards found on page {page}, stopping.")
                    break
                
                for card in review_cards:
                     try:
                        # Rating
                        star_img = card.find('img', alt=re.compile(r'Rated \d out of 5 stars'))
                        score = 0
                        if star_img:
                            match = re.search(r'Rated (\d) out of 5', star_img.get('alt', ''))
                            if match:
                                score = int(match.group(1))
                        
                        # Content
                        # Typography classes change often, looking for p tag with specific data attributes or just the main p
                        content_p = card.find('p', attrs={'data-service-review-text-typography': True})
                        if not content_p:
                             content_p = card.find('p', class_=re.compile(r'typography_body'))
                        
                        content = content_p.get_text(strip=True) if content_p else ""
                        
                        # Date
                        time_tag = card.find('time')
                        date_str = time_tag.get('datetime') if time_tag else datetime.now().isoformat()
                        
                        # Author
                        author_span = card.find('span', attrs={'data-consumer-name-typography': True})
                        author = author_span.get_text(strip=True) if author_span else "Anonymous"

                        if content:
                            reviews_list.append({
                                'score': score,
                                'content': content,
                                'at': date_str,
                                'userName': author
                            })
                     except Exception as e:
                        continue

            if len(reviews_list) >= max_reviews:
                reviews_list = reviews_list[:max_reviews]
                break
            
            page += 1
            time.sleep(0.5)
        
        return reviews_list
    
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error scraping Trustpilot: {e}")
        return []
    except Exception as e:
        logger.error(f"Error scraping Trustpilot: {e}")
        return []


def fetch_trustpilot_reviews(company_identifier, api_key=None, max_reviews=200):
    """
    Fetches reviews from Trustpilot for a given company.
    Uses public scraping (no API key required).
    
    Args:
        company_identifier (str): Company name, domain, or URL
                                 Examples: "Nike", "nike.com", "www.nike.com"
        api_key (str): Not used (kept for backward compatibility)
        max_reviews (int): Maximum number of reviews to fetch (default 200)
    
    Returns:
        dict: Contains 'total_records' and 'raw_reviews_df' with standardized columns
              or None if fetch fails
    """
    # Resolve to domain slug
    domain = lookup_business_unit_id(company_identifier, api_key)
    
    if not domain:
        logger.error(f"Could not resolve domain for: {company_identifier}")
        return None
    
    logger.info(f"Fetching Trustpilot reviews for domain: {domain}")
    
    reviews_list = scrape_trustpilot_public(domain, max_reviews)
    
    if not reviews_list:
        logger.warning(f"No reviews found for {domain}")
        return None
    
    df = pd.DataFrame(reviews_list)
    return {
        "total_records": len(df),
        "raw_reviews_df": df,
    }
