"""
SENTRY-IR FastAPI Backend Application
Exposes security search and knowledge base endpoints for the React frontend.
"""

import io
import json
import re
import sys
import time
import uuid
from zipfile import BadZipFile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from docx import Document as DocxDocument
from docx.opc.exceptions import PackageNotFoundError
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from backend.alert_parser import TECHNIQUE_NAMES, flatten_alert, parse_alert
from backend.document_loader import DOCUMENTS_DIR, kb_repo
from backend.search_engine import default_search_engine, search
from backend.schemas import SearchRequest, SearchResponse

SUBMISSIONS_PATH = Path(__file__).parent / "data" / "submissions.json"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {".txt", ".md", ".pdf", ".docx"}


class FeedbackRequest(BaseModel):
    alertId: str = Field(min_length=1)
    helpful: bool


class RunbookFlagRequest(BaseModel):
    docId: str = Field(min_length=1)
    reason: str = ""

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
    result = search(alert_text, top_k=len(kb_repo.get_all_chunks()))
    matches = result["results"]
    steps = []
    for order, item in enumerate(matches[:5], start=1):
        document = kb_repo.get_document(item["document_id"])
        if document is None:
            continue
        steps.append(
            {
                "phase": item["phase"],
                "order": order,
                "title": item["title"],
                "description": item["description"],
                "score": item["score"],
                "citation": {
                    "docId": document.id,
                    "docName": document.title,
                    "section": item.get("section", ""),
                    "sectionTitle": item["title"],
                    "version": document.version,
                    "date": document.date,
                },
            }
        )
    conflicts = _find_conflicts(matches, parsed.get("technique"))
    top_score = max((step["score"] for step in steps), default=0.0)
    confidence = "High" if top_score >= 0.65 else "Medium" if top_score >= 0.4 else "Low"
    elapsed_seconds = round(time.perf_counter() - started, 4)
    sources = list(dict.fromkeys(step["citation"]["docName"] for step in steps))
    return {
        "steps": steps,
        "confidence": confidence,
        "retrievalSeconds": elapsed_seconds,
        "sourcesMatched": sources,
        "conflicts": conflicts,
    }


def _parse_date(value: str) -> datetime:
    for date_format in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue
    return datetime.min


def _version_key(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in re.findall(r"\d+", value))


def _find_conflicts(matches: List[Dict[str, Any]], technique: Optional[str]) -> List[dict]:
    if not technique:
        return []

    base_technique = technique.split(".", 1)[0].upper()
    relevant: Dict[str, Dict[str, Any]] = {}
    for item in matches:
        if not any(
            candidate.upper().split(".", 1)[0] == base_technique
            for candidate in item["techniques"]
        ):
            continue
        document = kb_repo.get_document(item["document_id"])
        if document is None or document.type.casefold() == "threat intel":
            continue
        previous = relevant.get(document.id)
        is_immediate = item["phase"].casefold() == "immediate"
        previous_is_immediate = previous is not None and previous["phase"].casefold() == "immediate"
        if previous is None or (is_immediate and not previous_is_immediate) or (
            is_immediate == previous_is_immediate and item["score"] > previous["score"]
        ):
            relevant[document.id] = item

    documents = [
        (kb_repo.get_document(doc_id), item)
        for doc_id, item in relevant.items()
    ]
    documents = [(doc, item) for doc, item in documents if doc is not None]
    if len(documents) < 2:
        return []

    documents.sort(
        key=lambda pair: (_parse_date(pair[0].date), _version_key(pair[0].version)),
        reverse=True,
    )
    conflicts = []
    newest_doc, newest_item = documents[0]
    for older_doc, older_item in documents[1:]:
        if newest_doc.date == older_doc.date and newest_doc.version == older_doc.version:
            continue
        older_doc.status = "Stale — flagged"
        older_doc.flagged = True
        conflicts.append(
            {
                "topic": TECHNIQUE_NAMES.get(technique, technique),
                "newer": {
                    "docName": newest_doc.title,
                    "version": newest_doc.version,
                    "date": newest_doc.date,
                    "quote": newest_item["description"][:600],
                },
                "older": {
                    "docName": older_doc.title,
                    "version": older_doc.version,
                    "date": older_doc.date,
                    "quote": older_item["description"][:600],
                },
            }
        )
    return conflicts


@app.get(
    "/api/documents",
    status_code=status.HTTP_200_OK,
    summary="List available security documents",
    description="List all ingested security runbooks, advisories, and threat intelligence reports.",
    tags=["Documents"],
)
def list_documents() -> List[dict]:
    """
    Retrieve metadata summaries of all indexed documents in the knowledge base.
    """
    return [document.to_api_summary_dict() for document in kb_repo.get_all_documents()]


@app.get("/api/kb/stats", tags=["Knowledge Base"])
def get_kb_stats() -> dict:
    # CVE feed sync is simulated for this local-only project: last synced 12m ago.
    return {
        "documentCount": len(kb_repo.get_all_documents()),
        "chunksIndexed": len(kb_repo.get_all_chunks()),
        "parsingQueueCount": 0,
        "cveFeedSync": "12m ago",
    }


