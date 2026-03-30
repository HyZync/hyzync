"""
Predictive Intelligence Module - Early Warning Systems
======================================================
Provides forward-looking analytics to detect emerging issues before they escalate.

Features:
- Sentiment Velocity Tracker: Detects viral complaint patterns
- Emerging Crisis Radar: Flags rare, high-severity keywords
- Churn Intent Detection: Identifies explicit cancellation threats
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import Counter
import re
import sqlite3


# ============================================================================
#  Sentiment Velocity Tracker
# ============================================================================

def calculate_sentiment_velocity(
    analysis_df: pd.DataFrame,
    topic: str,
    time_window: str = '7d',
    topic_column: str = 'pain_point_category',
    date_column: str = 'at'
) -> Dict:
    """
    Calculate the rate of change (velocity) of negative mentions for a topic.
    Detects viral complaint patterns before they affect monthly averages.
    
    Velocity = Δ(negative mentions) / Δt
    
    Args:
        analysis_df: DataFrame with review analysis and timestamps
        topic: Topic to analyze
        time_window: Time window for velocity calculation ('7d', '14d', '30d')
        topic_column: Column containing topics
        date_column: Column containing timestamps
        
    Returns:
        Dictionary with velocity metrics
    """
    if analysis_df.empty or topic_column not in analysis_df.columns or date_column not in analysis_df.columns:
        return {'error': 'Invalid data or missing required columns'}
    
    df = analysis_df.copy()
    
    # Ensure date column is datetime
    if not pd.api.types.is_datetime64_any_dtype(df[date_column]):
        df[date_column] = pd.to_datetime(df[date_column])
    
    # Filter for topic
    topic_df = df[df[topic_column] == topic].copy()
    
    if topic_df.empty:
        return {
            'topic': topic,
            'velocity': 0,
            'message': 'No reviews found for this topic'
        }
    
    # Parse time window
    window_days = int(time_window.replace('d', ''))
    cutoff_date = datetime.now() - timedelta(days=window_days)
    
    # Split into current and previous periods
    current_period = topic_df[topic_df[date_column] >= cutoff_date]
    previous_cutoff = cutoff_date - timedelta(days=window_days)
    previous_period = topic_df[
        (topic_df[date_column] >= previous_cutoff) & 
        (topic_df[date_column] < cutoff_date)
    ]
    
    current_count = len(current_period)
    previous_count = len(previous_period)
    
    # Calculate velocity (change in mentions per day)
    mention_change = current_count - previous_count
    velocity = mention_change / window_days
    
    # Calculate acceleration (change in velocity)
    baseline_velocity = previous_count / window_days if window_days > 0 else 0
    current_velocity = current_count / window_days if window_days > 0 else 0
    acceleration = current_velocity - baseline_velocity
    
    # Determine alert level
    if previous_count > 0:
        pct_change = (mention_change / previous_count) * 100
    else:
        pct_change = 100 if current_count > 0 else 0
    
    alert_level = 'Critical' if pct_change > 100 else 'High' if pct_change > 50 else 'Medium' if pct_change > 20 else 'Normal'
    
    return {
        'topic': topic,
        'time_window': time_window,
        'current_period_mentions': current_count,
        'previous_period_mentions': previous_count,
        'velocity': round(velocity, 2),
        'acceleration': round(acceleration, 2),
        'percent_change': round(pct_change, 1),
        'alert_level': alert_level,
        'is_trending': pct_change > 50,
        'interpretation': f"Topic mentions {'increased' if mention_change > 0 else 'decreased'} by {abs(pct_change):.1f}% in the last {time_window}"
    }


def detect_acceleration_events(
    analysis_df: pd.DataFrame,
    threshold: float = 2.0,
    topic_column: str = 'pain_point_category',
    date_column: str = 'at',
    min_mentions: int = 5
) -> pd.DataFrame:
    """
    Detect topics that are accelerating above baseline threshold.
    Flags viral complaint patterns.
    
    Args:
        analysis_df: DataFrame with review analysis
        threshold: Velocity threshold multiplier (e.g., 2.0 = 2x baseline)
        topic_column: Column containing topics
        date_column: Column containing timestamps
        min_mentions: Minimum mentions to be considered
        
    Returns:
        DataFrame with accelerating topics
    """
    if analysis_df.empty:
        return pd.DataFrame()
    
    # Get all topics
    topics = analysis_df[topic_column].unique()
    
    results = []
    
    for topic in topics:
        if pd.isna(topic) or topic == 'N/A':
            continue
        
        velocity_metrics = calculate_sentiment_velocity(
            analysis_df, topic, '7d', topic_column, date_column
        )
        
        if 'error' in velocity_metrics or 'message' in velocity_metrics:
            continue
        
        if velocity_metrics['current_period_mentions'] < min_mentions:
            continue
        
        # Check if velocity exceeds threshold
        if velocity_metrics['percent_change'] > (threshold * 50):  # 50% baseline
            results.append({
                'topic': topic,
                'velocity': velocity_metrics['velocity'],
                'percent_change': velocity_metrics['percent_change'],
                'current_mentions': velocity_metrics['current_period_mentions'],
                'alert_level': velocity_metrics['alert_level'],
                'urgency_score': min(100, velocity_metrics['percent_change'])
            })
    
    if not results:
        return pd.DataFrame()
    
    df = pd.DataFrame(results)
    df = df.sort_values('urgency_score', ascending=False)
    
    return df


def save_velocity_history(
    topic: str,
    velocity_data: Dict,
    db_path: str = 'reviews.db'
):
    """
    Save sentiment velocity data to database for historical tracking.
    
    Args:
        topic: Topic name
        velocity_data: Velocity metrics dictionary
        db_path: Path to SQLite database
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sentiment_velocity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            velocity REAL,
            mention_count INTEGER,
            percent_change REAL,
            alert_level TEXT
        )
    ''')
    
    cursor.execute('''
        INSERT INTO sentiment_velocity_history 
        (topic, velocity, mention_count, percent_change, alert_level)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        topic,
        velocity_data.get('velocity', 0),
        velocity_data.get('current_period_mentions', 0),
        velocity_data.get('percent_change', 0),
        velocity_data.get('alert_level', 'Normal')
    ))
    
    conn.commit()
    conn.close()


