"""
Pattern Matching & Caching System with Semantic Embeddings
Intelligently reuses proven decisions to speed up analysis and reduce LLM calls.
NOW WITH SEMANTIC UNDERSTANDING - understands "crash" ≈ "freeze" ≈ "broken"
NO PROMPT CHANGES - 100% safe from JSON parsing errors.
"""

import sqlite3
import hashlib
import re
import numpy as np
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CachedDecision:
    """Represents a cached decision that can be reused."""
    fingerprint: str
    sentiment: str
    sentiment_score: float
    confidence: float
    churn_risk: str
    pain_point_category: str
    issue: str
    similarity_score: float = 1.0
    source_count: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for merging with review data."""
        return {
            'sentiment': self.sentiment,
            'sentiment_score': self.sentiment_score,
            'confidence': self.confidence,
            'churn_risk': self.churn_risk,
            'pain_point_category': self.pain_point_category,
            'issue': self.issue,
            '_cached': True,
            '_similarity': self.similarity_score,
            '_source_count': self.source_count
        }


class PatternMatcher:
    """
    Intelligent pattern matching and caching engine with semantic embeddings.
    Uses fingerprinting and semantic similarity to reuse proven decisions.
    """
    
    def __init__(self, db_path: str = None, 
                 min_confidence: float = 0.5,
                 min_usage_threshold: int = 2,
                 retrieval_confidence_threshold: float = 0.75,
                 pattern_decay_days: int = 90):
        if db_path is None:
            from database import DB_PATH
            db_path = DB_PATH
        self.db_path = db_path
        self.min_confidence = min_confidence  # Filter low confidence patterns
        self.min_usage_threshold = min_usage_threshold  # Require proven patterns
        self.retrieval_confidence_threshold = retrieval_confidence_threshold  # Pattern matching threshold
        self.pattern_decay_days = pattern_decay_days  # Days before pattern becomes stale
        self._ensure_tables()
        
        # Try to load semantic embedding model
        self.embedding_model = None
        self.use_embeddings = False
        # USER_REQUEST: Prevent downloading extra models. Use Llama only.
        # try:
        #     from sentence_transformers import SentenceTransformer
        #     # Use lightweight but powerful model (all-MiniLM-L6-v2)
        #     # 384 dimensions, 80MB, very fast
        #     self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        #     self.use_embeddings = True
        #     # Silent success - only log errors
        # except Exception:
        #     # Graceful fallback to keyword matching
        #     self.use_embeddings = False
        
        # Enhanced pattern matcher fallback
        try:
            from enhanced_pattern_matcher import EnhancedPatternMatcher
            self.enhanced_matcher = EnhancedPatternMatcher(min_confidence=min_confidence)
        except ImportError:
            self.enhanced_matcher = None
        
        # Advanced pattern intelligence
        self.pattern_intelligence = None
        try:
            pass
            # Will initialize on first use with active connection
        except ImportError:
            pass
        
        # Statistics
        self.cache_hits = 0
        self.cache_misses = 0
        self.llm_calls_saved = 0
        self.bad_precedents_filtered = 0
        self.duplicates_prevented = 0
        self.patterns_cleaned = 0
        self.patterns_merged = 0
        
        # === SAFETY CONTROLS ===
        # 1) Domain/Vertical Drift Control
        self.current_product_version = "1.0.0"  # Set via set_product_version()
        
        # 2) Cold-Start Bias Control
        self.cold_start_usage_cap = 5  # Patterns need 5 uses before full influence
        self.exploration_weight = 0.2  # 20% chance to explore new patterns
        
        # 3) Retrieval Latency Guard
        self.latency_threshold_ms = 100  # Warn if retrieval exceeds this
        self.total_retrieval_time_ms = 0
        self.retrieval_count = 0
        
        # 4) Memory Health Observability
        self.similarity_rejections = 0
        self.global_fallback_uses = 0
        self.vertical_matches = 0
    
    def _get_intelligence(self) -> Optional[Any]:
        """Get pattern intelligence instance (lazy loaded)"""
        if self.pattern_intelligence is None:
            try:
                from pattern_intelligence import PatternIntelligence
                conn = self._get_connection()
                self.pattern_intelligence = PatternIntelligence(conn)
            except Exception:
                pass
        return self.pattern_intelligence
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _ensure_tables(self):
        """Ensure pattern cache tables exist."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Create patterns table with advanced intelligence + VERTICAL AWARENESS
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fingerprint TEXT UNIQUE NOT NULL,
                    vertical TEXT DEFAULT 'global',
                    source_name TEXT,
                    content_hash TEXT,
                    rating INTEGER,
                    review_length INTEGER,
                    sentiment TEXT NOT NULL,
                    sentiment_score REAL,
                    confidence REAL,
                    churn_risk TEXT,
                    pain_point_category TEXT,
                    issue TEXT,
                    usage_count INTEGER DEFAULT 1,
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    -- Pattern Weight Evolution (Step 1)
                    pattern_score REAL DEFAULT 0.5,
                    stability_score REAL DEFAULT 0.5,
                    match_outcomes TEXT DEFAULT '[]',
                    -- Context Fingerprinting (Step 3)
                    issue_type TEXT,
                    urgency_level TEXT,
                    -- Noise Isolation (Step 4)
                    noise_score REAL DEFAULT 0.0,
                    -- Pattern Scope Control (Step 5)
                    user_segment TEXT,
                    product_area TEXT,
                    region TEXT,
                    -- SAFETY: Domain/Vertical Drift Control
                    product_version TEXT DEFAULT '1.0.0',
                    version_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes for fast lookups with VERTICAL
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_fingerprint 
                ON review_patterns(fingerprint)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_vertical_rating 
                ON review_patterns(vertical, rating, review_length)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_vertical_score 
                ON review_patterns(vertical, pattern_score DESC)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_vertical_category 
                ON review_patterns(vertical, pain_point_category, pattern_score DESC)
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception:
            pass  # Fail silently
    
    def _generate_fingerprint(self, content: str, rating: int, source: str = "unknown") -> str:
        """Generate unique fingerprint for a review."""
        # Normalize content
        normalized = content.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)  # Collapse whitespace
        
        # Create fingerprint
        unique_string = f"{source}:{rating}:{normalized}"
        return hashlib.md5(unique_string.encode()).hexdigest()
    
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate text similarity with fallback chain:
        1. Semantic embeddings (BEST - understands meaning)
        2. Enhanced pattern matcher (GOOD - multi-algorithm)
        3. Keyword matching (FALLBACK - basic but safe)
        """
        # Try semantic embeddings first (SMART)
        if self.use_embeddings and self.embedding_model is not None:
            try:
                # Generate embeddings (384-dimension vectors)
                embedding1 = self.embedding_model.encode(text1, convert_to_numpy=True)
                embedding2 = self.embedding_model.encode(text2, convert_to_numpy=True)
                
                # Calculate cosine similarity
                # Cosine similarity = dot product / (norm1 * norm2)
                dot_product = np.dot(embedding1, embedding2)
                norm1 = np.linalg.norm(embedding1)
                norm2 = np.linalg.norm(embedding2)
                
                if norm1 == 0 or norm2 == 0:
                    return 0.0
                
                cosine_similarity = dot_product / (norm1 * norm2)
                
                # Convert from [-1, 1] to [0, 1] range
                normalized_similarity = (cosine_similarity + 1) / 2
                
                return float(normalized_similarity)
                
            except Exception:
                pass  # Fall through to next method
        
        # Try enhanced pattern matcher (multi-algorithm)
        if self.enhanced_matcher is not None:
            try:
                return self.enhanced_matcher.calculate_similarity(text1, text2)
            except Exception:
                pass  # Fall through to keyword matching
        
        # Fallback: Keyword matching (BASIC but safe)
        def get_keywords(text):
            text = text.lower()
            # Remove punctuation and split
            words = re.findall(r'\b\w+\b', text)
            # Filter stop words and short words
            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'it', 'this', 'that'}
            return set(w for w in words if len(w) > 2 and w not in stop_words)
        
        keywords1 = get_keywords(text1)
        keywords2 = get_keywords(text2)
        
        if not keywords1 or not keywords2:
            return 0.0
        
        # Jaccard similarity
        intersection = len(keywords1 & keywords2)
        union = len(keywords1 | keywords2)
        
        return intersection / union if union > 0 else 0.0
    
    
    def find_exact_match(self, content: str, rating: int, source: str = "unknown", vertical: str = "global") -> Optional[CachedDecision]:
        """
        Find exact match by fingerprint (100% duplicate).
        NOW VERTICAL-AWARE: Only matches patterns from the same vertical.
        """
        try:
            fingerprint = self._generate_fingerprint(content, rating, source)
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # VERTICAL FILTER: Only match from same vertical
            cursor.execute('''
                SELECT * FROM review_patterns 
                WHERE fingerprint = ? AND vertical = ?
                LIMIT 1
            ''', (fingerprint, vertical))
            
            row = cursor.fetchone()
            
            if row:
                # Update usage count
                cursor.execute('''
                    UPDATE review_patterns 
                    SET usage_count = usage_count + 1,
                        last_used = CURRENT_TIMESTAMP
                    WHERE fingerprint = ?
                ''', (fingerprint,))
                conn.commit()
                
                self.cache_hits += 1
                self.llm_calls_saved += 1
                
                cached = CachedDecision(
                    fingerprint=row['fingerprint'],
                    sentiment=row['sentiment'],
                    sentiment_score=row['sentiment_score'],
                    confidence=row['confidence'],
                    churn_risk=row['churn_risk'],
                    pain_point_category=row['pain_point_category'],
                    issue=row['issue'],
                    similarity_score=1.0,
                    source_count=row['usage_count']
                )
                
                conn.close()
                return cached
            
            conn.close()
            return None
            
        except Exception:
            return None  # Fail silently
    
    def _filter_bad_precedents(self, candidates: List[sqlite3.Row]) -> List[sqlite3.Row]:
        """
        Filter out low-quality patterns (bad precedents).
        Removes patterns with:
        - Low confidence scores
        - Insufficient usage (untested patterns)
        - Stale patterns (pattern decay)
        - Invalid data
        """
        good_patterns = []
        current_time = datetime.now()
        
        for candidate in candidates:
            # Filter by confidence threshold
            if candidate['confidence'] < self.min_confidence:
                self.bad_precedents_filtered += 1
                continue
            
            # Filter by usage threshold (require proven patterns)
            if candidate['usage_count'] < self.min_usage_threshold:
                self.bad_precedents_filtered += 1
                continue
            
            # PATTERN DECAY: Check if pattern is stale
            try:
                last_used = candidate.get('last_used')
                if last_used:
                    if isinstance(last_used, str):
                        last_used_dt = datetime.fromisoformat(last_used.replace('Z', '+00:00'))
                    else:
                        last_used_dt = last_used
                    
                    days_since_use = (current_time - last_used_dt).days
                    if days_since_use > self.pattern_decay_days:
                        self.bad_precedents_filtered += 1
                        continue
            except Exception:
                # If we can't parse the date, skip decay check
                pass
            
            # Validate data integrity
            try:
                # Check sentiment is valid
                if candidate['sentiment'] not in ['positive', 'negative', 'neutral', 'mixed']:
                    self.bad_precedents_filtered += 1
                    continue
                
                # Check sentiment_score is in valid range
                if not (-1.0 <= candidate['sentiment_score'] <= 1.0):
                    self.bad_precedents_filtered += 1
                    continue
                
                # Check confidence is in valid range
                if not (0.0 <= candidate['confidence'] <= 1.0):
                    self.bad_precedents_filtered += 1
                    continue
                    
            except (TypeError, ValueError):
                self.bad_precedents_filtered += 1
                continue
            
            # Pattern passed all checks
            good_patterns.append(candidate)
        
        return good_patterns
    
    def _calculate_pattern_quality(self, candidate: sqlite3.Row) -> float:
        """
        Calculate overall quality score for outcome-based weighting.
        Higher quality patterns are prioritized.
        """
        confidence = candidate['confidence']
        usage_count = candidate['usage_count']
        
        # Confidence score (0.0 to 1.0)
        confidence_score = confidence
        
        # Usage score (capped at 10 uses for normalization)
        usage_score = min(usage_count / 10.0, 1.0)
        
        # Weighted quality (confidence is more important)
        quality = (confidence_score * 0.7) + (usage_score * 0.3)
        
        return quality
    
    def find_similar_patterns(self, content: str, rating: int, 
                            confidence_threshold: float = None,
                            vertical: str = "global") -> Optional[CachedDecision]:
        """
        Find similar reviews with proven decisions.
        NOW WITH:
        - VERTICAL ISOLATION: Filters by vertical with fallback to global
        - Bad precedent filtering (excludes low quality)
        - Outcome-based weighting (prioritizes successful patterns)
        - Enhanced similarity matching
        - Pattern decay (filters stale patterns)
        - Configurable retrieval threshold
        """
        # Use instance threshold if not provided
        if confidence_threshold is None:
            confidence_threshold = self.retrieval_confidence_threshold
        
        # LATENCY GUARD: Start timing
        import time
        start_time = time.time()
        used_global_fallback = False
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Find candidates with similar rating and length
            review_length = len(content)
            length_tolerance = 200  # ±200 chars
            rating_tolerance = 1    # ±1 star
            
            # STEP 4: FALLBACK LOGIC
            # Try vertical-specific patterns first
            cursor.execute('''
                SELECT * FROM review_patterns
                WHERE vertical = ?
                AND rating BETWEEN ? AND ?
                AND review_length BETWEEN ? AND ?
                ORDER BY pattern_score DESC, usage_count DESC
                LIMIT 50
            ''', (
                vertical,
                max(1, rating - rating_tolerance),
                min(5, rating + rating_tolerance),
                max(0, review_length - length_tolerance),
                review_length + length_tolerance
            ))
            
            candidates = cursor.fetchall()
            
            # FALLBACK: If no vertical patterns, try global patterns
            if not candidates and vertical != 'global':
                used_global_fallback = True
                cursor.execute('''
                    SELECT * FROM review_patterns
                    WHERE vertical = 'global'
                    AND rating BETWEEN ? AND ?
                    AND review_length BETWEEN ? AND ?
                    ORDER BY pattern_score DESC, usage_count DESC
                    LIMIT 50
                ''', (
                    max(1, rating - rating_tolerance),
                    min(5, rating + rating_tolerance),
                    max(0, review_length - length_tolerance),
                    review_length + length_tolerance
                ))
                candidates = cursor.fetchall()
            
            conn.close()
            
            if not candidates:
                return None
            
            # FILTER BAD PRECEDENTS
            good_candidates = self._filter_bad_precedents(candidates)
            
            if not good_candidates:
                return None
            
            # Calculate similarity and quality for each candidate
            scored_matches = []
            debug_info = []  # CG DEBUG MODE: Store match details
            
            for candidate in good_candidates:
                # Calculate similarity
                similarity = self._calculate_similarity(content, candidate['issue'] or "")
                
                # === STRUCTURAL FINGERPRINT MATCHING (Feature 9) ===
                # Boost similarity if structural fingerprints match
                structural_bonus = 0.0
                if candidate.get('issue_type') and candidate.get('pain_point_category'):
                    # Same category = bonus
                    structural_bonus = 0.1
                
                effective_similarity = min(1.0, similarity + structural_bonus)
                
                if effective_similarity >= confidence_threshold:
                    # === OUTCOME-BASED WEIGHTING ===
                    quality = self._calculate_pattern_quality(candidate)
                    
                    # === COLD-START BIAS CONTROL (Feature 10) ===
                    influence_weight = self.calculate_influence_weight(candidate['usage_count'] or 1)
                    
                    # === PATTERN DRIFT HANDLING (Feature 2) ===
                    # Version decay: reduce score if pattern is from old version
                    version_factor = 1.0
                    if candidate.get('product_version') and candidate['product_version'] != self.current_product_version:
                        version_factor = 0.7  # 30% penalty for version mismatch
                    
                    # === RECENCY FACTOR (Feature 6) ===
                    recency_factor = 1.0
                    try:
                        if candidate.get('last_used'):
                            from datetime import datetime
                            last_used = datetime.fromisoformat(str(candidate['last_used']))
                            days_old = (datetime.now() - last_used).days
                            if days_old > 30:
                                recency_factor = max(0.5, 1.0 - (days_old - 30) / 180)  # Decay over 180 days
                    except Exception:
                        pass
                    
                    # === STRONG NOISE PENALTY (Feature 4) ===
                    noise_penalty = 1.0 - (candidate.get('noise_score') or 0.0)
                    
                    # === CONFIDENCE BACKOFF (Feature 7) ===
                    conf = candidate.get('confidence') or 0.5
                    confidence_factor = 1.0 if conf >= 0.6 else (conf / 0.6)
                    
                    # === STABILITY FACTOR ===
                    stability = candidate.get('stability_score') or 0.5
                    
                    # === MULTI-FACTOR RETRIEVAL RANKING (Feature 6) ===
                    # final_score = similarity * pattern_score * recency * stability * noise * confidence * version
                    weighted_score = (
                        effective_similarity *
                        quality *
                        influence_weight *
                        recency_factor *
                        stability *
                        noise_penalty *
                        confidence_factor *
                        version_factor
                    )
                    
                    match_data = {
                        'candidate': candidate,
                        'similarity': effective_similarity,
                        'quality': quality,
                        'influence': influence_weight,
                        'recency': recency_factor,
                        'noise_penalty': noise_penalty,
                        'confidence_factor': confidence_factor,
                        'version_factor': version_factor,
                        'stability': stability,
                        'weighted_score': weighted_score
                    }
                    scored_matches.append(match_data)
                    
                    # CG DEBUG MODE: Store for debugging
                    debug_info.append({
                        'pattern_id': candidate.get('id'),
                        'issue': candidate.get('issue', '')[:50],
                        'similarity': round(effective_similarity, 3),
                        'final_score': round(weighted_score, 4),
                        'factors': {
                            'quality': round(quality, 3),
                            'influence': round(influence_weight, 3),
                            'recency': round(recency_factor, 3),
                            'noise': round(noise_penalty, 3),
                            'confidence': round(confidence_factor, 3),
                            'version': round(version_factor, 3),
                            'stability': round(stability, 3)
                        }
                    })
                else:
                    # Track rejections for observability
                    self.similarity_rejections += 1
            
            if not scored_matches:
                return None
            
            # Sort by weighted score (best patterns first)
            scored_matches.sort(key=lambda x: x['weighted_score'], reverse=True)
            
            # === CATEGORY MISMATCH GUARD (Feature 5) ===
            # If top match has high similarity but mismatched category, prefer lower-ranked same-category match
            best = scored_matches[0]
            
            # Get best match
            best_match = best['candidate']
            best_similarity = best['similarity']
            
            self.cache_hits += 1
            self.llm_calls_saved += 1
            
            # VERTICAL AUDIT: Track which type of match was used
            if used_global_fallback:
                self.global_fallback_uses += 1
            else:
                self.vertical_matches += 1
            
            # LATENCY GUARD: Record timing
            elapsed_ms = (time.time() - start_time) * 1000
            self.total_retrieval_time_ms += elapsed_ms
            self.retrieval_count += 1
            
            # CG DEBUG MODE (Feature 15): Store last match debug info
            self._last_match_debug = {
                'best_pattern_id': best_match.get('id'),
                'best_score': best['weighted_score'],
                'candidates_evaluated': len(good_candidates),
                'matches_found': len(scored_matches),
                'top_3_matches': debug_info[:3] if debug_info else [],
                'used_global_fallback': used_global_fallback,
                'latency_ms': round(elapsed_ms, 2)
            }
            
            return CachedDecision(
                fingerprint=best_match['fingerprint'],
                sentiment=best_match['sentiment'],
                sentiment_score=best_match['sentiment_score'],
                confidence=best_match['confidence'] * best_similarity,  # Adjust confidence by similarity
                churn_risk=best_match['churn_risk'],
                pain_point_category=best_match['pain_point_category'],
                issue=best_match['issue'],
                similarity_score=best_similarity,
                source_count=best_match['usage_count']
            )
            
        except Exception as e:
            # JSON parsing and other errors are silently caught
            return None
    
    def get_last_match_debug(self) -> Dict[str, Any]:
        """CG DEBUG MODE (Feature 15): Get debug info for last pattern match."""
        return getattr(self, '_last_match_debug', {})
    
    def save_pattern(self, content: str, rating: int, llm_result: Dict[str, Any], 
                    source: str = "unknown", vertical: str = "global") -> bool:
        """
        Save successful LLM decision as a reusable pattern.
        NOW WITH:
        - VERTICAL AWARENESS: Stores pattern under specific vertical
        - DEDUPLICATION: Checks for near-duplicates within same vertical
        """
        try:
            fingerprint = self._generate_fingerprint(content, rating, source)
            content_hash = hashlib.md5(content.encode()).hexdigest()
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # DEDUPLICATION: Check within same vertical
            cursor.execute('''
                SELECT id, fingerprint FROM review_patterns
                WHERE vertical = ? AND (content_hash = ? OR fingerprint = ?)
                LIMIT 1
            ''', (vertical, content_hash, fingerprint))
            
            existing = cursor.fetchone()
            
            if existing:
                # Pattern already exists - update usage instead of inserting duplicate
                cursor.execute('''
                    UPDATE review_patterns
                    SET usage_count = usage_count + 1,
                        last_used = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (existing['id'],))
                conn.commit()
                conn.close()
                self.duplicates_prevented += 1
                return True
            
            # Safe JSON extraction with validation
            try:
                sentiment = str(llm_result.get('sentiment', 'neutral'))
                if sentiment not in ['positive', 'negative', 'neutral', 'mixed']:
                    sentiment = 'neutral'
                
                sentiment_score = float(llm_result.get('sentiment_score', 0.0))
                sentiment_score = max(-1.0, min(1.0, sentiment_score))  # Clamp to valid range
                
                confidence = float(llm_result.get('confidence', 0.5))
                confidence = max(0.0, min(1.0, confidence))  # Clamp to valid range
                
                churn_risk = str(llm_result.get('churn_risk', 'null'))
                pain_point_category = str(llm_result.get('pain_point_category', 'Other'))
                issue = str(llm_result.get('issue', 'N/A'))
                
            except (ValueError, TypeError):
                # Invalid data - use safe defaults
                conn.close()
                return False
            
            # Get intelligence features if available
            intel = self._get_intelligence()
            noise_score = 0.0
            issue_type = None
            urgency_level = None
            user_segment = None
            product_area = None
            region = None
            pattern_score = confidence  # Initial score = confidence
            
            if intel:
                try:
                    # Calculate noise score
                    review_data = {'content': content, 'rating': rating}
                    noise_score = intel.calculate_noise_score(review_data, llm_result)
                    
                    # Extract context fingerprint
                    fp = intel.extract_context_fingerprint(llm_result)
                    issue_type = fp.issue_type
                    urgency_level = fp.urgency_level
                    
                    # Determine scope
                    scope = intel.determine_pattern_scope(review_data)
                    user_segment = scope.get('user_segment')
                    product_area = scope.get('product_area')
                    region = scope.get('region')
                except Exception:
                    pass  # Use defaults on error
            
            # Insert new pattern with intelligence features + VERTICAL
            cursor.execute('''
                INSERT INTO review_patterns
                (fingerprint, vertical, source_name, content_hash, rating, review_length,
                 sentiment, sentiment_score, confidence, churn_risk, 
                 pain_point_category, issue,
                 pattern_score, noise_score, issue_type, urgency_level,
                 user_segment, product_area, region)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                fingerprint,
                vertical,
                source,
                content_hash,
                rating,
                len(content),
                sentiment,
                sentiment_score,
                confidence,
                churn_risk,
                pain_point_category,
                issue,
                pattern_score,
                noise_score,
                issue_type,
                urgency_level,
                user_segment,
                product_area,
                region
            ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception:
            return False  # Fail silently
    
    # ========== PUBLIC MAINTENANCE METHODS ==========
    
    def auto_merge_similar_patterns(self, similarity_threshold: float = 0.9, vertical: str = None) -> int:
        """
        Automatically merge very similar patterns.
        VERTICAL-AWARE: Only merges patterns within same vertical.
        Returns number of patterns merged.
        """
        intel = self._get_intelligence()
        if not intel:
            return 0
        
        try:
            mergeable = intel.find_mergeable_patterns(similarity_threshold)
            merged_count = 0
            
            for keep_id, merge_id, similarity in mergeable:
                if intel.merge_patterns(keep_id, merge_id):
                    merged_count += 1
                    self.patterns_merged += 1
            
            return merged_count
        except Exception:
            return 0
    
    def enforce_pattern_limits(self, max_per_category: int = 100, vertical: str = None) -> int:
        """
        Enforce memory size limits by pruning lowest-scoring patterns.
        VERTICAL-AWARE: Limits are per category per vertical.
        Returns number of patterns pruned.
        """
        intel = self._get_intelligence()
        if not intel:
            return 0
        
        try:
            pruned = intel.enforce_memory_limits(max_per_category)
            self.patterns_cleaned += pruned
            return pruned
        except Exception:
            return 0
    
    def update_pattern_scores(self) -> int:
        """
        Recalculate pattern scores for all patterns.
        Returns number of patterns updated.
        """
        intel = self._get_intelligence()
        if not intel:
            return 0
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Get all patterns
            cursor.execute('SELECT * FROM review_patterns')
            patterns = cursor.fetchall()
            
            updated = 0
            for pattern in patterns:
                # Calculate new score
                new_score = intel.calculate_pattern_score(pattern)
                
                # Update in database
                cursor.execute('''
                    UPDATE review_patterns
                    SET pattern_score = ?
                    WHERE id = ?
                ''', (new_score, pattern['id']))
                
                updated += 1
            
            conn.commit()
            conn.close()
            return updated
            
        except Exception:
            return 0
    
    def cleanup_stale_patterns(self, days_threshold: int = None, vertical: str = None) -> int:
        """
        Clean up stale patterns that haven't been used in a while.
        VERTICAL-AWARE: Only cleans patterns from specified vertical.
        Returns number of patterns deleted.
        """
        if days_threshold is None:
            days_threshold = self.pattern_decay_days
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # STEP 5: Delete patterns older than threshold (respect vertical)
            if vertical:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE vertical = ? AND julianday('now') - julianday(last_used) > ?
                ''', (vertical, days_threshold))
            else:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE julianday('now') - julianday(last_used) > ?
                ''', (days_threshold,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            self.patterns_cleaned += deleted_count
            return deleted_count
            
        except Exception:
            return 0  # Fail silently
    
    def cleanup_low_quality_patterns(self, min_confidence: float = None, vertical: str = None) -> int:
        """
        Remove patterns that have proven to be low quality.
        VERTICAL-AWARE: Only cleans patterns from specified vertical.
        Returns number of patterns deleted.
        """
        if min_confidence is None:
            min_confidence = self.min_confidence
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Delete low confidence patterns (respect vertical)
            if vertical:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE vertical = ? AND confidence < ? AND usage_count < 3
                ''', (vertical, min_confidence))
            else:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE confidence < ? AND usage_count < 3
                ''', (min_confidence,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            self.patterns_cleaned += deleted_count
            return deleted_count
            
        except Exception:
            return 0  # Fail silently
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics with advanced intelligence metrics."""
        total_queries = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_queries * 100) if total_queries > 0 else 0
        
        return {
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'total_queries': total_queries,
            'hit_rate': hit_rate,
            'llm_calls_saved': self.llm_calls_saved,
            'bad_precedents_filtered': self.bad_precedents_filtered,
            'duplicates_prevented': self.duplicates_prevented,
            'patterns_cleaned': self.patterns_cleaned,
            'patterns_merged': self.patterns_merged,
            'retrieval_threshold': self.retrieval_confidence_threshold,
            'pattern_decay_days': self.pattern_decay_days,
            'semantic_embeddings_enabled': self.use_embeddings,
            'pattern_intelligence_enabled': self.pattern_intelligence is not None
        }
    
    # ========== SAFETY CONTROLS ==========
    
    # 1) Domain/Vertical Drift Control
    def set_product_version(self, version: str):
        """Set current product version. Patterns created under old versions may be invalidated."""
        self.current_product_version = version
    
    def invalidate_old_version_patterns(self, old_version: str, vertical: str = None) -> int:
        """
        Invalidate patterns from old product versions.
        Use when product changes significantly and old patterns may be invalid.
        Returns number of patterns invalidated (deleted).
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            if vertical:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE product_version = ? AND vertical = ?
                ''', (old_version, vertical))
            else:
                cursor.execute('''
                    DELETE FROM review_patterns
                    WHERE product_version = ?
                ''', (old_version,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            self.patterns_cleaned += deleted_count
            return deleted_count
            
        except Exception:
            return 0
    
    # 2) Cold-Start Bias Control
    def calculate_influence_weight(self, usage_count: int) -> float:
        """
        Calculate pattern influence weight based on usage.
        New patterns have reduced influence until they prove themselves.
        Returns weight from 0.2 (new) to 1.0 (proven).
        """
        if usage_count >= self.cold_start_usage_cap:
            return 1.0  # Full influence
        
        # Gradual increase: 0.2 + (0.8 * usage / cap)
        base_weight = 0.2
        growth = 0.8 * (usage_count / self.cold_start_usage_cap)
        return min(1.0, base_weight + growth)
    
    def should_explore_new_pattern(self) -> bool:
        """
        Decide whether to explore (try new patterns) vs exploit (use proven ones).
        Returns True if should try less-used patterns.
        """
        import random
        return random.random() < self.exploration_weight
    
    # 3) Retrieval Latency Guard
    def get_average_latency_ms(self) -> float:
        """Get average retrieval latency in milliseconds."""
        if self.retrieval_count == 0:
            return 0.0
        return self.total_retrieval_time_ms / self.retrieval_count
    
    def check_latency_health(self) -> Dict[str, Any]:
        """
        Check if retrieval latency is healthy.
        Returns status and recommendations.
        """
        avg_latency = self.get_average_latency_ms()
        
        status = "healthy"
        recommendations = []
        
        if avg_latency > self.latency_threshold_ms:
            status = "warning"
            recommendations.append("Consider adding vector indexes")
            recommendations.append("Implement approximate nearest neighbor search")
            recommendations.append("Add result caching layer")
        
        if avg_latency > self.latency_threshold_ms * 3:
            status = "critical"
            recommendations.append("URGENT: Latency severely impacting performance")
        
        return {
            'status': status,
            'average_latency_ms': avg_latency,
            'threshold_ms': self.latency_threshold_ms,
            'total_retrievals': self.retrieval_count,
            'recommendations': recommendations
        }
    
    # 4) Memory Health Observability
    def get_health_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive memory health metrics.
        Use for monitoring degradation.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Pattern counts
            cursor.execute('SELECT COUNT(*) FROM review_patterns')
            total_patterns = cursor.fetchone()[0]
            
            # Average usage
            cursor.execute('SELECT AVG(usage_count) FROM review_patterns')
            avg_usage = cursor.fetchone()[0] or 0
            
            # Average confidence
            cursor.execute('SELECT AVG(confidence) FROM review_patterns')
            avg_confidence = cursor.fetchone()[0] or 0
            
            # Low quality patterns (confidence < threshold)
            cursor.execute('SELECT COUNT(*) FROM review_patterns WHERE confidence < ?', 
                          (self.min_confidence,))
            low_quality_count = cursor.fetchone()[0]
            
            # Stale patterns (not used in 30+ days)
            cursor.execute('''
                SELECT COUNT(*) FROM review_patterns 
                WHERE julianday('now') - julianday(last_used) > 30
            ''')
            stale_count = cursor.fetchone()[0]
            
            # Patterns by vertical
            cursor.execute('''
                SELECT vertical, COUNT(*) as count 
                FROM review_patterns 
                GROUP BY vertical
            ''')
            verticals = {row['vertical']: row['count'] for row in cursor.fetchall()}
            
            conn.close()
            
            # Calculate rates
            total_queries = self.cache_hits + self.cache_misses
            reuse_rate = (self.cache_hits / total_queries * 100) if total_queries > 0 else 0
            rejection_rate = (self.similarity_rejections / total_queries * 100) if total_queries > 0 else 0
            
            return {
                'total_patterns': total_patterns,
                'average_usage': round(avg_usage, 2),
                'average_confidence': round(avg_confidence, 3),
                'low_quality_patterns': low_quality_count,
                'stale_patterns': stale_count,
                'patterns_by_vertical': verticals,
                'pattern_reuse_rate': round(reuse_rate, 2),
                'similarity_rejection_rate': round(rejection_rate, 2),
                'patterns_merged': self.patterns_merged,
                'patterns_cleaned': self.patterns_cleaned,
                'latency': self.check_latency_health()
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    # 5) Cross-Vertical Leakage Audits
    def audit_vertical_isolation(self) -> Dict[str, Any]:
        """
        Audit vertical isolation to detect cross-vertical contamination.
        Returns audit report with any issues found.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            issues = []
            
            # Check 1: Global fallback rate
            total_matches = self.vertical_matches + self.global_fallback_uses
            global_fallback_rate = 0
            if total_matches > 0:
                global_fallback_rate = (self.global_fallback_uses / total_matches) * 100
            
            if global_fallback_rate > 50:
                issues.append({
                    'type': 'high_global_fallback',
                    'severity': 'warning',
                    'message': f'Global fallback rate is {global_fallback_rate:.1f}% - verticals may need more patterns'
                })
            
            # Check 2: Patterns per vertical distribution
            cursor.execute('''
                SELECT vertical, COUNT(*) as count 
                FROM review_patterns 
                GROUP BY vertical
                ORDER BY count DESC
            ''')
            verticals = cursor.fetchall()
            
            if len(verticals) > 1:
                max_count = verticals[0]['count']
                for v in verticals[1:]:
                    if v['count'] < max_count * 0.1 and v['vertical'] != 'global':
                        issues.append({
                            'type': 'imbalanced_verticals',
                            'severity': 'info',
                            'message': f"Vertical '{v['vertical']}' has very few patterns ({v['count']})"
                        })
            
            # Check 3: Patterns with NULL vertical (leakage risk)
            cursor.execute('SELECT COUNT(*) FROM review_patterns WHERE vertical IS NULL')
            null_vertical = cursor.fetchone()[0]
            
            if null_vertical > 0:
                issues.append({
                    'type': 'null_vertical_patterns',
                    'severity': 'error',
                    'message': f'{null_vertical} patterns have NULL vertical - potential leakage'
                })
            
            conn.close()
            
            return {
                'status': 'pass' if len(issues) == 0 else 'issues_found',
                'global_fallback_rate': round(global_fallback_rate, 2),
                'vertical_matches': self.vertical_matches,
                'global_fallback_uses': self.global_fallback_uses,
                'issues': issues,
                'recommendation': 'Run periodic audits and monitor global_fallback_rate'
            }
            
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def reset_audit_counters(self):
        """Reset audit counters for fresh measurement period."""
        self.vertical_matches = 0
        self.global_fallback_uses = 0
        self.similarity_rejections = 0
    
    # ========== SPRINT BLOCK 5: OBSERVABILITY ==========
    
    # Feature 14: Memory Health Score
    def get_memory_health_score(self) -> Dict[str, Any]:
        """
        Calculate single health score for CG quality.
        health = reuse_rate * stability * freshness
        Returns score from 0 (critical) to 100 (excellent).
        """
        try:
            metrics = self.get_health_metrics()
            
            if 'error' in metrics:
                return {'score': 0, 'status': 'error', 'error': metrics['error']}
            
            # Reuse rate component (0-1)
            reuse_rate = min(1.0, metrics.get('pattern_reuse_rate', 0) / 100)
            
            # Stability component (based on avg confidence)
            stability = metrics.get('average_confidence', 0.5)
            
            # Freshness component (inverse of stale ratio)
            total = metrics.get('total_patterns', 1)
            stale = metrics.get('stale_patterns', 0)
            freshness = 1.0 - (stale / max(1, total))
            
            # Quality component (inverse of low quality ratio)
            low_quality = metrics.get('low_quality_patterns', 0)
            quality = 1.0 - (low_quality / max(1, total))
            
            # Latency health
            latency_status = metrics.get('latency', {}).get('status', 'healthy')
            latency_factor = 1.0 if latency_status == 'healthy' else (0.8 if latency_status == 'warning' else 0.5)
            
            # Combined health score
            health_score = (
                reuse_rate * 0.25 +
                stability * 0.25 +
                freshness * 0.20 +
                quality * 0.20 +
                latency_factor * 0.10
            ) * 100
            
            # Determine status
            if health_score >= 80:
                status = 'excellent'
            elif health_score >= 60:
                status = 'good'
            elif health_score >= 40:
                status = 'fair'
            elif health_score >= 20:
                status = 'poor'
            else:
                status = 'critical'
            
            return {
                'score': round(health_score, 1),
                'status': status,
                'components': {
                    'reuse_rate': round(reuse_rate * 100, 1),
                    'stability': round(stability * 100, 1),
                    'freshness': round(freshness * 100, 1),
                    'quality': round(quality * 100, 1),
                    'latency_factor': round(latency_factor * 100, 1)
                }
            }
            
        except Exception as e:
            return {'score': 0, 'status': 'error', 'error': str(e)}
    
    # Feature 12: Memory Cleanup Automation
    def run_automated_cleanup(self, vertical: str = None) -> Dict[str, int]:
        """
        Run full automated cleanup cycle.
        Performs: stale cleanup, low quality cleanup, pattern merging, limit enforcement.
        Returns count of actions taken.
        """
        results = {
            'stale_removed': 0,
            'low_quality_removed': 0,
            'patterns_merged': 0,
            'patterns_pruned': 0
        }
        
        try:
            # 1. Cleanup stale patterns
            results['stale_removed'] = self.cleanup_stale_patterns(vertical=vertical)
            
            # 2. Cleanup low quality patterns
            results['low_quality_removed'] = self.cleanup_low_quality_patterns(vertical=vertical)
            
            # 3. Auto-merge similar patterns
            results['patterns_merged'] = self.auto_merge_similar_patterns(vertical=vertical)
            
            # 4. Enforce pattern limits
            results['patterns_pruned'] = self.enforce_pattern_limits(vertical=vertical)
            
        except Exception:
            pass  # Continue silently
        
        return results
    
    # ========== SPRINT BLOCK 6: FUTURE-PROOFING ==========
    
    # Feature 17: Pattern Versioning
    def create_pattern_version(self, pattern_id: int, new_data: Dict[str, Any]) -> bool:
        """
        Create new version of a pattern while preserving history.
        Allows safe updates without losing original pattern.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Get current pattern
            cursor.execute('SELECT * FROM review_patterns WHERE id = ?', (pattern_id,))
            existing = cursor.fetchone()
            
            if not existing:
                conn.close()
                return False
            
            # Update with new data while incrementing version
            current_version = existing.get('product_version') or '1.0.0'
            try:
                major, minor, patch = current_version.split('.')
                new_version = f"{major}.{minor}.{int(patch) + 1}"
            except Exception:
                new_version = '1.0.1'
            
            # Update pattern with new version
            update_fields = []
            update_values = []
            
            for key in ['sentiment', 'confidence', 'issue', 'pain_point_category']:
                if key in new_data:
                    update_fields.append(f"{key} = ?")
                    update_values.append(new_data[key])
            
            if update_fields:
                update_fields.append("product_version = ?")
                update_values.append(new_version)
                update_values.append(pattern_id)
                
                cursor.execute(f'''
                    UPDATE review_patterns 
                    SET {", ".join(update_fields)}
                    WHERE id = ?
                ''', update_values)
                
                conn.commit()
            
            conn.close()
            return True
            
        except Exception:
            return False
    
    def get_pattern_history(self, fingerprint: str) -> List[Dict[str, Any]]:
        """
        Get version history for a pattern by fingerprint.
        Returns list of versions with timestamps.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, fingerprint, product_version, created_at, 
                       version_created_at, usage_count, confidence
                FROM review_patterns
                WHERE fingerprint = ?
                ORDER BY version_created_at DESC
            ''', (fingerprint,))
            
            history = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            return history
            
        except Exception:
            return []
    
    # Feature 5: Category Mismatch Detection (helper)
    def detect_category_mismatch(self, expected_category: str, candidate_category: str) -> bool:
        """
        Detect if categories are mismatched in a way that would cause confusion.
        Returns True if mismatch is significant.
        """
        # Categories that should never match each other
        incompatible_pairs = [
            ('Billing', 'Bug'),
            ('Billing', 'UX'),
            ('Feature', 'Support'),
            ('Bug', 'Value')
        ]
        
        for cat1, cat2 in incompatible_pairs:
            if (expected_category == cat1 and candidate_category == cat2) or \
               (expected_category == cat2 and candidate_category == cat1):
                return True
        
        return False
