"""
Database module for user authentication and analysis history.
Handles all database operations including user management, sessions, and analysis storage.
"""


import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
import os
import pandas as pd
import hashlib
import logging
import uuid
import string

# Initialize logger
logger = logging.getLogger("hyzync.database")

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'app.db')
SQLITE_CONNECT_TIMEOUT_SECONDS = float(os.getenv("SQLITE_CONNECT_TIMEOUT_SECONDS", "8"))
SQLITE_BUSY_TIMEOUT_MS = int(os.getenv("SQLITE_BUSY_TIMEOUT_MS", "8000"))
ACCESS_CODE_SEED = [
    "6E12GH",
    "5H91TY",
    "8K24LM",
    "3P47QX",
    "9R58VN",
    "2D63WF",
    "7J18CP",
    "4M72ZS",
    "1N85BK",
    "0T39RU",
]

def get_db_connection():
    """
    Create and return a database connection tuned for responsive API calls.
    WAL mode is configured once in init_database(), not on every request.
    """
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH, timeout=SQLITE_CONNECT_TIMEOUT_SECONDS)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    conn.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA synchronous=NORMAL")     # Good balance of safety + speed with WAL
    return conn


def _initialize_context_graph_schema(cursor):
    """Initialize context graph tables for LLM decision provenance."""
    schema_path = os.path.join(os.path.dirname(__file__), 'migrations', 'context_graph_schema.sql')
    
    if os.path.exists(schema_path):
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        cursor.executescript(schema_sql)
        logger.info("Context graph schema initialized")
    else:
        # logger.warning(f"Context graph schema file not found at {schema_path}")
        pass

def get_all_analyses_df(tenant_id: int, limit: int = 5):
    """Helper to fetch recent analysis results as a DataFrame for analytics (Tenant Scoped)."""
    conn = get_db_connection()
    # Fetch only recent analyses for this tenant
    query = "SELECT * FROM analysis_history WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?"
    df = pd.read_sql_query(query, conn, params=(tenant_id, limit))
    conn.close()
    
    # Pre-process: Extract fields from 'results' JSON column
    if not df.empty and 'results' in df.columns:
        all_reviews = []
        for _, row in df.iterrows():
            try:
                raw = row['results']
                # Skip rows where results is NaN or not a string
                if not isinstance(raw, str):
                    continue
                analysis_data = json.loads(raw)
                if isinstance(analysis_data, list):
                    for review in analysis_data:
                        if not isinstance(review, dict):
                            continue
                        review['analysis_id'] = row['id']
                        review['vertical'] = row['vertical']
                        review['source_type'] = row['source_type']
                        review['at'] = review.get('at', row['timestamp'])
                        all_reviews.append(review)
                elif isinstance(analysis_data, dict):
                    reviews_list = analysis_data.get('reviews', [])
                    for review in reviews_list:
                        if not isinstance(review, dict):
                            continue
                        review['analysis_id'] = row['id']
                        review['vertical'] = row['vertical']
                        review['source_type'] = row['source_type']
                        review['at'] = review.get('at', row['timestamp'])
                        all_reviews.append(review)
            except (json.JSONDecodeError, TypeError, AttributeError, KeyError):
                continue
                
        if all_reviews:
            return pd.DataFrame(all_reviews)
            
    return pd.DataFrame()


def get_latest_analysis_df(tenant_id: int):
    """Return only the most recent analysis for a tenant as a DataFrame."""
    return get_all_analyses_df(tenant_id, limit=1)


def init_database():
    """Initialize database with required tables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Configure WAL once at startup; repeating this on every connection can
    # contend under write load and stall read endpoints.
    conn.execute("PRAGMA journal_mode=WAL")
    
    # Tenants table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Workspaces table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            vertical TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS access_codes (
            code TEXT PRIMARY KEY,
            label TEXT,
            claimed_user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            activated_at TIMESTAMP,
            FOREIGN KEY (claimed_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS access_code_profiles (
            user_id INTEGER PRIMARY KEY,
            access_code TEXT UNIQUE NOT NULL,
            contact_email TEXT,
            company TEXT,
            role TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (access_code) REFERENCES access_codes(code) ON DELETE CASCADE
        )
    ''')
    
    # Sessions table (30-day persistence)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Password reset tokens
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Analysis history
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            workspace_id INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            vertical TEXT,
            source_type TEXT,
            total_reviews INTEGER,
            config TEXT,
            results TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    # Raw Reviews Storage (Cache & Deduplication)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS raw_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            workspace_id INTEGER,
            source_type TEXT NOT NULL,
            identifier TEXT NOT NULL,
            external_id TEXT,
            content TEXT NOT NULL,
            score INTEGER DEFAULT 3,
            author TEXT,
            at TIMESTAMP,
            is_analyzed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source_type, identifier, external_id, content), -- Multi-level deduplication
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')
    
    # Support tickets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            resolved_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')
    
    # Ticket messages
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ticket_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # User usage tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            analysis_id INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviews_analyzed INTEGER DEFAULT 0,
            cost REAL DEFAULT 0.0,
            vertical TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (analysis_id) REFERENCES analysis_history(id) ON DELETE SET NULL
        )
    ''')
    
    # Billing history (mock for now)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS billing_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            total_analyses INTEGER DEFAULT 0,
            total_reviews INTEGER DEFAULT 0,
            total_cost REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS llm_preferences (
            user_id INTEGER PRIMARY KEY,
            tenant_id INTEGER,
            is_enabled BOOLEAN DEFAULT 1,
            billing_enabled BOOLEAN DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')
    
    # Google Drive configuration (NEW)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gdrive_config (
            user_id INTEGER PRIMARY KEY,
            credentials_json TEXT,
            auth_type TEXT DEFAULT 'service_account',
            last_authenticated TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Workspaces — each user can have multiple named workspaces
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            vertical TEXT DEFAULT 'generic',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    # Migrate: add vertical column if it doesn't exist yet
    try:
        cursor.execute("ALTER TABLE workspaces ADD COLUMN vertical TEXT DEFAULT 'generic'")
    except Exception:
        pass

    # Core Persistent Connectors
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_connectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            workspace_id INTEGER,
            connector_type TEXT NOT NULL,
            identifier TEXT NOT NULL,
            name TEXT,
            config TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')
    # Migrate: add workspace_id column if it doesn't exist yet (safe on existing DBs)
    try:
        cursor.execute('ALTER TABLE user_connectors ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL')
    except Exception:
        pass
    
    # Migrate raw_reviews: add workspace_id if missing
    try:
        cursor.execute('ALTER TABLE raw_reviews ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL')
    except Exception:
        pass

    # ==================== CRM TABLES ====================

    # Customer profiles imported from CRM
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crm_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            workspace_id INTEGER,
            external_id TEXT,
            name TEXT NOT NULL,
            email TEXT,
            company TEXT,
            segment TEXT DEFAULT 'Unknown',
            plan TEXT,
            mrr REAL DEFAULT 0.0,
            joined_date TEXT,
            next_renewal TEXT,
            tags TEXT DEFAULT '[]',
            notes TEXT,
            schedule TEXT DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            UNIQUE(tenant_id, external_id)
        )
    ''')

    # Feedback entries linked to a profile
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crm_feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            source TEXT DEFAULT 'manual',
            content TEXT NOT NULL,
            score INTEGER DEFAULT 3,
            feedback_date TEXT,
            sentiment TEXT,
            sentiment_score REAL,
            churn_risk TEXT,
            pain_point_category TEXT,
            issue TEXT,
            is_analyzed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES crm_profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Analysis snapshots per profile
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crm_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            schedule TEXT DEFAULT 'manual',
            total_feedbacks INTEGER DEFAULT 0,
            avg_sentiment REAL,
            churn_probability REAL,
            dominant_emotion TEXT,
            top_issue TEXT,
            summary TEXT,
            FOREIGN KEY (profile_id) REFERENCES crm_profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Safe migrations for existing DBs
    for _crm_col in [
        ('crm_profiles', 'schedule', "ALTER TABLE crm_profiles ADD COLUMN schedule TEXT DEFAULT 'manual'"),
    ]:
        try:
            cursor.execute(_crm_col[2])
        except Exception:
            pass

    # Create indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analysis_user ON analysis_history(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analysis_timestamp ON analysis_history(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON ticket_messages(created_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_usage_user ON user_usage(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_usage_timestamp ON user_usage(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_history(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_billing_period ON billing_history(year, month)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_llm_preferences_tenant ON llm_preferences(tenant_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_connectors_user ON user_connectors(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_connectors_workspace ON user_connectors(workspace_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_raw_reviews_workspace ON raw_reviews(workspace_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_crm_profiles_user ON crm_profiles(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_crm_feedbacks_profile ON crm_feedbacks(profile_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_crm_analyses_profile ON crm_analyses(profile_id)')

    # ==================== SURVEY TABLES ====================

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS surveys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            workspace_id INTEGER,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            survey_type TEXT DEFAULT 'custom',
            status TEXT DEFAULT 'draft',
            token TEXT UNIQUE,
            theme TEXT DEFAULT 'indigo',
            logo_url TEXT DEFAULT '',
            branding_name TEXT DEFAULT '',
            show_progress BOOLEAN DEFAULT 1,
            allow_anonymous BOOLEAN DEFAULT 1,
            response_limit INTEGER DEFAULT 0,
            deadline TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS survey_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            survey_id INTEGER NOT NULL,
            position INTEGER DEFAULT 0,
            question_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            is_required BOOLEAN DEFAULT 0,
            config TEXT DEFAULT '{}',
            FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS survey_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            survey_id INTEGER NOT NULL,
            respondent_token TEXT,
            respondent_email TEXT DEFAULT '',
            respondent_name TEXT DEFAULT '',
            answers TEXT NOT NULL DEFAULT '{}',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_hash TEXT DEFAULT '',
            FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_surveys_user ON surveys(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_survey_responses_token ON survey_responses(respondent_token)')

    # ==================== CXM FEEDBACK INTELLIGENCE TABLES ====================

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cxm_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            workspace_id INTEGER,
            source_type TEXT NOT NULL,
            identifier TEXT NOT NULL,
            display_name TEXT,
            fetch_interval TEXT DEFAULT 'daily',
            analysis_interval TEXT DEFAULT 'manual',
            last_fetched_at TIMESTAMP,
            last_analyzed_at TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            config TEXT DEFAULT '{}',
            webhook_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cxm_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            external_id TEXT,
            author TEXT,
            content TEXT NOT NULL,
            score INTEGER DEFAULT 3,
            reviewed_at TIMESTAMP,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sentiment TEXT,
            sentiment_score REAL,
            churn_risk TEXT,
            churn_probability REAL,
            themes TEXT DEFAULT '[]',
            pain_point TEXT DEFAULT 'other',
            churn_intent_cluster TEXT DEFAULT 'no_churn_signal',
            user_segment TEXT DEFAULT 'unknown',
            growth_opportunity TEXT DEFAULT 'none',
            main_problem_flag INTEGER DEFAULT 0,
            is_analyzed BOOLEAN DEFAULT 0,
            UNIQUE(source_id, external_id, content),
            FOREIGN KEY (source_id) REFERENCES cxm_sources(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cxm_campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tenant_id INTEGER,
            name TEXT NOT NULL,
            campaign_type TEXT DEFAULT 'email',
            subject TEXT,
            body TEXT NOT NULL,
            target_segment TEXT DEFAULT '{}',
            status TEXT DEFAULT 'draft',
            sent_at TIMESTAMP,
            recipient_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_sources_user ON cxm_sources(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_source ON cxm_reviews(source_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_user ON cxm_reviews(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_reviewed_at ON cxm_reviews(reviewed_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_campaigns_user ON cxm_campaigns(user_id)')
    # Performance indexes added for production queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_author ON cxm_reviews(user_id, author)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_unanalyzed ON cxm_reviews(user_id, is_analyzed) WHERE is_analyzed=0')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_sentiment ON cxm_reviews(user_id, sentiment)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_reviews_churn_risk ON cxm_reviews(user_id, churn_risk)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cxm_sources_webhook ON cxm_sources(webhook_token) WHERE webhook_token IS NOT NULL')

    # ── Migrate existing DBs: add new columns if not present ──
    for column_sql in [
        "ALTER TABLE cxm_sources ADD COLUMN webhook_token TEXT",
        "ALTER TABLE cxm_sources ADD COLUMN hmac_secret TEXT",
        "ALTER TABLE cxm_sources ADD COLUMN analysis_interval TEXT DEFAULT 'manual'",
        "ALTER TABLE cxm_sources ADD COLUMN last_analyzed_at TIMESTAMP",
        "ALTER TABLE cxm_reviews ADD COLUMN content_hash TEXT",
        "ALTER TABLE cxm_reviews ADD COLUMN pain_point TEXT DEFAULT 'other'",
        "ALTER TABLE cxm_reviews ADD COLUMN churn_intent_cluster TEXT DEFAULT 'no_churn_signal'",
        "ALTER TABLE cxm_reviews ADD COLUMN user_segment TEXT DEFAULT 'unknown'",
        "ALTER TABLE cxm_reviews ADD COLUMN growth_opportunity TEXT DEFAULT 'none'",
        "ALTER TABLE cxm_reviews ADD COLUMN main_problem_flag INTEGER DEFAULT 0",
        "ALTER TABLE user_usage ADD COLUMN total_tokens INTEGER DEFAULT 0",
        "ALTER TABLE user_usage ADD COLUMN billable_tokens INTEGER DEFAULT 0",
        "ALTER TABLE user_usage ADD COLUMN llm_enabled_snapshot BOOLEAN DEFAULT 1",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_cxm_reviews_hash ON cxm_reviews(source_id, content_hash)",
    ]:
        try:
            cursor.execute(column_sql)
        except Exception:
            pass  # Column already exists

    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_cxm_reviews_pain_point ON cxm_reviews(user_id, pain_point)",
        "CREATE INDEX IF NOT EXISTS idx_cxm_reviews_churn_cluster ON cxm_reviews(user_id, churn_intent_cluster)",
        "CREATE INDEX IF NOT EXISTS idx_cxm_sources_analysis_interval ON cxm_sources(tenant_id, analysis_interval)",
    ]:
        try:
            cursor.execute(idx_sql)
        except Exception:
            pass

    # Initialize context graph tables for LLM decision provenance
    _initialize_context_graph_schema(cursor)

    for idx, code in enumerate(ACCESS_CODE_SEED, start=1):
        cursor.execute(
            'INSERT OR IGNORE INTO access_codes (code, label) VALUES (?, ?)',
            (code, f'Invite {idx:02d}')
        )
    
    # Initialize enterprise trust audit tables
    from enterprise_trust import create_audit_tables
    create_audit_tables(DB_PATH)
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

def hash_password(password: str) -> str:
    """Hash a password using bcrypt (via security module)."""
    from security import get_password_hash as _bcrypt_hash
    return _bcrypt_hash(password)

def verify_user(email: str, password: str) -> Optional[Dict]:
    """
    Verify user credentials.
    Returns user dict if valid, None otherwise.
    Automatically upgrades legacy SHA-256 hashes to bcrypt on successful login.
    """
    from security import verify_password as _verify, get_password_hash as _bcrypt_hash

    user = get_user_by_email(email)
    if not user:
        return None

    stored = user.get('password_hash') or ''
    is_legacy_sha256 = (
        isinstance(stored, str)
        and len(stored) == 64
        and all(ch in string.hexdigits for ch in stored)
    )

    if is_legacy_sha256:
        legacy_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
        if legacy_hash.lower() != stored.lower():
            return None

        new_hash = _bcrypt_hash(password)
        update_password(user['id'], new_hash)
        user['password_hash'] = new_hash
        return user

    if not _verify(password, stored):
        return None

    return user

def create_user(email: str, password: str, name: str, tenant_id: Optional[int] = None) -> Optional[int]:
    """
    Create a new user.
    Returns user_id if successful, None if email already exists.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # If tenant_id not provided, check if a default tenant should be created or assigned
        if tenant_id is None:
            # Create a default tenant name based on user email domain
            domain = email.split('@')[-1].split('.')[0].capitalize()
            tenant_id = create_tenant(f"{domain} Org")

        password_hash = hash_password(password)
        
        cursor.execute(
            'INSERT INTO users (email, password_hash, name, tenant_id) VALUES (?, ?, ?, ?)',
            (email.lower(), password_hash, name, tenant_id)
        )
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"User created: {email} (ID: {user_id}, Tenant: {tenant_id})")
        return user_id
        
    except sqlite3.IntegrityError:
        # Email already exists
        return None