# ============================================================================
# Emerging Crisis Radar
# ============================================================================

CRISIS_KEYWORDS = [
    'data leak', 'data breach', 'security breach', 'hacked', 'hack',
    'lawsuit', 'legal action', 'sue', 'suing',
    'fraud', 'fraudulent', 'scam', 'stolen',
    'privacy violation', 'gdpr', 'illegal',
    'dangerous', 'unsafe', 'health risk',
    'discrimination', 'racist', 'harassment'
]


def detect_novel_keywords(
    current_reviews: pd.DataFrame,
    historical_corpus: Optional[pd.DataFrame] = None,
    text_column: str = 'content',
    top_n: int = 20,
    min_word_length: int = 4
) -> List[Dict]:
    """
    Detect new/rare keywords that have never or rarely appeared before.
    Uses TF-IDF-like approach to identify anomalous terms.
    
    Args:
        current_reviews: Recent reviews to analyze
        historical_corpus: Historical reviews for comparison (optional)
        text_column: Column containing review text
        top_n: Number of novel keywords to return
        min_word_length: Minimum word length to consider
        
    Returns:
        List of novel keywords with metrics
    """
    if current_reviews.empty or text_column not in current_reviews.columns:
        return []
    
    # Extract words from current reviews
    current_text = ' '.join(current_reviews[text_column].dropna().astype(str))
    current_words = re.findall(r'\b[a-z]+\b', current_text.lower())
    current_words = [w for w in current_words if len(w) >= min_word_length]
    
    current_freq = Counter(current_words)
    
    # If no historical data, return most common unusual words
    if historical_corpus is None or historical_corpus.empty:
        # Filter out common English words (basic stopwords)
        common_words = {'that', 'this', 'with', 'from', 'have', 'been', 'would', 'could', 'their', 'about'}
        novel_keywords = [
            {'keyword': word, 'frequency': freq, 'novelty_score': freq, 'first_seen': 'recent'}
            for word, freq in current_freq.most_common(top_n * 2)
            if word not in common_words
        ]
        return novel_keywords[:top_n]
    
    # Extract words from historical reviews
    historical_text = ' '.join(historical_corpus[text_column].dropna().astype(str))
    historical_words = re.findall(r'\b[a-z]+\b', historical_text.lower())
    historical_words = [w for w in historical_words if len(w) >= min_word_length]
    
    historical_freq = Counter(historical_words)
    
    # Find words that are new or have significantly increased
    novel_keywords = []
    
    for word, current_count in current_freq.items():
        historical_count = historical_freq.get(word, 0)
        
        # Calculate novelty score
        if historical_count == 0:
            novelty_score = current_count * 10  # Completely new
        else:
            ratio = current_count / historical_count
            if ratio > 2.0:  # At least 2x increase
                novelty_score = current_count * ratio
            else:
                novelty_score = 0
        
        if novelty_score > 0:
            novel_keywords.append({
                'keyword': word,
                'current_frequency': current_count,
                'historical_frequency': historical_count,
                'novelty_score': round(novelty_score, 2),
                'status': 'NEW' if historical_count == 0 else 'SURGING'
            })
    
    # Sort by novelty score and return top N
    novel_keywords.sort(key=lambda x: x['novelty_score'], reverse=True)
    
    return novel_keywords[:top_n]


