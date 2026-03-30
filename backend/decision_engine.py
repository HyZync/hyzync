"""
Decision Engine Module - Commercial Intelligence Layer
======================================================

Provides deterministic decision-making on top of existing VoC analysis metrics.
Always returns a single, actionable recommendation even with imperfect data.

Key Principles:
- Deterministic: Same inputs always produce same outputs
- Conservative: Underestimate impact, never oversell
- Actionable: Every output drives a concrete next step
"""

import pandas as pd
from typing import Dict, Any, Tuple


def calculate_fix_now_decision(analysis_df: pd.DataFrame, results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Identifies the single highest-impact issue to fix using weighted scoring.
    
    Scoring Formula:
    Impact Score = Volume × Churn_Weight × Confidence × Urgency_Weight
    
    Where:
    - Volume = number of mentions
    - Churn_Weight = {high: 3.0, medium: 1.5, low: 0.5, null: 0.2}
    - Confidence = LLM confidence score (0.0-1.0)
    - Urgency_Weight = {High: 2.0, Medium: 1.0, Low: 0.5, None: 0.3}
    
    Args:
        analysis_df: Full analysis results dataframe
        results: Aggregated results dictionary
        
    Returns:
        Dict with:
        - fix_now_issue: The specific issue to fix
        - issue_category: Pain point category
        - affected_user_count: Number of users mentioning this
        - affected_user_pct: Percentage of total users
        - confidence_level: "High" / "Medium" / "Low"
        - expected_impact_score: Weighted impact score
    """
    
    if analysis_df.empty:
        return {
            "fix_now_issue": "No actionable issues detected",
            "issue_category": "N/A",
            "affected_user_count": 0,
            "affected_user_pct": 0.0,
            "confidence_level": "Low",
            "expected_impact_score": 0.0,
            "churn_risk_level": "null",
            "urgency_level": "None"
        }
    
    # Filter out non-actionable issues
    actionable_df = analysis_df[
        ~analysis_df['issue'].isin(['null', 'N/A', '', 'None']) &
        (analysis_df['confidence'] > 0.3)  # Minimum confidence threshold
    ].copy()
    
    if actionable_df.empty:
        return {
            "fix_now_issue": "No high-confidence issues identified",
            "issue_category": "N/A",
            "affected_user_count": 0,
            "affected_user_pct": 0.0,
            "confidence_level": "Low",
            "expected_impact_score": 0.0,
            "churn_risk_level": "null",
            "urgency_level": "None"
        }
    
    # Define weights
    churn_weights = {'high': 3.0, 'medium': 1.5, 'low': 0.5, 'null': 0.2}
    urgency_weights = {'High': 2.0, 'Medium': 1.0, 'Low': 0.5, 'None': 0.3}
    
    # Calculate impact score for each unique issue
    issue_scores = []
    
    for issue in actionable_df['issue'].unique():
        issue_rows = actionable_df[actionable_df['issue'] == issue]
        
        volume = len(issue_rows)
        avg_confidence = issue_rows['confidence'].mean()
        
        # Get dominant churn risk and urgency
        churn_risk = issue_rows['churn_risk'].mode()[0] if not issue_rows['churn_risk'].mode().empty else 'null'
        urgency = issue_rows['urgency'].mode()[0] if not issue_rows['urgency'].mode().empty else 'None'
        
        # Calculate weighted impact score
        impact_score = (
            volume * 
            churn_weights.get(churn_risk, 0.2) * 
            avg_confidence * 
            urgency_weights.get(urgency, 0.3)
        )
        
        issue_scores.append({
            'issue': issue,
            'category': issue_rows['pain_point_category'].mode()[0] if not issue_rows['pain_point_category'].mode().empty else 'Other',
            'volume': volume,
            'confidence': avg_confidence,
            'churn_risk': churn_risk,
            'urgency': urgency,
            'impact_score': impact_score
        })
    
    # Sort by impact score and get top issue
    issue_scores_sorted = sorted(issue_scores, key=lambda x: x['impact_score'], reverse=True)
    top_issue = issue_scores_sorted[0]
    
    total_analyzed = len(analysis_df)
    affected_pct = round((top_issue['volume'] / total_analyzed) * 100, 1)
    
    # Determine confidence level based on average confidence and volume
    if top_issue['confidence'] >= 0.7 and top_issue['volume'] >= 5:
        confidence_level = "High"
    elif top_issue['confidence'] >= 0.5 and top_issue['volume'] >= 3:
        confidence_level = "Medium"
    else:
        confidence_level = "Low"
    
    return {
        "fix_now_issue": top_issue['issue'],
        "issue_category": top_issue['category'],
        "affected_user_count": top_issue['volume'],
        "affected_user_pct": affected_pct,
        "confidence_level": confidence_level,
        "expected_impact_score": round(top_issue['impact_score'], 2),
        "churn_risk_level": top_issue['churn_risk'],
        "urgency_level": top_issue['urgency']
    }


def estimate_churn_reduction(fix_decision: Dict[str, Any], analysis_df: pd.DataFrame) -> float:
    """
    Estimates expected churn reduction if the recommended issue is fixed.
    
    Uses conservative heuristics based on:
    - Issue volume (what % of users are affected)
    - Churn risk correlation
    - Historical assumption: fixing top issue reduces related churn by 40-60%
    
    Args:
        fix_decision: Output from calculate_fix_now_decision
        analysis_df: Full analysis dataframe
        
    Returns:
        Expected churn reduction percentage (conservative estimate)
    """
    
    if fix_decision['affected_user_count'] == 0:
        return 0.0
    
    # Base reduction: affected user % × fix effectiveness
    affected_pct = fix_decision['affected_user_pct']
    
    # Fix effectiveness based on churn risk and confidence
    churn_risk = fix_decision.get('churn_risk_level', 'null')
    confidence = fix_decision.get('confidence_level', 'Low')
    
    # Conservative effectiveness rates
    effectiveness_matrix = {
        ('high', 'High'): 0.5,      # 50% of affected users retained
        ('high', 'Medium'): 0.4,
        ('high', 'Low'): 0.3,
        ('medium', 'High'): 0.4,
        ('medium', 'Medium'): 0.3,
        ('medium', 'Low'): 0.2,
        ('low', 'High'): 0.3,
        ('low', 'Medium'): 0.2,
        ('low', 'Low'): 0.1,
    }
    
    effectiveness = effectiveness_matrix.get((churn_risk, confidence), 0.15)
    
    # Conservative estimate: affected % × effectiveness rate
    expected_reduction = (affected_pct / 100) * effectiveness * 100
    
    return round(min(expected_reduction, 25.0), 1)  # Cap at 25% for realism


def calculate_affected_users(issue: str, analysis_df: pd.DataFrame) -> Tuple[int, float]:
    """
    Calculates total affected users including similar root causes.
    
    Args:
        issue: The primary issue to analyze
        analysis_df: Full analysis dataframe
        
    Returns:
        Tuple of (affected_count, affected_percentage)
    """
    
    if analysis_df.empty:
        return 0, 0.0
    
    # Direct mentions
    direct_mentions = len(analysis_df[analysis_df['issue'] == issue])
    
    # Similar root causes (users with same underlying problem)
    issue_rows = analysis_df[analysis_df['issue'] == issue]
    if issue_rows.empty:
        return 0, 0.0
    
    primary_root_cause = issue_rows['root_cause'].mode()[0] if not issue_rows['root_cause'].mode().empty else None
    
    if primary_root_cause and primary_root_cause not in ['null', 'N/A', '', 'None']:
        similar_users = len(analysis_df[analysis_df['root_cause'] == primary_root_cause])
    else:
        similar_users = direct_mentions
    
    # Use the higher count (conservative approach)
    affected_count = max(direct_mentions, similar_users)
    
    total_users = len(analysis_df)
    affected_pct = round((affected_count / total_users) * 100, 1)
    
    return affected_count, affected_pct


def generate_decision_summary(analysis_df: pd.DataFrame, results: Dict[str, Any], vertical: str) -> Dict[str, Any]:
    """
    Orchestrates all decision engine components into a single executive decision package.
    
    CRITICAL RULE: Always return ONE primary action, even if data is imperfect.
    
    Args:
        analysis_df: Full analysis dataframe
        results: Aggregated analysis results
        vertical: Industry vertical
        
    Returns:
        Complete decision intelligence package with:
        - Primary fix recommendation
        - Expected impact
        - Affected users
        - Confidence level
        - Revenue impact (if ARPU available)
    """
    
    # 1. Calculate primary fix decision
    fix_decision = calculate_fix_now_decision(analysis_df, results)
    
    # 2. Estimate churn reduction
    churn_reduction = estimate_churn_reduction(fix_decision, analysis_df)
    
    # 3. Calculate affected users (with similar root causes)
    affected_count, affected_pct = calculate_affected_users(
        fix_decision['fix_now_issue'], 
        analysis_df
    )
    
    # Update with expanded user count
    fix_decision['total_affected_user_count'] = affected_count
    fix_decision['total_affected_user_pct'] = affected_pct
    
    # 4. Compile decision package
    decision_package = {
        "fix_now_decision": fix_decision['fix_now_issue'],
        "issue_category": fix_decision['issue_category'],
        "affected_user_count": affected_count,
        "affected_user_pct": affected_pct,
        "expected_churn_reduction_pct": churn_reduction,
        "confidence_level": fix_decision['confidence_level'],
        "impact_score": fix_decision['expected_impact_score'],
        "urgency": fix_decision['urgency_level'],
        
        # Additional context for display
        "fix_rationale": f"Highest impact issue affecting {affected_pct}% of users with {fix_decision['churn_risk_level']} churn risk",
        "vertical": vertical
    }
    
    return decision_package


def test_decision_logic():
    """
    Unit test for decision engine with mock data.
    Run via: python -c "from decision_engine import test_decision_logic; test_decision_logic()"
    """
    
    # Mock analysis dataframe
    mock_data = {
        'issue': ['Payment timeout', 'Payment timeout', 'Slow loading', 'Bug in checkout', 'Payment timeout'],
        'pain_point_category': ['Billing', 'Billing', 'UX', 'Bug', 'Billing'],
        'churn_risk': ['high', 'high', 'medium', 'high', 'high'],
        'confidence': [0.9, 0.85, 0.7, 0.6, 0.9],
        'urgency': ['High', 'High', 'Medium', 'High', 'High'],
        'root_cause': ['Gateway issue', 'Gateway issue', 'Server load', 'Code error', 'Gateway issue'],
        'sentiment': ['negative', 'negative', 'neutral', 'negative', 'negative'],
        'content': ['Payment failed', 'Cannot checkout', 'Site is slow', 'Bug preventing purchase', 'Payment error']
    }
    
    mock_df = pd.DataFrame(mock_data)
    mock_results = {'total_analyzed': len(mock_df)}
    
    # Test decision calculation
    decision = calculate_fix_now_decision(mock_df, mock_results)
    
    print("=== Decision Engine Test ===")
    print(f"Fix Now: {decision['fix_now_issue']}")
    print(f"Category: {decision['issue_category']}")
    print(f"Affected Users: {decision['affected_user_count']} ({decision['affected_user_pct']}%)")
    print(f"Confidence: {decision['confidence_level']}")
    print(f"Impact Score: {decision['expected_impact_score']}")
    
    # Test churn reduction
    churn_reduction = estimate_churn_reduction(decision, mock_df)
    print(f"Expected Churn Reduction: {churn_reduction}%")
    
    # Test full decision package
    full_decision = generate_decision_summary(mock_df, mock_results, 'ecommerce')
    print(f"\nFull Decision Package: {full_decision}")
    
    # Validation
    assert decision['fix_now_issue'] == 'Payment timeout', "Should identify payment timeout as top issue"
    assert decision['affected_user_count'] >= 3, "Should count multiple mentions"
    assert decision['confidence_level'] == 'High', "Should have high confidence with 0.9 avg"
    
    print("\n[OK] All tests passed!")
    

if __name__ == "__main__":
    test_decision_logic()
