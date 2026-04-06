import json
import re
import time
from datetime import datetime
from urllib.parse import urlparse

import pandas as pd
import requests

def estimate_appstore_pages(max_reviews, page_size=50, max_pages=None):
    try:
        requested_reviews = max(1, int(max_reviews or 1))
    except (TypeError, ValueError):
        requested_reviews = 1

    try:
        per_page = max(1, int(page_size or 50))
    except (TypeError, ValueError):
        per_page = 50

    pages = max(1, (requested_reviews + per_page - 1) // per_page)
    if max_pages is None:
        return pages

    try:
        cap = max(1, int(max_pages))
    except (TypeError, ValueError):
        return pages
    return min(pages, cap)

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

    def _repair_text(self, value):
        text = str(value or '')
        if not text:
            return ''
        try:
            repaired = text.encode('latin1').decode('utf-8')
            if repaired:
                return repaired
        except Exception:
            pass
        return text

    def _parse_app_page_reviews(self, html):
        match = re.search(
            r'<script type="application/json" id="serialized-server-data">(.*?)</script>',
            html,
            re.DOTALL | re.IGNORECASE,
        )
        if not match:
            return []

        try:
            payload = json.loads(match.group(1))
        except Exception:
            return []

        try:
            page_data = ((payload.get('data') or [{}])[0] or {}).get('data') or {}
            shelf_mapping = page_data.get('shelfMapping') or {}
            review_items = (shelf_mapping.get('allProductReviews') or {}).get('items') or []
        except Exception:
            return []

        reviews = []
        seen_ids = set()
        for item in review_items:
            review = item.get('review') if isinstance(item, dict) else None
            if not isinstance(review, dict):
                continue

            review_id = str(review.get('id') or '').strip()
            if review_id and review_id in seen_ids:
                continue

            content = self._repair_text(review.get('contents'))
            if not content:
                continue

            try:
                normalized_at = pd.to_datetime(review.get('date')).strftime('%Y-%m-%d %H:%M:%S')
            except Exception:
                normalized_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            try:
                score = int(review.get('rating') or 0)
            except Exception:
                score = 0

            reviews.append(
                {
                    'content': content,
                    'score': score,
                    'userName': self._repair_text(review.get('reviewerName')) or 'Anonymous',
                    'at': normalized_at,
                    'appVersion': None,
                }
            )
            if review_id:
                seen_ids.add(review_id)
        return reviews

    def _fetch_reviews_from_app_page(self, app_id, country='us'):
        normalized_country = str(country or 'us').strip().lower() or 'us'
        urls = [
            f'https://apps.apple.com/{normalized_country}/app/id{app_id}',
            f'https://apps.apple.com/us/app/id{app_id}',
        ]
        for url in urls:
            try:
                response = requests.get(url, headers=self.headers, timeout=20)
                response.raise_for_status()
                parsed = self._parse_app_page_reviews(response.text)
                if parsed:
                    return parsed
            except Exception as e:
                print(f"App page reviews error: {e}")
        return []

    def get_reviews(self, app_id, country='us', page=1, sort='mostRecent'):
        normalized_country = str(country or 'us').strip().lower() or 'us'
        normalized_sort = str(sort or 'mostRecent').strip() or 'mostRecent'

        # Apple currently returns review entries most reliably from the
        # countryless endpoint without the page segment. Keep additional
        # storefront/page variants as fallbacks because the behavior shifts.
        urls = [
            f"{self.base_url}/rss/customerreviews/id={app_id}/sortBy={normalized_sort}/json",
            f"{self.base_url}/{normalized_country}/rss/customerreviews/id={app_id}/sortBy={normalized_sort}/json",
            f"{self.base_url}/rss/customerreviews/page={page}/id={app_id}/sortBy={normalized_sort}/json",
            f"{self.base_url}/{normalized_country}/rss/customerreviews/page={page}/id={app_id}/json",
            f"{self.base_url}/{normalized_country}/rss/customerreviews/page={page}/id={app_id}/sortby={normalized_sort}/json",
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
        return self._fetch_reviews_from_app_page(app_id, normalized_country)

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
    normalized_country = str(country or 'us').strip().lower() or 'us'
    fallback_countries = [normalized_country]
    if normalized_country != 'us':
        # Some apps resolve correctly but expose reviews only from the default
        # storefront feed, so retry once against the US catalog before failing.
        fallback_countries.append('us')

    for lookup_country in fallback_countries:
        app_id = scraper.get_app_id(app_identifier, lookup_country)
        if not app_id:
            continue
        df = scraper.scrape_all_reviews(app_id, lookup_country, max_pages)
        if df is not None and not df.empty:
            return df
    return None
