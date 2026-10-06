"""
SENTRY-IR Core Search Engine
Deterministic keyword & TF-IDF search engine with MITRE technique boosting,
security keyword weighting, and relevance thresholding over local security runbooks.
"""

import math
import re
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Any, Set, Tuple

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.document_loader import KnowledgeBaseRepository, MitigationChunk, kb_repo
from backend.entity_extractor import extract_entities, CONCEPT_TECHNIQUE_MAPPINGS


# Standard English stopwords (grammar/connective glue words)
# Excludes incident-response action verbs (kill, flush, isolate, reboot, power, restore, purge, block, rotate, etc.)
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
    "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "s", "same", "she", "should", "so", "some", "such",
    "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "you",
    "your", "yours", "yourself", "yourselves",
}

DEFAULT_RELEVANCE_THRESHOLD: float = 0.15
EXACT_TECHNIQUE_BOOST: float = 0.35
BASE_TECHNIQUE_BOOST: float = 0.20
KEYWORD_MATCH_WEIGHT: float = 0.05
MAX_KEYWORD_BOOST: float = 0.20


def light_stem(word: str) -> str:
    """
    Lightweight rule-based stemmer to unify plurals and verb inflections
    (e.g., 'sessions' -> 'session', 'queries' -> 'query', 'encrypted' -> 'encrypt').
    Avoids requiring NLTK or large NLP packages.
    """
    w = word.lower()
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("es"):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    if len(w) > 4 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 4 and w.endswith("ed"):
        return w[:-2]
    return w


def normalize_text(text: str) -> str:
    """
    Lowercase and normalize text while preserving security identifiers
    such as T1003.001, CVE-2024-3094, lsass.exe, and event id 10.
    """
    if not text:
        return ""
    return text.lower().strip()


def tokenize(text: str) -> List[str]:
    """
    Extract meaningful tokens from normalized text.
    Preserves dotted security identifiers (T1003.001, lsass.exe),
    adds stemmed roots, and filters common stopwords.
    """
    if not text:
        return []

    normalized = normalize_text(text)
    raw_tokens = re.findall(r"\b[a-z0-9]+(?:[.-][a-z0-9]+)*\b", normalized)
    tokens: List[str] = []

    for r in raw_tokens:
        if r in STOPWORDS:
            continue
        tokens.append(r)
        
        # Add light stem if different
        st = light_stem(r)
        if st != r and st not in STOPWORDS:
            tokens.append(st)

        # For sub-techniques or dotted files, also index base prefix (e.g. 't1003' from 't1003.001')
        if "." in r:
            prefix = r.split(".")[0]
            if prefix not in STOPWORDS and prefix != r:
                tokens.append(prefix)

    return tokens


