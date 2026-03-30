"""
Impact vs Effort Matrix - Issue Prioritization Engine
=====================================================

Helps users answer: "Which 3 issues should I fix FIRST?"

Quadrants:
- Quick Wins (High Impact, Low Effort) → FIX NOW
- Strategic (High Impact, High Effort) → Plan for next quarter
- Fill-Ins (Low Impact, Low Effort) → Nice to have
- Money Pits (Low Impact, High Effort) → AVOID

Impact Score = (Affected User %) × (Churn Risk Weight) × (Sentiment Severity)
Effort Score = Based on category complexity (Bug=2, Feature=8, Integration=10)
"""

import pandas as pd
from typing import List, Dict, Any


# Effort estimation by category
EFFORT_SCORES = {
    'Bug': 2,           # Quick fixes
    'UX': 3,            # Design tweaks
    'Support': 2,       # Process improvements
    'Billing': 4,       # Payment flow changes
    'Feature': 8,       # New development
    'Other': 5,         # Unknown complexity
    'Value': 6,         # Pricing/packaging changes
}

# Churn risk weights
CHURN_WEIGHTS = {
    'high': 3.0,
    'medium': 1.5,
    'low': 0.5,
    'null': 0.0
}


def calculate_impact_score(issue_df: pd.DataFrame, total_users: int) -> float:
    """
    Calculates impact score for an issue.
    
    Formula: (Affected %) × (Avg Churn Weight) × (Sentiment Severity)
    
    Args:
        issue_df: DataFrame of reviews mentioning this issue
        total_users: Total number of users analyzed
        
    Returns:
        Impact score (0-100, higher = more impactful)
    """
    
    if issue_df.empty or total_users == 0:
        return 0.0
    
    # Component 1: Affected user percentage
    affected_pct = (len(issue_df) / total_users) * 100
    
    # Component 2: Average churn risk weight
    churn_risks = issue_df['churn_risk'].value_counts().to_dict()
    weighted_churn = sum(CHURN_WEIGHTS.get(risk, 0) * count for risk, count in churn_risks.items())
    avg_churn_weight = weighted_churn / len(issue_df) if len(issue_df) > 0 else 0
    
    # Component 3: Sentiment severity (how negative)
    avg_sentiment = issue_df['sentiment_score'].mean()
    sentiment_severity = abs(min(avg_sentiment, 0))  # Only count negative (0 to 1)
    
    # Combined impact score (normalized to 0-100)
    impact_score = (affected_pct * 0.4) + (avg_churn_weight * 20) + (sentiment_severity * 40)
    
    return min(impact_score, 100.0)  # Cap at 100


def estimate_fix_effort(issue: str, category: str, complexity_factors: Dict = None) -> float:
    """
    Estimates effort required to fix an issue.
    
    Args:
        issue: Issue description
        category: Pain point category
        complexity_factors: Optional additional factors (e.g., requires 3rd party integration)
        
    Returns:
        Effort score (1-10, higher = more effort)
    """
    
    base_effort = EFFORT_SCORES.get(category, 5)
    
    # Adjust based on keywords in issue description
    issue_lower = issue.lower() if isinstance(issue, str) else ""
    
    # Increase effort for complex scenarios
    if any(word in issue_lower for word in ['integration', 'migrate', 'rebuild', 'redesign']):
        base_effort += 3
    elif any(word in issue_lower for word in ['add', 'enable', 'allow']):
        base_effort += 1
    elif any(word in issue_lower for word in ['remove', 'fix', 'correct']):
        base_effort -= 1  # Removal is easier than addition
    
    # Apply complexity factors if provided
    if complexity_factors:
        if complexity_factors.get('requires_backend_change', False):
            base_effort += 2
        if complexity_factors.get('requires_3rd_party', False):
            base_effort += 3
    
    return max(1, min(base_effort, 10))  # Clamp between 1-10


def classify_quadrant(impact: float, effort: float) -> str:
    """
    Classifies issue into Impact/Effort quadrant.
    
    Args:
        impact: Impact score (0-100)
        effort: Effort score (1-10)
        
    Returns:
        Quadrant name
    """
    
    # Thresholds
    HIGH_IMPACT = 50
    HIGH_EFFORT = 5
    
    if impact >= HIGH_IMPACT and effort < HIGH_EFFORT:
        return "Quick Wins"
    elif impact >= HIGH_IMPACT and effort >= HIGH_EFFORT:
        return "Strategic"
    elif impact < HIGH_IMPACT and effort < HIGH_EFFORT:
        return "Fill-Ins"
    else:  # Low impact, high effort
        return "Money Pits"


