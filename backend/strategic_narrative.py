"""
Strategic Narrative Module - Automated Consulting & Executive Communication
==========================================================================
Generates McKinsey/BCG-style strategic narratives and executive summaries.

Features:
- Automated SCR Briefs: Situation-Complication-Resolution format
- Executive One-Pager: PDF summary with top risks and initiatives
- Strategic Recommendations: Actionable initiatives prioritized by ROI
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime
import json


# ============================================================================
# SCR (Situation-Complication-Resolution) Brief Generator
# ============================================================================

def generate_scr_brief(
    analysis_df: pd.DataFrame,
    focus_topic: Optional[str] = None,
    arpu: float = 50.0,
    nps: Optional[float] = None,
    csat: Optional[float] = None,
    vertical: str = "generic"
) -> Dict:
    """
    Generate a strategic brief in McKinsey SCR (Situation-Complication-Resolution) format.
    Uses LLM for final narrative generation.
    """
    if analysis_df.empty:
        return {'error': 'No data available for SCR brief generation'}
    
    # Import module functions (avoid circular imports)
    try:
        from economic_impact import (
            calculate_revenue_at_risk,
            calculate_topic_revenue_impact
        )
        modules_available = True
    except ImportError:
        modules_available = False
    
    # 1. Aggregate Data
    total_reviews = len(analysis_df)
    avg_sentiment = analysis_df.get('sentiment_score', pd.Series([0])).mean()
    
    # Insights
    insights = []
    if 'domain_insight' in analysis_df.columns:
        top_insights = analysis_df['domain_insight'].value_counts().head(3)
        insights = [f"{i} ({c})" for i, c in top_insights.items() if i and i.lower() != 'none']

    # Risks
    risks = []
    revenue_risk = 0
    
    if modules_available:
        rr = calculate_revenue_at_risk(analysis_df, arpu, '30d')
        revenue_risk = rr['total_revenue_at_risk']
        
        # Financial
        if revenue_risk > 0:
            risks.append(f"Financial: ${revenue_risk:,.2f} monthly revenue at risk.")

    # Brand Risk
    if 'emerging_theme' in analysis_df.columns:
        risky_themes = analysis_df[
            (analysis_df['emerging_theme'].str.len() > 3) & 
            (analysis_df['emerging_theme'].str.lower() != 'none') &
            (analysis_df['sentiment_score'] < -0.3)
        ]['emerging_theme'].value_counts().head(2)
        for t, c in risky_themes.items():
            risks.append(f"Brand Risk: '{t}' ({c} reports)")

    # Competitor Risk
    if 'feature_request' in analysis_df.columns:
         urgent_features = analysis_df[
            (analysis_df['feature_request'].str.len() > 3) & 
            (analysis_df['feature_request'].str.lower() != 'none') &
            (analysis_df['urgency'].str.lower() == 'high')
        ]['feature_request'].value_counts().head(2)
         for f, c in urgent_features.items():
             risks.append(f"Competitor Gap: Missing '{f}' ({c} requests)")

    # Opportunities / Resolutions
    opportunities = []
    if modules_available:
        topic_impact = calculate_topic_revenue_impact(analysis_df, arpu)
        if not topic_impact.empty:
            for _, row in topic_impact.head(3).iterrows():
                opportunities.append(f"Fix '{row['pain_point_category']}' to recover ${row['revenue_at_risk']:,.0f}/mo")

    # Extract real review samples for richer LLM context
    review_samples = []
    content_col = None
    for col in ['content', 'text', 'review_text', 'body']:
        if col in analysis_df.columns:
            content_col = col
            break
    if content_col:
        negative_reviews = analysis_df[analysis_df.get('sentiment_score', pd.Series([0])) < -0.2]
        if len(negative_reviews) > 0:
            samples = negative_reviews.sample(min(5, len(negative_reviews)), random_state=42)
            review_samples = [str(r)[:150] for r in samples[content_col].tolist() if r and str(r).strip()]

    # Extract concrete pain points with counts
    pain_points_summary = []
    if 'pain_point_category' in analysis_df.columns:
        pp_counts = analysis_df[
            (analysis_df['pain_point_category'].notna()) &
            (analysis_df['pain_point_category'].str.len() > 2) &
            (analysis_df['pain_point_category'].str.lower() != 'none')
        ]['pain_point_category'].value_counts().head(5)
        pain_points_summary = [f"{cat}: {cnt} complaints" for cat, cnt in pp_counts.items()]

    # Top feature requests
    feature_requests = []
    if 'feature_request' in analysis_df.columns:
        fr_counts = analysis_df[
            (analysis_df['feature_request'].notna()) &
            (analysis_df['feature_request'].str.len() > 2) &
            (analysis_df['feature_request'].str.lower() != 'none')
        ]['feature_request'].value_counts().head(3)
        feature_requests = [f"{feat} ({cnt} requests)" for feat, cnt in fr_counts.items()]

    # 2. Prepare Context
    context = {
        "total_reviews": total_reviews,
        "avg_sentiment": avg_sentiment,
        "nps": nps,
        "csat": csat,
        "insights": "; ".join(insights),
        "revenue_risk": revenue_risk,
        "risks": risks,
        "opportunities": opportunities,
        "review_samples": review_samples,
        "pain_points": pain_points_summary,
        "feature_requests": feature_requests,
    }

    # 3. Generate Narrative via LLM
    scr_content = generate_narrative_with_llm(context, "scr_brief", vertical=vertical)

    # ===== COMPILE SCR =====
    scr_brief = {
        'situation': scr_content.get('situation', 'Analysis pending.'),
        'complication': scr_content.get('complication', 'Analysis pending.'),
        'resolution': scr_content.get('resolution', 'Analysis pending.'),
        'generated_at': datetime.now().isoformat(),
        'data_period': {
            'total_reviews': total_reviews,
            'analysis_date': datetime.now().strftime('%Y-%m-%d')
        }
    }
    
    return scr_brief


def format_scr_as_markdown(scr_brief: Dict) -> str:
    """
    Format SCR brief as markdown for display or export.
    
    Args:
        scr_brief: SCR brief dictionary
        
    Returns:
        Formatted markdown string
    """
    if 'error' in scr_brief:
        return f"# Error\n\n{scr_brief['error']}"
    
    markdown = f"# Strategic Brief\n\n"
    markdown += f"*Generated: {scr_brief['generated_at']}*\n\n"
    markdown += f"---\n\n"
    markdown += f"## Situation\n\n{scr_brief['situation']}\n\n"
    markdown += f"## Complication\n\n{scr_brief['complication']}\n\n"
    markdown += f"## Resolution\n\n{scr_brief['resolution']}\n\n"
    markdown += f"---\n\n"
    
    return markdown


# ============================================================================
# Executive One-Pager Generator
# ============================================================================

def extract_top_3_risks(
    analysis_df: pd.DataFrame,
    arpu: float = 50.0
) -> List[Dict]:
    """
    Extract the top 3 strategic risks based on revenue impact, churn intent, and velocity.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        
    Returns:
        List of top 3 risks
    """
    try:
        from economic_impact import calculate_topic_revenue_impact
        from predictive_intelligence import detect_acceleration_events
        
        # Get revenue impact
        topic_impact = calculate_topic_revenue_impact(analysis_df, arpu)
        
        # Get velocity (if timestamp available)
        velocity_dict = {}
        if 'at' in analysis_df.columns:
            accelerating = detect_acceleration_events(analysis_df)
            if not accelerating.empty:
                velocity_dict = {
                    row['topic']: row['percent_change'] 
                    for _, row in accelerating.iterrows()
                }
        
        risks = []

        # 1. Financial Risks (Standard Pain Points)
        if not topic_impact.empty:
            for _, row in topic_impact.head(5).iterrows():
                topic = row['pain_point_category']
                velocity = velocity_dict.get(topic, 0)
                
                # Calculate composite risk score
                risk_score = (
                    row['revenue_at_risk'] / 100 +  # Revenue factor
                    velocity / 10 +  # Velocity factor
                    row['count'] * 0.1  # Volume factor
                )
                
                risks.append({
                    'topic': topic,
                    'revenue_at_risk': row['revenue_at_risk'],
                    'affected_users': row['count'],
                    'velocity_pct_change': velocity,
                    'risk_score': round(risk_score, 2),
                    'urgency': 'Critical' if velocity > 50 or row['revenue_at_risk'] > arpu * 20 else 'High'
                })

        # 2. Brand Risk (Emerging Themes)
        if 'emerging_theme' in analysis_df.columns:
            risky_themes = analysis_df[
                (analysis_df['emerging_theme'].str.len() > 3) & 
                (analysis_df['emerging_theme'].str.lower() != 'none') &
                (analysis_df['sentiment_score'] < -0.3)
            ]['emerging_theme'].value_counts().head(2)
            
            for theme, count in risky_themes.items():
                # Synthetic risk score for brand damage (Count * High ARPU Multiplier)
                est_loss = count * arpu * 1.5 
                risk_score = (est_loss / 100) + (count * 2) # Heavily weight brand risk
                
                risks.append({
                    'topic': f"Brand Risk: {theme}",
                    'revenue_at_risk': est_loss,
                    'affected_users': count,
                    'velocity_pct_change': 0, # Unknown without time series
                    'risk_score': round(risk_score, 2),
                    'urgency': 'Critical'
                })

        # 3. Competitive Urgency (Feature Requests)
        if 'feature_request' in analysis_df.columns:
            urgent_features = analysis_df[
                (analysis_df['feature_request'].str.len() > 3) & 
                (analysis_df['feature_request'].str.lower() != 'none') &
                (analysis_df['urgency'].str.lower() == 'high')
            ]['feature_request'].value_counts().head(2)

            for feature, count in urgent_features.items():
                # Synthetic opportunity cost
                est_loss = count * arpu * 0.8
                risk_score = (est_loss / 100) + (count * 1.5)

                risks.append({
                    'topic': f"Competitive Gap: {feature}",
                    'revenue_at_risk': est_loss,
                    'affected_users': count,
                    'velocity_pct_change': 0,
                    'risk_score': round(risk_score, 2),
                    'urgency': 'High'
                })
        
        # Sort by risk score
        risks.sort(key=lambda x: x['risk_score'], reverse=True)
        
        return risks[:3]
    
    except ImportError:
        return []


def create_executive_onepager(
    analysis_df: pd.DataFrame,
    client_name: str,
    arpu: float = 50.0,
    date_range: Optional[str] = None,
    vertical: str = "generic"
) -> Dict:
    """
    Create an executive one-pager summary using LLM for narrative generation.
    """
    if analysis_df.empty:
        return {'error': 'No data available'}
    
    # Calculate Key Metrics
    total_reviews = len(analysis_df)
    try:
        from economic_impact import calculate_revenue_at_risk
        revenue_risk = calculate_revenue_at_risk(analysis_df, arpu, '30d')
        revenue_at_risk = revenue_risk['total_revenue_at_risk']
    except:
        revenue_at_risk = 0
    
    high_churn_count = len(analysis_df[analysis_df.get('churn_risk', '').str.lower() == 'high'])
    avg_sentiment = analysis_df.get('sentiment_score', pd.Series([0])).mean()
    
    # Top 3 Risks
    top_risks = extract_top_3_risks(analysis_df, arpu)
    
    # Recommended Initiatives
    scr_brief = generate_scr_brief(analysis_df, arpu=arpu)
    
    # Prepare Context for LLM
    context = {
        "client_name": client_name,
        "total_reviews": total_reviews,
        "revenue_at_risk": revenue_at_risk,
        "high_churn_users": high_churn_count,
        "avg_sentiment": avg_sentiment,
        "top_risks": top_risks,
        "initiatives": scr_brief.get('resolution', 'See detailed report')
    }
    
    # Generate Executive Summary via LLM
    executive_summary = generate_narrative_with_llm(context, "executive_summary", vertical=vertical)
    
    one_pager = {
        'client_name': client_name,
        'date_range': date_range or f"As of {datetime.now().strftime('%B %Y')}",
        'generated_date': datetime.now().strftime('%Y-%m-%d'),
        'executive_summary': executive_summary,
        'key_metrics': {
            'total_reviews': total_reviews,
            'revenue_at_risk': revenue_at_risk,
            'high_risk_users': high_churn_count,
            'avg_sentiment': round(avg_sentiment, 2)
        },
        'top_3_risks': top_risks,
        'recommended_initiatives': scr_brief.get('resolution', 'See detailed report'),
        'next_steps': [
            'Initiate engineering sprint on top priority issue',
            'Deploy customer retention campaigns targeting high-risk users',
            'Establish weekly monitoring of velocity metrics'
        ]
    }
    
    return one_pager


def generate_narrative_with_llm(context_data: Dict, narrative_type: str, vertical: str = "generic") -> str:
    """
    Generates a strategic narrative using the LLM based on aggregated data.
    """
    try:
        from processor import query_ollama, VERTICAL_TERMINOLOGY
    except ImportError:
        return "LLM unavailable. (Fallback narrative)"

    # Get sector-specific terminology
    terminology = VERTICAL_TERMINOLOGY.get(vertical, VERTICAL_TERMINOLOGY.get("generic", {}))
    churn_label = terminology.get('churn_label', 'Churn Risk')
    pain_label = terminology.get('pain_point_label', 'Failure Surface')

    if narrative_type == "scr_brief":
        # Build concrete data sections
        review_text = ""
        if context_data.get('review_samples'):
            review_text = "\n        REAL USER COMPLAINTS (verbatim excerpts):\n"
            for i, sample in enumerate(context_data['review_samples'][:5], 1):
                review_text += f"          {i}. \"{sample}\"\n"
        
        pain_text = ""
        if context_data.get('pain_points'):
            pain_text = "\n        TOP PAIN POINTS (by volume):\n"
            for pp in context_data['pain_points']:
                pain_text += f"          - {pp}\n"
        
        feature_text = ""
        if context_data.get('feature_requests'):
            feature_text = "\n        FEATURE GAPS:\n"
            for fr in context_data['feature_requests']:
                feature_text += f"          - {fr}\n"

        prompt = f"""
        ROLE: Senior Strategy Consultant writing a data-backed brief.
        TASK: Write a Situation-Complication-Resolution (SCR) brief.
        
        QUANTITATIVE DATA:
        - Total Reviews Analyzed: {context_data.get('total_reviews', 0)}
        - Average Sentiment: {context_data.get('avg_sentiment', 0):.2f} (Scale: -1 to 1)
        - NPS Score: {context_data.get('nps', 'N/A')} | CSAT: {context_data.get('csat', 'N/A')}
        - Monthly Revenue at Risk: ${context_data.get('revenue_risk', 0):,.2f}
        - Key Insights: {context_data.get('insights', 'None')}
        {review_text}{pain_text}{feature_text}
        IDENTIFIED RISKS: {json.dumps(context_data.get('risks', []))}
        RECOVERY OPPORTUNITIES: {json.dumps(context_data.get('opportunities', []))}

        INSTRUCTIONS:
        1. **SITUATION:** 2-3 sentences grounded in the numbers above. Mention the exact review count, sentiment score, and NPS/CSAT.
        2. **COMPLICATION:** 2-3 sentences. Reference the specific pain points and real user complaints. Cite the exact revenue at risk figure. Mention {churn_label} drivers.
        3. **RESOLUTION:** 3-5 bullet points of concrete, specific actions tied to the pain points above. Each bullet must reference a specific issue and its financial impact. Include the {pain_label} terminology.
        
        CRITICAL: Be specific. Use the exact numbers, pain point names, and dollar amounts from the data. Do NOT be generic or vague.
        
        OUTPUT FORMAT:
        Return ONLY a JSON object with keys: "situation", "complication", "resolution".
        No markdown, no explanation, just the JSON.
        """
        
        response = query_ollama(prompt, num_predict=700)
        try:
            import re
            json_match = re.search(r'\{.*\}', response.replace('\n', ' '), re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        return {
            "situation": "AI generation failed.",
            "complication": "Could not generate complication.",
            "resolution": "Could not generate resolution."
        }

    elif narrative_type == "executive_summary":
        prompt = f"""
        ROLE: Executive Strategy Advisor.
        TASK: Write a punchy, 3-sentence Executive Summary for the CEO.
        
        DATA:
        - Revenue at Risk: ${context_data.get('revenue_at_risk', 0):,.2f}
        - High Risk Users: {context_data.get('high_churn_users', 0)}
        - Top Risks: {json.dumps(context_data.get('top_risks', []), indent=2)}
        
        INSTRUCTIONS:
        - Start with the bottom line (financial impact).
        - Highlight the #1 most critical strategic risk (brand or competitor).
        - End with a call to action.
        - Tone: Serious, urgent, professional. No fluff.
        """
        return query_ollama(prompt, num_predict=200).strip()
    
    return "Invalid narrative type."



def format_onepager_as_markdown(onepager: Dict) -> str:
    """
    Format executive one-pager as markdown.
    
    Args:
        onepager: One-pager dictionary
        
    Returns:
        Formatted markdown string
    """
    if 'error' in onepager:
        return f"# Error\n\n{onepager['error']}"
    
    md = f"# Executive Summary: {onepager['client_name']}\n\n"
    md += f"**Period:** {onepager['date_range']} | **Generated:** {onepager['generated_date']}\n\n"
    md += f"---\n\n"
    
    md += f"## Executive Summary\n\n{onepager['executive_summary']}\n\n"
    
    md += f"## Key Metrics\n\n"
    md += f"- **Total Reviews Analyzed:** {onepager['key_metrics']['total_reviews']:,}\n"
    md += f"- **Revenue at Risk (30d):** ${onepager['key_metrics']['revenue_at_risk']:,.2f}\n"
    md += f"- **High-Risk Users:** {onepager['key_metrics']['high_risk_users']}\n"
    md += f"- **Average Sentiment:** {onepager['key_metrics']['avg_sentiment']:.2f}\n\n"
    
    md += f"## Top 3 Strategic Risks\n\n"
    for i, risk in enumerate(onepager['top_3_risks'], 1):
        md += f"### {i}. {risk['topic']}\n"
        md += f"- **Revenue at Risk:** ${risk['revenue_at_risk']:,.2f}\n"
        md += f"- **Affected Users:** {risk['affected_users']}\n"
        md += f"- **Trend:** {risk['velocity_pct_change']:.1f}% change (7d)\n"
        md += f"- **Urgency:** {risk['urgency']}\n\n"
    
    md += f"## Recommended Strategic Initiatives\n\n{onepager['recommended_initiatives']}\n\n"
    
    md += f"## Next Steps\n\n"
    for step in onepager['next_steps']:
        md += f"- {step}\n"
    
    return md


# ============================================================================
# Strategic Recommendations Engine
# ============================================================================

def generate_strategic_recommendations(
    analysis_df: pd.DataFrame,
    arpu: float = 50.0,
    fix_effort_estimates: Optional[Dict[str, int]] = None
) -> List[Dict]:
    """
    Generate prioritized strategic recommendations based on all available data.
    
    Args:
        analysis_df: DataFrame with review analysis
        arpu: Average Revenue Per User
        fix_effort_estimates: Optional effort estimates per topic
        
    Returns:
        List of recommendations with priority and rationale
    """
    recommendations = []
    
    try:
        from economic_impact import calculate_financial_recovery_potential
        from causal_diagnostics import detect_causal_churn_topics
        
        # Get ROI-ranked issues
        roi_df = calculate_financial_recovery_potential(
            analysis_df, arpu, fix_effort_estimates
        )
        
        if roi_df.empty:
            return recommendations
        
        # Get causal analysis
        causal_df = detect_causal_churn_topics(analysis_df)
        
        # Generate recommendations for top issues
        for _, row in roi_df.head(5).iterrows():
            topic = row['pain_point_category']
            
            # Check if causal
            causal_info = None
            if not causal_df.empty:
                causal_row = causal_df[causal_df['topic'] == topic]
                if not causal_row.empty:
                    causal_info = causal_row.iloc[0]
            
            recommendation = {
                'priority': row['priority_tier'],
                'topic': topic,
                'revenue_recovery_potential': row['revenue_at_risk'],
                'roi_score': row['roi_score_normalized'],
                'estimated_effort': row['fix_effort'],
                'is_causal_driver': causal_info['is_causal'] if causal_info is not None else False,
                'rationale': generate_recommendation_rationale(row, causal_info),
                'action_items': generate_action_items(topic, row, causal_info)
            }
            
            recommendations.append(recommendation)
        
        return recommendations
    
    except ImportError:
        return []


def generate_recommendation_rationale(
    roi_row: pd.Series,
    causal_info: Optional[pd.Series]
) -> str:
    """
    Generate rationale for a recommendation.
    
    Args:
        roi_row: ROI data for the topic
        causal_info: Causal analysis data (optional)
        
    Returns:
        Rationale string
    """
    rationale = f"This issue shows high ROI potential (score: {roi_row['roi_score_normalized']:.1f}/100) "
    rationale += f"with ${roi_row['revenue_at_risk']:,.2f} in monthly revenue recovery potential. "
    
    if causal_info is not None and causal_info.get('is_causal', False):
        rationale += f"Statistically proven churn driver with {causal_info['effect_size']:.1f}% "
        rationale += f"higher churn rate among affected users. "
    
    if roi_row['priority_tier'] == 'Critical':
        rationale += "Immediate action required."
    elif roi_row['priority_tier'] == 'High':
        rationale += "High-priority intervention needed."
    
    return rationale


def generate_action_items(
    topic: str,
    roi_row: pd.Series,
    causal_info: Optional[pd.Series]
) -> List[str]:
    """
    Generate specific action items for a topic.
    
    Args:
        topic: Topic name
        roi_row: ROI data
        causal_info: Causal analysis data (optional)
        
    Returns:
        List of action items
    """
    actions = []
    
    # Topic-specific actions
    if 'billing' in topic.lower():
        actions.extend([
            "Audit billing system for errors and false charges",
            "Improve billing transparency and communication",
            "Implement proactive billing issue resolution"
        ])
    elif 'login' in topic.lower() or 'authentication' in topic.lower():
        actions.extend([
            "Fix authentication bugs and edge cases",
            "Implement password reset improvements",
            "Add multi-factor authentication options"
        ])
    elif 'performance' in topic.lower() or 'speed' in topic.lower():
        actions.extend([
            "Optimize backend performance and database queries",
            "Implement caching strategies",
            "Reduce app load times and improve responsiveness"
        ])
    elif 'ui' in topic.lower() or 'ux' in topic.lower() or 'design' in topic.lower():
        actions.extend([
            "Conduct UX research and usability testing",
            "Simplify navigation and information architecture",
            "Improve visual design and accessibility"
        ])
    else:
        actions.extend([
            "Conduct root cause analysis",
            "Develop and test solution",
            "Deploy fix and monitor results"
        ])
    
    # Add monitoring
    actions.append(f"Monitor '{topic}' complaint velocity and sentiment trends")
    
    return actions


# ============================================================================
# Module Testing
# ============================================================================

if __name__ == "__main__":
    print("Testing Strategic Narrative Module\n")
    
    # Create sample data
    np.random.seed(42)
    n_samples = 100
    
    sample_data = pd.DataFrame({
        'review_id': [f'rev_{i}' for i in range(n_samples)],
        'score': np.random.choice([1, 2, 3, 4, 5], n_samples, p=[0.2, 0.2, 0.3, 0.2, 0.1]),
        'pain_point_category': np.random.choice(
            ['Billing', 'Login Issues', 'Performance', 'UI/UX'],
            n_samples
        ),
        'churn_risk': np.random.choice(['high', 'medium', 'low'], n_samples, p=[0.3, 0.3, 0.4]),
        'sentiment_score': np.random.uniform(-1, 0.5, n_samples),
        'content': ['Sample review ' + str(i) for i in range(n_samples)]
    })
    
    ARPU = 50.0
    
    print("1. SCR Brief Generation")
    print("=" * 70)
    scr = generate_scr_brief(sample_data, arpu=ARPU, nps=25.0, csat=70.0)
    print(format_scr_as_markdown(scr))
    
    print("\n2. Executive One-Pager")
    print("=" * 70)
    onepager = create_executive_onepager(sample_data, "Sample Corp", arpu=ARPU)
    print(format_onepager_as_markdown(onepager))
    
    print("\n3. Strategic Recommendations")
    print("=" * 70)
    recommendations = generate_strategic_recommendations(sample_data, arpu=ARPU)
    if recommendations:
        for i, rec in enumerate(recommendations[:3], 1):
            print(f"{i}. {rec['topic']} (Priority: {rec['priority']})")
            print(f"   ROI Score: {rec['roi_score']:.1f}/100")
            print(f"   Revenue Potential: ${rec['revenue_recovery_potential']:,.2f}")
            print(f"   Rationale: {rec['rationale']}")
            print()
    
    print("[OK] All tests passed!")
