# SENTRY-IR: Security Incident Response Mitigation Retrieval

SENTRY-IR is a local-first incident-response workspace for Security Operations Center (SOC) analysts. Analysts submit a raw alert or plain-language question; the React frontend sends it to a FastAPI backend, which retrieves relevant response steps from indexed runbooks and advisories. Results include response phases, confidence, source citations, and warnings when current and legacy guidance conflict.

## Project overview

The application includes:

- **React frontend** for alert intake, entity review, mitigation results, evidence viewing, conflict warnings, and knowledge-base administration.
- **FastAPI backend** for alert parsing, local knowledge-base search, document and section retrieval, document upload, escalation and feedback submissions, and runbook flags.
- **JSON knowledge base** containing sample incident-response runbooks, advisories, and threat-intelligence material.

Search and entity extraction are deterministic and operate on local data. This project does not connect to a production SIEM, external database, live CVE/NVD feed, or AI/LLM service. The knowledge-base CVE sync status is simulated.

## Features

### Alert intake and mitigation retrieval

- Accept raw JSON alerts, plain-text alerts, or plain-language questions.
- Parse host, process, severity, detection name, and MITRE ATT&CK technique information with rule-based mappings and heuristics.
- Review and edit extracted entities before retrieval.
- Rank mitigation steps with scikit-learn TF-IDF (unigrams and bigrams), cosine similarity, MITRE technique boosts, and a relevance threshold.
- Present guidance in Immediate, Investigate, and Recover phases, with source documents, section citations, confidence, and retrieval time.
- Detect conflicting guidance across matching runbooks, compare document versions and dates, and flag older guidance for owner review.
- Submit feedback and escalate alerts with no matching mitigation.

### Knowledge base

- Load JSON documents and split phase-labelled sections into searchable mitigation chunks.
- Browse indexed document metadata and index statistics.
- Upload `.txt`, `.md`, `.pdf`, or `.docx` documents through the frontend or API. The backend extracts text, sections it, saves it to the local JSON knowledge base, and rebuilds the search index. The upload limit is 10 MB.
- View source excerpts and highlighted evidence, or open the full source document.
- Persist feedback, escalations, and runbook flags to a local JSON submissions file.

The bundled knowledge base currently contains ten sample JSON documents. Counts are loaded from disk when the backend starts and can change as documents are added.

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
- Local JSON files for documents and submissions

## Run locally

Use Python 3.10 or newer and Node.js 22.12+ (or 20.19+). Run the backend and frontend in separate terminals from the repository root.

### Backend

Create and activate a virtual environment, install the declared dependencies, and start the API:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```

If PowerShell blocks script activation, invoke the virtual environment's Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000 --reload
```

The API is available at `http://localhost:8000`. Interactive Swagger documentation is at `http://localhost:8000/docs`, and the OpenAPI schema is at `http://localhost:8000/openapi.json`.

### Frontend

