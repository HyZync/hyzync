"""
Competitive Intelligence Module - Market Context & Competitive Analysis
=======================================================================
Provides competitive insights by analyzing competitor mentions and feature gaps.

Features:
- Defection Analysis: Tracks users switching to competitors
- Feature Gap Matrix: Compares feature sentiment across competitors
- Competitive Threat Assessment: Identifies which competitors are gaining traction
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import re
import sqlite3


# ============================================================================
# Competitor Detection Patterns
# ============================================================================

SWITCHING_PATTERNS = [
    r'\bswitching\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'\bmoved?\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'\btrying\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+instead',
    r'\bdownloaded\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+instead',
    r'\busing\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+now',
    r'\bleft\s+for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
]

COMPARISON_PATTERNS = [
    r'\bbetter\s+than\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'\bworse\s+than\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'\bcompared\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'\blike\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+but',
    r'\bunlike\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
]


# ============================================================================
# Defection Analysis
# ============================================================================

def extract_competitor_mentions(
    review_text: str,
    known_competitors: Optional[List[str]] = None
) -> Dict:
    """
    Extract competitor mentions from review text.
    
    Args:
        review_text: Review text to analyze
        known_competitors: Optional list of known competitor names
        
    Returns:
        Dictionary with competitor mentions and context
    """
    if not review_text or not isinstance(review_text, str):
        return {
            'has_competitor_mention': False,
            'competitors': [],
            'context': None
        }
    
    mentioned_competitors = []
    context = None
    
    # Check for switching patterns (defection)
    for pattern in SWITCHING_PATTERNS:
        matches = re.findall(pattern, review_text)
        for match in matches:
            mentioned_competitors.append({
                'name': match.strip(),
                'type': 'defection',
                'context': 'switching'
            })
            context = 'defection'
    
    # Check for comparison patterns
    if not mentioned_competitors:
        for pattern in COMPARISON_PATTERNS:
            matches = re.findall(pattern, review_text)
            for match in matches:
                mentioned_competitors.append({
                    'name': match.strip(),
                    'type': 'comparison',
                    'context': 'comparison'
                })
                context = 'comparison'
    
    # Filter by known competitors if provided
    if known_competitors:
        known_lower = [c.lower() for c in known_competitors]
        mentioned_competitors = [
            m for m in mentioned_competitors
            if m['name'].lower() in known_lower
        ]
    
    return {
        'has_competitor_mention': len(mentioned_competitors) > 0,
        'competitors': mentioned_competitors,
        'context': context
    }


def analyze_defection_patterns(
    analysis_df: pd.DataFrame,
    text_column: str = 'content',
    known_competitors: Optional[List[str]] = None
) -> pd.DataFrame:
    """
    Analyze defection patterns across all reviews.
    
    Args:
        analysis_df: DataFrame with review analysis
        text_column: Column containing review text
        known_competitors: Optional list of known competitors
        
    Returns:
        DataFrame with defection analysis by competitor
    """
    if analysis_df.empty or text_column not in analysis_df.columns:
        return pd.DataFrame()
    
    # Extract competitor mentions from all reviews
    competitor_data = []
    
    for idx, row in analysis_df.iterrows():
        mentions = extract_competitor_mentions(row[text_column], known_competitors)
        
        if mentions['has_competitor_mention']:
            for comp in mentions['competitors']:
                competitor_data.append({
                    'review_id': row.get('review_id', idx),
                    'competitor': comp['name'],
                    'mention_type': comp['type'],
                    'sentiment': row.get('sentiment_score', 0),
                    'churn_risk': row.get('churn_risk', 'unknown'),
                    'review_text': row[text_column][:200]  # Sample
                })
    
    if not competitor_data:
        return pd.DataFrame()
    
    defection_df = pd.DataFrame(competitor_data)
    
    # Aggregate by competitor
    summary = defection_df.groupby('competitor').agg({
        'review_id': 'count',
        'sentiment': 'mean'
    }).reset_index()
    
    summary.columns = ['competitor', 'mention_count', 'avg_sentiment']
    
    # Count defections specifically
    defection_counts = defection_df[defection_df['mention_type'] == 'defection'].groupby('competitor').size()
    summary['defection_count'] = summary['competitor'].map(defection_counts).fillna(0).astype(int)
    
    # Sort by threat level (defections + mentions)
    summary['threat_score'] = summary['defection_count'] * 2 + summary['mention_count']
    summary = summary.sort_values('threat_score', ascending=False)
    
    # Add threat level
    summary['threat_level'] = summary['threat_score'].apply(
        lambda x: 'Critical' if x >= 10 else 'High' if x >= 5 else 'Medium' if x >= 2 else 'Low'
    )
    
    return summary


def get_defection_reasons(
    analysis_df: pd.DataFrame,
    competitor: str,
    text_column: str = 'content',
    topic_column: str = 'pain_point_category'
) -> Dict:
    """
    Analyze the reasons users are switching to a specific competitor.
    
    Args:
        analysis_df: DataFrame with review analysis
        competitor: Competitor name
        text_column: Column containing review text
        topic_column: Column containing topics
        
    Returns:
        Dictionary with defection reasons
    """
    # Find reviews mentioning this competitor
    competitor_reviews = []
    
    for idx, row in analysis_df.iterrows():
        mentions = extract_competitor_mentions(row[text_column])
        if any(c['name'].lower() == competitor.lower() for c in mentions['competitors']):
            competitor_reviews.append(row)
    
    if not competitor_reviews:
        return {
            'competitor': competitor,
            'sample_size': 0,
            'message': 'No reviews found mentioning this competitor'
        }
    
    competitor_df = pd.DataFrame(competitor_reviews)
    
    # Analyze common pain points
    if topic_column in competitor_df.columns:
        common_topics = competitor_df[topic_column].value_counts().head(5).to_dict()
    else:
        common_topics = {}
    
    # Sample quotes
    sample_quotes = competitor_df[text_column].head(3).tolist()
    
    return {
        'competitor': competitor,
        'sample_size': len(competitor_df),
        'common_pain_points': common_topics,
        'avg_sentiment': round(competitor_df.get('sentiment_score', pd.Series([0])).mean(), 3),
        'sample_quotes': sample_quotes
    }


def save_competitor_mention(
    review_id: str,
    competitor_name: str,
    context: str,
    db_path: str = 'reviews.db'
):
    """
    Save competitor mention to database for tracking.
    
    Args:
        review_id: Review identifier
        competitor_name: Competitor name
        context: Context of mention (defection, comparison)
        db_path: Path to SQLite database
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS competitor_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id TEXT NOT NULL,
            competitor_name TEXT NOT NULL,
            context TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        INSERT INTO competitor_mentions (review_id, competitor_name, context)
        VALUES (?, ?, ?)
    ''', (review_id, competitor_name, context))
    
    conn.commit()
    conn.close()


# ============================================================================
# Feature Gap Matrix
# ============================================================================

def compare_feature_sentiment(
    client_df: pd.DataFrame,
    feature_keywords: Dict[str, List[str]],
    text_column: str = 'content',
    sentiment_column: str = 'sentiment_score'
) -> pd.DataFrame:
    """
    Compare sentiment for specific features in client's app.
    This forms the baseline for competitor comparison.
    
    Args:
        client_df: DataFrame with client app reviews
        feature_keywords: Dict mapping feature names to detection keywords
        text_column: Column containing review text
        sentiment_column: Column containing sentiment scores
        
    Returns:
        DataFrame with feature sentiment analysis
    """
    if client_df.empty or text_column not in client_df.columns:
        return pd.DataFrame()
    
    feature_results = []
    
    for feature, keywords in feature_keywords.items():
        # Find reviews mentioning this feature
        pattern = '|'.join([re.escape(kw) for kw in keywords])
        feature_reviews = client_df[
            client_df[text_column].str.contains(pattern, case=False, na=False, regex=True)
        ]
        
        if not feature_reviews.empty:
            avg_sentiment = feature_reviews[sentiment_column].mean()
            mention_count = len(feature_reviews)
            
            # Calculate satisfaction
            positive_count = len(feature_reviews[feature_reviews[sentiment_column] > 0])
            satisfaction_pct = (positive_count / mention_count * 100) if mention_count > 0 else 0
            
            feature_results.append({
                'feature': feature,
                'mention_count': mention_count,
                'avg_sentiment': round(avg_sentiment, 3),
                'satisfaction_pct': round(satisfaction_pct, 1),
                'sentiment_category': 'Positive' if avg_sentiment > 0.2 else 'Neutral' if avg_sentiment > -0.2 else 'Negative'
            })
    
    if not feature_results:
        return pd.DataFrame()
    
    return pd.DataFrame(feature_results).sort_values('avg_sentiment', ascending=False)


def generate_gap_matrix(
    client_features: pd.DataFrame,
    competitor_features: Optional[Dict[str, pd.DataFrame]] = None
) -> pd.DataFrame:
    """
    Generate a feature gap matrix comparing client vs competitors.
    
    Args:
        client_features: DataFrame with client feature sentiment
        competitor_features: Optional dict mapping competitor names to their feature DataFrames
        
    Returns:
        DataFrame with gap analysis
    """
    if client_features.empty:
        return pd.DataFrame()
    
    # Start with client data
    matrix = client_features[['feature', 'avg_sentiment', 'satisfaction_pct']].copy()
    matrix.columns = ['feature', 'client_sentiment', 'client_satisfaction']
    
    # Add competitor data if available
    if competitor_features:
        for competitor_name, comp_df in competitor_features.items():
            if not comp_df.empty:
                # Merge competitor data
                comp_subset = comp_df[['feature', 'avg_sentiment']].copy()
                comp_subset.columns = ['feature', f'{competitor_name}_sentiment']
                
                matrix = matrix.merge(comp_subset, on='feature', how='left')
                
                # Calculate gap
                matrix[f'{competitor_name}_gap'] = matrix['client_sentiment'] - matrix[f'{competitor_name}_sentiment']
    
    # Identify gaps (negative = competitor is better)
    if competitor_features:
        gap_columns = [col for col in matrix.columns if col.endswith('_gap')]
        if gap_columns:
            matrix['worst_gap'] = matrix[gap_columns].min(axis=1)
            matrix['best_gap'] = matrix[gap_columns].max(axis=1)
            
            # Flag critical gaps
            matrix['has_critical_gap'] = matrix['worst_gap'] < -0.3
    
    return matrix.sort_values('client_sentiment', ascending=True)


def identify_opportunity_features(
    gap_matrix: pd.DataFrame,
    min_gap: float = -0.3
) -> List[Dict]:
    """
    Identify features where competitors have a significant advantage.
    These are improvement opportunities.
    
    Args:
        gap_matrix: Feature gap matrix
        min_gap: Minimum gap to be considered significant (negative)
        
    Returns:
        List of opportunity features
    """
    if gap_matrix.empty or 'worst_gap' not in gap_matrix.columns:
        return []
    
    # Find features with significant gaps
    opportunities = gap_matrix[gap_matrix['worst_gap'] < min_gap].copy()
    
    if opportunities.empty:
        return []
    
    # Sort by gap size (most negative first)
    opportunities = opportunities.sort_values('worst_gap')
    
    results = []
    for _, row in opportunities.iterrows():
        results.append({
            'feature': row['feature'],
            'client_sentiment': round(row['client_sentiment'], 3),
            'gap_size': round(row['worst_gap'], 3),
            'priority': 'Critical' if row['worst_gap'] < -0.5 else 'High' if row['worst_gap'] < -0.3 else 'Medium',
            'opportunity_type': 'Feature Enhancement' if row['client_sentiment'] < 0 else 'Feature Optimization'
        })
    
    return results


# ============================================================================
# Competitive Threat Assessment
# ============================================================================

def generate_competitive_threat_report(
    analysis_df: pd.DataFrame,
    text_column: str = 'content',
    known_competitors: Optional[List[str]] = None
) -> Dict:
    """
    Generate comprehensive competitive threat assessment.
    
    Args:
        analysis_df: DataFrame with review analysis
        text_column: Column containing review text
        known_competitors: Optional list of known competitors
        
    Returns:
        Dictionary with threat assessment
    """
    # Analyze defections
    defection_summary = analyze_defection_patterns(analysis_df, text_column, known_competitors)
    
    if defection_summary.empty:
        return {
            'summary': 'No competitive threats detected in current review set',
            'top_threats': [],
            'total_defections': 0
        }
    
    # Identify top threats
    top_threats = defection_summary.head(3).to_dict('records')
    
    # Calculate total defection count
    total_defections = defection_summary['defection_count'].sum()
    total_mentions = defection_summary['mention_count'].sum()
    
    # Get defection rate
    total_reviews = len(analysis_df)
    defection_rate = (total_defections / total_reviews * 100) if total_reviews > 0 else 0
    
    return {
        'summary': {
            'total_competitors_mentioned': len(defection_summary),
            'total_defections': int(total_defections),
            'total_competitor_mentions': int(total_mentions),
            'defection_rate': round(defection_rate, 2),
            'alert_level': 'Critical' if defection_rate > 10 else 'High' if defection_rate > 5 else 'Moderate'
        },
        'top_threats': top_threats,
        'recommendation': generate_competitive_recommendation(top_threats, defection_rate)
    }


def generate_competitive_recommendation(
    top_threats: List[Dict],
    defection_rate: float
) -> str:
    """
    Generate competitive strategy recommendation.
    
    Args:
        top_threats: List of top competitive threats
        defection_rate: Overall defection rate
        
    Returns:
        Recommendation text
    """
    if not top_threats:
        return "No immediate competitive threats detected. Continue monitoring competitor mentions."
    
    top_threat = top_threats[0]
    
    recommendation = f"**Competitive Alert:** '{top_threat['competitor']}' represents the primary competitive threat "
    recommendation += f"with {top_threat['defection_count']} explicit defections ({top_threat['mention_count']} total mentions). "
    
    if defection_rate > 5:
        recommendation += f"\n\n**Urgent:** Defection rate of {defection_rate:.1f}% requires immediate retention interventions. "
        recommendation += "Recommended actions: (1) Analyze feature gaps vs. this competitor, "
        recommendation += "(2) Deploy targeted retention campaigns for at-risk segments, "
        recommendation += "(3) Fast-track critical feature development to match competitor capabilities."
    else:
        recommendation += "\n\nMonitor competitor activity and consider feature parity analysis."
    
    return recommendation


# ============================================================================
# Module Testing
# ============================================================================

if __name__ == "__main__":
    print("Testing Competitive Intelligence Module\n")
    
    # Create sample data
    sample_data = pd.DataFrame({
        'review_id': [f'rev_{i}' for i in range(20)],
        'content': [
            "Switching to Competitor A because of billing issues",
            "This app is terrible, moved to Competitor B",
            "Better than Competitor C but still buggy",
            "Trying Competitor A instead, much faster",
            "Dark mode is great unlike Competitor B",
            "Performance is worse than Competitor A",
            "Love this app!",
            "Crashes all the time, downloading Competitor B now",
            "UI is confusing compared to Competitor A",
            "Left for Competitor C, they have better features",
            "Dark mode doesn't work well",
            "Billing is broken, using Competitor A now",
            "Great customer support",
            "Performance is amazing",
            "Dark mode is perfect",
            "Compared to Competitor B, this is much better",
            "Unlike Competitor A, this app actually works",
            "Terrible dark mode",
            "Performance issues everywhere",
            "Switching to Competitor A"
        ],
        'sentiment_score': np.random.uniform(-1, 1, 20),
        'churn_risk': np.random.choice(['high', 'medium', 'low'], 20),
        'pain_point_category': np.random.choice(['Billing', 'Performance', 'UI/UX', 'Features'], 20)
    })
    
    known_competitors = ['Competitor A', 'Competitor B', 'Competitor C']
    
    print("1. Defection Analysis")
    print("=" * 60)
    defection_summary = analyze_defection_patterns(sample_data, known_competitors=known_competitors)
    print(defection_summary.to_string(index=False))
    print()
    
    print("2. Defection Reasons")
    print("=" * 60)
    reasons = get_defection_reasons(sample_data, 'Competitor A')
    print(f"Competitor: {reasons['competitor']}")
    print(f"Sample Size: {reasons['sample_size']}")
    print(f"Common Pain Points: {reasons['common_pain_points']}")
    print()
    
    print("3. Feature Sentiment Analysis")
    print("=" * 60)
    feature_keywords = {
        'Dark Mode': ['dark mode', 'dark theme'],
        'Performance': ['performance', 'speed', 'fast', 'slow'],
        'Billing': ['billing', 'payment', 'charge']
    }
    feature_sentiment = compare_feature_sentiment(sample_data, feature_keywords)
    print(feature_sentiment.to_string(index=False))
    print()
    
    print("4. Competitive Threat Report")
    print("=" * 60)
    threat_report = generate_competitive_threat_report(sample_data, known_competitors=known_competitors)
    print(f"Total Competitors Mentioned: {threat_report['summary']['total_competitors_mentioned']}")
    print(f"Total Defections: {threat_report['summary']['total_defections']}")
    print(f"Defection Rate: {threat_report['summary']['defection_rate']}%")
    print(f"Alert Level: {threat_report['summary']['alert_level']}")
    print(f"\nTop Threats:")
    for threat in threat_report['top_threats']:
        print(f"  - {threat['competitor']}: {threat['defection_count']} defections ({threat['threat_level']} threat)")
    print(f"\n{threat_report['recommendation']}")
    
    print("\n[OK] All tests passed!")
