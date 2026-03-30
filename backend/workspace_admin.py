import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from database import (
    calculate_billing_summary,
    get_access_code_profile,
    get_db_connection,
    get_llm_preferences,
    get_usage_stats,
    get_usage_trends,
    get_user_by_id,
    get_user_connectors,
    get_workspace_by_id,
    set_llm_preferences,
)

logger = logging.getLogger("hyzync.workspace_admin")

SECRET_CONFIG_KEYS = {
    "auth_value",
    "token",
    "client_secret",
    "password",
    "access_token",
    "api_key",
    "bearer_token",
    "webhook_secret",
}
VALID_INTERVALS = {"manual", "hourly", "daily", "weekly"}
VALID_THEME_MODES = {"light", "dark", "system"}
VALID_DIGEST_FREQUENCIES = {"off", "daily", "weekly"}
VALID_PLAN_STATUSES = {"active", "trialing", "past_due", "cancelled", "paused"}
VALID_EXPORT_FORMATS = {"zip", "csv", "json", "pdf"}
VALID_SECURITY_MODES = {"standard", "strict", "enterprise"}

DEFAULT_USER_PREFERENCES = {
    "contact_email": "",
    "company": "",
    "role": "",
    "notes": "",
    "theme_mode": "light",
    "timezone": "UTC",
    "digest_frequency": "weekly",
    "notify_analysis_complete": True,
    "notify_connector_failures": True,
    "notify_billing_updates": True,
}

DEFAULT_WORKSPACE_SETTINGS = {
    "locale": "en-US",
    "currency": "USD",
    "timezone": "UTC",
    "default_arpu": 50.0,
    "renewal_cycle": "monthly",
    "auto_sync_enabled": True,
    "auto_analysis_enabled": False,
    "daily_digest_enabled": True,
    "slack_webhook_url": "",
    "retention_target": 92.0,
    "export_format": "zip",
    "security_mode": "standard",
    "data_retention_days": 365,
}

DEFAULT_BILLING_ACCOUNT = {
    "plan_name": "Growth",
    "plan_status": "active",
    "currency": "USD",
    "seats": 5,
    "base_fee": 299.0,
    "per_seat_fee": 39.0,
    "token_budget": 250000,
    "overage_rate": 0.0015,
    "auto_renew": True,
    "payment_brand": "Visa",
    "payment_last4": "4242",
    "billing_address": "",
    "tax_id": "",
    "notes": "",
}

DOCUMENTATION_SEEDS = [
    {
        "slug": "getting-started-guide",
        "title": "Getting Started Guide",
        "category": "setup",
        "summary": "Launch a production workspace cleanly.",
        "icon": "Zap",
        "estimated_minutes": 5,
        "order_index": 10,
        "applicable_verticals": ["all"],
        "body": "# Getting Started\n\nCreate a dedicated workspace, connect stable sources, sync data, then run a calibrated first analysis.",
    },
    {
        "slug": "connecting-data-sources",
        "title": "Connecting Data Sources",
        "category": "connectors",
        "summary": "Run every connector like an owned service.",
        "icon": "Database",
        "estimated_minutes": 6,
        "order_index": 20,
        "applicable_verticals": ["all"],
        "body": "# Connector Operations\n\nSet a clear display name, keep identifiers stable, save intervals deliberately, and only replace secrets when you intend to rotate them.",
    },
    {
        "slug": "understanding-health-metrics",
        "title": "Understanding Health Metrics",
        "category": "analysis",
        "summary": "Produce defensible outputs with cleaner calibration.",
        "icon": "Cpu",
        "estimated_minutes": 6,
        "order_index": 30,
        "applicable_verticals": ["all"],
        "body": "# Analysis Playbook\n\nValidate the input window, confirm ARPU and renewal assumptions, then review executive, trust, and prioritization views in that order.",
    },
    {
        "slug": "workspace-settings",
        "title": "Workspace Settings",
        "category": "settings",
        "summary": "Standardize locale, retention targets, and exports.",
        "icon": "Settings",
        "estimated_minutes": 5,
        "order_index": 40,
        "applicable_verticals": ["all"],
        "body": "# Workspace Settings\n\nKeep timezone, currency, default ARPU, retention target, export format, and security mode aligned with the real team workflow.",
    },
    {
        "slug": "billing-and-invoices",
        "title": "Billing and Invoices",
        "category": "billing",
        "summary": "Track plan state, seats, usage, and invoice history.",
        "icon": "DollarSign",
        "estimated_minutes": 5,
        "order_index": 50,
        "applicable_verticals": ["all"],
        "body": "# Billing and Invoices\n\nEvery production workspace should expose plan metadata, AI usage cost, billing contacts, and invoice history in one place.",
    },
    {
        "slug": "security-and-governance",
        "title": "Security and Governance",
        "category": "security",
        "summary": "Protect secrets and keep exports audit-ready.",
        "icon": "Shield",
        "estimated_minutes": 5,
        "order_index": 60,
        "applicable_verticals": ["all"],
        "body": "# Security and Governance\n\nDo not paste secrets into notes, prefer strict or enterprise security modes, and keep retention rules aligned with policy.",
    },
    {
        "slug": "exporting-reports",
        "title": "Exporting Reports",
        "category": "api",
        "summary": "Use the authenticated operations endpoints safely.",
        "icon": "FileText",
        "estimated_minutes": 4,
        "order_index": 70,
        "applicable_verticals": ["all"],
        "body": "# API Reference\n\nUse the authenticated `/api/me`, workspace settings, billing, docs, and connector update endpoints for operational control.",
    },
]


