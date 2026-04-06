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


class FeedbackImpactMemoryTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        handle.close()
        self.db_path = handle.name
        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE fi_feedback (
                id INTEGER PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                text TEXT,
                sentiment TEXT,
                sentiment_score REAL,
                churn_risk TEXT,
                churn_impact TEXT,
                pain_point_category TEXT,
                theme_primary TEXT,
                theme_cluster TEXT,
                cluster_label TEXT,
                user_segment TEXT,
                solving_priority TEXT,
                created_at TEXT,
                metadata_json TEXT,
                last_analyzed_at TEXT,
                source TEXT,
                source_type TEXT,
                rating INTEGER
            );
            """
        )

        now = datetime.utcnow()
        rows = [
            (
                1,
                1,
                "Payment retries fail after card updates and users threaten cancellation.",
                "negative",
                -0.8,
                "high",
                "high",
                "Billing",
                "Billing & Payments",
                "Billing > failed payment retries",
                "Billing > failed payment retries",
                "Detractor",
                "critical",
                (now - timedelta(days=1)).isoformat(),
                """{"analysis":{"issue":"Payment retries fail after card updates","root_cause":"Retry flow does not recover new cards","action_recommendation":"Add robust retry fallback for updated cards","feature_request":"None","user_suggestion":"None","theme_primary":"Billing & Payments","theme_cluster":"Billing > failed payment retries","urgency":"High","revenue_sensitivity":true,"confidence":0.84,"action_confidence":0.88}}""",
                (now - timedelta(days=1)).isoformat(),
                "manual",
                "other",
                1,
            ),
            (
                2,
                1,
                "Card update still fails and recurring payment does not resume.",
                "negative",
                -0.7,
                "high",
                "high",
                "Billing",
                "Billing & Payments",
                "Billing > failed payment retries",
                "Billing > failed payment retries",
                "Detractor",
                "high",
                (now - timedelta(days=3)).isoformat(),
                """{"analysis":{"issue":"Payment retries fail after card updates","root_cause":"Billing retrier stops after first failure","action_recommendation":"Retry token refresh and reattempt payment","feature_request":"None","user_suggestion":"None","theme_primary":"Billing & Payments","theme_cluster":"Billing > failed payment retries","urgency":"High","revenue_sensitivity":true,"confidence":0.81,"action_confidence":0.86}}""",
                (now - timedelta(days=3)).isoformat(),
                "manual",
                "other",
                1,
            ),
            (
                3,
                1,
                "Recurring payments fail after card update and we plan to switch.",
                "negative",
                -0.9,
                "high",
                "high",
                "Billing",
                "Billing & Payments",
                "Billing > failed payment retries",
                "Billing > failed payment retries",
                "Detractor",
                "critical",
                (now - timedelta(days=9)).isoformat(),
                """{"analysis":{"issue":"Payment retries fail after card updates","root_cause":"Card refresh not propagated","action_recommendation":"Fix payment retry orchestration","feature_request":"None","user_suggestion":"None","theme_primary":"Billing & Payments","theme_cluster":"Billing > failed payment retries","urgency":"High","revenue_sensitivity":true,"confidence":0.83,"action_confidence":0.85}}""",
                (now - timedelta(days=9)).isoformat(),
                "manual",
                "other",
                1,
            ),
            (
                4,
                1,
                "Navigation is confusing in settings.",
                "negative",
                -0.4,
                "medium",
                "medium",
                "UX",
                "UX & Workflow",
                "UX > settings navigation confusion",
                "UX > settings navigation confusion",
                "Neutral",
                "medium",
                (now - timedelta(days=2)).isoformat(),
                """{"analysis":{"issue":"Settings navigation confusion","root_cause":"Too many nested menus","action_recommendation":"Simplify settings IA","feature_request":"None","user_suggestion":"None","theme_primary":"UX & Workflow","theme_cluster":"UX > settings navigation confusion","urgency":"Medium","revenue_sensitivity":false,"confidence":0.76,"action_confidence":0.72}}""",
                (now - timedelta(days=2)).isoformat(),
                "manual",
                "other",
                2,
            ),
        ]
        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, sentiment, sentiment_score, churn_risk, churn_impact,
                pain_point_category, theme_primary, theme_cluster, cluster_label, user_segment,
                solving_priority, created_at, metadata_json, last_analyzed_at, source, source_type, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except OSError:
            pass

    def test_summary_includes_impact_confidence_and_recurring_patterns(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            summary = feedback_crm.fi_get_analysis_summary(1)

        self.assertGreater(float(summary.get("avg_action_confidence") or 0.0), 0.0)
        self.assertGreater(float(summary.get("avg_business_impact_score") or 0.0), 70.0)

        recurring = summary.get("recurring_issue_patterns") or []
        self.assertGreaterEqual(len(recurring), 1)
        top = recurring[0]
        self.assertIn("payment", str(top.get("pattern") or "").lower())
        self.assertGreaterEqual(int(top.get("mention_count") or 0), 3)
        self.assertEqual(str(top.get("trend_direction") or ""), "rising")


if __name__ == "__main__":
    unittest.main()
