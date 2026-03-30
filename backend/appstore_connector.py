import re
import time
from datetime import datetime
from urllib.parse import urlparse

import pandas as pd
import requests

class AppStoreReviewsScraper:
    def __init__(self):
        self.base_url = "https://itunes.apple.com"
        self.headers = {'User-Agent': 'Mozilla/5.0'}

    def _extract_direct_app_id(self, identifier):
        value = str(identifier or '').strip()
        if not value:
            return None

        direct_match = re.fullmatch(r'(?:id)?(\d{6,})', value, re.IGNORECASE)
        if direct_match:
            return direct_match.group(1)

        if 'apps.apple.com' in value:
            path = urlparse(value).path or ''
            path_match = re.search(r'/id(\d{6,})', path, re.IGNORECASE)
            if path_match:
                return path_match.group(1)

        return None

    def _lookup_app_id(self, *, track_id=None, bundle_id=None, country='us'):
        params = {'country': country, 'entity': 'software'}
        if track_id:
            params['id'] = str(track_id).strip()
        elif bundle_id:
            params['bundleId'] = str(bundle_id).strip()
        else:
            return None

        response = requests.get(f"{self.base_url}/lookup", params=params, headers=self.headers, timeout=20)
        response.raise_for_status()
        data = response.json()
        results = data.get('results') or []
        if results:
            return str(results[0].get('trackId') or '').strip() or None
        return None

    def get_app_id(self, app_identifier, country='us'):
        direct_app_id = self._extract_direct_app_id(app_identifier)
        if direct_app_id:
            try:
                return self._lookup_app_id(track_id=direct_app_id, country=country) or direct_app_id
            except Exception as e:
                print(f"App lookup error: {e}")
                return direct_app_id

        candidate = str(app_identifier or '').strip()
        if not candidate:
            return None

        # Bundle identifiers are common in internal tooling and can be resolved directly.
        if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9._-]+', candidate):
            try:
                bundle_match = self._lookup_app_id(bundle_id=candidate, country=country)
                if bundle_match:
                    return bundle_match
            except Exception as e:
                print(f"Bundle lookup error: {e}")

        try:
            search_url = f"{self.base_url}/search"
            params = {'term': candidate, 'country': country, 'media': 'software', 'limit': 5}
            response = requests.get(search_url, params=params, headers=self.headers, timeout=20)
            response.raise_for_status()
            data = response.json()
            results = data.get('results') or []
            if results:
                candidate_lower = candidate.lower()
                exact_name = next(
                    (
                        item for item in results
                        if str(item.get('trackName') or '').strip().lower() == candidate_lower
                    ),
                    None,
                )
                selected = exact_name or results[0]
                return str(selected.get('trackId') or '').strip() or None
            return None
        except Exception as e:
            print(f"App search error: {e}")
            return None

    def _parse_reviews_payload(self, data):
        feed = data.get('feed', {}) if isinstance(data, dict) else {}
        entries = feed.get('entry')
        if not entries:
            return []

        if isinstance(entries, dict):
            entries = [entries]
        elif not isinstance(entries, list):
            return []

        reviews_list = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            # Skip non-review payload rows defensively.
            if 'content' not in entry or 'im:rating' not in entry:
                continue

            updated = entry.get('updated', {}).get('label', datetime.now())
            try:
                normalized_at = pd.to_datetime(updated).strftime('%Y-%m-%d %H:%M:%S')
            except Exception:
                normalized_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            score_raw = entry.get('im:rating', {}).get('label', 0)
            try:
                score = int(score_raw)
            except Exception:
                score = 0

            review = {
                'content': entry.get('content', {}).get('label', ''),
                'score': score,
                'userName': entry.get('author', {}).get('name', {}).get('label', 'Anonymous'),
                'at': normalized_at,
                'appVersion': entry.get('im:version', {}).get('label', None),
            }
            reviews_list.append(review)
        return reviews_list

    def get_reviews(self, app_id, country='us', page=1, sort='mostRecent'):
        # Apple currently serves entries on /json without sortby; keep a fallback to
        # old sortby path for compatibility across storefront changes.
        urls = [
            f"{self.base_url}/{country}/rss/customerreviews/page={page}/id={app_id}/json",
            f"{self.base_url}/{country}/rss/customerreviews/page={page}/id={app_id}/sortby={sort}/json",
        ]
        for url in urls:
            try:
                response = requests.get(url, headers=self.headers, timeout=20)
                response.raise_for_status()
                data = response.json()
                parsed = self._parse_reviews_payload(data)
                if parsed:
                    return parsed
            except Exception as e:
                print(f"Fetching reviews error: {e}")
        return []

    def scrape_all_reviews(self, app_id, country='us', max_pages=10, delay=0.2):
        all_reviews = []
        existing_content = set()
        
        for page in range(1, max_pages + 1):
            page_reviews = self.get_reviews(app_id, country, page)
            if not page_reviews:
                break
            
            for r in page_reviews:
                if r['content'] and r['content'] not in existing_content:
                    all_reviews.append(r)
                    existing_content.add(r['content'])
            
            time.sleep(delay)
            
        return pd.DataFrame(all_reviews)

def fetch_appstore_reviews(app_identifier: str, country: str, max_pages: int = 10):
    scraper = AppStoreReviewsScraper()
    app_id = scraper.get_app_id(app_identifier, country)
    if app_id:
        return scraper.scrape_all_reviews(app_id, country, max_pages)
    return None
