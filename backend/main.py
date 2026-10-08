"""
SENTRY-IR FastAPI Backend Application
Exposes security search and knowledge base endpoints for the React frontend.
"""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.document_loader import kb_repo
from backend.search_engine import search
from backend.schemas import (
    SearchRequest,
    SearchResponse,
    DocumentListResponse,
    DocumentDetail,
)

# Initialize FastAPI application
app = FastAPI(
    title="SENTRY-IR API",
    description="Security Incident Response Search & Knowledge Base API",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Configure CORS for local Vite development server
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["System"])
def root():
    """Health and status check endpoint."""
    return {
        "app": "SENTRY-IR API",
        "version": "1.0.0",
        "status": "healthy",
        "documents_indexed": len(kb_repo.get_all_documents()),
        "chunks_indexed": len(kb_repo.get_all_chunks()),
    }


@app.post(
    "/api/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search security knowledge base",
    description="Search security knowledge base for mitigation guidance based on alert text or incident query.",
    tags=["Search"],
)
def search_endpoint(req: SearchRequest) -> SearchResponse:
    """
    Execute deterministic TF-IDF search with MITRE technique boosting and entity extraction.
    Returns ranked mitigation steps or clean no_result status.
    """
    raw_result = search(query=req.query, top_k=req.top_k or 5)
    return SearchResponse(**raw_result)


@app.get(
    "/api/documents",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List available security documents",
    description="List all ingested security runbooks, advisories, and threat intelligence reports.",
    tags=["Documents"],
)
def list_documents() -> DocumentListResponse:
    """
    Retrieve metadata summaries of all indexed documents in the knowledge base.
    """
    docs = kb_repo.get_all_documents()
    return DocumentListResponse(
        documents=[doc.to_summary_dict() for doc in docs],
        total=len(docs),
    )


@app.get(
    "/api/documents/{doc_id}",
    response_model=DocumentDetail,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a specific security document",
    description="Retrieve full content, steps, and metadata for a specific security document.",
    tags=["Documents"],
)
def get_document(doc_id: str) -> DocumentDetail:
    """
    Retrieve full details and mitigation steps for a single document by ID.
    Raises 404 if the document ID does not exist in the knowledge base.
    """
    doc = kb_repo.get_document(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return DocumentDetail(**doc.to_detail_dict())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
