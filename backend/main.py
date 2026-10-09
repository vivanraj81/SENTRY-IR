"""
SENTRY-IR FastAPI Backend Application
Exposes security search and knowledge base endpoints for the React frontend.
"""

import sys
import json
import time
from pathlib import Path
from typing import Any

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from backend.alert_parser import flatten_alert, parse_alert
from backend.document_loader import kb_repo
from backend.search_engine import PHASES, search
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


async def read_alert_text(request: Request) -> str:
    """Accept a plain-text alert or a JSON alert object and flatten its fields."""
    body = await request.body()
    if not body:
        raise HTTPException(status_code=422, detail="Alert text is required")

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type == "application/json" or content_type.endswith("+json"):
        try:
            payload: Any = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=400, detail="Request body must contain valid JSON") from exc
        alert_text = flatten_alert(payload)
    elif content_type in ("", "text/plain"):
        try:
            alert_text = body.decode("utf-8").strip()
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Alert text must be UTF-8") from exc
    else:
        raise HTTPException(
            status_code=415,
            detail="Content-Type must be application/json or text/plain",
        )

    if not alert_text:
        raise HTTPException(status_code=422, detail="Alert text is required")
    return alert_text


ALERT_REQUEST_DOCS = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {"type": "object"},
                "example": {"alert": "Suspicious LSASS Access on HOST-042"},
            },
            "text/plain": {
                "schema": {"type": "string"},
                "example": "Suspicious LSASS Access on HOST-042",
            },
        },
    }
}


@app.post(
    "/api/parse",
    summary="Parse an alert and map it to MITRE ATT&CK",
    tags=["Alerts"],
    openapi_extra=ALERT_REQUEST_DOCS,
)
async def parse_endpoint(request: Request) -> dict:
    return parse_alert(await read_alert_text(request))


@app.post(
    "/api/retrieve",
    summary="Retrieve response guidance for an alert",
    tags=["Search"],
    openapi_extra=ALERT_REQUEST_DOCS,
)
async def retrieve_endpoint(request: Request) -> dict:
    started = time.perf_counter()
    alert_text = await read_alert_text(request)
    parsed = parse_alert(alert_text)
    result = search(alert_text, top_k=5)
    grouped = {phase: [] for phase in PHASES}

    for item in result["results"]:
        phase = item["phase"].title()
        if phase not in grouped:
            continue
        score = item["score"]
        confidence = "High" if score >= 0.65 else "Medium" if score >= 0.4 else "Low"
        grouped[phase].append({**item, "confidence": confidence})

    elapsed_seconds = round(time.perf_counter() - started, 4)
    sources = list(dict.fromkeys(item["doc_title"] for item in result["results"]))
    return {
        "alert": parsed,
        "results": grouped,
        "conflicts": [],
        "retrievalSeconds": elapsed_seconds,
        "sourcesMatched": sources,
    }


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
