"""
SENTRY-IR FastAPI Backend API Tests
Validates all Task 3 API requirements using FastAPI TestClient:
- POST /api/search (success, no_result, validation errors)
- GET /api/documents (document list)
- GET /api/documents/{id} (document details, 404 handling)
- CORS headers
- OpenAPI documentation
"""

import sys
import unittest
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient
from backend.main import app
from backend.document_loader import kb_repo


class TestFastAPIBackend(unittest.TestCase):
    """Test suite for SENTRY-IR FastAPI endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root_health(self):
        """Verifies health check endpoint."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("documents_indexed"), len(kb_repo.get_all_documents()))

    def test_openapi_schema(self):
        """Verifies OpenAPI schema is exposed and contains required endpoints."""
        res = self.client.get("/openapi.json")
        self.assertEqual(res.status_code, 200)
        schema = res.json()
        paths = schema.get("paths", {})
        self.assertIn("/api/search", paths)
        self.assertIn("/api/documents", paths)
        self.assertIn("/api/documents/{doc_id}", paths)

    def test_1_search_success(self):
        """TEST 1 — Search success with credential dumping query."""
        payload = {
            "query": "Suspicious LSASS access detected on HOST-042 using mimikatz. Possible credential dumping."
        }
        res = self.client.post("/api/search", json=payload)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertGreater(data["total_matches"], 0)
        self.assertGreater(len(data["results"]), 0)

        # Entity extraction verification
        entities = data["entities"]
        self.assertIsNotNone(entities)
        self.assertEqual(entities.get("host"), "HOST-042")
        self.assertEqual(entities.get("process"), "mimikatz")
        self.assertEqual(entities.get("technique"), "T1003.001")

        # Top result verification
        top = data["results"][0]
        self.assertEqual(top["document_id"], "IR-Runbook-Credential-Theft")
        self.assertIn("T1003.001", top["techniques"])
        self.assertIn(
            top["citation"],
            {"Threat-Intel-2025-14 p.4", "Threat-Intel-2025-14 p.6"},
        )
        self.assertGreater(top["score"], 0.15)
        self.assertIn("latency_ms", data)

    def test_2_search_no_result(self):
        """TEST 2 — Irrelevant query returns HTTP 200 with no_result status."""
        payload = {
            "query": "What is the capital of France?"
        }
        res = self.client.post("/api/search", json=payload)
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data["status"], "no_result")
        self.assertEqual(data["results"], [])
        self.assertEqual(data["total_matches"], 0)

    def test_3_empty_and_invalid_query(self):
        """TEST 3 — Empty, whitespace, or missing query returns HTTP 422."""
        # Empty string
        res_empty = self.client.post("/api/search", json={"query": ""})
        self.assertEqual(res_empty.status_code, 422)

        # Whitespace-only string
        res_ws = self.client.post("/api/search", json={"query": "   \n\t  "})
        self.assertEqual(res_ws.status_code, 422)

        # Missing query key
        res_missing = self.client.post("/api/search", json={})
        self.assertEqual(res_missing.status_code, 422)

    def test_4_documents_list(self):
        """TEST 4 — GET /api/documents returns all indexed documents."""
        res = self.client.get("/api/documents")
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertIn("documents", data)
        self.assertEqual(len(data["documents"]), len(kb_repo.get_all_documents()))
        self.assertEqual(data["total"], len(kb_repo.get_all_documents()))

        # Check required fields on documents
        doc_ids = [d["id"] for d in data["documents"]]
        self.assertIn("IR-Runbook-Credential-Theft", doc_ids)
        self.assertIn("CISA-AA23-347A-Ransomware", doc_ids)
        self.assertNotIn("IR-Playbook-DNS-Tunneling", doc_ids)

        first = data["documents"][0]
        for field in ["id", "title", "type", "version", "chunks", "status"]:
            self.assertIn(field, first)

    def test_5_existing_document(self):
        """TEST 5 — GET /api/documents/{id} returns full document detail."""
        doc_id = "IR-Runbook-Credential-Theft"
        res = self.client.get(f"/api/documents/{doc_id}")
        self.assertEqual(res.status_code, 200)

        data = res.json()
        self.assertEqual(data["id"], doc_id)
        self.assertEqual(data["title"], "IR-Runbook-Credential-Theft")
        self.assertTrue(len(data["content"]) > 0)
        self.assertIn("steps", data)
        self.assertGreater(len(data["steps"]), 0)

    def test_6_missing_document(self):
        """TEST 6 — GET /api/documents/does-not-exist returns HTTP 404."""
        res = self.client.get("/api/documents/does-not-exist")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data.get("detail"), "Document not found")

    def test_7_cors_headers(self):
        """TEST 7 — Verifies CORS headers for React/Vite development origin."""
        origin = "http://localhost:5173"
        # Test preflight OPTIONS request
        res = self.client.options(
            "/api/search",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(res.headers.get("access-control-allow-origin"), origin)

        # Test normal GET with origin header
        res_get = self.client.get("/api/documents", headers={"Origin": origin})
        self.assertEqual(res_get.headers.get("access-control-allow-origin"), origin)

    def test_additional_ransomware_search(self):
        """Additional check: Ransomware scenario through the API."""
        payload = {
            "query": "Ransomware has encrypted files on the affected workstation. How should I contain the host?"
        }
        res = self.client.post("/api/search", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["entities"]["technique"], "T1486")
        self.assertEqual(data["results"][0]["document_id"], "CISA-AA23-347A-Ransomware")

    def test_dns_tunneling_demo_alert_returns_no_result(self):
        """DNS tunneling is intentionally outside the sample knowledge base."""
        payload = {
            "query": "Anomalous DNS tunneling over port 53"
        }
        res = self.client.post("/api/search", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "no_result")
        self.assertEqual(data["results"], [])


def run_api_tests():
    print("=" * 75)
    print("=== SENTRY-IR FASTAPI BACKEND API VERIFICATION ===")
    print("=" * 75)

    suite = unittest.TestLoader().loadTestsFromTestCase(TestFastAPIBackend)
    runner = unittest.TextTestRunner(verbosity=2)
    test_result = runner.run(suite)

    print("\n" + "=" * 75)
    if test_result.wasSuccessful():
        print(">>> ALL API TESTS PASSED SUCCESSFULLY! Task 3 verified. <<<")
    else:
        print(">>> SOME API TESTS FAILED! Check traceback above. <<<")
    print("=" * 75 + "\n")

    return 0 if test_result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_api_tests())