def get_user_by_email(email: str) -> Optional[Dict]:
    """Get user by email address."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE email = ?', (email.lower(),))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get user by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def normalize_access_code(code: str) -> str:
    return str(code or '').strip().upper()


def get_access_code_record(code: str) -> Optional[Dict[str, Any]]:
    normalized_code = normalize_access_code(code)
    if not normalized_code:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''
        SELECT
            c.code,
            c.label,
            c.claimed_user_id,
            c.created_at,
            c.activated_at,
            u.id AS user_id,
            u.tenant_id,
            u.email,
            u.name,
            p.contact_email,
            p.company,
            p.role,
            p.notes
        FROM access_codes c
        LEFT JOIN users u ON u.id = c.claimed_user_id
        LEFT JOIN access_code_profiles p ON p.user_id = c.claimed_user_id
        WHERE c.code = ?
        ''',
        (normalized_code,),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_access_code_profile(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''
        SELECT user_id, access_code, contact_email, company, role, notes, created_at, updated_at
        FROM access_code_profiles
        WHERE user_id = ?
        ''',
        (user_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def _build_access_code_user_payload(user: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = profile or {}
    return {
        "user": {
            "id": user["id"],
            "tenant_id": user.get("tenant_id"),
            "name": user.get("name"),
            "email": user.get("email"),
        },
        "profile": {
            "access_code": profile.get("access_code"),
            "contact_email": profile.get("contact_email"),
            "company": profile.get("company"),
            "role": profile.get("role"),
            "notes": profile.get("notes"),
        },
    }


def get_access_code_user_payload(code: str) -> Optional[Dict[str, Any]]:
    access_code = get_access_code_record(code)
    user_id = access_code.get("user_id") if access_code else None
    if not user_id:
        return None

    user = get_user_by_id(int(user_id))
    if not user:
        return None

    profile = get_access_code_profile(int(user_id))
    return _build_access_code_user_payload(user, profile)


def claim_access_code_user(
    code: str,
    name: str,
    contact_email: Optional[str] = None,
    company: Optional[str] = None,
    role: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    normalized_code = normalize_access_code(code)
    display_name = (name or '').strip()
    if not normalized_code or not display_name:
        return None

    access_code = get_access_code_record(normalized_code)
    if not access_code:
        return None
    if access_code.get("user_id"):
        return get_access_code_user_payload(normalized_code)

    synthetic_email = f"access_{normalized_code.lower()}@horizon.local"
    synthetic_password = f"{normalized_code}:{uuid.uuid4().hex}"
    user_id = create_user(synthetic_email, synthetic_password, display_name)
    if user_id is None:
        existing_user = get_user_by_email(synthetic_email)
        if not existing_user:
            return None
        user_id = existing_user["id"]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''
        UPDATE access_codes
        SET claimed_user_id = ?, activated_at = CURRENT_TIMESTAMP
        WHERE code = ? AND claimed_user_id IS NULL
        ''',
        (user_id, normalized_code),
    )
    if cursor.rowcount == 0:
        conn.rollback()
        conn.close()
        return get_access_code_user_payload(normalized_code)

    cursor.execute(
        '''
        INSERT INTO access_code_profiles (user_id, access_code, contact_email, company, role, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            access_code = excluded.access_code,
            contact_email = excluded.contact_email,
            company = excluded.company,
            role = excluded.role,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
        ''',
        (
            user_id,
            normalized_code,
            (contact_email or '').strip() or None,
            (company or '').strip() or None,
            (role or '').strip() or None,
            (notes or '').strip() or None,
        ),
    )
    conn.commit()
    conn.close()

    return get_access_code_user_payload(normalized_code)

def create_tenant(name: str) -> Optional[int]:
    """Create a new tenant (company)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO tenants (name) VALUES (?)', (name,))
    tenant_id = cursor.lastrowid
    conn.commit()
    conn.close()
    logger.info(f"Tenant created: {name} (ID: {tenant_id})")
    return tenant_id

def get_tenant_by_id(tenant_id: int) -> Optional[Dict]:
    """Fetch tenant details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tenants WHERE id = ?', (tenant_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_last_login(user_id: int):
    """Update user's last login timestamp."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'UPDATE users SET last_login = ? WHERE id = ?',
        (datetime.now(), user_id)
    )
    
    conn.commit()
    conn.close()

def create_session(user_id: int, session_id: str, days: int = 30) -> bool:
    """
    Create a new session for user.
    Default: 30-day expiration.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(days=days)
        
        cursor.execute(
            'INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)',
            (session_id, user_id, expires_at)
        )
        
        conn.commit()
        conn.close()
        
        logger.info(f"Session created for user {user_id}, expires: {expires_at}")
        return True
        
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return False

def validate_session(session_id: str) -> Optional[Dict]:
    """
    Validate session and return user data if valid.
    Returns None if session is invalid or expired.
    """
    if not session_id:
        return None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get session and join with user data
    cursor.execute('''
        SELECT u.*, s.expires_at 
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ?
    ''', (session_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    # Check if session is expired
    expires_at = datetime.fromisoformat(row['expires_at'])
    if datetime.now() > expires_at:
        # Session expired, delete it
        delete_session(session_id)
        return None
    
    return dict(row)

def delete_session(session_id: str):
    """Delete a session (logout)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
    
    conn.commit()
    conn.close()
    print(f"[DB] Session deleted: {session_id}")

def extend_session(session_id: str, days: int = 30) -> bool:
    """
    Extend session expiration time.
    Called on each page load to keep session alive during active use.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        new_expires_at = datetime.now() + timedelta(days=days)
        
        cursor.execute(
            'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
            (new_expires_at, session_id)
        )
        
        updated = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return updated
        
    except Exception as e:
        print(f"[DB] Error extending session: {e}")
        return False

def cleanup_expired_sessions():
    """Remove all expired sessions from database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM sessions WHERE expires_at < ?', (datetime.now(),))
    deleted = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    if deleted > 0:
        print(f"[DB] Cleaned up {deleted} expired sessions")

def create_reset_token(user_id: int, token: str) -> bool:
    """Create a password reset token (valid for 1 hour)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(hours=1)
        
        cursor.execute(
            'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
            (token, user_id, expires_at)
        )
        
        conn.commit()
        conn.close()
        
        print(f"[DB] Reset token created for user {user_id}")
        return True
        
    except Exception as e:
        print(f"[DB] Error creating reset token: {e}")
        return False

def validate_reset_token(token: str) -> Optional[int]:
    """
    Validate reset token and return user_id if valid.
    Returns None if token is invalid, expired, or already used.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
        (token,)
    )
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    # Check if already used
    if row['used']:
        return None
    
    # Check if expired
    expires_at = datetime.fromisoformat(row['expires_at'])
    if datetime.now() > expires_at:
        return None
    
    return row['user_id']

def mark_token_used(token: str):
    """Mark a reset token as used."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', (token,))
    
    conn.commit()
    conn.close()

def update_password(user_id: int, new_password_hash: str):
    """Update user's password."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        (new_password_hash, user_id)
    )
    
    conn.commit()
    conn.close()
    print(f"[DB] Password updated for user {user_id}")

def update_user_name(user_id: int, new_name: str):
    """Update user's name."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('UPDATE users SET name = ? WHERE id = ?', (new_name, user_id))
    
    conn.commit()
    conn.close()

def save_analysis(user_id: int, tenant_id: int, vertical: str, source_type: str, total_reviews: int, 
                 config: Dict, results: Any) -> Optional[int]:
    """
    Save analysis to history.
    Returns analysis_id.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO analysis_history 
        (user_id, tenant_id, vertical, source_type, total_reviews, config, results)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        tenant_id,
        vertical,
        source_type,
        total_reviews,
        json.dumps(config),
        json.dumps(results, default=str)  # default=str handles datetime objects
    ))
    
    analysis_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"[DB] Analysis saved: ID {analysis_id} for user {user_id} (Tenant: {tenant_id})")
    return analysis_id

def get_user_analyses(user_id: int, tenant_id: int, limit: int = 50, offset: int = 0, 
                     vertical_filter: Optional[str] = None,
                     start_date: Optional[datetime] = None,
                     end_date: Optional[datetime] = None) -> List[Dict]:
    """
    Get tenant's analysis history with optional filters.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Isolation by tenant_id
    query = 'SELECT * FROM analysis_history WHERE tenant_id = ?'
    params: list = [tenant_id]
    
    if vertical_filter:
        query += ' AND vertical = ?'
        params.append(vertical_filter)
    
    if start_date:
        query += ' AND timestamp >= ?'
        params.append(start_date)
    
    if end_date:
        query += ' AND timestamp <= ?'
        params.append(end_date)
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    analyses = []
    for row in rows:
        analysis = dict(row)
        # Parse JSON fields
        analysis['config'] = json.loads(analysis['config'])
        analysis['results'] = json.loads(analysis['results'])
        analyses.append(analysis)
    
    return analyses

def get_analysis_by_id(analysis_id: int, user_id: int, tenant_id: int) -> Optional[Dict]:
    """Get a specific analysis by ID (with tenant_id check for security)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT * FROM analysis_history WHERE id = ? AND tenant_id = ?',
        (analysis_id, tenant_id)
    )
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        analysis = dict(row)
        analysis['config'] = json.loads(analysis['config'])
        analysis['results'] = json.loads(analysis['results'])
        return analysis
    
    return None

def get_user_stats(user_id: int, tenant_id: int) -> Dict:
    """Get user statistics (total analyses, date range, etc.)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            COUNT(*) as total_analyses,
            MIN(timestamp) as first_analysis,
            MAX(timestamp) as last_analysis,
            SUM(total_reviews) as total_reviews_analyzed
        FROM analysis_history
        WHERE user_id = ? AND tenant_id = ?
    ''', (user_id, tenant_id))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else {}


# ==================== USAGE TRACKING FUNCTIONS ====================

def track_analysis_usage(
    user_id: int,
    tenant_id: int,
    analysis_id: Optional[int],
    reviews_count: int,
    cost: float,
    vertical: str,
    total_tokens: int = 0,
    billable_tokens: int = 0,
    llm_enabled_snapshot: bool = True,
):
    """
    Track usage after an analysis is completed.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO user_usage 
        (user_id, tenant_id, analysis_id, reviews_analyzed, cost, vertical, total_tokens, billable_tokens, llm_enabled_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id, tenant_id, analysis_id, reviews_count, cost, vertical,
        int(total_tokens or 0), int(billable_tokens or 0), 1 if llm_enabled_snapshot else 0,
    ))
    
    conn.commit()
    conn.close()
    print(f"[DB] Usage tracked for user {user_id}: {reviews_count} reviews, {int(total_tokens or 0)} tokens, ${cost:.4f}")


def get_usage_stats(user_id: int, tenant_id: int, start_date: Optional[datetime] = None, 
                   end_date: Optional[datetime] = None) -> Dict:
    """
    Get aggregated usage statistics for a user.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            COUNT(*) as total_analyses,
            SUM(reviews_analyzed) as total_reviews,
            SUM(total_tokens) as total_tokens,
            SUM(billable_tokens) as total_billable_tokens,
            SUM(cost) as total_cost,
            AVG(cost) as avg_cost_per_analysis,
            MIN(timestamp) as first_usage,
            MAX(timestamp) as last_usage
        FROM user_usage
        WHERE user_id = ? AND tenant_id = ?
    '''
    params: List[Any] = [user_id, tenant_id]
    
    if start_date:
        query += ' AND timestamp >= ?'
        params.append(start_date)
    
    if end_date:
        query += ' AND timestamp <= ?'
        params.append(end_date)
    
    cursor.execute(query, params)
    row = cursor.fetchone()
    
    stats: Dict[str, Any] = dict(row) if row else {}
    
    # Get breakdown by vertical
    cursor.execute('''
        SELECT vertical, COUNT(*) as count, SUM(reviews_analyzed) as reviews, SUM(total_tokens) as tokens, SUM(cost) as cost
        FROM user_usage
        WHERE user_id = ? AND tenant_id = ?
        GROUP BY vertical
        ORDER BY cost DESC
    ''', (user_id, tenant_id))
    
    stats['by_vertical'] = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return stats


def get_usage_trends(user_id: int, tenant_id: int, days: int = 90) -> List[Dict]:
    """
    Get daily usage trends for charts.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    start_date = datetime.now() - timedelta(days=days)
    
    cursor.execute('''
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) as analyses,
            SUM(reviews_analyzed) as reviews,
            SUM(total_tokens) as tokens,
            SUM(cost) as cost
        FROM user_usage
        WHERE user_id = ? AND tenant_id = ? AND timestamp >= ?
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    ''', (user_id, tenant_id, start_date))
    
    return [dict(row) for row in cursor.fetchall()]


