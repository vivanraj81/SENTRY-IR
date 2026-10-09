# SENTRY-IR: Mitigation Retrieval

SENTRY-IR is a polished, production-quality frontend application designed as an internal Security Operations Center (SOC) analyst tool. Its purpose is to streamline incident response workflows by rapidly retrieving context-specific mitigation steps for security alerts.

## Overview
When a security alert is triggered, an analyst can paste the raw alert into SENTRY-IR. The system extracts the important entities, searches a local knowledge base (runbooks, playbooks, threat intelligence), and returns the exact mitigation steps complete with document citations.

This application is built with a focused, dark "enterprise SOC investigation console" aesthetic, ensuring it is minimal, dense, and readable—without unnecessary gradients, animations, or visual noise.

## Features
- **Alert Ingestion**: Paste raw security alerts (JSON) to automatically extract entities like Host, Process, and MITRE Techniques.
- **Mitigation Retrieval**: Get immediate, step-by-step mitigation guidance categorized by urgency (e.g., Immediate, Investigate, Recover).
- **Document Citations**: Every mitigation step includes a direct citation to the source document for verification and trust.
- **Conflict Detection**: Automatically detects and highlights conflicting guidance between multiple knowledge sources (e.g., legacy vs. updated runbooks).
- **Evidence Panels**: Deep dive into the source documents with dedicated detail panels.
- **Knowledge Base Inventory**: View ingested documents, parsing status, and simulated CVE feed syncs.

## Technology Stack
- **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router](https://reactrouter.com/)

The application includes a FastAPI backend for searching the local knowledge base and retrieving its documents. It does not integrate with a real SIEM, external database, or AI API.

## Getting Started

### Backend

From the repository root, install the Python dependencies and start the API:

```bash
python -m pip install fastapi uvicorn
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

### Frontend

In a separate terminal, from the repository root:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173/`.
