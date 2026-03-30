CREATE TABLE IF NOT EXISTS decision_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER,
    analysis_id INTEGER,
    decision_type TEXT NOT NULL,
    decision_value TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id INTEGER NOT NULL,
    evidence_text TEXT NOT NULL,
    evidence_type TEXT,
    weight REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decision_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decision_review ON decision_nodes(review_id);
CREATE INDEX IF NOT EXISTS idx_evidence_decision ON evidence_nodes(decision_id);