def calculate_billing_summary(user_id: int, tenant_id: int, month: int, year: int) -> Dict:
    """
    Calculate billing summary for a specific month.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if billing record exists
    cursor.execute('''
        SELECT * FROM billing_history
        WHERE user_id = ? AND tenant_id = ? AND month = ? AND year = ?
    ''', (user_id, tenant_id, month, year))
    
    existing = cursor.fetchone()
    
    if existing:
        conn.close()
        return dict(existing)
    
    # Calculate from usage data
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    cursor.execute('''
        SELECT 
            COUNT(*) as total_analyses,
            SUM(reviews_analyzed) as total_reviews,
            SUM(billable_tokens) as total_billable_tokens,
            SUM(cost) as total_cost
        FROM user_usage
        WHERE user_id = ? AND tenant_id = ? AND timestamp >= ? AND timestamp < ?
    ''', (user_id, tenant_id, start_date, end_date))
    
    row = cursor.fetchone()
    
    if row and row['total_analyses'] > 0:
        # Create billing record
        cursor.execute('''
            INSERT INTO billing_history 
            (user_id, tenant_id, month, year, total_analyses, total_reviews, total_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, tenant_id, month, year, row['total_analyses'], row['total_reviews'] or 0, row['total_cost'] or 0.0))
        
        conn.commit()
        
        billing_id = cursor.lastrowid
        cursor.execute('SELECT * FROM billing_history WHERE id = ?', (billing_id,))
        result = dict(cursor.fetchone())
    else:
        result = {
            'user_id': user_id,
            'month': month,
            'year': year,
            'total_analyses': 0,
            'total_reviews': 0,
            'total_cost': 0.0
        }
    
    conn.close()
    return result


def _ensure_llm_preferences_schema(conn=None) -> None:
    own_conn = conn is None
    db = conn or get_db_connection()
    cursor = db.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS llm_preferences (
            user_id INTEGER PRIMARY KEY,
            tenant_id INTEGER,
            is_enabled BOOLEAN DEFAULT 1,
            billing_enabled BOOLEAN DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_llm_preferences_tenant ON llm_preferences(tenant_id)')
    if own_conn:
        db.commit()
        db.close()


def get_llm_preferences(user_id: int, tenant_id: Optional[int] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    _ensure_llm_preferences_schema(conn)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, tenant_id, is_enabled, billing_enabled, updated_at FROM llm_preferences WHERE user_id = ?",
        (user_id,),
    )
    row = cursor.fetchone()
    if row:
        conn.close()
        result = dict(row)
        result["is_enabled"] = bool(result.get("is_enabled", 1))
        result["billing_enabled"] = bool(result.get("billing_enabled", 1))
        return result

    cursor.execute(
        "INSERT OR IGNORE INTO llm_preferences (user_id, tenant_id, is_enabled, billing_enabled) VALUES (?, ?, 1, 1)",
        (user_id, tenant_id),
    )
    conn.commit()
    conn.close()
    return {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "is_enabled": True,
        "billing_enabled": True,
    }


def set_llm_preferences(
    user_id: int,
    tenant_id: Optional[int] = None,
    *,
    is_enabled: Optional[bool] = None,
    billing_enabled: Optional[bool] = None,
) -> Dict[str, Any]:
    current = get_llm_preferences(user_id, tenant_id)
    next_enabled = current["is_enabled"] if is_enabled is None else bool(is_enabled)
    next_billing = current["billing_enabled"] if billing_enabled is None else bool(billing_enabled)

    conn = get_db_connection()
    _ensure_llm_preferences_schema(conn)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO llm_preferences (user_id, tenant_id, is_enabled, billing_enabled, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            is_enabled = excluded.is_enabled,
            billing_enabled = excluded.billing_enabled,
            updated_at = CURRENT_TIMESTAMP
        """,
        (user_id, tenant_id, 1 if next_enabled else 0, 1 if next_billing else 0),
    )
    conn.commit()
    conn.close()
    return get_llm_preferences(user_id, tenant_id)


def get_llm_usage_summary(user_id: int, tenant_id: int) -> Dict[str, Any]:
    prefs = get_llm_preferences(user_id, tenant_id)
    usage = get_usage_stats(user_id, tenant_id)
    trends = get_usage_trends(user_id, tenant_id, days=30)
    now = datetime.now()
    billing = calculate_billing_summary(user_id, tenant_id, now.month, now.year)
    return {
        "preferences": prefs,
        "usage": usage,
        "trends": trends,
        "billing": billing,
    }


def get_or_create_guest_user(device_id: str) -> Optional[int]:
    """
    Gets or creates an anonymous shadow user for a given device ID.
    Used for tracking free beta limits without requiring signup.
    """
    # Consistent pseudo-email for this device
    email = f"guest_{device_id}@horizon.local"
    
    # Check if exists
    user = get_user_by_email(email)
    if user:
        return user['id']
        
    # Create new empty guest
    # Using the device_id itself as a stub password hash so verify_user isn't used
    user_id = create_user(email, device_id, f"Guest {str(device_id)[:6]}")
    return user_id

def get_user_analyses_count(user_id: int) -> int:
    """Get the total number of analyses run by a user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM analysis_history WHERE user_id = ?', (user_id,))
    count = cursor.fetchone()[0]
    conn.close()
    return count


def export_user_data(user_id: int) -> Dict[str, Any]:
    """
    Export all user data for download.
    Returns a dictionary with all user information.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # User profile
    cursor.execute('SELECT id, email, name, created_at, last_login FROM users WHERE id = ?', (user_id,))
    user_data = dict(cursor.fetchone())
    
    # Analysis history
    cursor.execute('SELECT * FROM analysis_history WHERE user_id = ? ORDER BY timestamp DESC', (user_id,))
    analyses = []
    for row in cursor.fetchall():
        analysis = dict(row)
        analysis['config'] = json.loads(analysis['config'])
        analysis['results'] = json.loads(analysis['results'])
        analyses.append(analysis)
    
    # Support tickets
    cursor.execute('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    tickets = [dict(row) for row in cursor.fetchall()]
    
    # Ticket messages
    for ticket in tickets:
        cursor.execute('''
            SELECT m.*, u.name as user_name
            FROM ticket_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.ticket_id = ?
            ORDER BY m.created_at ASC
        ''', (ticket['id'],))
        ticket['messages'] = [dict(row) for row in cursor.fetchall()]
    
    # Usage data
    cursor.execute('SELECT * FROM user_usage WHERE user_id = ? ORDER BY timestamp DESC', (user_id,))
    usage = [dict(row) for row in cursor.fetchall()]
    
    # Billing history
    cursor.execute('SELECT * FROM billing_history WHERE user_id = ? ORDER BY year DESC, month DESC', (user_id,))
    billing = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        'user': user_data,
        'analyses': analyses,
        'tickets': tickets,
        'usage': usage,
        'billing': billing,
        'export_date': datetime.now().isoformat()
    }


def delete_user_account(user_id: int, hard_delete: bool = False):
    """
    Delete user account and all associated data.
    If hard_delete=True, permanently removes data.
    If hard_delete=False, could implement soft delete (mark as deleted).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if hard_delete:
        # Hard delete - remove all user data
        # Foreign keys with CASCADE will handle related records
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        print(f"[DB] User {user_id} and all associated data permanently deleted")
    else:
        # Could implement soft delete here if needed
        # For now, just do hard delete
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        print(f"[DB] User {user_id} deleted")
    
    conn.close()


# ==================== SUPPORT TICKET FUNCTIONS ====================

def create_ticket(user_id: int, subject: str, description: str, priority: str = 'medium') -> Optional[int]:
    """
    Create a new support ticket.
    Returns ticket_id.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO support_tickets 
        (user_id, subject, description, priority, status)
        VALUES (?, ?, ?, ?, 'open')
    ''', (user_id, subject, description, priority))
    
    ticket_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"[DB] Ticket created: ID {ticket_id} for user {user_id}")
    return ticket_id

def get_user_tickets(user_id: int, status_filter: Optional[str] = None) -> List[Dict]:
    """
    Get all tickets for a specific user with optional status filter.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            t.*,
            (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
            (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = t.id) as last_message_at
        FROM support_tickets t
        WHERE user_id = ?
    '''
    params: List[Any] = [user_id]
    
    if status_filter:
        query += ' AND status = ?'
        params.append(status_filter)
    
    query += ' ORDER BY updated_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_all_tickets(status_filter: Optional[str] = None, priority_filter: Optional[str] = None) -> List[Dict]:
    """
    Get all tickets (admin function) with optional filters.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            t.*,
            u.name as user_name,
            u.email as user_email,
            (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
            (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = t.id) as last_message_at
        FROM support_tickets t
        JOIN users u ON t.user_id = u.id
        WHERE 1=1
    '''
    params = []
    
    if status_filter:
        query += ' AND t.status = ?'
        params.append(status_filter)
    
    if priority_filter:
        query += ' AND t.priority = ?'
        params.append(priority_filter)
    
    query += ' ORDER BY t.updated_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_ticket_by_id(ticket_id: int) -> Optional[Dict]:
    """
    Get a specific ticket by ID with user information.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            t.*,
            u.name as user_name,
            u.email as user_email,
            (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
        FROM support_tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = ?
    ''', (ticket_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def update_ticket_status(ticket_id: int, status: str, resolved_by: Optional[int] = None):
    """
    Update ticket status and optionally mark as resolved.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if status == 'resolved' or status == 'closed':
        cursor.execute('''
            UPDATE support_tickets 
            SET status = ?, updated_at = ?, resolved_at = ?, resolved_by = ?
            WHERE id = ?
        ''', (status, datetime.now(), datetime.now(), resolved_by, ticket_id))
    else:
        cursor.execute('''
            UPDATE support_tickets 
            SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (status, datetime.now(), ticket_id))
    
    conn.commit()
    conn.close()
    print(f"[DB] Ticket {ticket_id} status updated to: {status}")

def add_ticket_message(ticket_id: int, user_id: int, message: str, is_admin: bool = False) -> Optional[int]:
    """
    Add a message to a ticket.
    Returns message_id.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO ticket_messages 
        (ticket_id, user_id, message, is_admin)
        VALUES (?, ?, ?, ?)
    ''', (ticket_id, user_id, message, is_admin))
    
    message_id = cursor.lastrowid
    
    # Update ticket's updated_at timestamp
    cursor.execute('''
        UPDATE support_tickets 
        SET updated_at = ?
        WHERE id = ?
    ''', (datetime.now(), ticket_id))
    
    conn.commit()
    conn.close()
    
    print(f"[DB] Message added to ticket {ticket_id}")
    return message_id

def get_ticket_messages(ticket_id: int) -> List[Dict]:
    """
    Get all messages for a ticket.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            m.*,
            u.name as user_name,
            u.email as user_email
        FROM ticket_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.ticket_id = ?
        ORDER BY m.created_at ASC
    ''', (ticket_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_ticket_stats() -> Dict:
    """
    Get ticket statistics for admin dashboard.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total tickets by status
    cursor.execute('''
        SELECT status, COUNT(*) as count
        FROM support_tickets
        GROUP BY status
    ''')
    status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
    
    # Total tickets
    cursor.execute('SELECT COUNT(*) as total FROM support_tickets')
    total_tickets = cursor.fetchone()['total']
    
    # Tickets resolved today
    today = datetime.now().date()
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM support_tickets
        WHERE DATE(resolved_at) = ?
    ''', (today,))
    resolved_today = cursor.fetchone()['count']
    
    conn.close()
    
    return {
        'total_tickets': total_tickets,
        'open_tickets': status_counts.get('open', 0),
        'in_progress_tickets': status_counts.get('in_progress', 0),
        'resolved_tickets': status_counts.get('resolved', 0),
        'closed_tickets': status_counts.get('closed', 0),
        'resolved_today': resolved_today  
    }


# ==================== GOOGLE DRIVE CONFIG FUNCTIONS (NEW) ====================

def save_gdrive_credentials(user_id: int, credentials_json: str, auth_type: str = 'service_account') -> bool:
    """
    Save or update Google Drive credentials for a user.
    
    Args:
        user_id: User ID
        credentials_json: JSON string of credentials
        auth_type: Type of authentication ('service_account' or 'oauth')
        
    Returns:
        bool: True if successful
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if config exists
        cursor.execute('SELECT user_id FROM gdrive_config WHERE user_id = ?', (user_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing
            cursor.execute('''
                UPDATE gdrive_config
                SET credentials_json = ?, auth_type = ?, last_authenticated = ?, is_active = 1
                WHERE user_id = ?
            ''', (credentials_json, auth_type, datetime.now(), user_id))
        else:
            # Insert new
            cursor.execute('''
                INSERT INTO gdrive_config (user_id, credentials_json, auth_type, last_authenticated, is_active)
                VALUES (?, ?, ?, ?, 1)
            ''', (user_id, credentials_json, auth_type, datetime.now()))
        
        conn.commit()
        conn.close()
        
        print(f"[DB] Google Drive credentials saved for user {user_id}")
        return True
        
    except Exception as e:
        print(f"[DB] Error saving Google Drive credentials: {e}")
        return False


def get_gdrive_credentials(user_id: int) -> Optional[Dict]:
    """
    Get Google Drive credentials for a user.
    
    Args:
        user_id: User ID
        
    Returns:
        Dict with credentials info or None
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM gdrive_config WHERE user_id = ? AND is_active = 1', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def delete_gdrive_credentials(user_id: int) -> bool:
    """
    Delete Google Drive credentials for a user (mark as inactive).
    
    Args:
        user_id: User ID
        
    Returns:
        bool: True if successful
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Soft delete - mark as inactive
        cursor.execute('UPDATE gdrive_config SET is_active = 0 WHERE user_id = ?', (user_id,))
        
        conn.commit()
        conn.close()
        
        print(f"[DB] Google Drive credentials deleted for user {user_id}")
        return True
        
    except Exception as e:
        print(f"[DB] Error deleting Google Drive credentials: {e}")
        return False


def is_gdrive_configured(user_id: int) -> bool:
    """
    Check if user has Google Drive configured.
    
    Args:
        user_id: User ID
        
    Returns:
        bool: True if configured
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT user_id FROM gdrive_config WHERE user_id = ? AND is_active = 1', (user_id,))
    result = cursor.fetchone()
    conn.close()
    
    return result is not None

# ==================== CONNECTOR MANAGEMENT ====================

