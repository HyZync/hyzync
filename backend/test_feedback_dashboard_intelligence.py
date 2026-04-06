import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import feedback_crm


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


class FeedbackDashboardIntelligenceTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        handle.close()
        self.db_path = handle.name
        self.now = datetime.utcnow()

        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE fi_customers (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                customer_identifier TEXT
            );

            CREATE TABLE fi_issues (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                name TEXT,
                mention_count INTEGER DEFAULT 0,
                negative_ratio REAL DEFAULT 0.0,
                impact_score REAL DEFAULT 0.0,
                trend TEXT DEFAULT 'stable',
                status TEXT DEFAULT 'open'
            );

            CREATE TABLE fi_feedback (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                text TEXT,
                sentiment TEXT,
                sentiment_score REAL,
                churn_risk TEXT,
                theme_primary TEXT,
                theme_cluster TEXT,
                pain_point_category TEXT,
                source TEXT,
                priority TEXT,
                status TEXT,
                customer_id INTEGER,
                issue_id INTEGER,
                created_at TEXT,
                last_analyzed_at TEXT
            );
            """
        )

        cur.executemany(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            [
                (1, 1, "alpha@example.com"),
                (2, 1, "bravo@example.com"),
                (3, 1, "charlie@example.com"),
            ],
        )

        cur.executemany(
            """
            INSERT INTO fi_issues (id, tenant_id, name, mention_count, negative_ratio, impact_score, trend, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (1, 1, "Pricing complaints", 10, 0.8, 8.0, "rising", "open"),
                (2, 1, "Onboarding confusion", 7, 0.6, 4.2, "stable", "open"),
                (3, 1, "App reliability", 4, 0.75, 3.0, "rising", "open"),
            ],
        )

        feedback_rows = [
            # Pricing friction (dominant churn driver)
            (1, 1, "Pricing is too expensive", "negative", -0.90, "high", "Pricing", "Pricing friction", "Pricing", "appstore", "high", "open", 1, 1, self._iso(days_ago=1), self._iso(days_ago=1)),
            (2, 1, "Subscription cost is unfair", "negative", -0.80, "high", "Pricing", "Pricing friction", "Pricing", "playstore", "high", "open", 1, 1, self._iso(days_ago=2), self._iso(days_ago=2)),
            (3, 1, "Billing is confusing", "negative", -0.65, "medium", "Pricing", "Pricing friction", "Billing", "trustpilot", "medium", "open", 2, 1, self._iso(days_ago=3), self._iso(days_ago=3)),
            (4, 1, "Plan value is not clear", "negative", -0.70, "medium", "Pricing", "Pricing friction", "Pricing", "appstore", "high", "open", 2, 1, self._iso(days_ago=11), self._iso(days_ago=11)),
            # Onboarding friction
            (5, 1, "Setup flow is confusing", "negative", -0.60, "medium", "Onboarding", "Onboarding setup", "Onboarding", "playstore", "medium", "open", 2, 2, self._iso(days_ago=4), self._iso(days_ago=4)),
            (6, 1, "Could not finish onboarding", "negative", -0.55, "low", "Onboarding", "Onboarding setup", "Onboarding", "playstore", "medium", "open", 3, 2, self._iso(days_ago=9), self._iso(days_ago=9)),
            (7, 1, "Onboarding was smooth", "positive", 0.75, "low", "Onboarding", "Onboarding setup", "Onboarding", "appstore", "low", "resolved", 3, 2, self._iso(days_ago=6), self._iso(days_ago=6)),
            # Reliability
            (8, 1, "App crashes too often", "negative", -0.85, "high", "Reliability", "App reliability", "Performance", "trustpilot", "high", "open", 2, 3, self._iso(days_ago=10), self._iso(days_ago=10)),
            (9, 1, "Crash while saving", "negative", -0.88, "high", "Reliability", "App reliability", "Performance", "trustpilot", "high", "open", 1, 3, self._iso(days_ago=2), self._iso(days_ago=2)),
            # Tenant 2 (un-analyzed baseline)
            (101, 2, "No analysis yet", "neutral", 0.0, "low", "General", "General", "Other", "manual", "low", "open", None, None, self._iso(days_ago=1), None),
        ]

        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, sentiment, sentiment_score, churn_risk,
                theme_primary, theme_cluster, pain_point_category,
                source, priority, status, customer_id, issue_id,
                created_at, last_analyzed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            feedback_rows,
        )

        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def _iso(self, *, days_ago: int) -> str:
        return (self.now - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%S")

    def test_product_health_exposes_churn_intelligence_answers(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_product_health(1)

        churn = payload.get("churn_intelligence") or {}
        drivers = (churn.get("why_users_are_leaving") or {}).get("top_drivers") or []
        fix_first = (churn.get("what_to_fix_first") or {}).get("prioritized_issues") or []
        risk_section = churn.get("who_is_at_risk") or {}
        risk_summary = risk_section.get("summary") or {}
        risk_users = risk_section.get("users") or []
        actions = (churn.get("what_to_do_next") or {}).get("actions") or []

        self.assertGreaterEqual(len(drivers), 1)
        self.assertEqual(drivers[0]["driver"], "Pricing friction")
        self.assertIn("trend", drivers[0])
        self.assertIn("avg_sentiment", drivers[0])

        self.assertGreaterEqual(len(fix_first), 1)
        self.assertEqual(fix_first[0]["driver"], "Pricing friction")
        self.assertEqual(fix_first[0]["rank"], 1)
        self.assertIn("priority_tier", fix_first[0])

        self.assertGreaterEqual(int(risk_summary.get("high", 0)), 1)
        self.assertTrue(any(user.get("risk_level") == "high" for user in risk_users))
        self.assertTrue(any(user.get("customer_identifier") == "alpha@example.com" for user in risk_users))

        self.assertGreaterEqual(len(actions), 1)
        self.assertTrue(any("reach out" in str(item.get("action", "")).lower() for item in actions))

    def test_product_health_handles_missing_analyzed_feedback(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            payload = feedback_crm.fi_product_health(2)

        churn = payload.get("churn_intelligence") or {}
        drivers = (churn.get("why_users_are_leaving") or {}).get("top_drivers") or []
        fix_first = (churn.get("what_to_fix_first") or {}).get("prioritized_issues") or []
        risk_section = churn.get("who_is_at_risk") or {}
        risk_summary = risk_section.get("summary") or {}
        actions = (churn.get("what_to_do_next") or {}).get("actions") or []

        self.assertEqual(drivers, [])
        self.assertEqual(fix_first, [])
        self.assertEqual(int(risk_summary.get("total", -1)), 0)
        self.assertGreaterEqual(len(actions), 1)
        self.assertEqual(actions[0].get("title"), "No urgent churn actions detected")


if __name__ == "__main__":
    unittest.main()
