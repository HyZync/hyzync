"""
Professional PDF Report Generator for Brand Analysis
Clean, modern design with excellent readability and visual appeal
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph, 
                                Spacer, PageBreak)
from datetime import datetime
import pandas as pd
from typing import Dict, List, Any, Optional
import tempfile
import os

# ==================== MODERN COLOR SCHEME ====================

class Colors:
    # Clean, professional palette
    PRIMARY = colors.HexColor('#2563EB')  # Blue
    DARK = colors.HexColor('#1E293B')  # Slate dark
    LIGHT_BG = colors.HexColor('#F8FAFC')  # Light background
    TEXT_PRIMARY = colors.HexColor('#0F172A')  # Almost black
    TEXT_SECONDARY = colors.HexColor('#64748B')  # Gray
    SUCCESS = colors.HexColor('#10B981')  # Green
    WARNING = colors.HexColor('#F59E0B')  # Amber
    DANGER = colors.HexColor('#EF4444')  # Red
    BORDER = colors.HexColor('#E2E8F0')  # Light border
    WHITE = colors.white


# ==================== PROFESSIONAL PAGE TEMPLATE ====================

class PageTemplate:
    """Clean header and footer for each page"""
    
    @staticmethod
    def create(canvas_obj, doc):
        canvas_obj.saveState()
        width, height = letter
        
        # Try to add logo in header (right side, smaller size)
        logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
        if os.path.exists(logo_path):
            try:
                # Smaller logo that doesn't overlap
                logo_width = 60
                logo_height = 24
                canvas_obj.drawImage(
                    logo_path, 
                    width - 50 - logo_width,  # Right aligned
                    height - 43,  # Aligned with text baseline
                    width=logo_width,
                    height=logo_height,
                    preserveAspectRatio=True,
                    mask='auto'
                )
            except Exception:
                pass
        
        # Header line (below logo and text)
        canvas_obj.setStrokeColor(Colors.BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(40, height - 50, width - 40, height - 50)
        
        # Header text (left side)
        canvas_obj.setFont('Helvetica-Bold', 11)
        canvas_obj.setFillColor(Colors.PRIMARY)
        canvas_obj.drawString(40, height - 38, "HORIZON")
        
        canvas_obj.setFont('Helvetica', 8)
        canvas_obj.setFillColor(Colors.TEXT_SECONDARY)
        canvas_obj.drawString(108, height - 38, "VoC Intelligence Report")
        
        # Footer line
        canvas_obj.setStrokeColor(Colors.BORDER)
        canvas_obj.line(40, 50, width - 40, 50)
        
        # Footer text
        canvas_obj.setFont('Helvetica', 7)
        canvas_obj.setFillColor(Colors.TEXT_SECONDARY)
        canvas_obj.drawString(40, 37, datetime.now().strftime('%B %d, %Y'))
        canvas_obj.drawRightString(width - 40, 37, f"Page {doc.page}")
        
        canvas_obj.restoreState()


# ==================== CUSTOM STYLES ====================

def get_styles():
    """Create clean, readable paragraph styles"""
    styles = getSampleStyleSheet()
    
    # Title
    styles.add(ParagraphStyle(
        name='CustomReportTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=28,
        textColor=Colors.TEXT_PRIMARY,
        spaceAfter=12,
        alignment=TA_CENTER,
        leading=34
    ))
    
    # Section heading
    styles.add(ParagraphStyle(
        name='CustomSectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=Colors.PRIMARY,
        spaceBefore=20,
        spaceAfter=12,
        leading=20
    ))
    
    # Subsection
    styles.add(ParagraphStyle(
        name='CustomSubHeading',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=Colors.TEXT_PRIMARY,
        spaceBefore=12,
        spaceAfter=8,
        leading=14
    ))
    
    # Body text - use existing Normal style, don't add new one
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=Colors.TEXT_PRIMARY,
        spaceAfter=6,
        leading=14,
        alignment=TA_LEFT
    ))
    
    # Metrics value
    styles.add(ParagraphStyle(
        name='CustomMetricValue',
        fontName='Helvetica-Bold',
        fontSize=32,
        textColor=Colors.PRIMARY,
        alignment=TA_CENTER,
        leading=36
    ))
    
    # Metric label
    styles.add(ParagraphStyle(
        name='CustomMetricLabel',
        fontName='Helvetica',
        fontSize=9,
        textColor=Colors.TEXT_SECONDARY,
        alignment=TA_CENTER,
        spaceAfter=4
    ))
    
    return styles


# ==================== HELPER FUNCTIONS ====================

def create_metric_card(value: str, label: str, color=Colors.PRIMARY) -> Table:
    """Create a clean metric card"""
    data = [
        [Paragraph(f'<font color="{color.hexval()}" size="32"><b>{value}</b></font>', get_styles()['CustomBody'])],
        [Paragraph(f'<font color="{Colors.TEXT_SECONDARY.hexval()}" size="9">{label}</font>', get_styles()['CustomBody'])]
    ]
    
    table = Table(data, colWidths=[2*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), Colors.LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, Colors.BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    return table


def create_simple_table(data: List[List], col_widths: List, header_color=Colors.PRIMARY) -> Table:
    """Create a clean, readable table"""
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), Colors.WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        
        # Body
        ('BACKGROUND', (0, 1), (-1, -1), Colors.WHITE),
        ('TEXTCOLOR', (0, 1), (-1, -1), Colors.TEXT_PRIMARY),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [Colors.WHITE, Colors.LIGHT_BG]),
        
        # Borders
        ('GRID', (0, 0), (-1, -1), 0.5, Colors.BORDER),
        
        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    return table


def get_sentiment_color(sentiment: str) -> colors.Color:
    """Get color based on sentiment"""
    mapping = {
        'positive': Colors.SUCCESS,
        'negative': Colors.DANGER,
        'neutral': Colors.TEXT_SECONDARY
    }
    return mapping.get(sentiment.lower(), Colors.TEXT_SECONDARY)


def get_risk_color(risk: str) -> colors.Color:
    """Get color based on risk level"""
    mapping = {
        'high': Colors.DANGER,
        'medium': Colors.WARNING,
        'low': Colors.SUCCESS,
        'null': Colors.TEXT_SECONDARY
    }
    return mapping.get(risk.lower(), Colors.TEXT_SECONDARY)


# ==================== MAIN PDF GENERATION ====================

def generate_brand_analysis_pdf(
    analysis_df: pd.DataFrame,
    results: Dict[str, Any],
    vertical: str,
    output_path: str,
    summary_note: Optional[str] = None
) -> str:
    """Generate professional PDF report"""
    
    # Create document with better margins
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=55,
        leftMargin=55,
        topMargin=65,
        bottomMargin=60
    )
    
    story = []
    styles = get_styles()
    
    # ==================== COVER PAGE ====================
    
    story.append(Spacer(1, 1.5*inch))
    
    # Title
    story.append(Paragraph("Voice of Customer", styles['CustomReportTitle']))
    story.append(Paragraph("Intelligence Report", styles['CustomReportTitle']))
    story.append(Spacer(1, 0.5*inch))
    
    # Metadata
    total_analyzed = results.get('total_analyzed', len(analysis_df))
    metadata_text = f"""
    <para alignment="center">
    <b>Business Vertical:</b> {vertical.upper()}<br/>
    <b>Reviews Analyzed:</b> {total_analyzed:,}<br/>
    <b>Report Date:</b> {datetime.now().strftime('%B %d, %Y')}
    </para>
    """
    story.append(Paragraph(metadata_text, styles['CustomBody']))
    story.append(Spacer(1, 0.5*inch))
    
    # Key metrics preview
    nps = results.get('nps_score', 0)
    csat = results.get('csat_score', 0)
    risk_pct = results.get('retention_risk_pct', 0)
    
    metrics_data = [
        ['<b>Metric</b>', '<b>Value</b>', '<b>Status</b>'],
        ['Net Promoter Score', str(nps), 'Strong' if nps > 50 else 'Needs Attention' if nps < 0 else 'Moderate'],
        ['Customer Satisfaction', f'{csat}%', 'Good' if csat > 70 else 'Poor'],
        ['Retention Risk', f'{risk_pct:.1f}%', 'Low' if risk_pct < 5 else 'High']
    ]
    
    # Convert to Paragraphs for better rendering
    metrics_table_data = []
    for row in metrics_data:
        metrics_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
    
    metrics_table = create_simple_table(metrics_table_data, [2.5*inch, 1.3*inch, 1.7*inch])
    story.append(metrics_table)
    
    story.append(PageBreak())
    
    # ==================== EXECUTIVE SUMMARY ====================
    
    story.append(Paragraph("Executive Summary", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    # Industry Context Header
    analytics_data = results.get('analytics', results)
    vertical_display = vertical.replace('_', ' ').upper()
    audience_display = analytics_data.get('audience', '')
    context_text = f"<b>Industry:</b> {vertical_display}"
    if audience_display:
        context_text += f" | <b>Audience:</b> {audience_display.upper()}"
    story.append(Paragraph(context_text, styles['CustomBody']))
    story.append(Spacer(1, 0.1*inch))
    
    # AI-generated Executive Summary
    exec_summary = analytics_data.get('executiveSummary', {})
    if exec_summary and isinstance(exec_summary, dict):
        exec_items = [
            ("Product Health", exec_summary.get('health', 'N/A')),
            ("Top Retention Threat", exec_summary.get('top_threat', 'N/A')),
            ("Revenue Exposure", exec_summary.get('revenue_exposure', 'N/A')),
            ("Vertical Insight", exec_summary.get('vertical_insight', 'N/A')),
            ("Recommended Focus", exec_summary.get('recommendation', 'N/A')),
        ]
        exec_data = [['<b>Dimension</b>', '<b>Insight</b>']]
        for label, value in exec_items:
            exec_data.append([label, str(value)])
        
        exec_table_data = []
        for row in exec_data:
            exec_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
        
        exec_table = create_simple_table(exec_table_data, [2.2*inch, 4.0*inch])
        story.append(exec_table)
    elif summary_note:
        # Fallback to plain summary text
        import re
        clean_text = re.sub('<.*?>', '', summary_note)
        clean_text = clean_text.replace('&nbsp;', ' ').strip()
        story.append(Paragraph(clean_text, styles['CustomBody']))
    else:
        summary_text = f"Analysis of {total_analyzed:,} customer reviews reveals an NPS of {nps}, indicating {'strong customer loyalty' if nps > 50 else 'areas requiring immediate attention' if nps < 0 else 'moderate satisfaction'}."
        story.append(Paragraph(summary_text, styles['CustomBody']))
    
    story.append(Spacer(1, 0.3*inch))
    
    # KPI Cards
    story.append(Paragraph("Key Performance Indicators", styles['CustomSubHeading']))
    
    # Revenue label from analytics
    revenue_label = analytics_data.get('revenueLabel', 'Revenue at Risk')
    revenue_at_risk = analytics_data.get('revenueAtRisk', 0)
    
    kpi_table_data = [[
        create_metric_card(str(nps), 'NPS Score', Colors.PRIMARY),
        create_metric_card(f'{csat}%', 'CSAT', Colors.SUCCESS),
        create_metric_card(f'${revenue_at_risk:,.0f}' if isinstance(revenue_at_risk, (int, float)) else str(revenue_at_risk), revenue_label, Colors.DANGER)
    ]]
    
    kpi_table = Table(kpi_table_data, colWidths=[2.05*inch, 2.05*inch, 2.05*inch])
    kpi_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(kpi_table)
    
    story.append(Spacer(1, 0.3*inch))
    
    # ==================== FIX-NOW PRIORITY ISSUES ====================
    
    fix_now_priorities = analytics_data.get('fixNowPriorities', [])
    if fix_now_priorities:
        story.append(Paragraph("Fix-Now Priority Issues", styles['CustomSectionHeading']))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("Top issues ranked by volume, churn impact, sentiment severity, and revenue sensitivity.", styles['CustomBody']))
        story.append(Spacer(1, 0.1*inch))
        
        fix_data = [['<b>#</b>', '<b>Issue</b>', '<b>Category</b>', '<b>Volume</b>', '<b>High Churn %</b>', '<b>Sentiment</b>']]
        for p in fix_now_priorities[:5]:
            fix_data.append([
                str(p.get('priority_rank', '')),
                str(p.get('issue', 'N/A'))[:40],
                str(p.get('category', 'Other')),
                str(p.get('volume', 0)),
                f"{p.get('high_churn_pct', 0):.0f}%",
                f"{p.get('avg_sentiment', 0):.2f}"
            ])
        
        fix_table_data = []
        for row in fix_data:
            fix_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
        
        fix_table = create_simple_table(fix_table_data, [0.4*inch, 2.0*inch, 0.9*inch, 0.7*inch, 1.0*inch, 0.8*inch], Colors.DANGER)
        story.append(fix_table)
    
    story.append(PageBreak())
    
    # ==================== SENTIMENT ANALYSIS ====================
    
    story.append(Paragraph("Sentiment Analysis", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    # Sentiment distribution
    pos = results.get('total_positive', 0)
    neg = results.get('total_negative', 0)
    neu = results.get('total_neutral', 0)
    total = pos + neg + neu
    
    sent_data = [
        ['<b>Sentiment</b>', '<b>Count</b>', '<b>Percentage</b>'],
        ['Positive ✓', str(pos), f'{(pos/max(total,1)*100):.1f}%'],
        ['Negative ✗', str(neg), f'{(neg/max(total,1)*100):.1f}%'],
        ['Neutral ○', str(neu), f'{(neu/max(total,1)*100):.1f}%']
    ]
    
    sent_table_data = []
    for row in sent_data:
        sent_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
    
    sent_table = create_simple_table(sent_table_data, [2.3*inch, 1.4*inch, 1.4*inch])
    story.append(sent_table)
    
    story.append(Spacer(1, 0.3*inch))
    
    # ==================== RETENTION INTELLIGENCE ====================
    
    story.append(Paragraph("Retention & Churn Analysis", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    # Churn overview
    churn_text = f"<b>Retention Alert:</b> {risk_pct:.1f}% of reviews ({results.get('retention_risk_count', 0)}) show churn intent signals."
    story.append(Paragraph(churn_text, styles['CustomBody']))
    story.append(Spacer(1, 0.15*inch))
    
    # Churn distribution
    churn_dist = results.get('churn_risk_distribution', {})
    churn_data = [
        ['<b>Risk Level</b>', '<b>Count</b>', '<b>Percentage</b>'],
        ['High Risk', str(churn_dist.get('high', 0)), f'{(churn_dist.get("high",0)/max(total,1)*100):.1f}%'],
        ['Medium Risk', str(churn_dist.get('medium', 0)), f'{(churn_dist.get("medium",0)/max(total,1)*100):.1f}%'],
        ['Low Risk', str(churn_dist.get('low', 0)), f'{(churn_dist.get("low",0)/max(total,1)*100):.1f}%']
    ]
    
    churn_table_data = []
    for row in churn_data:
        churn_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
    
    churn_table = create_simple_table(churn_table_data, [2.3*inch, 1.4*inch, 1.4*inch], Colors.DANGER)
    story.append(churn_table)
    
    story.append(PageBreak())
    
    # ==================== THEMATIC ANALYSIS ====================
    
    story.append(Paragraph("Thematic Analysis", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    # Top pain points
    story.append(Paragraph("Top Customer Pain Points", styles['CustomSubHeading']))
    
    top_themes = results.get('top_themes', [])[:8]
    if top_themes:
        pain_data = [['<b>Issue</b>', '<b>Mentions</b>', '<b>Impact</b>']]
        for theme in top_themes:
            pain_data.append([
                theme['theme'],
                str(theme['mentions']),
                'High' if theme['mentions'] > 10 else 'Medium'
            ])
        
        pain_table_data = []
        for row in pain_data:
            pain_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
        
        pain_table = create_simple_table(pain_table_data, [3.2*inch, 1.0*inch, 1.0*inch])
        story.append(pain_table)
    else:
        story.append(Paragraph("No significant pain points identified.", styles['CustomBody']))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Feature requests
    story.append(Paragraph("Top Feature Requests", styles['CustomSubHeading']))
    
    features = results.get('top_feature_requests', [])[:6]
    if features:
        feat_data = [['<b>Feature Request</b>', '<b>Demand</b>']]
        for feat in features:
            feat_data.append([feat['feature'], str(feat['mentions'])])
        
        feat_table_data = []
        for row in feat_data:
            feat_table_data.append([Paragraph(cell, styles['CustomBody']) for cell in row])
        
        feat_table = create_simple_table(feat_table_data, [4.2*inch, 1.0*inch])
        story.append(feat_table)
    else:
        story.append(Paragraph("No feature requests captured.", styles['CustomBody']))
    
    story.append(PageBreak())
    
    # ==================== SAMPLE REVIEWS ====================
    
    story.append(Paragraph("Review Samples", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    # High-risk reviews
    story.append(Paragraph("High Churn Risk Reviews", styles['CustomSubHeading']))
    
    high_risk = analysis_df[analysis_df['churn_risk'] == 'high'].head(3)
    if not high_risk.empty:
        for idx, row in high_risk.iterrows():
            review_text = f"""
            <b>Rating:</b> {row.get('score', 'N/A')}/5 | 
            <b>Sentiment:</b> {row.get('sentiment', 'N/A').capitalize()}<br/>
            <i>"{row.get('content', 'N/A')[:180]}..."</i>
            """
            story.append(Paragraph(review_text, styles['CustomBody']))
            story.append(Spacer(1, 0.1*inch))
    else:
        story.append(Paragraph("No high-risk reviews found.", styles['CustomBody']))
    
    story.append(Spacer(1, 0.2*inch))
    
    # Positive reviews
    story.append(Paragraph("Positive Highlights", styles['CustomSubHeading']))
    
    positive = analysis_df[analysis_df['sentiment'] == 'positive'].head(2)
    if not positive.empty:
        for idx, row in positive.iterrows():
            review_text = f"""
            <b>Rating:</b> {row.get('score', 'N/A')}/5<br/>
            <i>"{row.get('content', 'N/A')[:180]}..."</i>
            """
            story.append(Paragraph(review_text, styles['CustomBody']))
            story.append(Spacer(1, 0.1*inch))
    
    story.append(PageBreak())
    
    # ==================== RECOMMENDATIONS ====================
    
    story.append(Paragraph("Strategic Recommendations", styles['CustomSectionHeading']))
    story.append(Spacer(1, 0.1*inch))
    
    recommendations = results.get('retention_recommendations', [])[:5]
    if recommendations:
        for i, rec in enumerate(recommendations, 1):
            rec_text = f"""
            <b>{i}. {rec.get('action', 'N/A')}</b><br/>
            <font color="{Colors.TEXT_SECONDARY.hexval()}">
            Expected Impact: {rec.get('expected_lift', 'TBD')} | 
            Effort: {rec.get('effort', 'Medium')}<br/>
            {rec.get('rationale', 'No details provided')}
            </font>
            """
            story.append(Paragraph(rec_text, styles['CustomBody']))
            story.append(Spacer(1, 0.15*inch))
    else:
        # Default recommendations
        story.append(Paragraph(f"1. <b>Address primary pain point</b>: Focus on resolving the most frequently mentioned issue to reduce churn.", styles['CustomBody']))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph(f"2. <b>Enhance customer support</b>: Improve response times and support quality as indicated by feedback.", styles['CustomBody']))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph(f"3. <b>Monitor trends weekly</b>: Track sentiment changes to catch emerging issues early.", styles['CustomBody']))
    
    # ==================== BUILD PDF ====================
    
    doc.build(story, onFirstPage=PageTemplate.create, onLaterPages=PageTemplate.create)
    
    return output_path


# ==================== STREAMLIT HELPER ====================

def generate_pdf_from_streamlit_results(analysis_df, results, vertical):
    """Generate PDF and return as bytes for Streamlit download"""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        temp_path = tmp_file.name
    
    try:
        generate_brand_analysis_pdf(
            analysis_df=analysis_df,
            results=results,
            vertical=vertical,
            output_path=temp_path,
            summary_note=results.get('summary_note')
        )
        
        with open(temp_path, 'rb') as f:
            pdf_bytes = f.read()
        
        return pdf_bytes
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
