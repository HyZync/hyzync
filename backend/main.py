import os
import threading
import time
from typing import List, Optional, Dict, Any
from config import settings
from logging_config import setup_logging

# Initialize structured logging
logger = setup_logging(settings.ENVIRONMENT)

def log_debug(msg: str) -> None:
    """Structured log at INFO level."""
    logger.info(msg)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Body, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import pandas as pd
import json
import io
import csv
import uuid
from datetime import datetime, timedelta
import uvicorn
import asyncio
import threading
import time
import telemetry
from security import get_current_user, create_access_token

# Import ported logic
from database import (
    init_database, create_user, verify_user, save_analysis,
    get_user_analyses, get_all_analyses_df, get_latest_analysis_df,
    get_user_connectors, save_user_connector, delete_user_connector,
    save_raw_reviews, get_raw_review_stats, get_latest_raw_reviews,
    create_workspace, get_user_workspaces, get_workspace_by_id, delete_workspace,
    # CRM functions
    crm_upsert_profiles, crm_get_profiles, crm_get_profile, crm_update_profile,
    crm_add_feedback, crm_get_feedbacks, crm_update_feedback_analysis,
    crm_save_analysis, crm_get_analysis_history, crm_delete_profile,
    # Survey functions
    survey_create, survey_list, survey_get, survey_get_by_token, survey_update,
    survey_delete, survey_save_questions, survey_submit_response,
    survey_get_responses, survey_get_analytics,
    # CXM Feedback Intelligence functions
    cxm_get_sources, cxm_create_source, cxm_update_source, cxm_delete_source,
    cxm_get_source, cxm_insert_reviews, cxm_get_reviews, cxm_get_trend_data,
    cxm_get_summary, cxm_get_campaigns, cxm_create_campaign, cxm_update_campaign,
    cxm_delete_campaign, cxm_update_last_fetched,
    cxm_get_customer_profiles, cxm_get_customer_detail,
    cxm_get_source_by_webhook_token, cxm_update_review_analysis_batch,
    cxm_count_pending_reviews, track_analysis_usage, get_llm_preferences,
    set_llm_preferences, get_llm_usage_summary, get_access_code_record,
    claim_access_code_user, get_access_code_user_payload, update_last_login
)
import cxm_scheduler
from trustpilot_connector import fetch_trustpilot_reviews
from analytics import get_health_metrics, categorize_metrics, calculate_sentiment_trends
from copilot import chat_with_copilot
from playstore_connector import fetch_raw_playstore_reviews
from appstore_connector import fetch_appstore_reviews
# Advanced Intelligence Modules
from economic_impact import calculate_revenue_at_risk, generate_roi_ranked_report
from strategic_narrative import generate_scr_brief, create_executive_onepager
import processor
import predictive_intelligence
import competitive_intelligence
import causal_diagnostics
import enterprise_trust
import decision_engine
import impact_effort_matrix
import data_export
import pdf_generator
import feedback_crm
import feedback_ingestion
import fi_platform
import llm_gateway
from ai_tools.winback_tool import draft_winback_email
from workspace_admin import (
    get_billing_dashboard,
    get_connector_settings,
    get_documentation_article,
    get_user_profile_bundle,
    get_workspace_settings_bundle,
    init_workspace_admin_tables,
    list_documentation_articles,
    update_billing_account,
    update_connector_settings,
    update_user_profile_bundle,
    update_workspace_settings_bundle,
)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    init_database()
    init_workspace_admin_tables()
    feedback_crm.init_crm_tables()
    fi_platform.init_platform_tables()
    # Start background task cleanup thread
    cleanup_thread = threading.Thread(target=_cleanup_stale_tasks, daemon=True)
    cleanup_thread.start()
    # Start CXM Scheduler
    cxm_scheduler.init_scheduler()
    logger.info("[INIT] Database initialized, task cleanup started, CXM scheduler running")
    yield
    # Shutdown logic
    cxm_scheduler.shutdown_scheduler()
    logger.info("[SHUTDOWN] Application resources cleaned up")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
)



# ── Rate Limiting (slowapi) ────────────────────────────────────────────────────
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Security Headers Middleware ────────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects defensive HTTP headers on every response."""
    async def dispatch(self, request: StarletteRequest, call_next):
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # HSTS — only meaningful over HTTPS; harmless over HTTP
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Restrictive CSP — allows same-origin assets + the LLM API origin
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "connect-src 'self' https://ai.hyzync.com; "
            "img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline'; "
            "script-src 'self'"
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── Request Body Size Limit ────────────────────────────────────────────────────
MAX_BODY_SIZE = 50 * 1024 * 1024  # 50 MB — large enough for CSV/Excel uploads

class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects requests with a body larger than MAX_BODY_SIZE to prevent DoS."""
    async def dispatch(self, request: StarletteRequest, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request body too large. Maximum allowed: {MAX_BODY_SIZE // (1024*1024)} MB."},
            )
        return await call_next(request)

app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler — added AFTER CORSMiddleware so CORS runs first (LIFO)
class ExceptionLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            logger.error("Unhandled exception on %s %s\n%s", request.method, request.url, tb)
            with open("api_crash.txt", "w") as f:
                f.write(f"{request.url}\n{tb}")
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred. Please try again later."},
            )

app.add_middleware(ExceptionLoggingMiddleware)

# Request-Response logging for monitoring
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(
            f"Method: {request.method} Path: {request.url.path} "
            f"Status: {response.status_code} Duration: {process_time:.3f}s"
        )
        return response

app.add_middleware(RequestLoggingMiddleware)

# ── Health Check ────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def api_health():
    """
    Check API and Database health.
    """
    db_ok = False
    try:
        from database import get_db_connection
        conn = get_db_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception as e:
        logger.error(f"[HEALTH] Database check failed: {e}")

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "hyzync-api",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/admin/stats")
async def get_admin_stats():
    """Get high-level telemetry stats."""
    return telemetry.get_dashboard_stats()

@app.get("/api/admin/errors")
async def get_admin_errors(limit: int = 50):
    """Get recent LLM and system errors."""
    return {"errors": telemetry.get_recent_errors(limit)}

@app.get("/api/admin/jobs")
async def get_admin_jobs(limit: int = 20):
    """Get recent analysis jobs."""
    return {"jobs": telemetry.get_recent_jobs(limit)}

# Note: on_event is deprecated, handled via lifespan above.

# --- Advanced Intelligence Endpoints ---

@app.get("/api/analytics/advanced/{analysis_id}")
async def get_advanced_analytics(analysis_id: int, current_user: dict = Depends(get_current_user)):
    """
    Consolidates insights from all advanced intelligence modules for a specific analysis.
    """
    from database import get_analysis_by_id
    
    analysis = get_analysis_by_id(analysis_id, current_user["user_id"])
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Extract reviews and existing analytics
    results_data = analysis.get('results', {})
    reviews = results_data.get('reviews', [])
    base_analytics = results_data.get('analytics', {})
    
    if not reviews:
        return {"status": "error", "message": "No reviews found for this analysis"}
    
    df = pd.DataFrame(reviews)
    vertical = analysis.get('vertical', 'generic')
    arpu = analysis.get('config', {}).get('arpu', 50.0)
    
    # 1. Predictive Intelligence
    velocity_events = predictive_intelligence.detect_acceleration_events(df)
    crisis_alerts = predictive_intelligence.generate_crisis_alerts(df)
    churn_intent = predictive_intelligence.get_churn_intent_summary(
        predictive_intelligence.tag_churn_intent_reviews(df)
    )
    
    # 2. Competitive Intelligence
    competitive_threats = competitive_intelligence.generate_competitive_threat_report(df)
    
    # 3. Causal Diagnostics
    causal_report = causal_diagnostics.generate_causal_insights_report(df)
    rating_attribution = causal_diagnostics.generate_rating_attribution_chart(df)
    
    # 4. Strategic Prioritization
    priority_matrix = impact_effort_matrix.create_impact_effort_matrix(df, base_analytics, arpu)
    decision_package = decision_engine.generate_decision_summary(df, base_analytics, vertical)
    
    # 5. Trust & Compliance (Sample Audit)
    trust_summary = enterprise_trust.get_audit_trail_summary(days_back=7)
    
    return {
        "analysis_id": analysis_id,
        "predictive": {
            "velocity": velocity_events.replace({float('nan'): None}).to_dict('records') if not velocity_events.empty else [],
            "crisis_alerts": crisis_alerts,
            "churn_intent": churn_intent
        },
        "competitive": competitive_threats,
        "causal": {
            "insights": causal_report,
            "attribution": rating_attribution.replace({float('nan'): None}).to_dict('records') if not rating_attribution.empty else []
        },
        "prioritization": {
            "matrix": priority_matrix,
            "decision": decision_package
        },
        "trust": trust_summary
    }

