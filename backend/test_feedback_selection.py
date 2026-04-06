import os
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import feedback_crm


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


class FeedbackSelectionTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        handle.close()
        self.db_path = handle.name
        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE fi_customers (
                id INTEGER PRIMARY KEY,
                customer_identifier TEXT
            );

            CREATE TABLE fi_feedback (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                text TEXT,
                rating INTEGER,
                source TEXT,
                source_type TEXT,
                created_at TEXT,
                metadata_json TEXT,
                customer_id INTEGER,
                sentiment TEXT,
                sentiment_score REAL,
                churn_risk TEXT,
                status TEXT,
                last_analyzed_at TEXT
            );
            """
        )
        cur.execute(
            "INSERT INTO fi_customers (id, customer_identifier) VALUES (?, ?)",
            (1, "customer@example.com"),
        )
        reviews = [
            (1, 1, "Review 1", 5, "google", "google", "2026-03-01T10:00:00", "{}", 1, "positive", 0.9, "low", "open", "2026-03-10T10:00:00"),
            (2, 1, "Review 2", 4, "google", "google", "2026-03-02T10:00:00", "{}", 1, "neutral", 0.1, "medium", "open", "2026-03-10T10:00:00"),
            (3, 1, "Review 3", 2, "google", "google", "2026-03-03T10:00:00", "{}", 1, "negative", -0.8, "high", "open", "2026-03-10T10:00:00"),
            (4, 1, "Review 4", 1, "google", "google", "2026-03-04T10:00:00", "{}", 1, "negative", -0.6, "high", "open", "2026-03-10T10:00:00"),
        ]
        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, rating, source, source_type, created_at,
                metadata_json, customer_id, sentiment, sentiment_score, churn_risk, status, last_analyzed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            reviews,
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_exact_feedback_ids_ignore_limit_and_offset(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            rows = feedback_crm.fi_get_feedback_records_for_analysis(
                1,
                feedback_ids=[2, 3, 4],
                limit=1,
                offset=2,
            )

        self.assertEqual(len(rows), 3)
        self.assertEqual({row["id"] for row in rows}, {2, 3, 4})

    def test_trends_can_be_scoped_to_exact_feedback_ids(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            trends = feedback_crm.fi_get_analysis_trends(
                1,
                feedback_ids=[1, 3],
                start_date="2026-03-01T00:00:00",
                end_date="2026-03-31T23:59:59",
                period="day",
            )

        self.assertEqual(sum(int(row["total_reviews"]) for row in trends), 2)
        self.assertEqual({row["bucket"] for row in trends}, {"2026-03-01", "2026-03-03"})

    def test_exact_feedback_ids_can_skip_already_analyzed_rows(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            rows = feedback_crm.fi_get_feedback_records_for_analysis(
                1,
                feedback_ids=[1, 2, 3],
                include_analyzed=False,
            )

        self.assertEqual(rows, [])

    def test_feedback_row_requires_reanalysis_for_missing_prompt_version(self):
        row = {
            "last_analyzed_at": "2026-03-10T10:00:00",
            "metadata_json": """{"analysis":{"issue":"Feature","cleaning_version":"feedback_crm_clean_v2"}}""",
        }
        self.assertTrue(feedback_crm.fi_feedback_row_requires_reanalysis(row))

    def test_feedback_row_reanalysis_not_required_for_current_versions(self):
        row = {
            "last_analyzed_at": "2026-03-10T10:00:00",
            "metadata_json": (
                '{"analysis":{"prompt_version":"feedback_crm_v5","cleaning_version":"feedback_crm_clean_v2"}}'
            ),
        }
        self.assertFalse(feedback_crm.fi_feedback_row_requires_reanalysis(row))

    def test_feedback_row_requires_reanalysis_for_unanalyzed_row(self):
        row = {
            "last_analyzed_at": None,
            "metadata_json": "{}",
        }
        self.assertTrue(feedback_crm.fi_feedback_row_requires_reanalysis(row))


if __name__ == "__main__":
    unittest.main()
