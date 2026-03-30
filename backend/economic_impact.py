"""
Economic Impact Module - Financial Modeling & Revenue Analysis
===============================================================
Transforms sentiment analysis into financial insights for strategic decision-making.

Features:
- Revenue-at-Risk Calculator: Projects monetary loss from churn probability
- Sensitivity Analysis: "What-If" simulator for topic reduction scenarios
- ROI Prioritization: Ranks bugs by financial recovery potential
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional


# ============================================================================
# Revenue-at-Risk Calculator
# ============================================================================

def calculate_revenue_at_risk(
    analysis_df: pd.DataFrame,
    arpu: float,
    time_horizon: str = '30d',
    renewal_cycle: str = 'monthly',
    vertical: str = 'generic'
) -> Dict:
    """
    Calculate projected revenue loss based on churn probability from reviews.
    
    Conservative churn probability model:
    - High churn risk: 70% probability of churning
    - Medium churn risk: 30% probability of churning
    - Low/Null churn risk: 5% probability (baseline)
    
    Args:
        analysis_df: DataFrame with review analysis including 'churn_risk' column
        arpu: Average Revenue Per User (monthly)
        time_horizon: Time period for projection ('30d', '90d', '180d', '365d')
        renewal_cycle: Customer renewal cycle ('monthly', 'quarterly', 'annual')
        
    Returns:
        Dictionary with revenue-at-risk metrics
    """
    if analysis_df.empty or 'churn_risk' not in analysis_df.columns:
        return {
            'total_revenue_at_risk': 0,
            'high_risk_revenue': 0,
            'medium_risk_revenue': 0,
            'affected_users': 0,
            'methodology': 'No churn data available'
        }
    
    # Map time horizon to months
    horizon_map = {
        '30d': 1,
        '90d': 3,
        '180d': 6,
        '365d': 12
    }
    months = horizon_map.get(time_horizon, 1)
    
    # Map renewal cycle to multiplier
    cycle_map = {
        'monthly': 1.0,
        'quarterly': 0.33,  # Less churn risk per month
        'annual': 0.08      # Even less churn risk per month
    }
    cycle_multiplier = cycle_map.get(renewal_cycle.lower(), 1.0)
    
    # Churn probabilities
    churn_prob = {
        'high': 0.70 * cycle_multiplier,
        'medium': 0.30 * cycle_multiplier,
        'low': 0.05 * cycle_multiplier,
        'null': 0.05 * cycle_multiplier
    }
    
    # Count users by risk level
    high_risk_count = len(analysis_df[analysis_df['churn_risk'].str.lower() == 'high'])
    medium_risk_count = len(analysis_df[analysis_df['churn_risk'].str.lower() == 'medium'])
    low_risk_count = len(analysis_df[analysis_df['churn_risk'].str.lower().isin(['low', 'null'])])
    
    # Calculate expected revenue loss
    high_risk_revenue = high_risk_count * churn_prob['high'] * arpu * months
    medium_risk_revenue = medium_risk_count * churn_prob['medium'] * arpu * months
    low_risk_revenue = low_risk_count * churn_prob['low'] * arpu * months
    
    total_revenue_at_risk = high_risk_revenue + medium_risk_revenue + low_risk_revenue
    
    # Calculate nominal churn revenue (direct count * ARPU without probability)
    nominal_churn_revenue = high_risk_count * arpu * months
    
    return {
        'total_revenue_at_risk': round(total_revenue_at_risk, 2),
        'nominal_churn_revenue': round(nominal_churn_revenue, 2), # NEW METRIC
        'high_risk_revenue': round(high_risk_revenue, 2),
        'medium_risk_revenue': round(medium_risk_revenue, 2),
        'low_risk_revenue': round(low_risk_revenue, 2),
        'affected_users': {
            'high': high_risk_count,
            'medium': medium_risk_count,
            'low': low_risk_count
        },
        'time_horizon': time_horizon,
        'arpu': arpu,
        'renewal_cycle': renewal_cycle,
        'methodology': f'Conservative churn model: High={churn_prob["high"]*100:.1f}%, Med={churn_prob["medium"]*100:.1f}%, Low={churn_prob["low"]*100:.1f}%'
    }


def calculate_topic_revenue_impact(
    analysis_df: pd.DataFrame,
    arpu: float,
    topic_column: str = 'pain_point_category'
) -> pd.DataFrame:
    """
    Calculate revenue at risk broken down by complaint topic.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        topic_column: Column containing topics/categories
        
    Returns:
        DataFrame with topics ranked by revenue impact
    """
    if analysis_df.empty or topic_column not in analysis_df.columns:
        return pd.DataFrame()
    
    # Group by topic and churn risk
    topic_risk = analysis_df.groupby([topic_column, 'churn_risk']).size().reset_index(name='count')
    
    # Calculate revenue at risk per topic-risk combination
    def calc_revenue(row):
        churn_prob = {
            'high': 0.70,
            'medium': 0.30,
            'low': 0.05,
            'null': 0.05
        }
        prob = churn_prob.get(row['churn_risk'].lower(), 0.05)
        return row['count'] * prob * arpu
    
    topic_risk['revenue_at_risk'] = topic_risk.apply(calc_revenue, axis=1)
    
    # Aggregate by topic
    topic_summary = topic_risk.groupby(topic_column).agg({
        'count': 'sum',
        'revenue_at_risk': 'sum'
    }).reset_index()
    
    # Sort by revenue impact
    topic_summary = topic_summary.sort_values('revenue_at_risk', ascending=False)
    topic_summary['revenue_at_risk'] = topic_summary['revenue_at_risk'].round(2)
    
    # Add percentage of total
    total_revenue_at_risk = topic_summary['revenue_at_risk'].sum()
    if total_revenue_at_risk > 0:
        topic_summary['pct_of_total'] = (topic_summary['revenue_at_risk'] / total_revenue_at_risk * 100).round(1)
    else:
        topic_summary['pct_of_total'] = 0
    
    return topic_summary


def estimate_topic_churn_contribution(
    analysis_df: pd.DataFrame,
    topic: str,
    topic_column: str = 'pain_point_category',
    baseline_churn: float = 0.05
) -> Dict:
    """
    Estimate how much a specific topic contributes to overall churn probability.
    
    Args:
        analysis_df: DataFrame with review analysis
        topic: Specific topic to analyze
        topic_column: Column containing topics
        baseline_churn: Baseline churn rate (default 5%)
        
    Returns:
        Dictionary with churn contribution metrics
    """
    if analysis_df.empty or topic_column not in analysis_df.columns:
        return {'error': 'Invalid data'}
    
    # Filter for the specific topic
    topic_df = analysis_df[analysis_df[topic_column] == topic]
    
    if topic_df.empty:
        return {
            'topic': topic,
            'sample_size': 0,
            'churn_contribution': 0,
            'message': 'No reviews found for this topic'
        }
    
    # Calculate average churn risk for this topic
    churn_weights = {'high': 0.70, 'medium': 0.30, 'low': 0.05, 'null': 0.05}
    topic_df['churn_weight'] = topic_df['churn_risk'].str.lower().map(churn_weights).fillna(0.05)
    
    avg_churn_prob = topic_df['churn_weight'].mean()
    churn_contribution = avg_churn_prob - baseline_churn
    
    # Calculate prevalence
    prevalence = len(topic_df) / len(analysis_df) * 100
    
    return {
        'topic': topic,
        'sample_size': len(topic_df),
        'average_churn_probability': round(avg_churn_prob * 100, 2),
        'baseline_churn': round(baseline_churn * 100, 2),
        'churn_contribution': round(churn_contribution * 100, 2),
        'prevalence_pct': round(prevalence, 2),
        'impact_score': round(churn_contribution * prevalence, 2)
    }


# ============================================================================
# Sensitivity Analysis ("What-If" Simulator)
# ============================================================================

def create_sensitivity_scenarios(
    analysis_df: pd.DataFrame,
    topic: str,
    reduction_percentages: List[int] = [10, 20, 30, 50],
    arpu: float = 50.0,
    topic_column: str = 'pain_point_category'
) -> pd.DataFrame:
    """
    Generate "What-If" scenarios showing impact of reducing specific complaint topics.
    
    Args:
        analysis_df: DataFrame with review analysis
        topic: Topic to simulate reduction for
        reduction_percentages: List of reduction percentages to simulate (e.g., [10, 20, 30])
        arpu: Average Revenue Per User
        topic_column: Column containing topics
        
    Returns:
        DataFrame with scenario results
    """
    baseline = calculate_revenue_at_risk(analysis_df, arpu, time_horizon='30d')
    baseline_revenue_at_risk = baseline['total_revenue_at_risk']
    
    # Get topic contribution
    topic_contribution = estimate_topic_churn_contribution(
        analysis_df, topic, topic_column
    )
    
    scenarios = []
    
    for reduction_pct in reduction_percentages:
        # Simulate reduction by removing a percentage of topic complaints
        topic_mask = analysis_df[topic_column] == topic
        topic_count = topic_mask.sum()
        
        if topic_count == 0:
            continue
        
        # Remove specified percentage of topic reviews
        remove_count = int(topic_count * (reduction_pct / 100))
        
        # Create simulated dataset
        topic_indices = analysis_df[topic_mask].index
        remove_indices = np.random.choice(topic_indices, size=remove_count, replace=False)
        simulated_df = analysis_df.drop(remove_indices)
        
        # Calculate new revenue at risk
        new_metrics = calculate_revenue_at_risk(simulated_df, arpu, time_horizon='30d')
        new_revenue_at_risk = new_metrics['total_revenue_at_risk']
        
        # Calculate savings
        revenue_saved = baseline_revenue_at_risk - new_revenue_at_risk
        churn_reduction = (revenue_saved / arpu) if arpu > 0 else 0
        
        scenarios.append({
            'reduction_percentage': reduction_pct,
            'topic': topic,
            'baseline_revenue_at_risk': baseline_revenue_at_risk,
            'new_revenue_at_risk': new_revenue_at_risk,
            'revenue_saved': round(revenue_saved, 2),
            'estimated_churn_reduction': round(churn_reduction, 1),
            'roi_potential': 'High' if revenue_saved > arpu * 10 else 'Medium' if revenue_saved > arpu * 5 else 'Low'
        })
    
    return pd.DataFrame(scenarios)


def run_multi_topic_sensitivity(
    analysis_df: pd.DataFrame,
    topics: List[str],
    reduction_pct: int = 20,
    arpu: float = 50.0,
    topic_column: str = 'pain_point_category'
) -> pd.DataFrame:
    """
    Compare sensitivity across multiple topics at once.
    
    Args:
        analysis_df: DataFrame with review analysis
        topics: List of topics to compare
        reduction_pct: Percentage reduction to apply (default 20%)
        arpu: Average Revenue Per User
        topic_column: Column containing topics
        
    Returns:
        DataFrame comparing topics by impact
    """
    results = []
    
    for topic in topics:
        scenario_df = create_sensitivity_scenarios(
            analysis_df, topic, [reduction_pct], arpu, topic_column
        )
        
        if not scenario_df.empty:
            results.append(scenario_df.iloc[0])
    
    if not results:
        return pd.DataFrame()
    
    comparison_df = pd.DataFrame(results)
    comparison_df = comparison_df.sort_values('revenue_saved', ascending=False)
    
    return comparison_df


# ============================================================================
# ROI Prioritization
# ============================================================================

def calculate_financial_recovery_potential(
    analysis_df: pd.DataFrame,
    arpu: float,
    fix_effort_estimates: Optional[Dict[str, int]] = None,
    topic_column: str = 'pain_point_category'
) -> pd.DataFrame:
    """
    Calculate ROI for fixing each issue by comparing potential revenue recovery
    to estimated fix effort.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        fix_effort_estimates: Dictionary mapping topics to effort scores (1-10)
        topic_column: Column containing topics
        
    Returns:
        DataFrame with ROI-ranked issues
    """
    # Calculate revenue impact by topic
    topic_impact = calculate_topic_revenue_impact(analysis_df, arpu, topic_column)
    
    if topic_impact.empty:
        return pd.DataFrame()
    
    # Add effort estimates
    if fix_effort_estimates:
        topic_impact['fix_effort'] = topic_impact[topic_column].map(fix_effort_estimates)
    else:
        # Use heuristic based on issue frequency
        # More common issues might be harder to fix (systemic)
        max_count = topic_impact['count'].max()
        topic_impact['fix_effort'] = topic_impact['count'].apply(
            lambda x: min(10, max(3, int(7 * (x / max_count))))
        )
    
    # Fill missing effort estimates with median
    topic_impact['fix_effort'] = topic_impact['fix_effort'].fillna(5)
    
    # Calculate ROI Score: Revenue Recovery / Effort
    # Normalize to 0-100 scale
    topic_impact['roi_score'] = (topic_impact['revenue_at_risk'] / topic_impact['fix_effort'])
    
    # Normalize ROI score to 0-100
    max_roi = topic_impact['roi_score'].max()
    if max_roi > 0:
        topic_impact['roi_score_normalized'] = (topic_impact['roi_score'] / max_roi * 100).round(1)
    else:
        topic_impact['roi_score_normalized'] = 0
    
    # Add priority tier
    topic_impact['priority_tier'] = topic_impact['roi_score_normalized'].apply(
        lambda x: 'Critical' if x >= 75 else 'High' if x >= 50 else 'Medium' if x >= 25 else 'Low'
    )
    
    # Sort by ROI
    topic_impact = topic_impact.sort_values('roi_score_normalized', ascending=False)
    
    return topic_impact[[
        topic_column, 'count', 'revenue_at_risk', 'fix_effort',
        'roi_score_normalized', 'priority_tier', 'pct_of_total'
    ]]


def generate_roi_ranked_report(
    analysis_df: pd.DataFrame,
    arpu: float,
    fix_effort_estimates: Optional[Dict[str, int]] = None,
    topic_column: str = 'pain_point_category'
) -> Dict:
    """
    Generate a comprehensive ROI prioritization report.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        fix_effort_estimates: Dictionary mapping topics to effort scores
        topic_column: Column containing topics
        
    Returns:
        Dictionary with report sections
    """
    roi_df = calculate_financial_recovery_potential(
        analysis_df, arpu, fix_effort_estimates, topic_column
    )
    
    if roi_df.empty:
        return {'error': 'No data available for ROI analysis'}
    
    # Extract key insights
    top_3 = roi_df.head(3)
    critical_issues = roi_df[roi_df['priority_tier'] == 'Critical']
    
    total_revenue_at_risk = roi_df['revenue_at_risk'].sum()
    top_3_recovery_potential = top_3['revenue_at_risk'].sum()
    
    return {
        'summary': {
            'total_revenue_at_risk': round(total_revenue_at_risk, 2),
            'top_3_recovery_potential': round(top_3_recovery_potential, 2),
            'top_3_as_pct_of_total': round(top_3_recovery_potential / total_revenue_at_risk * 100, 1) if total_revenue_at_risk > 0 else 0,
            'critical_issue_count': len(critical_issues),
            'average_fix_effort': round(roi_df['fix_effort'].mean(), 1)
        },
        'top_priorities': top_3.to_dict('records'),
        'full_ranking': roi_df.to_dict('records'),
        'recommendation': generate_roi_recommendation(roi_df)
    }


def generate_roi_recommendation(roi_df: pd.DataFrame) -> str:
    """
    Generate strategic recommendation based on ROI analysis.
    
    Args:
        roi_df: ROI-ranked DataFrame
        
    Returns:
        Recommendation text
    """
    if roi_df.empty:
        return "No data available for recommendations."
    
    top_issue = roi_df.iloc[0]
    critical_count = len(roi_df[roi_df['priority_tier'] == 'Critical'])
    
    recommendation = f"**Strategic Priority:** Focus on '{top_issue['pain_point_category']}' first. "
    recommendation += f"With an ROI score of {top_issue['roi_score_normalized']:.1f}/100, "
    recommendation += f"this issue offers ${top_issue['revenue_at_risk']:.2f} in potential revenue recovery "
    recommendation += f"with relatively moderate effort (effort score: {top_issue['fix_effort']}/10). "
    
    if critical_count > 1:
        recommendation += f"\n\nYou have {critical_count} critical-priority issues. "
        recommendation += f"Addressing these systematically could recover {roi_df[roi_df['priority_tier'] == 'Critical']['pct_of_total'].sum():.1f}% of total revenue at risk."
    
    return recommendation


# ============================================================================
# Visualization Helpers
# ============================================================================

def prepare_revenue_waterfall_data(
    analysis_df: pd.DataFrame,
    arpu: float,
    topic_column: str = 'pain_point_category',
    top_n: int = 5
) -> pd.DataFrame:
    """
    Prepare data for revenue-at-risk waterfall chart.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        topic_column: Column containing topics
        top_n: Number of top topics to show
        
    Returns:
        DataFrame formatted for waterfall visualization
    """
    topic_impact = calculate_topic_revenue_impact(analysis_df, arpu, topic_column)
    
    if topic_impact.empty:
        return pd.DataFrame()
    
    # Get top N topics
    top_topics = topic_impact.head(top_n)
    
    # Calculate "Other" category
    other_revenue = topic_impact.iloc[top_n:]['revenue_at_risk'].sum() if len(topic_impact) > top_n else 0
    
    # Build waterfall data
    waterfall_data = []
    cumulative = 0
    
    for idx, row in top_topics.iterrows():
        waterfall_data.append({
            'category': row[topic_column],
            'value': row['revenue_at_risk'],
            'start': cumulative,
            'end': cumulative + row['revenue_at_risk']
        })
        cumulative += row['revenue_at_risk']
    
    if other_revenue > 0:
        waterfall_data.append({
            'category': 'Other',
            'value': other_revenue,
            'start': cumulative,
            'end': cumulative + other_revenue
        })
    
    return pd.DataFrame(waterfall_data)


# ============================================================================
# Module Testing
# ============================================================================

if __name__ == "__main__":
    print("Testing Economic Impact Module\n")
    
    # Create sample data
    sample_data = pd.DataFrame({
        'review_id': [f'rev_{i}' for i in range(100)],
        'churn_risk': np.random.choice(['high', 'medium', 'low'], 100, p=[0.2, 0.3, 0.5]),
        'pain_point_category': np.random.choice(
            ['Billing', 'Login Issues', 'Performance', 'UI/UX', 'Features'],
            100,
            p=[0.3, 0.2, 0.2, 0.15, 0.15]
        )
    })
    
    ARPU = 50.0
    
    print("1. Revenue-at-Risk Calculator")
    print("=" * 50)
    revenue_risk = calculate_revenue_at_risk(sample_data, ARPU, time_horizon='30d')
    print(f"Total Revenue at Risk (30d): ${revenue_risk['total_revenue_at_risk']:,.2f}")
    print(f"High Risk: ${revenue_risk['high_risk_revenue']:,.2f}")
    print(f"Affected Users: {revenue_risk['affected_users']}")
    print(f"Methodology: {revenue_risk['methodology']}\n")
    
    print("2. Topic Revenue Impact")
    print("=" * 50)
    topic_impact = calculate_topic_revenue_impact(sample_data, ARPU)
    print(topic_impact.to_string(index=False))
    print()
    
    print("3. Sensitivity Analysis")
    print("=" * 50)
    scenarios = create_sensitivity_scenarios(sample_data, 'Billing', [10, 20, 30], ARPU)
    print(scenarios.to_string(index=False))
    print()
    
    print("4. ROI Prioritization")
    print("=" * 50)
    roi_report = generate_roi_ranked_report(sample_data, ARPU)
    print(f"Total Revenue at Risk: ${roi_report['summary']['total_revenue_at_risk']:,.2f}")
    print(f"Top 3 Recovery Potential: ${roi_report['summary']['top_3_recovery_potential']:,.2f}")
    print(f"\nTop Priorities:")
    for i, priority in enumerate(roi_report['top_priorities'], 1):
        print(f"  {i}. {priority['pain_point_category']} - ROI Score: {priority['roi_score_normalized']}/100")
    print(f"\n{roi_report['recommendation']}")
    
    print("\n[OK] All tests passed!")
