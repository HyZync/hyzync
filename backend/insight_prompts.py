from typing import Dict, Iterable, Optional


VALID_ANALYSIS_MODES = {"workspace", "feedback_crm", "bulk_survey"}


def normalize_analysis_mode(mode: Optional[str]) -> str:
    mode = (mode or "workspace").strip().lower()
    return mode if mode in VALID_ANALYSIS_MODES else "workspace"


def infer_analysis_mode(record: Optional[Dict], requested_mode: Optional[str] = None) -> str:
    mode = normalize_analysis_mode(requested_mode)
    if mode in {"feedback_crm", "bulk_survey"}:
        return mode

    if not record:
        return mode

    hints = " ".join(
        str(record.get(key, "") or "").lower()
        for key in ("source", "source_type", "connector_type", "author", "userName")
    )

    if any(token in hints for token in ("surveymonkey", "typeform", "survey", "nps", "csat", "respondent")):
        return "bulk_survey"

    if any(
        token in hints
        for token in (
            "salesforce",
            "crm",
            "support",
            "ticket",
            "case",
            "renewal",
            "cancellation",
            "cancel",
            "refund",
        )
    ):
        return "feedback_crm"

    return mode


def _clean_text(value: Optional[str], limit: int = 500) -> str:
    if value is None:
        return ""
    text = " ".join(str(value).split())
    return text[:limit].strip()


def _format_context_lines(record_context: Optional[Dict[str, str]]) -> str:
    if not record_context:
        return "- source: unknown\n- source_type: unknown"

    lines = []
    for key in ("source", "source_type", "author", "customer_identifier"):
        value = _clean_text(record_context.get(key), 80)
        if value:
            lines.append(f"- {key}: {value}")

    return "\n".join(lines) if lines else "- source: unknown\n- source_type: unknown"


def _format_context_inline(record_context: Optional[Dict[str, str]]) -> str:
    if not record_context:
        return "source=unknown; source_type=unknown"

    pairs = []
    for key in ("source", "source_type", "author", "customer_identifier"):
        value = _clean_text(record_context.get(key), 50)
        if value:
            pairs.append(f"{key}={value}")
    return "; ".join(pairs) if pairs else "source=unknown; source_type=unknown"


def _context_brief(analysis_mode: str) -> str:
    if analysis_mode == "feedback_crm":
        return (
            "This record is part of Feedback CRM intelligence. It may be a support ticket, "
            "CRM note, cancellation message, renewal objection, helpdesk transcript, or free-text feedback. "
            "Optimize for customer-level grouping, retention risk, repeatable pain-point labels, and actionability."
        )
    if analysis_mode == "bulk_survey":
        return (
            "This record is part of bulk survey analysis. It may be an NPS, CSAT, CES, or open-ended survey response. "
            "Responses can be short, rating-led, fragmented, or indirect. Focus on the respondent's main reason, unmet need, "
            "or praise driver so records roll up cleanly into survey themes."
        )
    return (
        "This record belongs to workspace analysis across mixed feedback sources. Use reusable labels that can be aggregated "
        "across app reviews, survey responses, CRM exports, tickets, and uploaded datasets."
    )


