from google_play_scraper import reviews, Sort
import pandas as pd

def fetch_raw_playstore_reviews(app_package: str, country_code: str, count: int):
    """
    Fetches raw Play Store reviews.
    """
    import urllib.parse
    import urllib.parse
    
    # Handle full URL if provided
    if "play.google.com" in app_package and "id=" in app_package:
        try:
            parsed = urllib.parse.urlparse(app_package)
            params = urllib.parse.parse_qs(parsed.query)
            if 'id' in params:
                app_package = params['id'][0]
        except Exception:
            pass # Fallback to using as-is

    try:
        result, _ = reviews(
            app_package,
            lang='en',
            country=country_code.lower(),
            count=count,
            sort=Sort.NEWEST
        )
            
    except Exception as e:
        print(f"Play Store Fetch Error: {e}")
        return None

    if not result:
        return None

    df = pd.DataFrame(result)
    
    # Ensure standard columns exist
    if 'score' not in df.columns and 'rating' in df.columns:
        df['score'] = df['rating']
    if 'score' not in df.columns:
        df['score'] = 0 # Default if missing
        
    if 'content' not in df.columns and 'text' in df.columns:
        df['content'] = df['text']
    if 'content' not in df.columns:
        df['content'] = ""

    # Standardize and format output
    df['at'] = pd.to_datetime(df['at']).dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Deduplication and sorting
    df = df.drop_duplicates(subset=['userName', 'at', 'content']).sort_values('at', ascending=False).reset_index(drop=True)
    
    # Ensure we only return the maximum total number requested
    df = df.head(count)
    
    return df