class SearchEngine:
    """
    In-memory TF-IDF search engine with MITRE technique boosting,
    security keyword weighting, and relevance thresholding.
    Operates over the existing 7 documents and 24 mitigation chunks.
    """

    def __init__(
        self,
        repository: Optional[KnowledgeBaseRepository] = None,
        threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
    ):
        self.repository = repository or kb_repo
        self.threshold = threshold
        self.chunks: List[MitigationChunk] = []
        self.vocabulary: Set[str] = set()
        self.doc_freqs: Counter = Counter()
        self.idf: Dict[str, float] = {}
        self.doc_vectors: Dict[str, Dict[str, float]] = {}
        self.doc_tokens: Dict[str, List[str]] = {}
        self.build_index()

    def build_index(self) -> None:
        """
        Builds the in-memory TF-IDF index across all mitigation chunks in the repository.
        """
        self.chunks = self.repository.get_all_chunks()
        self.doc_tokens.clear()
        self.doc_freqs.clear()
        self.vocabulary.clear()

        # Extract tokens for each mitigation chunk with field weighting:
        # Title (3x), Keywords (2x), Techniques (2x), Description (1x), Phase (1x), Doc Title (1x)
        for chunk in self.chunks:
            c_tokens: List[str] = []
            c_tokens.extend(tokenize(chunk.title) * 3)
            c_tokens.extend(tokenize(chunk.description))
            for kw in chunk.keywords:
                c_tokens.extend(tokenize(kw) * 2)
            for tech in chunk.techniques:
                c_tokens.extend(tokenize(tech) * 2)
            c_tokens.extend(tokenize(chunk.phase))
            c_tokens.extend(tokenize(chunk.doc_title))

            self.doc_tokens[chunk.id] = c_tokens
            unique_chunk_tokens = set(c_tokens)
            self.vocabulary.update(unique_chunk_tokens)
            for t in unique_chunk_tokens:
                self.doc_freqs[t] += 1

        total_docs = len(self.chunks)
        if total_docs == 0:
            return

        # Compute smoothed Inverse Document Frequency (IDF)
        self.idf = {
            t: math.log((1.0 + total_docs) / (1.0 + df)) + 1.0
            for t, df in self.doc_freqs.items()
        }

        # Compute normalized TF-IDF unit vector for each chunk
        self.doc_vectors.clear()
        for chunk in self.chunks:
            counts = Counter(self.doc_tokens[chunk.id])
            vec: Dict[str, float] = {}
            for t, cnt in counts.items():
                tf = 1.0 + math.log(cnt)
                vec[t] = tf * self.idf[t]

            norm = math.sqrt(sum(v * v for v in vec.values()))
            if norm > 0:
                self.doc_vectors[chunk.id] = {t: v / norm for t, v in vec.items()}
            else:
                self.doc_vectors[chunk.id] = {}

    def _extract_query_techniques(self, query: str, inferred_technique: Optional[str]) -> Set[str]:
        """
        Extract all explicit and high-confidence inferred MITRE technique IDs from query.
        """
        techniques: Set[str] = set()

        # Explicit regex: T1003, T1003.001, etc.
        for m in re.findall(r"\b[tT](\d{4}(?:\.\d{3})?)\b", query):
            techniques.add(f"T{m}".upper())

        # Inferred from entity extraction
        if inferred_technique:
            techniques.add(inferred_technique.upper())

        # Check all concept mappings
        for pattern, tech_id in CONCEPT_TECHNIQUE_MAPPINGS:
            if re.search(pattern, query, re.IGNORECASE):
                techniques.add(tech_id.upper())

        return techniques

    def _compute_query_vector(self, query_tokens: List[str]) -> Dict[str, float]:
        """
        Compute normalized TF-IDF unit vector for query tokens.
        """
        if not query_tokens:
            return {}

        counts = Counter(query_tokens)
        vec: Dict[str, float] = {}
        for t, cnt in counts.items():
            if t in self.idf:
                tf = 1.0 + math.log(cnt)
                vec[t] = tf * self.idf[t]

        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm > 0:
            return {t: v / norm for t, v in vec.items()}
        return {}

    def _score_chunk(
        self,
        chunk: MitigationChunk,
        q_unit_vec: Dict[str, float],
        q_tokens: Set[str],
        query_normalized: str,
        query_techniques: Set[str],
    ) -> Tuple[float, float, float, float]:
        """
        Calculate total relevance score = TF-IDF similarity + Technique boost + Keyword boost.
        Returns: (final_score, tfidf_score, technique_boost, keyword_boost)
        """
        chunk_vec = self.doc_vectors.get(chunk.id, {})

        # 1. TF-IDF Cosine Similarity
        tfidf_score = 0.0
        if q_unit_vec and chunk_vec:
            tfidf_score = sum(q_unit_vec.get(t, 0.0) * val for t, val in chunk_vec.items())

        # 2. MITRE Technique Boost
        technique_boost = 0.0
        chunk_techniques = {t.upper() for t in chunk.techniques}
        if query_techniques and chunk_techniques:
            # Exact match (e.g. T1003.001 matches T1003.001)
            if any(qt in chunk_techniques for qt in query_techniques):
                technique_boost = EXACT_TECHNIQUE_BOOST
            # Base technique match (e.g. T1003 matches T1003.001 or vice-versa)
            elif any(
                qt.split(".")[0] == ct.split(".")[0]
                for qt in query_techniques
                for ct in chunk_techniques
            ):
                technique_boost = BASE_TECHNIQUE_BOOST

        # 3. Security Keyword Boost
        keyword_matches = 0
        for kw in chunk.keywords:
            kw_norm = kw.lower()
            if kw_norm in query_normalized:
                keyword_matches += 1
            else:
                kw_toks = set(tokenize(kw))
                if kw_toks and any(kt in q_tokens for kt in kw_toks):
                    keyword_matches += 1

        keyword_boost = min(MAX_KEYWORD_BOOST, keyword_matches * KEYWORD_MATCH_WEIGHT)

        # Composite score
        raw_final = tfidf_score + technique_boost + keyword_boost
        final_score = min(1.0, round(raw_final, 4))

        return final_score, round(tfidf_score, 4), technique_boost, keyword_boost

    def search(
        self,
        query: str,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Search the knowledge base for mitigation steps matching the query.
        
        Args:
            query: Raw security alert or user question text
            top_k: Maximum number of results to return (default: 5)
            threshold: Minimum relevance score cutoff (default: self.threshold / 0.15)
            
        Returns:
            Structured dictionary with 'status', 'entities', 'results', and 'latency_ms'.
        """
        start_time = time.perf_counter()
        effective_threshold = threshold if threshold is not None else self.threshold

        # Clean check for empty or whitespace-only query
        if not query or not query.strip():
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "no_result",
                "query": query,
                "entities": {
                    "host": None,
                    "process": None,
                    "technique": None,
                    "severity": None,
                },
                "total_matches": 0,
                "results": [],
                "latency_ms": elapsed_ms,
            }

        # 1. Heuristic Entity Extraction
        entities = extract_entities(query)

        # 2. Query Normalization & Tokenization
        query_norm = normalize_text(query)
        query_tokens = tokenize(query)
        q_token_set = set(query_tokens)

        # 3. MITRE Technique Detection
        query_techniques = self._extract_query_techniques(query, entities.get("technique"))

        # 4. TF-IDF Query Vector
        q_unit_vec = self._compute_query_vector(query_tokens)

        # 5. Score every mitigation chunk
        scored_results: List[Tuple[MitigationChunk, float, float, float, float]] = []
        for chunk in self.chunks:
            final_score, tfidf_score, t_boost, k_boost = self._score_chunk(
                chunk, q_unit_vec, q_token_set, query_norm, query_techniques
            )
            if final_score >= effective_threshold:
                scored_results.append((chunk, final_score, tfidf_score, t_boost, k_boost))

        # Sort descending by final score
        # Secondary sort prioritizes IMMEDIATE phase actions
        def phase_priority(p: str) -> int:
            if "IMMEDIATE" in p:
                return 0
            if "INVESTIGATE" in p:
                return 1
            return 2

        scored_results.sort(
            key=lambda x: (x[1], -phase_priority(x[0].phase)),
            reverse=True,
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # If nothing meets the relevance threshold, return clean no_result
        if not scored_results:
            return {
                "status": "no_result",
                "query": query,
                "entities": entities,
                "total_matches": 0,
                "results": [],
                "latency_ms": elapsed_ms,
            }

        # Format top_k results
        top_results = scored_results[:top_k]
        formatted_results: List[Dict[str, Any]] = []

        for chunk, score, tfidf_score, t_boost, k_boost in top_results:
            formatted_results.append({
                "id": chunk.id,
                "step_title": chunk.title,
                "title": chunk.title,
                "step_text": chunk.description,
                "description": chunk.description,
                "phase": chunk.phase,
                "document_id": chunk.doc_id,
                "doc_id": chunk.doc_id,
                "doc_title": chunk.doc_title,
                "citation": chunk.citation,
                "techniques": chunk.techniques,
                "score": score,
            })

        return {
            "status": "success",
            "query": query,
            "entities": entities,
            "total_matches": len(scored_results),
            "results": formatted_results,
            "latency_ms": elapsed_ms,
        }


# Global search engine instance for easy import across modules
default_search_engine = SearchEngine()


def search(query: str, top_k: int = 5, threshold: float = DEFAULT_RELEVANCE_THRESHOLD) -> Dict[str, Any]:
    """Convenience search function wrapping the default SearchEngine instance."""
    return default_search_engine.search(query, top_k=top_k, threshold=threshold)
