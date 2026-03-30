from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email import message_from_string
from email.policy import default as email_default_policy
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ai_tools.base import generate_json_response
from database import get_db_connection

logger = logging.getLogger("hyzync.fi_platform")

CLASS_LABELS = {"bug", "feature_request", "ux_issue", "pricing", "other"}
ACTION_STATUSES = {"open", "in_progress", "resolved"}
SEVERITY_WORDS = {"crash": 8.0, "refund": 7.0, "outage": 8.5, "security": 8.0, "payment failed": 7.0}


@dataclass
class NormalizedFeedback:
    source: str
    external_id: str
    message: str
    user_external_id: str
    user_type: str
    timestamp: str
    metadata: Dict[str, Any]
    email: Optional[str] = None
    plan: Optional[str] = None
    mrr: float = 0.0
    company_name: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _safe_json(v: Any) -> str:
    try:
        return json.dumps(v, ensure_ascii=True, separators=(",", ":"))
    except Exception:
        return "{}"


def _float(v: Any, d: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return d


def _user_type(v: Any) -> str:
    s = str(v or "").strip().lower()
    if s in {"enterprise", "ent", "business"}:
        return "enterprise"
    if s in {"paid", "pro", "premium"}:
        return "paid"
    return "free"


def _message(d: Dict[str, Any]) -> str:
    for k in ("message", "text", "body", "content", "comment", "feedback"):
        if d.get(k):
            return str(d[k]).strip()
    return ""


def _external_id(d: Dict[str, Any], seed: str) -> str:
    for k in ("external_id", "id", "message_id", "reviewId", "ticket_id", "ts"):
        if d.get(k):
            return str(d[k])
    return "gen_" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:20]