@app.get("/api/documents/{doc_id}/sections/{section}", tags=["Documents"])
def get_document_section(doc_id: str, section: str) -> dict:
    document = kb_repo.get_document(doc_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    chunk = next(
        (
            chunk
            for chunk in kb_repo.get_all_chunks()
            if chunk.doc_id == doc_id
            and (chunk.section == section or chunk.id == section)
        ),
        None,
    )
    if chunk is None:
        raise HTTPException(status_code=404, detail="Document section not found")
    sentence = re.search(r".*?[.!?](?:\s|$)", chunk.description, re.DOTALL)
    highlight = sentence.group(0).strip() if sentence else chunk.description.strip()
    return {
        "docName": document.title,
        "sectionTitle": chunk.title,
        "version": document.version,
        "date": document.date,
        "owner": document.owner,
        "text": chunk.description,
        "highlight": highlight,
    }


def _extract_upload_text(filename: str, contents: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension in {".txt", ".md"}:
        try:
            return contents.decode("utf-8-sig").strip()
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Text documents must be UTF-8") from exc
    if extension == ".pdf":
        try:
            return "\n\n".join(
                page.extract_text() or "" for page in PdfReader(io.BytesIO(contents)).pages
            ).strip()
        except (PdfReadError, ValueError, OSError) as exc:
            raise HTTPException(status_code=400, detail="Could not read the PDF document") from exc
    try:
        return "\n\n".join(
            paragraph.text
            for paragraph in DocxDocument(io.BytesIO(contents)).paragraphs
            if paragraph.text.strip()
        ).strip()
    except (BadZipFile, PackageNotFoundError, ValueError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Could not read the DOCX document") from exc


def _sectioned_upload_content(text: str) -> str:
    section_heading = re.compile(
        r"^#{1,6}\s+\d+(?:\.\d+)*\s+\[(?:Immediate|Investigate|Recover)\]",
        re.IGNORECASE,
    )
    if any(section_heading.match(line) for line in text.splitlines()):
        return text

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(paragraphs) == 1 and len(paragraphs[0]) > 1200:
        paragraphs = [
            part.strip()
            for part in re.split(r"(?<=[.!?])\s+", paragraphs[0])
            if part.strip()
        ]
    sections = []
    for index, paragraph in enumerate(paragraphs, start=1):
        phase = "Immediate" if index == 1 else "Recover" if index == len(paragraphs) else "Investigate"
        sections.append(f"## {index} [{phase}] Uploaded section {index}\n{paragraph}")
    return "\n\n".join(sections)


@app.post("/api/documents", status_code=status.HTTP_201_CREATED, tags=["Documents"])
async def upload_document(file: UploadFile = File(...)) -> dict:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=415, detail="Upload a .txt, .md, .pdf, or .docx file")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds the 10 MB upload limit")
    text = _extract_upload_text(filename, contents)
    if not text:
        raise HTTPException(status_code=422, detail="Uploaded document contains no extractable text")

    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(filename).stem).strip("-") or "upload"
    doc_id = f"upload-{stem}"
    if kb_repo.get_document(doc_id) is not None:
        doc_id = f"{doc_id}-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).strftime("%b %d, %Y")
    document_data = {
        "id": doc_id,
        "title": Path(filename).stem,
        "type": "Uploaded Document",
        "owner": "User Upload",
        "version": "v1.0",
        "date": now,
        "updated": now,
        "published": now,
        "status": "Indexed",
        "flagged": False,
        "techniques": [],
        "summary": f"Uploaded knowledge-base document: {filename}",
        "content": _sectioned_upload_content(text),
    }
    try:
        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        (DOCUMENTS_DIR / f"{doc_id}.json").write_text(
            json.dumps(document_data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save uploaded document") from exc

    kb_repo.reload()
    default_search_engine.build_index()
    document = kb_repo.get_document(doc_id)
    if document is None:
        raise HTTPException(status_code=500, detail="Uploaded document was not indexed")
    return document.to_api_summary_dict()


def _save_submission(kind: str, payload: Dict[str, Any]) -> dict:
    record = {
        "type": kind,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }
    try:
        submissions = json.loads(SUBMISSIONS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        submissions = []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Submission store contains invalid JSON") from exc
    if not isinstance(submissions, list):
        raise HTTPException(status_code=500, detail="Submission store must contain a JSON array")
    submissions.append(record)
    try:
        SUBMISSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = SUBMISSIONS_PATH.with_suffix(".tmp")
        temporary_path.write_text(
            json.dumps(submissions, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary_path.replace(SUBMISSIONS_PATH)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save submission") from exc
    return {"status": "saved", "id": len(submissions)}


@app.post("/api/feedback", status_code=status.HTTP_201_CREATED, tags=["Feedback"])
def submit_feedback(request: FeedbackRequest) -> dict:
    return _save_submission("feedback", request.model_dump())


@app.post("/api/escalations", status_code=status.HTTP_201_CREATED, tags=["Feedback"])
def submit_escalation(payload: Dict[str, Any]) -> dict:
    if not payload:
        raise HTTPException(status_code=422, detail="Escalation details are required")
    return _save_submission("escalation", payload)


@app.post("/api/runbook-flags", status_code=status.HTTP_201_CREATED, tags=["Documents"])
def flag_runbook(request: RunbookFlagRequest) -> dict:
    document = kb_repo.get_document(request.docId)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    document.flagged = True
    document.status = "Stale — flagged"
    result = _save_submission("runbook-flag", request.model_dump())
    return {**result, "document": document.to_api_summary_dict()}


@app.get(
    "/api/documents/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Retrieve a specific security document",
    description="Retrieve full content, steps, and metadata for a specific security document.",
    tags=["Documents"],
)
def get_document(doc_id: str) -> dict:
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
    return {
        "id": doc.id,
        "name": doc.title,
        "type": doc.type,
        "version": doc.version,
        "date": doc.date,
        "owner": doc.owner,
        "text": doc.content,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
