import os
import sys
import unittest
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ["ALLOWED_ORIGINS"] = '["http://localhost:5173"]'

import processor  # noqa: E402


class AnalysisResilienceTests(unittest.TestCase):
    def _reviews(self, count: int):
        rows = []
        for i in range(count):
            rows.append(
                {
                    "review_id": f"REV-{i}",
                    "id": f"REV-{i}",
                    "content": f"Sample review text {i}",
                    "score": 4 if i % 2 == 0 else 2,
                    "source": "unit-test",
                }
            )
        return rows

    def test_no_dropped_reviews_when_worker_returns_none(self):
        reviews = self._reviews(12)
        captured = {}

        def progress_cb(_pct, msg, meta=None):
            if meta and meta.get("analysis_summary"):
                captured["meta"] = meta
                captured["summary"] = msg

        def fake_worker(review_data, *_args, **_kwargs):
            idx = int(str(review_data.get("review_id", "REV-0")).split("-")[-1])
            if idx % 2 == 1:
                return None
            return {
                **review_data,
                **processor.DEFAULT_VALUES,
                "_meta_tokens": 4,
                "_meta_error": False,
                "_meta_fallback": False,
            }

        with patch("processor.analyze_single_review_task", side_effect=fake_worker):
            results = processor.run_analysis_batch(
                reviews_list=reviews,
                vertical="saas",
                progress_callback=progress_cb,
            )

        self.assertEqual(len(results), len(reviews))
        self.assertTrue(all(r is not None for r in results))
        meta = captured.get("meta")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.get("fetched_reviews"), len(reviews))
        self.assertEqual(meta.get("analyzed_reviews"), len(reviews))
        self.assertEqual(meta.get("dropped_reviews"), 0)
        self.assertAlmostEqual(float(meta.get("coverage_pct", 0.0)), 100.0, places=2)

    def test_failed_rows_are_recovered_without_drops(self):
        reviews = self._reviews(10)
        captured = {}

        def progress_cb(_pct, msg, meta=None):
            if meta and meta.get("analysis_summary"):
                captured["meta"] = meta
                captured["summary"] = msg

        def fake_worker(review_data, *_args, **_kwargs):
            idx = int(str(review_data.get("review_id", "REV-0")).split("-")[-1])
            if idx in {3, 7}:
                raise RuntimeError("synthetic worker failure")
            return {
                **review_data,
                **processor.DEFAULT_VALUES,
                "_meta_tokens": 6,
                "_meta_error": False,
                "_meta_fallback": False,
            }

        with patch("processor.analyze_single_review_task", side_effect=fake_worker):
            results = processor.run_analysis_batch(
                reviews_list=reviews,
                vertical="saas",
                progress_callback=progress_cb,
            )

        self.assertEqual(len(results), len(reviews))
        self.assertTrue(all(r is not None for r in results))
        self.assertTrue(any(r.get("_meta_error") for r in results))
        meta = captured.get("meta")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.get("fetched_reviews"), len(reviews))
        self.assertEqual(meta.get("analyzed_reviews"), len(reviews))
        self.assertEqual(meta.get("dropped_reviews"), 0)
        self.assertGreaterEqual(int(meta.get("unresolved_reviews", 0)), 1)
        self.assertAlmostEqual(float(meta.get("coverage_pct", 0.0)), 100.0, places=2)


if __name__ == "__main__":
    unittest.main()
