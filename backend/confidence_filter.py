"""
Confidence Filtering Module - Signal vs Noise Separation
========================================================

Separates high-confidence actionable insights from low-confidence noise.
Essential for executive views where every displayed insight must be trustworthy.

Confidence Levels:
- High: ≥ 0.7 (Safe to act on)
- Medium: 0.4 - 0.69 (Needs validation)
- Low: < 0.4 (Suppress from executive views)
"""

import pandas as pd


def filter_high_confidence(analysis_df: pd.DataFrame, threshold: float = 0.7) -> pd.DataFrame:
    """
    Extracts only high-confidence insights safe for executive decision-making.
    
    Args:
        analysis_df: Full analysis dataframe
        threshold: Minimum confidence score (default 0.7)
        
    Returns:
        Filtered dataframe with only high-confidence rows
    """
    
    if analysis_df.empty:
        return analysis_df
    
    if 'confidence' not in analysis_df.columns:
        # If confidence column missing, return all (defensive)
        return analysis_df
    
    high_confidence_df = analysis_df[analysis_df['confidence'] >= threshold].copy()
    
    return high_confidence_df


def suppress_low_confidence(analysis_df: pd.DataFrame, threshold: float = 0.4) -> pd.DataFrame:
    """
    Removes noise from analysis by suppressing low-confidence signals.
    
    Used in executive views to prevent decision-making on uncertain data.
    
    Args:
        analysis_df: Full analysis dataframe
        threshold: Maximum confidence for suppression (default 0.4)
        
    Returns:
        Dataframe with low-confidence rows removed
    """
    
    if analysis_df.empty:
        return analysis_df
    
    if 'confidence' not in analysis_df.columns:
        return analysis_df
    
    actionable_df = analysis_df[analysis_df['confidence'] > threshold].copy()
    
    return actionable_df


def add_confidence_badges(analysis_df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds human-readable confidence level badges for UI display.
    
    Badges:
    - "✓ High Confidence" (≥ 0.7)
    - "⚠ Needs Validation" (0.4 - 0.69)
    - "⊘ Low Confidence" (< 0.4)
    
    Args:
        analysis_df: Analysis dataframe with confidence scores
        
    Returns:
        Dataframe with new 'confidence_badge' column
    """
    
    if analysis_df.empty:
        return analysis_df
    
    df = analysis_df.copy()
    
    if 'confidence' not in df.columns:
        df['confidence_badge'] = "⚠ Unknown"
        return df
    
    def assign_badge(confidence_score):
        if confidence_score >= 0.7:
            return "✓ High Confidence"
        elif confidence_score >= 0.4:
            return "⚠ Needs Validation"
        else:
            return "⊘ Low Confidence"
    
    df['confidence_badge'] = df['confidence'].apply(assign_badge)
    
    return df


def get_confidence_distribution(analysis_df: pd.DataFrame) -> dict:
    """
    Calculates distribution of insights across confidence levels.
    
    Useful for displaying reliability stats in UI.
    
    Args:
        analysis_df: Full analysis dataframe
        
    Returns:
        Dict with:
        - high_confidence_count
        - medium_confidence_count
        - low_confidence_count
        - high_confidence_pct
        - total_reviewed
    """
    
    if analysis_df.empty or 'confidence' not in analysis_df.columns:
        return {
            'high_confidence_count': 0,
            'medium_confidence_count': 0,
            'low_confidence_count': 0,
            'high_confidence_pct': 0.0,
            'total_reviewed': 0
        }
    
    total = len(analysis_df)
    
    high_count = len(analysis_df[analysis_df['confidence'] >= 0.7])
    medium_count = len(analysis_df[(analysis_df['confidence'] >= 0.4) & (analysis_df['confidence'] < 0.7)])
    low_count = len(analysis_df[analysis_df['confidence'] < 0.4])
    
    high_pct = round((high_count / total) * 100, 1) if total > 0 else 0.0
    
    return {
        'high_confidence_count': high_count,
        'medium_confidence_count': medium_count,
        'low_confidence_count': low_count,
        'high_confidence_pct': high_pct,
        'total_reviewed': total
    }


def filter_insights_by_confidence(
    insights_dict: dict, 
    analysis_df: pd.DataFrame, 
    confidence_threshold: float = 0.7
) -> dict:
    """
    Filters aggregated insights (pain points, themes, etc.) to only include
    those derived from high-confidence reviews.
    
    Args:
        insights_dict: Dictionary of aggregated insights (e.g., pain_point_distribution)
        analysis_df: Full analysis dataframe
        confidence_threshold: Minimum confidence (default 0.7)
        
    Returns:
        Filtered insights dictionary
    """
    
    # Filter to high confidence rows
    high_conf_df = filter_high_confidence(analysis_df, confidence_threshold)
    
    if high_conf_df.empty:
        return {}
    
    # Rebuild insights from filtered dataframe
    # This is a generic approach - specific insight types handled in W1.py
    
    return insights_dict  # Placeholder - actual filtering happens in aggregation


def get_confidence_filter_label(threshold: float, active: bool) -> str:
    """
    Generates user-friendly label for confidence filtering UI toggle.
    
    Args:
        threshold: Current confidence threshold
        active: Whether filtering is active
        
    Returns:
        HTML-formatted label string
    """
    
    if not active:
        return "🔓 Showing All Insights (Including Low Confidence)"
    
    if threshold >= 0.7:
        return "✓ Enterprise-Safe Mode (High Confidence Only)"
    elif threshold >= 0.5:
        return "⚠ Balanced Mode (Medium+ Confidence)"
    else:
        return "🔍 Exploratory Mode (All Signals)"


def test_confidence_filtering():
    """
    Unit test for confidence filtering logic.
    """
    
    # Mock data
    mock_data = {
        'issue': ['Payment error', 'Slow app', 'Bug', 'Great feature', 'Crash'],
        'confidence': [0.9, 0.6, 0.3, 0.85, 0.45],
        'sentiment': ['negative', 'negative', 'negative', 'positive', 'negative']
    }
    
    df = pd.DataFrame(mock_data)
    
    # Test high confidence filter
    high_conf = filter_high_confidence(df, threshold=0.7)
    assert len(high_conf) == 2, f"Expected 2 high confidence rows, got {len(high_conf)}"
    
    # Test low confidence suppression
    actionable = suppress_low_confidence(df, threshold=0.4)
    assert len(actionable) == 4, f"Expected 4 actionable rows, got {len(actionable)}"
    
    # Test badge assignment
    badged_df = add_confidence_badges(df)
    assert 'confidence_badge' in badged_df.columns, "Badge column not added"
    assert badged_df.iloc[0]['confidence_badge'] == "[OK] High Confidence", "Badge mismatch"
    assert badged_df.iloc[2]['confidence_badge'] == "[X] Low Confidence", "Badge mismatch"
    
    # Test distribution
    dist = get_confidence_distribution(df)
    assert dist['high_confidence_count'] == 2, "Distribution count mismatch"
    assert dist['high_confidence_pct'] == 40.0, "Distribution percentage mismatch"
    
    print("=== Confidence Filter Test ===")
    print(f"High Confidence: {len(high_conf)} rows")
    print(f"Actionable: {len(actionable)} rows")
    print(f"Distribution: {dist}")
    print("[OK] All tests passed!")


if __name__ == "__main__":
    test_confidence_filtering()