def _copy_default(value: Any) -> Any:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, list):
        return list(value)
    return value


def _load_json(raw: Any, fallback: Any) -> Any:
    if raw is None or raw == "":
        return _copy_default(fallback)
    if isinstance(raw, (dict, list)):
        return raw
    try:
        parsed = json.loads(raw)
    except Exception:
        return _copy_default(fallback)
    if isinstance(fallback, dict) and not isinstance(parsed, dict):
        return _copy_default(fallback)
    if isinstance(fallback, list) and not isinstance(parsed, list):
        return _copy_default(fallback)
    return parsed


def _mask_config(config: Dict[str, Any]) -> Dict[str, Any]:
    masked = dict(config or {})
    for key in SECRET_CONFIG_KEYS:
        if masked.get(key):
            masked[key] = "********"
    return masked


def _boolish(value: Any, default: bool) -> bool:
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(default)


def _safe_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _safe_int(value: Any, default: int, minimum: Optional[int] = None) -> int:
    try:
        result = int(value)
    except Exception:
        result = int(default)
    if minimum is not None:
        result = max(minimum, result)
    return result


def _normalize_interval(value: Any, fallback: str = "manual") -> str:
    interval = str(value or fallback).strip().lower()
    return interval if interval in VALID_INTERVALS else fallback


def _normalize_date(value: Any, fallback: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return fallback
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw[:19], fmt).date().isoformat()
        except Exception:
            continue
    return fallback


def _month_start(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, 1)


def _shift_months(dt: datetime, delta: int) -> datetime:
    month_index = dt.month - 1 + delta
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    return datetime(year, month, 1)


def _ensure_user_preferences(conn, user_id: int, tenant_id: Optional[int]) -> None:
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR IGNORE INTO user_preferences
            (user_id, tenant_id, contact_email, company, role, notes, theme_mode, timezone, digest_frequency,
             notify_analysis_complete, notify_connector_failures, notify_billing_updates)
        VALUES (?, ?, '', '', '', '', 'light', 'UTC', 'weekly', 1, 1, 1)
        """,
        (user_id, tenant_id),
    )


def _ensure_workspace_preferences(conn, workspace_id: int, tenant_id: Optional[int]) -> None:
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR IGNORE INTO workspace_preferences
            (workspace_id, tenant_id, locale, currency, timezone, default_arpu, renewal_cycle, auto_sync_enabled,
             auto_analysis_enabled, daily_digest_enabled, slack_webhook_url, retention_target, export_format,
             security_mode, data_retention_days)
        VALUES (?, ?, 'en-US', 'USD', 'UTC', 50.0, 'monthly', 1, 0, 1, '', 92.0, 'zip', 'standard', 365)
        """,
        (workspace_id, tenant_id),
    )