def calculate_roi_estimate(impact: float, effort: float, arpu: float, affected_users: int) -> Dict[str, Any]:
    """
    Estimates ROI for fixing an issue.
    
    Args:
        impact: Impact score
        effort: Effort score
        arpu: Average revenue per user
        affected_users: Number of affected users
        
    Returns:
        Dict with ROI metrics
    """
    
    # Estimate retention improvement (impact translates to % retention saved)
    retention_improvement_pct = (impact / 100) * 0.25  # Max 25% improvement
    
    # Revenue saved = affected users × retention improvement × ARPU
    users_saved = int(affected_users * retention_improvement_pct)
    revenue_saved = users_saved * arpu
    
    # Cost estimate (effort × $500 per effort point as rough hourly cost)
    estimated_cost = effort * 500
    
    # ROI calculation
    roi = ((revenue_saved - estimated_cost) / estimated_cost * 100) if estimated_cost > 0 else 0
    
    return {
        'revenue_saved': round(revenue_saved, 2),
        'estimated_cost': estimated_cost,
        'roi_pct': round(roi, 1),
        'users_saved': users_saved,
        'payback_months': round(estimated_cost / (revenue_saved / 12), 1) if revenue_saved > 0 else 999
    }


def create_impact_effort_matrix(analysis_df: pd.DataFrame, results: Dict, arpu: float = 50) -> List[Dict[str, Any]]:
    """
    Creates complete Impact vs Effort matrix for all issues.
    
    Args:
        analysis_df: Full analysis dataframe
        results: Analysis results dict
        arpu: Average revenue per user
        
    Returns:
        List of issues with impact, effort, quadrant, and ROI
    """
    
    if analysis_df.empty:
        return []
    
    total_users = len(analysis_df)
    
    # Get all unique issues (excluding null/generic)
    issues = analysis_df[
        ~analysis_df['issue'].isin(['null', 'N/A', '', 'None', 'No specific issue'])
    ]['issue'].value_counts()
    
    matrix_data = []
    
    for issue, count in issues.items():
        # Get all reviews mentioning this issue
        issue_df = analysis_df[analysis_df['issue'] == issue]
        
        # Get primary category
        category = issue_df['pain_point_category'].mode()[0] if not issue_df['pain_point_category'].empty else 'Other'
        
        # Calculate scores
        impact = calculate_impact_score(issue_df, total_users)
        effort = estimate_fix_effort(issue, category)
        quadrant = classify_quadrant(impact, effort)
        roi = calculate_roi_estimate(impact, effort, arpu, count)
        
        # Get avg sentiment for display
        avg_sentiment = issue_df['sentiment_score'].mean()
        
        matrix_data.append({
            'issue': issue,
            'category': category,
            'affected_users': count,
            'affected_pct': round((count / total_users) * 100, 1),
            'impact_score': round(impact, 1),
            'effort_score': round(effort, 1),
            'quadrant': quadrant,
            'avg_sentiment': round(avg_sentiment, 2),
            'churn_risk_high_pct': round((issue_df['churn_risk'] == 'high').sum() / count * 100, 1),
            'roi_estimate': roi,
            'priority_rank': impact / effort  # Used for sorting
        })
    
    # Sort by priority rank (descending)
    matrix_data.sort(key=lambda x: x['priority_rank'], reverse=True)
    
    return matrix_data


def get_quick_wins(matrix_data: List[Dict]) -> List[Dict]:
    """
    Filters matrix to return only Quick Wins.
    
    Args:
        matrix_data: Output from create_impact_effort_matrix
        
    Returns:
        List of quick win issues sorted by priority
    """
    
    quick_wins = [item for item in matrix_data if item['quadrant'] == 'Quick Wins']
    
    return quick_wins[:5]  # Top 5 quick wins


def test_impact_effort_matrix():
    """
    Unit test for impact/effort calculations.
    """
    
    # Mock data
    mock_data = {
        'issue': ['slow app', 'slow app', 'missing feature', 'bug', 'bug', 'bug'],
        'pain_point_category': ['UX', 'UX', 'Feature', 'Bug', 'Bug', 'Bug'],
        'churn_risk': ['high', 'medium', 'low', 'high', 'high', 'medium'],
        'sentiment_score': [-0.8, -0.6, -0.3, -0.9, -0.85, -0.7]
    }
    
    df = pd.DataFrame(mock_data)
    
    # Test impact calculation
    slow_app_df = df[df['issue'] == 'slow app']
    impact = calculate_impact_score(slow_app_df, 6)
    print(f"Impact score for 'slow app': {impact:.1f}")
    assert impact > 0, "Impact should be positive"
    
    # Test effort estimation
    effort_ux = estimate_fix_effort('slow app', 'UX')
    effort_feature = estimate_fix_effort('missing feature', 'Feature')
    print(f"Effort for UX issue: {effort_ux}, Feature: {effort_feature}")
    assert effort_feature > effort_ux, "Features should be higher effort than UX"
    
    # Test quadrant classification
    quadrant = classify_quadrant(impact, effort_ux)
    print(f"Quadrant: {quadrant}")
    
    # Test full matrix
    matrix = create_impact_effort_matrix(df, {}, arpu=100)
    print(f"\nFull Matrix ({len(matrix)} issues):")
    for item in matrix:
        print(f"  {item['issue']}: Impact={item['impact_score']}, Effort={item['effort_score']}, Quadrant={item['quadrant']}, ROI={item['roi_estimate']['roi_pct']}%")
    
    print("\n[OK] All tests passed!")


if __name__ == "__main__":
    test_impact_effort_matrix()
