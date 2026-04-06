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


class FeedbackFilterTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        handle.close()
        self.db_path = handle.name

        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE cxm_sources (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER,
                is_active INTEGER DEFAULT 1
            );

            CREATE TABLE fi_customers (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER,
                customer_identifier TEXT
            );

            CREATE TABLE fi_issues (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER,
                name TEXT
            );

            CREATE TABLE fi_feedback (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                text TEXT,
                source TEXT,
                source_type TEXT,
                rating INTEGER,
                metadata_json TEXT,
                customer_id INTEGER,
                issue_id INTEGER,
                status TEXT,
                priority TEXT,
                sentiment TEXT,
                sentiment_score REAL,
                churn_risk TEXT,
                last_analyzed_at TEXT,
                created_at TEXT
            );
            """
        )

        cur.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (1, 1, "customer@example.com"),
        )
        cur.execute(
            "INSERT INTO cxm_sources (id, tenant_id, is_active) VALUES (?, ?, ?)",
            (101, 1, 1),
        )
        cur.execute(
            "INSERT INTO cxm_sources (id, tenant_id, is_active) VALUES (?, ?, ?)",
            (102, 1, 0),
        )
        cur.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (1, 1, "Login issue"),
        )
        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, source, source_type, rating, metadata_json,
                customer_id, issue_id, status, priority, sentiment, sentiment_score,
                churn_risk, last_analyzed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    1,
                    1,
                    "Play Store review",
                    "google",
                    "playstore",
                    5,
                    "{}",
                    1,
                    1,
                    "open",
                    "high",
                    "positive",
                    0.9,
                    "low",
                    "2026-03-10T10:00:00",
                    "2026-03-04T10:00:00",
                ),
                (
                    2,
                    1,
                    "App Store review",
                    "google",
                    "appstore",
                    4,
                    "{}",
                    1,
                    1,
                    "open",
                    "medium",
                    "neutral",
                    0.1,
                    "medium",
                    "2026-03-10T10:00:00",
                    "2026-03-04T18:15:00",
                ),
                (
                    3,
                    1,
                    "Trustpilot review",
                    "trustpilot",
                    "trustpilot",
                    2,
                    "{}",
                    1,
                    1,
                    "resolved",
                    "low",
                    "negative",
                    -0.7,
                    "high",
                    "2026-03-10T10:00:00",
                    "2026-03-05T09:00:00",
                ),
                (
                    4,
                    1,
                    "Active connector review",
                    "Active Connector",
                    "csv",
                    3,
                    "{\"cxm_source_id\": 101}",
                    1,
                    1,
                    "open",
                    "medium",
                    "neutral",
                    0.0,
                    "low",
                    "2026-03-10T10:00:00",
                    "2026-03-06T09:00:00",
                ),
                (
                    5,
                    1,
                    "Inactive connector review",
                    "Inactive Connector",
                    "csv",
                    1,
                    "{\"cxm_source_id\": 102}",
                    1,
                    1,
                    "open",
                    "high",
                    "negative",
                    -0.8,
                    "high",
                    "2026-03-10T10:00:00",
                    "2026-03-06T10:00:00",
                ),
            ],
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_feedback_list_end_date_includes_same_day_reviews(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_list_feedback(
                1,
                end_date="2026-03-04",
            )

        self.assertEqual({item["id"] for item in payload["items"]}, {1, 2})

    def test_feedback_list_can_scope_same_source_by_source_type(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_list_feedback(
                1,
                source="google",
                source_type="playstore",
            )

        self.assertEqual([item["id"] for item in payload["items"]], [1])

    def test_feedback_list_supports_multi_star_filter(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_list_feedback(
                1,
                rating_values=[2],
            )

        self.assertEqual([item["id"] for item in payload["items"]], [3])

    def test_feedback_list_excludes_inactive_connector_records(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_list_feedback(1)

        returned_ids = {item["id"] for item in payload["items"]}
        self.assertIn(4, returned_ids)
        self.assertNotIn(5, returned_ids)
        source_names = {option.get("source") for option in payload.get("source_options", [])}
        self.assertIn("Active Connector", source_names)
        self.assertNotIn("Inactive Connector", source_names)

    def test_analysis_selection_end_date_is_inclusive_for_exact_feedback_ids(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            rows = feedback_crm.fi_get_feedback_records_for_analysis(
                1,
                feedback_ids=[2],
                end_date="2026-03-04",
            )

        self.assertEqual([row["id"] for row in rows], [2])

    def test_analysis_trends_end_date_is_inclusive_for_exact_feedback_ids(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            trends = feedback_crm.fi_get_analysis_trends(
                1,
                feedback_ids=[1, 2],
                start_date="2026-03-01",
                end_date="2026-03-04",
                period="day",
            )

        self.assertEqual(sum(int(row["total_reviews"]) for row in trends), 2)
        self.assertEqual({row["bucket"] for row in trends}, {"2026-03-04"})


if __name__ == "__main__":
    unittest.main()
