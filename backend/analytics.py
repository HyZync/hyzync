
import pandas as pd
from datetime import datetime, timedelta

# --- Metric Calculation Helpers ---

def calculate_nps(scores):
    """Calculates Net Promoter Score (NPS) from a series of sentiment scores (-1.0 to 1.0)."""
    if scores.empty: return 0
    # Map sentiment score to NPS categories: Promoters (>0.5), Passives (-0.5 to 0.5), Detractors (<-0.5)
    total = len(scores)
    # Ensure scores are numeric
    scores = pd.to_numeric(scores, errors='coerce').dropna()
    if scores.empty: return 0
    
    promoters = (scores > 0.5).sum()
    detractors = (scores < -0.5).sum()
    return round((promoters - detractors) / total * 100) if total > 0 else 0

def calculate_csat(df_or_scores):
    """
    CSAT = (Positive responses / Total responses) × 100.
    Uses the LLM-assigned `sentiment` field directly:
        positive → satisfied
        neutral  → passive
        negative → dissatisfied
    Accepts either a DataFrame (preferred, uses 'sentiment' column)
    or a Series of sentiment strings for backwards compatibility.
    """
    if isinstance(df_or_scores, pd.DataFrame):
        if df_or_scores.empty: return 0
        if 'sentiment' not in df_or_scores.columns:
            return 0
        total = len(df_or_scores)
        positive = (df_or_scores['sentiment'].str.lower() == 'positive').sum()
    else:
        # Legacy: series of sentiment strings or scores
        series = df_or_scores
        if hasattr(series, 'empty') and series.empty: return 0
        series = series.dropna()
        if len(series) == 0: return 0
        total = len(series)
        # Detect if it's string sentiment or numeric scores
        if series.dtype == object or str(series.dtype) == 'object':
            positive = (series.str.lower() == 'positive').sum()
        else:
            # Fallback numeric: >=0.3 threshold
            positive = (pd.to_numeric(series, errors='coerce') >= 0.3).sum()
    return round((positive / total) * 100, 2) if total > 0 else 0

def calculate_ces(scores):
    """Calculates Customer Effort Score (CES) - Mock metric based on inverse dissatisfaction."""
    if scores.empty: return 0
    scores = pd.to_numeric(scores, errors='coerce').dropna()
    if scores.empty: return 0
    
    # Mock CES (lower score means less effort/better) based on low churn risk/high satisfaction
    # We use a simple inverse: 1 - (average of scores where -1 maps to 5, 1 maps to 1)
    # range of scores is -1 to 1. 
    # if score is 1 (great), effort should be low (1).
    # if score is -1 (bad), effort should be high (5).
    # map: 5 - ((score + 1) * 2) ? 
    # let's stick to legacy logic: (1 - scores).mean() * 5 might be a bit raw but we keep consistency.
    normalized_effort = (1 - scores).mean() * 5 # Scale to 1-5 effort scale (mock)
    # Cap between 1 and 5
    normalized_effort = max(1.0, min(5.0, normalized_effort))
    return round(normalized_effort, 1)

def calculate_health_score(results):
    """
    Calculate overall health score (0-100) from key metrics.
    Weight: NPS=40%, CSAT=30%, CES=20%, Risk=10%
    """
    nps_val = results.get('nps_score', 0)
    csat_val = results.get('csat_score', 0)
    ces_val = results.get('ces_score', 0)
    risk_val = results.get('retention_risk_pct', 0)

    nps_normalized = (nps_val + 100) / 2  # Convert -100/100 to 0-100
    ces_inverted = 100 - (ces_val * 10)  # Lower is better, so invert. CES is 1-5. 5*10=50. 100-50=50. 1*10=10. 100-10=90.
    risk_inverted = 100 - risk_val
    
    health = (
        nps_normalized * 0.4 +
        csat_val * 0.3 +
        ces_inverted * 0.2 +
        risk_inverted * 0.1
    )
    return round(health, 1)

