"""
SENTRY-IR Core Search Engine & Entity Extractor Test Suite
Validates all Task 2 requirements:
- Entity Extraction (Host, Process, Technique, Severity)
- TF-IDF and Keyword Matching
- MITRE Technique Boosting
- Relevance Threshold & No-Result Handling
- Empty and Invalid Input Handling
- Result Structure and Citation Preservation
"""

import sys
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import unittest
from backend.document_loader import kb_repo
from backend.entity_extractor import (
    extract_entities,
    extract_host,
    extract_process,
    extract_technique,
    extract_severity,
)
from backend.search_engine import SearchEngine, search, DEFAULT_RELEVANCE_THRESHOLD


class TestEntityExtractor(unittest.TestCase):
    """Unit tests for heuristic entity extraction."""

    def test_host_patterns(self):
        cases = [
            ("Alert on HOST-042", "HOST-042"),
            ("Compromised machine WORKSTATION-17 detected", "WORKSTATION-17"),
            ("Host: SERVER-01 is unreachable", "SERVER-01"),
            ("hostname=DC-01", "DC-01"),
            ("Targeting WIN-CLIENT-22 endpoint", "WIN-CLIENT-22"),
            ("Investigating FIN-WS-07", "FIN-WS-07"),
            ("High traffic on WEB-SRV-12", "WEB-SRV-12"),
            ("General query with no host", None),
        ]
        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(extract_host(query), expected)

    def test_process_patterns(self):
        cases = [
            ("Using mimikatz to dump memory", "mimikatz"),
            ("Executed powershell.exe with base64 payload", "powershell.exe"),
            ("process: rundll32.exe", "rundll32.exe"),
            ("proc=vssadmin.exe", "vssadmin.exe"),
            ("Running sshd on bastion host", "sshd"),
            ("Process: dns.exe", "dns.exe"),
            ("Executing comsvcs.dll export", "comsvcs.dll"),
            ("No process in this sentence", None),
        ]
        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(extract_process(query), expected)

    def test_severity_patterns(self):
        cases = [
            ("Severity: Critical detected", "critical"),
            ("severity=high", "high"),
            ("High severity alert", "high"),
            ("Priority: Medium", "medium"),
            ("severity is low", "low"),
            ("Severity: Info", "informational"),
            ("Severity: Informational", "informational"),
            ("No severity specified", None),
        ]
        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(extract_severity(query), expected)

    def test_technique_patterns(self):
        cases = [
            ("Explicit ID T1003.001 detected", "T1003.001"),
            ("Detected T1071.004 command and control", "T1071.004"),
            ("Inferred ransomware activity", "T1486"),
            ("Inferred DNS tunneling over TXT queries", "T1071.004"),
            ("LSASS credential dumping using mimikatz", "T1003.001"),
            ("What is the capital of France?", None),
        ]
        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(extract_technique(query), expected)


