import sqlite3
import os
import json
import threading

# Path to the telemetry database
DB_PATH = os.path.join(os.path.dirname(__file__), 'admin_telemetry.db')
_lock = threading.Lock()

def _get_conn():
    """Get a thread-safe connection with dictionary cursor."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the telemetry database schema."""
    with _lock:
        with _get_conn() as conn:
            cursor = conn.cursor()
            
            # --- Analysis Jobs Table ---
            # Tracks batches of reviews analyzed
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS analysis_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_uuid TEXT UNIQUE,
                    user_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total_reviews INTEGER,
                    successful_reviews INTEGER,
                    failed_reviews INTEGER,
                    total_time_seconds REAL,
                    vertical TEXT
                )
            ''')
            
            # --- Error Logs Table ---
            # Tracks specific errors (parsing failures, LLM timeouts, dropped reviews)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    error_type TEXT,
                    review_id TEXT,
                    message TEXT,
                    raw_llm_response TEXT,
                    job_uuid TEXT
                )
            ''')
            
            # --- System Metrics Table ---
            # Tracks point-in-time metrics like LLM latency
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metric_name TEXT,
                    metric_value REAL,
                    metadata TEXT
                )
            ''')
            conn.commit()

# Run init on import
init_db()

def log_analysis_job(job_uuid: str, user_id: str, total_reviews: int, successful: int, failed: int, time_seconds: float, vertical: str):
    """Log a completed batch analysis job."""
    try:
        with _lock:
            with _get_conn() as conn:
                conn.execute('''
                    INSERT INTO analysis_jobs 
                    (job_uuid, user_id, total_reviews, successful_reviews, failed_reviews, total_time_seconds, vertical)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (job_uuid, str(user_id), total_reviews, successful, failed, time_seconds, vertical))
                conn.commit()
    except Exception as e:
        print(f"[Telemetry] Error logging analysis job: {e}")

def log_error(error_type: str, message: str, review_id: str = None, raw_response: str = None, job_uuid: str = None):
    """Log an LLM or parsing error."""
    try:
        with _lock:
            with _get_conn() as conn:
                conn.execute('''
                    INSERT INTO error_logs 
                    (error_type, message, review_id, raw_llm_response, job_uuid)
                    VALUES (?, ?, ?, ?, ?)
                ''', (error_type, message, str(review_id) if review_id else None, str(raw_response) if raw_response else None, job_uuid))
                conn.commit()
    except Exception as e:
        print(f"[Telemetry] Error logging error: {e}")

def log_metric(metric_name: str, value: float, metadata: dict = None):
    """Log a system metric (e.g., LLM health check latency)."""
    try:
        meta_str = json.dumps(metadata) if metadata else None
        with _lock:
            with _get_conn() as conn:
                conn.execute('''
                    INSERT INTO system_metrics (metric_name, metric_value, metadata)
                    VALUES (?, ?, ?)
                ''', (metric_name, float(value), meta_str))
                conn.commit()
    except Exception as e:
        print(f"[Telemetry] Error logging metric: {e}")

# --- Admin Read Methods ---

def get_dashboard_stats():
    """Get aggregated stats for the admin dashboard overview."""
    try:
        with _get_conn() as conn:
            cursor = conn.cursor()
            
            # Today's jobs
            cursor.execute("SELECT SUM(total_reviews), SUM(successful_reviews), SUM(failed_reviews) FROM analysis_jobs WHERE date(timestamp) = date('now')")
            today_totals = cursor.fetchone()
            
            # Latest LLM Latency
            cursor.execute("SELECT metric_value FROM system_metrics WHERE metric_name = 'llm_latency' ORDER BY timestamp DESC LIMIT 1")
            latest_latency = cursor.fetchone()
            
            # Recent Errors Count
            cursor.execute("SELECT COUNT(*) FROM error_logs WHERE date(timestamp) = date('now')")
            errors_today = cursor.fetchone()[0]
            
            return {
                "today_total_reviews": today_totals[0] or 0,
                "today_successful": today_totals[1] or 0,
                "today_failed": today_totals[2] or 0,
                "latest_llm_latency_ms": latest_latency[0] if latest_latency else 0,
                "errors_today": errors_today,
                "success_rate": round(((today_totals[1] or 0) / (today_totals[0] or 1)) * 100, 1) if today_totals[0] else 100.0
            }
    except Exception as e:
        print(f"[Telemetry] Error getting stats: {e}")
        return {}

def get_recent_errors(limit: int = 50):
    """Get the most recent errors."""
    try:
        with _get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception:
        return []

def get_recent_jobs(limit: int = 20):
    """Get the most recent analysis jobs."""
    try:
        with _get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM analysis_jobs ORDER BY timestamp DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception:
        return []
