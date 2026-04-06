import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from feedback_crm import fi_create_feedback, fi_link_feedback_to_issue, fi_recalculate_all_issues, fi_create_issue, fi_list_issues

from ai_tools.sentiment_tool import analyze_sentiment
from ai_tools.issue_detection_tool import detect_issue
from ai_tools.feature_request_tool import detect_feature_request
from ai_tools.issue_title_tool import generate_issue_title

logger = logging.getLogger("hyzync.feedback_ingestion")

# ── Universal Feedback Schema ────────────────────────────────────────────────
class UniversalFeedback(BaseModel):
    model_config = ConfigDict(extra='ignore')
    
    feedback_text: str
    source: str
    source_type: str
    rating: Optional[int] = None
    customer_identifier: Optional[str] = None
    created_at: Optional[str] = None
    metadata_json: Dict[str, Any] = {}


# ── Connector Mapping Layer ──────────────────────────────────────────────────

def map_playstore(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("reviewed_at") or raw.get("at") or raw.get("date") or raw.get("created_at")
    return UniversalFeedback(
        feedback_text=raw.get("content") or raw.get("review_text", ""),
        rating=raw.get("score") or raw.get("star_rating"),
        customer_identifier=raw.get("userName") or raw.get("username"),
        source=raw.get("cxm_source_name") or "playstore",
        source_type="app_review",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["content", "review_text", "score", "star_rating", "userName", "username"]}
    )

def map_appstore(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("reviewed_at") or raw.get("at") or raw.get("date") or raw.get("created_at")
    return UniversalFeedback(
        feedback_text=raw.get("content", ""),
        rating=raw.get("score") or raw.get("rating"),
        customer_identifier=raw.get("author"),
        source=raw.get("cxm_source_name") or "appstore",
        source_type="app_review",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["content", "score", "rating", "author"]}
    )

def map_trustpilot(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("reviewed_at") or raw.get("at") or raw.get("date") or raw.get("created_at")
    return UniversalFeedback(
        feedback_text=raw.get("review", ""),
        rating=raw.get("stars"),
        customer_identifier=raw.get("reviewer_name"),
        source=raw.get("cxm_source_name") or "trustpilot",
        source_type="review",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["review", "stars", "reviewer_name"]}
    )

def map_surveymonkey(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("submitted_at") or raw.get("created_at") or raw.get("at")
    return UniversalFeedback(
        feedback_text=raw.get("response", ""),
        customer_identifier=raw.get("respondent_email"),
        source=raw.get("cxm_source_name") or "surveymonkey",
        source_type="survey",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["response", "respondent_email"]}
    )

def map_typeform(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("submitted_at") or raw.get("created_at") or raw.get("at")
    return UniversalFeedback(
        feedback_text=raw.get("answer", ""),
        customer_identifier=raw.get("email"),
        source=raw.get("cxm_source_name") or "typeform",
        source_type="survey",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["answer", "email"]}
    )

def map_salesforce(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("created_at") or raw.get("at") or raw.get("date")
    return UniversalFeedback(
        feedback_text=raw.get("ticket_body", ""),
        customer_identifier=raw.get("email"),
        source=raw.get("cxm_source_name") or "salesforce",
        source_type="support_ticket",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["ticket_body", "email"]}
    )

def map_csv(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("created_at") or raw.get("at") or raw.get("date")
    return UniversalFeedback(
        feedback_text=raw.get("feedback_text", raw.get("content", "")),
        rating=raw.get("rating", raw.get("score")),
        customer_identifier=raw.get("customer", raw.get("email")),
        source=raw.get("cxm_source_name") or "csv_upload",
        source_type="csv",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["feedback_text", "content", "rating", "score", "customer", "email"]}
    )

def map_api(raw: dict) -> UniversalFeedback:
    created_at = raw.get("cxm_reviewed_at") or raw.get("created_at") or raw.get("at") or raw.get("date")
    return UniversalFeedback(
        feedback_text=raw.get("text", ""),
        rating=raw.get("rating"),
        customer_identifier=raw.get("user_id"),
        source=raw.get("cxm_source_name") or "generic_api",
        source_type="api",
        created_at=str(created_at) if created_at else None,
        metadata_json={k: v for k, v in raw.items() if k not in ["text", "rating", "user_id"]}
    )

MAPPERS = {
    "playstore": map_playstore,
    "appstore": map_appstore,
    "trustpilot": map_trustpilot,
    "surveymonkey": map_surveymonkey,
    "typeform": map_typeform,
    "salesforce": map_salesforce,
    "crm": map_salesforce,
    "csv": map_csv,
    "api": map_api,
    "generic_api": map_api,
    "webhook": map_api,
}

