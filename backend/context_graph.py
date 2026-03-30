"""
Context Graph Module for LLM Decision Provenance
Automatically extracts evidence from review text based on LLM decisions.
NO PROMPT CHANGES - works with existing JSON schema.
"""

import sqlite3
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class EvidenceNode:
    """Represents a piece of evidence supporting a decision."""
    evidence_text: str
    evidence_type: str = "inferred"
    weight: float = 1.0
    id: Optional[int] = None


@dataclass
class DecisionNode:
    """Represents a final LLM decision with supporting evidence."""
    decision_type: str
    decision_value: str
    confidence: float
    evidence: List[EvidenceNode] = field(default_factory=list)
    id: Optional[int] = None
    review_id: Optional[int] = None


class ContextGraphBuilder:
    """
    Builds context graphs from LLM results without modifying prompts.
    Automatically extracts supporting evidence from review text.
    """
    
    @staticmethod
    def extract_sentiment_evidence(review_text: str, sentiment: str) -> List[str]:
        """Extract phrases that support the sentiment decision."""
        evidence = []
        review_text.lower()
        
        # Positive indicators
        positive_keywords = ['great', 'excellent', 'love', 'amazing', 'perfect', 'best', 
                           'awesome', 'fantastic', 'wonderful', 'brilliant', 'outstanding']
        # Negative indicators  
        negative_keywords = ['bad', 'terrible', 'worst', 'hate', 'awful', 'horrible',
                           'disappointing', 'poor', 'useless', 'trash', 'garbage']
        
        keywords = positive_keywords if sentiment == 'positive' else negative_keywords if sentiment == 'negative' else []
        
        # Find sentences containing keywords
        sentences = re.split(r'[.!?]+', review_text)
        for sentence in sentences[:3]:  # Max 3 pieces of evidence
            sentence_clean = sentence.strip()
            if len(sentence_clean) > 10 and any(kw in sentence_clean.lower() for kw in keywords):
                evidence.append(sentence_clean[:100])  # Limit length
        
        # Fallback: use first sentence if no matches
        if not evidence and sentences:
            evidence.append(sentences[0].strip()[:100])
        
        return evidence[:3]  # Max 3 evidences
    
    @staticmethod
    def extract_churn_evidence(review_text: str, churn_risk: str) -> List[str]:
        """Extract phrases that support churn risk decision."""
        if churn_risk == 'null' or churn_risk == 'low':
            return []
        
        evidence = []
        review_text.lower()
        
        # Churn indicators
        churn_keywords = ['cancel', 'uninstall', 'delete', 'switch', 'alternative',
                         'refund', 'disappointed', 'waste', 'done', 'leaving']
        
        sentences = re.split(r'[.!?]+', review_text)
        for sentence in sentences[:3]:
            sentence_clean = sentence.strip()
            if len(sentence_clean) > 10 and any(kw in sentence_clean.lower() for kw in churn_keywords):
                evidence.append(sentence_clean[:100])
        
        return evidence[:2]  # Max 2 evidences for churn
    
    @staticmethod
    def build_graph_from_llm_result(review_data: Dict[str, Any], llm_result: Dict[str, Any]) -> Optional[DecisionNode]:
        """
        Build a mini context graph from LLM result + review text.
        Returns a DecisionNode with auto-extracted evidence.
        """
        try:
            review_id = review_data.get('temp_id', 0)
            review_text = review_data.get('content', '')
            
            # Create sentiment decision node
            sentiment_node = DecisionNode(
                decision_type='sentiment',
                decision_value=llm_result.get('sentiment', 'neutral'),
                confidence=llm_result.get('confidence', 0.5),
                review_id=review_id
            )
            
            # Auto-extract evidence
            sentiment_evidence = ContextGraphBuilder.extract_sentiment_evidence(
                review_text, 
                sentiment_node.decision_value
            )
            
            for ev_text in sentiment_evidence:
                sentiment_node.evidence.append(EvidenceNode(
                    evidence_text=ev_text,
                    evidence_type='inferred',
                    weight=0.8
                ))
            
            # Add churn evidence if applicable
            churn_risk = llm_result.get('churn_risk', 'null')
            if churn_risk and churn_risk != 'null':
                churn_evidence = ContextGraphBuilder.extract_churn_evidence(review_text, churn_risk)
                for ev_text in churn_evidence:
                    sentiment_node.evidence.append(EvidenceNode(
                        evidence_text=ev_text,
                        evidence_type='churn_indicator',
                        weight=0.9
                    ))
            
            return sentiment_node
            
        except Exception as e:
            print(f"[ContextGraph] Error building graph: {e}")
            return None


class ContextGraphManager:
    """Database interface for saving context graphs silently."""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            from database import DB_PATH
            db_path = DB_PATH
        self.db_path = db_path
    
    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def save_decision(self, decision: DecisionNode, analysis_id: Optional[int] = None) -> bool:
        """Save a decision with evidence to database silently."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Check if tables exist  
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='decision_nodes'")
            if not cursor.fetchone():
                conn.close()
                return False  # Tables not initialized, skip silently
            
            # Insert decision node
            cursor.execute('''
                INSERT INTO decision_nodes 
                (review_id, analysis_id, decision_type, decision_value, confidence)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                decision.review_id,
                analysis_id,
                decision.decision_type,
                decision.decision_value,
                decision.confidence
            ))
            
            decision_id = cursor.lastrowid
            
            # Insert evidence nodes
            for evidence in decision.evidence:
                cursor.execute('''
                    INSERT INTO evidence_nodes
                    (decision_id, evidence_text, evidence_type, weight)
                    VALUES (?, ?, ?, ?)
                ''', (
                    decision_id,
                    evidence.evidence_text,
                    evidence.evidence_type,
                    evidence.weight
                ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            # Fail silently - don't break main analysis
            return False