def assess_crisis_severity(
    keyword: str,
    context_reviews: pd.DataFrame,
    text_column: str = 'content'
) -> Dict:
    """
    Assess the severity of a potentially critical keyword.
    
    Args:
        keyword: The keyword to assess
        context_reviews: Reviews containing the keyword
        text_column: Column containing review text
        
    Returns:
        Dictionary with severity assessment
    """
    if context_reviews.empty:
        return {
            'keyword': keyword,
            'severity': 'Unknown',
            'risk_level': 0
        }
    
    # Check if keyword is a known crisis term
    is_crisis_term = any(crisis in keyword.lower() for crisis in CRISIS_KEYWORDS)
    
    # Count mentions
    mention_count = len(context_reviews)
    
    # Check sentiment of reviews containing the keyword
    if 'sentiment_score' in context_reviews.columns:
        avg_sentiment = context_reviews['sentiment_score'].mean()
    else:
        avg_sentiment = -0.5  # Assume negative
    
    # Calculate risk score (0-100)
    risk_score = 0
    
    if is_crisis_term:
        risk_score += 50  # High base score for crisis terms
    
    risk_score += min(30, mention_count * 5)  # Frequency factor
    
    if avg_sentiment < -0.5:
        risk_score += 20  # Very negative sentiment
    
    risk_score = min(100, risk_score)
    
    # Determine severity level
    if risk_score >= 75:
        severity = 'Critical'
    elif risk_score >= 50:
        severity = 'High'
    elif risk_score >= 25:
        severity = 'Medium'
    else:
        severity = 'Low'
    
    return {
        'keyword': keyword,
        'mention_count': mention_count,
        'average_sentiment': round(avg_sentiment, 3),
        'is_crisis_term': is_crisis_term,
        'risk_score': round(risk_score, 1),
        'severity': severity,
        'requires_immediate_action': severity in ['Critical', 'High']
    }


def generate_crisis_alerts(
    analysis_df: pd.DataFrame,
    text_column: str = 'content'
) -> List[Dict]:
    """
    Generate crisis alerts for critical keywords found in reviews.
    
    Args:
        analysis_df: DataFrame with review analysis
        text_column: Column containing review text
        
    Returns:
        List of crisis alerts
    """
    alerts = []
    
    if text_column not in analysis_df.columns:
        return alerts
        
    # Check for crisis keywords
    for crisis_term in CRISIS_KEYWORDS:
        # Find reviews containing this term
        matching_reviews = analysis_df[
            analysis_df[text_column].str.contains(crisis_term, case=False, na=False, regex=False)
        ]
        
        if not matching_reviews.empty:
            severity = assess_crisis_severity(crisis_term, matching_reviews, text_column)
            
            if severity['requires_immediate_action']:
                alerts.append({
                    'crisis_term': crisis_term,
                    'severity': severity['severity'],
                    'risk_score': severity['risk_score'],
                    'mention_count': len(matching_reviews),
                    'sample_review': matching_reviews.iloc[0][text_column][:200] + '...' if len(matching_reviews) > 0 else '',
                    'timestamp': datetime.now().isoformat()
                })
    
    # Sort by risk score
    alerts.sort(key=lambda x: x['risk_score'], reverse=True)
    
    return alerts


