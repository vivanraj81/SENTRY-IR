"""
SENTRY-IR Document & Knowledge Base Loader
Loads, validates, and chunks security runbooks and advisories for retrieval.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("document_loader")

DOCUMENTS_DIR = Path(__file__).parent / "data" / "documents"


class Document:
    def __init__(self, raw: Dict[str, Any]):
        self.id: str = raw.get("id", "")
        self.title: str = raw.get("title", "")
        self.type: str = raw.get("type", "Runbook")
        self.version: str = raw.get("version", "v1.0")
        self.updated: str = raw.get("updated", "")
        self.published: str = raw.get("published", "")
        self.status: str = raw.get("status", "Indexed")
        self.flagged: bool = raw.get("flagged", False)
        self.owner: str = raw.get("owner", "SOC Team")
        self.techniques: List[str] = raw.get("techniques", [])
        self.summary: str = raw.get("summary", "")
        self.content: str = raw.get("content", "")
        self.steps: List[Dict[str, Any]] = raw.get("steps", [])

    @property
    def chunk_count(self) -> int:
        return len(self.steps)

    def to_summary_dict(self) -> Dict[str, Any]:
        """Output format tailored for KnowledgeBase and Document list views."""
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "version": self.version,
            "updated": self.updated,
            "published": self.published,
            "chunks": self.chunk_count,
            "status": self.status,
            "flagged": self.flagged,
            "owner": self.owner,
            "techniques": self.techniques,
            "summary": self.summary,
        }

    def to_detail_dict(self) -> Dict[str, Any]:
        """Full document details including content for DocumentDetailPage."""
        d = self.to_summary_dict()
        d["content"] = self.content
        d["steps"] = self.steps
        return d


class MitigationChunk:
    def __init__(self, step: Dict[str, Any], parent_doc: Document):
        self.id: str = step.get("id", "")
        self.doc_id: str = parent_doc.id
        self.doc_title: str = parent_doc.title
        self.doc_type: str = parent_doc.type
        self.doc_version: str = parent_doc.version
        self.phase: str = step.get("phase", "INVESTIGATE")
        self.title: str = step.get("title", "")
        self.description: str = step.get("description", "")
        self.citation: str = step.get("citation", f"{parent_doc.title}")
        self.techniques: List[str] = step.get("techniques", parent_doc.techniques)
        self.keywords: List[str] = step.get("keywords", [])
        
        # Searchable corpus representation combining title, description, and keywords
        search_tokens = [self.title, self.description] + self.keywords + self.techniques + [self.phase]
        self.searchable_text = " ".join(search_tokens).lower()

    def to_step_card_dict(self) -> Dict[str, Any]:
        """Output format matching the React StepCard component expectations."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "citation": self.citation,
            "docId": self.doc_id,
            "phase": self.phase,
            "techniques": self.techniques,
        }


class KnowledgeBaseRepository:
    def __init__(self, docs_dir: Path = DOCUMENTS_DIR):
        self.docs_dir = docs_dir
        self.documents: Dict[str, Document] = {}
        self.chunks: List[MitigationChunk] = []
        self.reload()

    def reload(self) -> None:
        """Scan directory and reload all documents and chunks."""
        self.documents.clear()
        self.chunks.clear()

        if not self.docs_dir.exists():
            logger.warning(f"Documents directory does not exist: {self.docs_dir}")
            return

        json_files = sorted(self.docs_dir.glob("*.json"))
        for file_path in json_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    doc = Document(data)
                    self.documents[doc.id] = doc

                    for step in doc.steps:
                        chunk = MitigationChunk(step, doc)
                        self.chunks.append(chunk)

            except Exception as e:
                logger.error(f"Error loading {file_path.name}: {e}")

        logger.info(f"Loaded {len(self.documents)} documents and {len(self.chunks)} mitigation chunks.")

    def get_all_documents(self) -> List[Document]:
        return list(self.documents.values())

    def get_document(self, doc_id: str) -> Optional[Document]:
        return self.documents.get(doc_id)

    def get_all_chunks(self) -> List[MitigationChunk]:
        return self.chunks

    def summary(self) -> Dict[str, Any]:
        return {
            "total_documents": len(self.documents),
            "total_chunks": len(self.chunks),
            "document_types": list({d.type for d in self.documents.values()}),
            "techniques_indexed": sorted(list({t for d in self.documents.values() for t in d.techniques})),
        }


# Singleton instance for application-wide use
kb_repo = KnowledgeBaseRepository()


if __name__ == "__main__":
    print("\n=== SENTRY-IR KNOWLEDGE BASE REPOSITORY AUDIT ===")
    summary = kb_repo.summary()
    print(f"Total Ingested Documents : {summary['total_documents']}")
    print(f"Total Mitigation Chunks   : {summary['total_chunks']}")
    print(f"Document Types            : {', '.join(summary['document_types'])}")
    print(f"MITRE Techniques Indexed  : {', '.join(summary['techniques_indexed'])}\n")

    print(f"{'DOCUMENT ID':<32} | {'TYPE':<12} | {'VERSION':<7} | {'CHUNKS':<6} | {'STATUS'}")
    print("-" * 75)
    for doc in kb_repo.get_all_documents():
        print(f"{doc.id:<32} | {doc.type:<12} | {doc.version:<7} | {doc.chunk_count:<6} | {doc.status}")

    print("\nSample Extracted Mitigation Chunks:")
    for chunk in kb_repo.get_all_chunks()[:4]:
        print(f"- [{chunk.phase}] {chunk.title} (Source: {chunk.citation})")
