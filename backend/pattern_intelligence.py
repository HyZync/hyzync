"""
Advanced Pattern Intelligence Module
Implements smart pattern management for Context Graph
"""

import sqlite3
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass


@dataclass
class ContextFingerprint:
    """Structural fingerprint for pattern matching (Step 3)"""
    issue_type: str
    sentiment: str
    urgency_level: str
    category: str
    
    def to_dict(self) -> Dict[str, str]:
        return {
            'issue_type': self.issue_type,
            'sentiment': self.sentiment,
            'urgency_level': self.urgency_level,
            'category': self.category
        }
    
    def similarity(self, other: 'ContextFingerprint') -> float:
        """Calculate structural similarity (0.0 to 1.0)"""
        matches = 0
        total = 4
        
        if self.issue_type == other.issue_type:
            matches += 1
        if self.sentiment == other.sentiment:
            matches += 1
        if self.urgency_level == other.urgency_level:
            matches += 1
        if self.category == other.category:
            matches += 1
        
        return matches / total


class PatternIntelligence:
    """Advanced pattern intelligence features for Context Graph"""
    
    def __init__(self, db_connection: sqlite3.Connection):
        self.conn = db_connection
        self.conn.row_factory = sqlite3.Row
    
    # ========== STEP 1: PATTERN WEIGHT EVOLUTION ==========
    
    def calculate_pattern_score(self, pattern: sqlite3.Row) -> float:
        """
        Calculate evolved pattern score based on multiple factors.
        
        pattern_score = confidence * usage_weight * recency_weight * stability_weight
        """
        try:
            # Base confidence
            confidence = float(pattern.get('confidence', 0.5))
            
            # Usage weight: patterns reused often score higher
            usage_count = int(pattern.get('usage_count', 1))
            usage_weight = min(1.0, usage_count / 10.0)  # Normalize to 1.0 at 10 uses
            
            # Recency weight: recent matches score higher
            try:
                last_used_str = pattern.get('last_used')
                if last_used_str:
                    if isinstance(last_used_str, str):
                        last_used = datetime.fromisoformat(last_used_str.replace('Z', '+00:00'))
                    else:
                        last_used = last_used_str
                    
                    days_old = (datetime.now() - last_used).days
                    recency_weight = max(0.3, 1.0 - (days_old / 90.0))  # Decays over 90 days, min 0.3
                else:
                    recency_weight = 0.5
            except Exception:
                recency_weight = 0.5
            
            # Stability weight: consistent outcomes score higher
            stability_score = float(pattern.get('stability_score', 0.5))
            
            # Combined score
            pattern_score = confidence * usage_weight * recency_weight * stability_score
            
            return max(0.0, min(1.0, pattern_score))  # Clamp to [0, 1]
            
        except Exception:
            return 0.5  # Safe default
    
    def update_pattern_stability(self, pattern_id: int, outcome_similar: bool):
        """
        Update stability score based on match outcome.
        Stable patterns have consistent outcomes.
        """
        try:
            cursor = self.conn.cursor()
            
            # Get current outcomes
            cursor.execute('SELECT match_outcomes, stability_score FROM review_patterns WHERE id = ?', (pattern_id,))
            row = cursor.fetchone()
            
            if not row:
                return
            
            # Parse outcomes (JSON array of booleans)
            try:
                outcomes = json.loads(row['match_outcomes'] or '[]')
            except json.JSONDecodeError:
                outcomes = []
            
            # Add new outcome
            outcomes.append(1 if outcome_similar else 0)
            
            # Keep last 20 outcomes
            outcomes = outcomes[-20:]
            
            # Calculate stability (percentage of similar outcomes)
            if outcomes:
                stability = sum(outcomes) / len(outcomes)
            else:
                stability = 0.5
            
            # Update database
            cursor.execute('''
                UPDATE review_patterns
                SET match_outcomes = ?,
                    stability_score = ?
                WHERE id = ?
            ''', (json.dumps(outcomes), stability, pattern_id))
            
            self.conn.commit()
            
        except Exception:
            pass  # Fail silently
    
    # ========== STEP 2: PATTERN MERGE INTELLIGENCE ==========
    
    def find_mergeable_patterns(self, similarity_threshold: float = 0.9) -> List[Tuple[int, int, float]]:
        """
        Find patterns that should be merged (similarity > threshold).
        Returns list of (id1, id2, similarity) tuples.
        """
        try:
            cursor = self.conn.cursor()
            
            # Get all patterns
            cursor.execute('''
                SELECT id, issue, pain_point_category, sentiment 
                FROM review_patterns 
                WHERE issue IS NOT NULL AND issue != ''
                ORDER BY usage_count DESC
                LIMIT 200
            ''')
            
            patterns = cursor.fetchall()
            mergeable = []
            
            # Compare all pairs
            for i in range(len(patterns)):
                for j in range(i + 1, len(patterns)):
                    p1, p2 = patterns[i], patterns[j]
                    
                    # Quick category filter
                    if p1['pain_point_category'] != p2['pain_point_category']:
                        continue
                    if p1['sentiment'] != p2['sentiment']:
                        continue
                    
                    # Calculate text similarity
                    similarity = self._text_similarity(p1['issue'], p2['issue'])
                    
                    if similarity >= similarity_threshold:
                        mergeable.append((p1['id'], p2['id'], similarity))
            
            return mergeable
            
        except Exception:
            return []
    
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Simple text similarity for merge detection"""
        try:
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            if not words1 or not words2:
                return 0.0
            
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            
            return intersection / union if union > 0 else 0.0
        except Exception:
            return 0.0
    
    def merge_patterns(self, keep_id: int, merge_id: int):
        """
        Merge two patterns: combine evidence, increase usage.
        keep_id gets the combined pattern, merge_id is deleted.
        """
        try:
            cursor = self.conn.cursor()
            
            # Get both patterns
            cursor.execute('SELECT * FROM review_patterns WHERE id IN (?, ?)', (keep_id, merge_id))
            patterns = cursor.fetchall()
            
            if len(patterns) != 2:
                return False
            
            keep_pattern = [p for p in patterns if p['id'] == keep_id][0]
            merge_pattern = [p for p in patterns if p['id'] == merge_id][0]
            
            # Combine usage counts
            combined_usage = keep_pattern['usage_count'] + merge_pattern['usage_count']
            
            # Average confidence (weighted by usage)
            total_usage = combined_usage
            weighted_conf = (
                (keep_pattern['confidence'] * keep_pattern['usage_count']) +
                (merge_pattern['confidence'] * merge_pattern['usage_count'])
            ) / total_usage
            
            # Use most recent last_used
            keep_time = datetime.fromisoformat(str(keep_pattern['last_used']).replace('Z', '+00:00'))
            merge_time = datetime.fromisoformat(str(merge_pattern['last_used']).replace('Z', '+00:00'))
            latest_used = max(keep_time, merge_time)
            
            # Update keep pattern
            cursor.execute('''
                UPDATE review_patterns
                SET usage_count = ?,
                    confidence = ?,
                    last_used = ?
                WHERE id = ?
            ''', (combined_usage, weighted_conf, latest_used.isoformat(), keep_id))
            
            # Delete merge pattern
            cursor.execute('DELETE FROM review_patterns WHERE id = ?', (merge_id,))
            
            self.conn.commit()
            return True
            
        except Exception:
            return False
    
    # ========== STEP 3: CONTEXT FINGERPRINTING ==========
    
    def extract_context_fingerprint(self, llm_result: Dict[str, Any]) -> ContextFingerprint:
        """
        Extract structural context fingerprint from LLM result.
        Better than pure text comparison.
        """
        try:
            # Determine issue type from pain point category
            category = llm_result.get('pain_point_category', 'Other')
            issue_type = self._categorize_issue_type(category)
            
            # Get sentiment
            sentiment = llm_result.get('sentiment', 'neutral')
            
            # Determine urgency from churn risk
            churn = llm_result.get('churn_risk', 'null')
            urgency = 'high' if churn in ['high', 'critical'] else 'medium' if churn == 'medium' else 'low'
            
            return ContextFingerprint(
                issue_type=issue_type,
                sentiment=sentiment,
                urgency_level=urgency,
                category=category
            )
        except Exception:
            return ContextFingerprint('unknown', 'neutral', 'low', 'Other')
    
    def _categorize_issue_type(self, category: str) -> str:
        """Map pain point category to broader issue type"""
        category_lower = category.lower()
        
        if any(word in category_lower for word in ['bug', 'crash', 'error', 'broken']):
            return 'technical'
        elif any(word in category_lower for word in ['payment', 'billing', 'charge', 'refund']):
            return 'financial'
        elif any(word in category_lower for word in ['feature', 'missing', 'request']):
            return 'feature_request'
        elif any(word in category_lower for word in ['slow', 'performance', 'speed']):
            return 'performance'
        elif any(word in category_lower for word in ['support', 'help', 'service']):
            return 'support'
        else:
            return 'general'
    
    # ========== STEP 4: NOISE ISOLATION ==========
    
    def calculate_noise_score(self, review_data: Dict[str, Any], llm_result: Dict[str, Any]) -> float:
        """
        Calculate noise score (0.0 = clean, 1.0 = noisy).
        Reduces influence of garbage reviews.
        """
        noise_indicators = 0
        total_checks = 0
        
        try:
            # Check 1: Rating vs Sentiment mismatch
            rating = review_data.get('rating', 3)
            sentiment = llm_result.get('sentiment', 'neutral')
            sentiment_score = llm_result.get('sentiment_score', 0.0)
            
            # High rating but negative sentiment = noise
            if rating >= 4 and sentiment == 'negative':
                noise_indicators += 1
            # Low rating but positive sentiment = noise
            elif rating <= 2 and sentiment == 'positive':
                noise_indicators += 1
            total_checks += 1
            
            # Check 2: Very low confidence = unclear/noisy
            confidence = llm_result.get('confidence', 0.5)
            if confidence < 0.3:
                noise_indicators += 1
            total_checks += 1
            
            # Check 3: Review too short (likely not useful)
            content = review_data.get('content', '')
            if len(content) < 20:
                noise_indicators += 1
            total_checks += 1
            
            # Check 4: Extreme sentiment score mismatch
            expected_score = (rating - 3) / 2.0  # Map 1-5 rating to -1 to 1
            if abs(sentiment_score - expected_score) > 1.0:
                noise_indicators += 1
            total_checks += 1
            
            # Calculate final noise score
            noise_score = noise_indicators / total_checks if total_checks > 0 else 0.0
            
            return max(0.0, min(1.0, noise_score))
            
        except Exception:
            return 0.5  # Medium noise on error
    
    # ========== STEP 5: PATTERN SCOPE CONTROL ==========
    
    def determine_pattern_scope(self, review_data: Dict[str, Any]) -> Dict[str, Optional[str]]:
        """
        Determine pattern scope for segmentation.
        Returns: {user_segment, product_area, region}
        """
        try:
            scope = {
                'user_segment': self._determine_user_segment(review_data),
                'product_area': self._determine_product_area(review_data),
                'region': self._determine_region(review_data)
            }
            return scope
        except Exception:
            return {'user_segment': None, 'product_area': None, 'region': None}
    
    def _determine_user_segment(self, review_data: Dict[str, Any]) -> Optional[str]:
        """Determine if review is from enterprise, free, or trial user"""
        # This would ideally pull from user metadata
        # For now, infer from review content
        content = review_data.get('content', '').lower()
        
        if any(word in content for word in ['enterprise', 'business', 'company', 'team']):
            return 'enterprise'
        elif any(word in content for word in ['trial', 'demo', 'testing']):
            return 'trial'
        elif any(word in content for word in ['free', 'basic']):
            return 'free'
        else:
            return 'standard'
    
    def _determine_product_area(self, review_data: Dict[str, Any]) -> Optional[str]:
        """Determine which product area this review relates to"""
        content = review_data.get('content', '').lower()
        
        if any(word in content for word in ['billing', 'payment', 'invoice', 'charge']):
            return 'billing'
        elif any(word in content for word in ['login', 'password', 'auth', 'signup']):
            return 'authentication'
        elif any(word in content for word in ['dashboard', 'ui', 'interface', 'design']):
            return 'ui_ux'
        elif any(word in content for word in ['api', 'integration', 'webhook']):
            return 'api'
        elif any(word in content for word in ['support', 'help', 'service']):
            return 'support'
        else:
            return 'core'
    
    def _determine_region(self, review_data: Dict[str, Any]) -> Optional[str]:
        """Determine geographic region if available"""
        # This would ideally use IP or user profile data
        # For now, return None (can be enhanced later)
        return None
    
    # ========== STEP 6: MEMORY SIZE CONTROL ==========
    
    def enforce_memory_limits(self, max_patterns_per_category: int = 100):
        """
        Prune lowest-scoring patterns to maintain size limits.
        Returns number of patterns pruned.
        """
        try:
            cursor = self.conn.cursor()
            
            # Get distinct categories
            cursor.execute('SELECT DISTINCT pain_point_category FROM review_patterns')
            categories = [row['pain_point_category'] for row in cursor.fetchall()]
            
            total_pruned = 0
            
            for category in categories:
                # Count patterns in this category
                cursor.execute('''
                    SELECT COUNT(*) as count 
                    FROM review_patterns 
                    WHERE pain_point_category = ?
                ''', (category,))
                
                count = cursor.fetchone()['count']
                
                if count > max_patterns_per_category:
                    # Calculate how many to remove
                    to_remove = count - max_patterns_per_category
                    
                    # Delete lowest scoring patterns
                    cursor.execute('''
                        DELETE FROM review_patterns
                        WHERE id IN (
                            SELECT id FROM review_patterns
                            WHERE pain_point_category = ?
                            ORDER BY pattern_score ASC, usage_count ASC
                            LIMIT ?
                        )
                    ''', (category, to_remove))
                    
                    total_pruned += cursor.rowcount
            
            self.conn.commit()
            return total_pruned
            
        except Exception:
            return 0  # Fail silently
