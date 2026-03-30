"""
Enhanced Pattern Matcher for Context Graph
Provides advanced similarity matching, outcome-based weighting, and bad precedent filtering.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher
import json


class EnhancedPatternMatcher:
    """Advanced pattern matching with quality filtering and outcome weighting."""
    
    def __init__(self, min_confidence: float = 0.5, min_success_rate: float = 0.8):
        """
        Initialize the pattern matcher.
        
        Args:
            min_confidence: Minimum confidence score for patterns (0.0 to 1.0)
            min_success_rate: Minimum success rate for pattern reuse (0.0 to 1.0)
        """
        self.min_confidence = min_confidence
        self.min_success_rate = min_success_rate
    
    @staticmethod
    def tokenize(text: str) -> set:
        """Tokenize text for similarity comparison."""
        # Convert to lowercase and split into words
        words = re.findall(r'\b\w+\b', text.lower())
        return set(words)
    
    @staticmethod
    def jaccard_similarity(text1: str, text2: str) -> float:
        """
        Calculate Jaccard similarity between two texts.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        tokens1 = EnhancedPatternMatcher.tokenize(text1)
        tokens2 = EnhancedPatternMatcher.tokenize(text2)
        
        if not tokens1 or not tokens2:
            return 0.0
        
        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))
        
        return intersection / union if union > 0 else 0.0
    
    @staticmethod
    def sequence_similarity(text1: str, text2: str) -> float:
        """
        Calculate sequence-based similarity using SequenceMatcher.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    @staticmethod
    def calculate_similarity(text1: str, text2: str) -> float:
        """
        Calculate overall similarity using multiple methods.
        
        Combines Jaccard and sequence similarity for robust matching.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Weighted similarity score between 0.0 and 1.0
        """
        jaccard = EnhancedPatternMatcher.jaccard_similarity(text1, text2)
        sequence = EnhancedPatternMatcher.sequence_similarity(text1, text2)
        
        # Weighted average: Jaccard is better for keyword matching, 
        # sequence is better for exact phrase matching
        return (jaccard * 0.6) + (sequence * 0.4)
    
    def find_similar_patterns(
        self, 
        review_text: str, 
        patterns: List[Dict[str, Any]], 
        threshold: float = 0.7
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Find patterns similar to the review text.
        
        Args:
            review_text: Review text to match against
            patterns: List of pattern dictionaries
            threshold: Minimum similarity threshold (0.0 to 1.0)
            
        Returns:
            List of (pattern, similarity_score) tuples, sorted by score descending
        """
        matches = []
        
        for pattern in patterns:
            # Get pattern text (stored in pattern_text field)
            pattern_text = pattern.get('pattern_text', '')
            if not pattern_text:
                continue
            
            # Calculate similarity
            similarity = self.calculate_similarity(review_text, pattern_text)
            
            # Check threshold
            if similarity >= threshold:
                matches.append((pattern, similarity))
        
        # Sort by similarity descending
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches
    
    def calculate_pattern_quality(self, pattern: Dict[str, Any]) -> float:
        """
        Calculate overall quality score for a pattern.
        
        Considers confidence, usage count, and success rate.
        
        Args:
            pattern: Pattern dictionary
            
        Returns:
            Quality score between 0.0 and 1.0
        """
        confidence = pattern.get('avg_confidence', 0.5)
        usage_count = pattern.get('usage_count', 1)
        
        # Quality factors
        confidence_score = confidence  # 0.0 to 1.0
        usage_score = min(usage_count / 10, 1.0)  # Caps at 10 uses
        
        # Weighted quality
        quality = (confidence_score * 0.7) + (usage_score * 0.3)
        
        return quality
    
    def weight_by_outcomes(
        self, 
        patterns: List[Tuple[Dict[str, Any], float]]
    ) -> List[Tuple[Dict[str, Any], float, float]]:
        """
        Weight patterns by their historical outcomes.
        
        Args:
            patterns: List of (pattern, similarity) tuples
            
        Returns:
            List of (pattern, similarity, weighted_score) tuples
        """
        weighted_patterns = []
        
        for pattern, similarity in patterns:
            quality = self.calculate_pattern_quality(pattern)
            
            # Combined score: similarity * quality
            weighted_score = similarity * quality
            
            weighted_patterns.append((pattern, similarity, weighted_score))
        
        # Sort by weighted score descending
        weighted_patterns.sort(key=lambda x: x[2], reverse=True)
        
        return weighted_patterns
    
    def filter_bad_precedents(self, patterns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out low-quality or problematic patterns.
        
        Removes patterns with:
        - Low confidence scores
        - JSON parsing errors in stored data
        - Invalid or missing required fields
        
        Args:
            patterns: List of pattern dictionaries
            
        Returns:
            List of filtered good patterns
        """
        good_patterns = []
        
        for pattern in patterns:
            # Check confidence threshold
            avg_confidence = pattern.get('avg_confidence', 0.0)
            if avg_confidence < self.min_confidence:
                continue
            
            # Validate pattern data is valid JSON
            pattern_data = pattern.get('pattern_data', '{}')
            try:
                # Try to parse the JSON to ensure it's valid
                if isinstance(pattern_data, str):
                    parsed_data = json.loads(pattern_data)
                else:
                    parsed_data = pattern_data
                
                # Validate required fields exist
                required_fields = ['sentiment', 'sentiment_score', 'confidence']
                if not all(field in parsed_data for field in required_fields):
                    continue
                
                # Validate field values are reasonable
                if not (-1.0 <= parsed_data.get('sentiment_score', 0) <= 1.0):
                    continue
                if not (0.0 <= parsed_data.get('confidence', 0) <= 1.0):
                    continue
                
            except (json.JSONDecodeError, ValueError, TypeError):
                # Skip patterns with invalid JSON or data
                continue
            
            # Pattern passed all checks
            good_patterns.append(pattern)
        
        return good_patterns
    
    def get_best_match(
        self,
        review_text: str,
        patterns: List[Dict[str, Any]],
        threshold: float = 0.7
    ) -> Optional[Dict[str, Any]]:
        """
        Get the single best matching pattern for a review.
        
        Args:
            review_text: Review text to match
            patterns: Available patterns
            threshold: Minimum similarity threshold
            
        Returns:
            Best matching pattern dict or None if no good match
        """
        # Filter bad patterns first
        good_patterns = self.filter_bad_precedents(patterns)
        
        if not good_patterns:
            return None
        
        # Find similar patterns
        similar = self.find_similar_patterns(review_text, good_patterns, threshold)
        
        if not similar:
            return None
        
        # Weight by outcomes
        weighted = self.weight_by_outcomes(similar)
        
        if not weighted:
            return None
        
        # Return best pattern (highest weighted score)
        best_pattern, similarity, weighted_score = weighted[0]
        
        # Add match metadata
        result = best_pattern.copy()
        result['match_similarity'] = similarity
        result['match_weighted_score'] = weighted_score
        
        return result


def safe_parse_pattern_data(pattern_data: Any) -> Dict[str, Any]:
    """
    Safely parse pattern data with fallback to defaults.
    
    Args:
        pattern_data: Pattern data (string or dict)
        
    Returns:
        Parsed data dict or empty dict on error
    """
    try:
        if isinstance(pattern_data, str):
            return json.loads(pattern_data)
        elif isinstance(pattern_data, dict):
            return pattern_data
        else:
            return {}
    except (json.JSONDecodeError, ValueError, TypeError):
        return {}
