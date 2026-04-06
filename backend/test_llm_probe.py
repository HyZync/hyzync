"""Diagnose why reviews are falling back to rule-based analysis."""
import time
import threading
import json
import logging

logging.basicConfig(level=logging.WARNING)

# Force disable batching for this test
import processor
processor.LLM_BATCHING_ENABLED = False

from processor import (
    analyze_single_review_task,
    _should_use_review_batching,
    ANALYSIS_LLM_TIMEOUT_SECONDS,
)

print(f"Batching: {_should_use_review_batching()}")
print(f"Timeout: {ANALYSIS_LLM_TIMEOUT_SECONDS}s")

# Simulate typical reviews
test_reviews = [
    {"id": "R1", "content": "Great app, love the design and features!", "score": 5, "source": "test"},
    {"id": "R2", "content": "App crashes every time I open settings. Very frustrating!", "score": 1, "source": "test"},
    {"id": "R3", "content": "Decent product but too expensive for what it offers.", "score": 3, "source": "test"},
    {"id": "R4", "content": "The customer support team was very helpful and responsive.", "score": 4, "source": "test"},
    {"id": "R5", "content": "Terrible experience. App froze and I lost all my data.", "score": 1, "source": "test"},
]

results = [None] * len(test_reviews)
start = time.time()

def worker(idx, review):
    t0 = time.time()
    r = analyze_single_review_task(review, "generic", None, None, None, None, "workspace")
    elapsed = time.time() - t0
    results[idx] = r
    if r:
        fb = r.get('_meta_fallback')
        reason = r.get('_meta_reason', 'N/A')
        err = r.get('_meta_error')
        tokens = r.get('_meta_tokens', 0)
        sentiment = r.get('sentiment', '?')
        print(f"[{review['id']}] {elapsed:.1f}s | sentiment={sentiment} | fallback={fb} | error={err} | reason={reason} | tokens={tokens}")
    else:
        print(f"[{review['id']}] {elapsed:.1f}s | NO RESULT")

threads = []
for i, rev in enumerate(test_reviews):
    t = threading.Thread(target=worker, args=(i, rev))
    threads.append(t)
    t.start()
    time.sleep(1.0)  # slightly staggered

for t in threads:
    t.join(timeout=180)

elapsed = time.time() - start
print(f"\nTotal: {elapsed:.1f}s")