def get_user_connectors(
    user_id: int,
    tenant_id: int,
    workspace_id: Optional[int] = None,
    connector_scope: Optional[str] = None,
) -> List[Dict]:
    """Fetch saved data source connectors for a tenant, leveraging the CXM source system."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Scoped by tenant_id for sharing within company
    query = 'SELECT * FROM cxm_sources WHERE tenant_id = ? AND is_active = 1'
    params = [tenant_id]
    
    if workspace_id is not None:
        query += ' AND workspace_id = ?'
        params.append(workspace_id)
        
    query += ' ORDER BY created_at DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        d: Dict[str, Any] = dict(row)
        try:
            cfg = json.loads(d.get('config') or '{}')
        except Exception:
            cfg = {}
        row_scope = cfg.get('_scope') or cfg.get('integration_scope') or 'workspace'
        if connector_scope and row_scope != connector_scope:
            continue
        # ── Security: mask auth credentials ──
        for secret_key in ("auth_value", "token", "client_secret", "password", "access_token", "api_key"):
            if secret_key in cfg and cfg.get(secret_key):
                cfg[secret_key] = "********"
        d['config'] = cfg
        d['scope'] = row_scope
        d['analysis_interval'] = d.get('analysis_interval') or cfg.get('analysis_interval') or 'manual'
        # ── Alias source_type → connector_type for frontend compatibility ──
        d['connector_type'] = d.get('source_type', '')
        d['name'] = d.get('display_name') or d.get('name') or f"{d.get('source_type', '')}: {d.get('identifier', '')}"
        result.append(d)
    return result

def save_user_connector(
    user_id: int,
    tenant_id: int,
    connector_type: str,
    identifier: str,
    name: Optional[str] = None,
    config: Optional[Dict] = None,
    workspace_id: Optional[int] = None,
    fetch_interval: str = 'daily',
    analysis_interval: Optional[str] = None,
    connector_scope: Optional[str] = None,
):
    """Save or update a data source connector in the cxm_sources table."""
    conn = get_db_connection()
    cursor = conn.cursor()

    scope_value = connector_scope or 'workspace'
    valid_intervals = {'manual', 'hourly', 'daily', 'weekly', 'on_new'}
    fetch_interval = (fetch_interval or 'daily').strip().lower()
    if fetch_interval not in valid_intervals:
        fetch_interval = 'daily'
    resolved_analysis_interval = (analysis_interval or '').strip().lower()
    if resolved_analysis_interval not in valid_intervals:
        if scope_value == 'feedback_crm':
            resolved_analysis_interval = 'manual'
        else:
            resolved_analysis_interval = fetch_interval if fetch_interval != 'manual' else 'manual'

    config_payload = dict(config or {})
    config_payload['_scope'] = scope_value
    config_json = json.dumps(config_payload)
    display_name = name or f"{connector_type.capitalize()}: {identifier}"

    cursor.execute('''
        SELECT id, config FROM cxm_sources
        WHERE user_id = ? AND source_type = ? AND identifier = ?
    ''', (user_id, connector_type, identifier))
    rows = cursor.fetchall()

    row = None
    for candidate in rows:
        try:
            candidate_cfg = json.loads(candidate['config'] or '{}')
        except Exception:
            candidate_cfg = {}
        candidate_scope = candidate_cfg.get('_scope') or candidate_cfg.get('integration_scope') or 'workspace'
        if candidate_scope == scope_value:
            row = candidate
            break

    if row:
        cursor.execute('''
            UPDATE cxm_sources
            SET display_name = ?, config = ?, fetch_interval = ?, analysis_interval = ?, is_active = 1, workspace_id = ?, tenant_id = ?
            WHERE id = ?
        ''', (display_name, config_json, fetch_interval, resolved_analysis_interval, workspace_id, tenant_id, row['id']))
        source_id = row['id']
    else:
        cursor.execute('''
            INSERT INTO cxm_sources (user_id, tenant_id, workspace_id, source_type, identifier, display_name, config, fetch_interval, analysis_interval)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, tenant_id, workspace_id, connector_type, identifier, display_name, config_json, fetch_interval, resolved_analysis_interval))
        source_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return source_id

def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _delete_rows_by_ids(cursor, table_name: str, column_name: str, row_ids: List[int]) -> int:
    if not row_ids or not _table_exists(cursor, table_name):
        return 0
    placeholders = ",".join("?" * len(row_ids))
    cursor.execute(
        f"DELETE FROM {table_name} WHERE {column_name} IN ({placeholders})",
        row_ids,
    )
    return cursor.rowcount or 0


def _delete_rows_with_params(cursor, table_name: str, where_clause: str, params: tuple = ()) -> int:
    if not _table_exists(cursor, table_name):
        return 0
    cursor.execute(f"DELETE FROM {table_name} WHERE {where_clause}", params)
    return cursor.rowcount or 0


def _update_source_id_lists(cursor, table_name: str, tenant_id: int, removed_source_id: int) -> Dict[str, int]:
    if not _table_exists(cursor, table_name):
        return {"deleted": 0, "updated": 0}

    cursor.execute(
        f"SELECT id, source_ids_json FROM {table_name} WHERE tenant_id = ?",
        (tenant_id,),
    )
    delete_ids: List[int] = []
    update_rows: List[tuple] = []
    for row in cursor.fetchall():
        raw_ids = row["source_ids_json"]
        try:
            parsed_ids = json.loads(raw_ids or "[]")
        except Exception:
            parsed_ids = []
        if not isinstance(parsed_ids, list):
            parsed_ids = []

        normalized_ids: List[int] = []
        for value in parsed_ids:
            try:
                normalized_ids.append(int(str(value).strip()))
            except (TypeError, ValueError):
                continue

        if removed_source_id not in normalized_ids:
            continue

        remaining_ids = [value for value in normalized_ids if value != removed_source_id]
        if remaining_ids:
            update_rows.append((json.dumps(remaining_ids), row["id"]))
        else:
            delete_ids.append(row["id"])

    updated = 0
    if update_rows:
        cursor.executemany(
            f"UPDATE {table_name} SET source_ids_json = ? WHERE id = ?",
            update_rows,
        )
        updated = cursor.rowcount or 0

    deleted = _delete_rows_by_ids(cursor, table_name, "id", delete_ids)
    return {"deleted": deleted, "updated": updated}


def _collect_feedback_ids_for_connector(
    cursor,
    tenant_id: int,
    connector_id: int,
    connector: Optional[Dict[str, Any]] = None,
) -> List[int]:
    if not _table_exists(cursor, "fi_feedback"):
        return []

    source_type = str((connector or {}).get("source_type") or "").strip().lower()
    identifier = str((connector or {}).get("identifier") or "").strip()
    display_name = str((connector or {}).get("display_name") or "").strip()

    source_labels: set[str] = set()
    for value in (display_name, identifier):
        normalized = str(value or "").strip()
        if normalized:
            source_labels.add(normalized.lower())
    if display_name and identifier and display_name.lower() != identifier.lower():
        source_labels.add(f"{display_name} ({identifier})".strip().lower())

    review_fingerprints: set[tuple[str, str]] = set()
    if _table_exists(cursor, "cxm_reviews"):
        cursor.execute(
            """
            SELECT content, reviewed_at
            FROM cxm_reviews
            WHERE tenant_id = ? AND source_id = ?
            """,
            (tenant_id, connector_id),
        )
        for review_row in cursor.fetchall():
            content = str(review_row["content"] or "").strip()
            reviewed_at = str(review_row["reviewed_at"] or "").strip()
            if content:
                review_fingerprints.add((content, reviewed_at))

    cursor.execute(
        """
        SELECT id, text, source, source_type, created_at, metadata_json
        FROM fi_feedback
        WHERE tenant_id = ?
        """,
        (tenant_id,),
    )
    feedback_ids: List[int] = []
    for row in cursor.fetchall():
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except Exception:
            metadata = {}
        if not isinstance(metadata, dict):
            metadata = {}

        bound_source_id: Optional[int] = None
        try:
            bound_source_id = int(str(metadata.get("cxm_source_id")).strip())
        except (TypeError, ValueError):
            bound_source_id = None

        if bound_source_id == connector_id:
            feedback_ids.append(int(row["id"]))
            continue
        if bound_source_id is not None:
            # Explicitly linked to a different connector; do not infer-delete.
            continue

        row_source_type = str(row["source_type"] or "").strip().lower()
        if source_type and row_source_type and row_source_type != source_type:
            continue

        metadata_source_identifier = str(metadata.get("cxm_source_identifier") or "").strip().lower()
        if identifier and metadata_source_identifier and metadata_source_identifier == identifier.lower():
            feedback_ids.append(int(row["id"]))
            continue

        metadata_source_name = str(metadata.get("cxm_source_name") or "").strip().lower()
        if metadata_source_name and metadata_source_name in source_labels:
            feedback_ids.append(int(row["id"]))
            continue

        row_source = str(row["source"] or "").strip().lower()
        if row_source and row_source in source_labels:
            feedback_ids.append(int(row["id"]))
            continue

        content = str(row["text"] or "").strip()
        created_at = str(row["created_at"] or "").strip()
        if content and (content, created_at) in review_fingerprints:
            feedback_ids.append(int(row["id"]))

    return feedback_ids


def _collect_legacy_orphan_feedback_ids(cursor, tenant_id: int) -> List[int]:
    if not _table_exists(cursor, "fi_feedback") or not _table_exists(cursor, "cxm_sources"):
        return []

    cursor.execute(
        """
        SELECT id, source_type, identifier, display_name
        FROM cxm_sources
        WHERE tenant_id = ? AND is_active = 1
        """,
        (tenant_id,),
    )
    active_source_ids: set[int] = set()
    active_identifiers_by_type: Dict[str, set[str]] = {}
    active_labels_by_type: Dict[str, set[str]] = {}
    for row in cursor.fetchall():
        source_id = int(row["id"])
        active_source_ids.add(source_id)

        source_type = str(row["source_type"] or "").strip().lower()
        if not source_type:
            continue

        identifier = str(row["identifier"] or "").strip()
        display_name = str(row["display_name"] or "").strip()
        identifiers = active_identifiers_by_type.setdefault(source_type, set())
        labels = active_labels_by_type.setdefault(source_type, set())

        if identifier:
            identifiers.add(identifier.lower())
            labels.add(identifier.lower())
        if display_name:
            labels.add(display_name.lower())
        if display_name and identifier and display_name.lower() != identifier.lower():
            labels.add(f"{display_name} ({identifier})".strip().lower())

    cursor.execute(
        """
        SELECT id, source, source_type, metadata_json
        FROM fi_feedback
        WHERE tenant_id = ?
        """,
        (tenant_id,),
    )

    connector_source_types = {
        "playstore",
        "appstore",
        "trustpilot",
        "surveymonkey",
        "typeform",
        "crm",
        "salesforce",
        "generic_api",
        "api",
        "webhook",
        "csv",
    }
    manual_source_types = {"", "manual", "other", "feedback_crm", "workspace", "app_review"}

    orphan_ids: List[int] = []
    for row in cursor.fetchall():
        row_id = int(row["id"])
        row_source_type = str(row["source_type"] or "").strip().lower()
        row_source = str(row["source"] or "").strip().lower()

        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except Exception:
            metadata = {}
        if not isinstance(metadata, dict):
            metadata = {}

        bound_source_id: Optional[int] = None
        try:
            bound_source_id = int(str(metadata.get("cxm_source_id")).strip())
        except (TypeError, ValueError):
            bound_source_id = None

        if bound_source_id is not None:
            if bound_source_id not in active_source_ids:
                orphan_ids.append(row_id)
            continue

        if row_source_type in manual_source_types:
            continue

        metadata_source_identifier = str(metadata.get("cxm_source_identifier") or "").strip().lower()
        metadata_source_name = str(metadata.get("cxm_source_name") or "").strip().lower()
        row_identifiers = active_identifiers_by_type.get(row_source_type, set())
        row_labels = active_labels_by_type.get(row_source_type, set())

        has_active_match = False
        if metadata_source_identifier and metadata_source_identifier in row_identifiers:
            has_active_match = True
        elif metadata_source_name and metadata_source_name in row_labels:
            has_active_match = True
        elif row_source and row_source in row_labels:
            has_active_match = True

        if has_active_match:
            continue

        has_cxm_marker = any(str(key).startswith("cxm_") for key in metadata.keys())
        if has_cxm_marker or row_source_type in connector_source_types:
            orphan_ids.append(row_id)

    return orphan_ids


def _purge_legacy_orphan_feedback_rows(cursor, tenant_id: int) -> Dict[str, int]:
    cleanup_counts = {
        "fi_feedback_deleted": 0,
        "fi_outreach_drafts_deleted": 0,
        "fi_analysis_results_deleted": 0,
        "fi_customers_deleted": 0,
        "fi_issues_deleted": 0,
    }

    orphan_feedback_ids = _collect_legacy_orphan_feedback_ids(cursor, tenant_id)
    if not orphan_feedback_ids:
        return cleanup_counts

    cleanup_counts["fi_outreach_drafts_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_outreach_drafts",
        "feedback_id",
        orphan_feedback_ids,
    )
    cleanup_counts["fi_analysis_results_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_analysis_results",
        "feedback_id",
        orphan_feedback_ids,
    )
    cleanup_counts["fi_feedback_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_feedback",
        "id",
        orphan_feedback_ids,
    )

    orphan_cleanup = _cleanup_feedback_crm_orphans(cursor, tenant_id)
    cleanup_counts["fi_outreach_drafts_deleted"] += orphan_cleanup["outreach_drafts_deleted"]
    cleanup_counts["fi_analysis_results_deleted"] += orphan_cleanup["analysis_results_deleted"]
    cleanup_counts["fi_customers_deleted"] = orphan_cleanup["customers_deleted"]
    cleanup_counts["fi_issues_deleted"] = orphan_cleanup["issues_deleted"]
    return cleanup_counts


def _cleanup_feedback_crm_orphans(cursor, tenant_id: int) -> Dict[str, int]:
    cleanup_counts = {
        "customers_deleted": 0,
        "issues_deleted": 0,
        "analysis_results_deleted": 0,
        "outreach_drafts_deleted": 0,
    }

    if _table_exists(cursor, "fi_outreach_drafts") and _table_exists(cursor, "fi_feedback"):
        cursor.execute(
            """
            DELETE FROM fi_outreach_drafts
            WHERE tenant_id = ?
              AND feedback_id NOT IN (
                  SELECT id FROM fi_feedback WHERE tenant_id = ?
              )
            """,
            (tenant_id, tenant_id),
        )
        cleanup_counts["outreach_drafts_deleted"] = cursor.rowcount or 0

    if _table_exists(cursor, "fi_analysis_results"):
        if _table_exists(cursor, "fi_feedback"):
            cursor.execute(
                """
                DELETE FROM fi_analysis_results
                WHERE tenant_id = ?
                  AND feedback_id NOT IN (
                      SELECT id FROM fi_feedback WHERE tenant_id = ?
                  )
                """,
                (tenant_id, tenant_id),
            )
            cleanup_counts["analysis_results_deleted"] += cursor.rowcount or 0
        if _table_exists(cursor, "fi_analysis_runs"):
            cursor.execute(
                """
                DELETE FROM fi_analysis_results
                WHERE tenant_id = ?
                  AND analysis_run_id NOT IN (
                      SELECT id FROM fi_analysis_runs WHERE tenant_id = ?
                  )
                """,
                (tenant_id, tenant_id),
            )
            cleanup_counts["analysis_results_deleted"] += cursor.rowcount or 0

    if _table_exists(cursor, "fi_customers") and _table_exists(cursor, "fi_feedback"):
        cursor.execute(
            """
            DELETE FROM fi_customers
            WHERE tenant_id = ?
              AND id NOT IN (
                  SELECT DISTINCT customer_id
                  FROM fi_feedback
                  WHERE tenant_id = ? AND customer_id IS NOT NULL
              )
            """,
            (tenant_id, tenant_id),
        )
        cleanup_counts["customers_deleted"] = cursor.rowcount or 0

    if _table_exists(cursor, "fi_issues") and _table_exists(cursor, "fi_feedback"):
        cursor.execute(
            """
            DELETE FROM fi_issues
            WHERE tenant_id = ?
              AND id NOT IN (
                  SELECT DISTINCT issue_id
                  FROM fi_feedback
                  WHERE tenant_id = ? AND issue_id IS NOT NULL
              )
            """,
            (tenant_id, tenant_id),
        )
        cleanup_counts["issues_deleted"] = cursor.rowcount or 0

    return cleanup_counts


def _purge_connector_loaded_data(cursor, connector: Dict[str, Any]) -> Dict[str, int]:
    connector_id = int(connector["id"])
    tenant_id = int(connector["tenant_id"])
    source_type = str(connector.get("source_type") or "").strip()
    identifier = str(connector.get("identifier") or "").strip()
    workspace_id = connector.get("workspace_id")

    cleanup_counts = {
        "raw_reviews_deleted": 0,
        "cxm_reviews_deleted": 0,
        "fi_feedback_deleted": 0,
        "fi_outreach_drafts_deleted": 0,
        "fi_analysis_results_deleted": 0,
        "fi_analysis_runs_deleted": 0,
        "fi_analysis_runs_updated": 0,
        "fi_fetch_runs_deleted": 0,
        "fi_fetch_runs_updated": 0,
        "fi_customers_deleted": 0,
        "fi_issues_deleted": 0,
    }

    if source_type and identifier and _table_exists(cursor, "raw_reviews"):
        if workspace_id is None:
            cursor.execute(
                """
                DELETE FROM raw_reviews
                WHERE tenant_id = ?
                  AND LOWER(TRIM(source_type)) = LOWER(TRIM(?))
                  AND LOWER(TRIM(identifier)) = LOWER(TRIM(?))
                  AND workspace_id IS NULL
                """,
                (tenant_id, source_type, identifier),
            )
        else:
            cursor.execute(
                """
                DELETE FROM raw_reviews
                WHERE tenant_id = ?
                  AND LOWER(TRIM(source_type)) = LOWER(TRIM(?))
                  AND LOWER(TRIM(identifier)) = LOWER(TRIM(?))
                  AND workspace_id = ?
                """,
                (tenant_id, source_type, identifier, workspace_id),
            )
        cleanup_counts["raw_reviews_deleted"] = cursor.rowcount or 0

    cleanup_counts["cxm_reviews_deleted"] = _delete_rows_with_params(
        cursor,
        "cxm_reviews",
        "source_id = ? AND tenant_id = ?",
        (connector_id, tenant_id),
    )

    feedback_ids = _collect_feedback_ids_for_connector(
        cursor,
        tenant_id,
        connector_id,
        connector=connector,
    )
    cleanup_counts["fi_outreach_drafts_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_outreach_drafts",
        "feedback_id",
        feedback_ids,
    )
    cleanup_counts["fi_analysis_results_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_analysis_results",
        "feedback_id",
        feedback_ids,
    )
    cleanup_counts["fi_feedback_deleted"] = _delete_rows_by_ids(
        cursor,
        "fi_feedback",
        "id",
        feedback_ids,
    )

    analysis_run_changes = _update_source_id_lists(
        cursor,
        "fi_analysis_runs",
        tenant_id,
        connector_id,
    )
    cleanup_counts["fi_analysis_runs_deleted"] = analysis_run_changes["deleted"]
    cleanup_counts["fi_analysis_runs_updated"] = analysis_run_changes["updated"]

    fetch_run_changes = _update_source_id_lists(
        cursor,
        "fi_fetch_runs",
        tenant_id,
        connector_id,
    )
    cleanup_counts["fi_fetch_runs_deleted"] = fetch_run_changes["deleted"]
    cleanup_counts["fi_fetch_runs_updated"] = fetch_run_changes["updated"]

    orphan_cleanup = _cleanup_feedback_crm_orphans(cursor, tenant_id)
    cleanup_counts["fi_outreach_drafts_deleted"] += orphan_cleanup["outreach_drafts_deleted"]
    cleanup_counts["fi_analysis_results_deleted"] += orphan_cleanup["analysis_results_deleted"]
    cleanup_counts["fi_customers_deleted"] = orphan_cleanup["customers_deleted"]
    cleanup_counts["fi_issues_deleted"] = orphan_cleanup["issues_deleted"]
    return cleanup_counts


def delete_user_connector(connector_id: int, tenant_id: int) -> Dict[str, Any]:
    """Remove a connector and purge its loaded review data for the tenant."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM cxm_sources WHERE id = ? AND tenant_id = ?",
        (connector_id, tenant_id),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return {"connector_deleted": False}

    connector = dict(row)
    cleanup_counts = _purge_connector_loaded_data(cursor, connector)
    cursor.execute(
        "DELETE FROM cxm_sources WHERE id = ? AND tenant_id = ?",
        (connector_id, tenant_id),
    )
    connector_deleted = (cursor.rowcount or 0) > 0
    conn.commit()
    conn.close()
    return {
        "connector_deleted": connector_deleted,
        "connector_id": connector_id,
        **cleanup_counts,
    }