def _build_feedback_crm_fast_prompt(
    *,
    vertical: str,
    focus_keywords: str,
    custom_instructions: str,
    sentiments: str,
    churn_risks: str,
    pain_points: str,
    intents: str,
    urgency_levels: str,
    segments: str,
    rating: int,
    content: str,
    review_id: str,
    record_context: Optional[Dict[str, str]] = None,
) -> str:
    context_inline = _format_context_inline(record_context)
    focus = focus_keywords or "support, retention, pricing, onboarding, usability"
    custom_block = f"\nFOCUS: {custom_instructions}" if custom_instructions else ""

    return f"""Return one minified JSON object only.

Mode=feedback_crm
Goal=extract CRM insight for churn reduction, solving priority, suggestions, segmentation, and clustering.
Context={context_inline}
Vertical={vertical.upper()}
Keywords={focus}{custom_block}

Output rules:
1. Use only evidence in text. Rating/context are hints.
2. No markdown. No code fences. No prose outside JSON.
3. Keep every free-text field short, plain, and aggregation-friendly.
4. Use "None" when a field is absent or unclear.
5. feature_request and user_suggestion only when explicitly stated.
6. churn_risk=high for explicit cancel/refund/switch/non-renew or severe unresolved blocker.
7. churn_impact=high only when this pain could plausibly drive churn or retention loss.
8. solving_priority reflects how fast the company should solve this issue.
9. cluster_label should combine segment + problem cluster when possible.
10. revenue_sensitivity=true only for pricing, billing, refund, renewal, downgrade, contract, ROI, seat, overage, or churn exposure.

Exact enums:
sentiment=positive|neutral|negative
churn_risk=high|medium|low|null
churn_impact=high|medium|low|none
pain_point_category=Billing|Feature|UX|Bug|Support|Other|Value
solving_priority=critical|high|medium|low
intent=Praise|Complaint|Suggest|Recommend|Question|Inform|Informative
urgency=High|Medium|Low|None
user_segment=New|Veteran|Detractor|Promoter|Neutral
journey_stage=onboarding|active_use|support|renewal|cancellation|advocacy|unknown
action_owner=Product|Support|Growth|CX|Billing|Engineering|Leadership|Unknown

JSON shape:
{{
  "review_id": "{review_id}",
  "sentiment": "positive",
  "sentiment_score": 0.0,
  "confidence": 0.0,
  "churn_risk": "low",
  "churn_impact": "none",
  "pain_point_category": "Other",
  "issue": "short issue label",
  "root_cause": "short cause or None",
  "solving_priority": "medium",
  "action_owner": "Unknown",
  "action_recommendation": "short next step or None",
  "feature_request": "explicit ask or None",
  "user_suggestion": "explicit suggestion or None",
  "theme_primary": "short theme or None",
  "theme_cluster": "reusable cluster or None",
  "cluster_label": "segment plus cluster or None",
  "trending_theme": "reusable cluster or None",
  "emerging_theme": "new niche signal or None",
  "intent": "Inform",
  "emotions": [],
  "urgency": "None",
  "user_segment": "Neutral",
  "journey_stage": "unknown",
  "domain_insight": "short business implication",
  "revenue_sensitivity": false
}}

Input:
rating={rating}/5
text={content}"""