def categorize_metrics(analysis_df):
    """
    Categorize pain points into 4 quadrants based on sentiment and volume.
    Uses granular fields ('root_cause', 'trending_theme') for labels to be specific.
    Returns dict with 'important_strengths', 'important_weaknesses', 
    'unimportant_strengths', 'unimportant_weaknesses'
    """
    categorized = {
        'important_strengths': [], 'important_weaknesses': [],
        'unimportant_strengths': [], 'unimportant_weaknesses': []
    }
    
    total_analyzed = len(analysis_df)
    if analysis_df.empty or total_analyzed == 0:
        return categorized
    
    # helper to clean labels
    def clean_label(val):
        if not isinstance(val, str): return None
        val = val.strip()
        if not val or val.lower() in ['n/a', 'none', 'unknown', 'null']: return None
        
        # Strip redundant prefixes
        prefixes = ["issue with ", "problem with ", "difficulty with ", "trouble with ", "complaint about "]
        for p in prefixes:
            if val.lower().startswith(p):
                val = val[len(p):]
                
        return val

    # 1. Assign a 'Specific Label' to each review
    labels = []
    for idx, row in analysis_df.iterrows():
        sentiment = row.get('sentiment_score', 0)
        label = None
        
        # WEAKNESS (Negative) -> Prioritize Root Cause, then Issue
        if sentiment < -0.1:
            label = clean_label(row.get('root_cause'))
            if not label: label = clean_label(row.get('issue'))
            if not label: label = str(row.get('pain_point_category', 'Other'))
            
        # STRENGTH (Positive) -> Prioritize Trending Theme, then Category
        else:
            label = clean_label(row.get('trending_theme'))
            if not label: label = str(row.get('pain_point_category', 'Other'))
            
        if not label: label = "Other"
        
        # Normalize label (Capitalize first letter)
        label = label[0].upper() + label[1:]
            
        labels.append({
            "label": label,
            "sentiment": sentiment,
            "review_idx": idx, # Track which review this is
            "category": row.get('pain_point_category', 'Other')
        })
        
    if not labels:
        return categorized
        
    labeled_df = pd.DataFrame(labels)
    
    # 2. Aggregate by Label
    stats = labeled_df.groupby('label').agg(
        count=('label', 'size'),
        avg_sentiment=('sentiment', 'mean'),
        review_indices=('review_idx', list) # Collect review indices for synthesis
    ).reset_index()
    
    # 3. Determine Volume Threshold
    if len(stats) > 4:
        volume_threshold = stats['count'].quantile(0.75)
    else:
        volume_threshold = stats['count'].median()
        
    volume_threshold = max(volume_threshold, 1)

    for _, row in stats.iterrows():
        is_high_volume = row['count'] >= volume_threshold
        is_positive = row['avg_sentiment'] > 0.1
        is_negative = row['avg_sentiment'] < -0.1
        
        metric = {
            'name': row['label'], # Standard for UI
            'category': row['label'], # Compatibility
            'sentiment': round(row['avg_sentiment'], 2),
            'mentions': int(row['count']),
            'pct': round(row['count'] / total_analyzed * 100, 1),
            'review_indices': row['review_indices'] # For synthesis
        }
        
        if is_high_volume and is_positive:
            categorized['important_strengths'].append(metric)
        elif is_high_volume and is_negative:
            categorized['important_weaknesses'].append(metric)
        elif not is_high_volume and is_positive:
            categorized['unimportant_strengths'].append(metric)
        elif not is_high_volume and is_negative:
            categorized['unimportant_weaknesses'].append(metric)
            
    # Sort
    categorized['important_strengths'].sort(key=lambda x: x['sentiment'], reverse=True)
    categorized['important_weaknesses'].sort(key=lambda x: x['sentiment'])
    categorized['unimportant_strengths'].sort(key=lambda x: x['sentiment'], reverse=True)
    categorized['unimportant_weaknesses'].sort(key=lambda x: x['sentiment'])
    
    return categorized

def get_health_metrics(analysis_df):
    """
    Main entry point to calculate all health metrics from a dataframe.
    """
    if analysis_df.empty:
        return {
            "health_score": 0,
            "nps_score": 0,
            "csat_score": 0,
            "ces_score": 0,
            "retention_risk_pct": 0,
            "total_reviews": 0
        }
        
    scores = analysis_df['sentiment_score']
    
    nps = calculate_nps(scores)
    csat = calculate_csat(analysis_df)  # Pass full df so CSAT uses sentiment field
    ces = calculate_ces(scores)
    
    # Retention risk: % of reviews with 'high' churn risk only.
    # Medium churn is tracked separately to avoid inflating the headline risk number.
    if 'churn_risk' in analysis_df.columns:
        total = len(analysis_df)
        high_risk = len(analysis_df[analysis_df['churn_risk'] == 'high'])
        medium_risk = len(analysis_df[analysis_df['churn_risk'] == 'medium'])
        risk_pct = round(high_risk / total * 100, 1)
        medium_risk_pct = round(medium_risk / total * 100, 1)
    else:
        risk_pct = 0
        medium_risk_pct = 0
        
    results = {
        "nps_score": nps,
        "csat_score": csat,
        "ces_score": ces,
        "retention_risk_pct": risk_pct,
        "medium_risk_pct": medium_risk_pct
    }
    
    health_score = calculate_health_score(results)
    results["health_score"] = health_score
    results["total_reviews"] = len(analysis_df)
    

    return results

def calculate_sentiment_trends(analysis_df):
    """
    Calculate sentiment trends over time (improving/worsening).
    Returns lists of themes/topics that are trending up or down.
    """
    if analysis_df.empty or 'at' not in analysis_df.columns:
        return {"improving": [], "worsening": []}
        
    # Ensure 'at' is datetime
    df = analysis_df.copy()
    try:
        df['at'] = pd.to_datetime(df['at'])
    except:
        return {"improving": [], "worsening": []}
        
    # Group by month/week and category to see trend
    # For MVP, let's just compare last 30 days vs previous 30 days
    now = datetime.now()
    last_30 = df[df['at'] >= (now - timedelta(days=30))]
    prev_30 = df[(df['at'] >= (now - timedelta(days=60))) & (df['at'] < (now - timedelta(days=30)))]
    
    if last_30.empty or prev_30.empty:
        return {"improving": [], "worsening": []}
        
    # Calculate average sentiment per category
    def get_avg_sentiment(d):
        if 'pain_point_category' not in d.columns or 'sentiment_score' not in d.columns:
            return pd.Series()
        return d.groupby('pain_point_category')['sentiment_score'].mean()
        
    current_sent = get_avg_sentiment(last_30)
    prev_sent = get_avg_sentiment(prev_30)
    
    improving = []
    worsening = []
    
    for cat in current_sent.index:
        if cat in prev_sent.index:
            change = current_sent[cat] - prev_sent[cat]
            item = {"name": cat, "change": round(change * 100, 1), "sentiment": "Positive" if current_sent[cat] > 0 else "Negative"}
            if change > 0.1: # Threshold for significance
                improving.append(item)
            elif change < -0.1:
                worsening.append(item)
                
    return {
        "improving": sorted(improving, key=lambda x: x['change'], reverse=True),
        "worsening": sorted(worsening, key=lambda x: x['change'])
    }
