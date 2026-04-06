import os
import json
import sqlite3
import unittest
import uuid

from appstore_connector import estimate_appstore_pages
from connector_utils import resolve_connector_create_settings
import database
import workspace_admin


class ConnectorWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.original_db_path = database.DB_PATH
        self.temp_db_path = os.path.join(os.path.dirname(__file__), f"connector-test-{uuid.uuid4().hex}.db")
        database.DB_PATH = self.temp_db_path
        self.user_id = 101
        self.tenant_id = 202

        conn = sqlite3.connect(self.temp_db_path)
        conn.execute(
            """
            CREATE TABLE cxm_sources (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE raw_reviews (
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
                UNIQUE(source_type, identifier, external_id, content)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE cxm_reviews (
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
                is_analyzed BOOLEAN DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                customer_identifier TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                name TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                source TEXT,
                source_type TEXT,
                metadata_json TEXT,
                customer_id INTEGER,
                issue_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_fetch_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                source_ids_json TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_analysis_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                source_ids_json TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_analysis_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                analysis_run_id INTEGER NOT NULL,
                feedback_id INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE fi_outreach_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                feedback_id INTEGER NOT NULL,
                kb_offer_id INTEGER NOT NULL,
                channel TEXT NOT NULL,
                message TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER,
                source_type TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)

    def test_workspace_style_connector_settings_are_resolved_from_config(self):
        cfg, fetch_interval, analysis_interval, max_reviews = resolve_connector_create_settings(
            {"fetch_interval": "manual", "max_reviews": 275},
            fetch_interval=None,
            analysis_interval=None,
            max_reviews=None,
            default_fetch_interval="daily",
            follow_fetch_for_analysis=True,
        )

        self.assertEqual(fetch_interval, "manual")
        self.assertEqual(analysis_interval, "manual")
        self.assertEqual(max_reviews, 275)
        self.assertEqual(cfg["count"], 275)
        self.assertEqual(cfg["max_reviews"], 275)

    def test_appstore_page_estimate_rounds_up(self):
        self.assertEqual(estimate_appstore_pages(1), 1)
        self.assertEqual(estimate_appstore_pages(50), 1)
        self.assertEqual(estimate_appstore_pages(51), 2)
        self.assertEqual(estimate_appstore_pages(149), 3)

    def test_generic_api_connector_endpoint_update_sets_live_api_url(self):
        source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "api",
            "https://old.example.com/reviews",
            "REST Source",
            {"api_url": "https://old.example.com/reviews", "method": "GET"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="workspace",
        )

        updated = workspace_admin.update_connector_settings(
            source_id,
            self.user_id,
            self.tenant_id,
            {
                "config": {
                    "url": "https://new.example.com/reviews",
                    "method": "POST",
                }
            },
        )

        self.assertIsNotNone(updated)
        config = updated["config"]
        self.assertEqual(config["api_url"], "https://new.example.com/reviews")
        self.assertEqual(config["url"], "https://new.example.com/reviews")
        self.assertEqual(config["endpoint"], "https://new.example.com/reviews")
        self.assertEqual(config["method"], "POST")

    def test_raw_review_dedup_is_scoped_by_tenant_and_workspace(self):
        review = {
            "id": "abc123",
            "content": "Great app",
            "score": 5,
            "userName": "Tester",
            "at": "2026-04-02 12:00:00",
        }

        added_a, skipped_a = database.save_raw_reviews(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            [review],
            workspace_id=10,
        )
        added_b, skipped_b = database.save_raw_reviews(
            self.user_id,
            self.tenant_id + 1,
            "appstore",
            "Spotify",
            [review],
            workspace_id=20,
        )
        added_c, skipped_c = database.save_raw_reviews(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            [review],
            workspace_id=10,
        )

        self.assertEqual((added_a, skipped_a), (1, 0))
        self.assertEqual((added_b, skipped_b), (1, 0))
        self.assertEqual((added_c, skipped_c), (0, 1))

    def test_workspace_review_reads_fall_back_to_tenant_cache(self):
        review = {
            "id": "abc123",
            "content": "Great app",
            "score": 5,
            "userName": "Tester",
            "at": "2026-04-02 12:00:00",
        }
        database.save_raw_reviews(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            [review],
            workspace_id=None,
        )

        stats = database.get_raw_review_stats(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            workspace_id=10,
        )
        reviews = database.get_latest_raw_reviews(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            workspace_id=10,
        )

        self.assertEqual(stats["total"], 1)
        self.assertEqual(len(reviews), 1)

    def test_delete_user_connector_purges_loaded_data(self):
        source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            "Spotify App Store",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )
        other_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "csv",
            "fresh.csv",
            "Fresh CSV",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )

        conn = sqlite3.connect(self.temp_db_path)
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id, None, "appstore", "Spotify", "raw-1", "Old app store review"),
        )
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id, None, "csv", "fresh.csv", "raw-2", "CSV review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (source_id, self.user_id, self.tenant_id, "cxm-1", "Old app store review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (other_source_id, self.user_id, self.tenant_id, "cxm-2", "CSV review"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (1, self.tenant_id, "legacy-user"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (2, self.tenant_id, "csv-user"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (1, self.tenant_id, "Legacy issue"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (2, self.tenant_id, "CSV issue"),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (1, self.tenant_id, "Old app store review", "Spotify", "appstore", json.dumps({"cxm_source_id": source_id}), 1, 1),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (2, self.tenant_id, "CSV review", "Fresh CSV", "csv", json.dumps({"cxm_source_id": other_source_id}), 2, 2),
        )
        conn.execute(
            "INSERT INTO fi_outreach_drafts (tenant_id, feedback_id, kb_offer_id, channel, message) VALUES (?, ?, ?, ?, ?)",
            (self.tenant_id, 1, 101, "email", "legacy draft"),
        )
        conn.execute(
            "INSERT INTO fi_outreach_drafts (tenant_id, feedback_id, kb_offer_id, channel, message) VALUES (?, ?, ?, ?, ?)",
            (self.tenant_id, 2, 202, "email", "csv draft"),
        )
        conn.execute(
            "INSERT INTO fi_fetch_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (1, self.tenant_id, json.dumps([source_id])),
        )
        conn.execute(
            "INSERT INTO fi_fetch_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (2, self.tenant_id, json.dumps([source_id, other_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (1, self.tenant_id, json.dumps([source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (2, self.tenant_id, json.dumps([source_id, other_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_results (tenant_id, analysis_run_id, feedback_id) VALUES (?, ?, ?)",
            (self.tenant_id, 1, 1),
        )
        conn.execute(
            "INSERT INTO fi_analysis_results (tenant_id, analysis_run_id, feedback_id) VALUES (?, ?, ?)",
            (self.tenant_id, 2, 2),
        )
        conn.commit()
        conn.close()

        cleanup = database.delete_user_connector(source_id, self.tenant_id)

        self.assertTrue(cleanup["connector_deleted"])
        self.assertEqual(cleanup["cxm_reviews_deleted"], 1)
        self.assertEqual(cleanup["fi_feedback_deleted"], 1)

        conn = sqlite3.connect(self.temp_db_path)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (source_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (other_source_id,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE source_type = 'appstore' AND identifier = 'Spotify'").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE source_type = 'csv' AND identifier = 'fresh.csv'").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_reviews WHERE source_id = ?", (source_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_reviews WHERE source_id = ?", (other_source_id,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 2").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_outreach_drafts WHERE feedback_id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_outreach_drafts WHERE feedback_id = 2").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_customers WHERE id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_customers WHERE id = 2").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_issues WHERE id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_issues WHERE id = 2").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_fetch_runs WHERE id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT source_ids_json FROM fi_fetch_runs WHERE id = 2").fetchone()[0], json.dumps([other_source_id]))
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_analysis_runs WHERE id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT source_ids_json FROM fi_analysis_runs WHERE id = 2").fetchone()[0], json.dumps([other_source_id]))
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_analysis_results WHERE analysis_run_id = 1").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_analysis_results WHERE analysis_run_id = 2").fetchone()[0], 1)
        conn.close()

    def test_delete_user_connector_purges_legacy_feedback_without_cxm_source_id(self):
        source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "appstore",
            "Spotify",
            "Spotify App Store",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )
        other_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "appstore",
            "com.new.app",
            "New App Store",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )

        legacy_timestamp = "2026-04-04T10:00:00"
        conn = sqlite3.connect(self.temp_db_path)
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)",
            (source_id, self.user_id, self.tenant_id, "legacy-cxm-1", "Legacy app store review", legacy_timestamp),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                101,
                self.tenant_id,
                "Legacy app store review",
                "Spotify App Store (Spotify)",
                "appstore",
                "{}",
                legacy_timestamp,
            ),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
            (
                102,
                self.tenant_id,
                "Fresh review",
                "New App Store (com.new.app)",
                "appstore",
                json.dumps({"cxm_source_id": other_source_id}),
            ),
        )
        conn.commit()
        conn.close()

        cleanup = database.delete_user_connector(source_id, self.tenant_id)

        self.assertTrue(cleanup["connector_deleted"])
        self.assertGreaterEqual(cleanup["fi_feedback_deleted"], 1)

        conn = sqlite3.connect(self.temp_db_path)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 101").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 102").fetchone()[0], 1)
        conn.close()

    def test_reset_tenant_connector_data_clears_reviews_and_preserves_active_connector(self):
        active_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "csv",
            "current.csv",
            "Current CSV",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )
        inactive_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "appstore",
            "LegacyApp",
            "Legacy App",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )
        other_tenant_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id + 1,
            "csv",
            "other.csv",
            "Other CSV",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )

        conn = sqlite3.connect(self.temp_db_path)
        conn.execute(
            "UPDATE cxm_sources SET is_active = 0 WHERE id = ?",
            (inactive_source_id,),
        )
        conn.execute(
            "UPDATE cxm_sources SET last_fetched_at = '2026-04-04 10:00:00', last_analyzed_at = '2026-04-04 11:00:00' WHERE id = ?",
            (active_source_id,),
        )
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id, None, "csv", "current.csv", "tenant-raw", "Tenant review"),
        )
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id + 1, None, "csv", "other.csv", "other-raw", "Other tenant review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (active_source_id, self.user_id, self.tenant_id, "tenant-cxm", "Tenant review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (other_tenant_source_id, self.user_id, self.tenant_id + 1, "other-cxm", "Other tenant review"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (10, self.tenant_id, "tenant-user"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (20, self.tenant_id + 1, "other-user"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (10, self.tenant_id, "Tenant issue"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (20, self.tenant_id + 1, "Other issue"),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (10, self.tenant_id, "Tenant review", "Current CSV", "csv", json.dumps({"cxm_source_id": active_source_id}), 10, 10),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (20, self.tenant_id + 1, "Other tenant review", "Other CSV", "csv", json.dumps({"cxm_source_id": other_tenant_source_id}), 20, 20),
        )
        conn.execute(
            "INSERT INTO fi_outreach_drafts (tenant_id, feedback_id, kb_offer_id, channel, message) VALUES (?, ?, ?, ?, ?)",
            (self.tenant_id, 10, 10, "email", "tenant draft"),
        )
        conn.execute(
            "INSERT INTO fi_outreach_drafts (tenant_id, feedback_id, kb_offer_id, channel, message) VALUES (?, ?, ?, ?, ?)",
            (self.tenant_id + 1, 20, 20, "email", "other draft"),
        )
        conn.execute(
            "INSERT INTO fi_fetch_runs (tenant_id, source_ids_json) VALUES (?, ?)",
            (self.tenant_id, json.dumps([active_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_fetch_runs (tenant_id, source_ids_json) VALUES (?, ?)",
            (self.tenant_id + 1, json.dumps([other_tenant_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (10, self.tenant_id, json.dumps([active_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_runs (id, tenant_id, source_ids_json) VALUES (?, ?, ?)",
            (20, self.tenant_id + 1, json.dumps([other_tenant_source_id])),
        )
        conn.execute(
            "INSERT INTO fi_analysis_results (tenant_id, analysis_run_id, feedback_id) VALUES (?, ?, ?)",
            (self.tenant_id, 10, 10),
        )
        conn.execute(
            "INSERT INTO fi_analysis_results (tenant_id, analysis_run_id, feedback_id) VALUES (?, ?, ?)",
            (self.tenant_id + 1, 20, 20),
        )
        conn.execute(
            "INSERT INTO analysis_history (tenant_id, source_type) VALUES (?, ?)",
            (self.tenant_id, "manual_batch"),
        )
        conn.execute(
            "INSERT INTO analysis_history (tenant_id, source_type) VALUES (?, ?)",
            (self.tenant_id + 1, "manual_batch"),
        )
        conn.commit()
        conn.close()

        result = database.reset_tenant_connector_data(
            self.tenant_id,
            preserve_active_connectors=True,
        )

        self.assertEqual(result["active_connectors_preserved"], 1)
        self.assertEqual(result["inactive_connectors_deleted"], 1)
        self.assertEqual(result["raw_reviews_deleted"], 1)
        self.assertEqual(result["cxm_reviews_deleted"], 1)
        self.assertEqual(result["fi_feedback_deleted"], 1)

        conn = sqlite3.connect(self.temp_db_path)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_reviews WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_analysis_runs WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_analysis_results WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_fetch_runs WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_customers WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_issues WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM analysis_history WHERE tenant_id = ?", (self.tenant_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (inactive_source_id,)).fetchone()[0], 0)
        active_row = conn.execute(
            "SELECT is_active, last_fetched_at, last_analyzed_at FROM cxm_sources WHERE id = ?",
            (active_source_id,),
        ).fetchone()
        self.assertEqual(active_row[0], 1)
        self.assertIsNone(active_row[1])
        self.assertIsNone(active_row[2])
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE tenant_id = ?", (self.tenant_id + 1,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE tenant_id = ?", (self.tenant_id + 1,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (other_tenant_source_id,)).fetchone()[0], 1)
        conn.close()

    def test_purge_inactive_connectors_removes_legacy_data(self):
        active_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "playstore",
            "com.active.app",
            "Active Source",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )
        inactive_source_id = database.save_user_connector(
            self.user_id,
            self.tenant_id,
            "csv",
            "legacy.csv",
            "Legacy CSV",
            {"_scope": "feedback_crm"},
            fetch_interval="manual",
            analysis_interval="manual",
            connector_scope="feedback_crm",
        )

        conn = sqlite3.connect(self.temp_db_path)
        conn.execute("UPDATE cxm_sources SET is_active = 0 WHERE id = ?", (inactive_source_id,))
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id, None, "csv", "legacy.csv", "legacy-raw", "Legacy raw review"),
        )
        conn.execute(
            "INSERT INTO raw_reviews (user_id, tenant_id, workspace_id, source_type, identifier, external_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (self.user_id, self.tenant_id, None, "playstore", "com.active.app", "active-raw", "Active raw review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (inactive_source_id, self.user_id, self.tenant_id, "legacy-cxm", "Legacy review"),
        )
        conn.execute(
            "INSERT INTO cxm_reviews (source_id, user_id, tenant_id, external_id, content) VALUES (?, ?, ?, ?, ?)",
            (active_source_id, self.user_id, self.tenant_id, "active-cxm", "Active review"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (30, self.tenant_id, "legacy-user"),
        )
        conn.execute(
            "INSERT INTO fi_customers (id, tenant_id, customer_identifier) VALUES (?, ?, ?)",
            (31, self.tenant_id, "active-user"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (30, self.tenant_id, "Legacy issue"),
        )
        conn.execute(
            "INSERT INTO fi_issues (id, tenant_id, name) VALUES (?, ?, ?)",
            (31, self.tenant_id, "Active issue"),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (30, self.tenant_id, "Legacy review", "Legacy CSV", "csv", json.dumps({"cxm_source_id": inactive_source_id}), 30, 30),
        )
        conn.execute(
            "INSERT INTO fi_feedback (id, tenant_id, text, source, source_type, metadata_json, customer_id, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (31, self.tenant_id, "Active review", "Active Source", "playstore", json.dumps({"cxm_source_id": active_source_id}), 31, 31),
        )
        conn.commit()
        conn.close()

        cleanup = database.purge_inactive_connectors(self.tenant_id)

        self.assertEqual(cleanup["inactive_connectors_found"], 1)
        self.assertEqual(cleanup["inactive_connectors_deleted"], 1)
        self.assertEqual(cleanup["fi_feedback_deleted"], 1)
        self.assertEqual(cleanup["cxm_reviews_deleted"], 1)
        self.assertEqual(cleanup["raw_reviews_deleted"], 1)

        conn = sqlite3.connect(self.temp_db_path)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (inactive_source_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_sources WHERE id = ?", (active_source_id,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE source_type = 'csv' AND identifier = 'legacy.csv'").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM raw_reviews WHERE source_type = 'playstore' AND identifier = 'com.active.app'").fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_reviews WHERE source_id = ?", (inactive_source_id,)).fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cxm_reviews WHERE source_id = ?", (active_source_id,)).fetchone()[0], 1)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 30").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM fi_feedback WHERE id = 31").fetchone()[0], 1)
        conn.close()


if __name__ == "__main__":
    unittest.main()