def purge_inactive_connectors(
    tenant_id: int,
    *,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Permanently remove inactive connectors and purge their loaded data.
    This is a safety cleanup for legacy soft-deleted connector rows.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    result = {
        "tenant_id": tenant_id,
        "inactive_connectors_found": 0,
        "inactive_connectors_deleted": 0,
        "raw_reviews_deleted": 0,
        "cxm_reviews_deleted": 0,
        "fi_feedback_deleted": 0,
        "fi_outreach_drafts_deleted": 0,
        "fi_analysis_results_deleted": 0,
        "fi_analysis_runs_deleted": 0,
        "fi_analysis_runs_updated": 0,
        "fi_fetch_runs_deleted": 0,
        "fi_fetch_runs_updated": 0,
        "fi_customers_deleted": 0,
        "fi_issues_deleted": 0,
    }

    if not _table_exists(cursor, "cxm_sources"):
        conn.close()
        return result

    query = "SELECT * FROM cxm_sources WHERE tenant_id = ? AND is_active = 0"
    params: List[Any] = [tenant_id]
    if user_id is not None:
        query += " AND user_id = ?"
        params.append(user_id)
    cursor.execute(query, params)
    inactive_connectors = [dict(row) for row in cursor.fetchall()]
    result["inactive_connectors_found"] = len(inactive_connectors)

    connector_ids: List[int] = []
    for connector in inactive_connectors:
        connector_id = int(connector["id"])
        connector_ids.append(connector_id)
        cleanup_counts = _purge_connector_loaded_data(cursor, connector)
        for key in (
            "raw_reviews_deleted",
            "cxm_reviews_deleted",
            "fi_feedback_deleted",
            "fi_outreach_drafts_deleted",
            "fi_analysis_results_deleted",
            "fi_analysis_runs_deleted",
            "fi_analysis_runs_updated",
            "fi_fetch_runs_deleted",
            "fi_fetch_runs_updated",
            "fi_customers_deleted",
            "fi_issues_deleted",
        ):
            result[key] += int(cleanup_counts.get(key, 0) or 0)

    result["inactive_connectors_deleted"] = _delete_rows_by_ids(
        cursor,
        "cxm_sources",
        "id",
        connector_ids,
    )

    legacy_cleanup = _purge_legacy_orphan_feedback_rows(cursor, tenant_id)
    result["fi_feedback_deleted"] += int(legacy_cleanup.get("fi_feedback_deleted", 0) or 0)
    result["fi_outreach_drafts_deleted"] += int(legacy_cleanup.get("fi_outreach_drafts_deleted", 0) or 0)
    result["fi_analysis_results_deleted"] += int(legacy_cleanup.get("fi_analysis_results_deleted", 0) or 0)
    result["fi_customers_deleted"] += int(legacy_cleanup.get("fi_customers_deleted", 0) or 0)
    result["fi_issues_deleted"] += int(legacy_cleanup.get("fi_issues_deleted", 0) or 0)

    conn.commit()
    conn.close()
    return result


def reset_tenant_connector_data(
    tenant_id: int,
    *,
    user_id: Optional[int] = None,
    preserve_active_connectors: bool = True,
) -> Dict[str, Any]:
    """Clear loaded review data for a tenant while optionally keeping active connector setups."""
    conn = get_db_connection()
    cursor = conn.cursor()

    result = {
        "tenant_id": tenant_id,
        "analysis_history_deleted": 0,
        "raw_reviews_deleted": 0,
        "cxm_reviews_deleted": 0,
        "fi_outreach_drafts_deleted": 0,
        "fi_analysis_results_deleted": 0,
        "fi_analysis_runs_deleted": 0,
        "fi_fetch_runs_deleted": 0,
        "fi_feedback_deleted": 0,
        "fi_customers_deleted": 0,
        "fi_issues_deleted": 0,
        "inactive_connectors_deleted": 0,
        "active_connectors_preserved": 0,
    }

    scoped_connectors: List[Dict[str, Any]] = []
    if _table_exists(cursor, "cxm_sources"):
        connector_query = "SELECT id, is_active FROM cxm_sources WHERE tenant_id = ?"
        connector_params: List[Any] = [tenant_id]
        if user_id is not None:
            connector_query += " AND user_id = ?"
            connector_params.append(user_id)
        cursor.execute(connector_query, connector_params)
        scoped_connectors = [dict(row) for row in cursor.fetchall()]

    result["analysis_history_deleted"] = _delete_rows_with_params(
        cursor,
        "analysis_history",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_outreach_drafts_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_outreach_drafts",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_analysis_results_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_analysis_results",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_analysis_runs_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_analysis_runs",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_fetch_runs_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_fetch_runs",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_feedback_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_feedback",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_customers_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_customers",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["fi_issues_deleted"] = _delete_rows_with_params(
        cursor,
        "fi_issues",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["cxm_reviews_deleted"] = _delete_rows_with_params(
        cursor,
        "cxm_reviews",
        "tenant_id = ?",
        (tenant_id,),
    )
    result["raw_reviews_deleted"] = _delete_rows_with_params(
        cursor,
        "raw_reviews",
        "tenant_id = ?",
        (tenant_id,),
    )

    if _table_exists(cursor, "cxm_sources"):
        active_connector_ids = [
            int(row["id"])
            for row in scoped_connectors
            if bool(row.get("is_active"))
        ]
        inactive_connector_ids = [
            int(row["id"])
            for row in scoped_connectors
            if not bool(row.get("is_active"))
        ]

        if preserve_active_connectors:
            result["inactive_connectors_deleted"] = _delete_rows_by_ids(
                cursor,
                "cxm_sources",
                "id",
                inactive_connector_ids,
            )
            if active_connector_ids:
                placeholders = ",".join("?" * len(active_connector_ids))
                cursor.execute(
                    f"""
                    UPDATE cxm_sources
                    SET last_fetched_at = NULL,
                        last_analyzed_at = NULL
                    WHERE id IN ({placeholders})
                    """,
                    active_connector_ids,
                )
            result["active_connectors_preserved"] = len(active_connector_ids)
        else:
            connector_scope_query = "tenant_id = ?"
            connector_scope_params: List[Any] = [tenant_id]
            if user_id is not None:
                connector_scope_query += " AND user_id = ?"
                connector_scope_params.append(user_id)
            deleted_connectors = _delete_rows_with_params(
                cursor,
                "cxm_sources",
                connector_scope_query,
                tuple(connector_scope_params),
            )
            result["inactive_connectors_deleted"] = deleted_connectors
            result["active_connectors_preserved"] = 0

    conn.commit()
    conn.close()
    return result

# ==================== RAW REVIEWS CACHING ====================

def save_raw_reviews(user_id: int, tenant_id: int, source_type: str, identifier: str, reviews: List[Dict],
                     workspace_id: Optional[int] = None):
    """
    Batch save raw reviews to the database with deduplication.
    Returns (added_count, skipped_count).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    added = 0
    skipped = 0
    
    # print(f"[DB] Saving {len(reviews)} raw reviews for {source_type}:{identifier}")
    print(f"[DB] Saving {len(reviews)} raw reviews for {source_type}:{identifier}")

    def _scoped_external_id(raw_external_id: str) -> str:
        tenant_part = tenant_id if tenant_id is not None else 0
        workspace_part = workspace_id if workspace_id is not None else 0
        base = str(raw_external_id or '').strip()
        if base:
            return f"{base}::tenant={tenant_part}::workspace={workspace_part}"
        return f"tenant={tenant_part}::workspace={workspace_part}"

    for r in reviews:
        # Standardize Play Store / generic IDs
        external_id = str(r.get('reviewId') or r.get('id') or '').strip()
        stored_external_id = _scoped_external_id(external_id)
        content = r.get('content', '').strip()
        score = r.get('score', 3)
        author = str(r.get('author') or r.get('userName') or 'Anonymous')
        at = r.get('date') or r.get('at')

        if not content:
            skipped += 1
            continue

        if workspace_id is None:
            cursor.execute('''
                SELECT 1
                FROM raw_reviews
                WHERE tenant_id = ? AND source_type = ? AND identifier = ? AND content = ?
                  AND (external_id = ? OR external_id = ? OR (? = '' AND (external_id IS NULL OR external_id = '')))
                LIMIT 1
            ''', (tenant_id, source_type, identifier, content, stored_external_id, external_id, external_id))
        else:
            cursor.execute('''
                SELECT 1
                FROM raw_reviews
                WHERE tenant_id = ? AND workspace_id = ? AND source_type = ? AND identifier = ? AND content = ?
                  AND (external_id = ? OR external_id = ? OR (? = '' AND (external_id IS NULL OR external_id = '')))
                LIMIT 1
            ''', (tenant_id, workspace_id, source_type, identifier, content, stored_external_id, external_id, external_id))
        if cursor.fetchone():
            skipped += 1
            continue

        try:
            cursor.execute('''
                INSERT OR IGNORE INTO raw_reviews
                    (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content, score, author, at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, tenant_id, workspace_id, source_type, identifier, stored_external_id, content, score, author, at))
            if int(cursor.rowcount) > 0:
                added += 1
            else:
                skipped += 1
        except:
            skipped += 1

    conn.commit()
    conn.close()
    print(f"[DB] Finished saving raw reviews. Added: {added}, Skipped: {skipped}")
    return added, skipped

def get_raw_review_stats(user_id: int, tenant_id: int, source_type: str, identifier: str,
                         workspace_id: Optional[int] = None):
    """Get total and unanalyzed counts for a source, optionally scoped by workspace."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if workspace_id is not None:
        cursor.execute('''
            SELECT COUNT(*) as total,
                   COALESCE(SUM(CASE WHEN is_analyzed = 0 THEN 1 ELSE 0 END), 0) as unanalyzed
            FROM raw_reviews
            WHERE tenant_id = ? AND source_type = ? AND identifier = ? AND workspace_id = ?
        ''', (tenant_id, source_type, identifier, workspace_id))
        row = cursor.fetchone()
        if row and int(row["total"] or 0) > 0:
            conn.close()
            return dict(row)

    cursor.execute('''
        SELECT COUNT(*) as total,
               COALESCE(SUM(CASE WHEN is_analyzed = 0 THEN 1 ELSE 0 END), 0) as unanalyzed
        FROM raw_reviews
        WHERE tenant_id = ? AND source_type = ? AND identifier = ?
    ''', (tenant_id, source_type, identifier))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else {"total": 0, "unanalyzed": 0}

def get_latest_raw_reviews(user_id: int, tenant_id: int, source_type: str, identifier: str,
                           limit: int = 100, workspace_id: Optional[int] = None):
    """Fetch latest reviews (prioritizing unanalyzed) for processing."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if workspace_id is not None:
        cursor.execute('''
            SELECT * FROM raw_reviews
            WHERE tenant_id = ? AND source_type = ? AND identifier = ? AND workspace_id = ?
            ORDER BY at DESC, created_at DESC LIMIT ?
        ''', (tenant_id, source_type, identifier, workspace_id, limit))
        rows = cursor.fetchall()
        if rows:
            conn.close()
            return [dict(r) for r in rows]

    cursor.execute('''
        SELECT * FROM raw_reviews
        WHERE tenant_id = ? AND source_type = ? AND identifier = ?
        ORDER BY at DESC, created_at DESC LIMIT ?
    ''', (tenant_id, source_type, identifier, limit))
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]

def mark_reviews_analyzed(review_ids: List[int]):
    """Mark a batch of reviews as analyzed."""
    if not review_ids: return
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholders = ','.join(['?'] * len(review_ids))
    cursor.execute(f'UPDATE raw_reviews SET is_analyzed = 1 WHERE id IN ({placeholders})', review_ids)
    conn.commit()
    conn.close()


# ==================== WORKSPACE MANAGEMENT ====================

def create_workspace(user_id: int, tenant_id: int, name: str, description: str = '', vertical: str = 'generic') -> Optional[int]:
    """Create a new workspace for a company."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO workspaces (user_id, tenant_id, name, description, vertical, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        ''', (user_id, tenant_id, name.strip(), description.strip(), vertical))
        workspace_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return workspace_id
    except Exception as e:
        logger.error(f"[DB] Error creating workspace: {e}")
        return None

def get_user_workspaces(user_id: int, tenant_id: int) -> List[Dict]:
    """Fetch all active workspaces for a company with analysis counts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT w.*, 
               (SELECT COUNT(*) FROM analysis_history WHERE workspace_id = w.id) as analyses_count
        FROM workspaces w
        WHERE w.tenant_id = ? AND w.is_active = 1
        ORDER BY w.created_at DESC
    ''', (tenant_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_workspace_by_id(workspace_id: int, user_id: int, tenant_id: int) -> Optional[Dict]:
    """Get a specific workspace (with tenant ownership check)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT w.*,
               (SELECT COUNT(*) FROM analysis_history WHERE workspace_id = w.id) as analyses_count
        FROM workspaces w
        WHERE w.id = ? AND w.tenant_id = ? AND w.is_active = 1
    ''', (workspace_id, tenant_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_workspace(workspace_id: int, user_id: int, tenant_id: int) -> bool:
    """Soft delete a workspace. Connectors/reviews are NOT deleted — they lose their workspace link."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE workspaces SET is_active = 0 WHERE id = ? AND tenant_id = ?',
            (workspace_id, tenant_id)
        )
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted
    except Exception as e:
        logger.error(f"[DB] Error deleting workspace: {e}")
        return False


# ==================== CRM FUNCTIONS ====================

def crm_upsert_profiles(user_id: int, tenant_id: int, profiles: List[Dict], workspace_id: Optional[int] = None) -> Dict:
    """Bulk upsert CRM profiles. Returns {added, updated} counts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    added = updated = 0
    for p in profiles:
        ext_id = p.get('external_id') or p.get('email') or p.get('name', 'unknown')
        cursor.execute('''
            INSERT INTO crm_profiles
              (user_id, tenant_id, workspace_id, external_id, name, email, company, segment,
               plan, mrr, joined_date, next_renewal, tags, notes, schedule)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(tenant_id, external_id) DO UPDATE SET
              name=excluded.name, email=excluded.email, company=excluded.company,
              segment=excluded.segment, plan=excluded.plan, mrr=excluded.mrr,
              joined_date=excluded.joined_date, next_renewal=excluded.next_renewal,
              tags=excluded.tags, notes=excluded.notes
        ''', (
            user_id, tenant_id, workspace_id, ext_id,
            p.get('name', 'Unknown'), p.get('email', ''), p.get('company', ''),
            p.get('segment', 'Unknown'), p.get('plan', ''),
            float(p.get('mrr', 0) or 0),
            p.get('joined_date', ''), p.get('next_renewal', ''),
            json.dumps(p.get('tags', [])),
            p.get('notes', ''), p.get('schedule', 'manual')
        ))
        if int(cursor.rowcount) == 1:
            added += 1
        else:
            updated += 1
    conn.commit()
    conn.close()
    return {'added': added, 'updated': updated}


def crm_get_profiles(user_id: int, tenant_id: int, workspace_id: Optional[int] = None,
                     search: str = '', segment: str = '') -> List[Dict]:
    """List profiles for a user with optional filters. Includes latest analysis snapshot."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        SELECT p.*,
          (SELECT ca.avg_sentiment FROM crm_analyses ca WHERE ca.profile_id=p.id AND ca.tenant_id=p.tenant_id ORDER BY ca.run_at DESC LIMIT 1) AS latest_sentiment,
          (SELECT ca.churn_probability FROM crm_analyses ca WHERE ca.profile_id=p.id AND ca.tenant_id=p.tenant_id ORDER BY ca.run_at DESC LIMIT 1) AS latest_churn,
          (SELECT ca.run_at FROM crm_analyses ca WHERE ca.profile_id=p.id AND ca.tenant_id=p.tenant_id ORDER BY ca.run_at DESC LIMIT 1) AS last_analyzed,
          (SELECT ca.top_issue FROM crm_analyses ca WHERE ca.profile_id=p.id AND ca.tenant_id=p.tenant_id ORDER BY ca.run_at DESC LIMIT 1) AS latest_top_issue,
          (SELECT ca.summary FROM crm_analyses ca WHERE ca.profile_id=p.id AND ca.tenant_id=p.tenant_id ORDER BY ca.run_at DESC LIMIT 1) AS latest_summary,
          (SELECT COUNT(*) FROM crm_feedbacks cf WHERE cf.profile_id=p.id AND cf.tenant_id=p.tenant_id) AS feedback_count
        FROM crm_profiles p
        WHERE p.tenant_id=? AND p.is_active=1
    '''
    params: list = [tenant_id]
    if workspace_id:
        query += ' AND p.workspace_id=?'
        params.append(workspace_id)
    if segment:
        query += ' AND p.segment=?'
        params.append(segment)
    if search:
        query += ' AND (p.name LIKE ? OR p.email LIKE ? OR p.company LIKE ?)'
        s = f'%{search}%'
        params.extend([s, s, s])
    query += ' ORDER BY p.created_at DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d: Dict[str, Any] = dict(r)
        try:
            d['tags'] = json.loads(d.get('tags') or '[]')
        except Exception:
            d['tags'] = []
        result.append(d)
    return result


def crm_get_profile(user_id: int, tenant_id: int, profile_id: int) -> Optional[Dict]:
    """Single profile with all analysis snapshots."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM crm_profiles WHERE id=? AND tenant_id=? AND is_active=1',
        (profile_id, tenant_id)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d: Dict[str, Any] = dict(row)
    try:
        d['tags'] = json.loads(d.get('tags') or '[]')
    except Exception:
        d['tags'] = []
    return d


def crm_update_profile(user_id: int, tenant_id: int, profile_id: int, updates: Dict) -> bool:
    """Partial update of a profile's editable fields."""
    allowed = {'name', 'email', 'company', 'segment', 'plan', 'mrr',
               'joined_date', 'next_renewal', 'tags', 'notes', 'schedule'}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        return False
    if 'tags' in fields and isinstance(fields['tags'], list):
        fields['tags'] = json.dumps(fields['tags'])
    set_clause = ', '.join(f'{k}=?' for k in fields)
    values = list(fields.values()) + [profile_id, user_id]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'UPDATE crm_profiles SET {set_clause} WHERE id=? AND user_id=? AND tenant_id=?',
        values + [tenant_id]
    )
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def crm_add_feedback(user_id: int, tenant_id: int, profile_id: int, content: str, score: int = 3,
                    source: str = 'manual', feedback_date: str = '') -> Optional[int]:
    """Add a feedback entry for a profile. Returns new feedback id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO crm_feedbacks (profile_id, user_id, tenant_id, content, score, source, feedback_date)
        VALUES (?,?,?,?,?,?,?)
    ''', (profile_id, user_id, tenant_id, content, score, source, feedback_date or datetime.now().strftime('%Y-%m-%d')))
    fid = cursor.lastrowid
    conn.commit()
    conn.close()
    return fid


def crm_get_feedbacks(user_id: int, tenant_id: int, profile_id: int) -> List[Dict]:
    """Return all feedbacks for a profile, newest first."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM crm_feedbacks
        WHERE profile_id=? AND user_id=? AND tenant_id=?
        ORDER BY feedback_date DESC, created_at DESC
    ''', (profile_id, user_id, tenant_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def crm_update_feedback_analysis(feedback_id: int, analysis: Dict):
    """Store LLM analysis fields back onto a feedback row."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE crm_feedbacks SET
          sentiment=?, sentiment_score=?, churn_risk=?,
          pain_point_category=?, issue=?, is_analyzed=1
        WHERE id=?
    ''', (
        analysis.get('sentiment'), analysis.get('sentiment_score'),
        analysis.get('churn_risk'), analysis.get('pain_point_category'),
        analysis.get('issue'), feedback_id
    ))
    conn.commit()
    conn.close()


def crm_save_analysis(user_id: int, tenant_id: int, profile_id: int, schedule: str, result: Dict) -> Optional[int]:
    """Persist an analysis snapshot for a profile. Returns snapshot id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO crm_analyses
          (profile_id, user_id, tenant_id, schedule, total_feedbacks, avg_sentiment,
           churn_probability, dominant_emotion, top_issue, summary)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    ''', (
        profile_id, user_id, tenant_id, schedule,
        result.get('total_feedbacks', 0),
        result.get('avg_sentiment'),
        result.get('churn_probability'),
        result.get('dominant_emotion', ''),
        result.get('top_issue', ''),
        result.get('summary', '')
    ))
    aid = cursor.lastrowid
    conn.commit()
    conn.close()
    return aid


def crm_get_analysis_history(user_id: int, tenant_id: int, profile_id: int, limit: int = 20) -> List[Dict]:
    """Return analysis snapshots for a profile, newest first."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM crm_analyses
        WHERE profile_id=? AND user_id=? AND tenant_id=?
        ORDER BY run_at DESC LIMIT ?
    ''', (profile_id, user_id, tenant_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def crm_delete_profile(user_id: int, tenant_id: int, profile_id: int) -> bool:
    """Soft-delete a profile."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE crm_profiles SET is_active=0 WHERE id=? AND user_id=? AND tenant_id=?',
        (profile_id, user_id, tenant_id)
    )
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


# ==================== SURVEY FUNCTIONS ====================

def survey_create(user_id: int, tenant_id: int, title: str, survey_type: str = 'custom',
                  description: str = '', workspace_id: Optional[int] = None,
                  theme: str = 'indigo', branding_name: str = '') -> Optional[int]:
    """Create a new survey. Returns survey id."""
    import secrets
    token = secrets.token_urlsafe(16)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO surveys (user_id, tenant_id, workspace_id, title, description, survey_type, token, theme, branding_name)
        VALUES (?,?,?,?,?,?,?,?,?)
    ''', (user_id, tenant_id, workspace_id, title, description, survey_type, token, theme, branding_name))
    sid = cursor.lastrowid
    conn.commit()
    conn.close()
    return sid


