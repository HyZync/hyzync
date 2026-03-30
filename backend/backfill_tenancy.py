"""
Backfill script to normalize tenant_id values.
Sets tenant_id = 1 for all entries that currently have NULL tenant_id.
This ensures visibility for sessions using dev_token_123.
"""
import sqlite3
import os

DB_PATH = 'd:/Rev_New/backend/data/app.db'

TABLES_WITH_TENANT = [
    'users',
    'workspaces',
    'cxm_sources',
    'analysis_history',
    'raw_reviews',
    'surveys',
    'crm_profiles',
    'crm_feedbacks',
    'crm_analyses',
    'cxm_reviews',
    'cxm_campaigns'
]

def backfill():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print(f"Starting backfill on {DB_PATH}...")

    for table in TABLES_WITH_TENANT:
        try:
            # First check if column exists
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [col[1] for col in cursor.fetchall()]
            
            if 'tenant_id' in columns:
                cursor.execute(f"UPDATE {table} SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0")
                print(f"  [OK] Updated {cursor.rowcount} rows in '{table}'")
            else:
                print(f"  [SKIP] Column 'tenant_id' not found in '{table}'")
        except Exception as e:
            print(f"  [ERROR] Failed to update '{table}': {e}")

    conn.commit()
    conn.close()
    print("Backfill complete.")

if __name__ == "__main__":
    backfill()