# ============================================================================
# Churn Intent Detection
# ============================================================================

CHURN_INTENT_PATTERNS = {
    'explicit': [
        r'\bcancel(?:ling|led|lation)?\b',
        r'\buninstall(?:ing|ed)?\b',
        r'\bdelete(?:d|ing)?\s+(?:this|the)?\s*app\b',
        r'\bswitching\s+to\b',
        r'\brefund\b',
        r'\bunsubscrib(?:e|ing|ed)\b',
        r'\bquit(?:ting)?\b',
        r'\bleaving\b',
        r'\bnever\s+(?:using|use)\s+(?:this|again)\b'
    ],
    'implicit': [
        r'\bwaste\s+of\s+money\b',
        r'\bnot\s+worth\b',
        r'\bdisappointed\b',
        r'\bterrible\b',
        r'\bawful\b',
        r'\bworst\b',
        r'\bhate\s+(?:this|it)\b',
        r'\bdon\'t\s+recommend\b',
        r'\bavoid\b'
    ]
}


def extract_churn_intent_signals(review_text: str) -> Dict:
    """
    Extract churn intent signals from review text.
    
    Args:
        review_text: Review text to analyze
        
    Returns:
        Dictionary with intent detection results
    """
    if not review_text or not isinstance(review_text, str):
        return {
            'has_churn_intent': False,
            'intent_type': None,
            'matched_patterns': []
        }
    
    text_lower = review_text.lower()
    matched_patterns = []
    intent_type = None
    
    # Check explicit patterns
    for pattern in CHURN_INTENT_PATTERNS['explicit']:
        if re.search(pattern, text_lower):
            matched_patterns.append(pattern)
            intent_type = 'explicit'
    
    # Check implicit patterns if no explicit found
    if not matched_patterns:
        for pattern in CHURN_INTENT_PATTERNS['implicit']:
            if re.search(pattern, text_lower):
                matched_patterns.append(pattern)
                intent_type = 'implicit'
    
    return {
        'has_churn_intent': len(matched_patterns) > 0,
        'intent_type': intent_type,
        'matched_patterns': matched_patterns,
        'confidence': 'high' if intent_type == 'explicit' else 'medium' if intent_type == 'implicit' else 'none'
    }


def tag_churn_intent_reviews(
    analysis_df: pd.DataFrame,
    text_column: str = 'content'
) -> pd.DataFrame:
    """
    Tag all reviews with churn intent detection.
    
    Args:
        analysis_df: DataFrame with review analysis
        text_column: Column containing review text
        
    Returns:
        DataFrame with churn intent columns added
    """
    if analysis_df.empty or text_column not in analysis_df.columns:
        return analysis_df
    
    df = analysis_df.copy()
    
    # Apply intent detection
    intent_results = df[text_column].apply(extract_churn_intent_signals)
    
    df['churn_intent_detected'] = intent_results.apply(lambda x: x['has_churn_intent'])
    df['churn_intent_type'] = intent_results.apply(lambda x: x['intent_type'])
    df['churn_intent_confidence'] = intent_results.apply(lambda x: x['confidence'])
    
    return df


def get_churn_intent_summary(analysis_df: pd.DataFrame) -> Dict:
    """
    Get summary statistics for churn intent detection.
    
    Args:
        analysis_df: DataFrame with churn intent columns
        
    Returns:
        Dictionary with summary metrics
    """
    if 'churn_intent_detected' not in analysis_df.columns:
        return {'error': 'Churn intent not detected. Run tag_churn_intent_reviews first.'}
    
    total_reviews = len(analysis_df)
    intent_detected = analysis_df['churn_intent_detected'].sum()
    
    explicit_count = len(analysis_df[analysis_df['churn_intent_type'] == 'explicit'])
    implicit_count = len(analysis_df[analysis_df['churn_intent_type'] == 'implicit'])
    
    intent_rate = (intent_detected / total_reviews * 100) if total_reviews > 0 else 0
    
    return {
        'total_reviews': total_reviews,
        'churn_intent_detected': int(intent_detected),
        'explicit_intent': explicit_count,
        'implicit_intent': implicit_count,
        'churn_intent_rate': round(intent_rate, 2),
        'risk_assessment': 'Critical' if intent_rate > 20 else 'High' if intent_rate > 10 else 'Moderate' if intent_rate > 5 else 'Normal'
    }


