"""API and retrieval coverage for the sample alert workflow."""

import io
import json
import shutil
import sys
from pathlib import Path

import pytest
from docx import Document as DocxDocument
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend import main as api
from backend.document_loader import kb_repo
from backend.entity_extractor import extract_technique
from backend.main import app
from backend.search_engine import default_search_engine, search

client = TestClient(app)


@pytest.fixture
def isolated_kb(monkeypatch, tmp_path):
    original_dir = kb_repo.docs_dir
    test_dir = tmp_path / "documents"
    test_dir.mkdir()
    for source in original_dir.glob("*.json"):
        shutil.copy2(source, test_dir / source.name)
    monkeypatch.setattr(api, "DOCUMENTS_DIR", test_dir)
    kb_repo.docs_dir = test_dir
    kb_repo.reload()
    default_search_engine.build_index()
    yield
    kb_repo.docs_dir = original_dir
    kb_repo.reload()
    default_search_engine.build_index()


@pytest.mark.parametrize(
    ("alert", "technique"),
    [
        ("Suspicious LSASS Access on HOST-042", "T1003.001"),
        ("Encoded PowerShell command on HOST-042", "T1059.001"),
        ("Outbound SMB to rare IP from HOST-042", "T1021.002"),
    ],
)
def test_extractor_maps_sample_alerts(alert, technique):
    assert extract_technique(alert) == technique


@pytest.mark.parametrize(
    ("alert", "technique", "name", "severity"),
    [
        (
            "Suspicious LSASS Access on HOST-042",
            "T1003.001",
            "OS Credential Dumping: LSASS Memory",
            "Critical",
        ),
        ("Encoded PowerShell command", "T1059.001", "PowerShell", "High"),
        (
            "Outbound SMB to rare IP",
            "T1021.002",
            "SMB/Windows Admin Shares",
            "High",
        ),
    ],
)
def test_parse_maps_sample_alerts(alert, technique, name, severity):
    response = client.post("/api/parse", content=alert, headers={"content-type": "text/plain"})

    assert response.status_code == 200
    parsed = response.json()
    assert parsed["technique"] == technique
    assert parsed["techniqueName"] == name
    assert parsed["severity"] == severity


