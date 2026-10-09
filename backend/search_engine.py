"""TF-IDF retrieval for local incident-response guidance."""

import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.document_loader import KnowledgeBaseRepository, MitigationChunk, kb_repo
from backend.entity_extractor import extract_entities

DEFAULT_RELEVANCE_THRESHOLD = 0.2
EXACT_TECHNIQUE_BOOST = 0.2
BASE_TECHNIQUE_BOOST = 0.1
STALE_DOCUMENT_PENALTY = 0.25
PHASES = ("Immediate", "Investigate", "Recover")


class SearchEngine:
    """Rank section chunks with unigram/bigram TF-IDF cosine similarity."""

    def __init__(
        self,
        repository: Optional[KnowledgeBaseRepository] = None,
        threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
    ):
        self.repository = repository or kb_repo
        self.threshold = threshold
        self.chunks: List[MitigationChunk] = []
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        self.document_matrix = None
        self.build_index()

    def build_index(self) -> None:
        self.chunks = self.repository.get_all_chunks()
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        if self.chunks:
            self.document_matrix = self.vectorizer.fit_transform(
                self._chunk_text(chunk) for chunk in self.chunks
            )
        else:
            self.document_matrix = None

    @staticmethod
    def _chunk_text(chunk: MitigationChunk) -> str:
        return " ".join(
            [chunk.title, chunk.description, chunk.phase, chunk.doc_title]
            + chunk.keywords
            + chunk.techniques
        )

    @staticmethod
    def _technique_boost(chunk: MitigationChunk, query_techniques: Set[str]) -> float:
        chunk_techniques = {technique.upper() for technique in chunk.techniques}
        if any(technique in chunk_techniques for technique in query_techniques):
            return EXACT_TECHNIQUE_BOOST
        if any(
            query_technique.split(".")[0] == chunk_technique.split(".")[0]
            for query_technique in query_techniques
            for chunk_technique in chunk_techniques
        ):
            return BASE_TECHNIQUE_BOOST
        return 0.0

    def search(
        self,
        query: str,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        started = time.perf_counter()
        limit = threshold if threshold is not None else self.threshold
        if not query or not query.strip() or self.document_matrix is None:
            return self._no_results(query, started)

        normalized_query = query.strip()
        query_vector = self.vectorizer.transform([normalized_query])
        similarities = cosine_similarity(query_vector, self.document_matrix).ravel()
        entities = extract_entities(normalized_query)
        query_techniques = {
            technique.upper()
            for technique in re.findall(r"\bT\d{4}(?:\.\d{3})?\b", normalized_query, re.I)
        }
        if entities.get("technique"):
            query_techniques.add(entities["technique"].upper())

        scored = []
        for index, chunk in enumerate(self.chunks):
            score = min(
                1.0,
                float(similarities[index])
                + self._technique_boost(chunk, query_techniques)
            )
            if score >= limit:
                rank_score = score - (
                    STALE_DOCUMENT_PENALTY if chunk.doc_flagged else 0.0
                )
                scored.append((chunk, score, rank_score))

        phase_order = {phase.upper(): index for index, phase in enumerate(PHASES)}
        scored.sort(
            key=lambda item: (
                -item[2],
                phase_order.get(item[0].phase.upper(), len(PHASES)),
            )
        )
        results = [
            {
                "id": chunk.id,
                "step_title": chunk.title,
                "title": chunk.title,
                "step_text": chunk.description,
                "description": chunk.description,
                "phase": chunk.phase,
                "document_id": chunk.doc_id,
                "doc_id": chunk.doc_id,
                "doc_title": chunk.doc_title,
                "section": chunk.section,
                "citation": chunk.citation,
                "techniques": chunk.techniques,
                "score": round(score, 4),
            }
            for chunk, score, _ in scored[: max(0, top_k)]
        ]

        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "status": "success" if results else "no_result",
            "query": normalized_query,
            "entities": entities,
            "total_matches": len(scored),
            "results": results,
            "latency_ms": elapsed_ms,
        }

    @staticmethod
    def _no_results(query: str, started: float) -> Dict[str, Any]:
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
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }


default_search_engine = SearchEngine()


def search(
    query: str,
    top_k: int = 5,
    threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
) -> Dict[str, Any]:
    """Search the default local knowledge base."""
    return default_search_engine.search(query, top_k=top_k, threshold=threshold)