In a second terminal:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:8000`. The built frontend uses the same origin as the API when served by FastAPI.

## How search works

At startup, the backend loads the JSON documents and divides phase-labelled sections into searchable chunks. Scikit-learn represents the sections with TF-IDF features for unigrams and bigrams. Search compares the alert or question with those sections using cosine similarity, then boosts results when the extracted MITRE technique matches. Results below the configured relevance threshold are excluded, and the strongest matches are returned with citations. This is deterministic local keyword retrieval, not an embedding model or external AI service.

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health status and indexed document/chunk counts |
| `POST` | `/api/parse` | Parse a plain-text or JSON alert and extract entity and technique metadata |
| `POST` | `/api/search` | Search for mitigation steps using a query and optional `top_k` (1–5; default 5) |
| `POST` | `/api/retrieve` | Retrieve up to five response steps, citations, confidence, sources, and conflicts |
| `GET` | `/api/documents` | List indexed document summaries |
| `GET` | `/api/documents/{doc_id}` | Retrieve a document's metadata and full text |
| `GET` | `/api/documents/{doc_id}/sections/{section}` | Retrieve a section excerpt and highlighted sentence |
| `GET` | `/api/kb/stats` | Return knowledge-base counts and simulated CVE sync status |
| `POST` | `/api/documents` | Upload and index a `.txt`, `.md`, `.pdf`, or `.docx` file (multipart form, max 10 MB) |
| `POST` | `/api/feedback` | Save helpful/not-relevant feedback |
| `POST` | `/api/escalations` | Save escalation details |
| `POST` | `/api/runbook-flags` | Flag an indexed document for owner review |

`/api/parse` and `/api/retrieve` accept JSON or plain-text request bodies. `/api/search` accepts a non-empty query, for example:

```json
{
  "query": "Suspicious LSASS access on HOST-042 using mimikatz",
  "top_k": 5
}
```

Search returns a `success` or `no_result` status, extracted entities, match counts, ranked mitigation steps, source citations, and retrieval latency. Invalid or blank queries return HTTP 422. Use `/docs` to inspect schemas and try API requests interactively.

## Demo scenarios

Submit these alerts or questions through the intake screen:

1. **Suspicious LSASS Access** — `{"detection":"Suspicious LSASS Access","host":"FIN-WS-07","process":"rundll32.exe","rule":"Sigma_T1003_001"}`. Expect host isolation and memory-preservation steps, investigation guidance, credential recovery, and a conflict between the newer credential-theft runbook and legacy playbook.
2. **Encoded PowerShell Command** — `{"detection":"Encoded PowerShell","host":"FIN-WS-07","process":"powershell.exe","rule":"Sigma_T1059_001"}`. Expect PowerShell investigation and containment guidance.
3. **Outbound SMB to rare IP** — `{"detection":"Outbound SMB to rare IP","host":"FIN-WS-07","process":"System","rule":"Sigma_T1021_002"}`. Expect lateral-movement and SMB containment guidance.
4. **Brute force** — `T1110 password spray account compromise`. Expect brute-force response steps.
5. **DNS tunneling** — `Anomalous DNS tunneling over port 53`. Expect the no-mitigation state when no indexed document meets the relevance threshold.

From a result, open a citation to inspect its excerpt and highlighted sentence, open the full document, review any conflict warning, submit feedback, or escalate an alert with no matching mitigation. Visit `/admin` (or `/knowledge-base`) to browse and upload documents.

## Tests and production build

The backend test dependencies are included in `backend/requirements.txt`:

```powershell
python -m pytest backend
```

Run the frontend linter and production build:

```powershell
npm.cmd run lint
npm.cmd run build
```

## Deploy on Render

Create a Render Web Service for this repository and configure:

- **Build command:** `npm install && npm run build && pip install -r backend/requirements.txt`
- **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

Render's `PORT` environment variable enables FastAPI to serve the built `dist/` frontend, including client-side routes such as `/admin`; API routes remain under `/api`. To enable frontend serving in another environment, set `SENTRY_SERVE_FRONTEND=1`. Render's free instance sleeps when idle, so allow time for it to wake before a demo.

## Repository layout

```text
backend/
  alert_parser.py       Alert normalization and MITRE ATT&CK mappings
  data/
    documents/          Sample JSON runbooks, advisories, and threat intelligence
    submissions.json    Local feedback, escalation, and flag submissions
  document_loader.py    Loads documents and creates searchable mitigation chunks
  entity_extractor.py   Heuristic host, process, severity, and technique extraction
  main.py               FastAPI routes, document ingestion, and optional SPA serving
  requirements.txt      Python dependencies
  schemas.py            Pydantic request and response models
  search_engine.py      TF-IDF ranking, technique boosts, and stale-document penalty
  test_api.py           API and endpoint tests
  test_parse_retrieve.py Alert parsing, retrieval, upload, and API tests
  test_search_engine.py Search and entity-extraction tests
src/
  api.js                Frontend API client and response normalization
  components/           Shared UI, conflict-warning, and evidence-viewer components
  data/                 Sample alerts, documents, and demonstration data
  pages/                Search, confirmation, results, and knowledge-base screens
  App.jsx               Client-side route configuration
  main.jsx              Frontend entry point
```

## Local data and limitations

- The backend reads JSON documents from `backend/data/documents` at startup. API uploads write new JSON files there and rebuild the in-memory search index.
- Feedback, escalation, and runbook-flag submissions are stored locally in `backend/data/submissions.json`; there is no external database.
- CVE feed status is simulated; the project does not poll NVD or another external feed.
- Entity extraction uses configured patterns and mappings. Retrieval is local TF-IDF search. Both are deterministic and should be reviewed by an analyst.