def build_record_analysis_prompt(
    *,
    analysis_mode: str,
    vertical: str,
    focus_keywords: str,
    custom_instructions: str,
    emotions_list: Iterable[str],
    sentiments: str,
    churn_risks: str,
    pain_points: str,
    intents: str,
    urgency_levels: str,
    segments: str,
    rating: int,
    content: str,
    review_id: str,
    record_context: Optional[Dict[str, str]] = None,
) -> str:
    analysis_mode = normalize_analysis_mode(analysis_mode)
    emotions_text = ", ".join(f'"{_clean_text(emotion, 30)}"' for emotion in emotions_list)
    custom_focus = _clean_text(custom_instructions, 500)
    context_lines = _format_context_lines(record_context)
    focus_keywords = _clean_text(focus_keywords, 220)
    content_limit = 460 if analysis_mode == "feedback_crm" else 900
    content = _clean_text(content, content_limit)
    review_id = _clean_text(review_id, 60) or "unknown"

    if analysis_mode == "feedback_crm":
        return _build_feedback_crm_fast_prompt(
            vertical=vertical,
            focus_keywords=focus_keywords,
            custom_instructions=custom_focus,
            sentiments=sentiments,
            churn_risks=churn_risks,
            pain_points=pain_points,
            intents=intents,
            urgency_levels=urgency_levels,
            segments=segments,
            rating=rating,
            content=content,
            review_id=review_id,
            record_context=record_context,
        )

    custom_block = f"\nCUSTOM FOCUS:\n- {custom_focus}" if custom_focus else ""

    json_shape = f"""{{
  "review_id": "{review_id}",
  "sentiment": "{sentiments}",
  "sentiment_score": -1.0_to_1.0,
  "confidence": 0.0_to_1.0,
  "churn_risk": "{churn_risks}",
  "pain_point_category": "{pain_points}",
  "issue": "short specific complaint_or_praise_driver",
  "root_cause": "short underlying reason or None",
  "feature_request": "explicit requested capability or None",
  "trending_theme": "reusable cluster label or None",
  "emerging_theme": "new_or_niche_signal or None",
  "intent": "{intents}",
  "emotions": [{emotions_text}],
  "urgency": "{urgency_levels}",
  "user_segment": "{segments}",
  "domain_insight": "one concise vertical-specific implication",
  "revenue_sensitivity": true_or_false
}}"""

    return f"""TASK: Analyze one customer-feedback record and return ONLY one valid JSON object.

ANALYSIS MODE:
{analysis_mode}

BUSINESS CONTEXT:
{_context_brief(analysis_mode)}

VERTICAL:
- vertical: {vertical.upper()}
- domain focus keywords: {focus_keywords or "general product experience, support, pricing, retention, and usability"}

RECORD CONTEXT:
{context_lines}{custom_block}

GROUNDING RULES:
1. Use the text as the primary source of truth. Rating and record context are secondary hints only.
2. Do not invent features, competitors, user segments, or root causes that are not supported by the text.
3. Keep labels aggregation-friendly:
- "issue" should be a specific 3-8 word pain point or praise driver, not a vague category label.
- "root_cause" should be the shortest plausible underlying reason, not a rewrite of the full complaint.
- "trending_theme" should be a reusable cluster label that similar records could share.
- "emerging_theme" should be "None" unless the feedback contains a niche, early, or unusual signal.
4. "feature_request" must only be populated when the user explicitly asks for a capability, integration, workflow, option, or improvement. Otherwise return "None".
5. Map categories consistently:
- Billing: pricing, charges, refunds, renewal, contract, downgrade, cancellation friction, overages, plan confusion
- Feature: missing capability, missing integration, missing workflow, reporting gap, automation need
- UX: confusing flow, onboarding friction, setup friction, navigation, discoverability, copy/form friction
- Bug: crash, outage, broken behavior, reliability failure, login failure, data loss, broken integration, performance defect
- Support: support quality, response time, ownership, communication, handoff, unresolved case
- Value: good value, poor ROI, not worth it, price-to-value mismatch without a billing mechanics issue
- Other: everything else, including broad praise or general information
6. Churn risk rules:
- high: explicit cancel/refund/switch/non-renew/downgrade, or severe unresolved blocker
- medium: strong dissatisfaction or repeated friction without an explicit leaving signal
- low: positive, neutral, mixed, or informational feedback without clear leaving risk
7. Urgency rules:
- High: blocker, outage, money loss, cancellation, security/trust risk, repeated failure
- Medium: clear friction with meaningful business impact
- Low: minor annoyance, isolated request, or small suggestion
- None: pure praise or purely informational
8. User segment rules:
- New: trial, onboarding, first-time, recently started
- Veteran: long-time, repeat, frequent, renewal, admin, seat owner, power user
- Detractor: strong public criticism or discouraging language
- Promoter: explicit advocacy or recommendation
- Neutral: unclear
9. Domain insight must be one concise business implication tied to the text and the vertical. Do not repeat the issue verbatim.
10. Revenue sensitivity is true only if the feedback touches pricing, billing, contract terms, downgrade, refund, renewal, churn, ROI, seat count, or overage exposure.
11. Return a single-line JSON object only. No markdown. No commentary.

JSON SHAPE:
{json_shape}

RECORD:
Rating: {rating}/5
Text: {content}"""


def build_cxm_review_prompt(text: str) -> str:
    text = _clean_text(text, 1200)
    return f"""TASK: Analyze one subscription-app/business feedback record. Return ONLY one JSON object.

Use this exact JSON schema:
{{
  "sentiment": "positive|neutral|negative",
  "sentiment_score": -1.0_to_1.0,
  "churn_risk": "low|medium|high",
  "churn_probability": 0.0_to_1.0,
  "themes": ["Billing","Pricing","Cancellation","Renewal","Support","Bug","Reliability","Performance","UX","Onboarding","Feature Gap","Integration","Data & Reporting","Security & Trust","Value & ROI","Delivery","Communication"],
  "pain_point": "onboarding_friction|pricing_value_gap|billing_renewal_friction|performance_latency|bugs_reliability|missing_features|integration_gaps|support_quality|analytics_reporting_gap|trust_security|ux_complexity|positive_experience|other",
  "churn_intent_cluster": "active_churn|high_risk_friction|price_shock|feature_gap_switch_risk|support_breakdown|onboarding_dropoff|no_churn_signal",
  "user_segment": "trial_new|active_paid|power_admin|team_buyer|detractor|promoter|unknown",
  "growth_opportunity": "improve_onboarding|pricing_packaging|retention_playbook|reliability_investment|feature_prioritization|integration_expansion|support_sla_upgrade|self_serve_education|value_communication|advocacy_program|none",
  "main_problem_flag": true_or_false
}}

Rules:
1. Use only evidence in the feedback text.
2. themes: choose 1 to 4 reusable labels from the list above.
3. churn_risk=high for explicit cancel/refund/switch/non-renew or severe unresolved blocker.
4. main_problem_flag=true only when this feedback reflects a likely high-impact churn driver.
5. Keep output compact JSON only (no markdown, no explanation).

FEEDBACK:
{text}"""