def test_parse_flattens_nested_json_input():
    response = client.post(
        "/api/parse",
        json={
            "event": {
                "rule": {"name": "Suspicious LSASS Access"},
                "host": "HOST-042",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["technique"] == "T1003.001"
    assert response.json()["host"] == "HOST-042"


@pytest.mark.parametrize(
    ("content", "headers", "status_code"),
    [
        (b"", {"content-type": "text/plain"}, 422),
        (b'{"alert": ""}', {"content-type": "application/json"}, 422),
        (b"{bad json", {"content-type": "application/json"}, 400),
    ],
)
def test_parse_rejects_empty_or_malformed_input(content, headers, status_code):
    response = client.post("/api/parse", content=content, headers=headers)
    assert response.status_code == status_code


def test_retrieve_returns_contract_steps_and_sources():
    response = client.post(
        "/api/retrieve",
        json={"rule": "Suspicious LSASS Access", "host": "HOST-042"},
    )

    assert response.status_code == 200
    result = response.json()
    assert len(result["steps"]) > 0
    assert set(result) == {
        "steps",
        "confidence",
        "retrievalSeconds",
        "sourcesMatched",
        "conflicts",
    }
    step = result["steps"][0]
    assert set(step) == {"phase", "order", "title", "description", "score", "citation"}
    assert set(step["citation"]) == {
        "docId",
        "docName",
        "section",
        "sectionTitle",
        "version",
        "date",
    }
    assert result["retrievalSeconds"] >= 0
    assert "IR-Runbook-Credential-Theft" in result["sourcesMatched"]
    assert result["confidence"] in {"High", "Medium", "Low"}


def test_retrieve_groups_results_and_reports_sources():
    response = client.post(
        "/api/retrieve",
        json={"rule": "Suspicious LSASS Access", "host": "HOST-042"},
    )

    assert response.status_code == 200
    result = response.json()
    phases = {step["phase"] for step in result["steps"]}
    assert phases.intersection({"Immediate", "Investigate", "Recover"})
    assert result["conflicts"]
    assert result["retrievalSeconds"] >= 0
    assert "IR-Runbook-Credential-Theft" in result["sourcesMatched"]


def test_lsass_retrieve_reports_legacy_conflict_and_flags_old_document():
    response = client.post(
        "/api/retrieve",
        json={"entities": {"technique": "T1003.001", "host": "HOST-042"}},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["conflicts"]
    conflict = next(
        item
        for item in result["conflicts"]
        if item["newer"]["docName"] == "IR-Runbook-Credential-Theft"
        and item["older"]["docName"] == "Legacy-IR-Playbook-2024"
    )
    assert conflict["newer"]["version"] == "v3.2"
    assert conflict["newer"]["date"] == "Aug 14, 2026"
    assert conflict["older"]["version"] == "v1.4"
    assert conflict["older"]["date"] == "Mar 2, 2024"
    assert "within 30 minutes" in conflict["older"]["quote"]
    assert "power down" in conflict["older"]["quote"]
    legacy = next(
        item for item in client.get("/api/documents").json()
        if item["id"] == "Legacy-IR-Playbook-2024"
    )
    assert legacy["status"] == "Stale — flagged"


def test_section_evidence_endpoint_returns_highlighted_excerpt():
    response = client.get(
        "/api/documents/IR-Runbook-Credential-Theft/sections/3.1"
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {
        "docName",
        "sectionTitle",
        "version",
        "date",
        "owner",
        "text",
        "highlight",
    }
    assert data["sectionTitle"] == "Isolate the affected host"
    assert data["highlight"] in data["text"]


def test_kb_stats_match_indexed_documents_and_chunks():
    stats = client.get("/api/kb/stats").json()
    assert stats["documentCount"] == len(kb_repo.get_all_documents())
    assert stats["chunksIndexed"] == len(kb_repo.get_all_chunks())
    assert stats["parsingQueueCount"] == 0
    assert stats["cveFeedSync"] == "12m ago"


def _make_pdf(text):
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {NameObject("/F1"): font}
            )
        }
    )
    stream = DecodedStreamObject()
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream.set_data(f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize(
    ("filename", "contents", "content_type"),
    [
        ("response.txt", b"Contain the host.\n\nReview event logs.", "text/plain"),
        ("response.md", b"## Response\n\nReview the affected account.", "text/markdown"),
        ("response.pdf", _make_pdf("Review the affected host."), "application/pdf"),
    ],
)
def test_upload_indexes_supported_documents(
    isolated_kb, filename, contents, content_type
):
    response = client.post(
        "/api/documents",
        files={"file": (filename, contents, content_type)},
    )

    assert response.status_code == 201
    document = response.json()
    assert document["name"] == Path(filename).stem
    assert document["status"] == "Indexed"
    assert document["chunks"] > 0
    assert kb_repo.get_document(document["id"]) is not None
    assert default_search_engine.chunks


def test_upload_indexes_docx_and_validates_type_and_size(isolated_kb):
    source = DocxDocument()
    source.add_paragraph("Review the affected account.")
    output = io.BytesIO()
    source.save(output)

    uploaded = client.post(
        "/api/documents",
        files={"file": ("response.docx", output.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert uploaded.status_code == 201
    assert uploaded.json()["chunks"] == 1

    unsupported = client.post(
        "/api/documents",
        files={"file": ("response.exe", b"not a document", "application/octet-stream")},
    )
    assert unsupported.status_code == 415
    oversized = client.post(
        "/api/documents",
        files={"file": ("large.txt", b"x" * (api.MAX_UPLOAD_BYTES + 1), "text/plain")},
    )
    assert oversized.status_code == 413


def test_feedback_escalations_and_flags_are_saved(monkeypatch, tmp_path):
    monkeypatch.setattr(api, "SUBMISSIONS_PATH", tmp_path / "submissions.json")

    feedback = client.post(
        "/api/feedback",
        json={"alertId": "alert-1", "helpful": True},
    )
    escalation = client.post(
        "/api/escalations",
        json={"alertId": "alert-1", "reason": "Needs analyst review"},
    )
    flag = client.post(
        "/api/runbook-flags",
        json={"docId": "IR-Runbook-Credential-Theft", "reason": "Review wording"},
    )

    assert feedback.status_code == 201
    assert escalation.status_code == 201
    assert flag.status_code == 201
    saved = json.loads((tmp_path / "submissions.json").read_text(encoding="utf-8"))
    assert [record["type"] for record in saved] == [
        "feedback",
        "escalation",
        "runbook-flag",
    ]
    assert flag.json()["document"]["status"] == "Stale — flagged"


def test_search_returns_no_results_for_unrelated_queries():
    for query in ("Anomalous DNS tunneling over port 53", "best pizza recipe"):
        result = search(query)
        assert result["status"] == "no_result"
        assert result["results"] == []


def test_empty_retrieve_request_is_rejected():
    response = client.post("/api/retrieve", json={})
    assert response.status_code == 422


def test_documents_are_sectioned_and_dns_document_is_absent():
    documents = kb_repo.get_all_documents()
    assert len(documents) >= 8
    assert all(document.date for document in documents)
    assert "IR-Playbook-DNS-Tunneling" not in {
        document.id for document in documents
    }

    chunks = kb_repo.get_all_chunks()
    assert len({chunk.id for chunk in chunks}) == len(chunks)
    assert all(chunk.phase in {"Immediate", "Investigate", "Recover"} for chunk in chunks)
    credential_doc = kb_repo.get_document("IR-Runbook-Credential-Theft")
    assert credential_doc is not None
    assert len(credential_doc.steps) == 5
    assert credential_doc.steps[2]["citation"] == "Threat-Intel-2025-14 p.4"
    assert credential_doc.steps[3]["citation"] == "Threat-Intel-2025-14 p.6"


def test_openapi_documents_parse_and_retrieve_routes():
    schema = client.get("/openapi.json").json()
    assert "/api/parse" in schema["paths"]
    assert "/api/retrieve" in schema["paths"]
    assert "application/json" in schema["paths"]["/api/parse"]["post"]["requestBody"]["content"]