class IntegrationAdapter:
    name = "base"

    def auth(self, config: Dict[str, Any]) -> Dict[str, Any]:
        return {"ok": True}

    def fetch_data(self, config: Dict[str, Any], *, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def normalize(self, payload: Any) -> List[NormalizedFeedback]:
        raise NotImplementedError


class APIAdapter(IntegrationAdapter):
    name = "api"

    def fetch_data(self, config: Dict[str, Any], **_: Any) -> List[Dict[str, Any]]:
        return []

    def normalize(self, payload: Any) -> List[NormalizedFeedback]:
        rows = payload if isinstance(payload, list) else [payload]
        out: List[NormalizedFeedback] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            msg = _message(row)
            if not msg:
                continue
            ts = str(row.get("timestamp") or row.get("created_at") or row.get("ts") or _now_iso())
            src = str(row.get("source") or "api").strip().lower() or "api"
            uid = str(row.get("user_id") or row.get("customer_id") or row.get("email") or "anonymous")
            out.append(
                NormalizedFeedback(
                    source=src,
                    external_id=_external_id(row, f"{src}:{uid}:{ts}:{msg}"),
                    message=msg,
                    user_external_id=uid,
                    user_type=_user_type(row.get("user_type") or row.get("plan")),
                    timestamp=ts,
                    metadata=row,
                    email=(str(row.get("email")).strip() if row.get("email") else None),
                    plan=(str(row.get("plan")).strip() if row.get("plan") else None),
                    mrr=_float(row.get("mrr"), 0.0),
                    company_name=(str(row.get("company")).strip() if row.get("company") else None),
                )
            )
        return out


class ZendeskAdapter(APIAdapter):
    name = "zendesk"

    def normalize(self, payload: Any) -> List[NormalizedFeedback]:
        if not isinstance(payload, dict):
            return []
        comment = payload.get("comment") if isinstance(payload.get("comment"), dict) else payload
        txt = str(comment.get("body") or comment.get("text") or "").strip()
        if not txt:
            return []
        row = {
            "source": "zendesk",
            "external_id": payload.get("ticket_id") or payload.get("id"),
            "message": txt,
            "user_id": payload.get("requester_id") or payload.get("author_id") or payload.get("email"),
            "email": payload.get("email"),
            "mrr": payload.get("mrr"),
            "plan": payload.get("plan"),
            "timestamp": comment.get("created_at") or payload.get("created_at") or _now_iso(),
            "metadata": payload,
        }
        return APIAdapter().normalize(row)

class PlayStoreAdapter(APIAdapter):
    name = "playstore"

    def fetch_data(self, config: Dict[str, Any], *, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        from playstore_connector import fetch_raw_playstore_reviews

        app_id = str(config.get("identifier") or config.get("app_id") or "").strip()
        if not app_id:
            raise ValueError("playstore requires app_id")
        country = str(config.get("country") or "us").strip() or "us"
        count = max(1, min(int(config.get("count") or limit), 1000))
        df = fetch_raw_playstore_reviews(app_id, country, count)
        return df.to_dict("records") if hasattr(df, "to_dict") else list(df or [])


class AppStoreAdapter(APIAdapter):
    name = "appstore"

    def fetch_data(self, config: Dict[str, Any], *, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        from appstore_connector import fetch_appstore_reviews

        app_id = str(config.get("identifier") or config.get("app_id") or "").strip()
        if not app_id:
            raise ValueError("appstore requires app_id")
        country = str(config.get("country") or "us").strip() or "us"
        pages = max(1, min(int(config.get("pages") or math.ceil(limit / 50)), 20))
        df = fetch_appstore_reviews(app_id, country, pages)
        return df.to_dict("records") if hasattr(df, "to_dict") else list(df or [])


ADAPTERS: Dict[str, IntegrationAdapter] = {
    "api": APIAdapter(),
    "webhook": APIAdapter(),
    "zendesk": ZendeskAdapter(),
    "playstore": PlayStoreAdapter(),
    "appstore": AppStoreAdapter(),
}


def list_integrations() -> Dict[str, Any]:
    return {
        "native": sorted(ADAPTERS.keys()),
        "future_ready": ["hubspot", "salesforce", "custom_api"],
        "contract": ["auth", "fetch_data", "normalize"],
    }


def init_platform_tables() -> None:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_companies (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, name TEXT NOT NULL, plan TEXT DEFAULT 'starter', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id, name))")
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_users (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, external_user_id TEXT NOT NULL, email TEXT, plan TEXT DEFAULT 'free', mrr REAL DEFAULT 0.0, company_id INTEGER, user_type TEXT DEFAULT 'free', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id, external_user_id), FOREIGN KEY (company_id) REFERENCES fi_v2_companies(id) ON DELETE SET NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_clusters (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, label TEXT DEFAULT 'other', title TEXT DEFAULT '', summary TEXT DEFAULT '', centroid_json TEXT, feedback_count INTEGER DEFAULT 0, negative_ratio REAL DEFAULT 0.0, impact_score REAL DEFAULT 0.0, status TEXT DEFAULT 'open', assigned_to TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, source TEXT NOT NULL, external_id TEXT NOT NULL, message TEXT NOT NULL, user_dim_id INTEGER, user_external_id TEXT NOT NULL, user_type TEXT DEFAULT 'free', feedback_ts TIMESTAMP NOT NULL, metadata_json TEXT, label TEXT, sentiment TEXT, emotion TEXT, embedding_json TEXT, cluster_id INTEGER, impact_score REAL DEFAULT 0.0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id, source, external_id), FOREIGN KEY (cluster_id) REFERENCES fi_v2_clusters(id) ON DELETE SET NULL, FOREIGN KEY (user_dim_id) REFERENCES fi_v2_users(id) ON DELETE SET NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, alert_type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, payload_json TEXT, acknowledged INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    c.execute("CREATE TABLE IF NOT EXISTS fi_v2_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, cluster_id INTEGER, channel TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT DEFAULT 'queued', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_fi_v2_feedback_tenant_ts ON fi_v2_feedback(tenant_id, feedback_ts DESC)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_fi_v2_feedback_cluster ON fi_v2_feedback(cluster_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_fi_v2_clusters_tenant_impact ON fi_v2_clusters(tenant_id, impact_score DESC)")
    conn.commit()
    conn.close()


def _upsert_company_user(c: Any, tenant_id: int, item: NormalizedFeedback) -> Optional[int]:
    company_id = None
    if item.company_name:
        c.execute("SELECT id FROM fi_v2_companies WHERE tenant_id=? AND name=?", (tenant_id, item.company_name))
        row = c.fetchone()
        if row:
            company_id = int(row["id"])
        else:
            c.execute("INSERT INTO fi_v2_companies (tenant_id, name, plan) VALUES (?, ?, ?)", (tenant_id, item.company_name, item.plan or "starter"))
            company_id = int(c.lastrowid)

    c.execute("SELECT id FROM fi_v2_users WHERE tenant_id=? AND external_user_id=?", (tenant_id, item.user_external_id))
    user = c.fetchone()
    if user:
        uid = int(user["id"])
        c.execute("UPDATE fi_v2_users SET email=COALESCE(?,email), plan=COALESCE(?,plan), mrr=CASE WHEN ?>0 THEN ? ELSE mrr END, company_id=COALESCE(?,company_id), user_type=COALESCE(?,user_type), updated_at=CURRENT_TIMESTAMP WHERE id=?", (item.email, item.plan, item.mrr, item.mrr, company_id, item.user_type, uid))
        return uid
    c.execute("INSERT INTO fi_v2_users (tenant_id, external_user_id, email, plan, mrr, company_id, user_type) VALUES (?, ?, ?, ?, ?, ?, ?)", (tenant_id, item.user_external_id, item.email, item.plan or "free", item.mrr, company_id, item.user_type))
    return int(c.lastrowid)


def _classify(text: str) -> str:
    prompt = 'Classify feedback into one label: bug, feature_request, ux_issue, pricing, other. Return JSON {"label":"..."} only. Feedback: ' + text[:700]
    try:
        r = generate_json_response(prompt, max_retries=1)
        label = str(r.get("label") or "").strip().lower()
        if label in CLASS_LABELS:
            return label
    except Exception:
        pass
    low = text.lower()
    if any(k in low for k in ("bug", "crash", "error", "broken")):
        return "bug"
    if any(k in low for k in ("feature", "please add", "request")):
        return "feature_request"
    if any(k in low for k in ("ux", "ui", "confusing", "hard to use")):
        return "ux_issue"
    if any(k in low for k in ("price", "pricing", "expensive", "billing")):
        return "pricing"
    return "other"


def _sentiment_emotion(text: str) -> Tuple[str, str]:
    low = text.lower()
    neg = sum(1 for w in ("bad", "broken", "crash", "hate", "issue", "bug", "refund", "error") if w in low)
    pos = sum(1 for w in ("great", "love", "excellent", "good", "happy", "smooth") if w in low)
    sentiment = "negative" if neg > pos else ("positive" if pos > neg else "neutral")
    emotion = "frustration" if any(w in low for w in ("angry", "frustrated", "annoying", "hate")) else ("satisfaction" if sentiment == "positive" else "confusion")
    return sentiment, emotion


def _embedding(text: str, dims: int = 64) -> List[float]:
    vec = [0.0] * dims
    for token in re.findall(r"[a-z0-9_]+", text.lower()):
        h = int(hashlib.sha1(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dims
        vec[idx] += 1.0 if ((h >> 8) & 1) else -1.0
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm > 0 else vec


def _vec(raw: Any) -> List[float]:
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        try:
            p = json.loads(raw)
            if isinstance(p, list):
                return [float(x) for x in p]
        except Exception:
            return []
    return []


def _cos(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def ingest_from_integration(tenant_id: int, integration: str, *, payload: Optional[Any] = None, config: Optional[Dict[str, Any]] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 200, run_pipeline: bool = True) -> Dict[str, Any]:
    key = (integration or "").strip().lower()
    if key not in ADAPTERS:
        raise ValueError(f"Unsupported integration '{integration}'")
    adapter = ADAPTERS[key]
    config = config or {}
    raw = payload if payload is not None else adapter.fetch_data(config, start_date=start_date, end_date=end_date, limit=limit)
    items = adapter.normalize(raw)

    conn = get_db_connection()
    c = conn.cursor()
    inserted_ids: List[int] = []
    skipped = 0
    for item in items:
        uid = _upsert_company_user(c, tenant_id, item)
        c.execute("INSERT OR IGNORE INTO fi_v2_feedback (tenant_id, source, external_id, message, user_dim_id, user_external_id, user_type, feedback_ts, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (tenant_id, item.source, item.external_id, item.message, uid, item.user_external_id, item.user_type, item.timestamp, _safe_json(item.metadata)))
        if c.rowcount <= 0:
            skipped += 1
        else:
            inserted_ids.append(int(c.lastrowid))
    conn.commit()
    conn.close()

    processing = process_pending_feedback(tenant_id, inserted_ids) if (run_pipeline and inserted_ids) else {"processed": 0}
    return {"integration": key, "fetched": len(items), "inserted": len(inserted_ids), "skipped": skipped, "processing": processing}


def process_pending_feedback(tenant_id: int, feedback_ids: Optional[Sequence[int]] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    if feedback_ids:
        placeholders = ",".join("?" for _ in feedback_ids)
        c.execute(f"SELECT * FROM fi_v2_feedback WHERE tenant_id=? AND id IN ({placeholders})", [tenant_id] + [int(x) for x in feedback_ids])
    else:
        c.execute("SELECT * FROM fi_v2_feedback WHERE tenant_id=? AND (label IS NULL OR sentiment IS NULL OR embedding_json IS NULL OR cluster_id IS NULL) ORDER BY id ASC LIMIT 500", (tenant_id,))
    rows = [dict(r) for r in c.fetchall()]
    if not rows:
        conn.close()
        return {"processed": 0, "clustered": 0, "alerts_triggered": 0}

    for row in rows:
        label = _classify(str(row.get("message") or ""))
        sentiment, emotion = _sentiment_emotion(str(row.get("message") or ""))
        emb = _embedding(str(row.get("message") or ""))
        c.execute("UPDATE fi_v2_feedback SET label=?, sentiment=?, emotion=?, embedding_json=? WHERE id=? AND tenant_id=?", (label, sentiment, emotion, _safe_json(emb), int(row["id"]), tenant_id))

    c.execute("SELECT id, label, centroid_json, feedback_count FROM fi_v2_clusters WHERE tenant_id=?", (tenant_id,))
    clusters = [dict(r) for r in c.fetchall()]
    clustered = 0
    for row in rows:
        fid = int(row["id"])
        c.execute("SELECT embedding_json, label FROM fi_v2_feedback WHERE id=? AND tenant_id=?", (fid, tenant_id))
        frow = c.fetchone()
        if not frow:
            continue
        vec = _vec(frow["embedding_json"])
        if not vec:
            continue
        label = str(frow["label"] or "other")
        best, best_score = None, -1.0
        for cl in clusters:
            cvec = _vec(cl.get("centroid_json"))
            if not cvec:
                continue
            score = _cos(vec, cvec) + (0.02 if str(cl.get("label") or "other") == label else 0.0)
            if score > best_score:
                best, best_score = cl, score
        if not best or best_score < 0.82:
            c.execute("INSERT INTO fi_v2_clusters (tenant_id, label, title, summary, centroid_json) VALUES (?, ?, ?, ?, ?)", (tenant_id, label, f"{label.replace('_', ' ').title()} cluster", "Pending summary", _safe_json(vec)))
            cid = int(c.lastrowid)
            clusters.append({"id": cid, "label": label, "centroid_json": _safe_json(vec), "feedback_count": 1})
        else:
            cid = int(best["id"])
        c.execute("UPDATE fi_v2_feedback SET cluster_id=? WHERE id=? AND tenant_id=?", (cid, fid, tenant_id))
        clustered += 1

    c.execute("SELECT id FROM fi_v2_clusters WHERE tenant_id=?", (tenant_id,))
    for crow in c.fetchall():
        cid = int(crow["id"])
        c.execute("SELECT message, sentiment FROM fi_v2_feedback WHERE tenant_id=? AND cluster_id=?", (tenant_id, cid))
        feedback = [dict(r) for r in c.fetchall()]
        count = len(feedback)
        if count == 0:
            continue
        neg = sum(1 for r in feedback if str(r.get("sentiment") or "") == "negative")
        neg_ratio = neg / count
        score = (1.6 * count) + (32.0 * neg_ratio) + sum(v for k, v in SEVERITY_WORDS.items() if any(k in str(r.get("message") or "").lower() for r in feedback))
        msgs = [str(r.get("message") or "") for r in feedback[:10]]
        prompt = 'Summarize this feedback cluster. Return JSON {"title":"<=8 words","summary":"one line"}.' + "\n".join(f"- {m[:180]}" for m in msgs)
        title, summary = f"Cluster {cid}", "No summary."
        try:
            res = generate_json_response(prompt, max_retries=1)
            if res.get("title"):
                title = str(res.get("title"))[:120]
            if res.get("summary"):
                summary = str(res.get("summary"))[:240]
        except Exception:
            if msgs:
                summary = msgs[0][:220]
        c.execute("UPDATE fi_v2_clusters SET title=?, summary=?, feedback_count=?, negative_ratio=?, impact_score=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?", (title, summary, count, round(neg_ratio, 4), round(score, 2), cid, tenant_id))
        c.execute("UPDATE fi_v2_feedback SET impact_score=? WHERE tenant_id=? AND cluster_id=?", (round(score, 2), tenant_id, cid))

    conn.commit()
    conn.close()
    alerts = run_alert_rules(tenant_id)
    return {"processed": len(rows), "clustered": clustered, "alerts_triggered": len(alerts)}


def run_alert_rules(tenant_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc)
    last_24h = (now - timedelta(hours=24)).isoformat()
    last_8d = (now - timedelta(days=8)).isoformat()
    prev_7d = (now - timedelta(days=7)).isoformat()
    c.execute("SELECT feedback_ts, sentiment FROM fi_v2_feedback WHERE tenant_id=? AND feedback_ts>=?", (tenant_id, last_8d))
    rows = [dict(r) for r in c.fetchall()]
    current = [r for r in rows if str(r.get("feedback_ts") or "") >= last_24h]
    previous = [r for r in rows if prev_7d <= str(r.get("feedback_ts") or "") < last_24h]
    curr_count = len(current)
    prev_avg = len(previous) / 7.0 if previous else 0.0
    curr_neg_ratio = (sum(1 for r in current if r.get("sentiment") == "negative") / curr_count) if curr_count else 0.0
    prev_neg_ratio = (sum(1 for r in previous if r.get("sentiment") == "negative") / len(previous)) if previous else 0.0
    c.execute("SELECT COUNT(DISTINCT f.user_dim_id) AS cnt FROM fi_v2_feedback f JOIN fi_v2_users u ON u.id=f.user_dim_id WHERE f.tenant_id=? AND f.feedback_ts>=? AND f.sentiment='negative' AND COALESCE(u.mrr,0)>=500", (tenant_id, last_24h))
    high_mrr = int((c.fetchone()["cnt"] or 0))
    out: List[Dict[str, Any]] = []

    def emit(alert_type: str, severity: str, message: str, payload: Dict[str, Any]) -> None:
        since_12h = (now - timedelta(hours=12)).isoformat()
        c.execute("SELECT id FROM fi_v2_alerts WHERE tenant_id=? AND alert_type=? AND created_at>=? ORDER BY id DESC LIMIT 1", (tenant_id, alert_type, since_12h))
        if c.fetchone():
            return
        c.execute("INSERT INTO fi_v2_alerts (tenant_id, alert_type, severity, message, payload_json) VALUES (?, ?, ?, ?, ?)", (tenant_id, alert_type, severity, message, _safe_json(payload)))
        out.append({"id": int(c.lastrowid), "alert_type": alert_type, "severity": severity, "message": message, "payload": payload})

    if curr_count >= 10 and curr_count > max(12, int(prev_avg * 1.8)):
        emit("feedback_volume_spike", "high", f"Feedback volume spiked to {curr_count} in the last 24h.", {"current_24h": curr_count, "prev_avg_daily": round(prev_avg, 2)})
    if curr_count >= 8 and curr_neg_ratio >= 0.45 and (curr_neg_ratio - prev_neg_ratio) >= 0.2:
        emit("negative_sentiment_increase", "high", "Negative sentiment increased in the last 24h.", {"current_negative_ratio": round(curr_neg_ratio, 4), "previous_negative_ratio": round(prev_neg_ratio, 4)})
    if high_mrr >= 1:
        emit("high_mrr_users_affected", "critical", f"{high_mrr} high-MRR users submitted negative feedback in the last 24h.", {"affected_users": high_mrr, "mrr_threshold": 500})
    conn.commit()
    conn.close()
    return out


def list_alerts(tenant_id: int, *, limit: int = 50) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM fi_v2_alerts WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?", (tenant_id, max(1, min(limit, 200))))
    items = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"items": items, "total": len(items)}


def list_action_items(tenant_id: int, *, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    where, params = ["tenant_id = ?"], [tenant_id]
    if status:
        where.append("status = ?")
        params.append(status)
    clause = " AND ".join(where)
    c.execute(f"SELECT COUNT(*) AS cnt FROM fi_v2_clusters WHERE {clause}", params)
    total = int((c.fetchone()["cnt"] or 0))
    c.execute(f"SELECT * FROM fi_v2_clusters WHERE {clause} ORDER BY impact_score DESC, feedback_count DESC LIMIT ? OFFSET ?", params + [max(1, min(limit, 200)), max(0, offset)])
    rows = [dict(r) for r in c.fetchall()]
    items: List[Dict[str, Any]] = []
    for row in rows:
        cid = int(row["id"])
        c.execute("SELECT id FROM fi_v2_feedback WHERE tenant_id=? AND cluster_id=? ORDER BY feedback_ts DESC LIMIT 200", (tenant_id, cid))
        ids = [int(x["id"]) for x in c.fetchall()]
        items.append({"id": cid, "title": row.get("title") or f"Cluster {cid}", "summary": row.get("summary") or "", "impact_score": float(row.get("impact_score") or 0.0), "status": row.get("status") or "open", "assigned_to": row.get("assigned_to"), "related_feedback_ids": ids, "feedback_count": int(row.get("feedback_count") or 0), "negative_ratio": float(row.get("negative_ratio") or 0.0), "label": row.get("label") or "other"})
    conn.close()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def update_action_item(tenant_id: int, action_id: int, *, status: Optional[str] = None, assigned_to: Optional[str] = None) -> bool:
    updates, params = [], []
    if status:
        s = status.strip().lower()
        if s not in ACTION_STATUSES:
            raise ValueError(f"Invalid status '{status}'")
        updates.append("status = ?")
        params.append(s)
    if assigned_to is not None:
        updates.append("assigned_to = ?")
        params.append(assigned_to.strip() or None)
    if not updates:
        return False
    updates.append("updated_at = CURRENT_TIMESTAMP")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(f"UPDATE fi_v2_clusters SET {', '.join(updates)} WHERE id=? AND tenant_id=?", params + [action_id, tenant_id])
    ok = c.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def get_dashboard(tenant_id: int, *, days: int = 14) -> Dict[str, Any]:
    d = max(1, min(days, 90))
    since = (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, label, title, summary, impact_score, status, feedback_count, negative_ratio, assigned_to FROM fi_v2_clusters WHERE tenant_id=? ORDER BY impact_score DESC, feedback_count DESC LIMIT 15", (tenant_id,))
    top_issues = [dict(r) for r in c.fetchall()]
    c.execute("SELECT substr(feedback_ts,1,10) AS day, sentiment, COUNT(*) AS cnt FROM fi_v2_feedback WHERE tenant_id=? AND feedback_ts>=? GROUP BY day, sentiment ORDER BY day ASC", (tenant_id, since))
    trend_rows = [dict(r) for r in c.fetchall()]
    trend: Dict[str, Dict[str, Any]] = {}
    for r in trend_rows:
        day = r["day"]
        if day not in trend:
            trend[day] = {"day": day, "positive": 0, "neutral": 0, "negative": 0, "total": 0}
        s = r["sentiment"] if r["sentiment"] in {"positive", "neutral", "negative"} else "neutral"
        n = int(r["cnt"] or 0)
        trend[day][s] += n
        trend[day]["total"] += n
    sentiment_trend = [trend[k] for k in sorted(trend.keys())]
    c.execute("SELECT id, title, summary, impact_score, feedback_count FROM fi_v2_clusters WHERE tenant_id=? AND label='feature_request' ORDER BY impact_score DESC, feedback_count DESC LIMIT 10", (tenant_id,))
    feature_board = [dict(r) for r in c.fetchall()]
    c.execute("SELECT f.id, f.message, f.feedback_ts, f.source, COALESCE(u.mrr,0) AS mrr, u.email, u.external_user_id FROM fi_v2_feedback f LEFT JOIN fi_v2_users u ON u.id=f.user_dim_id WHERE f.tenant_id=? AND f.sentiment='negative' ORDER BY mrr DESC, f.feedback_ts DESC LIMIT 25", (tenant_id,))
    high_value = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"top_issues_by_impact": top_issues, "sentiment_trend": sentiment_trend, "feature_requests_leaderboard": feature_board, "high_value_user_complaints": high_value, "days": d}


def trigger_loop_closure(tenant_id: int, *, action_id: int, channel: str, message: Optional[str] = None) -> Dict[str, Any]:
    ch = (channel or "").strip().lower()
    if ch not in {"email", "in_app"}:
        raise ValueError("channel must be 'email' or 'in_app'")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, title, summary FROM fi_v2_clusters WHERE tenant_id=? AND id=?", (tenant_id, action_id))
    row = c.fetchone()
    if not row:
        conn.close()
        raise ValueError("action_id not found")
    title = str(row["title"] or f"Issue {action_id}")
    summary = str(row["summary"] or "")
    subject = f"[Feedback Intelligence] Update: {title}"
    body = message or f"We shipped an update related to: {title}. {summary}".strip()
    c.execute("SELECT DISTINCT COALESCE(u.email, f.user_external_id) AS recipient FROM fi_v2_feedback f LEFT JOIN fi_v2_users u ON u.id=f.user_dim_id WHERE f.tenant_id=? AND f.cluster_id=? AND COALESCE(u.email, f.user_external_id) IS NOT NULL ORDER BY f.feedback_ts DESC LIMIT 300", (tenant_id, action_id))
    recipients = [str(r["recipient"]) for r in c.fetchall()]
    for recipient in recipients:
        c.execute("INSERT INTO fi_v2_notifications (tenant_id, cluster_id, channel, recipient, subject, body, status) VALUES (?, ?, ?, ?, ?, ?, 'queued')", (tenant_id, action_id, ch, recipient, subject, body))
    conn.commit()
    conn.close()
    return {"status": "queued", "action_id": action_id, "channel": ch, "notifications_queued": len(recipients)}


def ingest_csv_feedback(tenant_id: int, csv_bytes: bytes, *, source: str = "csv_upload") -> Dict[str, Any]:
    text = csv_bytes.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, Any]] = []
    for row in reader:
        rows.append({"source": source, "external_id": row.get("id") or row.get("external_id"), "message": row.get("message") or row.get("text") or row.get("content"), "user_id": row.get("user_id") or row.get("email") or row.get("author"), "user_type": row.get("user_type") or row.get("plan") or "free", "timestamp": row.get("timestamp") or row.get("created_at") or _now_iso(), "email": row.get("email"), "plan": row.get("plan"), "mrr": _float(row.get("mrr"), 0.0), "company": row.get("company"), "metadata": row})
    return ingest_from_integration(tenant_id, "api", payload=rows, run_pipeline=True)


def ingest_email_feedback(tenant_id: int, raw_email: str, *, source: str = "email") -> Dict[str, Any]:
    msg = message_from_string(raw_email, policy=email_default_policy)
    sender = msg.get("From", "")
    subject = msg.get("Subject", "")
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_content()
                if body:
                    break
    else:
        body = msg.get_content()
    payload = {"source": source, "message": f"{subject}\n{(body or '').strip()}".strip(), "user_id": sender, "email": sender, "timestamp": _now_iso(), "metadata": {"subject": subject, "from": sender}}
    return ingest_from_integration(tenant_id, "api", payload=payload, run_pipeline=True)