class TestSearchEngine(unittest.TestCase):
    """Core search engine scenario tests required by Task 2."""

    @classmethod
    def setUpClass(cls):
        cls.engine = SearchEngine(kb_repo)

    def test_scenario_1_credential_dumping(self):
        """TEST 1 — Credential Dumping"""
        query = "Suspicious LSASS access detected on HOST-042 using mimikatz. Possible credential dumping."
        result = self.engine.search(query)

        self.assertEqual(result["status"], "success")
        self.assertGreater(result["total_matches"], 0)
        self.assertLessEqual(len(result["results"]), 5)

        # Check entity extraction
        self.assertEqual(result["entities"]["host"], "HOST-042")
        self.assertEqual(result["entities"]["process"], "mimikatz")
        self.assertEqual(result["entities"]["technique"], "T1003.001")

        # Top results must be credential theft related
        top_result = result["results"][0]
        self.assertEqual(top_result["document_id"], "IR-Runbook-Credential-Theft")
        self.assertTrue(any("T1003" in t for t in top_result["techniques"]))
        self.assertTrue(len(top_result["citation"]) > 0)
        self.assertGreaterEqual(top_result["score"], DEFAULT_RELEVANCE_THRESHOLD)

    def test_scenario_2_ransomware(self):
        """TEST 2 — Ransomware"""
        query = "Ransomware has encrypted files on the affected workstation. How should I contain the host?"
        result = self.engine.search(query)

        self.assertEqual(result["status"], "success")
        self.assertGreater(result["total_matches"], 0)

        # Inferred technique should be T1486
        self.assertEqual(result["entities"]["technique"], "T1486")

        # Top result should be ransomware advisory containment
        top_result = result["results"][0]
        self.assertEqual(top_result["document_id"], "CISA-AA23-347A-Ransomware")
        self.assertIn("T1486", top_result["techniques"])
        self.assertTrue(len(top_result["citation"]) > 0)
        self.assertIn("isolate", top_result["title"].lower())

    def test_scenario_3_dns_demo_alert_returns_no_result(self):
        """DNS tunneling is intentionally outside the sample knowledge base."""
        query = "Anomalous DNS tunneling over port 53"
        result = self.engine.search(query)

        self.assertEqual(result["status"], "no_result")
        self.assertEqual(result["results"], [])

    def test_scenario_4_phishing(self):
        """TEST 4 — Phishing with OAuth session revocation"""
        query = "A phishing email caused a user to click a malicious link. Revoke the compromised OAuth session."
        result = self.engine.search(query)

        self.assertEqual(result["status"], "success")
        self.assertGreater(result["total_matches"], 0)

        # Phishing response document appears in results
        doc_ids = [r["document_id"] for r in result["results"]]
        self.assertIn("IR-Runbook-Phishing-Response", doc_ids)

        # OAuth session revocation mitigation is highly ranked (top 2)
        top_titles = [r["title"].lower() for r in result["results"][:2]]
        has_revocation = any("revoke" in t and "session" in t for t in top_titles)
        self.assertTrue(has_revocation, "OAuth/session revocation step should be ranked in top 2")

    def test_scenario_5_explicit_mitre_id(self):
        """TEST 5 — Explicit MITRE ID"""
        query = "T1003.001 LSASS credential dumping"
        result = self.engine.search(query)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["entities"]["technique"], "T1003.001")

        # Top results must belong to credential-theft or threat-intel T1003.001
        top_result = result["results"][0]
        self.assertIn("T1003.001", top_result["techniques"])
        self.assertIn(top_result["document_id"], ["IR-Runbook-Credential-Theft", "Threat-Intel-2025-14"])

    def test_scenario_6_negative_query(self):
        """TEST 6 — Negative Query (Irrelevant query returns no_result)"""
        query = "What is the capital of France?"
        result = self.engine.search(query)

        self.assertEqual(result["status"], "no_result")
        self.assertEqual(result["results"], [])
        self.assertEqual(result["total_matches"], 0)

    def test_scenario_6b_another_negative_query(self):
        """Negative Query 2 — Generic irrelevant chatter"""
        query = "Tell me a joke about football"
        result = self.engine.search(query)

        self.assertEqual(result["status"], "no_result")
        self.assertEqual(result["results"], [])

    def test_scenario_7_empty_and_whitespace_input(self):
        """TEST 7 — Empty / Invalid Input handling without crashing"""
        for empty_q in ["", "   ", "\t\n  "]:
            with self.subTest(query=repr(empty_q)):
                result = self.engine.search(empty_q)
                self.assertEqual(result["status"], "no_result")
                self.assertEqual(result["results"], [])
                self.assertEqual(result["total_matches"], 0)
                self.assertIsNone(result["entities"]["host"])
                self.assertIsNone(result["entities"]["process"])

    def test_result_structure_and_top_k(self):
        """Verifies output format matches frontend and requirements."""
        query = "Investigate Sysmon Event ID 10 for credential access"
        result = self.engine.search(query, top_k=3)

        self.assertEqual(result["status"], "success")
        self.assertLessEqual(len(result["results"]), 3)

        first = result["results"][0]
        # Required fields
        for field in ["id", "title", "step_title", "description", "step_text", "phase", "document_id", "doc_id", "citation", "techniques", "score"]:
            self.assertIn(field, first, f"Missing required result field: {field}")

        self.assertIsInstance(first["score"], float)
        self.assertGreater(first["score"], 0.0)
        self.assertLessEqual(first["score"], 1.0)


def print_scenario_summary(title: str, query: str, res: dict):
    print(f"\n{'='*75}")
    print(f"SCENARIO: {title}")
    print(f"QUERY   : \"{query}\"")
    print(f"STATUS  : {res['status']}")
    print(f"ENTITIES: host={res['entities']['host']}, proc={res['entities']['process']}, tech={res['entities']['technique']}, sev={res['entities']['severity']}")
    print(f"LATENCY : {res['latency_ms']} ms | TOTAL MATCHES: {res['total_matches']}")
    if res["results"]:
        print(f"TOP RESULTS ({len(res['results'])} returned):")
        for i, r in enumerate(res["results"], 1):
            print(f"  {i}. [{r['phase']}] {r['title']}")
            print(f"     Source: {r['document_id']} | Citation: {r['citation']} | Tech: {r['techniques']} | Score: {r['score']}")
    else:
        print("  (No results returned)")


def run_all_tests():
    print("=" * 75)
    print("=== SENTRY-IR CORE SEARCH ENGINE & ENTITY EXTRACTOR VERIFICATION ===")
    print("=" * 75)

    suite = unittest.TestLoader().loadTestsFromTestCase(TestEntityExtractor)
    suite.addTests(unittest.TestLoader().loadTestsFromTestCase(TestSearchEngine))
    runner = unittest.TextTestRunner(verbosity=2)
    test_result = runner.run(suite)

    # Detailed scenario printout
    print("\n" + "=" * 75)
    print("=== DETAILED TEST SCENARIO OUTPUTS ===")
    
    test_cases = [
        ("Credential Dumping", "Suspicious LSASS access detected on HOST-042 using mimikatz. Possible credential dumping."),
        ("Ransomware", "Ransomware has encrypted files on the affected workstation. How should I contain the host?"),
        ("DNS demo alert", "Anomalous DNS tunneling over port 53"),
        ("Phishing", "A phishing email caused a user to click a malicious link. Revoke the compromised OAuth session."),
        ("Explicit MITRE ID", "T1003.001 LSASS credential dumping"),
        ("Negative Query", "What is the capital of France?"),
        ("Empty Query", ""),
    ]

    for title, q in test_cases:
        res = search(q)
        print_scenario_summary(title, q, res)

    print("\n" + "=" * 75)
    if test_result.wasSuccessful():
        print(">>> ALL TESTS PASSED SUCCESSFULLY! Task 2 verified. <<<")
    else:
        print(">>> SOME TESTS FAILED! Check traceback above. <<<")
    print("=" * 75 + "\n")

    return 0 if test_result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
