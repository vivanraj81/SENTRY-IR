# SENTRY-IR: Mitigation Retrieval

SENTRY-IR is a local-first incident-response workspace. Analysts submit a raw alert or plain-language question; the React frontend sends it to a FastAPI backend, which retrieves relevant response steps from the indexed runbooks and advisories. Results include phase, confidence, source citations, and warnings when the current and legacy guidance conflict. The knowledge-base screen supports document upload and displays index status.

## Run locally

Use Python 3.10 or newer and Node.js 22.12+ (or 20.19+).

### Backend

From the repository root, create and activate a virtual environment, install backend dependencies, and start the API:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```

If PowerShell blocks script activation, run the environment's Python directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000 --reload
```

The API docs are at `http://localhost:8000/docs`.

### Frontend

In a second terminal, from the repository root:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:8000`. The API uses relative `/api` URLs, so the built frontend uses the same origin as the backend.

### Tests and production build

```powershell
python -m pytest backend
npm.cmd run lint
npm.cmd run build
```

## How search works

The backend splits each knowledge-base document into phase-labelled sections and represents the text with scikit-learn TF-IDF features for unigrams and bigrams. It compares the alert or question with those sections using cosine similarity and applies a boost when the alert's MITRE technique matches the section. Results below the configured relevance threshold are excluded; the strongest matches are returned with citations to the original documents. This is deterministic keyword retrieval, not an embedding model or an external AI service.

## Demo script

Submit these as raw alert text or questions from the intake screen:

1. **Suspicious LSASS Access** — `{"detection":"Suspicious LSASS Access","host":"FIN-WS-07","process":"rundll32.exe","rule":"Sigma_T1003_001"}`. Expect immediate isolation and memory-preservation steps, Sysmon investigation guidance, credential recovery, and a conflict between the 2026 credential-theft runbook and the 2024 legacy playbook.
2. **Encoded PowerShell Command** — `{"detection":"Encoded PowerShell","host":"FIN-WS-07","process":"powershell.exe","rule":"Sigma_T1059_001"}`. Expect malicious PowerShell investigation and containment guidance.
3. **Outbound SMB to rare IP** — `{"detection":"Outbound SMB to rare IP","host":"FIN-WS-07","process":"System","rule":"Sigma_T1021_002"}`. Expect lateral-movement and SMB containment guidance.
4. **Brute force** — `T1110 password spray account compromise`. Expect brute-force response steps.
5. **DNS tunneling** — `Anomalous DNS tunneling over port 53`. Expect the no-mitigation empty state because no matching DNS runbook is indexed.

From a populated result, open a citation to inspect its excerpt and highlighted sentence, open the full document, review the conflict cards, and submit feedback. The **Knowledge Base** page at `/admin` lists indexed documents and supports `.txt`, `.md`, `.pdf`, and `.docx` uploads (up to 10 MB).

## Deploy on Render

Create a Render Web Service for this repository. Use:

- **Build command:** `npm install && npm run build && pip install -r backend/requirements.txt`
- **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

Render supplies `PORT`, which enables FastAPI to serve `dist/` when the frontend has been built; API routes remain under `/api`, and client-side routes such as `/admin` receive the SPA entry point. To enable this behavior in another deployment environment, set `SENTRY_SERVE_FRONTEND=1`. The free Render instance sleeps when idle; open the site before the demo so it has time to wake up.