def survey_list(user_id: int, tenant_id: int, workspace_id: Optional[int] = None) -> List[Dict]:
    """List all surveys for a user with response counts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        SELECT s.*,
          (SELECT COUNT(*) FROM survey_questions sq WHERE sq.survey_id=s.id) AS question_count,
          (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id=s.id) AS response_count
        FROM surveys s
        WHERE s.user_id=? AND s.tenant_id=?
    '''
    params: list = [user_id, tenant_id]
    if workspace_id:
        query += ' AND s.workspace_id=?'
        params.append(workspace_id)
    query += ' ORDER BY s.created_at DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def survey_get(survey_id: int, user_id: Optional[int] = None, tenant_id: Optional[int] = None) -> Optional[Dict]:
    """Get a single survey with its questions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id and tenant_id:
        cursor.execute('SELECT * FROM surveys WHERE id=? AND user_id=? AND tenant_id=?', (survey_id, user_id, tenant_id))
    elif user_id:
        cursor.execute('SELECT * FROM surveys WHERE id=? AND user_id=?', (survey_id, user_id))
    else:
        cursor.execute('SELECT * FROM surveys WHERE id=?', (survey_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    survey = dict(row)
    cursor.execute('SELECT * FROM survey_questions WHERE survey_id=? ORDER BY position ASC', (survey_id,))
    qs = cursor.fetchall()
    conn.close()
    questions = []
    for q in qs:
        qd: Dict[str, Any] = dict(q)
        try:
            qd['config'] = json.loads(qd.get('config') or '{}')
        except Exception:
            qd['config'] = {}
        questions.append(qd)
    survey['questions'] = questions
    return survey


def survey_get_by_token(token: str) -> Optional[Dict]:
    """Get a published survey by its public token."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM surveys WHERE token=? AND status=?', (token, 'published'))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    survey = dict(row)
    cursor.execute('SELECT * FROM survey_questions WHERE survey_id=? ORDER BY position ASC', (survey['id'],))
    qs = cursor.fetchall()
    conn.close()
    questions = []
    for q in qs:
        qd: Dict[str, Any] = dict(q)
        try:
            qd['config'] = json.loads(qd.get('config') or '{}')
        except Exception:
            qd['config'] = {}
        questions.append(qd)
    survey['questions'] = questions
    return survey


def survey_update(survey_id: int, user_id: int, tenant_id: int, updates: Dict) -> bool:
    """Update survey metadata fields."""
    allowed = {'title', 'description', 'status', 'theme', 'branding_name',
                'show_progress', 'allow_anonymous', 'response_limit', 'deadline', 'logo_url'}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        return False
    fields['updated_at'] = datetime.now().isoformat()
    set_clause = ', '.join(f'{k}=?' for k in fields)
    values = list(fields.values()) + [survey_id, user_id, tenant_id]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f'UPDATE surveys SET {set_clause} WHERE id=? AND user_id=? AND tenant_id=?', values)
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def survey_delete(survey_id: int, user_id: int, tenant_id: int) -> bool:
    """Hard-delete a survey and its questions + responses (cascade)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM surveys WHERE id=? AND user_id=? AND tenant_id=?', (survey_id, user_id, tenant_id))
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def survey_save_questions(survey_id: int, questions: List[Dict]) -> bool:
    """Replace all questions for a survey (full overwrite)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM survey_questions WHERE survey_id=?', (survey_id,))
    for i, q in enumerate(questions):
        config = q.get('config', {})
        if isinstance(config, dict):
            config = json.dumps(config)
        cursor.execute('''
            INSERT INTO survey_questions (survey_id, position, question_type, title, description, is_required, config)
            VALUES (?,?,?,?,?,?,?)
        ''', (
            survey_id, i,
            q.get('question_type', 'text'),
            q.get('title', ''),
            q.get('description', ''),
            1 if q.get('is_required') else 0,
            config
        ))
    conn.commit()
    conn.close()
    return True


def survey_submit_response(survey_id: int, answers: Dict,
                            respondent_email: str = '', respondent_name: str = '',
                            respondent_token: Optional[str] = None, ip_hash: str = '') -> Optional[int]:
    """Save a survey response. Returns response id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO survey_responses (survey_id, respondent_token, respondent_email, respondent_name, answers, ip_hash)
        VALUES (?,?,?,?,?,?)
    ''', (survey_id, respondent_token or '', respondent_email, respondent_name, json.dumps(answers), ip_hash))
    rid = cursor.lastrowid
    conn.commit()
    conn.close()
    return rid


def survey_get_responses(survey_id: int, user_id: int, tenant_id: int, limit: int = 200) -> List[Dict]:
    """Return all responses for a survey."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Verify ownership
    cursor.execute('SELECT id FROM surveys WHERE id=? AND user_id=? AND tenant_id=?', (survey_id, user_id, tenant_id))
    if not cursor.fetchone():
        conn.close()
        return []
    cursor.execute('''
        SELECT * FROM survey_responses WHERE survey_id=? ORDER BY submitted_at DESC LIMIT ?
    ''', (survey_id, limit))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d: Dict[str, Any] = dict(r)
        try:
            d['answers'] = json.loads(d.get('answers') or '{}')
        except Exception:
            d['answers'] = {}
        result.append(d)
    return result


def survey_get_analytics(survey_id: int, user_id: int, tenant_id: int) -> Dict:
    """
    Compute per-question aggregate analytics:
    - NPS: promoters/passives/detractors, NPS score
    - Rating/CSAT: average, distribution
    - Text: list of raw answers
    - Multiple choice: option counts
    """
    survey = survey_get(survey_id, user_id, tenant_id)
    if not survey:
        return {}
    responses = survey_get_responses(survey_id, user_id, tenant_id, limit=10000)

    questions = {q['id']: q for q in survey.get('questions', [])}
    aggregates: Dict = {}

    for qid, q in questions.items():
        qtype = q['question_type']
        q_str = str(qid)
        values = [r['answers'].get(q_str) for r in responses if r['answers'].get(q_str) is not None]

        if qtype == 'nps':
            nums = [int(v) for v in values if str(v).lstrip('-').isdigit()]
            promoters = sum(1 for n in nums if n >= 9)
            passives = sum(1 for n in nums if 7 <= n <= 8)
            detractors = sum(1 for n in nums if n <= 6)
            total = max(len(nums), 1)
            nps = round(float((promoters - detractors) / total) * 100, 1)
            aggregates[q_str] = {
                'type': 'nps', 'title': q['title'],
                'nps_score': nps, 'total': len(nums),
                'promoters': promoters, 'passives': passives, 'detractors': detractors,
                'distribution': {str(i): nums.count(i) for i in range(11)}
            }
        elif qtype in ('rating', 'csat'):
            nums = [float(v) for v in values if _is_numeric(v)]
            avg = round(float(sum(nums) / max(len(nums), 1)), 2)
            config = q.get('config', {})
            max_val = int(config.get('max', 5))
            dist = {str(i): nums.count(float(i)) for i in range(1, max_val + 1)}
            aggregates[q_str] = {
                'type': qtype, 'title': q['title'],
                'average': avg, 'total': len(nums), 'distribution': dist
            }
        elif qtype == 'multiple_choice':
            from collections import Counter
            counts = Counter(str(v) for v in values if v)
            aggregates[q_str] = {
                'type': 'multiple_choice', 'title': q['title'],
                'counts': dict(counts), 'total': len(values)
            }
        elif qtype == 'yes_no':
            yes = sum(1 for v in values if str(v).lower() in ('yes', 'true', '1', 'y'))
            no = len(values) - yes
            aggregates[q_str] = {
                'type': 'yes_no', 'title': q['title'],
                'yes': yes, 'no': no, 'total': len(values),
                'yes_pct': round(float(yes / max(len(values), 1) * 100), 1)
            }
        else:  # text / open-ended
            aggregates[q_str] = {
                'type': 'text', 'title': q['title'],
                'answers': [str(v) for v in values if v], 'total': len(values)
            }

    return {
        'survey_id': survey_id,
        'title': survey['title'],
        'total_responses': len(responses),
        'questions': aggregates
    }


def _is_numeric(v) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


# ==================== CXM FEEDBACK INTELLIGENCE DB HELPERS ====================

def cxm_get_sources(user_id: int, tenant_id: int) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, COUNT(r.id) as review_count
        FROM cxm_sources s
        LEFT JOIN cxm_reviews r ON r.source_id = s.id
        WHERE s.user_id = ? AND s.tenant_id = ?
        GROUP BY s.id
        ORDER BY s.created_at DESC
    ''', (user_id, tenant_id))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        d: Dict[str, Any] = dict(row)
        try:
            cfg = json.loads(d.get('config') or '{}')
        except Exception:
            cfg = {}
        # ── Security: never send auth credentials back over the API ──
        for secret_key in ("auth_value", "token", "client_secret", "password", "access_token", "api_key"):
            if secret_key in cfg and cfg.get(secret_key):
                cfg[secret_key] = "********"  # mask
        d['config'] = cfg
        d['analysis_interval'] = d.get('analysis_interval') or cfg.get('analysis_interval') or 'manual'
        # Mask the raw HMAC secret; indicate its presence only
        if d.get('hmac_secret'):
            d['hmac_secret'] = '**set**'
        result.append(d)
    return result


def cxm_create_source(user_id: int, tenant_id: int, source_type: str, identifier: str,
                       display_name: str, fetch_interval: str, config: dict,
                       analysis_interval: Optional[str] = None,
                       webhook_token: Optional[str] = None,
                       hmac_secret: Optional[str] = None,
                       workspace_id: Optional[int] = None) -> Optional[int]:
    conn = get_db_connection()
    cursor = conn.cursor()
    valid_intervals = {"manual", "hourly", "daily", "weekly", "on_new"}
    fetch_interval = (fetch_interval or "daily").strip().lower()
    if fetch_interval not in valid_intervals:
        fetch_interval = "daily"
    resolved_analysis = (analysis_interval or "").strip().lower()
    if resolved_analysis not in valid_intervals:
        resolved_analysis = fetch_interval if fetch_interval != "manual" else "manual"
    cursor.execute('''
        INSERT INTO cxm_sources
        (user_id, tenant_id, workspace_id, source_type, identifier, display_name, fetch_interval, analysis_interval, config, webhook_token, hmac_secret)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, tenant_id, workspace_id, source_type, identifier, display_name, fetch_interval,
          resolved_analysis, json.dumps(config), webhook_token, hmac_secret))
    sid = cursor.lastrowid
    conn.commit()
    conn.close()
    return sid


def cxm_count_pending_reviews(user_id: int, tenant_id: int) -> int:
    """Return count of unanalyzed reviews for a user — used by /cxm/health."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT COUNT(*) FROM cxm_reviews WHERE user_id=? AND tenant_id=? AND is_analyzed=0',
        (user_id, tenant_id)
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0


def cxm_get_source_by_webhook_token(token: str) -> Optional[Dict]:
    """Look up a source by its webhook_token. Used to validate inbound webhook calls."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cxm_sources WHERE webhook_token=? AND is_active=1', (token,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d: Dict[str, Any] = dict(row)
    try:
        d['config'] = json.loads(d.get('config') or '{}')
    except Exception:
        d['config'] = {}
    return d


def cxm_update_source(source_id: int, user_id: int, tenant_id: int, **kwargs) -> bool:
    allowed = {'display_name', 'fetch_interval', 'analysis_interval', 'last_analyzed_at', 'is_active', 'config'}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return False
    if 'config' in fields and isinstance(fields['config'], dict):
        fields['config'] = json.dumps(fields['config'])
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = ', '.join(f'{k}=?' for k in fields)
    cursor.execute(
        f'UPDATE cxm_sources SET {set_clause} WHERE id=? AND user_id=? AND tenant_id=?',
        list(fields.values()) + [source_id, user_id, tenant_id]
    )
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def cxm_delete_source(source_id: int, user_id: int, tenant_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cxm_sources WHERE id=? AND user_id=? AND tenant_id=?', (source_id, user_id, tenant_id))
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def cxm_get_source(source_id: int, user_id: int, tenant_id: int) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cxm_sources WHERE id=? AND user_id=? AND tenant_id=?', (source_id, user_id, tenant_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d: Dict[str, Any] = dict(row)
    try:
        d['config'] = json.loads(d.get('config') or '{}')
    except Exception:
        d['config'] = {}
    return d


def cxm_update_last_fetched(source_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE cxm_sources SET last_fetched_at=? WHERE id=?', (datetime.now(), source_id))
    conn.commit()
    conn.close()


def cxm_update_last_analyzed(source_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE cxm_sources SET last_analyzed_at=? WHERE id=?', (datetime.now(), source_id))
    conn.commit()
    conn.close()


def cxm_insert_reviews(source_id: int, user_id: int, tenant_id: int, reviews: list) -> int:
    """
    Insert normalised review rows, deduplicating on (source_id, external_id, content_hash).
    Uses SHA-256 hash of content for robust deduplication when external_id is missing or unreliable.
    """
    if not reviews:
        return 0

    rows_to_insert = []
    for r in reviews:
        content = str(r.get('content') or r.get('text') or r.get('review') or '').strip()
        if not content:
            continue

        external_id = str(
            r.get('external_id') or r.get('reviewId') or r.get('id') or ''
        )[:255]
        
        # Create a content hash for secondary deduplication
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
        
        author = str(
            r.get('author') or r.get('userName') or r.get('user') or 'Anonymous'
        )[:200]

        score_raw = r.get('score') or r.get('rating') or r.get('stars') or 3
        try:
            score = max(1, min(5, int(float(score_raw))))
        except (TypeError, ValueError):
            score = 3

        date_raw = r.get('reviewed_at') or r.get('at') or r.get('date') or r.get('created_at')
        reviewed_at = str(date_raw) if date_raw else datetime.now().isoformat()

        rows_to_insert.append((source_id, user_id, external_id, author, content, score, reviewed_at, content_hash))

    if not rows_to_insert:
        return 0

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('BEGIN')
    try:
        cursor.executemany('''
            INSERT OR IGNORE INTO cxm_reviews
            (source_id, user_id, tenant_id, external_id, author, content, score, reviewed_at, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [(r[0], r[1], tenant_id, r[2], r[3], r[4], r[5], r[6], r[7]) for r in rows_to_insert])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return max(0, cursor.rowcount)


def cxm_get_unanalyzed_reviews(user_id: int, tenant_id: int, limit: int = 50) -> List[Dict]:
    """
    Return unanalyzed reviews for a user across ALL their sources.
    Ordered by fetchtime ascending so oldest-first batching is consistent.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM cxm_reviews
        WHERE user_id=? AND tenant_id=? AND is_analyzed=0 AND (content IS NOT NULL AND content != '')
        ORDER BY fetched_at ASC LIMIT ?
    ''', (user_id, tenant_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def cxm_update_review_analysis(
    review_id: int,
    sentiment: str,
    sentiment_score: float,
    churn_risk: str,
    churn_probability: float,
    themes: list,
    pain_point: str = "other",
    churn_intent_cluster: str = "no_churn_signal",
    user_segment: str = "unknown",
    growth_opportunity: str = "none",
    main_problem_flag: int = 0,
):
    """Update a single review's analysis. Use cxm_update_review_analysis_batch for bulk."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cxm_reviews SET sentiment=?, sentiment_score=?, churn_risk=?,
        churn_probability=?, themes=?, pain_point=?, churn_intent_cluster=?,
        user_segment=?, growth_opportunity=?, main_problem_flag=?, is_analyzed=1
        WHERE id=?
    ''', (
        sentiment,
        sentiment_score,
        churn_risk,
        churn_probability,
        json.dumps(themes),
        pain_point,
        churn_intent_cluster,
        user_segment,
        growth_opportunity,
        int(bool(main_problem_flag)),
        review_id,
    ))
    conn.commit()
    conn.close()


def cxm_update_review_analysis_batch(updates: List[Dict]):
    """
    Bulk-update analysis results in a single transaction.
    Each update dict should include: review_id, sentiment, sentiment_score,
    churn_risk, churn_probability, themes and optional segmentation fields.
    This is significantly faster than calling cxm_update_review_analysis() in a loop.
    """
    if not updates:
        return

    rows = [
        (
            u['sentiment'],
            round(float(u['sentiment_score']), 4),
            u['churn_risk'],
            round(float(u['churn_probability']), 4),
            json.dumps(u.get('themes', [])),
            str(u.get('pain_point') or 'other')[:80],
            str(u.get('churn_intent_cluster') or 'no_churn_signal')[:80],
            str(u.get('user_segment') or 'unknown')[:80],
            str(u.get('growth_opportunity') or 'none')[:120],
            int(bool(u.get('main_problem_flag'))),
            u['review_id'],
        )
        for u in updates
    ]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('BEGIN')
    try:
        cursor.executemany('''
            UPDATE cxm_reviews
            SET sentiment=?, sentiment_score=?, churn_risk=?, churn_probability=?,
                themes=?, pain_point=?, churn_intent_cluster=?, user_segment=?,
                growth_opportunity=?, main_problem_flag=?, is_analyzed=1
            WHERE id=?
        ''', rows)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def cxm_get_reviews(user_id: int, tenant_id: int, source_id: Optional[int] = None,
                     sentiment: Optional[str] = None, churn_risk: Optional[str] = None,
                     start_date: Optional[str] = None, end_date: Optional[str] = None,
                     limit: int = 50, offset: int = 0) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    query = '''
        SELECT r.*, s.display_name as source_name, s.source_type
        FROM cxm_reviews r
        JOIN cxm_sources s ON s.id = r.source_id
        WHERE r.user_id=? AND r.tenant_id=?
    '''
    params: list = [user_id, tenant_id]
    if source_id:
        query += ' AND r.source_id=?'; params.append(source_id)
    if sentiment:
        query += ' AND r.sentiment=?'; params.append(sentiment)
    if churn_risk:
        query += ' AND r.churn_risk=?'; params.append(churn_risk)
    if start_date:
        query += ' AND r.reviewed_at>=?'; params.append(start_date)
    if end_date:
        query += ' AND r.reviewed_at<=?'; params.append(end_date)
    query += ' ORDER BY r.reviewed_at DESC LIMIT ? OFFSET ?'
    params += [limit, offset]
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        d: Dict[str, Any] = dict(row)
        try:
            d['themes'] = json.loads(d.get('themes') or '[]')
        except Exception:
            d['themes'] = []
        result.append(d)
    return result


def cxm_get_trend_data(
    user_id: int,
    tenant_id: int,
    source_ids: Optional[list] = None,
    period: str = 'day',
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict]:
    """Return aggregated sentiment + churn stats grouped by period (day/week/month)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff = start_date or (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    if period == 'week':
        date_fmt = "strftime('%Y-W%W', r.reviewed_at)"
    elif period == 'month':
        date_fmt = "strftime('%Y-%m', r.reviewed_at)"
    else:
        date_fmt = "date(r.reviewed_at)"

    query = f'''
        SELECT
            {date_fmt} as period,
            COUNT(*) as total,
            AVG(r.sentiment_score) as avg_sentiment,
            AVG(r.churn_probability) as avg_churn,
            SUM(CASE WHEN r.sentiment='positive' THEN 1 ELSE 0 END) as positive_count,
            SUM(CASE WHEN r.sentiment='neutral' THEN 1 ELSE 0 END) as neutral_count,
            SUM(CASE WHEN r.sentiment='negative' THEN 1 ELSE 0 END) as negative_count,
            SUM(CASE WHEN r.churn_risk='high' THEN 1 ELSE 0 END) as high_churn,
            SUM(CASE WHEN r.churn_risk='medium' THEN 1 ELSE 0 END) as medium_churn,
            SUM(CASE WHEN r.churn_risk='low' THEN 1 ELSE 0 END) as low_churn,
            AVG(r.score) as avg_score
        FROM cxm_reviews r
        JOIN cxm_sources s ON s.id = r.source_id
        WHERE r.user_id=? AND r.tenant_id=? AND r.reviewed_at >= ?
    '''
    params: list = [user_id, tenant_id, cutoff]
    if source_ids:
        placeholders = ','.join('?' * len(source_ids))
        query += f' AND r.source_id IN ({placeholders})'
        params.extend(source_ids)
    if end_date:
        query += ' AND r.reviewed_at <= ?'
        params.append(end_date)
    query += f' GROUP BY {date_fmt} ORDER BY period ASC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def cxm_get_summary(
    user_id: int,
    tenant_id: int,
    source_ids: Optional[list] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict:
    """Aggregate stats and churn-intelligence rollups across CXM reviews."""
    conn = get_db_connection()
    cursor = conn.cursor()
    q = '''
        SELECT
            COUNT(*) as total_reviews,
            AVG(sentiment_score) as avg_sentiment,
            AVG(churn_probability) as avg_churn,
            SUM(CASE WHEN sentiment='positive' THEN 1 ELSE 0 END) as positive_count,
            SUM(CASE WHEN sentiment='neutral' THEN 1 ELSE 0 END) as neutral_count,
            SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as negative_count,
            SUM(CASE WHEN churn_risk='high' THEN 1 ELSE 0 END) as high_churn,
            SUM(CASE WHEN churn_risk='medium' THEN 1 ELSE 0 END) as medium_churn,
            SUM(CASE WHEN churn_risk='low' THEN 1 ELSE 0 END) as low_churn
        FROM cxm_reviews WHERE user_id=? AND tenant_id=?
    '''
    params: list = [user_id, tenant_id]
    if source_ids:
        placeholders = ','.join('?' * len(source_ids))
        q += f' AND source_id IN ({placeholders})'
        params.extend(source_ids)
    if start_date:
        q += ' AND reviewed_at >= ?'
        params.append(start_date)
    if end_date:
        q += ' AND reviewed_at <= ?'
        params.append(end_date)
    cursor.execute(q, params)
    row = cursor.fetchone()

    # Theme and churn-intelligence rollups
    themes_q = '''
        SELECT themes, pain_point, churn_intent_cluster, user_segment, growth_opportunity,
               churn_risk, churn_probability, sentiment, main_problem_flag
        FROM cxm_reviews
        WHERE user_id=? AND tenant_id=?
    '''
    t_params: list = [user_id, tenant_id]
    if source_ids:
        placeholders = ','.join('?' * len(source_ids))
        themes_q += f' AND source_id IN ({placeholders})'
        t_params.extend(source_ids)
    if start_date:
        themes_q += ' AND reviewed_at >= ?'
        t_params.append(start_date)
    if end_date:
        themes_q += ' AND reviewed_at <= ?'
        t_params.append(end_date)
    cursor.execute(themes_q, t_params)
    signal_rows = cursor.fetchall()
    conn.close()

    from collections import Counter

    theme_counter: Counter = Counter()
    pain_counter: Counter = Counter()
    churn_cluster_counter: Counter = Counter()
    segment_counter: Counter = Counter()
    growth_counter: Counter = Counter()

    weighted_problem_scores: Dict[str, float] = {}
    weighted_problem_counts: Dict[str, int] = {}
    weighted_problem_churn: Dict[str, float] = {}

    for tr in signal_rows:
        try:
            tags = json.loads(tr["themes"] or '[]')
            if isinstance(tags, list):
                theme_counter.update(tags)
        except Exception:
            pass

        pain_point = str(tr["pain_point"] or "other").strip().lower() or "other"
        churn_cluster = str(tr["churn_intent_cluster"] or "no_churn_signal").strip().lower() or "no_churn_signal"
        user_segment = str(tr["user_segment"] or "unknown").strip().lower() or "unknown"
        growth_opportunity = str(tr["growth_opportunity"] or "none").strip().lower() or "none"

        pain_counter.update([pain_point])
        churn_cluster_counter.update([churn_cluster])
        segment_counter.update([user_segment])
        growth_counter.update([growth_opportunity])

        churn_probability = float(tr["churn_probability"] or 0.0)
        sentiment = str(tr["sentiment"] or "neutral").strip().lower()
        churn_risk = str(tr["churn_risk"] or "low").strip().lower()
        main_problem_flag = int(tr["main_problem_flag"] or 0)

        weight = 1.0 + (1.5 if churn_risk == "high" else 0.8 if churn_risk == "medium" else 0.0)
        weight += max(0.0, min(1.0, churn_probability)) * 1.2
        if sentiment == "negative":
            weight += 0.8
        if main_problem_flag:
            weight += 0.7

        weighted_problem_scores[pain_point] = weighted_problem_scores.get(pain_point, 0.0) + weight
        weighted_problem_counts[pain_point] = weighted_problem_counts.get(pain_point, 0) + 1
        weighted_problem_churn[pain_point] = weighted_problem_churn.get(pain_point, 0.0) + max(
            0.0, min(1.0, churn_probability)
        )

    summary: Dict[str, Any] = dict(row) if row else {}
    summary['top_themes'] = [{'theme': t, 'count': c} for t, c in theme_counter.most_common(10)]

    summary['top_pain_points'] = [
        {
            "pain_point": p,
            "count": int(c),
            "weighted_impact": round(float(weighted_problem_scores.get(p, 0.0)), 3),
        }
        for p, c in pain_counter.most_common(10)
    ]
    summary['churn_intent_clusters'] = [
        {"cluster": c, "count": int(n)}
        for c, n in churn_cluster_counter.most_common(10)
    ]
    summary['user_segments'] = [
        {"segment": s, "count": int(n)}
        for s, n in segment_counter.most_common(10)
    ]
    summary['growth_opportunities'] = [
        {"opportunity": g, "count": int(n)}
        for g, n in growth_counter.most_common(10)
    ]

    if weighted_problem_scores:
        main_problem = max(weighted_problem_scores.items(), key=lambda kv: kv[1])[0]
        affected_reviews = max(1, weighted_problem_counts.get(main_problem, 1))
        avg_problem_churn = weighted_problem_churn.get(main_problem, 0.0) / affected_reviews
        summary['main_problem_to_fix'] = {
            "pain_point": main_problem,
            "impact_score": round(float(weighted_problem_scores.get(main_problem, 0.0)), 3),
            "affected_reviews": int(affected_reviews),
            "avg_churn_probability": round(float(avg_problem_churn), 3),
            "why_now": (
                "Highest weighted churn impact based on risk intensity, churn probability, "
                "negative sentiment, and explicit main-problem flags."
            ),
        }
    else:
        summary['main_problem_to_fix'] = {
            "pain_point": "none",
            "impact_score": 0.0,
            "affected_reviews": 0,
            "avg_churn_probability": 0.0,
            "why_now": "Not enough analyzed feedback in the selected range.",
        }
    return summary


# ---- Campaign CRUD ----

def cxm_get_campaigns(user_id: int, tenant_id: int) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cxm_campaigns WHERE user_id=? AND tenant_id=? ORDER BY created_at DESC', (user_id, tenant_id))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        d: Dict[str, Any] = dict(row)
        try:
            d['target_segment'] = json.loads(d.get('target_segment') or '{}')
        except Exception:
            d['target_segment'] = {}
        result.append(d)
    return result


def cxm_create_campaign(user_id: int, tenant_id: int, name: str, campaign_type: str, subject: str,
                          body: str, target_segment: dict) -> Optional[int]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cxm_campaigns (user_id, tenant_id, name, campaign_type, subject, body, target_segment)
        VALUES (?,?,?,?,?,?,?)
    ''', (user_id, tenant_id, name, campaign_type, subject, body, json.dumps(target_segment)))
    cid = cursor.lastrowid
    conn.commit()
    conn.close()
    return cid


def cxm_update_campaign(campaign_id: int, user_id: int, tenant_id: int, **kwargs) -> bool:
    allowed = {'name', 'campaign_type', 'subject', 'body', 'target_segment', 'status',
               'sent_at', 'recipient_count'}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return False
    if 'target_segment' in fields and isinstance(fields['target_segment'], dict):
        fields['target_segment'] = json.dumps(fields['target_segment'])
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = ', '.join(f'{k}=?' for k in fields)
    cursor.execute(
        f'UPDATE cxm_campaigns SET {set_clause} WHERE id=? AND user_id=? AND tenant_id=?',
        list(fields.values()) + [campaign_id, user_id, tenant_id]
    )
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def cxm_delete_campaign(campaign_id: int, user_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cxm_campaigns WHERE id=? AND user_id=?', (campaign_id, user_id))
    ok = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return ok


# ---- Customer Profile helpers ----

def cxm_get_customer_profiles(user_id: int, source_id: Optional[int] = None,
                               search: Optional[str] = None,
                               churn_risk: Optional[str] = None,
                               limit: int = 50, offset: int = 0) -> List[Dict]:
    """
    Return one record per unique author (customer profile), aggregating all their reviews.
    Fields: author, review_count, avg_sentiment, avg_score, avg_churn_probability,
            latest_churn_risk, latest_sentiment, latest_reviewed_at, first_reviewed_at,
            source_types (JSON list), top_themes (JSON list).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT
            r.author,
            COUNT(r.id)                                          AS review_count,
            ROUND(AVG(r.sentiment_score), 3)                     AS avg_sentiment,
            ROUND(AVG(r.score), 2)                               AS avg_score,
            ROUND(AVG(r.churn_probability), 3)                   AS avg_churn_probability,
            MAX(r.reviewed_at)                                   AS latest_reviewed_at,
            MIN(r.reviewed_at)                                   AS first_reviewed_at,
            (SELECT r2.churn_risk FROM cxm_reviews r2
             WHERE r2.user_id = r.user_id AND r2.author = r.author
             ORDER BY r2.reviewed_at DESC LIMIT 1)              AS latest_churn_risk,
            (SELECT r2.sentiment FROM cxm_reviews r2
             WHERE r2.user_id = r.user_id AND r2.author = r.author
             ORDER BY r2.reviewed_at DESC LIMIT 1)              AS latest_sentiment,
            GROUP_CONCAT(DISTINCT s.source_type)                AS source_types
        FROM cxm_reviews r
        JOIN cxm_sources s ON s.id = r.source_id
        WHERE r.user_id = ?
    '''
    params: list = [user_id]

    if source_id:
        query += ' AND r.source_id = ?'
        params.append(source_id)
    if churn_risk:
        query += ''' AND (SELECT r2.churn_risk FROM cxm_reviews r2
                          WHERE r2.user_id = r.user_id AND r2.author = r.author
                          ORDER BY r2.reviewed_at DESC LIMIT 1) = ?'''
        params.append(churn_risk)
    if search:
        query += ' AND r.author LIKE ?'
        params.append(f'%{search}%')

    query += ' GROUP BY r.author ORDER BY latest_reviewed_at DESC LIMIT ? OFFSET ?'
    params += [limit, offset]

    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Now fetch top themes per author in a second pass (SQLite GROUP_CONCAT can't easily JSON-aggregate)
    result = []
    for row in rows:
        d = dict(row)
        d['source_types'] = list(set((d.get('source_types') or '').split(','))) if d.get('source_types') else []

        # Fetch themes for this author
        cursor.execute(
            'SELECT themes FROM cxm_reviews WHERE user_id=? AND author=? AND themes != "[]"',
            (user_id, d['author'])
        )
        from collections import Counter
        tc: Counter = Counter()
        for tr in cursor.fetchall():
            try:
                tags = json.loads(tr[0] or '[]')
                if isinstance(tags, list):
                    tc.update(tags)
            except Exception:
                pass
        d['top_themes'] = [t for t, _ in tc.most_common(5)]
        result.append(d)

    conn.close()
    return result


def cxm_get_customer_detail(user_id: int, author: str) -> Dict:
    """
    Return one customer's full profile: aggregated stats + every review in chronological order
    (oldest first for sparkline rendering), plus a 30‑day daily sentiment series.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Aggregate stats
    cursor.execute('''
        SELECT
            COUNT(r.id)                          AS review_count,
            ROUND(AVG(r.sentiment_score), 3)     AS avg_sentiment,
            ROUND(AVG(r.score), 2)               AS avg_score,
            ROUND(AVG(r.churn_probability), 3)   AS avg_churn_probability,
            MAX(r.reviewed_at)                   AS latest_reviewed_at,
            MIN(r.reviewed_at)                   AS first_reviewed_at,
            SUM(CASE WHEN r.sentiment="positive" THEN 1 ELSE 0 END) AS positive_count,
            SUM(CASE WHEN r.sentiment="neutral"  THEN 1 ELSE 0 END) AS neutral_count,
            SUM(CASE WHEN r.sentiment="negative" THEN 1 ELSE 0 END) AS negative_count
        FROM cxm_reviews r
        WHERE r.user_id = ? AND r.author = ?
    ''', (user_id, author))
    stats_row = cursor.fetchone()
    stats = dict(stats_row) if stats_row else {}

    # Latest churn_risk / sentiment
    cursor.execute('''
        SELECT churn_risk, sentiment, churn_probability, source_id
        FROM cxm_reviews WHERE user_id=? AND author=?
        ORDER BY reviewed_at DESC LIMIT 1
    ''', (user_id, author))
    latest = cursor.fetchone()
    if latest:
        stats.update({
            'latest_churn_risk': latest['churn_risk'],
            'latest_sentiment': latest['sentiment'],
            'latest_churn_probability': latest['churn_probability'],
        })

    # Reviews — oldest first for timeline/sparkline
    cursor.execute('''
        SELECT r.*, s.source_type, s.display_name AS source_name
        FROM cxm_reviews r
        JOIN cxm_sources s ON s.id = r.source_id
        WHERE r.user_id = ? AND r.author = ?
        ORDER BY r.reviewed_at ASC
    ''', (user_id, author))
    review_rows = cursor.fetchall()
    reviews = []
    from collections import Counter
    tc: Counter = Counter()
    for row in review_rows:
        d: Dict[str, Any] = dict(row)
        try:
            d['themes'] = json.loads(d.get('themes') or '[]')
            if isinstance(d['themes'], list):
                tc.update(d['themes'])
        except Exception:
            d['themes'] = []
        reviews.append(d)

    conn.close()

    stats['top_themes'] = [t for t, _ in tc.most_common(5)]
    stats['reviews'] = reviews
    stats['author'] = author
    return stats


