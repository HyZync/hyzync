"""
Migration script: Add tenant_id columns to all tables that need them.
Run once against an existing database to make it multi-tenant ready.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_db_connection

MIGRATIONS = [
    # Core tables
    "ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL",
    "ALTER TABLE analysis_history ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE raw_reviews ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE support_tickets ADD COLUMN tenant_id INTEGER",
    "ALTER TABLE user_usage ADD COLUMN tenant_id INTEGER",
    "ALTER TABLE billing_history ADD COLUMN tenant_id INTEGER",
    "ALTER TABLE workspaces ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE user_connectors ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    # CRM tables
    "ALTER TABLE crm_profiles ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE crm_feedbacks ADD COLUMN tenant_id INTEGER",
    "ALTER TABLE crm_analyses ADD COLUMN tenant_id INTEGER",
    # Survey tables
    "ALTER TABLE surveys ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    # CXM tables
    "ALTER TABLE cxm_sources ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE cxm_reviews ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE cxm_campaigns ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE",
    # Indexes for tenant_id lookups
    "CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_analysis_tenant ON analysis_history(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_crm_profiles_tenant ON crm_profiles(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_cxm_sources_tenant ON cxm_sources(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_cxm_reviews_tenant ON cxm_reviews(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_surveys_tenant ON surveys(tenant_id)",
    # Tenants table (if not exists)
    """CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
]

def run_migrations():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    applied = 0
    skipped = 0
    
    for sql in MIGRATIONS:
        try:
            cursor.execute(sql)
            applied += 1
            print(f"  [OK] {sql[:70]}...")
        except Exception as e:
            err = str(e).lower()
            if 'duplicate column' in err or 'already exists' in err:
                skipped += 1
            else:
                print(f"  [SKIP] {sql[:70]}... ({e})")
                skipped += 1
    
    conn.commit()
    conn.close()
    print(f"\nMigration complete: {applied} applied, {skipped} skipped")

if __name__ == "__main__":
    print("Running multi-tenancy database migration...")
    run_migrations()
