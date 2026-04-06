import json
import os
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ["ALLOWED_ORIGINS"] = '["http://localhost:5173"]'

import processor  # noqa: E402


class ReviewBatchingTests(unittest.TestCase):
    def _payload(self, request_id: str, review_id: str, content: str, rating: int = 4):
        return {
            "request_id": request_id,
            "analysis_mode": "workspace",
            "vertical": "saas",
            "focus_keywords": "cancel, renewal, price, feature set, performance, support response time, technical bugs",
            "custom_instructions": "",
            "rating": rating,
            "content": content,
            "review_id": review_id,
            "record_context": {
                "source": "unit-test",
                "source_type": "unit-test",
                "author": "tester",
                "customer_identifier": "",
            },
        }

    def _submit_in_parallel(self, batcher, payloads):
        results = {}
        errors = []
        threads = []

        def _runner(payload):
            try:
                results[payload["request_id"]] = batcher.submit(payload)
            except Exception as exc:  # pragma: no cover - test helper guard
                errors.append(exc)

        for payload in payloads:
            thread = threading.Thread(target=_runner, args=(payload,))
            thread.start()
            threads.append(thread)

        for thread in threads:
            thread.join(timeout=5)

        self.assertFalse(errors, f"Unexpected thread errors: {errors}")
        self.assertTrue(all(not thread.is_alive() for thread in threads), "Batch submit threads did not complete")
        return results

    def test_batcher_routes_results_by_request_id(self):
        batcher = processor.ReviewAnalysisBatcher(max_items=2, max_wait_ms=25)
        payload_a = self._payload("req-a", "rev-a", "App crashes during onboarding", rating=1)
        payload_b = self._payload("req-b", "rev-b", "Love the reporting dashboard", rating=5)

        response_text = json.dumps(
            {
                "results": [
                    {"request_id": "req-b", "review_id": "rev-b", "sentiment": "positive"},
                    {"request_id": "req-a", "review_id": "rev-a", "sentiment": "negative"},
                ]
            }
        )

        with patch(
            "processor.llm_gateway.request_completion",
            return_value={"ok": True, "text": response_text, "tokens": 120},
        ):
            results = self._submit_in_parallel(batcher, [payload_a, payload_b])

        self.assertTrue(results["req-a"]["ok"])
        self.assertTrue(results["req-b"]["ok"])
        self.assertEqual(results["req-a"]["parsed"]["sentiment"], "negative")
        self.assertEqual(results["req-b"]["parsed"]["sentiment"], "positive")
        self.assertEqual(results["req-a"]["tokens"] + results["req-b"]["tokens"], 120)

    def test_parse_llm_json_payload_recovers_malformed_object(self):
        raw_response = """
```json
Result: {"review_id":"rev-a","sentiment":"negative",issue":"Login broken","feature_request":,"confidence":0.88,"emotions":[],"churn_risk":"high",}
```
"""

        parsed = processor.parse_llm_json_payload(raw_response)

        self.assertIsInstance(parsed, dict)
        self.assertEqual(parsed["review_id"], "rev-a")
        self.assertEqual(parsed["sentiment"], "negative")
        self.assertEqual(parsed["issue"], "Login broken")
        self.assertEqual(parsed["feature_request"], "None")

    def test_parse_llm_batch_json_accepts_request_id_keyed_map(self):
        response_text = json.dumps(
            {
                "results": {
                    "req-a": {"review_id": "rev-a", "sentiment": "negative"},
                    "req-b": {"review_id": "rev-b", "sentiment": "positive"},
                }
            }
        )

        parsed = processor.parse_llm_batch_json(response_text)

        self.assertEqual(parsed["req-a"]["request_id"], "req-a")
        self.assertEqual(parsed["req-a"]["review_id"], "rev-a")
        self.assertEqual(parsed["req-b"]["sentiment"], "positive")

    def test_request_review_analysis_retries_without_json_mode(self):
        payload = self._payload("req-a", "rev-a", "Billing page is confusing", rating=2)
        response_formats = []

        def fake_request_completion(*args, **kwargs):
            response_formats.append(kwargs.get("response_format"))
            if len(response_formats) == 1:
                return {"ok": False, "text": "", "tokens": 0, "error": "LLM returned an empty response."}
            return {
                "ok": True,
                "text": '```json\n{"review_id":"rev-a","sentiment":"negative","churn_risk":"medium"}\n```',
                "tokens": 42,
            }

        with patch("processor.llm_gateway.request_completion", side_effect=fake_request_completion):
            result = processor.request_review_analysis(payload)

        self.assertTrue(result["ok"])
        self.assertEqual(response_formats, ["json", None])
        self.assertTrue(result["format_fallback_used"])
        self.assertEqual(result["response_format"], "plain")

    def test_request_review_analysis_uses_resolved_analysis_timeout(self):
        payload = self._payload("req-a", "rev-a", "Billing page is confusing", rating=2)
        captured = {}

        def fake_request_completion(*args, **kwargs):
            captured["timeout_seconds"] = kwargs.get("timeout_seconds")
            return {
                "ok": True,
                "text": '{"review_id":"rev-a","sentiment":"negative","churn_risk":"medium"}',
                "tokens": 42,
            }

        with patch("processor.llm_gateway.request_completion", side_effect=fake_request_completion):
            result = processor.request_review_analysis(payload)

        self.assertTrue(result["ok"])
        self.assertEqual(captured["timeout_seconds"], processor.ANALYSIS_LLM_TIMEOUT_SECONDS)

    def test_remote_analysis_timeout_uses_request_budget_without_legacy_cap(self):
        resolved = processor._resolve_analysis_llm_timeout_seconds(None, 300, False)

        self.assertEqual(resolved, 300)

    def test_local_analysis_timeout_stays_bounded_by_request_timeout(self):
        resolved = processor._resolve_analysis_llm_timeout_seconds(600, 300, True)

        self.assertEqual(resolved, 300)

    def test_gateway_remote_timeout_cap_supports_five_minute_requests(self):
        with patch.object(processor.llm_gateway, "_remote_timeout_cap_seconds", 300):
            effective_timeout = processor.llm_gateway._effective_request_timeout("https://ai.hyzync.com", 600)

        self.assertEqual(effective_timeout, (12, 300))

    def test_batcher_converts_malformed_json_into_item_errors(self):
        batcher = processor.ReviewAnalysisBatcher(max_items=2, max_wait_ms=25)
        payload_a = self._payload("req-a", "rev-a", "Cancel my plan please", rating=1)
        payload_b = self._payload("req-b", "rev-b", "Billing page is confusing", rating=2)

        with patch(
            "processor.llm_gateway.request_completion",
            return_value={"ok": True, "text": "not valid json", "tokens": 0},
        ):
            results = self._submit_in_parallel(batcher, [payload_a, payload_b])

        self.assertFalse(results["req-a"]["ok"])
        self.assertFalse(results["req-b"]["ok"])
        self.assertEqual(results["req-a"]["fallback_reason"], "llm_batch_parse_error")
        self.assertEqual(results["req-b"]["fallback_reason"], "llm_batch_parse_error")

    def test_dedup_registry_isolated_per_batch(self):
        base_options = {
            "token_efficiency": True,
            "magic_clean": False,
            "language_focus": False,
            "html_shield": True,
        }
        registry_a = processor.create_dedup_registry()
        registry_b = processor.create_dedup_registry()

        first = processor.advanced_clean_review(
            "Crash on launch after update",
            rating=1,
            options={**base_options, "dedup_registry": registry_a},
        )
        second_same_batch = processor.advanced_clean_review(
            "Crash on launch after update",
            rating=1,
            options={**base_options, "dedup_registry": registry_a},
        )
        first_other_batch = processor.advanced_clean_review(
            "Crash on launch after update",
            rating=1,
            options={**base_options, "dedup_registry": registry_b},
        )

        self.assertFalse(first["was_duplicate"])
        self.assertTrue(second_same_batch["was_duplicate"])
        self.assertFalse(first_other_batch["was_duplicate"])

    def test_analyze_single_review_task_falls_back_when_batched_item_is_invalid(self):
        review = {
            "review_id": "rev-1",
            "id": "rev-1",
            "content": "The app keeps logging me out during setup.",
            "score": 1,
            "source": "unit-test",
        }

        with patch(
            "processor.request_review_analysis",
            return_value={
                "ok": False,
                "error": "Batch response omitted request_id=req-1.",
                "fallback_reason": "llm_batch_missing_item",
                "batched": True,
                "batch_size": 3,
            },
        ):
            result = processor.analyze_single_review_task(review, "saas")

        self.assertTrue(result["_meta_fallback"])
        self.assertEqual(result["_meta_reason"], "llm_batch_missing_item")
        self.assertTrue(result["_meta_batched"])
        self.assertEqual(result["_meta_batch_size"], 3)


if __name__ == "__main__":
    unittest.main()