def _seed_documentation(conn) -> None:
    cursor = conn.cursor()
    for article in DOCUMENTATION_SEEDS:
        cursor.execute(
            """
            INSERT INTO documentation_articles
                (slug, title, category, summary, body, estimated_minutes, icon, order_index, applicable_verticals, is_published, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(slug) DO UPDATE SET
                title = excluded.title,
                category = excluded.category,
                summary = excluded.summary,
                body = excluded.body,
                estimated_minutes = excluded.estimated_minutes,
                icon = excluded.icon,
                order_index = excluded.order_index,
                applicable_verticals = excluded.applicable_verticals,
                is_published = 1,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                article["slug"],
                article["title"],
                article["category"],
                article["summary"],
                article["body"],
                int(article["estimated_minutes"]),
                article["icon"],
                int(article["order_index"]),
                json.dumps(article["applicable_verticals"]),
            ),
        )


def init_workspace_admin_tables() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER PRIMARY KEY,
            tenant_id INTEGER,
            contact_email TEXT DEFAULT '',
            company TEXT DEFAULT '',
            role TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            theme_mode TEXT DEFAULT 'light',
            timezone TEXT DEFAULT 'UTC',
            digest_frequency TEXT DEFAULT 'weekly',
            notify_analysis_complete BOOLEAN DEFAULT 1,
            notify_connector_failures BOOLEAN DEFAULT 1,
            notify_billing_updates BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_preferences (
            workspace_id INTEGER PRIMARY KEY,
            tenant_id INTEGER,
            locale TEXT DEFAULT 'en-US',
            currency TEXT DEFAULT 'USD',
            timezone TEXT DEFAULT 'UTC',
            default_arpu REAL DEFAULT 50.0,
            renewal_cycle TEXT DEFAULT 'monthly',
            auto_sync_enabled BOOLEAN DEFAULT 1,
            auto_analysis_enabled BOOLEAN DEFAULT 0,
            daily_digest_enabled BOOLEAN DEFAULT 1,
            slack_webhook_url TEXT DEFAULT '',
            retention_target REAL DEFAULT 92.0,
            export_format TEXT DEFAULT 'zip',
            security_mode TEXT DEFAULT 'standard',
            data_retention_days INTEGER DEFAULT 365,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            plan_name TEXT DEFAULT 'Growth',
            plan_status TEXT DEFAULT 'active',
            billing_email TEXT,
            company_name TEXT,
            currency TEXT DEFAULT 'USD',
            seats INTEGER DEFAULT 5,
            base_fee REAL DEFAULT 299.0,
            per_seat_fee REAL DEFAULT 39.0,
            token_budget INTEGER DEFAULT 250000,
            overage_rate REAL DEFAULT 0.0015,
            auto_renew BOOLEAN DEFAULT 1,
            next_invoice_date TEXT,
            payment_brand TEXT DEFAULT 'Visa',
            payment_last4 TEXT DEFAULT '4242',
            billing_address TEXT DEFAULT '',
            tax_id TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            billing_account_id INTEGER NOT NULL,
            workspace_id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL UNIQUE,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            subtotal REAL DEFAULT 0.0,
            usage_cost REAL DEFAULT 0.0,
            total REAL DEFAULT 0.0,
            currency TEXT DEFAULT 'USD',
            line_items TEXT DEFAULT '[]',
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            due_at TEXT,
            paid_at TEXT,
            FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS documentation_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            summary TEXT NOT NULL,
            body TEXT NOT NULL,
            estimated_minutes INTEGER DEFAULT 5,
            icon TEXT DEFAULT 'FileText',
            order_index INTEGER DEFAULT 0,
            applicable_verticals TEXT DEFAULT '["all"]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_published BOOLEAN DEFAULT 1
        )
        """
    )

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_preferences_tenant ON user_preferences(tenant_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_workspace_preferences_tenant ON workspace_preferences(tenant_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_accounts_workspace ON billing_accounts(workspace_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_accounts_tenant ON billing_accounts(tenant_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_invoices_workspace ON billing_invoices(workspace_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_invoices_period ON billing_invoices(period_start, period_end)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_category ON documentation_articles(category)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_published ON documentation_articles(is_published)")

    _seed_documentation(conn)
    conn.commit()
    conn.close()


def get_user_profile_bundle(user_id: int, tenant_id: Optional[int]) -> Optional[Dict[str, Any]]:
    user = get_user_by_id(user_id)
    if not user:
        return None
    if tenant_id is not None and user.get("tenant_id") not in {None, tenant_id}:
        return None

    conn = get_db_connection()
    _ensure_user_preferences(conn, user_id, tenant_id)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,))
    pref_row = cursor.fetchone()
    conn.commit()
    conn.close()

    preferences_raw = dict(pref_row) if pref_row else {}
    access_profile = get_access_code_profile(user_id) or {}
    contact_email = preferences_raw.get("contact_email") or access_profile.get("contact_email") or user.get("email") or ""
    company = preferences_raw.get("company") or access_profile.get("company") or ""
    role = preferences_raw.get("role") or access_profile.get("role") or ""
    notes = preferences_raw.get("notes") or access_profile.get("notes") or ""

    return {
        "user": {
            "id": user["id"],
            "tenant_id": user.get("tenant_id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login"),
            "access_code": access_profile.get("access_code"),
            "contact_email": contact_email,
            "company": company,
            "role": role,
            "notes": notes,
        },
        "preferences": {
            "theme_mode": preferences_raw.get("theme_mode") or DEFAULT_USER_PREFERENCES["theme_mode"],
            "timezone": preferences_raw.get("timezone") or DEFAULT_USER_PREFERENCES["timezone"],
            "digest_frequency": preferences_raw.get("digest_frequency") or DEFAULT_USER_PREFERENCES["digest_frequency"],
            "notify_analysis_complete": _boolish(
                preferences_raw.get("notify_analysis_complete"),
                DEFAULT_USER_PREFERENCES["notify_analysis_complete"],
            ),
            "notify_connector_failures": _boolish(
                preferences_raw.get("notify_connector_failures"),
                DEFAULT_USER_PREFERENCES["notify_connector_failures"],
            ),
            "notify_billing_updates": _boolish(
                preferences_raw.get("notify_billing_updates"),
                DEFAULT_USER_PREFERENCES["notify_billing_updates"],
            ),
        },
    }


def update_user_profile_bundle(user_id: int, tenant_id: Optional[int], payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    current = get_user_profile_bundle(user_id, tenant_id)
    if not current:
        return None

    user_payload = current["user"]
    preferences_payload = current["preferences"]
    next_name = str(payload.get("name") or user_payload.get("name") or "").strip() or user_payload.get("name") or "User"
    next_contact_email = str(payload.get("contact_email") or user_payload.get("contact_email") or "").strip()
    next_company = str(payload.get("company") or user_payload.get("company") or "").strip()
    next_role = str(payload.get("role") or user_payload.get("role") or "").strip()
    next_notes = str(payload.get("notes") or user_payload.get("notes") or "").strip()
    theme_mode = str(payload.get("theme_mode") or preferences_payload.get("theme_mode") or "light").strip().lower()
    if theme_mode not in VALID_THEME_MODES:
        theme_mode = preferences_payload.get("theme_mode") or "light"
    digest_frequency = str(payload.get("digest_frequency") or preferences_payload.get("digest_frequency") or "weekly").strip().lower()
    if digest_frequency not in VALID_DIGEST_FREQUENCIES:
        digest_frequency = preferences_payload.get("digest_frequency") or "weekly"
    timezone = str(payload.get("timezone") or preferences_payload.get("timezone") or "UTC").strip() or "UTC"

    conn = get_db_connection()
    _ensure_user_preferences(conn, user_id, tenant_id)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = ? WHERE id = ?", (next_name, user_id))
    cursor.execute(
        """
        UPDATE user_preferences
        SET tenant_id = ?,
            contact_email = ?,
            company = ?,
            role = ?,
            notes = ?,
            theme_mode = ?,
            timezone = ?,
            digest_frequency = ?,
            notify_analysis_complete = ?,
            notify_connector_failures = ?,
            notify_billing_updates = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        """,
        (
            tenant_id,
            next_contact_email,
            next_company,
            next_role,
            next_notes,
            theme_mode,
            timezone,
            digest_frequency,
            1 if _boolish(payload.get("notify_analysis_complete"), preferences_payload.get("notify_analysis_complete", True)) else 0,
            1 if _boolish(payload.get("notify_connector_failures"), preferences_payload.get("notify_connector_failures", True)) else 0,
            1 if _boolish(payload.get("notify_billing_updates"), preferences_payload.get("notify_billing_updates", True)) else 0,
            user_id,
        ),
    )
    cursor.execute(
        """
        UPDATE access_code_profiles
        SET contact_email = ?,
            company = ?,
            role = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        """,
        (next_contact_email or None, next_company or None, next_role or None, next_notes or None, user_id),
    )
    conn.commit()
    conn.close()
    return get_user_profile_bundle(user_id, tenant_id)


def get_workspace_settings_bundle(workspace_id: int, user_id: int, tenant_id: Optional[int]) -> Optional[Dict[str, Any]]:
    workspace = get_workspace_by_id(workspace_id, user_id, tenant_id)
    if not workspace:
        return None

    conn = get_db_connection()
    _ensure_workspace_preferences(conn, workspace_id, tenant_id)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workspace_preferences WHERE workspace_id = ?", (workspace_id,))
    pref_row = cursor.fetchone()
    conn.commit()
    conn.close()

    settings_raw = dict(pref_row) if pref_row else {}
    settings_payload = {
        "locale": settings_raw.get("locale") or DEFAULT_WORKSPACE_SETTINGS["locale"],
        "currency": settings_raw.get("currency") or DEFAULT_WORKSPACE_SETTINGS["currency"],
        "timezone": settings_raw.get("timezone") or DEFAULT_WORKSPACE_SETTINGS["timezone"],
        "default_arpu": _safe_float(settings_raw.get("default_arpu"), DEFAULT_WORKSPACE_SETTINGS["default_arpu"]),
        "renewal_cycle": str(settings_raw.get("renewal_cycle") or DEFAULT_WORKSPACE_SETTINGS["renewal_cycle"]),
        "auto_sync_enabled": _boolish(settings_raw.get("auto_sync_enabled"), DEFAULT_WORKSPACE_SETTINGS["auto_sync_enabled"]),
        "auto_analysis_enabled": _boolish(settings_raw.get("auto_analysis_enabled"), DEFAULT_WORKSPACE_SETTINGS["auto_analysis_enabled"]),
        "daily_digest_enabled": _boolish(settings_raw.get("daily_digest_enabled"), DEFAULT_WORKSPACE_SETTINGS["daily_digest_enabled"]),
        "slack_webhook_url": str(settings_raw.get("slack_webhook_url") or DEFAULT_WORKSPACE_SETTINGS["slack_webhook_url"]),
        "retention_target": _safe_float(settings_raw.get("retention_target"), DEFAULT_WORKSPACE_SETTINGS["retention_target"]),
        "export_format": str(settings_raw.get("export_format") or DEFAULT_WORKSPACE_SETTINGS["export_format"]),
        "security_mode": str(settings_raw.get("security_mode") or DEFAULT_WORKSPACE_SETTINGS["security_mode"]),
        "data_retention_days": _safe_int(
            settings_raw.get("data_retention_days"),
            DEFAULT_WORKSPACE_SETTINGS["data_retention_days"],
            minimum=30,
        ),
    }
    connectors = get_user_connectors(user_id, tenant_id, workspace_id=workspace_id, connector_scope="workspace")
    return {"workspace": workspace, "settings": settings_payload, "connectors_count": len(connectors)}


def update_workspace_settings_bundle(
    workspace_id: int,
    user_id: int,
    tenant_id: Optional[int],
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    current = get_workspace_settings_bundle(workspace_id, user_id, tenant_id)
    if not current:
        return None

    workspace = current["workspace"]
    settings = current["settings"]
    next_name = str(payload.get("name") or workspace.get("name") or "").strip() or workspace.get("name") or "Workspace"
    next_description = str(payload.get("description") or workspace.get("description") or "").strip()
    next_vertical = str(payload.get("vertical") or workspace.get("vertical") or "generic").strip().lower() or "generic"
    export_format = str(payload.get("export_format") or settings.get("export_format") or "zip").strip().lower()
    if export_format not in VALID_EXPORT_FORMATS:
        export_format = settings.get("export_format") or "zip"
    security_mode = str(payload.get("security_mode") or settings.get("security_mode") or "standard").strip().lower()
    if security_mode not in VALID_SECURITY_MODES:
        security_mode = settings.get("security_mode") or "standard"

    conn = get_db_connection()
    _ensure_workspace_preferences(conn, workspace_id, tenant_id)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE workspaces SET name = ?, description = ?, vertical = ? WHERE id = ? AND tenant_id = ?",
        (next_name, next_description, next_vertical, workspace_id, tenant_id),
    )
    cursor.execute(
        """
        UPDATE workspace_preferences
        SET tenant_id = ?,
            locale = ?,
            currency = ?,
            timezone = ?,
            default_arpu = ?,
            renewal_cycle = ?,
            auto_sync_enabled = ?,
            auto_analysis_enabled = ?,
            daily_digest_enabled = ?,
            slack_webhook_url = ?,
            retention_target = ?,
            export_format = ?,
            security_mode = ?,
            data_retention_days = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ?
        """,
        (
            tenant_id,
            str(payload.get("locale") or settings.get("locale") or "en-US").strip() or "en-US",
            str(payload.get("currency") or settings.get("currency") or "USD").strip().upper() or "USD",
            str(payload.get("timezone") or settings.get("timezone") or "UTC").strip() or "UTC",
            _safe_float(payload.get("default_arpu"), settings.get("default_arpu") or 50.0),
            str(payload.get("renewal_cycle") or settings.get("renewal_cycle") or "monthly").strip().lower() or "monthly",
            1 if _boolish(payload.get("auto_sync_enabled"), settings.get("auto_sync_enabled", True)) else 0,
            1 if _boolish(payload.get("auto_analysis_enabled"), settings.get("auto_analysis_enabled", False)) else 0,
            1 if _boolish(payload.get("daily_digest_enabled"), settings.get("daily_digest_enabled", True)) else 0,
            str(payload.get("slack_webhook_url") or settings.get("slack_webhook_url") or "").strip(),
            _safe_float(payload.get("retention_target"), settings.get("retention_target") or 92.0),
            export_format,
            security_mode,
            _safe_int(payload.get("data_retention_days"), settings.get("data_retention_days") or 365, minimum=30),
            workspace_id,
        ),
    )
    conn.commit()
    conn.close()
    return get_workspace_settings_bundle(workspace_id, user_id, tenant_id)


def _get_connector_row(conn, connector_id: int, user_id: int, tenant_id: Optional[int]) -> Optional[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT *
        FROM cxm_sources
        WHERE id = ? AND user_id = ? AND tenant_id = ? AND is_active = 1
        """,
        (connector_id, user_id, tenant_id),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def get_connector_settings(connector_id: int, user_id: int, tenant_id: Optional[int]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = _get_connector_row(conn, connector_id, user_id, tenant_id)
    conn.close()
    if not row:
        return None
    row["config"] = _mask_config(_load_json(row.get("config"), {}))
    row["connector_type"] = row.get("source_type")
    row["name"] = row.get("display_name") or f"{row.get('source_type')}: {row.get('identifier')}"
    return row


def update_connector_settings(
    connector_id: int,
    user_id: int,
    tenant_id: Optional[int],
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = _get_connector_row(conn, connector_id, user_id, tenant_id)
    if not row:
        conn.close()
        return None

    config = _load_json(row.get("config"), {})
    incoming_config = payload.get("config") or {}
    if isinstance(incoming_config, dict):
        for key, value in incoming_config.items():
            if key in SECRET_CONFIG_KEYS and (value is None or str(value).strip() in {"", "********"}):
                continue
            if value is None:
                config.pop(key, None)
                continue
            config[key] = value

    if payload.get("max_reviews") is not None:
        max_reviews = _safe_int(payload.get("max_reviews"), config.get("count") or config.get("max_reviews") or 200, minimum=1)
        config["count"] = max_reviews
        config["max_reviews"] = max_reviews

    fetch_interval = _normalize_interval(payload.get("fetch_interval"), row.get("fetch_interval") or "manual")
    analysis_interval = _normalize_interval(payload.get("analysis_interval"), row.get("analysis_interval") or fetch_interval)
    display_name = str(payload.get("name") or row.get("display_name") or "").strip() or row.get("display_name") or row.get("identifier")

    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE cxm_sources
        SET display_name = ?, config = ?, fetch_interval = ?, analysis_interval = ?
        WHERE id = ? AND user_id = ? AND tenant_id = ?
        """,
        (
            display_name,
            json.dumps(config),
            fetch_interval,
            analysis_interval,
            connector_id,
            user_id,
            tenant_id,
        ),
    )
    conn.commit()
    conn.close()
    return get_connector_settings(connector_id, user_id, tenant_id)


def _ensure_billing_account(conn, workspace: Dict[str, Any], user: Dict[str, Any], tenant_id: Optional[int]) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM billing_accounts WHERE workspace_id = ?", (workspace["id"],))
    row = cursor.fetchone()
    if row:
        return dict(row)

    profile = get_user_profile_bundle(user["id"], tenant_id) or {}
    company_name = profile.get("user", {}).get("company") or workspace.get("name") or "Workspace"
    billing_email = profile.get("user", {}).get("contact_email") or user.get("email") or ""
    next_invoice_date = _shift_months(_month_start(datetime.now()), 1).date().isoformat()

    cursor.execute(
        """
        INSERT INTO billing_accounts
            (workspace_id, user_id, tenant_id, plan_name, plan_status, billing_email, company_name, currency,
             seats, base_fee, per_seat_fee, token_budget, overage_rate, auto_renew, next_invoice_date, payment_brand,
             payment_last4, billing_address, tax_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            workspace["id"],
            user["id"],
            tenant_id,
            DEFAULT_BILLING_ACCOUNT["plan_name"],
            DEFAULT_BILLING_ACCOUNT["plan_status"],
            billing_email,
            company_name,
            DEFAULT_BILLING_ACCOUNT["currency"],
            DEFAULT_BILLING_ACCOUNT["seats"],
            DEFAULT_BILLING_ACCOUNT["base_fee"],
            DEFAULT_BILLING_ACCOUNT["per_seat_fee"],
            DEFAULT_BILLING_ACCOUNT["token_budget"],
            DEFAULT_BILLING_ACCOUNT["overage_rate"],
            1 if DEFAULT_BILLING_ACCOUNT["auto_renew"] else 0,
            next_invoice_date,
            DEFAULT_BILLING_ACCOUNT["payment_brand"],
            DEFAULT_BILLING_ACCOUNT["payment_last4"],
            DEFAULT_BILLING_ACCOUNT["billing_address"],
            DEFAULT_BILLING_ACCOUNT["tax_id"],
            DEFAULT_BILLING_ACCOUNT["notes"],
        ),
    )
    cursor.execute("SELECT * FROM billing_accounts WHERE workspace_id = ?", (workspace["id"],))
    created = cursor.fetchone()
    return dict(created)


def _sync_invoice_for_month(
    conn,
    account: Dict[str, Any],
    user_id: int,
    tenant_id: Optional[int],
    period_start: datetime,
) -> None:
    period_end = _shift_months(period_start, 1) - timedelta(days=1)
    summary = calculate_billing_summary(user_id, tenant_id, period_start.month, period_start.year)
    seats = _safe_int(account.get("seats"), 5, minimum=1)
    base_fee = round(_safe_float(account.get("base_fee"), 299.0), 2)
    per_seat_fee = round(_safe_float(account.get("per_seat_fee"), 39.0), 2)
    subtotal = round(base_fee + (seats * per_seat_fee), 2)
    usage_cost = round(_safe_float(summary.get("total_cost"), 0.0), 2)
    total = round(subtotal + usage_cost, 2)
    is_current_month = period_start.year == datetime.now().year and period_start.month == datetime.now().month
    status = "open" if is_current_month else "paid"
    invoice_number = f"HZ-{account['workspace_id']}-{period_start.year}{period_start.month:02d}"
    line_items = [
        {"label": "Platform base fee", "amount": base_fee},
        {"label": f"Seat charges ({seats} x {per_seat_fee:.2f})", "amount": round(seats * per_seat_fee, 2)},
        {"label": "AI usage overage", "amount": usage_cost},
    ]

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO billing_invoices
            (billing_account_id, workspace_id, tenant_id, invoice_number, period_start, period_end, status, subtotal,
             usage_cost, total, currency, line_items, issued_at, due_at, paid_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(invoice_number) DO UPDATE SET
            status = excluded.status,
            subtotal = excluded.subtotal,
            usage_cost = excluded.usage_cost,
            total = excluded.total,
            currency = excluded.currency,
            line_items = excluded.line_items,
            issued_at = excluded.issued_at,
            due_at = excluded.due_at,
            paid_at = excluded.paid_at
        """,
        (
            account["id"],
            account["workspace_id"],
            tenant_id,
            invoice_number,
            period_start.date().isoformat(),
            period_end.date().isoformat(),
            status,
            subtotal,
            usage_cost,
            total,
            account.get("currency") or "USD",
            json.dumps(line_items),
            period_end.date().isoformat(),
            (period_end + timedelta(days=14)).date().isoformat(),
            None if is_current_month else (period_end + timedelta(days=3)).date().isoformat(),
        ),
    )


def _sync_recent_invoices(conn, account: Dict[str, Any], user_id: int, tenant_id: Optional[int], months: int = 4) -> None:
    current_start = _month_start(datetime.now())
    for offset in range(months - 1, -1, -1):
        _sync_invoice_for_month(conn, account, user_id, tenant_id, _shift_months(current_start, -offset))


def _serialize_billing_account(account: Dict[str, Any], current_period: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(account)
    serialized["seats"] = _safe_int(serialized.get("seats"), DEFAULT_BILLING_ACCOUNT["seats"], minimum=1)
    serialized["base_fee"] = round(_safe_float(serialized.get("base_fee"), DEFAULT_BILLING_ACCOUNT["base_fee"]), 2)
    serialized["per_seat_fee"] = round(_safe_float(serialized.get("per_seat_fee"), DEFAULT_BILLING_ACCOUNT["per_seat_fee"]), 2)
    serialized["token_budget"] = _safe_int(serialized.get("token_budget"), DEFAULT_BILLING_ACCOUNT["token_budget"], minimum=0)
    serialized["overage_rate"] = round(_safe_float(serialized.get("overage_rate"), DEFAULT_BILLING_ACCOUNT["overage_rate"]), 6)
    serialized["auto_renew"] = _boolish(serialized.get("auto_renew"), DEFAULT_BILLING_ACCOUNT["auto_renew"])
    serialized["estimated_monthly_total"] = round(
        serialized["base_fee"] + (serialized["seats"] * serialized["per_seat_fee"]) + _safe_float(current_period.get("total_cost"), 0.0),
        2,
    )
    return serialized


def get_billing_dashboard(workspace_id: int, user_id: int, tenant_id: Optional[int]) -> Optional[Dict[str, Any]]:
    workspace = get_workspace_by_id(workspace_id, user_id, tenant_id)
    user = get_user_by_id(user_id)
    if not workspace or not user:
        return None

    conn = get_db_connection()
    account = _ensure_billing_account(conn, workspace, user, tenant_id)
    _sync_recent_invoices(conn, account, user_id, tenant_id, months=4)
    conn.commit()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM billing_accounts WHERE workspace_id = ?", (workspace_id,))
    refreshed_account = dict(cursor.fetchone())
    cursor.execute(
        """
        SELECT *
        FROM billing_invoices
        WHERE workspace_id = ?
        ORDER BY period_start DESC
        LIMIT 12
        """,
        (workspace_id,),
    )
    invoice_rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    current_period = calculate_billing_summary(user_id, tenant_id, datetime.now().month, datetime.now().year)
    invoices = []
    for invoice in invoice_rows:
        invoice["line_items"] = _load_json(invoice.get("line_items"), [])
        invoices.append(invoice)

    return {
        "workspace": workspace,
        "account": _serialize_billing_account(refreshed_account, current_period),
        "current_period": current_period,
        "usage": get_usage_stats(user_id, tenant_id),
        "trends": get_usage_trends(user_id, tenant_id, days=30),
        "invoices": invoices,
        "llm_preferences": get_llm_preferences(user_id, tenant_id),
    }


def update_billing_account(
    workspace_id: int,
    user_id: int,
    tenant_id: Optional[int],
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    workspace = get_workspace_by_id(workspace_id, user_id, tenant_id)
    user = get_user_by_id(user_id)
    if not workspace or not user:
        return None

    conn = get_db_connection()
    account = _ensure_billing_account(conn, workspace, user, tenant_id)
    current_period = calculate_billing_summary(user_id, tenant_id, datetime.now().month, datetime.now().year)
    current_account = _serialize_billing_account(account, current_period)
    plan_status = str(payload.get("plan_status") or current_account.get("plan_status") or "active").strip().lower()
    if plan_status not in VALID_PLAN_STATUSES:
        plan_status = current_account.get("plan_status") or "active"

    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE billing_accounts
        SET plan_name = ?,
            plan_status = ?,
            billing_email = ?,
            company_name = ?,
            currency = ?,
            seats = ?,
            base_fee = ?,
            per_seat_fee = ?,
            token_budget = ?,
            overage_rate = ?,
            auto_renew = ?,
            next_invoice_date = ?,
            payment_brand = ?,
            payment_last4 = ?,
            billing_address = ?,
            tax_id = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ?
        """,
        (
            str(payload.get("plan_name") or current_account.get("plan_name") or "Growth").strip() or "Growth",
            plan_status,
            str(payload.get("billing_email") or current_account.get("billing_email") or user.get("email") or "").strip(),
            str(payload.get("company_name") or current_account.get("company_name") or workspace.get("name") or "").strip(),
            str(payload.get("currency") or current_account.get("currency") or "USD").strip().upper() or "USD",
            _safe_int(payload.get("seats"), current_account.get("seats") or 5, minimum=1),
            round(_safe_float(payload.get("base_fee"), current_account.get("base_fee") or 299.0), 2),
            round(_safe_float(payload.get("per_seat_fee"), current_account.get("per_seat_fee") or 39.0), 2),
            _safe_int(payload.get("token_budget"), current_account.get("token_budget") or 250000, minimum=0),
            round(_safe_float(payload.get("overage_rate"), current_account.get("overage_rate") or 0.0015), 6),
            1 if _boolish(payload.get("auto_renew"), current_account.get("auto_renew", True)) else 0,
            _normalize_date(
                payload.get("next_invoice_date"),
                current_account.get("next_invoice_date") or _shift_months(_month_start(datetime.now()), 1).date().isoformat(),
            ),
            str(payload.get("payment_brand") or current_account.get("payment_brand") or "Visa").strip() or "Visa",
            str(payload.get("payment_last4") or current_account.get("payment_last4") or "4242").strip()[-4:],
            str(payload.get("billing_address") or current_account.get("billing_address") or "").strip(),
            str(payload.get("tax_id") or current_account.get("tax_id") or "").strip(),
            str(payload.get("notes") or current_account.get("notes") or "").strip(),
            workspace_id,
        ),
    )
    conn.commit()
    conn.close()

    if payload.get("token_billing_enabled") is not None:
        set_llm_preferences(user_id, tenant_id, billing_enabled=_boolish(payload.get("token_billing_enabled"), True))

    return get_billing_dashboard(workspace_id, user_id, tenant_id)


def _article_applies_to_vertical(article: Dict[str, Any], vertical: str) -> bool:
    applicable = _load_json(article.get("applicable_verticals"), ["all"])
    applicable_norm = {str(item).strip().lower() for item in applicable}
    return "all" in applicable_norm or str(vertical or "generic").strip().lower() in applicable_norm


def list_documentation_articles(
    workspace_id: int,
    user_id: int,
    tenant_id: Optional[int],
    query: str = "",
    category: str = "",
) -> Optional[Dict[str, Any]]:
    workspace = get_workspace_by_id(workspace_id, user_id, tenant_id)
    if not workspace:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT slug, title, category, summary, estimated_minutes, icon, order_index, applicable_verticals, updated_at
        FROM documentation_articles
        WHERE is_published = 1
        ORDER BY category ASC, order_index ASC, title ASC
        """
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    vertical = str(workspace.get("vertical") or "generic").strip().lower()
    normalized_query = str(query or "").strip().lower()
    normalized_category = str(category or "").strip().lower()
    articles: List[Dict[str, Any]] = []

    for row in rows:
        if not _article_applies_to_vertical(row, vertical):
            continue
        if normalized_category and normalized_category not in {"all", str(row.get("category") or "").lower()}:
            continue
        haystack = " ".join([str(row.get("title") or ""), str(row.get("summary") or ""), str(row.get("category") or "")]).lower()
        if normalized_query and normalized_query not in haystack:
            continue
        row.pop("applicable_verticals", None)
        articles.append(row)

    categories = sorted({str(article.get("category") or "").lower() for article in articles if article.get("category")})
    return {"workspace": workspace, "categories": categories, "articles": articles}


def get_documentation_article(
    workspace_id: int,
    slug: str,
    user_id: int,
    tenant_id: Optional[int],
) -> Optional[Dict[str, Any]]:
    workspace = get_workspace_by_id(workspace_id, user_id, tenant_id)
    if not workspace:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT *
        FROM documentation_articles
        WHERE slug = ? AND is_published = 1
        """,
        (slug,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    article = dict(row)
    vertical = str(workspace.get("vertical") or "generic").strip().lower()
    if not _article_applies_to_vertical(article, vertical):
        conn.close()
        return None

    cursor.execute(
        """
        SELECT slug, title, category, summary, estimated_minutes, icon, order_index, updated_at
        FROM documentation_articles
        WHERE category = ? AND slug != ? AND is_published = 1
        ORDER BY order_index ASC, title ASC
        LIMIT 4
        """,
        (article.get("category"), slug),
    )
    related_rows = [dict(item) for item in cursor.fetchall()]
    conn.close()

    related = [item for item in related_rows if _article_applies_to_vertical(item, vertical)]
    article.pop("applicable_verticals", None)
    return {"workspace": workspace, "article": article, "related": related}
