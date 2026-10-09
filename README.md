# SENTRY-IR: Security Incident Response Mitigation Retrieval

SENTRY-IR is a local incident-response assistant for Security Operations Center (SOC) analysts. It combines a dark investigation-console interface with a FastAPI service that parses security alerts and retrieves relevant, cited mitigation steps from a local knowledge base.

## Overview

Analysts can paste an alert or ask a question in plain language. The application extracts alert entities and MITRE ATT&CK context, searches indexed runbooks and advisories, and presents ranked response steps with source citations. When relevant sources disagree, the backend can flag older guidance and return a comparison with the newer source.

The frontend's alert intake, confirmation, and mitigation retrieval flows use the local API. Some knowledge-base inventory values, CVE-feed status, and the upload interaction on the inventory screen are still demonstration UI; the backend also provides a separate working document-upload API.

This project runs locally and does not connect to a production SIEM, external database, live CVE/NVD feed, or AI/LLM service. Search and entity extraction are deterministic and operate on the local document collection.

## Features

### Alert parsing and retrieval

- Accept raw JSON alerts, plain-text alerts, or plain-language incident questions.
- Extract host, process, severity, detection name, and MITRE ATT&CK technique information using rule-based mappings and heuristics.
- Review and edit extracted alert entities before searching.
- Rank mitigation steps with scikit-learn TF-IDF (unigrams and bigrams), MITRE technique boosts, and a relevance threshold.
- Organize guidance into Immediate, Investigate, and Recover phases.
- Include relevance scores, confidence, retrieval time, source documents, and section-level citations.
- Detect differing guidance across matching runbooks, compare document versions and dates, and flag older documents as stale.
- Submit mitigation feedback and escalation/runbook-flag records to a local JSON store.

### Knowledge base

- Load local JSON documents and split numbered Markdown sections into searchable mitigation chunks.
- List documents and retrieve their content, metadata, and sections.
- Upload text, Markdown, PDF, and DOCX documents through the backend API (maximum size: 10 MB); extracted content is sectioned, indexed, and added to the local knowledge base.
- Report indexed document and chunk counts.

### Frontend

- Search by pasted alert or plain-language question, confirm/edit extracted entities, and view ranked mitigation steps.
- Review source citations, confidence, retrieval time, and conflict warnings.
- Browse sample knowledge-base inventory and document-detail screens.
- Present sample upload and CVE-feed status interactions in the inventory screen; those particular UI interactions are not connected to the backend upload or a live feed.

The repository currently includes ten sample JSON knowledge-base documents. Document and chunk counts are loaded from disk at backend startup and can change as documents are added.

## Technology stack

### Frontend

- React 19
- Vite 8
- React Router 7
- Tailwind CSS 4
- Lucide React

### Backend

- Python, FastAPI, and Pydantic
- Uvicorn ASGI server
- scikit-learn TF-IDF vectorization and cosine similarity
- pypdf and python-docx for PDF and DOCX text extraction
- JSON files for the local knowledge base and submissions

## Getting started

Run the backend and frontend in separate terminals from the repository root.

### 1. Install backend dependencies

```bash
python -m pip install -r backend/requirements.txt
```

### 2. Start the backend

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive Swagger documentation is at `http://127.0.0.1:8000/docs`, and the OpenAPI schema is at `http://127.0.0.1:8000/openapi.json`.

### 3. Install and start the frontend

In a second terminal:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173/`. Vite proxies `/api` requests to `http://localhost:8000`.

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health status and indexed document/chunk counts |
| `POST` | `/api/parse` | Parse a plain-text or JSON alert and extract entities and technique metadata |
| `POST` | `/api/search` | Search for ranked mitigation steps using a query and optional `top_k` (1–5; default 5) |
| `POST` | `/api/retrieve` | Retrieve up to five response steps, citations, confidence, sources, and conflicts for an alert |
| `GET` | `/api/documents` | List indexed document summaries |
| `GET` | `/api/documents/{doc_id}` | Retrieve a document's metadata and full text |
| `GET` | `/api/documents/{doc_id}/sections/{section}` | Retrieve a mitigation section and highlighted excerpt |
| `GET` | `/api/kb/stats` | Return knowledge-base counts and the simulated CVE sync status |
| `POST` | `/api/documents` | Upload and index a `.txt`, `.md`, `.pdf`, or `.docx` file (multipart form, max 10 MB) |
| `POST` | `/api/feedback` | Save helpful/not-relevant feedback |
| `POST` | `/api/escalations` | Save escalation details |
| `POST` | `/api/runbook-flags` | Mark an indexed document stale and save a flag record |

### Example search request

`POST /api/search` accepts a non-empty query:

```json
{
  "query": "Suspicious LSASS access on HOST-042 using mimikatz",
  "top_k": 5
}
```

The response contains `status` (`success` or `no_result`), extracted `entities`, `total_matches`, ranked `results`, and `latency_ms`. Each result includes a mitigation step, response phase, score, source document, MITRE techniques, and citation. Invalid or blank queries return HTTP 422.

Example using `curl.exe`:

```bash
curl.exe -X POST "http://127.0.0.1:8000/api/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"Suspicious LSASS access on HOST-042 using mimikatz\"}"
```

`/api/parse` and `/api/retrieve` accept either JSON or plain-text request bodies. See `/docs` for request and response schemas and interactive requests.

## Tests and quality checks

Backend dependencies, including pytest and the FastAPI test client dependency, are listed in `backend/requirements.txt`. After installing them, run:

```bash
python -m pytest backend
```

Run the frontend linter and production build:

```bash
npm run lint
npm run build
```

## Repository layout

```text
backend/
  alert_parser.py       Alert normalization and MITRE ATT&CK mappings
  data/
    documents/          Sample JSON runbooks, advisories, and threat intelligence
    submissions.json    Created at runtime for feedback and other submissions
  document_loader.py    Loads documents and creates searchable mitigation chunks
  entity_extractor.py   Heuristic host, process, severity, and technique extraction
  main.py               FastAPI application, API routes, and document ingestion
  requirements.txt      Python dependencies
  schemas.py            Pydantic request and response models
  search_engine.py      TF-IDF ranking, technique boosts, and stale-document penalty
  test_api.py           API and endpoint tests
  test_parse_retrieve.py Alert parsing, retrieval, upload, and API tests
  test_search_engine.py Search and entity-extraction tests
src/
  api.js                Frontend API client and response normalization
  components/           Shared interface components
  data/                 Sample alerts, documents, and demonstration mitigations
  pages/                Search, confirmation, results, conflict, and knowledge-base screens
  App.jsx               Client-side route configuration
  main.jsx              Frontend entry point
```

## Local data and limitations

- The backend reads JSON documents from `backend/data/documents` at startup. API uploads write new JSON files there and rebuild the in-memory search index.
- Feedback, escalation, and runbook-flag submissions are stored in `backend/data/submissions.json`; no external database is used.
- The knowledge-base inventory page currently displays sample metrics and simulates uploads in browser state. Use the backend upload endpoint to add a document to the searchable index.
- CVE feed timing and status are simulated; the project does not poll NVD or another external feed.
- Entity extraction uses configured patterns and mappings, and retrieval is local keyword/TF-IDF search. Neither is an AI model or a substitute for analyst review.