def build_sentiment_prompt(feedback_text: str) -> str:
    feedback_text = _clean_text(feedback_text, 1000)
    return f"""TASK: Classify the sentiment of this customer feedback.

The feedback may be a review, support ticket, cancellation note, or survey response.

Rules:
1. Use the text itself as the source of truth.
2. If the tone is clearly appreciative, return positive.
3. If the tone is clearly frustrated, disappointed, angry, or churn-oriented, return negative.
4. If the tone is mixed, factual, or too ambiguous, return neutral.
5. Return JSON only.

OUTPUT FORMAT:
{{
  "sentiment": "positive | neutral | negative"
}}

INPUT:
{feedback_text}"""


def build_issue_detection_prompt(feedback_text: str) -> str:
    feedback_text = _clean_text(feedback_text, 1000)
    return f"""TASK: Extract the main actionable issue from this customer-feedback record.

The feedback may be a review, support case, CRM note, cancellation reason, or survey response.

Return JSON only using this format:
{{
  "issue_category": "bug | performance | usability | feature_request | billing | support | other",
  "issue_description": "specific 3-10 word issue summary",
  "root_cause": "short underlying reason or empty string",
  "theme": "reusable grouping label",
  "journey_stage": "onboarding | active_use | support | renewal | cancellation | advocacy | unknown",
  "customer_action": "cancel | switch | refund | complain | request_feature | none",
  "urgency": "low | medium | high",
  "churn_risk": "low | medium | high"
}}

Rules:
1. Ground every field in the text. Do not invent details.
2. "issue_description" must be specific enough to group similar cases later.
3. Use "billing" for pricing, refunds, charges, renewals, contracts, or cancellation friction.
4. Use "performance" for slowness, lag, timeouts, and responsiveness issues.
5. Use "usability" for confusing flows, navigation, onboarding friction, and setup complexity.
6. Use "feature_request" only when the customer explicitly asks for a missing capability or workflow.
7. Set journey_stage to cancellation or renewal when the feedback is about leaving, renewing, downgrading, or pricing review.
8. Set churn_risk to high for explicit cancel/refund/switch/non-renew language or severe unresolved pain.

INPUT:
{feedback_text}"""


def build_feature_request_prompt(feedback_text: str) -> str:
    feedback_text = _clean_text(feedback_text, 1000)
    return f"""TASK: Detect whether this feedback contains an explicit feature request.

Return JSON only:
{{
  "feature_request": true | false,
  "requested_feature": "short feature summary or empty string",
  "desired_outcome": "what the customer wants to achieve or empty string"
}}

Rules:
1. Only return feature_request=true if the customer explicitly asks for a capability, integration, workflow, option, or enhancement.
2. Complaints without a clear ask are not feature requests.
3. Keep requested_feature concise and reusable for grouping.
4. Keep desired_outcome focused on the user's job to be done.

INPUT:
{feedback_text}"""


def build_issue_title_prompt(feedback_samples: Iterable[str]) -> str:
    sample_lines = "\n".join(f"- {_clean_text(sample, 180)}" for sample in list(feedback_samples)[:5])
    return f"""TASK: Create one clear, aggregation-friendly issue title for these similar feedback snippets.

Rules:
1. Use a short noun phrase, usually 2 to 5 words.
2. Be specific. Avoid generic titles like "Bug", "Feedback Issue", or "Customer Problem".
3. Prefer the recurring pain point over emotional wording.
4. Return JSON only.

OUTPUT FORMAT:
{{
  "issue_title": "Short issue title"
}}

INPUT:
{sample_lines}"""