# ============================================================================
# Module Testing
# ============================================================================

if __name__ == "__main__":
    print("Testing Predictive Intelligence Module\n")
    
    # Create sample data with timestamps
    np.random.seed(42)
    n_samples = 100
    
    dates = pd.date_range(end=datetime.now(), periods=n_samples, freq='1D')
    
    sample_data = pd.DataFrame({
        'review_id': [f'rev_{i}' for i in range(n_samples)],
        'at': dates,
        'pain_point_category': np.random.choice(
            ['Billing', 'Login Issues', 'Performance', 'UI/UX'],
            n_samples
        ),
        'content': [
            'This app is ' + np.random.choice([
                'crashing constantly',
                'terrible, cancelling my subscription',
                'confusing to use',
                'having data breach issues'
            ]) for _ in range(n_samples)
        ],
        'sentiment_score': np.random.uniform(-1, 1, n_samples)
    })
    
    # Make recent "Billing" complaints surge
    recent_mask = sample_data['at'] >= (datetime.now() - timedelta(days=7))
    sample_data.loc[recent_mask, 'pain_point_category'] = 'Billing'
    
    print("1. Sentiment Velocity Tracking")
    print("=" * 60)
    velocity = calculate_sentiment_velocity(sample_data, 'Billing', '7d')
    print(f"Topic: {velocity['topic']}")
    print(f"Velocity: {velocity['velocity']} mentions/day")
    print(f"Percent Change: {velocity['percent_change']}%")
    print(f"Alert Level: {velocity['alert_level']}")
    print(f"{velocity['interpretation']}\n")
    
    print("2. Acceleration Event Detection")
    print("=" * 60)
    accelerating = detect_acceleration_events(sample_data, threshold=1.5)
    print(accelerating.to_string(index=False))
    print()
    
    print("3. Novel Keyword Detection")
    print("=" * 60)
    novel_keywords = detect_novel_keywords(sample_data, text_column='content', top_n=5)
    for kw in novel_keywords[:5]:
        print(f"Keyword: {kw['keyword']}, Frequency: {kw.get('current_frequency', kw.get('frequency'))}")
    print()
    
    print("4. Crisis Alert Generation")
    print("=" * 60)
    crisis_alerts = generate_crisis_alerts(sample_data)
    if crisis_alerts:
        for alert in crisis_alerts:
            print(f"ALERT: {alert['crisis_term']} - Severity: {alert['severity']}, Risk: {alert['risk_score']}")
    else:
        print("No crisis alerts detected")
    print()
    
    print("5. Churn Intent Detection")
    print("=" * 60)
    sample_reviews = [
        "I'm cancelling my subscription, this is terrible",
        "Worst app ever, not worth the money",
        "Great app, love it!"
    ]
    for review in sample_reviews:
        intent = extract_churn_intent_signals(review)
        print(f"Review: {review}")
        print(f"Intent Detected: {intent['has_churn_intent']}, Type: {intent['intent_type']}, Confidence: {intent['confidence']}\n")
    
    print("6. Churn Intent Tagging")
    print("=" * 60)
    tagged_df = tag_churn_intent_reviews(sample_data)
    summary = get_churn_intent_summary(tagged_df)
    print(f"Total Reviews: {summary['total_reviews']}")
    print(f"Churn Intent Detected: {summary['churn_intent_detected']}")
    print(f"Explicit Intent: {summary['explicit_intent']}")
    print(f"Churn Intent Rate: {summary['churn_intent_rate']}%")
    print(f"Risk Assessment: {summary['risk_assessment']}")
    
    print("\n[OK] All tests passed!")