@app.get("/api/analytics/export/{analysis_id}")
async def export_analysis_data(analysis_id: int, format: str = "zip", current_user: dict = Depends(get_current_user)):
    """
    Export full analysis data including reviews and advanced insights.
    """
    from database import get_analysis_by_id
    analysis = get_analysis_by_id(analysis_id, current_user["user_id"])
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Combine data for export
    export_data = {
        "analysis": analysis,
        "export_date": datetime.now().isoformat(),
        "user": {"email": current_user["email"]}
    }
    
    if format == "zip":
        archive_bytes = data_export.create_export_archive(export_data)
        return StreamingResponse(
            io.BytesIO(archive_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=horizon_export_{analysis_id}.zip"}
        )
    
    return export_data

# --- Models ---
class AnalysisRequest(BaseModel):
    source_type: str  # 'trustpilot', 'playstore', 'appstore'
    identifier: str    # domain, package_name, app_name
    vertical: str      # 'generic', 'subscription', etc.
    max_reviews: int = 100
    arpu: float = 50.0
    renewal_cycle: str = "monthly"
    country: str = "us"
    workspace_id: Optional[int] = None

class AnalysisResponse(BaseModel):
    id: Optional[int] = None
    task_id: str
    status: str
    message: str

class CleanRequest(BaseModel):
    reviews: List[Dict[str, Any]]

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str


class AccessCodeLoginRequest(BaseModel):
    code: str
    name: Optional[str] = None
    contact_email: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None

class ProcessRequest(BaseModel):
    reviews: List[Dict[str, Any]]
    vertical: str
    user_id: Optional[int] = None
    tenant_id: Optional[int] = None
    arpu: float = 50.0
    renewal_cycle: str = "monthly"
    custom_instructions: Optional[str] = None
    audience: Optional[str] = None  # 'b2b', 'b2c', or None
    nps_mode: Optional[bool] = False
    device_id: Optional[str] = None # For beta anonymous usage
    cleaning_mode: Optional[str] = "magic"  # 'magic' or 'manual'
    manual_filters: Optional[str] = ""

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class LLMSettingsRequest(BaseModel):
    is_enabled: Optional[bool] = None
    billing_enabled: Optional[bool] = None

class ConnectorRequest(BaseModel):
    connector_type: str
    identifier: str
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    workspace_id: Optional[int] = None
    fetch_interval: Optional[str] = 'daily'
    analysis_interval: Optional[str] = None
    max_reviews: Optional[int] = 100
    connector_scope: Optional[str] = None

class WorkspaceRequest(BaseModel):
    name: str
    description: Optional[str] = ''
    vertical: Optional[str] = 'generic'

class UserProfileRequest(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    theme_mode: Optional[str] = None
    timezone: Optional[str] = None
    digest_frequency: Optional[str] = None
    notify_analysis_complete: Optional[bool] = None
    notify_connector_failures: Optional[bool] = None
    notify_billing_updates: Optional[bool] = None

class WorkspaceSettingsRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    vertical: Optional[str] = None
    locale: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    default_arpu: Optional[float] = None
    renewal_cycle: Optional[str] = None
    auto_sync_enabled: Optional[bool] = None
    auto_analysis_enabled: Optional[bool] = None
    daily_digest_enabled: Optional[bool] = None
    slack_webhook_url: Optional[str] = None
    retention_target: Optional[float] = None
    export_format: Optional[str] = None
    security_mode: Optional[str] = None
    data_retention_days: Optional[int] = None

class ConnectorSettingsRequest(BaseModel):
    name: Optional[str] = None
    fetch_interval: Optional[str] = None
    analysis_interval: Optional[str] = None
    max_reviews: Optional[int] = None
    config: Optional[Dict[str, Any]] = None

class BillingAccountRequest(BaseModel):
    plan_name: Optional[str] = None
    plan_status: Optional[str] = None
    billing_email: Optional[str] = None
    company_name: Optional[str] = None
    currency: Optional[str] = None
    seats: Optional[int] = None
    base_fee: Optional[float] = None
    per_seat_fee: Optional[float] = None
    token_budget: Optional[int] = None
    overage_rate: Optional[float] = None
    auto_renew: Optional[bool] = None
    next_invoice_date: Optional[str] = None
    payment_brand: Optional[str] = None
    payment_last4: Optional[str] = None
    billing_address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None
    token_billing_enabled: Optional[bool] = None

class PreloadRequest(BaseModel):
    source_type: str
    identifier: str
    country: str = "us"
    max_reviews: int = 200
    workspace_id: Optional[int] = None
    config: Optional[Dict[str, Any]] = None  # auth tokens, field mappings, URLs, etc.


VALID_FETCH_INTERVALS = {"hourly", "daily", "weekly", "manual"}
VALID_CONNECTOR_TYPES = {
    "appstore",
    "playstore",
    "trustpilot",
    "csv",
    "surveymonkey",
    "typeform",
    "crm",
    "salesforce",
    "api",
    "generic_api",
    "webhook",
    "survey",
}
FI_ALLOWED_CONNECTOR_SCOPES = {"workspace", "feedback_crm"}


def _llm_enabled_for_user(user_id: int, tenant_id: Optional[int] = None) -> bool:
    prefs = get_llm_preferences(user_id, tenant_id)
    return bool(prefs.get("is_enabled", True))


def _estimate_llm_cost(total_tokens: int, billing_enabled: bool) -> float:
    if not billing_enabled:
        return 0.0
    tokens = max(0, int(total_tokens or 0))
    return round((tokens / 1000.0) * float(settings.LLM_BILLING_RATE_PER_1K_TOKENS), 6)


def _build_llm_tool_modes(prefs: Dict[str, Any], health: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    usage_enabled = bool(prefs.get("is_enabled", True))
    endpoint_online = bool(health.get("ok"))
    base_mode = "paused"
    if usage_enabled:
        base_mode = "live" if endpoint_online else "standby"
    base_available = usage_enabled
    return {
        "analysis": {
            "available": base_available,
            "mode": base_mode,
            "description": "Live analysis" if base_mode == "live" else ("Standby analysis" if base_mode == "standby" else "Usage paused"),
        },
        "crm_replies": {
            "available": base_available,
            "mode": base_mode,
            "description": "AI reply generation" if base_mode == "live" else ("Standby reply drafting" if base_mode == "standby" else "Usage paused"),
        },
        "winback": {
            "available": base_available,
            "mode": base_mode,
            "description": "AI winback drafting" if base_mode == "live" else ("Standby winback drafting" if base_mode == "standby" else "Usage paused"),
        },
        "agentic_outreach": {
            "available": base_available,
            "mode": base_mode,
            "description": "AI offer matching and outreach drafting" if base_mode == "live" else ("Standby outreach drafting" if base_mode == "standby" else "Usage paused"),
        },
    }


def _build_llm_gateway_payload(prefs: Dict[str, Any], health: Dict[str, Any]) -> Dict[str, Any]:
    usage_enabled = bool(prefs.get("is_enabled", True))
    billing_enabled = bool(prefs.get("billing_enabled", True))
    endpoint_online = bool(health.get("ok"))
    fallback_active = bool(health.get("fallback_active"))
    if not usage_enabled:
        mode = "paused"
    elif endpoint_online and not fallback_active:
        mode = "live"
    elif endpoint_online and fallback_active:
        mode = "degraded"
    else:
        mode = "unavailable"
    return {
        "mode": mode,
        "usage_enabled": usage_enabled,
        "billing_enabled": billing_enabled,
        "endpoint_online": endpoint_online,
        "analysis_ready": usage_enabled and endpoint_online,
        "fallback_active": fallback_active,
        "primary_url": health.get("primary_url") or settings.OLLAMA_URL,
        "active_url": (health.get("active_url") or health.get("url") or "") if endpoint_online else "",
        "status": health.get("status"),
        "latency": health.get("latency"),
        "warning": health.get("warning"),
        "error": health.get("error"),
        "raw_error": health.get("raw_error"),
        "endpoints": list(health.get("endpoints") or []),
        "tools": _build_llm_tool_modes(prefs, health),
    }


def _extract_connector_scope(config_value: Any) -> str:
    cfg: Dict[str, Any] = {}
    if isinstance(config_value, dict):
        cfg = config_value
    elif isinstance(config_value, str):
        try:
            parsed = json.loads(config_value or "{}")
            if isinstance(parsed, dict):
                cfg = parsed
        except Exception:
            cfg = {}
    scope = str(cfg.get("_scope") or cfg.get("integration_scope") or "workspace").strip().lower()
    return scope or "workspace"


def _require_connector_scope(connector_id: int, current_user: dict, expected_scope: str) -> Dict[str, Any]:
    source = cxm_get_source(connector_id, current_user["user_id"], current_user["tenant_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Connector not found")
    scope = _extract_connector_scope(source.get("config"))
    if scope != expected_scope:
        raise HTTPException(status_code=404, detail="Connector not found")
    return source


def _is_fi_scope_allowed(scope: str) -> bool:
    return (scope or "").strip().lower() in FI_ALLOWED_CONNECTOR_SCOPES


def _require_fi_connector_access(connector_id: int, current_user: dict) -> Dict[str, Any]:
    source = cxm_get_source(connector_id, current_user["user_id"], current_user["tenant_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Connector not found")
    scope = _extract_connector_scope(source.get("config"))
    if not _is_fi_scope_allowed(scope):
        raise HTTPException(status_code=404, detail="Connector not found")
    return source

# --- Auth Endpoints ---

@app.post("/register")
@limiter.limit("3/minute")
async def register_user(request: Request, req: RegisterRequest):
    user_id = create_user(req.email, req.password, req.name)
    if not user_id:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = get_user_by_id(user_id)
    tenant_id = user['tenant_id']
    token = create_access_token(user_id, req.email, req.name, tenant_id)
    return {"user_id": user_id, "name": req.name, "email": req.email, "tenant_id": tenant_id, "token": token}

@app.post("/login")
@limiter.limit("5/minute")
async def login_user(request: Request, req: LoginRequest):
    user = verify_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user['id'], user['email'], user['name'], user['tenant_id'])
    return {"user_id": user['id'], "name": user['name'], "email": user['email'], "tenant_id": user['tenant_id'], "token": token}


@app.post("/api/access-code/login")
@limiter.limit("10/minute")
async def access_code_login(request: Request, req: AccessCodeLoginRequest):
    normalized_code = str(req.code or '').strip().upper()
    access_code = get_access_code_record(normalized_code)
    if not access_code:
        raise HTTPException(status_code=401, detail="Invalid access code")

    if access_code.get("user_id"):
        access_user = get_access_code_user_payload(normalized_code)
    else:
        if not str(req.name or '').strip():
            return {
                "status": "needs_profile",
                "code": normalized_code,
                "message": "Name is required to activate this access code.",
            }
        access_user = claim_access_code_user(
            normalized_code,
            req.name,
            contact_email=req.contact_email,
            company=req.company,
            role=req.role,
            notes=req.notes,
        )

    if not access_user or not access_user.get("user"):
        raise HTTPException(status_code=500, detail="Could not activate this access code")

    user = access_user["user"]
    profile = access_user.get("profile") or {}
    update_last_login(user["id"])
    token = create_access_token(user["id"], user["email"], user["name"], user.get("tenant_id"))
    return {
        "status": "success",
        "token": token,
        "user": {
            **user,
            "accessCode": profile.get("access_code") or normalized_code,
            "contactEmail": profile.get("contact_email"),
            "company": profile.get("company"),
            "role": profile.get("role"),
            "notes": profile.get("notes"),
        },
    }


@app.get("/api/me")
async def api_get_current_user_profile(current_user: dict = Depends(get_current_user)):
    profile = get_user_profile_bundle(current_user["user_id"], current_user.get("tenant_id"))
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile


@app.patch("/api/me")
async def api_update_current_user_profile(
    req: UserProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    profile = update_user_profile_bundle(
        current_user["user_id"],
        current_user.get("tenant_id"),
        req.model_dump(exclude_none=True),
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return {"status": "success", **profile}

# --- Connector Endpoints ---

@app.get("/api/user/connectors")
async def fetch_user_connectors(
    workspace_id: Optional[int] = None,
    connector_scope: Optional[str] = "workspace",
    current_user: dict = Depends(get_current_user)
):
    # Now leverages cxm_sources under the hood
    connectors = get_user_connectors(
        current_user["user_id"],
        current_user["tenant_id"],
        workspace_id=workspace_id,
        connector_scope=connector_scope,
    )
    return {"connectors": connectors}


# ── User Connectors ────────────────────────────────────────────────────────────

@app.post("/api/user/connectors")
async def add_user_connector(
    request: ConnectorRequest,
    current_user: dict = Depends(get_current_user)
):
    connector_type = (request.connector_type or "").strip().lower()
    if connector_type not in VALID_CONNECTOR_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported connector_type. Use one of: {', '.join(sorted(VALID_CONNECTOR_TYPES))}",
        )

    # Ensure count is in the config for the scheduler to pick up
    cfg = request.config or {}
    cfg['count'] = request.max_reviews
    fetch_interval = (request.fetch_interval or "daily").strip().lower()
    if fetch_interval not in VALID_FETCH_INTERVALS:
        fetch_interval = "daily"
    analysis_interval = (request.analysis_interval or fetch_interval).strip().lower()
    if analysis_interval not in VALID_FETCH_INTERVALS:
        analysis_interval = fetch_interval if fetch_interval != "manual" else "manual"
    
    source_id = save_user_connector(
        current_user["user_id"],
        current_user["tenant_id"],
        connector_type,
        request.identifier,
        request.name,
        cfg,
        workspace_id=request.workspace_id,
        fetch_interval=fetch_interval,
        analysis_interval=analysis_interval,
        connector_scope=request.connector_scope or "workspace",
    )
    
    # Register/Update scheduler job
    if source_id and fetch_interval != 'manual':
        cxm_scheduler.schedule_source(source_id, fetch_interval)
        
    return {"status": "success", "message": "Connector saved", "source_id": source_id}

@app.delete("/api/user/connectors/{connector_id}")
async def remove_user_connector(
    connector_id: int,
    current_user: dict = Depends(get_current_user)
):
    _require_connector_scope(connector_id, current_user, "workspace")
    delete_user_connector(connector_id, current_user["tenant_id"])
    cxm_scheduler.remove_source_job(connector_id)
    return {"status": "success", "message": "Connector removed"}


@app.patch("/api/user/connectors/{connector_id}")
async def patch_user_connector(
    connector_id: int,
    request: ConnectorSettingsRequest,
    current_user: dict = Depends(get_current_user),
):
    updated = update_connector_settings(
        connector_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
        request.model_dump(exclude_none=True),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Connector not found")

    fetch_interval = str(updated.get("fetch_interval") or "manual").strip().lower()
    if fetch_interval == "manual":
        cxm_scheduler.remove_source_job(connector_id)
    else:
        cxm_scheduler.schedule_source(connector_id, fetch_interval)
    return {"status": "success", "connector": updated}


# --- Feedback CRM Connector Endpoints ---

@app.get("/api/fi/connectors")
async def fi_fetch_connectors(current_user: dict = Depends(get_current_user)):
    connectors = get_user_connectors(
        current_user["user_id"],
        current_user["tenant_id"],
        connector_scope=None,
    )
    fi_connectors = []
    for connector in connectors:
        scope = str(connector.get("scope") or _extract_connector_scope(connector.get("config"))).strip().lower()
        if not _is_fi_scope_allowed(scope):
            continue
        connector["scope"] = scope
        fi_connectors.append(connector)
    return {"connectors": fi_connectors}


@app.post("/api/fi/connectors")
async def fi_add_connector(request: ConnectorRequest, current_user: dict = Depends(get_current_user)):
    connector_type = (request.connector_type or "").strip().lower()
    if connector_type not in VALID_CONNECTOR_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported connector_type. Use one of: {', '.join(sorted(VALID_CONNECTOR_TYPES))}",
        )

    cfg = request.config or {}
    cfg['count'] = request.max_reviews
    fetch_interval = (request.fetch_interval or "manual").strip().lower()
    if fetch_interval not in VALID_FETCH_INTERVALS:
        fetch_interval = "manual"
    analysis_interval = (request.analysis_interval or "manual").strip().lower()
    if analysis_interval not in VALID_FETCH_INTERVALS:
        analysis_interval = "manual"

    source_id = save_user_connector(
        current_user["user_id"],
        current_user["tenant_id"],
        connector_type,
        request.identifier,
        request.name,
        cfg,
        workspace_id=None,
        fetch_interval=fetch_interval,
        analysis_interval=analysis_interval,
        connector_scope="feedback_crm",
    )

    if source_id and fetch_interval != 'manual':
        cxm_scheduler.schedule_source(source_id, fetch_interval)

    return {"status": "success", "message": "CRM connector saved", "source_id": source_id}


@app.delete("/api/fi/connectors/{connector_id}")
async def fi_remove_connector(connector_id: int, current_user: dict = Depends(get_current_user)):
    _require_connector_scope(connector_id, current_user, "feedback_crm")
    delete_user_connector(connector_id, current_user["tenant_id"])
    cxm_scheduler.remove_source_job(connector_id)
    return {"status": "success", "message": "CRM connector removed"}

# --- Workspace Endpoints ---

# Consolidated Workspace Endpoints (Last reload trigger: 2026-03-17 00:50)
@app.get("/api/workspaces")
def list_workspaces(current_user: dict = Depends(get_current_user)):
    """List all workspaces for a user."""
    workspaces = get_user_workspaces(current_user["user_id"], current_user["tenant_id"])
    return {"workspaces": workspaces}

@app.post("/api/workspaces")
def create_workspace_endpoint(
    request: WorkspaceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new workspace."""
    workspace_id = create_workspace(current_user["user_id"], current_user["tenant_id"], request.name, request.description or '', request.vertical or 'generic')
    if not workspace_id:
        raise HTTPException(status_code=500, detail="Failed to create workspace")
    workspace = get_workspace_by_id(workspace_id, current_user["user_id"], current_user["tenant_id"])
    return {"status": "success", "workspace": workspace}

@app.delete("/api/workspaces/{workspace_id}")
def delete_workspace_endpoint(
    workspace_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a workspace."""
    success = delete_workspace(workspace_id, current_user["user_id"], current_user["tenant_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"status": "success", "message": "Workspace deleted"}


@app.get("/api/workspaces/{workspace_id}/settings")
def get_workspace_settings_endpoint(
    workspace_id: int,
    current_user: dict = Depends(get_current_user),
):
    payload = get_workspace_settings_bundle(
        workspace_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return payload


@app.patch("/api/workspaces/{workspace_id}/settings")
def patch_workspace_settings_endpoint(
    workspace_id: int,
    request: WorkspaceSettingsRequest,
    current_user: dict = Depends(get_current_user),
):
    payload = update_workspace_settings_bundle(
        workspace_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
        request.model_dump(exclude_none=True),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"status": "success", **payload}


@app.get("/api/workspaces/{workspace_id}/billing")
def get_workspace_billing_endpoint(
    workspace_id: int,
    current_user: dict = Depends(get_current_user),
):
    payload = get_billing_dashboard(
        workspace_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Workspace billing not found")
    return payload


@app.patch("/api/workspaces/{workspace_id}/billing")
def patch_workspace_billing_endpoint(
    workspace_id: int,
    request: BillingAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    payload = update_billing_account(
        workspace_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
        request.model_dump(exclude_none=True),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Workspace billing not found")
    return {"status": "success", **payload}


@app.get("/api/workspaces/{workspace_id}/docs")
def get_workspace_docs_endpoint(
    workspace_id: int,
    query: str = "",
    category: str = "",
    current_user: dict = Depends(get_current_user),
):
    payload = list_documentation_articles(
        workspace_id,
        current_user["user_id"],
        current_user.get("tenant_id"),
        query=query,
        category=category,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return payload


@app.get("/api/workspaces/{workspace_id}/docs/{slug}")
def get_workspace_doc_article_endpoint(
    workspace_id: int,
    slug: str,
    current_user: dict = Depends(get_current_user),
):
    payload = get_documentation_article(
        workspace_id,
        slug,
        current_user["user_id"],
        current_user.get("tenant_id"),
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Documentation article not found")
    return payload


@app.get("/api/health/llm")
async def check_llm_health():
    """Verify connectivity to the LLM backend."""
    try:
        health = await asyncio.to_thread(llm_gateway.probe_connectivity)
        if health.get("ok"):
            return health
        return JSONResponse(status_code=503, content=health)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": str(e),
                "url": settings.OLLAMA_URL
            }
        )


@app.get("/api/llm/settings")
async def api_get_llm_settings(
    force_refresh: bool = False,
    current_user: dict = Depends(get_current_user),
):
    prefs = get_llm_preferences(current_user["user_id"], current_user.get("tenant_id"))
    health = await asyncio.to_thread(llm_gateway.probe_connectivity, None, force_refresh)
    gateway = _build_llm_gateway_payload(prefs, health)
    return {
        "preferences": prefs,
        "endpoint": {
            "active": bool(health.get("ok")),
            "analysis_ready": bool(health.get("ok")) and bool(prefs.get("is_enabled", True)),
            "status": health.get("status"),
            "model": health.get("model"),
            "url": health.get("active_url") or health.get("url"),
            "latency": health.get("latency"),
            "probe": health.get("probe"),
            "error": health.get("error"),
            "warning": health.get("warning"),
            "fallback_active": bool(health.get("fallback_active")),
        },
        "gateway": gateway,
    }


@app.patch("/api/llm/settings")
async def api_set_llm_settings(req: LLMSettingsRequest, current_user: dict = Depends(get_current_user)):
    prefs = set_llm_preferences(
        current_user["user_id"],
        current_user.get("tenant_id"),
        is_enabled=req.is_enabled,
        billing_enabled=req.billing_enabled,
    )
    health = await asyncio.to_thread(llm_gateway.probe_connectivity, None, True)
    return {
        "status": "success",
        "preferences": prefs,
        "gateway": _build_llm_gateway_payload(prefs, health),
    }


@app.get("/api/llm/usage-summary")
async def api_get_llm_usage_summary(current_user: dict = Depends(get_current_user)):
    return get_llm_usage_summary(current_user["user_id"], current_user["tenant_id"])

@app.post("/api/source/preload")
async def preload_source_data(
    request: PreloadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch reviews from an external source and persist them to the raw_reviews cache.
    Does NOT run analysis — just preloads data. Scoped by workspace_id if provided.
    Supports: trustpilot, playstore, appstore, surveymonkey, typeform, salesforce, crm, api, webhooks.
    """
    user_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]
    log_debug(f"Preloading {request.source_type} for {request.identifier} (workspace={request.workspace_id})")
    cfg = request.config or {}
    df = None

    try:
        # ── App Store ──────────────────────────────────────────────────────────────
        if request.source_type == 'appstore':
            from appstore_connector import fetch_appstore_reviews
            pages = max(1, request.max_reviews // 50)
            df = fetch_appstore_reviews(request.identifier, request.country, pages)

        # ── Play Store ─────────────────────────────────────────────────────────────
        elif request.source_type == 'playstore':
            from playstore_connector import fetch_raw_playstore_reviews
            df = fetch_raw_playstore_reviews(request.identifier, request.country, request.max_reviews)

        # ── Trustpilot ─────────────────────────────────────────────────────────────
        elif request.source_type == 'trustpilot':
            from trustpilot_connector import fetch_trustpilot_reviews
            fetch_res = fetch_trustpilot_reviews(request.identifier, cfg.get('api_key', ''), request.max_reviews)
            if fetch_res and 'raw_reviews_df' in fetch_res:
                df = fetch_res['raw_reviews_df']

        # ── SurveyMonkey ───────────────────────────────────────────────────────────
        elif request.source_type == 'surveymonkey':
            token = cfg.get('token') or cfg.get('auth_value', '')
            survey_id = request.identifier
            if not token:
                return {"status": "error", "message": "SurveyMonkey Access Token is required. Add it in the connector config."}
            try:
                import requests as _req
                headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                # Fetch survey details first
                details_url = f'https://api.surveymonkey.com/v3/surveys/{survey_id}/details'
                details_resp = _req.get(details_url, headers=headers, timeout=15)
                details_resp.raise_for_status()
                # Fetch responses
                resp_url = f'https://api.surveymonkey.com/v3/surveys/{survey_id}/responses/bulk?per_page=100'
                resp_r = _req.get(resp_url, headers=headers, timeout=20)
                resp_r.raise_for_status()
                resp_data = resp_r.json()
                records = []
                for resp in resp_data.get('data', []):
                    # Concatenate all text answers as the review content
                    parts = []
                    for page in resp.get('pages', []):
                        for q in page.get('questions', []):
                            for ans in q.get('answers', []):
                                if 'text' in ans and ans['text']:
                                    parts.append(str(ans['text']))
                    content = ' | '.join(parts)
                    if content:
                        records.append({
                            'content': content,
                            'score': 3,  # surveys rarely have numeric scores; default neutral
                            'at': resp.get('date_created', datetime.now().isoformat()),
                            'userName': 'Respondent'
                        })
                if records:
                    df = pd.DataFrame(records[:request.max_reviews])
            except Exception as e:
                log_debug(f"SurveyMonkey fetch error: {e}")
                return {"status": "error", "message": f"SurveyMonkey fetch failed: {str(e)}"}

        # ── Typeform ───────────────────────────────────────────────────────────────
        elif request.source_type == 'typeform':
            token = cfg.get('token') or cfg.get('auth_value', '')
            form_id = request.identifier
            if not token:
                return {"status": "error", "message": "Typeform Personal Access Token is required."}
            try:
                import requests as _req
                headers = {'Authorization': f'Bearer {token}'}
                url = f'https://api.typeform.com/forms/{form_id}/responses?page_size=200'
                r = _req.get(url, headers=headers, timeout=20)
                r.raise_for_status()
                data = r.json()
                records = []
                for item in data.get('items', []):
                    parts = []
                    for ans in item.get('answers', []):
                        ans_type = ans.get('type', '')
                        if ans_type == 'text':
                            parts.append(ans.get('text', ''))
                        elif ans_type == 'choice':
                            parts.append(ans.get('choice', {}).get('label', ''))
                        elif ans_type == 'number':
                            # Could be an NPS/rating — use as score
                            pass
                    content = ' | '.join(p for p in parts if p)
                    # Try to get a score from number answers
                    score = 3
                    for ans in item.get('answers', []):
                        if ans.get('type') == 'number':
                            try:
                                n = float(ans['number'])
                                if n > 10: score = max(1, min(5, round(n / 20)))
                                elif n > 5: score = max(1, min(5, round((n / 10) * 4 + 1)))
                                else: score = max(1, min(5, round(n)))
                                break
                            except: pass
                    if content:
                        records.append({
                            'content': content,
                            'score': score,
                            'at': item.get('submitted_at', datetime.now().isoformat()),
                            'userName': item.get('hidden', {}).get('name', 'Respondent')
                        })
                if records:
                    df = pd.DataFrame(records[:request.max_reviews])
            except Exception as e:
                log_debug(f"Typeform fetch error: {e}")
                return {"status": "error", "message": f"Typeform fetch failed: {str(e)}"}

        # ── Salesforce / CRM ───────────────────────────────────────────────────────
        elif request.source_type in ('salesforce', 'crm'):
            instance_url = cfg.get('instance_url', request.identifier)
            client_id = cfg.get('client_id', '')
            client_secret = cfg.get('client_secret', '')
            username = cfg.get('username', '')
            password = cfg.get('password', '')
            object_name = cfg.get('object_name', 'Case')  # Case, Contact, Survey, etc.
            content_field = cfg.get('content_field', 'Description')
            score_field = cfg.get('score_field', '')
            if not instance_url:
                return {"status": "error", "message": "Salesforce Instance URL is required."}
            try:
                import requests as _req
                # OAuth2 Username-Password flow
                token_url = f"{instance_url.rstrip('/')}/services/oauth2/token"
                token_resp = _req.post(token_url, data={
                    'grant_type': 'password',
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'username': username,
                    'password': password
                }, timeout=15)
                token_resp.raise_for_status()
                access_token = token_resp.json()['access_token']
                # SOQL query
                soql = f"SELECT Id, {content_field}{', ' + score_field if score_field else ''}, CreatedDate FROM {object_name} ORDER BY CreatedDate DESC LIMIT {request.max_reviews}"
                query_url = f"{instance_url.rstrip('/')}/services/data/v57.0/query"
                qresp = _req.get(query_url, headers={'Authorization': f'Bearer {access_token}'}, params={'q': soql}, timeout=20)
                qresp.raise_for_status()
                records_raw = qresp.json().get('records', [])
                records = []
                for rec in records_raw:
                    content = str(rec.get(content_field, '') or '')
                    score = 3
                    if score_field and rec.get(score_field):
                        try:
                            score_f = float(rec[score_field])
                            if score_f > 10: score = max(1, min(5, round(score_f / 20)))
                            elif score_f > 5: score = max(1, min(5, round((score_f / 10) * 4 + 1)))
                            else: score = max(1, min(5, round(score_f)))
                        except: pass
                    if content:
                        records.append({
                            'content': content,
                            'score': score,
                            'at': rec.get('CreatedDate', datetime.now().isoformat()),
                            'userName': 'Customer'
                        })
                if records:
                    df = pd.DataFrame(records)
            except Exception as e:
                log_debug(f"Salesforce fetch error: {e}")
                return {"status": "error", "message": f"Salesforce fetch failed: {str(e)}"}

        # ── Generic REST API / Webhooks ─────────────────────────────────────────────
        elif request.source_type in ('api', 'webhooks', 'generic_api'):
            from api_connector import fetch_generic_api_reviews
            url = cfg.get('url') or request.identifier
            source_cfg = {
                'count': request.max_reviews,
                'method': cfg.get('method', 'GET'),
                'auth_type': cfg.get('auth_type', 'none'),
                'auth_value': cfg.get('auth_value', '') or cfg.get('token', ''),
                'auth_header_name': cfg.get('auth_header_name', 'X-Api-Key'),
                'data_path': cfg.get('data_path', ''),
                'content_field': cfg.get('content_field', ''),
                'score_field': cfg.get('score_field', ''),
                'author_field': cfg.get('author_field', ''),
                'date_field': cfg.get('date_field', ''),
                'query_params': cfg.get('query_params', {}),
                'request_body': cfg.get('request_body', None),
                'extra_headers': cfg.get('extra_headers', {}),
            }
            source_dummy = {'identifier': url, 'config': source_cfg}
            reviews_list = fetch_generic_api_reviews(source_dummy)
            if reviews_list:
                # api_connector returns normalised dicts with 'content', 'score', 'reviewed_at', 'author'
                for r in reviews_list:
                    if 'reviewed_at' in r and 'at' not in r:
                        r['at'] = r.pop('reviewed_at')
                    if 'author' in r and 'userName' not in r:
                        r['userName'] = r.pop('author')
                df = pd.DataFrame(reviews_list)

        else:
            return {"status": "error", "message": f"Unknown source type: {request.source_type}"}

    except Exception as e:
        log_debug(f"Preload exception for {request.source_type}: {e}")
        return {"status": "error", "message": f"Fetch failed: {str(e)}"}

    # ── Standardize & persist ─────────────────────────────────────────────────────
    if df is not None and not df.empty:
        # Standardize field names
        if 'score' not in df.columns:
            for alt in ('rating', 'stars', 'satisfaction'):
                if alt in df.columns:
                    df['score'] = df[alt]
                    break
            else:
                df['score'] = 3

        if 'content' not in df.columns:
            for alt in ('text', 'body', 'review', 'message', 'feedback'):
                if alt in df.columns:
                    df['content'] = df[alt]
                    break

        if 'at' not in df.columns:
            for alt in ('date', 'reviewed_at', 'timestamp', 'created_at'):
                if alt in df.columns:
                    df['at'] = df[alt]
                    break
            else:
                df['at'] = datetime.now().isoformat()

        # Drop rows with no content
        df = df[df['content'].astype(str).str.strip().str.len() > 2]

        if df.empty:
            return {"status": "error", "message": "No valid review content found after filtering."}

        reviews_list_out = df.to_dict('records')
        added, skipped = save_raw_reviews(
            user_id, tenant_id, request.source_type, request.identifier,
            reviews_list_out, workspace_id=request.workspace_id
        )
        stats = get_raw_review_stats(
            user_id, tenant_id, request.source_type, request.identifier,
            workspace_id=request.workspace_id
        )
        log_debug(f"Preload finished for {request.source_type}:{request.identifier}. Added: {added}, Skipped: {skipped}")
        return {"status": "success", "added": added, "skipped": skipped, "stats": stats}

    return {"status": "error", "message": "No data found or fetch failed for this source."}

@app.get("/api/source/stats")
async def get_source_data_stats(
    source_type: str,
    identifier: str,
    workspace_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve current cache stats for a source, optionally scoped by workspace."""
    stats = get_raw_review_stats(
        current_user["user_id"],
        current_user["tenant_id"],
        source_type,
        identifier,
        workspace_id=workspace_id
    )
    return stats

@app.get("/api/source/reviews")
async def get_cached_source_reviews(
    source_type: str,
    identifier: str,
    limit: int = 100,
    workspace_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve standardized reviews from the local raw_reviews cache."""
    reviews = get_latest_raw_reviews(
        current_user["user_id"],
        current_user["tenant_id"],
        source_type,
        identifier,
        limit,
        workspace_id=workspace_id
    )
    if not reviews:
        return {"reviews": [], "count": 0}
    
    # Standardize for frontend list view requirement if needed, 
    # but run_analysis expects specific format. 
    # Let's use _df_to_review_list style formatting.
    df = pd.DataFrame(reviews)
    source_name = source_type.replace('_', ' ').title()
    result = _df_to_review_list(df, source_name)
    result["identifier"] = identifier
    return result

# --- Support Endpoints ---

@app.post("/api/support/contact")
async def contact_support(request: ContactRequest):
    """Placeholder endpoint for Help & Support messaging."""
    # In a real app, this would send an email or create a ticket via Zendesk/Jira API
    log_debug(f"Support Request from {request.name} ({request.email}): {request.subject} - {request.message[:50]}...")
    
    # Simulate processing time
    await asyncio.sleep(1.5)
    
    return {"status": "success", "message": "Your message has been received. Our support team will respond shortly."}

# --- Thread-safe task management for multi-user concurrency ---
_tasks_lock = threading.Lock()
analysis_tasks = {}
task_controls = {}  # { task_id: {'stop': Event, 'pause': Event} }
_user_active_tasks = {}  # { user_id: set(task_ids) } — tracks running analyses per user
_TASK_TTL_SECONDS = 1800  # 30 minutes — completed tasks auto-evicted after this
_TASK_LOG_MAX_ENTRIES = 500
_TASK_TERMINAL_STATES = {"completed", "failed", "cancelled"}
_TASK_ACTIVE_STATES = {
    "initializing",
    "fetching",
    "analyzing",
    "calculating",
    "finalizing",
    "paused",
    "stopping",
}


def _safe_progress_value(value: Any) -> int:
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        parsed = 0
    return max(0, min(100, parsed))


def _set_task(task_id: str, data: dict, append_log: Optional[str] = None):
    """
    Thread-safe task state update.
    Merges into existing state so partial updates do not erase progress fields/logs.
    """
    now = time.time()
    with _tasks_lock:
        current = analysis_tasks.get(task_id, {})
        merged = dict(current)
        if data:
            merged.update(data)

        merged["status"] = str(merged.get("status", "initializing") or "initializing")
        merged["progress"] = _safe_progress_value(merged.get("progress", 0))
        merged["message"] = str(merged.get("message", "") or "")
        merged["processed_reviews"] = int(merged.get("processed_reviews", 0) or 0)
        merged["total_reviews"] = int(merged.get("total_reviews", 0) or 0)
        merged["fetched_reviews"] = int(merged.get("fetched_reviews", merged["total_reviews"]) or 0)
        merged["analyzed_reviews"] = int(merged.get("analyzed_reviews", merged["processed_reviews"]) or 0)
        merged["fallback_reviews"] = int(merged.get("fallback_reviews", 0) or 0)
        merged["unresolved_reviews"] = int(merged.get("unresolved_reviews", 0) or 0)
        merged["dropped_reviews"] = int(merged.get("dropped_reviews", 0) or 0)
        merged["in_flight_reviews"] = max(
            0,
            int(
                merged.get(
                    "in_flight_reviews",
                    max(0, merged["total_reviews"] - merged["processed_reviews"]),
                ) or 0
            ),
        )
        try:
            merged["coverage_pct"] = round(float(merged.get("coverage_pct", 0.0) or 0.0), 2)
        except (TypeError, ValueError):
            merged["coverage_pct"] = 0.0

        log_entries = merged.get("log")
        if not isinstance(log_entries, list):
            log_entries = []
        if append_log:
            msg = str(append_log).strip()
            if msg and (not log_entries or log_entries[-1] != msg):
                log_entries.append(msg)
        if len(log_entries) > _TASK_LOG_MAX_ENTRIES:
            log_entries = log_entries[-_TASK_LOG_MAX_ENTRIES:]
        merged["log"] = log_entries

        merged["_updated_at"] = now
        if merged.get("status") in _TASK_TERMINAL_STATES and "_completed_at" not in merged:
            merged["_completed_at"] = now

        analysis_tasks[task_id] = merged
        return dict(merged)


def _get_task(task_id: str) -> dict:
    """Thread-safe task state read."""
    with _tasks_lock:
        task = analysis_tasks.get(task_id)
        return dict(task) if task else None

def _register_user_task(user_id: int, task_id: str):
    """Register a task as active for a user."""
    with _tasks_lock:
        if user_id not in _user_active_tasks:
            _user_active_tasks[user_id] = set()
        _user_active_tasks[user_id].add(task_id)

def _unregister_user_task(user_id: int, task_id: str):
    """Remove a task from a user's active set."""
    with _tasks_lock:
        if user_id in _user_active_tasks:
            _user_active_tasks[user_id].discard(task_id)
            if not _user_active_tasks[user_id]:
                del _user_active_tasks[user_id]

def _user_has_active_analysis(user_id: int) -> bool:
    """Check if a user already has a running analysis."""
    with _tasks_lock:
        active = _user_active_tasks.get(user_id, set())
        has_active = False
        stale = []
        for tid in list(active):
            task = analysis_tasks.get(tid)
            if task is None:
                stale.append(tid)
                continue
            if task.get("status") in _TASK_ACTIVE_STATES:
                has_active = True
                continue
            stale.append(tid)

        for tid in stale:
            active.discard(tid)
        if not active and user_id in _user_active_tasks:
            del _user_active_tasks[user_id]

        return has_active

def _cleanup_stale_tasks():
    """Background thread: evict completed/failed tasks older than TTL to prevent memory leaks."""
    while True:
        time.sleep(300)  # Run every 5 minutes
        now = time.time()
        with _tasks_lock:
            stale_ids = []
            for tid, task in analysis_tasks.items():
                if task.get('status') in ('completed', 'failed', 'cancelled'):
                    completed_at = task.get('_completed_at', now)
                    if now - completed_at > _TASK_TTL_SECONDS:
                        stale_ids.append(tid)
            for tid in stale_ids:
                del analysis_tasks[tid]
                task_controls.pop(tid, None)
            if stale_ids:
                print(f"[CLEANUP] Evicted {len(stale_ids)} stale tasks")

# ... (Helper functions remain same) ...

@app.post("/task/{task_id}/control")
async def control_task(task_id: str, action: str = Body(..., embed=True)):
    """
    Controls a running task. Actions: 'pause', 'resume', 'stop'.
    """
    with _tasks_lock:
        if task_id not in task_controls:
            # If not in controls, it might be completed or failed already
            task = analysis_tasks.get(task_id)
            if task:
                return {"status": "ignored", "message": f"Task is {task.get('status')}"}
            raise HTTPException(status_code=404, detail="Task not found")
        
        controls = task_controls[task_id]
    
    if action == "stop":
        controls['stop'].set()
        # Wake up if paused so it can stop
        if controls['pause'].is_set():
            controls['pause'].clear()
            
        if _get_task(task_id):
            _set_task(
                task_id,
                {
                    "status": "stopping",
                    "message": "Stopping analysis...",
                },
                append_log="Stopping analysis...",
            )
            
    elif action == "pause":
        controls['pause'].set()
        if _get_task(task_id):
            _set_task(task_id, {"status": "paused", "message": "Analysis paused"}, append_log="Analysis paused")
             
    elif action == "resume":
        controls['pause'].clear()
        if _get_task(task_id):
            _set_task(task_id, {"status": "analyzing", "message": "Analysis resumed"}, append_log="Analysis resumed")
             
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    return {"status": "success", "action": action}

# ... (Other endpoints) ...

async def run_processing_background(task_id: str, request: ProcessRequest):
    # Create control events
    stop_event = threading.Event()
    pause_event = threading.Event()
    
    with _tasks_lock:
        task_controls[task_id] = {'stop': stop_event, 'pause': pause_event}
    
    try:
        fetched_reviews = len(request.reviews or [])
        log_debug(f"Starting task {task_id}")
        _set_task(
            task_id,
            {
                "status": "initializing",
                "progress": 5,
                "message": "Initializing analysis engine...",
                "processed_reviews": 0,
                "total_reviews": fetched_reviews,
                "fetched_reviews": fetched_reviews,
                "analyzed_reviews": 0,
                "fallback_reviews": 0,
                "unresolved_reviews": 0,
                "dropped_reviews": 0,
                "in_flight_reviews": 0,
                "coverage_pct": 0.0,
            },
            append_log="Initializing analysis engine...",
        )

        # Check stop early
        if stop_event.is_set():
            _set_task(
                task_id,
                {
                    "status": "cancelled",
                    "message": "Analysis stopped by user",
                    "_completed_at": time.time(),
                },
                append_log="Analysis cancelled before processing started.",
            )
            return

        # If NPS mode is on, transform 0-10 scores into 1-5 before analysis so the standard engine handles sentiment correctly
        if request.nps_mode:
            log_debug("NPS Mode ON: Mapping 0-10 scores to 1-5 scale...")
            for r in request.reviews:
                score_val = r.get("score", r.get("rating", r.get("nps", 3)))
                try:
                    val = float(score_val)
                    if val >= 9:
                        r["score"] = 5
                    elif val >= 7:
                        r["score"] = 3
                    elif val >= 4:
                        r["score"] = 2
                    else:
                        r["score"] = 1
                except (ValueError, TypeError):
                    r["score"] = 3

        # Clean the reviews first
        log_debug(f"Cleaning {len(request.reviews)} reviews...")
        cleaned_reviews = []
        total_reviews = len(request.reviews)
        for i, r in enumerate(request.reviews):
            # Update progress every 10%
            if total_reviews > 50 and i % max(1, total_reviews // 10) == 0:
                pct = 5 + int((i / total_reviews) * 10)  # 5% to 15%
                cleaning_msg = f"Cleaning review {i}/{total_reviews}..."
                _set_task(
                    task_id,
                    {
                        "status": "initializing",
                        "progress": pct,
                        "message": cleaning_msg,
                        "processed_reviews": i,
                        "total_reviews": total_reviews,
                        "fetched_reviews": fetched_reviews,
                        "in_flight_reviews": 0,
                    },
                    append_log=cleaning_msg,
                )

            if stop_event.is_set():
                break

            # Normalize: support 'content', 'text', 'body', or 'review' field names
            raw_text = r.get("content") or r.get("text") or r.get("body") or r.get("review", "")
            cleaned = processor.clean_review_text(raw_text)
            if len(cleaned.strip()) < processor.MIN_REVIEW_CHAR_LENGTH:
                cleaned = str(raw_text or "").strip()[:processor.MAX_PROMPT_REVIEW_CHARS] or "No text provided"
            score = r.get("score", r.get("rating", 3))
            cleaned_reviews.append({**r, "content": cleaned, "score": score})

        log_debug(f"Cleaning complete. Prepared {len(cleaned_reviews)} reviews for analysis.")

        if stop_event.is_set():
            _set_task(
                task_id,
                {
                    "status": "cancelled",
                    "message": "Analysis stopped by user",
                    "_completed_at": time.time(),
                },
                append_log="Analysis cancelled during cleaning.",
            )
            return

        if not cleaned_reviews:
            _set_task(
                task_id,
                {
                    "status": "failed",
                    "message": "No valid reviews after cleaning",
                    "_completed_at": time.time(),
                },
                append_log="No valid reviews available after cleaning.",
            )
            return

        analyzing_msg = "Cleaning and vectorizing review data..."
        _set_task(
            task_id,
            {
                "status": "analyzing",
                "progress": 15,
                "message": analyzing_msg,
                "processed_reviews": 0,
                "total_reviews": len(cleaned_reviews),
                "fetched_reviews": fetched_reviews,
                "in_flight_reviews": 0,
            },
            append_log=analyzing_msg,
        )

        # Progress callback for granular updates
        def progress_cb(pct, msg, meta=None):
            if stop_event.is_set():
                return

            status = "paused" if pause_event.is_set() else "analyzing"
            patch = {
                "status": status,
                "progress": min(_safe_progress_value(pct), 85),
                "message": msg,
            }
            if meta:
                patch["total_tokens"] = int(meta.get("tokens", 0) or 0)
                patch["failed_reviews"] = meta.get("failed_reviews", [])
                patch["processed_reviews"] = int(meta.get("processed_reviews", 0) or 0)
                patch["total_reviews"] = int(meta.get("total_reviews", len(cleaned_reviews)) or len(cleaned_reviews))
                patch["fetched_reviews"] = int(meta.get("fetched_reviews", fetched_reviews) or fetched_reviews)
                patch["analyzed_reviews"] = int(meta.get("analyzed_reviews", patch["processed_reviews"]) or patch["processed_reviews"])
                patch["fallback_reviews"] = int(meta.get("fallback_reviews", 0) or 0)
                patch["unresolved_reviews"] = int(meta.get("unresolved_reviews", 0) or 0)
                patch["dropped_reviews"] = int(meta.get("dropped_reviews", 0) or 0)
                patch["in_flight_reviews"] = int(
                    meta.get(
                        "in_flight_reviews",
                        max(0, patch["total_reviews"] - patch["processed_reviews"]),
                    ) or 0
                )
                patch["coverage_pct"] = round(float(meta.get("coverage_pct", 0.0) or 0.0), 2)
                if meta.get("analysis_summary"):
                    patch["analysis_summary"] = meta["analysis_summary"]
                patch["context_refreshes"] = int(meta.get("context_refreshes", 0) or 0)
                patch["context_window_budget_tokens"] = int(meta.get("context_window_budget_tokens", 0) or 0)
                patch["context_checkpoint"] = meta.get("context_checkpoint")
            _set_task(task_id, patch, append_log=msg)

        llm_health = await asyncio.to_thread(processor.check_llm_connectivity)
        if not llm_health.get("ok"):
            warn_msg = (
                "LLM tunnel health probe is unstable. Continuing with analysis; "
                "automatic standby handling will cover any review that fails."
            )
            _set_task(
                task_id,
                {
                    "status": "analyzing",
                    "progress": 15,
                    "message": warn_msg,
                    "processed_reviews": 0,
                    "total_reviews": len(cleaned_reviews),
                    "fetched_reviews": fetched_reviews,
                    "in_flight_reviews": len(cleaned_reviews),
                },
                append_log=f"{warn_msg} Probe error: {llm_health.get('error', 'unknown')}",
            )

        # Run batch analysis with custom instructions and progress (OFFLOADED TO THREAD to prevent blocking FastAPI event loop)
        results = await asyncio.to_thread(
            processor.run_analysis_batch,
            cleaned_reviews,
            request.vertical,
            request.custom_instructions,
            progress_cb,
            stop_event,
            pause_event,
            "bulk_survey" if request.nps_mode else "workspace",
        )

        if not results:
            fallback_msg = (
                "Live AI analysis returned no results. Switching to standby analysis..."
            )
            _set_task(
                task_id,
                {
                    "status": "analyzing",
                    "progress": 20,
                    "message": fallback_msg,
                    "processed_reviews": 0,
                    "total_reviews": len(cleaned_reviews),
                    "fetched_reviews": fetched_reviews,
                    "in_flight_reviews": len(cleaned_reviews),
                },
                append_log=fallback_msg,
            )
            results = await asyncio.to_thread(
                processor.run_fallback_analysis_batch,
                cleaned_reviews,
                progress_cb,
                "analysis_empty_fallback",
            )

        if stop_event.is_set():
            # Filter out None results (not yet processed)
            results = [r for r in results if r is not None]
            if not results:
                _set_task(
                    task_id,
                    {
                        "status": "cancelled",
                        "message": "Analysis stopped by user with zero results",
                        "_completed_at": time.time(),
                    },
                    append_log="Analysis stopped with zero processed results.",
                )
                return
            log_debug(f"Task {task_id} stopped by user. Finalizing with {len(results)} partial results.")

        if not results:
            _set_task(
                task_id,
                {
                    "status": "failed",
                    "message": "LLM analysis returned no results",
                    "_completed_at": time.time(),
                },
                append_log="LLM analysis returned no results.",
            )
            return

        fetched_reviews = len(request.reviews)
        analyzed_reviews = len(results)
        fallback_reviews = sum(1 for r in results if r.get("_meta_fallback"))
        unresolved_reviews = sum(1 for r in results if r.get("_meta_error"))
        dropped_reviews = max(0, fetched_reviews - analyzed_reviews)
        coverage_pct = round((analyzed_reviews / max(fetched_reviews, 1)) * 100, 2)
        summary_msg = (
            f"Analysis summary: fetched={fetched_reviews}, analyzed={analyzed_reviews}, "
            f"fallback={fallback_reviews}, unresolved={unresolved_reviews}, "
            f"dropped={dropped_reviews}, coverage={coverage_pct}%"
        )
        analysis_counts = {
            "fetched": fetched_reviews,
            "analyzed": analyzed_reviews,
            "fallback": fallback_reviews,
            "unresolved": unresolved_reviews,
            "dropped": dropped_reviews,
            "coverage_pct": coverage_pct,
            "summary": summary_msg,
        }
        log_debug(f"[TASK {task_id}] {summary_msg}")

        _set_task(
            task_id,
            {
                "status": "calculating",
                "progress": 88,
                "message": "Calculating revenue impact and churn risk...",
                "processed_reviews": analyzed_reviews,
                "total_reviews": len(cleaned_reviews),
                "fetched_reviews": fetched_reviews,
                "analyzed_reviews": analyzed_reviews,
                "fallback_reviews": fallback_reviews,
                "unresolved_reviews": unresolved_reviews,
                "dropped_reviews": dropped_reviews,
                "coverage_pct": coverage_pct,
                "analysis_summary": summary_msg,
                "analysis_counts": analysis_counts,
            },
            append_log=summary_msg,
        )

        analysis_df = pd.DataFrame(results)

        _set_task(
            task_id,
            {
                "status": "finalizing",
                "progress": 92,
                "message": "Generating strategic recommendations...",
                "processed_reviews": analyzed_reviews,
                "total_reviews": len(cleaned_reviews),
            },
        )

        # Comprehensive Analytics (OFFLOADED TO THREAD)
        analytics = await asyncio.to_thread(
            processor.get_comprehensive_analytics,
            analysis_df,
            request.arpu,
            request.vertical,
            request.audience,
        )
        if not isinstance(analytics, dict):
            analytics = {}
        analytics["analysisCounts"] = analysis_counts
        analytics["analysisSummary"] = summary_msg

        # --- DEFINE INSIGHTS SYNTHESIS LAYER ---
        # If we have vague labels (Other, UX, etc.), use LLM to synthesize definitive ones
        try:
            from synthesis_module import batch_synthesize_labels

            # processor.get_comprehensive_analytics returns data in 'thematic' key
            if "thematic" in analytics:
                analytics["thematic"] = batch_synthesize_labels(analytics["thematic"], results, request.vertical)
        except Exception as e:
            log_debug(f"Synthesis Layer failed in fresh analysis: {e}")
            print(f"[ERROR] Synthesis Layer failed: {e}")

        # Save to database
        config = {
            "vertical": request.vertical,
            "arpu": request.arpu,
            "renewal_cycle": request.renewal_cycle,
            "custom_instructions": request.custom_instructions,
            "audience": request.audience,
        }

        results_data = {"reviews": results, "analytics": analytics}

        analysis_id = save_analysis(
            user_id=getattr(request, "user_id", 1),  # Fallback if needed, but should be set
            tenant_id=getattr(request, "tenant_id", None),
            vertical=request.vertical,
            source_type="manual_batch",
            total_reviews=len(analysis_df),
            config=config,
            results=results_data,
        )

        usage_tokens = int(sum(int(r.get("_meta_tokens", 0) or 0) for r in results) or 0)
        usage_prefs = get_llm_preferences(getattr(request, "user_id", 1), getattr(request, "tenant_id", None))
        track_analysis_usage(
            user_id=getattr(request, "user_id", 1),
            tenant_id=getattr(request, "tenant_id", None),
            analysis_id=analysis_id,
            reviews_count=len(analysis_df),
            cost=_estimate_llm_cost(usage_tokens, bool(usage_prefs.get("billing_enabled", True))),
            vertical=request.vertical,
            total_tokens=usage_tokens,
            billable_tokens=usage_tokens if bool(usage_prefs.get("billing_enabled", True)) else 0,
            llm_enabled_snapshot=True,
        )

        _set_task(
            task_id,
            {
                "status": "completed",
                "progress": 100,
                "message": summary_msg,
                "id": analysis_id,
                "analytics": analytics,
                "reviews": results,
                "processed_reviews": analyzed_reviews,
                "total_reviews": len(cleaned_reviews),
                "fetched_reviews": fetched_reviews,
                "analyzed_reviews": analyzed_reviews,
                "fallback_reviews": fallback_reviews,
                "unresolved_reviews": unresolved_reviews,
                "dropped_reviews": dropped_reviews,
                "coverage_pct": coverage_pct,
                "analysis_summary": summary_msg,
                "analysis_counts": analysis_counts,
                "_completed_at": time.time(),
            },
            append_log=summary_msg,
        )

    except Exception as e:
        print(f"Background processing error: {e}")
        _set_task(
            task_id,
            {"status": "failed", "message": str(e), "_completed_at": time.time()},
            append_log=f"Background processing error: {e}",
        )
    finally:
        # Ensure active-task lock is always released for this user.
        _unregister_user_task(getattr(request, 'user_id', 1), task_id)
        # Cleanup
        with _tasks_lock:
            task_controls.pop(task_id, None)
def _df_to_review_list(df: pd.DataFrame, source_name: str) -> Dict[str, Any]:
    """Converts a fetched DataFrame to a standardized response with metadata."""
    if df is None or df.empty:
        return None
    
    # Ensure standard columns
    if 'score' not in df.columns and 'rating' in df.columns:
        df['score'] = df['rating']
    if 'content' not in df.columns and 'text' in df.columns:
        df['content'] = df['text']
    
    # Convert dates to strings
    if 'at' in df.columns:
        df['at'] = pd.to_datetime(df['at'], errors='coerce').dt.strftime('%Y-%m-%d')
    
    # Build reviews list
    reviews = []
    for _, row in df.iterrows():
        # Safely clamp score to 1-5; default to 3 on any conversion error
        try:
            raw_score = row.get('score', 3)
            score_val = max(1, min(5, round(float(raw_score)))) if raw_score is not None and str(raw_score).strip() not in ('', 'nan', 'None') else 3
        except (ValueError, TypeError):
            score_val = 3
        review = {
            "id": f"REV-{uuid.uuid4().hex[:6].upper()}",
            "content": str(row.get('content', '')),
            "score": score_val,
            "date": str(row.get('at', datetime.now().strftime('%Y-%m-%d'))),
            "source": source_name,
        }
        if row.get('userName'):
            review["author"] = str(row['userName'])
        reviews.append(review)
    
    # Calculate metadata
    ratings = [r['score'] for r in reviews if r['score'] > 0]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
    dates = [r['date'] for r in reviews if r['date'] != 'NaT']
    date_range = f"{min(dates)} to {max(dates)}" if dates else "N/A"
    
    # Data quality stats
    empty_reviews = sum(1 for r in reviews if not r['content'].strip() or len(r['content'].strip()) < 3)
    
    return {
        "source": source_name,
        "count": len(reviews),
        "reviews": reviews,
        "metadata": {
            "avg_rating": avg_rating,
            "date_range": date_range,
            "empty_reviews": empty_reviews,
            "quality_score": round((1 - empty_reviews / max(len(reviews), 1)) * 100, 1)
        }
    }

async def run_analysis_background(task_id: str, request: AnalysisRequest):
    try:
        _set_task(
            task_id,
            {
                "status": "fetching",
                "progress": 10,
                "message": "Connecting to data source...",
                "processed_reviews": 0,
                "total_reviews": 0,
                "fetched_reviews": 0,
                "analyzed_reviews": 0,
                "fallback_reviews": 0,
                "unresolved_reviews": 0,
                "dropped_reviews": 0,
                "in_flight_reviews": 0,
                "coverage_pct": 0.0,
            },
            append_log="Connecting to data source...",
        )
        
        df = None
        if request.source_type == 'trustpilot':
            fetch_res = fetch_trustpilot_reviews(request.identifier, "", request.max_reviews)
            if fetch_res and 'raw_reviews_df' in fetch_res:
                df = fetch_res['raw_reviews_df']
        elif request.source_type == 'playstore':
            df = fetch_raw_playstore_reviews(request.identifier, request.country, request.max_reviews)
        elif request.source_type == 'appstore':
            pages = max(1, request.max_reviews // 50)
            df = fetch_appstore_reviews(request.identifier, request.country, pages)

        if df is None or df.empty:
            _set_task(
                task_id,
                {"status": "failed", "message": "No reviews found or fetch failed", "_completed_at": time.time()},
                append_log="No reviews found or fetch failed.",
            )
            return

        _set_task(
            task_id,
            {
                "status": "analyzing",
                "progress": 20,
                "message": "Cleaning and vectorizing data...",
                "in_flight_reviews": 0,
            },
            append_log="Cleaning and vectorizing data...",
        )
        
        # Standardize for analysis
        if 'score' not in df.columns and 'rating' in df.columns:
            df['score'] = df['rating']
        if 'content' not in df.columns and 'text' in df.columns:
            df['content'] = df['text']
            
        # Guarantee columns exist to avoid KeyError: 'content'
        if 'score' not in df.columns: df['score'] = 3
        if 'content' not in df.columns: df['content'] = ""
            
        reviews_list = df[['score', 'content']].to_dict('records')
        fetched_reviews = len(reviews_list)
        _set_task(task_id, {"fetched_reviews": fetched_reviews, "total_reviews": fetched_reviews})
        
        # Progress callback for granular updates
        def progress_cb(pct, msg, meta=None):
            patch = {
                "status": "analyzing",
                "progress": min(_safe_progress_value(pct), 85),
                "message": msg,
            }
            if meta:
                patch["total_tokens"] = int(meta.get("tokens", 0) or 0)
                patch["processed_reviews"] = int(meta.get("processed_reviews", 0) or 0)
                patch["total_reviews"] = int(meta.get("total_reviews", len(reviews_list)) or len(reviews_list))
                patch["fetched_reviews"] = int(meta.get("fetched_reviews", fetched_reviews) or fetched_reviews)
                patch["analyzed_reviews"] = int(meta.get("analyzed_reviews", patch["processed_reviews"]) or patch["processed_reviews"])
                patch["fallback_reviews"] = int(meta.get("fallback_reviews", 0) or 0)
                patch["unresolved_reviews"] = int(meta.get("unresolved_reviews", 0) or 0)
                patch["dropped_reviews"] = int(meta.get("dropped_reviews", 0) or 0)
                patch["in_flight_reviews"] = int(
                    meta.get(
                        "in_flight_reviews",
                        max(0, patch["total_reviews"] - patch["processed_reviews"]),
                    ) or 0
                )
                patch["coverage_pct"] = round(float(meta.get("coverage_pct", 0.0) or 0.0), 2)
                if meta.get("analysis_summary"):
                    patch["analysis_summary"] = meta["analysis_summary"]
                patch["context_refreshes"] = int(meta.get("context_refreshes", 0) or 0)
                patch["context_window_budget_tokens"] = int(meta.get("context_window_budget_tokens", 0) or 0)
                patch["context_checkpoint"] = meta.get("context_checkpoint")
            _set_task(task_id, patch, append_log=msg)

        llm_health = await asyncio.to_thread(processor.check_llm_connectivity)
        if not llm_health.get("ok"):
            warn_msg = (
                "LLM tunnel health probe is unstable. Continuing with analysis; "
                "automatic standby handling will cover any review that fails."
            )
            _set_task(
                task_id,
                {
                    "status": "analyzing",
                    "progress": 20,
                    "message": warn_msg,
                    "processed_reviews": 0,
                    "total_reviews": len(reviews_list),
                    "fetched_reviews": fetched_reviews,
                    "in_flight_reviews": len(reviews_list),
                },
                append_log=f"{warn_msg} Probe error: {llm_health.get('error', 'unknown')}",
            )

        # Run batch analysis with progress (OFFLOADED TO THREAD)
        results = await asyncio.to_thread(
            processor.run_analysis_batch,
            reviews_list,
            request.vertical,
            getattr(request, "custom_instructions", None),
            progress_cb,
            None,
            None,
            "workspace",
        )

        if not results:
            fallback_msg = (
                "Live AI analysis returned no results. Switching to standby analysis..."
            )
            _set_task(
                task_id,
                {
                    "status": "analyzing",
                    "progress": 25,
                    "message": fallback_msg,
                    "processed_reviews": 0,
                    "total_reviews": len(reviews_list),
                    "fetched_reviews": fetched_reviews,
                    "in_flight_reviews": len(reviews_list),
                },
                append_log=fallback_msg,
            )
            results = await asyncio.to_thread(
                processor.run_fallback_analysis_batch,
                reviews_list,
                progress_cb,
                "analysis_empty_fallback",
            )
        
        if not results:
            _set_task(task_id, {"status": "failed", "message": "LLM analysis failed", "_completed_at": time.time()})
            return

        fetched_reviews = len(reviews_list)
        analyzed_reviews = len(results)
        fallback_reviews = sum(1 for r in results if r.get("_meta_fallback"))
        unresolved_reviews = sum(1 for r in results if r.get("_meta_error"))
        dropped_reviews = max(0, fetched_reviews - analyzed_reviews)
        coverage_pct = round((analyzed_reviews / max(fetched_reviews, 1)) * 100, 2)
        summary_msg = (
            f"Analysis summary: fetched={fetched_reviews}, analyzed={analyzed_reviews}, "
            f"fallback={fallback_reviews}, unresolved={unresolved_reviews}, "
            f"dropped={dropped_reviews}, coverage={coverage_pct}%"
        )
        analysis_counts = {
            "fetched": fetched_reviews,
            "analyzed": analyzed_reviews,
            "fallback": fallback_reviews,
            "unresolved": unresolved_reviews,
            "dropped": dropped_reviews,
            "coverage_pct": coverage_pct,
            "summary": summary_msg,
        }
        log_debug(f"[TASK {task_id}] {summary_msg}")

        _set_task(
            task_id,
            {
                "status": "calculating",
                "progress": 85,
                "message": "Calculating revenue impact and metrics...",
                "processed_reviews": analyzed_reviews,
                "total_reviews": len(reviews_list),
                "fetched_reviews": fetched_reviews,
                "analyzed_reviews": analyzed_reviews,
                "fallback_reviews": fallback_reviews,
                "unresolved_reviews": unresolved_reviews,
                "dropped_reviews": dropped_reviews,
                "coverage_pct": coverage_pct,
                "analysis_summary": summary_msg,
                "analysis_counts": analysis_counts,
            },
            append_log=summary_msg,
        )

        analysis_df = pd.DataFrame(results)
        # Metadata is now preserved by processor.py
        
        # Calculate Comprehensive Analytics (OFFLOADED TO THREAD)
        analytics = await asyncio.to_thread(
            processor.get_comprehensive_analytics,
            analysis_df, request.arpu, request.vertical, getattr(request, "audience", None)
        )
        if not isinstance(analytics, dict):
            analytics = {}
        analytics["analysisCounts"] = analysis_counts
        analytics["analysisSummary"] = summary_msg
        
        # Save to database
        config = {
            "source": request.source_type,
            "identifier": request.identifier,
            "vertical": request.vertical,
            "arpu": request.arpu,
            "renewal_cycle": request.renewal_cycle
        }
        
        results_data = {
            "reviews": results,
            "analytics": analytics
        }
        
        analysis_id = save_analysis(
            user_id=getattr(request, 'user_id', 1),
            tenant_id=getattr(request, 'tenant_id', None),
            vertical=request.vertical,
            source_type=request.source_type,
            total_reviews=len(analysis_df),
            config=config,
            results=results_data
        )

        _set_task(task_id, {
            "status": "completed", 
            "progress": 100, 
            "message": summary_msg,
            "id": analysis_id,
            "analytics": analytics,
            "reviews": results,
            "processed_reviews": analyzed_reviews,
            "total_reviews": len(reviews_list),
            "fetched_reviews": fetched_reviews,
            "analyzed_reviews": analyzed_reviews,
            "fallback_reviews": fallback_reviews,
            "unresolved_reviews": unresolved_reviews,
            "dropped_reviews": dropped_reviews,
            "coverage_pct": coverage_pct,
            "analysis_summary": summary_msg,
            "analysis_counts": analysis_counts,
            "_completed_at": time.time()
        }, append_log=summary_msg)
        
    except Exception as e:
        print(f"Background analysis error: {e}")
        _set_task(task_id, {"status": "failed", "message": str(e), "_completed_at": time.time()})
    finally:
        # Cleanup controls but keep task status for frontend polling
        with _tasks_lock:
            task_controls.pop(task_id, None)
        
        # Unregister from active user tasks so they can start another one
        _unregister_user_task(getattr(request, 'user_id', 1), task_id)

# --- Endpoints ---

@app.post("/fetch")
async def fetch_reviews_only(request: AnalysisRequest):
    """Fetches reviews and returns them with rich metadata for the configuration step."""
    try:
        df = None
        source_name = request.source_type.replace('_', ' ').title()
        
        # Run blocking connector calls in a thread pool to avoid blocking the event loop
        if request.source_type == 'trustpilot':
            def _do_trustpilot():
                res = fetch_trustpilot_reviews(request.identifier, "", request.max_reviews)
                return res['raw_reviews_df'] if res and 'raw_reviews_df' in res else None
            df = await asyncio.to_thread(_do_trustpilot)
            source_name = "Trustpilot"
        elif request.source_type == 'playstore':
            df = await asyncio.to_thread(
                fetch_raw_playstore_reviews, request.identifier, request.country, request.max_reviews
            )
            source_name = "Google Play"
        elif request.source_type == 'appstore':
            pages = max(1, request.max_reviews // 50)
            df = await asyncio.to_thread(
                fetch_appstore_reviews, request.identifier, request.country, pages
            )
            source_name = "App Store"

        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="No reviews found. Please check the identifier and try again.")

        result = _df_to_review_list(df, source_name)
        if not result:
            raise HTTPException(status_code=404, detail="No reviews found")
        
        result["identifier"] = request.identifier
        result["tenant_id"] = getattr(request, 'tenant_id', None)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sample-data")
async def get_sample_data():
    """Loads a pre-computed demo dataset to onboard new users instantly."""
    try:
        sample_path = os.path.join(os.path.dirname(__file__), 'data', 'demo_saas_reviews.json')
        with open(sample_path, 'r') as f:
            reviews = json.load(f)
            
        ratings = [r['score'] for r in reviews if 'score' in r]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
        dates = [r['date'] for r in reviews if 'date' in r]
        date_range = f"{min(dates)} to {max(dates)}" if dates else "N/A"
        
        return {
            "source": "Demo Workspace",
            "count": len(reviews),
            "reviews": reviews,
            "metadata": {
                "avg_rating": avg_rating,
                "date_range": date_range,
                "empty_reviews": 0,
                "quality_score": 98.5
            },
            "identifier": "demo.saas.app"
        }
    except Exception as e:
        print(f"Sample data error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load sample dataset.")

@app.post("/clean")
async def clean_reviews(request: CleanRequest):
    """Cleans review text and returns cleaned data with stats."""
    try:
        original_count = len(request.reviews)
        cleaned_reviews = []
        removed_count = 0
        
        for review in request.reviews:
            cleaned_text = processor.clean_review_text(review.get('content', ''))
            if len(cleaned_text.strip()) >= processor.MIN_REVIEW_CHAR_LENGTH:
                cleaned_review = {**review, "content": cleaned_text}
                cleaned_reviews.append(cleaned_review)
            else:
                removed_count += 1
        
        return {
            "reviews": cleaned_reviews,
            "stats": {
                "original_count": original_count,
                "cleaned_count": len(cleaned_reviews),
                "removed_count": removed_count,
                "removal_rate": round(removed_count / max(original_count, 1) * 100, 1)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import FileResponse
from pdf_generator import generate_brand_analysis_pdf
import tempfile
import json

# --- PDF Generation Endpoint ---
class ReportRequest(BaseModel):
    analysis_data: Dict[str, Any]
    vertical: str
    summary_note: Optional[str] = None

@app.post("/generate-report")
async def generate_report(request: ReportRequest):
    try:
        # Convert analysis data to DataFrame for the generator
        # The generator expects 'analysis_df' and 'results'
        # We need to reconstruction or pass the data appropriately.
        # Assuming request.analysis_data contains 'reviews' list and 'results' dict
        
        # NOTE: The frontend might send the whole "results" object which contains "reviews" or we might need to fetch from DB.
        # For simplicity, let's assume the frontend sends the critical data or we fetch by ID.
        # BETTER APPROACH: Pass task_id or use the data sent.
        
        # Let's try to handle both. If 'reviews' are in data, use them.
        reviews_data = request.analysis_data.get('reviews', [])
        if not reviews_data:
             # If no reviews provided, this might be a pure summary report or we need to fetch.
             # For now, let's assume we need reviews.
             df = pd.DataFrame()
        else:
             df = pd.DataFrame(reviews_data)
        
        # The generator expects 'results' dict with keys like 'nps_score', etc.
        results = request.analysis_data.get('results', request.analysis_data) # Fallback handling

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            temp_path = tmp_file.name
            
        generate_brand_analysis_pdf(
            analysis_df=df,
            results=results,
            vertical=request.vertical,
            output_path=temp_path,
            summary_note=request.summary_note
        )
        
        return FileResponse(
            temp_path, 
            media_type='application/pdf', 
            filename=f"Horizon_Report_{request.vertical}_{datetime.now().strftime('%Y%m%d')}.pdf",
            background=None # In a real app we'd want to delete this after sending
        )
    except Exception as e:
        print(f"PDF Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-csv")
async def download_csv(request: CleanRequest):
    """Returns review data as a downloadable CSV file."""
    try:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=['id', 'date', 'source', 'score', 'content'])
        writer.writeheader()
        
        for review in request.reviews:
            writer.writerow({
                'id': review.get('id', ''),
                'date': review.get('date', ''),
                'source': review.get('source', ''),
                'score': review.get('score', ''),
                'content': review.get('content', ''),
            })
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reviews_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    content_col: Optional[str] = Form(None),
    score_col: Optional[str] = Form(None),
    date_col: Optional[str] = Form(None),
    author_col: Optional[str] = Form(None)
):
    """Accepts a CSV or Excel file and returns standardized review list with column mapping support."""
    try:
        contents = await file.read()
        filename_lower = (file.filename or '').lower()

        # ── Parse: Excel vs CSV ──
        df = None
        if filename_lower.endswith(('.xlsx', '.xls')):
            try:
                df = pd.read_excel(io.BytesIO(contents), engine='openpyxl' if filename_lower.endswith('.xlsx') else 'xlrd')
            except Exception as xe:
                raise HTTPException(status_code=400, detail=f"Could not read Excel file: {str(xe)}")
        else:
            # Try multiple encodings for CSV
            text = None
            for enc in ('utf-8-sig', 'utf-8', 'cp1252', 'latin-1'):
                try:
                    text = contents.decode(enc)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            if text is None:
                raise HTTPException(status_code=400, detail="Cannot decode file. Please save as UTF-8 CSV.")

            # Auto-detect delimiter
            first_line = text.split('\n')[0]
            delimiter = ';' if first_line.count(';') > first_line.count(',') else ','
            try:
                df = pd.read_csv(io.StringIO(text), delimiter=delimiter, on_bad_lines='skip')
            except Exception:
                df = pd.read_csv(io.StringIO(text), delimiter=delimiter, error_bad_lines=False)

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="File is empty or could not be parsed.")

        # Strip whitespace from column names
        df.columns = [str(c).strip() for c in df.columns]

        col_map = {}

        # Manual mapping (if content_col provided and valid)
        if content_col and content_col in df.columns:
            col_map['content'] = content_col
            if score_col  and score_col  in df.columns: col_map['score']  = score_col
            if date_col   and date_col   in df.columns: col_map['date']   = date_col
            if author_col and author_col in df.columns: col_map['author'] = author_col
        else:
            # Auto-detect
            for col in df.columns:
                col_lower = col.lower().strip()
                if 'content' not in col_map and any(k in col_lower for k in ['review', 'feedback', 'comment', 'text', 'body', 'message', 'content']):
                    col_map['content'] = col
                elif 'score' not in col_map and any(k in col_lower for k in ['score', 'rating', 'stars']):
                    col_map['score'] = col
                elif 'date' not in col_map and any(k in col_lower for k in ['date', 'timestamp', 'created', 'submitted', 'posted', 'at']):
                    col_map['date'] = col
                elif 'author' not in col_map and any(k in col_lower for k in ['author', 'user', 'reviewer', 'name']):
                    col_map['author'] = col

        if 'content' not in col_map:
            # Return structured 400 with available columns so frontend can surface them
            return JSONResponse(
                status_code=400,
                content={
                    "error_code": "MISSING_COLUMNS",
                    "message": "Could not detect a text/feedback column. Please choose it manually.",
                    "available_columns": list(df.columns)
                }
            )

        # Apply column rename
        rename_map = {}
        if 'score'   in col_map: rename_map[col_map['score']]   = 'score'
        if 'content' in col_map: rename_map[col_map['content']] = 'content'
        if 'date'    in col_map: rename_map[col_map['date']]    = 'at'
        if 'author'  in col_map: rename_map[col_map['author']]  = 'userName'
        df = df.rename(columns=rename_map)

        # Defaults for missing columns
        if 'score'    not in df.columns: df['score']    = 3
        if 'at'       not in df.columns: df['at']       = datetime.now().strftime('%Y-%m-%d')
        if 'userName' not in df.columns: df['userName'] = ''

        # Drop rows where content is empty/whitespace
        df['content'] = df['content'].astype(str).str.strip()
        df = df[df['content'].str.len() > 2]

        if df.empty:
            raise HTTPException(status_code=400, detail="No usable review rows found after filtering empty content.")

        source_name = (
            file.filename
            .replace('.csv', '').replace('.xlsx', '').replace('.xls', '')
            .replace('_', ' ').replace('-', ' ').title()
            if file.filename else 'CSV Upload'
        )
        result = _df_to_review_list(df, source_name)
        if not result:
            raise HTTPException(status_code=400, detail="No valid reviews found in file.")

        return result

    except HTTPException:
        raise
    except Exception as e:
        log_debug(f"CSV upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Error parsing file: {str(e)}")



@app.post("/process", response_model=AnalysisResponse)
async def process_reviews(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Endpoint for the Step 2 -> Step 3 transition."""
    # Resolve Anonymous Beta User via Device ID
    actual_user_id = request.user_id or 1
    if getattr(request, 'device_id', None):
        from database import get_or_create_device_user
        actual_user_id = get_or_create_device_user(request.device_id)
        
        # Enforce 3-analysis soft limit for beta users
        # Add 1 if there's currently an active analysis to prevent spam
        1 if _user_has_active_analysis(actual_user_id) else 0
        # LIMIT REMOVED: allow unlimited tests
        # if (get_user_analyses_count(actual_user_id) + active_bonus) >= 3:
        #     raise HTTPException(status_code=403, detail="Beta Limit Reached: You have completed your 3 free platform tests.")
            
    request.user_id = actual_user_id

    if not _llm_enabled_for_user(request.user_id, request.tenant_id):
        raise HTTPException(status_code=403, detail="LLM usage is disconnected for this account. Reconnect it in settings to run AI analysis.")

    # Rate Limit Check
    if _user_has_active_analysis(request.user_id):
        raise HTTPException(status_code=429, detail="You already have an analysis in progress. Please wait for it to finish.")

    task_id = str(uuid.uuid4())
    _register_user_task(request.user_id, task_id)
    _set_task(
        task_id,
        {
            "status": "initializing",
            "progress": 0,
            "message": "Queueing analysis worker...",
            "processed_reviews": 0,
            "total_reviews": len(request.reviews or []),
            "fetched_reviews": len(request.reviews or []),
            "analyzed_reviews": 0,
            "fallback_reviews": 0,
            "unresolved_reviews": 0,
            "dropped_reviews": 0,
            "in_flight_reviews": 0,
            "coverage_pct": 0.0,
        },
        append_log="Queueing analysis worker...",
    )
    background_tasks.add_task(run_processing_background, task_id, request)
    
    return {
        "task_id": task_id,
        "status": "triggered",
        "message": "Analysis started"
    }

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Check status of a background task."""
    task = _get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return JSONResponse(
        content=task,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@app.get("/api/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    try:
        analyses = get_user_analyses(current_user["user_id"], current_user["tenant_id"])
        return {"analyses": analyses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Analytics Endpoints ---

@app.get("/api/analytics/health")
async def get_health_metrics_api(current_user: dict = Depends(get_current_user)):
    try:
        df = get_all_analyses_df(current_user["tenant_id"])
        # Ensure we have the right columns. If stored as JSON, we might need parsing.
        # But assuming `save_analysis` stores structured data or we parse it here.
        # For MVP, assuming the DF has columns 'sentiment_score', 'churn_risk' etc. 
        # If 'ResultJson' exists, we should flatten it.
        if 'ResultJson' in df.columns:
            # Simple flattening for MVP
            import json
            def parse_json_col(x):
                try: return json.loads(x)
                except: return {}
            
            json_dicts = df['ResultJson'].apply(parse_json_col).tolist()
            if json_dicts:
                json_df = pd.DataFrame(json_dicts)
                # Merge or use json_df
                df = json_df
        
        metrics = get_health_metrics(df)
        return metrics
    except Exception as e:
        print(f"Error in health metrics: {str(e)}")
        # Return zeros on error to not break UI
        return {
            "health_score": 0, "nps_score": 0, "csat_score": 0, "ces_score": 0,
            "retention_risk_pct": 0, "total_reviews": 0
        }

@app.get("/api/analytics/themes")
async def get_themes_api(current_user: dict = Depends(get_current_user)):
    try:
        df = get_all_analyses_df(current_user["tenant_id"])
        if 'ResultJson' in df.columns:
             import json
             def parse_json_col(x):
                try: return json.loads(x)
                except: return {}
             json_dicts = df['ResultJson'].apply(parse_json_col).tolist()
             if json_dicts:
                 df = pd.DataFrame(json_dicts)

        categorized = categorize_metrics(df)
        return categorized
    except Exception as e:
        print(f"Error in themes: {str(e)}")
        return {"important_strengths": [], "important_weaknesses": [], "unimportant_strengths": [], "unimportant_weaknesses": []}

@app.get("/api/analytics/trends")
async def get_trends_api(current_user: dict = Depends(get_current_user)):
    try:
        df = get_all_analyses_df(current_user["tenant_id"])
        # Trends require 'at' column.
        # If 'ResultJson' is used, we need to ensure 'at' is preserved or joined from main table.
        # 'get_all_analyses_df' returns the 'analyses' table which has 'CreateDate' (as 'at' proxy?)
        # Let's use CreateDate as 'at'
        if 'CreateDate' in df.columns:
            df['at'] = df['CreateDate']
        
        if 'ResultJson' in df.columns:
             import json
             def parse_json_col(x):
                try: return json.loads(x)
                except: return {}
             json_dicts = df['ResultJson'].apply(parse_json_col).tolist()
             if json_dicts:
                 json_df = pd.DataFrame(json_dicts)
                 # We need to map 'at' from original df to this json_df
                 if 'at' in df.columns:
                    json_df['at'] = df['at'].values
                 df = json_df

        trends = calculate_sentiment_trends(df)
        return trends
    except Exception as e:
        print(f"Error in trends: {str(e)}")
        return {"improving": [], "worsening": []}

@app.get("/api/data/feed")
async def get_data_feed_api(limit: int = 50, offset: int = 0, search: str = None, current_user: dict = Depends(get_current_user)):
    try:
        df = get_all_analyses_df(current_user["tenant_id"])
        if 'ResultJson' in df.columns:
             import json
             def parse_json_col(x):
                try: return json.loads(x)
                except: return {}
             json_dicts = df['ResultJson'].apply(parse_json_col).tolist()
             if json_dicts:
                 json_df = pd.DataFrame(json_dicts)
                 # Add date
                 if 'CreateDate' in df.columns:
                     json_df['at'] = df['CreateDate'].values
                 if 'Source' in df.columns:
                     json_df['source'] = df['Source'].values
                 df = json_df

        # Filter
        if search:
            search = search.lower()
            df = df[df.astype(str).apply(lambda x: x.str.lower().str.contains(search, na=False)).any(axis=1)]

        # Sort by date desc
        if 'at' in df.columns:
            df = df.sort_values('at', ascending=False)
        
        # Paginate
        total = len(df)
        paged = df.iloc[offset : offset + limit]
        
        # Convert to list of dicts, replace NaN with null
        results = paged.where(pd.notnull(paged), None).to_dict('records')
        
        return {
            "total": total,
            "data": results
        }
    except Exception as e:
        print(f"Error in data feed: {str(e)}")
        return {"total": 0, "data": []}

# --- Copilot Endpoints ---

class CopilotRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    context: Optional[Dict] = None
    history: Optional[List[Dict]] = None
    source: Optional[str] = "tab"

@app.post("/api/copilot/query")
@app.post("/copilot")
async def copilot_query(req: CopilotRequest, current_user: dict = Depends(get_current_user)):
    try:
        user_message = req.query or req.message
        if not user_message:
             return {"response": "Please provide a query."}

        reviews_df = pd.DataFrame()
        
        # 1. Try to use context from request (frontend sends current analysis reviews)
        if req.context and 'reviews' in req.context and isinstance(req.context['reviews'], list):
            reviews_data = req.context['reviews']
            if reviews_data:
                # Normalize if strings
                if isinstance(reviews_data[0], str):
                    reviews_data = [{"content": r} for r in reviews_data]
                reviews_df = pd.DataFrame(reviews_data)
        
        # 2. Fallback to DB if no context provided
        #    get_all_analyses_df() already returns a flat DataFrame of individual reviews
        #    (it parses the JSON internally), so we can use it directly.
        if reviews_df.empty:
            reviews_df = get_all_analyses_df(current_user["tenant_id"], limit=1)
            print(f"[Copilot] DB fallback: loaded {len(reviews_df)} reviews from latest analysis")
        
        # Call ported logic
        response = chat_with_copilot(user_message, reviews_df, source=req.source)
        return {"response": response}
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        try:
            with open("debug_copilot_traceback.txt", "w") as f:
                f.write(tb)
        except Exception:
            pass
        print(f"Copilot API error: {e}")
        return {"response": f"I encountered an error: {str(e)}"}


# --- Advanced Analytics Endpoints ---

@app.get("/api/analytics/financial")
async def get_financial_analytics(vertical: str = "generic", current_user: dict = Depends(get_current_user)):
    """
    Returns Economic Impact metrics: Revenue at Risk, Topic ROI.
    """
    tenant_id = current_user.get("tenant_id")
    reviews_df = get_all_analyses_df(tenant_id)
    if reviews_df.empty:
        return {"error": "No data available"}
    
    # Calculate Revenue at Risk (Default ARPU = $50, Time Horizon = 30d)
    revenue_risk = calculate_revenue_at_risk(reviews_df, arpu=50.0, time_horizon='30d')
    
    # Calculate ROI Report
    roi_report = generate_roi_ranked_report(reviews_df, arpu=50.0)
    
    return {
        "revenue_risk": revenue_risk,
        "roi_report": roi_report
    }

# In-memory cache for strategy results keyed by analysis_id
_strategy_cache: dict = {}

@app.get("/api/analytics/strategy")
async def get_strategic_analytics(vertical: str = "generic", current_user: dict = Depends(get_current_user)):
    """
    Returns Strategic Narrative: SCR Brief, Executive One-Pager.
    Caches results per analysis_id so tab switches don't regenerate.
    """
    reviews_df = get_latest_analysis_df()
    if reviews_df.empty:
        return {"error": "No data available"}
    
    # Determine the analysis_id for caching
    analysis_id = None
    if 'analysis_id' in reviews_df.columns:
        analysis_id = int(reviews_df['analysis_id'].iloc[0])
    
    # Return cached result if available for this analysis
    cache_key = f"{analysis_id}_{vertical}"
    if cache_key in _strategy_cache:
        return _strategy_cache[cache_key]
    
    # Calculate global metrics for the brief
    metrics = get_health_metrics(reviews_df)
    nps = metrics.get('nps_score')
    csat = metrics.get('csat_score')
    
    # Generate SCR Brief
    scr_brief = generate_scr_brief(reviews_df, arpu=50.0, nps=nps, csat=csat, vertical=vertical)
    
    # Generate Executive One-Pager
    one_pager = create_executive_onepager(reviews_df, client_name="Global Analysis", arpu=50.0, vertical=vertical)
    
    result = {
        "scr_brief": scr_brief,
        "one_pager": one_pager
    }
    
    # Cache the result
    _strategy_cache[cache_key] = result
    
    return result


@app.get("/api/analytics/advanced/{analysis_id}")
async def get_advanced_analytics_legacy(analysis_id: int, current_user: dict = Depends(get_current_user)):
    """
    Returns comprehensive advanced intelligence payloads for a specific analysis:
    - Predictive (velocity, crisis radar, churn intent)
    - Competitive (defections, gaps)
    - Causal (root cause, correlation vs causation)
    - Prioritization (impact/effort matrix, decision engine)
    - Trust (audit trails, PII redactions)
    """
    try:
        # Since we use in-memory df in standalone mode, get the latest analysis frame
        reviews_df = get_latest_analysis_df(current_user["tenant_id"])
        if reviews_df.empty:
            raise HTTPException(status_code=404, detail="No analysis data available")
        
        log_debug(f"Generating advanced intelligence for analysis {analysis_id}")
        
        # 1. Predictive Intelligence
        try:
            tagged_df = predictive_intelligence.tag_churn_intent_reviews(reviews_df)
            churn_intent = predictive_intelligence.get_churn_intent_summary(tagged_df)
            crisis_alerts = predictive_intelligence.generate_crisis_alerts(reviews_df)
            velocity = predictive_intelligence.detect_acceleration_events(reviews_df)
            
            predictive_data = {
                "velocity": velocity.to_dict('records') if not velocity.empty else [],
                "crisis_alerts": crisis_alerts,
                "churn_intent": churn_intent
            }
        except Exception as e:
            log_debug(f"Error in predictive layer: {e}")
            predictive_data = {"error": str(e)}

        # 2. Competitive Intelligence
        try:
            comp_report = competitive_intelligence.generate_competitive_threat_report(reviews_df)
            competitive_data = comp_report
        except Exception as e:
            log_debug(f"Error in competitive layer: {e}")
            competitive_data = {"error": str(e)}

        # 3. Causal Diagnostics
        try:
            causal_report = causal_diagnostics.generate_causal_insights_report(reviews_df)
            causal_data = {
                "summary": causal_report.get('summary', {}),
                "true_drivers": causal_report.get('true_drivers', []),
                "noise_topics": causal_report.get('noise_topics', []),
                "root_cause": causal_report.get('root_cause_distribution', {})
            }
        except Exception as e:
            log_debug(f"Error in causal layer: {e}")
            causal_data = {"error": str(e)}

        # 4. Prioritization (Impact/Effort and Decision Engine)
        try:
            # We mock the generic 'results' object if needed since it's just meant for summary
            mock_results = {"total_analyzed": len(reviews_df)}
            
            # Use 'arpu' parameter assuming a default $50 LTV for now
            matrix = impact_effort_matrix.create_impact_effort_matrix(reviews_df, mock_results, arpu=50.0)
            decision = decision_engine.generate_decision_summary(reviews_df, mock_results, vertical="generic")
            
            prioritization_data = {
                "matrix": matrix,
                "decision": decision
            }
        except Exception as e:
            log_debug(f"Error in prioritization layer: {e}")
            prioritization_data = {"error": str(e)}

        # 5. Trust Center
        try:
            # Requires enterprise_trust database to be initialized
            enterprise_trust.initialize_enterprise_trust()
            audit_summary = enterprise_trust.get_audit_trail_summary(days_back=30)
            trust_data = audit_summary
        except Exception as e:
            log_debug(f"Error in trust layer: {e}")
            trust_data = {"error": str(e)}

        return {
            "predictive": predictive_data,
            "competitive": competitive_data,
            "causal": causal_data,
            "prioritization": prioritization_data,
            "trust": trust_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_debug(f"Advanced analytics total failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ======================================================================
# EXPORT & REPORTING ENDPOINTS
# ======================================================================

@app.get("/api/analytics/export/{user_id}")
async def export_user_data(user_id: int):
    """
    Export all user data as a downloadable ZIP archive.
    Uses data_export module to package JSON + CSV files.
    """
    try:
        # Gather user data
        analyses = get_user_analyses(user_id)
        reviews_df = get_all_analyses_df()
        
        user_data = {
            "export_date": datetime.now().isoformat(),
            "user": {"id": user_id, "email": "user@horizon.ai"},
            "analyses": analyses if analyses else [],
            "usage": [{"total_analyses": len(analyses) if analyses else 0}],
        }
        
        # Generate ZIP
        zip_bytes = data_export.create_export_archive(user_data)
        
        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=horizon_export_{datetime.now().strftime('%Y%m%d')}.zip"
            }
        )
    except Exception as e:
        log_debug(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.get("/api/analytics/report/{analysis_id}")
async def generate_pdf_report(analysis_id: str, user_id: int = 1):
    """
    Generate a professional PDF report for an analysis.
    Uses pdf_generator module with ReportLab.
    """
    try:
        reviews_df = get_latest_analysis_df()
        if reviews_df.empty:
            raise HTTPException(status_code=404, detail="No analysis data for report generation")
        
        # Calculate metrics for the report
        metrics = get_health_metrics(reviews_df)
        categorized = categorize_metrics(reviews_df)
        
        # Build results payload for the PDF generator
        results = {
            **metrics,
            "total_analyzed": len(reviews_df),
            "total_positive": int((reviews_df.get('sentiment', pd.Series()).str.lower() == 'positive').sum()) if 'sentiment' in reviews_df.columns else 0,
            "total_negative": int((reviews_df.get('sentiment', pd.Series()).str.lower() == 'negative').sum()) if 'sentiment' in reviews_df.columns else 0,
            "total_neutral": int((reviews_df.get('sentiment', pd.Series()).str.lower() == 'neutral').sum()) if 'sentiment' in reviews_df.columns else 0,
            "churn_risk_distribution": {},
            "top_themes": [],
            "top_feature_requests": [],
            "retention_recommendations": [],
        }
        
        # Churn distribution
        if 'churn_risk' in reviews_df.columns:
            results["churn_risk_distribution"] = {
                "high": int((reviews_df['churn_risk'].str.lower() == 'high').sum()),
                "medium": int((reviews_df['churn_risk'].str.lower() == 'medium').sum()),
                "low": int((reviews_df['churn_risk'].str.lower() == 'low').sum()),
            }
            results["retention_risk_count"] = results["churn_risk_distribution"]["high"]
        
        # Top themes from pain_point_category
        if 'pain_point_category' in reviews_df.columns:
            theme_counts = reviews_df['pain_point_category'].value_counts().head(10)
            results["top_themes"] = [
                {"theme": str(cat), "mentions": int(count)}
                for cat, count in theme_counts.items()
            ]
        
        # Generate temporary PDF
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            temp_path = tmp.name
        
        vertical = 'generic'
        if 'vertical' in reviews_df.columns and not reviews_df['vertical'].empty:
            vertical = str(reviews_df['vertical'].iloc[0])
        
        pdf_generator.generate_brand_analysis_pdf(
            analysis_df=reviews_df,
            results=results,
            vertical=vertical,
            output_path=temp_path
        )
        
        # Read and return PDF
        with open(temp_path, 'rb') as f:
            pdf_bytes = f.read()
        
        # Cleanup
        try:
            os.remove(temp_path)
        except:
            pass
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=horizon_report_{datetime.now().strftime('%Y%m%d')}.pdf"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        log_debug(f"PDF report generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


# ======================================================================
# CRM ENDPOINTS
# ======================================================================

class CRMProfileBase(BaseModel):
    external_id: Optional[str] = None
    name: str
    email: Optional[str] = ''
    company: Optional[str] = ''
    segment: Optional[str] = 'Unknown'
    plan: Optional[str] = ''
    mrr: Optional[float] = 0.0
    joined_date: Optional[str] = ''
    next_renewal: Optional[str] = ''
    tags: Optional[List[str]] = []
    notes: Optional[str] = ''
    schedule: Optional[str] = 'manual'

class CRMImportRequest(BaseModel):
    user_id: int
    workspace_id: Optional[int] = None
    profiles: List[Dict[str, Any]]

class CRMFeedbackRequest(BaseModel):
    user_id: int
    content: str
    score: Optional[int] = 3
    source: Optional[str] = 'manual'
    feedback_date: Optional[str] = ''

class CRMAnalyzeRequest(BaseModel):
    user_id: int
    schedule: Optional[str] = 'manual'
    vertical: Optional[str] = 'saas'


@app.post("/api/crm/import")
async def crm_import_profiles(req: CRMImportRequest, current_user: dict = Depends(get_current_user)):
    """Import profiles from a CSV/JSON bulk upload."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        result = crm_upsert_profiles(user_id, tenant_id, req.profiles, req.workspace_id)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crm/profiles")
async def crm_list_profiles(
    search: str = '',
    segment: str = '',
    current_user: dict = Depends(get_current_user)
):
    """List CRM profiles for a user with optional search/filter."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        profiles = crm_get_profiles(user_id, tenant_id, search, segment)
        return {"profiles": profiles, "total": len(profiles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crm/profiles/{profile_id}")
async def crm_profile_detail(profile_id: int, current_user: dict = Depends(get_current_user)):
    """Get a single profile with its feedbacks and latest analysis."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        profile = crm_get_profile(user_id, tenant_id, profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        feedbacks = crm_get_feedbacks(user_id, tenant_id, profile_id)
        history = crm_get_analysis_history(user_id, tenant_id, profile_id, limit=10)
        return {"profile": profile, "feedbacks": feedbacks, "history": history}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/crm/profiles/{profile_id}")
async def crm_update_profile_endpoint(profile_id: int, updates: Dict[str, Any] = Body(...), current_user: dict = Depends(get_current_user)):
    """Partial-update a CRM profile."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = crm_update_profile(user_id, tenant_id, profile_id, updates)
        return {"success": ok}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/crm/profiles/{profile_id}")
async def crm_delete_profile_endpoint(profile_id: int, current_user: dict = Depends(get_current_user)):
    """Soft-delete a CRM profile."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = crm_delete_profile(user_id, tenant_id, profile_id)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crm/profiles/{profile_id}/feedback")
async def crm_add_feedback_endpoint(profile_id: int, req: CRMFeedbackRequest, current_user: dict = Depends(get_current_user)):
    """Add a feedback entry for a profile."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        fid = crm_add_feedback(
            user_id, tenant_id, profile_id,
            req.content, req.score, req.source, req.feedback_date
        )
        return {"success": True, "feedback_id": fid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crm/profiles/{profile_id}/feedbacks")
async def crm_list_feedbacks(profile_id: int, current_user: dict = Depends(get_current_user)):
    """List all feedbacks for a profile."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        feedbacks = crm_get_feedbacks(user_id, tenant_id, profile_id)
        return {"feedbacks": feedbacks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crm/profiles/{profile_id}/analyze")
async def crm_analyze_profile(profile_id: int, req: CRMAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    """
    Run LLM sentiment analysis on all feedbacks for a profile.
    Computes aggregate sentiment, churn probability, top issues,
    and saves a snapshot in crm_analyses.
    """
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        feedbacks = crm_get_feedbacks(user_id, tenant_id, profile_id)
        if not feedbacks:
            return {"success": False, "message": "No feedbacks to analyze"}

        # Convert feedbacks to the review format processor expects
        reviews_for_analysis = [
            {
                "id": f"crm_{fb['id']}",
                "content": fb["content"],
                "score": fb.get("score", 3),
                "author": "CRM Customer",
                "at": fb.get("feedback_date", ""),
            }
            for fb in feedbacks
        ]

        # Run analysis using the existing processor (synchronous — no stop/pause events needed)
        results = await asyncio.to_thread(
            processor.run_analysis_batch,
            reviews_for_analysis,
            req.vertical,
            None,  # custom_instructions
            None,  # progress_callback
            None,  # stop_event
            None,  # pause_event
            "feedback_crm"
        )

        # Write analysis fields back to individual feedback rows
        fb_by_idx = {f"crm_{fb['id']}": fb['id'] for fb in feedbacks}
        sentiments = []
        churn_risks = []
        issues_seen = []
        emotions = []

        for res in results:
            fid_key = res.get("id", "")
            fb_db_id = fb_by_idx.get(fid_key)
            sentiment_score = float(res.get("sentiment_score", 0.0) or 0.0)
            sentiments.append(sentiment_score)

            churn_risk = str(res.get("churn_risk", "low") or "low").lower()
            churn_risks.append(churn_risk)
            if res.get("issue"):
                issues_seen.append(str(res["issue"]))
            for emotion in res.get("emotions", []) or []:
                if emotion:
                    emotions.append(str(emotion))

            if fb_db_id:
                crm_update_feedback_analysis(fb_db_id, {
                    "sentiment": res.get("sentiment"),
                    "sentiment_score": sentiment_score,
                    "churn_risk": churn_risk,
                    "pain_point_category": res.get("pain_point_category") or res.get("category"),
                    "issue": res.get("issue"),
                })

        # Compute aggregate metrics
        avg_sentiment = round(sum(sentiments) / max(len(sentiments), 1), 3)
        high_churn_count = sum(1 for r in churn_risks if r == "high")
        churn_probability = round(high_churn_count / max(len(churn_risks), 1), 3)

        from collections import Counter
        dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else "Neutral"
        top_issue = Counter(issues_seen).most_common(1)[0][0] if issues_seen else ""

        # Build summary text
        summary_parts = [
            f"Analyzed {len(results)} feedbacks.",
            f"Average sentiment score: {avg_sentiment:+.2f}.",
            f"Churn probability: {churn_probability:.0%}.",
        ]
        if top_issue:
            summary_parts.append(f"Top concern: {top_issue}.")
        summary = " ".join(summary_parts)

        analysis_data = {
            "total_feedbacks": len(results),
            "avg_sentiment": avg_sentiment,
            "churn_probability": churn_probability,
            "dominant_emotion": dominant_emotion,
            "top_issue": top_issue,
            "summary": summary,
        }

        snapshot_id = crm_save_analysis(user_id, tenant_id, profile_id, req.schedule, analysis_data)

        return {
            "success": True,
            "snapshot_id": snapshot_id,
            **analysis_data
        }
    except Exception as e:
        print(f"[CRM] Analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crm/profiles/{profile_id}/history")
async def crm_analysis_history_endpoint(profile_id: int, current_user: dict = Depends(get_current_user), limit: int = 20):
    """Return analysis snapshots for a profile (for trend chart)."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        history = crm_get_analysis_history(user_id, tenant_id, profile_id, limit)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/crm/batch-analyze")
async def crm_batch_analyze(background_tasks: BackgroundTasks, req: CRMAnalyzeRequest, current_user: dict = Depends(get_current_user), days_since: int = Body(7)):
    """
    Queue analysis for all profiles not analyzed in the last `days_since` days.
    Runs in the background.
    """
    from datetime import datetime, timedelta
    cutoff = (datetime.now() - timedelta(days=days_since)).isoformat()
    user_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]

    profiles = crm_get_profiles(user_id, tenant_id)
    stale = [
        p for p in profiles
        if not p.get('last_analyzed') or p['last_analyzed'] < cutoff
    ]

    async def _run_batch():
        for p in stale:
            try:
                feedbacks = crm_get_feedbacks(user_id, tenant_id, p['id'])
                if not feedbacks:
                    continue
                reviews = [
                    {"id": f"crm_{fb['id']}", "content": fb["content"],
                     "score": fb.get("score", 3), "author": "CRM Customer", "at": fb.get("feedback_date", "")}
                    for fb in feedbacks
                ]
                results = await asyncio.to_thread(
                    processor.run_analysis_batch, reviews, req.vertical,
                    None, None, None, None, "feedback_crm"
                )
                sentiments = []
                churn_risks = []
                for res in results:
                    sentiments.append(float(res.get("sentiment_score", 0.0) or 0.0))
                    churn_risks.append(str(res.get("churn_risk", "low") or "low").lower())
                avg_s = round(sum(sentiments) / max(len(sentiments), 1), 3)
                high_c = sum(1 for r in churn_risks if r == "high")
                churn_prob = round(high_c / max(len(churn_risks), 1), 3)
                crm_save_analysis(user_id, tenant_id, p['id'], 'batch', {
                    "total_feedbacks": len(results),
                    "avg_sentiment": avg_s,
                    "churn_probability": churn_prob,
                    "dominant_emotion": "",
                    "top_issue": "",
                    "summary": f"Batch analysis: {len(results)} feedbacks, {avg_s:+.2f} average sentiment score."
                })
                print(f"[CRM Batch] Profile {p['id']} done")
            except Exception as e:
                print(f"[CRM Batch] Profile {p['id']} error: {e}")

    background_tasks.add_task(_run_batch)
    return {"success": True, "queued": len(stale), "message": f"{len(stale)} profiles queued for analysis"}


# ======================================================================
# SURVEY ENDPOINTS
# ======================================================================

class SurveyCreateRequest(BaseModel):
    user_id: int
    title: str
    survey_type: str = 'custom'       # csat | nps | custom
    description: str = ''
    workspace_id: Optional[int] = None
    theme: str = 'indigo'
    branding_name: str = ''

class SurveyUpdateRequest(BaseModel):
    user_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None      # draft | published | closed
    theme: Optional[str] = None
    branding_name: Optional[str] = None
    show_progress: Optional[bool] = None
    allow_anonymous: Optional[bool] = None
    response_limit: Optional[int] = None
    deadline: Optional[str] = None

class SurveyQuestionsRequest(BaseModel):
    user_id: int
    questions: List[Dict[str, Any]]

class SurveyResponseRequest(BaseModel):
    answers: Dict[str, Any]
    respondent_email: str = ''
    respondent_name: str = ''
    respondent_token: str = ''


@app.post("/api/surveys")
async def api_survey_create(req: SurveyCreateRequest, current_user: dict = Depends(get_current_user)):
    """Create a new survey. Returns the new survey with questions=[]"""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        sid = survey_create(
            user_id, tenant_id, req.title, req.survey_type,
            req.description, req.workspace_id, req.theme, req.branding_name
        )
        # Pre-populate template questions based on type
        template_questions = _survey_template(req.survey_type)
        if template_questions:
            survey_save_questions(sid, template_questions)
        survey = survey_get(sid, user_id, tenant_id)
        return {"success": True, "survey": survey}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _survey_template(survey_type: str) -> list:
    """Return starter questions for a known survey type."""
    if survey_type == 'nps':
        return [
            {"question_type": "nps", "title": "How likely are you to recommend us to a friend or colleague?",
             "description": "0 = Not at all likely, 10 = Extremely likely",
             "is_required": True, "config": {"min": 0, "max": 10}},
            {"question_type": "text", "title": "What's the main reason for your score?",
             "description": "", "is_required": False, "config": {}}
        ]
    elif survey_type == 'csat':
        return [
            {"question_type": "csat", "title": "How satisfied are you with our service?",
             "description": "1 = Very Unsatisfied, 5 = Very Satisfied",
             "is_required": True, "config": {"min": 1, "max": 5,
               "labels": {"1": "Very Unsatisfied", "2": "Unsatisfied", "3": "Neutral", "4": "Satisfied", "5": "Very Satisfied"}}},
            {"question_type": "text", "title": "What can we do better?",
             "description": "", "is_required": False, "config": {}}
        ]
    return []


@app.get("/api/surveys")
async def api_survey_list(workspace_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """List all surveys for a user."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        surveys = survey_list(user_id, tenant_id, workspace_id)
        return {"surveys": surveys, "total": len(surveys)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/surveys/{survey_id}")
async def api_survey_get(survey_id: int, current_user: dict = Depends(get_current_user)):
    """Get a single survey with its questions."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        s = survey_get(survey_id, user_id, tenant_id)
        if not s:
            raise HTTPException(status_code=404, detail="Survey not found")
        return {"survey": s}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/surveys/{survey_id}")
async def api_survey_update(survey_id: int, req: SurveyUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update survey metadata."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        updates = req.model_dump(exclude_none=True, exclude={'user_id'})
        ok = survey_update(survey_id, user_id, tenant_id, updates)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/surveys/{survey_id}")
async def api_survey_delete(survey_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a survey."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = survey_delete(survey_id, user_id, tenant_id)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/surveys/{survey_id}/questions")
async def api_survey_save_questions_ep(survey_id: int, req: SurveyQuestionsRequest, current_user: dict = Depends(get_current_user)):
    """Replace all questions for a survey."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        # Verify ownership
        s = survey_get(survey_id, user_id, tenant_id)
        if not s:
            raise HTTPException(status_code=404, detail="Survey not found")
        ok = survey_save_questions(survey_id, req.questions)
        return {"success": ok}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/surveys/{survey_id}/publish")
async def api_survey_publish(survey_id: int, current_user: dict = Depends(get_current_user)):
    """Publish or unpublish a survey."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        s = survey_get(survey_id, user_id, tenant_id)
        if not s:
            raise HTTPException(status_code=404, detail="Survey not found")
        new_status = 'draft' if s['status'] == 'published' else 'published'
        survey_update(survey_id, user_id, tenant_id, {'status': new_status})
        return {"success": True, "status": new_status, "token": s['token']}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/surveys/public/{token}")
async def api_survey_public(token: str):
    """Get a published survey by public token (no auth required)."""
    try:
        s = survey_get_by_token(token)
        if not s:
            raise HTTPException(status_code=404, detail="Survey not found or not published")
        return {"survey": s}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/surveys/public/{token}/respond")
async def api_survey_respond(token: str, req: SurveyResponseRequest, request: Request):
    """Submit a response to a published survey (public, no auth)."""
    try:
        s = survey_get_by_token(token)
        if not s:
            raise HTTPException(status_code=404, detail="Survey not found or not published")
        # Optional response limit check
        if s.get('response_limit', 0) > 0:
            from database import survey_get_responses as _sgr
            existing = _sgr(s['id'], s['user_id'])
            if len(existing) >= s['response_limit']:
                raise HTTPException(status_code=403, detail="Response limit reached")
        ip_raw = request.client.host if request.client else ''
        import hashlib
        ip_hash = hashlib.sha256(ip_raw.encode()).hexdigest()[:16] if ip_raw else ''
        rid = survey_submit_response(
            s['id'], req.answers, req.respondent_email, req.respondent_name,
            req.respondent_token or str(uuid.uuid4()), ip_hash
        )
        return {"success": True, "response_id": rid}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/surveys/{survey_id}/responses")
async def api_survey_responses(survey_id: int, current_user: dict = Depends(get_current_user), limit: int = 200):
    """List all responses for a survey."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        responses = survey_get_responses(survey_id, user_id, tenant_id, limit)
        return {"responses": responses, "total": len(responses)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/surveys/{survey_id}/analytics")
async def api_survey_analytics(survey_id: int, current_user: dict = Depends(get_current_user)):
    """Get aggregate analytics for all questions in a survey."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        analytics = survey_get_analytics(survey_id, user_id, tenant_id)
        if not analytics:
            raise HTTPException(status_code=404, detail="Survey not found")
        return analytics
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= CXM FEEDBACK INTELLIGENCE ROUTES =============================

# --- Pydantic models ---
class CxmSourceRequest(BaseModel):
    user_id: int = 1
    source_type: str          # playstore | appstore | trustpilot | csv | survey
    identifier: str           # package name, domain, survey_id, etc.
    display_name: str = ''
    fetch_interval: str = 'daily'   # hourly | daily | weekly | manual
    config: Optional[Dict[str, Any]] = {}

class CxmSourceUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    fetch_interval: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None

class CxmCampaignRequest(BaseModel):
    user_id: int = 1
    name: str
    campaign_type: str = 'email'    # email | push | sms
    subject: str = ''
    body: str
    target_segment: Optional[Dict[str, Any]] = {}

class CxmCampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    target_segment: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    recipient_count: Optional[int] = None

class CxmGenerateCampaignRequest(BaseModel):
    user_id: int = 1
    top_issues: Optional[List[str]] = []
    churn_risk: Optional[str] = 'high'
    avg_sentiment: Optional[float] = -0.3
    campaign_type: Optional[str] = 'email'
    app_name: Optional[str] = 'our app'
    source_ids: Optional[List[int]] = []

# --- Source endpoints ---

@app.get("/cxm/sources")
async def cxm_list_sources(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        return {"sources": cxm_get_sources(user_id, tenant_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cxm/sources")
async def cxm_add_source(req: CxmSourceRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        workspace_id = getattr(req, 'workspace_id', None)
        
        import secrets
        is_webhook = (req.source_type == 'webhook')
        webhook_token = secrets.token_urlsafe(32) if is_webhook else None
        hmac_secret   = secrets.token_urlsafe(32) if is_webhook else None

        # Validate source_type
        VALID_SOURCE_TYPES = {'playstore', 'appstore', 'trustpilot', 'csv', 'survey', 'generic_api', 'webhook'}
        if req.source_type not in VALID_SOURCE_TYPES:
            raise HTTPException(status_code=422, detail=f"Invalid source_type. Must be one of: {', '.join(sorted(VALID_SOURCE_TYPES))}")

        # Validate fetch_interval
        VALID_INTERVALS = {'hourly', 'daily', 'weekly', 'manual'}
        if req.fetch_interval not in VALID_INTERVALS:
            raise HTTPException(status_code=422, detail=f"Invalid fetch_interval. Must be one of: {', '.join(sorted(VALID_INTERVALS))}")

        sid = cxm_create_source(
            user_id, tenant_id, req.source_type, req.identifier,
            req.display_name or req.identifier, req.fetch_interval, req.config or {},
            webhook_token=webhook_token, hmac_secret=hmac_secret,
            workspace_id=workspace_id
        )
        # Schedule the job (skip push-only webhook sources)
        cxm_scheduler.schedule_source(sid, req.fetch_interval)
        # Kick off initial fetch in background (for API-pull types)
        if req.source_type not in ('webhook',):
            background_tasks.add_task(cxm_scheduler.trigger_fetch_now, sid)
        source = cxm_get_source(sid, user_id, tenant_id)
        # Include raw secrets here ONLY on creation — never again
        if webhook_token:
            source['webhook_token'] = webhook_token
            source['hmac_secret']   = hmac_secret
        return {"success": True, "source": source}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/cxm/sources/{source_id}")
async def cxm_edit_source(source_id: int, req: CxmSourceUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        updates = {k: v for k, v in req.dict().items() if v is not None}
        ok = cxm_update_source(source_id, user_id, tenant_id, **updates)
        if not ok:
            raise HTTPException(status_code=404, detail="Source not found")
        if req.fetch_interval:
            cxm_scheduler.schedule_source(source_id, req.fetch_interval)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/cxm/sources/{source_id}")
async def cxm_remove_source(source_id: int, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = cxm_delete_source(source_id, user_id, tenant_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Source not found")
        cxm_scheduler.remove_source_job(source_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cxm/sources/{source_id}/fetch")
async def cxm_manual_fetch(source_id: int, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Manually trigger an immediate fetch for a source."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        source = cxm_get_source(source_id, user_id, tenant_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        if background_tasks:
            background_tasks.add_task(cxm_scheduler.trigger_fetch_now, source_id)
        else:
            await asyncio.to_thread(cxm_scheduler.trigger_fetch_now, source_id)
        return {"success": True, "message": "Fetch triggered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Review feed endpoints ---

@app.get("/cxm/reviews")
@app.get("/api/cxm/reviews")
async def cxm_list_reviews(
    source_id: Optional[int] = None,
    sentiment: Optional[str] = None,
    churn_risk: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        reviews = cxm_get_reviews(
            user_id, tenant_id, source_id, sentiment, churn_risk,
            start_date, end_date, limit, offset
        )
        return {"reviews": reviews, "total": len(reviews)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cxm/sources/{source_id}/webhook/{token}")
async def cxm_webhook_ingest(
    source_id: int, token: str,
    payload: Any,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """
    Inbound webhook endpoint.
    Any CRM / CXM tool can POST feedback records here.
    The URL is shown in the Sources tab after connecting a Webhook source.
    """
    try:
        source = cxm_get_source_by_webhook_token(token)
        if not source or source['id'] != source_id:
            raise HTTPException(status_code=403, detail="Invalid webhook token")

        # ── HMAC signature verification (optional but enforced when hmac_secret is set) ──
        raw_hmac_secret = source.get('hmac_secret')  # un-masked value from DB
        if raw_hmac_secret and raw_hmac_secret != '**set**':
            import hmac as _hmac, hashlib
            sig_header = request.headers.get('X-Hub-Signature-256') or request.headers.get('X-Signature')
            if not sig_header:
                raise HTTPException(status_code=403, detail="Missing HMAC signature header")
            body_bytes = await request.body()
            expected = 'sha256=' + _hmac.new(
                raw_hmac_secret.encode(), body_bytes, hashlib.sha256
            ).hexdigest()
            if not _hmac.compare_digest(sig_header, expected):
                raise HTTPException(status_code=403, detail="HMAC signature mismatch")

        # ── Payload size guard (10 MB max) ──
        content_length = request.headers.get('content-length') or '0'
        if int(content_length) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Payload too large (max 10 MB)")

        from api_connector import ingest_webhook_payload
        records = ingest_webhook_payload(payload, source.get('config', {}))
        if not records:
            return {"success": True, "inserted": 0, "message": "No usable records in payload"}

        inserted = cxm_insert_reviews(source_id, source['user_id'], records)
        cxm_update_last_fetched(source_id)

        # Trigger async LLM analysis
        background_tasks.add_task(cxm_scheduler._analyse_pending, source['user_id'])

        return {"success": True, "inserted": inserted, "total_records": len(records)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cxm/trends")
@app.get("/api/cxm/trends")
async def cxm_trends(
    period: str = 'day',
    days: int = 30,
    source_ids: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ids = [int(x) for x in source_ids.split(',') if x.strip()] if source_ids else None
        data = cxm_get_trend_data(
            user_id,
            tenant_id,
            ids,
            period,
            days,
            start_date=start_date,
            end_date=end_date,
        )
        return {"trends": data, "period": period}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cxm/summary")
@app.get("/api/cxm/summary")
async def cxm_summary(
    source_ids: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ids = [int(x) for x in source_ids.split(',') if x.strip()] if source_ids else None
        data = cxm_get_summary(
            user_id,
            tenant_id,
            ids,
            start_date=start_date,
            end_date=end_date,
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Campaign endpoints ---

@app.get("/cxm/campaigns")
async def cxm_list_campaigns(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        return {"campaigns": cxm_get_campaigns(user_id, tenant_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cxm/campaigns")
async def cxm_create_campaign_ep(req: CxmCampaignRequest, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        cid = cxm_create_campaign(
            user_id, tenant_id, req.name, req.campaign_type,
            req.subject, req.body, req.target_segment or {}
        )
        return {"success": True, "campaign_id": cid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/cxm/campaigns/{campaign_id}")
async def cxm_edit_campaign(campaign_id: int, req: CxmCampaignUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        updates = {k: v for k, v in req.dict().items() if v is not None}
        ok = cxm_update_campaign(campaign_id, user_id, tenant_id, **updates)
        if not ok:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/cxm/campaigns/{campaign_id}")
async def cxm_remove_campaign(campaign_id: int, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = cxm_delete_campaign(campaign_id, user_id, tenant_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cxm/campaigns/{campaign_id}/send")
async def cxm_send_campaign(campaign_id: int, current_user: dict = Depends(get_current_user)):
    """Mark a campaign as sent (simulation)."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        ok = cxm_update_campaign(
            campaign_id, user_id, tenant_id,
            status='sent', sent_at=datetime.now().isoformat()
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return {"success": True, "message": "Campaign marked as sent"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cxm/generate-campaign")
async def cxm_generate_campaign(req: CxmGenerateCampaignRequest, current_user: dict = Depends(get_current_user)):
    """Use LLM to generate win-back campaign copy."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        # Get top themes from recent reviews for context
        ids = req.source_ids if req.source_ids else None
        summary = cxm_get_summary(user_id, tenant_id, ids)
        top_issues = req.top_issues or [t['theme'] for t in summary.get('top_themes', [])[:3]]

        from cxm_analyser import generate_campaign_copy
        draft = await asyncio.to_thread(generate_campaign_copy, {
            'top_issues': top_issues,
            'churn_risk': req.churn_risk,
            'avg_sentiment': req.avg_sentiment,
            'campaign_type': req.campaign_type,
            'app_name': req.app_name,
        })
        return {"draft": draft, "top_issues_used": top_issues}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Customer Profile endpoints ---

@app.get("/cxm/customers")
async def cxm_list_customers(
    source_id: Optional[int] = None,
    search: Optional[str] = None,
    churn_risk: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Return paginated customer profiles (one per unique reviewer author)."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        profiles = cxm_get_customer_profiles(
            user_id, tenant_id, source_id, search, churn_risk, limit, offset
        )
        return {"customers": profiles, "total": len(profiles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cxm/customers/{author}")
async def cxm_customer_detail(author: str, current_user: dict = Depends(get_current_user)):
    """Return full profile + review history for one customer (by author name)."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        detail = cxm_get_customer_detail(user_id, tenant_id, author)
        if not detail.get('reviews'):
            raise HTTPException(status_code=404, detail="Customer not found")
        return detail
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ============================= CXM PRODUCTION UTILITY ENDPOINTS =============================

@app.get("/cxm/health")
async def cxm_health(current_user: dict = Depends(get_current_user)):
    """
    System health check for the CXM subsystem.
    Returns: scheduler status, LLM reachability, pending analysis queue size.
    """
    user_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]
    import requests as req_lib

    # Scheduler status
    scheduler_ok = bool(getattr(cxm_scheduler, '_scheduler', None) and
                        cxm_scheduler.HAS_APScheduler and
                        cxm_scheduler._scheduler.running)

    # LLM reachability (quick ping)
    llm_ok = False
    llm_model = os.environ.get("OLLAMA_MODEL", "mistral")
    try:
        r = req_lib.get(f"{os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/tags", timeout=3)
        llm_ok = r.status_code == 200
    except Exception:
        pass

    pending = cxm_count_pending_reviews(user_id)
    sources = cxm_get_sources(user_id)
    active_sources = sum(1 for s in sources if s.get('is_active'))

    return {
        "status": "ok" if scheduler_ok and llm_ok else "degraded",
        "scheduler": {"running": scheduler_ok, "has_apscheduler": cxm_scheduler.HAS_APScheduler},
        "llm": {"reachable": llm_ok, "model": llm_model},
        "queue": {"pending_reviews": pending},
        "sources": {"total": len(sources), "active": active_sources},
    }


@app.post("/cxm/analyse")
async def cxm_trigger_analysis(background_tasks: BackgroundTasks = None, current_user: dict = Depends(get_current_user)):
    """
    Manually trigger LLM analysis on all pending (unanalyzed) reviews for a user.
    Useful after importing reviews or when the scheduler was offline.
    """
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        pending_count = cxm_count_pending_reviews(user_id, tenant_id)
        if pending_count == 0:
            return {"success": True, "message": "No pending reviews to analyse", "queued": 0}
        if background_tasks:
            background_tasks.add_task(cxm_scheduler._analyse_pending, user_id, tenant_id)
        else:
            await asyncio.to_thread(cxm_scheduler._analyse_pending, user_id, tenant_id)
        return {"success": True, "message": f"Analysis triggered for {pending_count} reviews", "queued": pending_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cxm/sources/{source_id}/analyse")
async def cxm_trigger_source_analysis(source_id: int, background_tasks: BackgroundTasks = None, current_user: dict = Depends(get_current_user)):
    """Re-run LLM analysis for all unanalyzed reviews from a specific source."""
    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        source = cxm_get_source(source_id, user_id, tenant_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        if background_tasks:
            background_tasks.add_task(cxm_scheduler._analyse_pending, user_id, tenant_id)
        else:
            await asyncio.to_thread(cxm_scheduler._analyse_pending, user_id, tenant_id)
        return {"success": True, "message": "Analysis triggered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cxm/sources/test")
async def cxm_test_source_connection(req: CxmSourceRequest):
    """
    Test connectivity to a generic_api source before saving it.
    Returns: reachable (bool), sample_records (first 3 normalised), error (str).
    """
    try:
        if req.source_type != 'generic_api':
            return {"reachable": True, "message": "Connection test only supported for generic_api sources"}
        from api_connector import fetch_generic_api_reviews
        records = fetch_generic_api_reviews({"identifier": req.identifier, "config": req.config or {}})
        sample = records[:3]
        return {
            "reachable": True,
            "record_count": len(records),
            "sample_records": sample,
            "message": f"Successfully fetched {len(records)} records"
        }
    except Exception as e:
        return {"reachable": False, "error": str(e), "record_count": 0}


@app.get("/cxm/export")
async def cxm_export_reviews(
    source_id: Optional[int] = None,
    sentiment: Optional[str] = None,
    churn_risk: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fmt: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """
    Export reviews as CSV or JSON.
    GET /cxm/export?churn_risk=high&fmt=csv
    """
    from fastapi.responses import StreamingResponse
    import csv, io

    try:
        user_id = current_user["user_id"]
        tenant_id = current_user["tenant_id"]
        reviews = cxm_get_reviews(
            user_id=user_id, tenant_id=tenant_id, source_id=source_id,
            sentiment=sentiment, churn_risk=churn_risk,
            start_date=start_date, end_date=end_date,
            limit=10000, offset=0
        )

        if fmt == "json":
            import json as _json
            content = _json.dumps({"reviews": reviews, "total": len(reviews)}, default=str)
            return StreamingResponse(
                iter([content]),
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=cxm_reviews.json"}
            )

        # CSV export
        fields = ["id", "author", "source_name", "source_type", "score", "sentiment",
                  "sentiment_score", "churn_risk", "churn_probability", "themes",
                  "content", "reviewed_at", "fetched_at"]
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for r in reviews:
            row = dict(r)
            if isinstance(row.get("themes"), list):
                row["themes"] = ", ".join(row["themes"])
            writer.writerow(row)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=cxm_reviews.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Startup: process any reviews that got stuck unanalyzed during last shutdown ──
@app.on_event("startup")
async def cxm_startup_analysis():
    """Startup no-op: do not auto-fetch or auto-analyze on restart."""
    return


# ══════════════════════════════════════════════════════════════════════════════
# FEEDBACK INTELLIGENCE CRM ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Pydantic Models ──────────────────────────────────────────────────────────

class FIFeedbackCreate(BaseModel):
    text: str
    sentiment: str = "neutral"
    source: str = "manual"
    customer_identifier: Optional[str] = None
    issue_id: Optional[int] = None
    priority: str = "medium"

class FIStatusUpdate(BaseModel):
    status: str

class FIPriorityUpdate(BaseModel):
    priority: str

class FIIssueCreate(BaseModel):
    name: str
    description: str = ""

class FILinkFeedback(BaseModel):
    feedback_id: int
    issue_id: int

class FIGenerateResponseRequest(BaseModel):
    feedback_text: str
    issue_name: str = ""
    issue_status: str = ""
    customer_name: str = ""
    response_type: str = "support_reply"


class FIKnowledgeBaseOfferCreate(BaseModel):
    name: str
    segment: str = "all"
    channel: str = "any"
    offer_title: str
    offer_details: str = ""
    discount_code: str = ""
    cta_text: str = ""
    email_subject: str = ""
    template_email: str = ""
    template_sms: str = ""
    customer_identifiers: List[str] = Field(default_factory=list)
    priority: int = 100
    active: bool = True


class FIKnowledgeBaseOfferUpdate(BaseModel):
    name: Optional[str] = None
    segment: Optional[str] = None
    channel: Optional[str] = None
    offer_title: Optional[str] = None
    offer_details: Optional[str] = None
    discount_code: Optional[str] = None
    cta_text: Optional[str] = None
    email_subject: Optional[str] = None
    template_email: Optional[str] = None
    template_sms: Optional[str] = None
    customer_identifiers: Optional[List[str]] = None
    priority: Optional[int] = None
    active: Optional[bool] = None


class FIKnowledgeBaseEmailConnectorUpsert(BaseModel):
    connector_name: str = "Primary Email"
    from_name: str = ""
    from_email: str
    reply_to: str = ""
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_security: str = "starttls"
    active: bool = True


class FIKnowledgeBaseOfferSendRequest(BaseModel):
    offer_id: int
    segment: Optional[str] = None
    customer_identifiers: List[str] = Field(default_factory=list)
    subject: str = ""
    message: str = ""


class FIAgenticOutreachRequest(BaseModel):
    persist: bool = True

class FIImportCXMRequest(BaseModel):
    source_ids: Optional[List[int]] = None
    scope: str = "full"  # full | days | range
    days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class FIAnalyzeRequest(BaseModel):
    feedback_ids: Optional[List[int]] = None
    source: Optional[str] = None
    source_ids: Optional[List[int]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rating: Optional[int] = None
    rating_values: Optional[List[int]] = None
    rating_min: Optional[int] = None
    rating_max: Optional[int] = None
    status: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    vertical: str = "generic"

class FIConnectorFetchRequest(BaseModel):
    connector_ids: List[int]
    scope: str = "full"  # full | days | range
    days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class FIConnectorIntervalRequest(BaseModel):
    fetch_interval: str


class FIConnectorAnalysisIntervalRequest(BaseModel):
    analysis_interval: str


@app.post("/api/fi/connectors/fetch")
async def fi_fetch_connectors_and_import(
    req: FIConnectorFetchRequest,
    current_user: dict = Depends(get_current_user),
):
    if not req.connector_ids:
        raise HTTPException(status_code=400, detail="connector_ids is required")

    unique_ids = []
    seen = set()
    for raw_id in req.connector_ids:
        try:
            cid = int(raw_id)
        except Exception:
            continue
        if cid <= 0 or cid in seen:
            continue
        seen.add(cid)
        unique_ids.append(cid)

    if not unique_ids:
        raise HTTPException(status_code=400, detail="No valid connector ids provided")

    requested_scope = (req.scope or "full").strip().lower()
    full_sync_requested = requested_scope == "full"

    scoped_ids: List[int] = []
    connector_results: List[Dict[str, Any]] = []

    for connector_id in unique_ids:
        try:
            source = _require_fi_connector_access(connector_id, current_user)
        except HTTPException as e:
            connector_results.append({
                "connector_id": connector_id,
                "ok": False,
                "error": e.detail,
            })
            continue

        scoped_ids.append(connector_id)
        source_type = str(source.get("source_type") or "").strip().lower()
        source_name = str(source.get("display_name") or "").strip()
        source_identifier = str(source.get("identifier") or "").strip()
        source_type_fallback = str(source.get("source_type") or "").strip()
        if source_name and source_identifier and source_name.lower() != source_identifier.lower():
            source_label = f"{source_name} ({source_identifier})"
        else:
            source_label = source_name or source_identifier or source_type_fallback
        if source_type == "csv":
            connector_results.append({
                "connector_id": connector_id,
                "name": source.get("display_name") or source.get("identifier"),
                "source_label": source_label,
                "source_type": source.get("source_type"),
                "ok": True,
                "fetched": 0,
                "inserted": 0,
                "note": "CSV connector uses file upload. Upload a file before fetching into CRM.",
                "error": None,
            })
            continue

        try:
            # Manual CRM fetch should only pull fresh source data here.
            # CRM analysis runs on its dedicated path after the inbox refreshes.
            fetch_result = cxm_scheduler.trigger_fetch_now(
                connector_id,
                run_analysis_hooks=False,
                run_crm_ingestion_hooks=False,
                force_analysis=False,
                ignore_last_fetched=full_sync_requested,
            ) or {}
            connector_results.append({
                "connector_id": connector_id,
                "name": source.get("display_name") or source.get("identifier"),
                "source_label": source_label,
                "source_type": source.get("source_type"),
                "ok": bool(fetch_result.get("ok", True)),
                "fetched": int(fetch_result.get("fetched", 0) or 0),
                "inserted": int(fetch_result.get("inserted", 0) or 0),
                "error": fetch_result.get("error"),
            })
        except Exception as e:
            connector_results.append({
                "connector_id": connector_id,
                "name": source.get("display_name") or source.get("identifier"),
                "source_label": source_label,
                "source_type": source.get("source_type"),
                "ok": False,
                "fetched": 0,
                "inserted": 0,
                "error": str(e),
            })

    if not scoped_ids:
        raise HTTPException(status_code=404, detail="No connectors found for this request")

    scope = requested_scope
    start_date = req.start_date
    end_date = req.end_date
    if scope == "days":
        days = req.days if isinstance(req.days, int) else 7
        days = max(1, min(days, 3650))
        start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        end_date = None
    elif scope == "range":
        if not start_date and not end_date:
            raise HTTPException(status_code=400, detail="Provide start_date or end_date for range scope")
    else:
        scope = "full"
        start_date = None
        end_date = None

    import_result: Dict[str, Any] = {"imported": 0, "skipped": 0}
    import_error: Optional[str] = None
    post_process_error: Optional[str] = None

    try:
        import_result = feedback_crm.fi_import_from_cxm(
            current_user["tenant_id"],
            current_user["user_id"],
            source_ids=scoped_ids,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as e:
        import_error = str(e)
        logger.exception("[FI Fetch] Import from CXM failed for tenant=%s user=%s", current_user["tenant_id"], current_user["user_id"])

    # Manual CRM fetch/import ends here.
    # CRM analysis is triggered separately by the dedicated CRM analysis flow.

    has_successful_fetch = any(bool(item.get("ok")) for item in connector_results)
    status = "success"
    if import_error or post_process_error:
        status = "partial_success" if has_successful_fetch else "error"
    elif not has_successful_fetch:
        status = "error"

    try:
        feedback_crm.fi_record_fetch_run(
            current_user["tenant_id"],
            current_user["user_id"],
            scope=scope,
            source_ids=scoped_ids,
            start_date=start_date,
            end_date=end_date,
            fetched_count=sum(int(item.get("fetched", 0) or 0) for item in connector_results),
            imported_count=int(import_result.get("imported", 0) or 0),
            skipped_count=int(import_result.get("skipped", 0) or 0),
            status=status,
            connector_results=connector_results,
            metadata={
                "import_error": import_error,
                "post_process_error": post_process_error,
            },
        )
    except Exception:
        logger.exception("[FI Fetch] Failed to record CRM fetch run")

    return {
        "status": status,
        "connectors": connector_results,
        "imported": int(import_result.get("imported", 0) or 0),
        "skipped": int(import_result.get("skipped", 0) or 0),
        "import_error": import_error,
        "post_process_error": post_process_error,
        "filters": {
            "scope": scope,
            "source_ids": scoped_ids,
            "start_date": start_date,
            "end_date": end_date,
        },
    }


@app.post("/api/fi/connectors/{connector_id}/interval")
async def fi_set_connector_interval(
    connector_id: int,
    req: FIConnectorIntervalRequest,
    current_user: dict = Depends(get_current_user),
):
    interval = (req.fetch_interval or "").strip().lower()
    if interval not in VALID_FETCH_INTERVALS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid fetch_interval. Use one of: {', '.join(sorted(VALID_FETCH_INTERVALS))}",
        )

    _require_fi_connector_access(connector_id, current_user)
    ok = cxm_update_source(
        connector_id,
        current_user["user_id"],
        current_user["tenant_id"],
        fetch_interval=interval,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Connector not found")

    if interval == "manual":
        cxm_scheduler.remove_source_job(connector_id)
    else:
        cxm_scheduler.schedule_source(connector_id, interval)

    return {
        "status": "success",
        "connector_id": connector_id,
        "fetch_interval": interval,
    }


@app.post("/api/fi/connectors/{connector_id}/analysis-interval")
async def fi_set_connector_analysis_interval(
    connector_id: int,
    req: FIConnectorAnalysisIntervalRequest,
    current_user: dict = Depends(get_current_user),
):
    interval = (req.analysis_interval or "").strip().lower()
    if interval not in VALID_FETCH_INTERVALS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid analysis_interval. Use one of: {', '.join(sorted(VALID_FETCH_INTERVALS))}",
        )

    _require_fi_connector_access(connector_id, current_user)
    ok = cxm_update_source(
        connector_id,
        current_user["user_id"],
        current_user["tenant_id"],
        analysis_interval=interval,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Connector not found")

    return {
        "status": "success",
        "connector_id": connector_id,
        "analysis_interval": interval,
    }


@app.post("/api/fi/connectors/{connector_id}/csv-upload")
async def fi_upload_csv_for_connector(
    connector_id: int,
    file: UploadFile = File(...),
    content_col: Optional[str] = Form(None),
    score_col: Optional[str] = Form(None),
    date_col: Optional[str] = Form(None),
    author_col: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    source = _require_fi_connector_access(connector_id, current_user)
    source_type = str(source.get("source_type") or "").strip().lower()
    if source_type != "csv":
        raise HTTPException(status_code=400, detail="CSV upload is only supported for CSV connectors")

    parsed = await upload_csv(
        file=file,
        content_col=content_col,
        score_col=score_col,
        date_col=date_col,
        author_col=author_col,
    )

    if isinstance(parsed, JSONResponse):
        detail: Any = "CSV parsing failed"
        try:
            detail_obj = json.loads((parsed.body or b"{}").decode("utf-8", errors="ignore"))
            detail = detail_obj.get("message") or detail_obj
        except Exception:
            pass
        raise HTTPException(status_code=parsed.status_code, detail=detail)

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=500, detail="Unexpected CSV parser response")

    reviews = parsed.get("reviews") or []
    if not isinstance(reviews, list) or not reviews:
        raise HTTPException(status_code=400, detail="No valid rows found in uploaded CSV")

    inserted = cxm_insert_reviews(
        connector_id,
        current_user["user_id"],
        current_user["tenant_id"],
        reviews,
    )
    cxm_update_last_fetched(connector_id)

    return {
        "status": "success",
        "connector_id": connector_id,
        "parsed": len(reviews),
        "inserted": int(inserted or 0),
    }


def _parse_source_ids_param(source_ids: Optional[str]) -> List[int]:
    if not source_ids:
        return []
    parsed: List[int] = []
    for part in source_ids.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            sid = int(part)
        except ValueError:
            continue
        if sid > 0:
            parsed.append(sid)
    return parsed


def _parse_rating_values_param(rating_values: Optional[str]) -> List[int]:
    if not rating_values:
        return []
    parsed: List[int] = []
    seen = set()
    for part in rating_values.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            rating = int(part)
        except ValueError:
            continue
        if rating < 1 or rating > 5 or rating in seen:
            continue
        seen.add(rating)
        parsed.append(rating)
    return parsed


def _parse_feedback_ids_param(feedback_ids: Optional[str]) -> List[int]:
    if not feedback_ids:
        return []
    parsed: List[int] = []
    seen = set()
    for part in feedback_ids.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            feedback_id = int(part)
        except ValueError:
            continue
        if feedback_id <= 0 or feedback_id in seen:
            continue
        seen.add(feedback_id)
        parsed.append(feedback_id)
    return parsed


def _filter_feedback_crm_source_ids(source_ids: List[int], current_user: dict) -> List[int]:
    allowed: List[int] = []
    seen = set()
    for sid in source_ids:
        if sid in seen:
            continue
        seen.add(sid)
        source = cxm_get_source(sid, current_user["user_id"], current_user["tenant_id"])
        if not source:
            continue
        if not _is_fi_scope_allowed(_extract_connector_scope(source.get("config"))):
            continue
        allowed.append(sid)
    return allowed


@app.get("/api/fi/analysis/reviews")
async def fi_analysis_reviews(
    source_id: Optional[int] = None,
    sentiment: Optional[str] = None,
    churn_risk: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[str] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    if source_id is None:
        raise HTTPException(status_code=400, detail="source_id is required for Feedback CRM review history")
    source = _require_fi_connector_access(source_id, current_user)
    scoped_source_id = source["id"]

    reviews = feedback_crm.fi_get_analysis_reviews(
        current_user["tenant_id"],
        source_id=scoped_source_id,
        sentiment=sentiment,
        churn_risk=churn_risk,
        rating=rating,
        rating_values=_parse_rating_values_param(rating_values),
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
        limit=max(1, min(limit, 1000)),
        offset=max(0, offset),
    )
    return {"reviews": reviews, "count": len(reviews)}


@app.get("/api/fi/analysis/trends")
async def fi_analysis_trends(
    period: str = "day",
    days: int = 30,
    feedback_ids: Optional[str] = None,
    source_ids: Optional[str] = None,
    source: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[str] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    requested_ids = _parse_source_ids_param(source_ids)
    scoped_ids = _filter_feedback_crm_source_ids(requested_ids, current_user) if requested_ids else None
    if requested_ids and not scoped_ids:
        return {"trends": [], "count": 0}

    trends = feedback_crm.fi_get_analysis_trends(
        current_user["tenant_id"],
        feedback_ids=_parse_feedback_ids_param(feedback_ids),
        source_ids=scoped_ids,
        source=source,
        period=period,
        days=max(1, min(days, 3650)),
        rating=rating,
        rating_values=_parse_rating_values_param(rating_values),
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
    )
    return {"trends": trends, "count": len(trends)}


@app.get("/api/fi/analysis/summary")
async def fi_analysis_summary(
    feedback_ids: Optional[str] = None,
    source_ids: Optional[str] = None,
    source: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[str] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    requested_ids = _parse_source_ids_param(source_ids)
    scoped_ids = _filter_feedback_crm_source_ids(requested_ids, current_user) if requested_ids else None
    if requested_ids and not scoped_ids:
        return {
            "total_reviews": 0,
            "avg_sentiment": 0,
            "avg_churn": 0,
            "positive_count": 0,
            "neutral_count": 0,
            "negative_count": 0,
            "high_churn": 0,
            "medium_churn": 0,
            "low_churn": 0,
            "top_themes": [],
            "top_pain_points": [],
            "churn_intent_clusters": [],
            "user_segments": [],
            "growth_opportunities": [],
            "main_problem_to_fix": {
                "pain_point": "none",
                "impact_score": 0.0,
                "affected_reviews": 0,
                "avg_churn_probability": 0.0,
                "why_now": "No feedback available for selected connectors.",
            },
        }

    summary = feedback_crm.fi_get_analysis_summary(
        current_user["tenant_id"],
        feedback_ids=_parse_feedback_ids_param(feedback_ids),
        source_ids=scoped_ids,
        source=source,
        rating=rating,
        rating_values=_parse_rating_values_param(rating_values),
        rating_min=rating_min,
        rating_max=rating_max,
        start_date=start_date,
        end_date=end_date,
    )
    return summary


@app.get("/api/fi/knowledge-base/offers")
async def fi_list_knowledge_base_offers(
    segment: Optional[str] = None,
    active_only: bool = False,
    limit: int = 200,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    return feedback_crm.fi_list_offer_knowledge_base(
        current_user["tenant_id"],
        segment=segment,
        active_only=active_only,
        limit=max(1, min(limit, 500)),
        offset=max(0, offset),
    )


@app.get("/api/fi/knowledge-base/audiences")
async def fi_list_knowledge_base_audiences(current_user: dict = Depends(get_current_user)):
    return feedback_crm.fi_list_offer_audiences(current_user["tenant_id"])


@app.get("/api/fi/knowledge-base/email-connector")
async def fi_get_knowledge_base_email_connector(current_user: dict = Depends(get_current_user)):
    return feedback_crm.fi_get_email_connector(current_user["tenant_id"])


@app.post("/api/fi/knowledge-base/email-connector")
async def fi_upsert_knowledge_base_email_connector(
    req: FIKnowledgeBaseEmailConnectorUpsert,
    current_user: dict = Depends(get_current_user),
):
    try:
        return feedback_crm.fi_upsert_email_connector(
            current_user["tenant_id"],
            req.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/fi/knowledge-base/offers")
async def fi_create_knowledge_base_offer(
    req: FIKnowledgeBaseOfferCreate,
    current_user: dict = Depends(get_current_user),
):
    try:
        offer_id = feedback_crm.fi_create_offer_knowledge_base(
            current_user["tenant_id"],
            req.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"id": offer_id, "status": "created"}


@app.patch("/api/fi/knowledge-base/offers/{offer_id}")
async def fi_update_knowledge_base_offer(
    offer_id: int,
    req: FIKnowledgeBaseOfferUpdate,
    current_user: dict = Depends(get_current_user),
):
    update_payload = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_payload:
        raise HTTPException(status_code=400, detail="No fields provided for update")
    try:
        ok = feedback_crm.fi_update_offer_knowledge_base(
            offer_id,
            current_user["tenant_id"],
            update_payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"status": "updated", "id": offer_id}


@app.delete("/api/fi/knowledge-base/offers/{offer_id}")
async def fi_delete_knowledge_base_offer(
    offer_id: int,
    current_user: dict = Depends(get_current_user),
):
    ok = feedback_crm.fi_delete_offer_knowledge_base(offer_id, current_user["tenant_id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"status": "deleted", "id": offer_id}


@app.post("/api/fi/knowledge-base/offers/send-email")
async def fi_send_knowledge_base_offer_email(
    req: FIKnowledgeBaseOfferSendRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        return feedback_crm.fi_send_offer_email(
            current_user["tenant_id"],
            req.offer_id,
            segment=req.segment,
            customer_identifiers=req.customer_identifiers,
            subject=req.subject,
            message=req.message,
        )
    except ValueError as e:
        detail = str(e)
        if detail == "Offer not found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=422, detail=detail)


# ── Feedback Inbox ───────────────────────────────────────────────────────────

@app.get("/api/fi/feedback")
async def fi_feedback_list(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    rating: Optional[int] = None,
    rating_values: Optional[str] = None,
    sentiment: Optional[str] = None,
    source: Optional[str] = None,
    issue_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    return feedback_crm.fi_list_feedback(
        current_user["tenant_id"],
        status=status,
        priority=priority,
        rating=rating,
        rating_values=_parse_rating_values_param(rating_values),
        sentiment=sentiment,
        source=source,
        issue_id=issue_id, customer_id=customer_id, search=search,
        start_date=start_date, end_date=end_date,
        limit=max(1, min(limit, 5000)), offset=max(0, offset),
    )

@app.get("/api/fi/feedback/{feedback_id}")
async def fi_feedback_get(feedback_id: int, current_user: dict = Depends(get_current_user)):
    fb = feedback_crm.fi_get_feedback(feedback_id, current_user["tenant_id"])
    if not fb:
        raise HTTPException(404, "Feedback not found")
    return fb


@app.post("/api/fi/feedback/{feedback_id}/agentic-outreach")
async def fi_feedback_agentic_outreach(
    feedback_id: int,
    req: Optional[FIAgenticOutreachRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    req = req or FIAgenticOutreachRequest()
    result = feedback_crm.fi_generate_agentic_outreach(
        feedback_id,
        current_user["tenant_id"],
        persist=bool(req.persist),
        auto_generated=False,
    )
    if result.get("status") == "error":
        detail = result.get("detail") or "Unable to generate outreach draft"
        if str(detail).lower() == "feedback not found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    return result

@app.post("/api/fi/feedback")
async def fi_feedback_create(req: FIFeedbackCreate, current_user: dict = Depends(get_current_user)):
    fid = feedback_crm.fi_create_feedback(
        current_user["tenant_id"], req.text,
        sentiment=req.sentiment, source=req.source,
        customer_identifier=req.customer_identifier,
        issue_id=req.issue_id, priority=req.priority,
    )
    return {"id": fid, "status": "created"}

@app.patch("/api/fi/feedback/{feedback_id}/status")
async def fi_feedback_update_status(feedback_id: int, req: FIStatusUpdate, current_user: dict = Depends(get_current_user)):
    ok = feedback_crm.fi_update_feedback_status(feedback_id, current_user["tenant_id"], req.status)
    if not ok:
        raise HTTPException(404, "Feedback not found")
    return {"status": "updated"}

@app.patch("/api/fi/feedback/{feedback_id}/priority")
async def fi_feedback_update_priority(feedback_id: int, req: FIPriorityUpdate, current_user: dict = Depends(get_current_user)):
    ok = feedback_crm.fi_update_feedback_priority(feedback_id, current_user["tenant_id"], req.priority)
    if not ok:
        raise HTTPException(404, "Feedback not found")
    return {"status": "updated"}


# ── Issue Tracking ───────────────────────────────────────────────────────────

@app.get("/api/fi/issues")
async def fi_issues_list(
    status: Optional[str] = None,
    sort_by: str = "impact_score",
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    return feedback_crm.fi_list_issues(
        current_user["tenant_id"], status=status, sort_by=sort_by,
        limit=limit, offset=offset,
    )

@app.get("/api/fi/issues/{issue_id}")
async def fi_issue_detail(issue_id: int, current_user: dict = Depends(get_current_user)):
    detail = feedback_crm.fi_get_issue_detail(issue_id, current_user["tenant_id"])
    if not detail:
        raise HTTPException(404, "Issue not found")
    return detail

@app.post("/api/fi/issues")
async def fi_issue_create(req: FIIssueCreate, current_user: dict = Depends(get_current_user)):
    iid = feedback_crm.fi_create_issue(current_user["tenant_id"], req.name, req.description)
    return {"id": iid, "status": "created"}

@app.patch("/api/fi/issues/{issue_id}/status")
async def fi_issue_update_status(issue_id: int, req: FIStatusUpdate, current_user: dict = Depends(get_current_user)):
    ok = feedback_crm.fi_update_issue_status(issue_id, current_user["tenant_id"], req.status)
    if not ok:
        raise HTTPException(404, "Issue not found")
    return {"status": "updated"}

@app.post("/api/fi/feedback/link-issue")
async def fi_link_feedback_issue(req: FILinkFeedback, current_user: dict = Depends(get_current_user)):
    ok = feedback_crm.fi_link_feedback_to_issue(req.feedback_id, req.issue_id, current_user["tenant_id"])
    if not ok:
        raise HTTPException(404, "Feedback not found")
    return {"status": "linked"}


# ── Customers ────────────────────────────────────────────────────────────────

@app.get("/api/fi/customers")
async def fi_customers_list(
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    return feedback_crm.fi_list_customers(
        current_user["tenant_id"], search=search, sentiment=sentiment,
        limit=limit, offset=offset,
    )

@app.get("/api/fi/customers/{customer_id}")
async def fi_customer_get(customer_id: int, current_user: dict = Depends(get_current_user)):
    cust = feedback_crm.fi_get_customer(customer_id, current_user["tenant_id"])
    if not cust:
        raise HTTPException(404, "Customer not found")
    return cust

@app.get("/api/fi/customers/{customer_id}/timeline")
async def fi_customer_timeline(customer_id: int, current_user: dict = Depends(get_current_user)):
    result = feedback_crm.fi_get_customer_timeline(customer_id, current_user["tenant_id"])
    if not result:
        raise HTTPException(404, "Customer not found")
    return result


# ── Product Health Dashboard ─────────────────────────────────────────────────

@app.get("/api/fi/dashboard")
async def fi_dashboard(current_user: dict = Depends(get_current_user)):
    return feedback_crm.fi_product_health(current_user["tenant_id"])


# ── Refresh Scores & Trends ─────────────────────────────────────────────────

@app.post("/api/fi/refresh")
async def fi_refresh_all(current_user: dict = Depends(get_current_user)):
    feedback_crm.fi_recalculate_all_issues(current_user["tenant_id"])
    feedback_crm.fi_refresh_trends(current_user["tenant_id"])
    return {"status": "refreshed"}


def run_fi_analysis_background(
    task_id: str,
    tenant_id: int,
    user_id: int,
    feedback_ids: Optional[List[int]],
    source: Optional[str],
    source_ids: Optional[List[int]],
    start_date: Optional[str],
    end_date: Optional[str],
    rating: Optional[int],
    rating_values: Optional[List[int]],
    rating_min: Optional[int],
    rating_max: Optional[int],
    status: Optional[str],
    limit: Optional[int],
    offset: Optional[int],
    vertical: str,
):
    stop_event = threading.Event()
    pause_event = threading.Event()
    analysis_run_id: Optional[int] = None

    with _tasks_lock:
        task_controls[task_id] = {'stop': stop_event, 'pause': pause_event}

    try:
        feedback_rows = feedback_crm.fi_get_feedback_records_for_analysis(
            tenant_id,
            feedback_ids=feedback_ids,
            source=source,
            source_ids=source_ids,
            start_date=start_date,
            end_date=end_date,
            rating=rating,
            rating_values=rating_values,
            rating_min=rating_min,
            rating_max=rating_max,
            status=status,
            limit=limit,
            offset=offset,
        )
        total_reviews = len(feedback_rows)
        analysis_run_id = feedback_crm.fi_create_analysis_run(
            tenant_id,
            user_id,
            source=source,
            source_ids=source_ids,
            start_date=start_date,
            end_date=end_date,
            total_reviews=total_reviews,
            metadata={
                "task_id": task_id,
                "vertical": vertical or "generic",
                "feedback_ids_count": len(feedback_ids or []),
                "rating": rating,
                "rating_values": rating_values or [],
                "rating_min": rating_min,
                "rating_max": rating_max,
                "status": status,
                "limit": limit,
                "offset": offset,
            },
        )
        if total_reviews == 0:
            feedback_crm.fi_finish_analysis_run(
                analysis_run_id,
                tenant_id,
                status="completed",
                analyzed_reviews=0,
                summary=feedback_crm.fi_get_analysis_summary(
                    tenant_id,
                    feedback_ids=feedback_ids,
                    source_ids=source_ids,
                    source=source,
                    rating=rating,
                    rating_values=rating_values,
                    rating_min=rating_min,
                    rating_max=rating_max,
                    start_date=start_date,
                    end_date=end_date,
                ),
                trends=[],
                metadata={"message": "No feedback matched this analysis request."},
            )
            _set_task(
                task_id,
                {
                    "status": "completed",
                    "progress": 100,
                    "message": "No feedback matched this analysis request.",
                    "processed_reviews": 0,
                    "total_reviews": 0,
                    "fetched_reviews": 0,
                    "analyzed_reviews": 0,
                    "fallback_reviews": 0,
                    "unresolved_reviews": 0,
                    "dropped_reviews": 0,
                    "in_flight_reviews": 0,
                    "coverage_pct": 0.0,
                },
                append_log="No feedback matched this analysis request.",
            )
            return

        reviews_for_analysis = [
            {
                "id": f"fi_{row['id']}",
                "content": row.get("text", ""),
                "score": row.get("rating", 3) or 3,
                "author": row.get("customer_identifier") or "Anonymous",
                "source": row.get("source") or "feedback_crm",
                "source_type": row.get("source_type") or "feedback_crm",
                "customer_identifier": row.get("customer_identifier") or "",
                "at": "",
            }
            for row in feedback_rows
        ]

        _set_task(
            task_id,
            {
                "status": "analyzing",
                "progress": 10,
                "message": "Preparing Feedback CRM records for analysis...",
                "processed_reviews": 0,
                "total_reviews": total_reviews,
                "fetched_reviews": total_reviews,
                "analyzed_reviews": 0,
                "fallback_reviews": 0,
                "unresolved_reviews": 0,
                "dropped_reviews": 0,
                "in_flight_reviews": total_reviews,
                "coverage_pct": 0.0,
            },
            append_log="Preparing Feedback CRM records for analysis...",
        )

        cleaned_reviews = []
        for i, review in enumerate(reviews_for_analysis):
            raw_text = review.get("content") or review.get("text") or review.get("body") or review.get("review", "")
            try:
                rating_value = int(float(review.get("score", 3) or 3))
            except Exception:
                rating_value = 3
            cleaning_options = {
                "token_efficiency": True,
                "magic_clean": True,
                "language_focus": False,
                "html_shield": True,
                "crm_mode": True,
            }
            adv = processor.advanced_clean_review(raw_text, rating=rating_value, options=cleaning_options)
            cleaned = adv.get("cleaned_text", "")
            clean_flags = list(adv.get("flags", []) or [])
            if not cleaned and "non_english_filtered" not in clean_flags:
                cleaned = processor.clean_review_text(raw_text)
            if len(str(cleaned or "").strip()) < processor.MIN_REVIEW_CHAR_LENGTH and "non_english_filtered" not in clean_flags:
                cleaned = str(raw_text or "").strip()[:processor.MAX_PROMPT_REVIEW_CHARS] or "No text provided"

            cleaned_reviews.append({
                **review,
                "content": str(raw_text or ""),
                "_precleaned_content": cleaned,
                "_preclean_noise_score": float(adv.get("noise_score", 0.0) or 0.0),
                "_preclean_flags": clean_flags,
                "_preclean_token_estimate": int(adv.get("token_estimate", 0) or 0),
                "_cleaning_options": cleaning_options,
            })

            if total_reviews > 50 and i % max(1, total_reviews // 10) == 0:
                if stop_event.is_set():
                    feedback_crm.fi_finish_analysis_run(
                        analysis_run_id,
                        tenant_id,
                        status="cancelled",
                        analyzed_reviews=len(cleaned_reviews),
                        metadata={"stage": "cleaning", "message": "Analysis cancelled during CRM cleaning."},
                    )
                    _set_task(
                        task_id,
                        {
                            "status": "cancelled",
                            "progress": 100,
                            "message": "Analysis stopped by user",
                        },
                        append_log="Analysis cancelled during CRM cleaning.",
                    )
                    return
                while pause_event.is_set():
                    if stop_event.is_set():
                        feedback_crm.fi_finish_analysis_run(
                            analysis_run_id,
                            tenant_id,
                            status="cancelled",
                            analyzed_reviews=len(cleaned_reviews),
                            metadata={"stage": "cleaning", "message": "Analysis cancelled while paused during CRM cleaning."},
                        )
                        _set_task(
                            task_id,
                            {
                                "status": "cancelled",
                                "progress": 100,
                                "message": "Analysis stopped by user",
                            },
                            append_log="Analysis cancelled while paused during CRM cleaning.",
                        )
                        return
                    time.sleep(0.5)
                msg = f"Cleaning Feedback CRM record {i}/{total_reviews}..."
                _set_task(
                    task_id,
                    {
                        "status": "paused" if pause_event.is_set() else "initializing",
                        "progress": min(15, 5 + int((i / max(total_reviews, 1)) * 10)),
                        "message": msg,
                        "processed_reviews": i,
                        "total_reviews": total_reviews,
                        "fetched_reviews": total_reviews,
                        "analyzed_reviews": 0,
                        "fallback_reviews": 0,
                        "unresolved_reviews": 0,
                        "dropped_reviews": 0,
                        "in_flight_reviews": total_reviews,
                        "coverage_pct": 0.0,
                    },
                    append_log=msg,
                )

        if not cleaned_reviews:
            feedback_crm.fi_finish_analysis_run(
                analysis_run_id,
                tenant_id,
                status="failed",
                analyzed_reviews=0,
                metadata={"message": "No valid Feedback CRM records remained after cleaning."},
            )
            _set_task(
                task_id,
                {
                    "status": "failed",
                    "progress": 100,
                    "message": "No valid Feedback CRM records remained after cleaning.",
                },
                append_log="No valid Feedback CRM records remained after cleaning.",
            )
            return

        def progress_cb(pct, msg, meta=None):
            patch = {
                "status": "paused" if pause_event.is_set() else ("stopping" if stop_event.is_set() else "analyzing"),
                "progress": min(_safe_progress_value(pct), 90),
                "message": msg,
            }
            if isinstance(meta, dict):
                patch.update({
                    "processed_reviews": int(meta.get("processed_reviews", 0) or 0),
                    "total_reviews": int(meta.get("total_reviews", total_reviews) or total_reviews),
                    "fetched_reviews": int(meta.get("fetched_reviews", total_reviews) or total_reviews),
                    "analyzed_reviews": int(meta.get("analyzed_reviews", 0) or 0),
                    "fallback_reviews": int(meta.get("fallback_reviews", 0) or 0),
                    "unresolved_reviews": int(meta.get("unresolved_reviews", 0) or 0),
                    "dropped_reviews": int(meta.get("dropped_reviews", 0) or 0),
                    "in_flight_reviews": int(meta.get("in_flight_reviews", 0) or 0),
                    "coverage_pct": round(float(meta.get("coverage_pct", 0.0) or 0.0), 2),
                })
            _set_task(task_id, patch, append_log=msg)

        llm_probe_ok = True
        llm_probe_error = ""
        llm_health = processor.check_llm_connectivity(
            timeout_seconds=max(20, int(getattr(settings, "OLLAMA_PREFLIGHT_TIMEOUT_SECONDS", 30) or 30)),
            force_refresh=True,
        )
        if not llm_health.get("ok"):
            llm_probe_ok = False
            llm_probe_error = str(llm_health.get("error") or "unknown preflight error")
            degraded_msg = (
                "LLM tunnel probe failed. Continuing in standby mode while the tunnel recovers."
            )
            _set_task(
                task_id,
                {
                    "status": "analyzing",
                    "progress": 15,
                    "message": degraded_msg,
                },
                append_log=f"{degraded_msg} Probe error: {llm_probe_error}",
            )

        if llm_probe_ok:
            results = processor.run_analysis_batch(
                cleaned_reviews,
                vertical or "generic",
                None,
                progress_cb,
                stop_event,
                pause_event,
                "feedback_crm",
            )
        else:
            results = processor.run_fallback_analysis_batch(
                cleaned_reviews,
                progress_callback=progress_cb,
                reason="llm_preflight_unavailable_fallback",
            )

        fallback_reviews = sum(
            1
            for r in results
            if bool(r.get("_meta_fallback"))
            or "fallback" in str(r.get("_meta_reason") or "").lower()
        )
        unresolved_reviews = sum(1 for r in results if bool(r.get("_meta_error")))
        dropped_reviews = max(total_reviews - len(results), 0)

        _set_task(
            task_id,
            {
                "status": "finalizing",
                "progress": 92,
                "message": "Applying Feedback CRM insights and refreshing issue views...",
            },
            append_log="Applying Feedback CRM insights and refreshing issue views...",
        )

        apply_summary = feedback_crm.fi_apply_analysis_results(
            tenant_id,
            results,
            analysis_run_id=analysis_run_id,
        )
        feedback_crm.fi_recalculate_all_issues(tenant_id)
        feedback_crm.fi_refresh_trends(tenant_id)
        usage_tokens = int(sum(int(r.get("_meta_tokens", 0) or 0) for r in results) or 0)
        usage_prefs = get_llm_preferences(user_id, tenant_id)
        billing_enabled = bool(usage_prefs.get("billing_enabled", True))
        billable_tokens = usage_tokens if billing_enabled else 0
        track_analysis_usage(
            user_id=user_id,
            tenant_id=tenant_id,
            analysis_id=None,
            reviews_count=len(results),
            cost=_estimate_llm_cost(usage_tokens, billing_enabled),
            vertical=vertical or "generic",
            total_tokens=usage_tokens,
            billable_tokens=billable_tokens,
            llm_enabled_snapshot=True,
        )
        summary_snapshot = feedback_crm.fi_get_analysis_summary(
            tenant_id,
            feedback_ids=feedback_ids,
            source_ids=source_ids,
            source=source,
            rating=rating,
            rating_values=rating_values,
            rating_min=rating_min,
            rating_max=rating_max,
            start_date=start_date,
            end_date=end_date,
        )
        trend_snapshot = feedback_crm.fi_get_analysis_trends(
            tenant_id,
            feedback_ids=feedback_ids,
            source_ids=source_ids,
            source=source,
            rating=rating,
            rating_values=rating_values,
            rating_min=rating_min,
            rating_max=rating_max,
            start_date=start_date,
            end_date=end_date,
            period="day",
            days=30,
        )
        final_status = "cancelled" if stop_event.is_set() else "completed"
        feedback_crm.fi_finish_analysis_run(
            analysis_run_id,
            tenant_id,
            status=final_status,
            analyzed_reviews=len(results),
            fallback_reviews=fallback_reviews,
            unresolved_reviews=unresolved_reviews,
            dropped_reviews=dropped_reviews,
            total_tokens=usage_tokens,
            billable_tokens=billable_tokens,
            summary=summary_snapshot,
            trends=trend_snapshot,
            metadata={
                "task_id": task_id,
                "apply_summary": apply_summary,
                "vertical": vertical or "generic",
                "stopped": bool(stop_event.is_set()),
                "llm_probe_ok": llm_probe_ok,
                "llm_probe_error": llm_probe_error,
            },
        )

        if stop_event.is_set():
            summary_msg = (
                f"Feedback CRM analysis stopped after processing {len(results)} records. "
                f"Saved partial results for {apply_summary.get('updated_feedback', 0)} feedback rows."
            )
        else:
            summary_msg = (
                f"Feedback CRM analysis completed for {len(results)} records. "
                f"Updated {apply_summary.get('updated_feedback', 0)} feedback rows and refreshed issue views."
            )
        _set_task(
            task_id,
            {
                "status": final_status,
                "progress": 100,
                "message": summary_msg,
                "processed_reviews": len(results),
                "total_reviews": total_reviews,
                "fetched_reviews": total_reviews,
                "analyzed_reviews": len(results),
                "fallback_reviews": fallback_reviews,
                "unresolved_reviews": unresolved_reviews,
                "dropped_reviews": dropped_reviews,
                "in_flight_reviews": 0,
                "coverage_pct": round((len(results) / max(total_reviews, 1)) * 100, 2),
                "fi_summary": apply_summary,
                "analysis_run_id": analysis_run_id,
            },
            append_log=summary_msg,
        )
    except Exception as e:
        if analysis_run_id:
            try:
                feedback_crm.fi_finish_analysis_run(
                    analysis_run_id,
                    tenant_id,
                    status="failed",
                    metadata={"task_id": task_id, "error": str(e)},
                )
            except Exception:
                logger.exception("[FI Analysis] Failed to finalize CRM analysis run after error")
        _set_task(
            task_id,
            {
                "status": "failed",
                "progress": 100,
                "message": f"Feedback CRM analysis failed: {e}",
            },
            append_log=f"Feedback CRM analysis failed: {e}",
        )
    finally:
        with _tasks_lock:
            task_controls.pop(task_id, None)
        _unregister_user_task(user_id, task_id)


@app.post("/api/fi/analyze")
async def fi_analyze_feedback(
    req: Optional[FIAnalyzeRequest] = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user),
):
    if not _llm_enabled_for_user(current_user["user_id"], current_user.get("tenant_id")):
        raise HTTPException(status_code=403, detail="LLM usage is disconnected for this account. Reconnect it in settings to run CRM analysis.")
    llm_preflight_warning: Optional[str] = None
    llm_health = await asyncio.to_thread(processor.check_llm_connectivity)
    if not llm_health.get("ok"):
        llm_health = await asyncio.to_thread(
            processor.check_llm_connectivity,
            max(20, int(getattr(settings, "OLLAMA_PREFLIGHT_TIMEOUT_SECONDS", 30) or 30)),
            True,
        )
    if not llm_health.get("ok"):
        error_detail = llm_health.get("error") or "Endpoint did not pass analysis probe."
        llm_preflight_warning = (
            "LLM tunnel probe failed before analysis start. "
            "Continuing in standby mode while the tunnel recovers."
        )
        logger.warning("[FI Analysis] %s Probe error: %s", llm_preflight_warning, error_detail)
    req = req or FIAnalyzeRequest()
    user_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]

    if _user_has_active_analysis(user_id):
        raise HTTPException(status_code=429, detail="You already have an analysis in progress. Please wait for it to finish.")

    task_id = str(uuid.uuid4())
    _register_user_task(user_id, task_id)
    _set_task(
        task_id,
        {
            "status": "initializing",
            "progress": 0,
            "message": (
                "Queueing Feedback CRM analysis..."
                if not llm_preflight_warning
                else "Queueing Feedback CRM analysis (degraded mode enabled)..."
            ),
            "processed_reviews": 0,
            "total_reviews": 0,
            "fetched_reviews": 0,
            "analyzed_reviews": 0,
            "fallback_reviews": 0,
            "unresolved_reviews": 0,
            "dropped_reviews": 0,
            "in_flight_reviews": 0,
            "coverage_pct": 0.0,
        },
        append_log=(
            "Queueing Feedback CRM analysis..."
            if not llm_preflight_warning
            else "Queueing Feedback CRM analysis (degraded mode enabled)..."
        ),
    )
    if llm_preflight_warning:
        _set_task(
            task_id,
            {"llm_probe_warning": llm_preflight_warning},
            append_log=llm_preflight_warning,
        )

    scoped_source_ids = _filter_feedback_crm_source_ids(req.source_ids or [], current_user) if req.source_ids else None
    resolved_feedback_ids: Optional[List[int]] = None
    if isinstance(req.feedback_ids, list):
        deduped_feedback_ids: List[int] = []
        seen_feedback_ids = set()
        for raw_feedback_id in req.feedback_ids:
            try:
                feedback_id = int(raw_feedback_id)
            except Exception:
                continue
            if feedback_id <= 0 or feedback_id in seen_feedback_ids:
                continue
            seen_feedback_ids.add(feedback_id)
            deduped_feedback_ids.append(feedback_id)
        resolved_feedback_ids = deduped_feedback_ids or None

    resolved_limit = max(1, min(int(req.limit), 5000)) if req.limit else None
    resolved_offset = max(0, int(req.offset or 0))
    if resolved_feedback_ids:
        resolved_limit = None
        resolved_offset = 0
    resolved_rating_values: Optional[List[int]] = None
    if isinstance(req.rating_values, list):
        deduped: List[int] = []
        seen_ratings = set()
        for raw_rating in req.rating_values:
            try:
                rating_value = int(raw_rating)
            except Exception:
                continue
            if rating_value < 1 or rating_value > 5 or rating_value in seen_ratings:
                continue
            seen_ratings.add(rating_value)
            deduped.append(rating_value)
        resolved_rating_values = deduped or None

    if background_tasks is not None:
        background_tasks.add_task(
            run_fi_analysis_background,
            task_id,
            tenant_id,
            user_id,
            resolved_feedback_ids,
            req.source,
            scoped_source_ids,
            req.start_date,
            req.end_date,
            req.rating,
            resolved_rating_values,
            req.rating_min,
            req.rating_max,
            req.status,
            resolved_limit,
            resolved_offset,
            req.vertical or "generic",
        )
    else:
        asyncio.create_task(
            asyncio.to_thread(
                run_fi_analysis_background,
                task_id,
                tenant_id,
                user_id,
                resolved_feedback_ids,
                req.source,
                scoped_source_ids,
                req.start_date,
                req.end_date,
                req.rating,
                resolved_rating_values,
                req.rating_min,
                req.rating_max,
                req.status,
                resolved_limit,
                resolved_offset,
                req.vertical or "generic",
            )
        )

    return {
        "task_id": task_id,
        "status": "triggered",
        "message": "Feedback CRM analysis started",
    }


# ── AI Response Generation ───────────────────────────────────────────────────

@app.post("/api/fi/ai/generate-response")
async def fi_generate_response(req: FIGenerateResponseRequest, current_user: dict = Depends(get_current_user)):
    if not _llm_enabled_for_user(current_user["user_id"], current_user.get("tenant_id")):
        raise HTTPException(status_code=403, detail="LLM usage is disconnected for this account. Reconnect it in settings to generate AI responses.")
    result = feedback_crm.fi_generate_response(
        req.feedback_text, req.issue_name, req.issue_status,
        req.customer_name, req.response_type,
    )
    return result


# ── Import from existing CXM data ───────────────────────────────────────────

@app.post("/api/fi/import-cxm")
async def fi_import_cxm(
    req: Optional[FIImportCXMRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    req = req or FIImportCXMRequest()

    scope = (req.scope or "full").strip().lower()
    requested_ids = [int(x) for x in (req.source_ids or []) if isinstance(x, int) and x > 0]
    source_ids = _filter_feedback_crm_source_ids(requested_ids, current_user) if requested_ids else None
    start_date = req.start_date
    end_date = req.end_date

    if requested_ids and not source_ids:
        return {
            "imported": 0,
            "skipped": 0,
            "filters": {
                "scope": scope,
                "source_ids": [],
                "requested_source_ids": requested_ids,
                "start_date": start_date,
                "end_date": end_date,
            },
        }

    if scope == "days":
        days = req.days if isinstance(req.days, int) else 7
        days = max(1, min(days, 3650))
        start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        end_date = None
    elif scope == "range":
        if not start_date and not end_date:
            raise HTTPException(400, "Provide start_date or end_date for range scope")
    else:
        scope = "full"
        start_date = None
        end_date = None

    result = feedback_crm.fi_import_from_cxm(
        current_user["tenant_id"],
        current_user["user_id"],
        source_ids=source_ids,
        start_date=start_date,
        end_date=end_date,
    )
    result["filters"] = {
        "scope": scope,
        "source_ids": source_ids or [],
        "requested_source_ids": requested_ids,
        "start_date": start_date,
        "end_date": end_date,
    }
    return result


# ── Universal Connector Ingestion ────────────────────────────────────────────

@app.post("/api/fi/ingest/{connector_type}")
async def fi_ingest_data(connector_type: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Universal endpoint to ingest raw payload from any supported connector."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")
        
    try:
        if connector_type not in feedback_ingestion.MAPPERS:
            raise HTTPException(400, f"Unsupported connector type: {connector_type}")
            
        feedback_id = feedback_ingestion.process_feedback(current_user["tenant_id"], connector_type, payload)
        
        return {
            "status": "success",
            "message": "Feedback ingested and analyzed successfully",
            "feedback_id": feedback_id,
            "connector": connector_type
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Ingestion failed: {str(e)}")


# ── Admin Winback Draft ────────────────────────────────────────────────────

# --- Feedback Intelligence CRM v2 (Scalable Platform) ---

class FIV2IngestRequest(BaseModel):
    payload: Any


class FIV2BatchSyncRequest(BaseModel):
    config: Dict[str, Any] = {}
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    limit: int = 200


class FIV2ActionUpdateRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None


class FIV2LoopClosureRequest(BaseModel):
    action_id: int
    channel: str = "email"
    message: Optional[str] = None


@app.get("/api/fi/v2/integrations")
async def fi_v2_list_integrations(current_user: dict = Depends(get_current_user)):
    return fi_platform.list_integrations()


@app.post("/api/fi/v2/feedback")
async def fi_v2_ingest_feedback(req: FIV2IngestRequest, current_user: dict = Depends(get_current_user)):
    result = fi_platform.ingest_from_integration(
        current_user["tenant_id"],
        "api",
        payload=req.payload,
        run_pipeline=True,
    )
    return {"status": "success", **result}


@app.post("/api/fi/v2/webhooks/{integration}")
async def fi_v2_ingest_webhook(integration: str, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    try:
        result = fi_platform.ingest_from_integration(
            current_user["tenant_id"],
            integration,
            payload=payload,
            run_pipeline=True,
        )
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/fi/v2/connectors/{integration}/sync")
async def fi_v2_sync_connector(
    integration: str,
    req: FIV2BatchSyncRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        result = fi_platform.ingest_from_integration(
            current_user["tenant_id"],
            integration,
            config=req.config or {},
            start_date=req.start_date,
            end_date=req.end_date,
            limit=max(1, min(req.limit, 2000)),
            run_pipeline=True,
        )
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/fi/v2/ingest/csv")
async def fi_v2_ingest_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty")
    try:
        result = fi_platform.ingest_csv_feedback(current_user["tenant_id"], raw)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV ingestion failed: {e}")


@app.post("/api/fi/v2/ingest/email")
async def fi_v2_ingest_email(
    raw_email: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
):
    if not raw_email or not raw_email.strip():
        raise HTTPException(status_code=400, detail="raw_email is required")
    try:
        result = fi_platform.ingest_email_feedback(current_user["tenant_id"], raw_email)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email ingestion failed: {e}")


@app.post("/api/fi/v2/process")
async def fi_v2_process_pending(current_user: dict = Depends(get_current_user)):
    result = fi_platform.process_pending_feedback(current_user["tenant_id"])
    return {"status": "processed", **result}


@app.get("/api/fi/v2/actions")
async def fi_v2_actions(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    return fi_platform.list_action_items(
        current_user["tenant_id"],
        status=status,
        limit=max(1, min(limit, 200)),
        offset=max(0, offset),
    )


@app.patch("/api/fi/v2/actions/{action_id}")
async def fi_v2_update_action(
    action_id: int,
    req: FIV2ActionUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        ok = fi_platform.update_action_item(
            current_user["tenant_id"],
            action_id,
            status=req.status,
            assigned_to=req.assigned_to,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Action not found or no update fields provided")
        return {"status": "updated", "action_id": action_id}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/fi/v2/dashboard")
async def fi_v2_dashboard(days: int = 14, current_user: dict = Depends(get_current_user)):
    return fi_platform.get_dashboard(current_user["tenant_id"], days=days)


@app.get("/api/fi/v2/alerts")
async def fi_v2_alerts(limit: int = 50, current_user: dict = Depends(get_current_user)):
    return fi_platform.list_alerts(current_user["tenant_id"], limit=max(1, min(limit, 200)))


@app.post("/api/fi/v2/close-loop")
async def fi_v2_close_loop(req: FIV2LoopClosureRequest, current_user: dict = Depends(get_current_user)):
    try:
        return fi_platform.trigger_loop_closure(
            current_user["tenant_id"],
            action_id=req.action_id,
            channel=req.channel,
            message=req.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/fi/customers/{customer_id}/winback-draft")
async def api_fi_winback_draft(customer_id: int, current_user: dict = Depends(get_current_user)):
    if not _llm_enabled_for_user(current_user["user_id"], current_user.get("tenant_id")):
        raise HTTPException(status_code=403, detail="LLM usage is disconnected for this account. Reconnect it in settings to draft winback emails.")
    customer = feedback_crm.fi_get_customer_timeline(customer_id, current_user["tenant_id"])
    if not customer:
        raise HTTPException(404, "Customer not found")
        
    draft = draft_winback_email(customer, customer.get("timeline", []))
    return draft


if __name__ == "__main__":
    reload_enabled = os.getenv("UVICORN_RELOAD", "false").lower() in {"1", "true", "yes", "on"}
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=reload_enabled)
