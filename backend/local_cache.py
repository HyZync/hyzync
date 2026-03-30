"""
Local Cache Manager
Simple file-based caching for review data - no authentication needed!
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd

# Cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)


class LocalCacheManager:
    """
    Manages local file-based caching for reviews.
    Stores reviews as JSON files in the cache directory.
    """
    
    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = cache_dir
        self.authenticated = True  # Always "authenticated" for local storage
        os.makedirs(self.cache_dir, exist_ok=True)
        print(f"[LOCAL CACHE] Initialized at {self.cache_dir}")
    
    def upload_reviews_to_cache(
        self, 
        df: pd.DataFrame, 
        source_fingerprint: str, 
        metadata: Dict[str, Any]
    ) -> Optional[str]:
        """
        Save reviews DataFrame to local cache as JSON.
        
        Args:
            df: Reviews DataFrame
            source_fingerprint: Unique identifier for this source
            metadata: Source metadata
            
        Returns:
            str: File path if successful, None otherwise
        """
        try:
            # Create filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"reviews_{source_fingerprint}_{timestamp}.json"
            filepath = os.path.join(self.cache_dir, filename)
            
            # Convert DataFrame to JSON structure
            reviews_data = {
                'metadata': metadata,
                'reviews': df.to_dict(orient='records'),
                'count': len(df),
                'fingerprint': source_fingerprint,
                'timestamp': datetime.now().isoformat()
            }
            
            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(reviews_data, f, indent=2, default=str)
            
            print(f"[LOCAL CACHE] Saved {len(df)} reviews to {filename}")
            return filepath
            
        except Exception as e:
            print(f"[LOCAL CACHE] Error saving: {e}")
            return None
    
    def download_reviews_from_cache(self, source_fingerprint: str) -> Optional[pd.DataFrame]:
        """
        Load cached reviews from local storage.
        
        Args:
            source_fingerprint: Unique identifier for the source
            
        Returns:
            DataFrame if found, None otherwise
        """
        try:
            # Find files matching this fingerprint
            matching_files = []
            for filename in os.listdir(self.cache_dir):
                if filename.startswith(f"reviews_{source_fingerprint}_") and filename.endswith('.json'):
                    filepath = os.path.join(self.cache_dir, filename)
                    matching_files.append((filepath, os.path.getmtime(filepath)))
            
            if not matching_files:
                return None
            
            # Get the most recent file
            latest_file = max(matching_files, key=lambda x: x[1])[0]
            
            # Load JSON
            with open(latest_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Convert back to DataFrame
            df = pd.DataFrame(data['reviews'])
            
            print(f"[LOCAL CACHE] Loaded {len(df)} reviews from cache")
            return df
            
        except Exception as e:
            print(f"[LOCAL CACHE] Error loading: {e}")
            return None
    
    def list_cached_sources(self) -> List[Dict[str, Any]]:
        """
        List all cached review sources.
        
        Returns:
            List of dicts with source info
        """
        try:
            cached_sources = []
            
            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.cache_dir, filename)
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        cached_sources.append({
                            'file_id': filename,
                            'filename': filename,
                            'source_fingerprint': data.get('fingerprint', 'unknown'),
                            'source_type': data.get('metadata', {}).get('source_type', 'unknown'),
                            'review_count': data.get('count', 0),
                            'fetch_timestamp': data.get('timestamp', ''),
                            'file_size': os.path.getsize(filepath),
                            'created_time': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat(),
                            'modified_time': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                        })
                    except:
                        pass
            
            return sorted(cached_sources, key=lambda x: x['modified_time'], reverse=True)
            
        except Exception as e:
            print(f"[LOCAL CACHE] Error listing: {e}")
            return []
    
    def delete_cache(self, source_fingerprint: str = None, file_id: str = None) -> bool:
        """
        Delete cached review file(s).
        
        Args:
            source_fingerprint: Delete all files with this fingerprint
            file_id: Delete specific file by name
            
        Returns:
            bool: True if successful
        """
        try:
            if file_id:
                # Delete specific file
                filepath = os.path.join(self.cache_dir, file_id)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    print(f"[LOCAL CACHE] Deleted {file_id}")
                    return True
                    
            elif source_fingerprint:
                # Delete all files with matching fingerprint
                deleted = 0
                for filename in os.listdir(self.cache_dir):
                    if filename.startswith(f"reviews_{source_fingerprint}_"):
                        filepath = os.path.join(self.cache_dir, filename)
                        os.remove(filepath)
                        deleted += 1
                
                print(f"[LOCAL CACHE] Deleted {deleted} files")
                return True
            
            return False
            
        except Exception as e:
            print(f"[LOCAL CACHE] Error deleting: {e}")
            return False
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dict with cache stats
        """
        try:
            total_files = 0
            total_size = 0
            total_reviews = 0
            
            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.cache_dir, filename)
                    total_files += 1
                    total_size += os.path.getsize(filepath)
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            total_reviews += data.get('count', 0)
                    except:
                        pass
            
            return {
                'total_files': total_files,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'total_reviews': total_reviews,
                'cache_dir': self.cache_dir
            }
            
        except Exception as e:
            print(f"[LOCAL CACHE] Error getting stats: {e}")
            return {}


# Global instance
_cache_instance = None

def get_cache_manager() -> LocalCacheManager:
    """Get or create global cache manager instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = LocalCacheManager()
    return _cache_instance


def is_authenticated() -> bool:
    """Check if cache is available (always True for local cache)."""
    return True
