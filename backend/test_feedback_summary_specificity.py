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


class FeedbackSummarySpecificityTests(unittest.TestCase):
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

        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, sentiment, sentiment_score, churn_risk, churn_impact,
                pain_point_category, theme_primary, theme_cluster, cluster_label, user_segment,
                solving_priority, created_at, metadata_json, last_analyzed_at, source, source_type, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    1,
                    1,
                    "Please add Slack integration for alert routing. We may churn without it.",
                    "negative",
                    -0.8,
                    "high",
                    "high",
                    "Feature",
                    "Feature",
                    "Feature",
                    "feature cluster",
                    "Veteran",
                    "critical",
                    "2026-04-01T10:00:00",
                    """{"analysis":{"issue":"Feature","feature_request":"Slack integration for alert routing","user_suggestion":"None","root_cause":"No integration available","theme_cluster":"Feature","theme_primary":"Feature"}}""",
                    "2026-04-02T10:00:00",
                    "manual",
                    "other",
                    1,
                ),
                (
                    2,
                    1,
                    "Need Slack integration for alert routing to keep the team on this tool.",
                    "negative",
                    -0.7,
                    "high",
                    "high",
                    "Feature",
                    "Feature",
                    "Feature gap",
                    "feature cluster",
                    "Veteran",
                    "high",
                    "2026-04-01T11:00:00",
                    """{"analysis":{"issue":"Feature request","feature_request":"Slack integration for alert routing","user_suggestion":"None","root_cause":"No native connector","theme_cluster":"Feature gap","theme_primary":"Feature"}}""",
                    "2026-04-02T11:00:00",
                    "manual",
                    "other",
                    2,
                ),
                (
                    3,
                    1,
                    "Need CSV export for invoices before renewal.",
                    "negative",
                    -0.6,
                    "medium",
                    "medium",
                    "Feature",
                    "Feature",
                    "Feature",
                    "feature cluster",
                    "Neutral",
                    "high",
                    "2026-04-01T12:00:00",
                    """{"analysis":{"issue":"Feature","feature_request":"None","user_suggestion":"None","root_cause":"None","theme_cluster":"Feature","theme_primary":"Feature"}}""",
                    "2026-04-02T12:00:00",
                    "manual",
                    "other",
                    3,
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

    def test_summary_prefers_specific_feature_gap_over_generic_feature_label(self):
        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            summary = feedback_crm.fi_get_analysis_summary(1)

        main_problem = str((summary.get("main_problem_to_fix") or {}).get("pain_point") or "").lower()
        self.assertNotEqual(main_problem, "feature")
        self.assertNotEqual(main_problem, "feature gap")
        self.assertIn("slack", main_problem)

        actionable = summary.get("top_actionable_issues") or []
        self.assertGreaterEqual(len(actionable), 1)
        self.assertIn("slack", str(actionable[0].get("pain_point") or "").lower())

    def test_summary_never_returns_plain_feature_when_only_generic_rows_exist(self):
        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM fi_feedback")
        cur.executemany(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, sentiment, sentiment_score, churn_risk, churn_impact,
                pain_point_category, theme_primary, theme_cluster, cluster_label, user_segment,
                solving_priority, created_at, metadata_json, last_analyzed_at, source, source_type, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    10,
                    1,
                    "Needs improvement",
                    "negative",
                    -0.5,
                    "medium",
                    "medium",
                    "Feature",
                    "Feature",
                    "Feature",
                    "feature cluster",
                    "Neutral",
                    "high",
                    "2026-04-01T10:00:00",
                    """{"analysis":{"issue":"Feature","feature_request":"None","user_suggestion":"None","root_cause":"None","theme_cluster":"Feature","theme_primary":"Feature"}}""",
                    "2026-04-02T10:00:00",
                    "manual",
                    "other",
                    3,
                ),
                (
                    11,
                    1,
                    "Could be better",
                    "negative",
                    -0.4,
                    "medium",
                    "medium",
                    "Feature",
                    "Feature",
                    "Feature gap",
                    "feature cluster",
                    "Neutral",
                    "high",
                    "2026-04-01T11:00:00",
                    """{"analysis":{"issue":"Feature gap","feature_request":"None","user_suggestion":"None","root_cause":"None","theme_cluster":"Feature gap","theme_primary":"Feature"}}""",
                    "2026-04-02T11:00:00",
                    "manual",
                    "other",
                    3,
                ),
            ],
        )
        conn.commit()
        conn.close()

        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            summary = feedback_crm.fi_get_analysis_summary(1)

        main_problem = str((summary.get("main_problem_to_fix") or {}).get("pain_point") or "").strip().lower()
        self.assertNotIn(main_problem, {"feature", "feature gap", "feature request"})

    def test_summary_treats_missing_capability_phrase_as_generic(self):
        conn = _connect(self.db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM fi_feedback")
        cur.execute(
            """
            INSERT INTO fi_feedback (
                id, tenant_id, text, sentiment, sentiment_score, churn_risk, churn_impact,
                pain_point_category, theme_primary, theme_cluster, cluster_label, user_segment,
                solving_priority, created_at, metadata_json, last_analyzed_at, source, source_type, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                21,
                1,
                "App is okay but could be better.",
                "negative",
                -0.3,
                "medium",
                "medium",
                "Feature",
                "Feature",
                "Feature request or gap",
                "feature cluster",
                "Neutral",
                "high",
                "2026-04-01T10:00:00",
                """{"analysis":{"issue":"Feature request or gap","feature_request":"requested improvement","user_suggestion":"customer suggested a missing capability","root_cause":"none","theme_cluster":"Feature request or gap","theme_primary":"Feature"}}""",
                "2026-04-02T10:00:00",
                "manual",
                "other",
                3,
            ),
        )
        conn.commit()
        conn.close()

        with patch("feedback_crm.get_db_connection", side_effect=lambda: _connect(self.db_path)):
            summary = feedback_crm.fi_get_analysis_summary(1)

        main_problem = str((summary.get("main_problem_to_fix") or {}).get("pain_point") or "").strip().lower()
        self.assertNotIn(
            main_problem,
            {
                "feature",
                "feature request",
                "feature gap",
                "feature request or gap",
                "customer suggested a missing capability",
                "requested improvement",
            },
        )


if __name__ == "__main__":
    unittest.main()
