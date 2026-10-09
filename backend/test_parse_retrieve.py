"""API and retrieval coverage for the sample alert workflow."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.document_loader import kb_repo
from backend.entity_extractor import extract_technique
from backend.main import app
from backend.search_engine import search

client = TestClient(app)


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


def test_retrieve_groups_results_and_reports_sources():
    response = client.post(
        "/api/retrieve",
        json={"rule": "Suspicious LSASS Access", "host": "HOST-042"},
    )

    assert response.status_code == 200
    result = response.json()
    assert set(result["results"]) == {"Immediate", "Investigate", "Recover"}
    assert result["results"]["Immediate"]
    assert result["conflicts"] == []
    assert result["retrievalSeconds"] >= 0
    assert "IR-Runbook-Credential-Theft" in result["sourcesMatched"]
    assert result["results"]["Immediate"][0]["confidence"] in {"High", "Medium", "Low"}


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