# ── Universal Pipeline ───────────────────────────────────────────────────────

def process_feedback(tenant_id: int, connector_type: str, raw_payload: dict) -> int:
    """
    1. Connector mapping
    2. Universal feedback object
    3. Run AI analysis (sentiment, issue detection, feature request)
    4. Insert into feedback table
    5. Assign issue_id (link or create)
    6. Update CRM inbox & issue statistics
    """
    logger.info(f"[INGESTION] Processing feedback from {connector_type}...")
    
    # 1 & 2: Map to Universal Feedback
    mapper = MAPPERS.get(connector_type)
    if not mapper:
        raise ValueError(f"Unknown connector type: {connector_type}")
    
    uf = mapper(raw_payload)
    if not uf.feedback_text:
        raise ValueError("Mapped feedback object is missing feedback_text")
        
    # 3: Run AI analysis
    logger.info("[INGESTION] Running AI sentiment analysis...")
    sentiment_res = analyze_sentiment(uf.feedback_text)
    sentiment = sentiment_res.get("sentiment", "neutral")
    
    logger.info("[INGESTION] Running AI issue detection...")
    issue_res = detect_issue(uf.feedback_text)
    issue_category = issue_res.get("issue_category", "other")
    issue_desc = issue_res.get("issue_description", "")
    
    logger.info("[INGESTION] Running AI feature request detection...")
    feature_res = detect_feature_request(uf.feedback_text)
    
    # Store extra AI analysis in metadata
    uf.metadata_json["issue_category"] = issue_category
    uf.metadata_json["issue_description"] = issue_desc
    uf.metadata_json["root_cause"] = issue_res.get("root_cause", "")
    uf.metadata_json["theme"] = issue_res.get("theme", "")
    uf.metadata_json["journey_stage"] = issue_res.get("journey_stage", "unknown")
    uf.metadata_json["customer_action"] = issue_res.get("customer_action", "none")
    uf.metadata_json["urgency"] = issue_res.get("urgency", "medium")
    uf.metadata_json["churn_risk"] = issue_res.get("churn_risk", "low")
    uf.metadata_json["is_feature_request"] = feature_res.get("feature_request", False)
    if feature_res.get("requested_feature"):
        uf.metadata_json["requested_feature"] = feature_res["requested_feature"]
    if feature_res.get("desired_outcome"):
        uf.metadata_json["desired_outcome"] = feature_res["desired_outcome"]

    priority = "medium"
    if sentiment == "negative":
        priority = "high"
    elif sentiment == "positive" and issue_category == "other":
        priority = "low"

    if issue_category in ["bug", "billing", "performance"]:
        priority = "high"
    if issue_res.get("urgency") == "high" or issue_res.get("churn_risk") == "high":
        priority = "high"
    if issue_res.get("customer_action") in {"cancel", "switch", "refund"}:
        priority = "high"
        
    # 4: Insert to CRM
    logger.info("[INGESTION] Storing feedback in CRM...")
    feedback_id = fi_create_feedback(
        tenant_id=tenant_id,
        text=uf.feedback_text,
        sentiment=sentiment,
        source=uf.source,
        source_type=uf.source_type,
        rating=uf.rating,
        metadata_json=json.dumps(uf.metadata_json),
        customer_identifier=uf.customer_identifier,
        priority=priority,
        created_at=uf.created_at,
    )
    
    # 5: Assign issue_id
    assigned_issue_id = _assign_issue_id(tenant_id, uf.feedback_text, issue_category, issue_desc)
    
    if assigned_issue_id:
        fi_link_feedback_to_issue(feedback_id, assigned_issue_id, tenant_id)
        
    return feedback_id

def _assign_issue_id(tenant_id: int, feedback_text: str, category: str, description: str) -> Optional[int]:
    """Find a related issue or create a new one based on AI."""
    existing_issues = fi_list_issues(tenant_id, limit=20)["items"]
    
    # Simple similarity based linking (if a recent issue has exact same category/close description) - in reality we would use embeddings
    # We will try to find a match by sending it to LLM for title, and seeing if title matches, or just create it.
    
    title_res = generate_issue_title([feedback_text, description])
    title = title_res.get("issue_title")
    if not title:
        title = f"{category.capitalize()} Issue"
        
    # Check if an issue with this title already exists
    for iss in existing_issues:
        if iss["name"].lower() == title.lower():
            return iss["id"]
            
    # Create new issue
    new_id = fi_create_issue(tenant_id, title, description)
    return new_id
