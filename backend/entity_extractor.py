"""
SENTRY-IR Heuristic Entity Extractor
Extracts security entities (Host, Process, MITRE Technique, Severity) from raw security alerts and queries.
Deterministic, lightweight, no LLM required.
"""

import re
from typing import Dict, Optional, List, Any


# Known processes from security runbooks and advisories
KNOWN_PROCESSES = [
    "mimikatz.exe", "mimikatz",
    "powershell.exe", "powershell",
    "rundll32.exe", "rundll32",
    "comsvcs.dll", "comsvcs",
    "vssadmin.exe", "vssadmin",
    "bcdedit.exe", "bcdedit",
    "certutil.exe", "certutil",
    "mshta.exe", "mshta",
    "procdump.exe", "procdump",
    "nanodump.exe", "nanodump",
    "wmic.exe", "wmic",
    "lsass.exe", "lsass",
    "dns.exe",
    "sshd.exe", "sshd",
    "cmd.exe",
]

# High-confidence mappings from security concepts to MITRE techniques
# Ordered by specificity (sub-techniques first)
CONCEPT_TECHNIQUE_MAPPINGS = [
    (r"\b(?:lsass\s+access|lsass\s+memory|mimikatz|comsvcs|minidump|procdump|nanodump)\b", "T1003.001"),
    (r"\b(?:credential\s+dumping|credential\s+theft|os\s+credential|ntds\.dit|krbtgt)\b", "T1003"),
    (r"\b(?:dns\s+tunneling|txt\s+record|txt\s+queries|high-entropy\s+dns|dns\s+c2)\b", "T1071.004"),
    (r"\b(?:dns\s+exfiltration|exfiltration\s+over\s+dns)\b", "T1048.003"),
    (r"\b(?:vssadmin|shadow\s*copy|recoveryenabled|bcdedit)\b", "T1490"),
    (r"\b(?:ransomware|encrypted\s+files|file\s+renaming\s+activity|lateral\s+encryption)\b", "T1486"),
    (r"\b(?:phishing\s+link|malicious\s+link|clicked\s+(?:a\s+)?(?:malicious\s+)?link)\b", "T1566.002"),
    (r"\b(?:phishing\s+attachment|malicious\s+attachment|weaponized\s+attachment)\b", "T1566.001"),
    (r"\b(?:phishing\s+email|phishing\s+campaign|spearphishing|phishing)\b", "T1566"),
    (r"\b(?:xz-utils|liblzma|cve-2024-3094|upstream\s+backdoor|supply\s+chain)\b", "T1195.001"),
    (r"\b(?:rundll32|lolbin|lolbins|certutil|mshta)\b", "T1218.011"),
    (r"\b(?:oauth\s+session|oauth\s+token|refresh\s+token|valid\s+accounts)\b", "T1078"),
]


def extract_host(text: str) -> Optional[str]:
    """
    Extract hostname from raw alert text using explicit prefixes and common host naming conventions.
    Examples: HOST-042, WORKSTATION-17, SERVER-01, DC-01, WIN-CLIENT-22, FIN-WS-07.
    """
    if not text:
        return None

    # 1. Look for explicit host prefixes: host: HOST-042, hostname=HOST-042, machine HOST-042
    prefix_match = re.search(
        r"\b(?:host(?:name)?|machine|endpoint|device|system)\s*[:=]\s*([A-Za-z0-9_-]+)",
        text,
        re.IGNORECASE,
    )
    if prefix_match:
        val = prefix_match.group(1).strip()
        if not _is_excluded_host(val):
            return val

    # 2. Look for prepositional host indicators: on HOST-042, on machine HOST-042
    prep_match = re.search(
        r"\b(?:on|at|against)\s+(?:host\s+|endpoint\s+|machine\s+|workstation\s+|server\s+)?([A-Za-z0-9]{2,20}(?:-[A-Za-z0-9]{1,15})*-\d{1,4})\b",
        text,
        re.IGNORECASE,
    )
    if prep_match:
        val = prep_match.group(1).strip()
        if not _is_excluded_host(val):
            return val

    # 3. Look for standard enterprise host naming schemes (e.g., HOST-042, FIN-WS-07, DC-01, SERVER-01)
    general_matches = re.findall(
        r"\b([A-Z0-9]{2,20}(?:-[A-Z0-9]{1,15})*-\d{1,4})\b",
        text,
    )
    for match in general_matches:
        if not _is_excluded_host(match):
            return match

    return None


def _is_excluded_host(val: str) -> bool:
    """Helper to reject MITRE codes, CVEs, or runbook IDs falsely matching host regex."""
    upper = val.upper()
    prefixes = ("CVE-", "T1", "T0", "SHA-", "AES-", "IR-", "CISA-", "EVENT-", "ID-", "KB-", "SIGMA-")
    if any(upper.startswith(p) for p in prefixes):
        return True
    # If the token contains no letters (pure numbers with dashes)
    if not any(c.isalpha() for c in val):
        return True
    return False


def extract_process(text: str) -> Optional[str]:
    """
    Extract process name from alert text using explicit syntax, execution verbs,
    or direct matching against known security binaries.
    """
    if not text:
        return None

    # 1. Look for explicit key-value indicators: process: mimikatz, proc=powershell.exe
    prefix_match = re.search(
        r"\b(?:process|proc|binary|executable)\s*[:=]\s*([A-Za-z0-9_.-]+)",
        text,
        re.IGNORECASE,
    )
    if prefix_match:
        proc_cand = prefix_match.group(1).strip()
        # Clean trailing punctuation
        proc_cand = proc_cand.rstrip(".,;:")
        return proc_cand.lower()

    # 2. Look for action verbs: executed mimikatz, running powershell.exe, using mimikatz
    verb_match = re.search(
        r"\b(?:executed|executing|running|spawned|killed|using|via)\s+([A-Za-z0-9_.-]+)",
        text,
        re.IGNORECASE,
    )
    if verb_match:
        cand = verb_match.group(1).strip().rstrip(".,;:")
        cand_lower = cand.lower()
        if cand_lower.endswith((".exe", ".dll")) or any(cand_lower == kp or cand_lower == kp.replace(".exe", "") for kp in KNOWN_PROCESSES):
            return cand_lower

    # 3. Direct matching against known processes in the text
    text_lower = text.lower()
    for kp in KNOWN_PROCESSES:
        pattern = r"\b" + re.escape(kp) + r"\b"
        if re.search(pattern, text_lower):
            return kp.lower()

    return None


def extract_technique(text: str) -> Optional[str]:
    """
    Extract MITRE technique ID from text.
    Prefers explicit IDs (most specific first, e.g. T1003.001 over T1003).
    Falls back to high-confidence keyword inference if no explicit ID is present.
    """
    if not text:
        return None

    # 1. Explicit MITRE technique regex: e.g. T1003, T1003.001, T1071.004
    explicit_matches = re.findall(r"\b[tT](\d{4}(?:\.\d{3})?)\b", text)
    if explicit_matches:
        # Normalize uppercase 'T' prefix
        techniques = [f"T{m}" for m in explicit_matches]
        # Return the most specific technique (sub-techniques are longer, e.g. len 9 vs 5)
        techniques.sort(key=lambda t: (len(t), t), reverse=True)
        return techniques[0]

    # 2. High-confidence inference from strong security concepts
    for pattern, tech_id in CONCEPT_TECHNIQUE_MAPPINGS:
        if re.search(pattern, text, re.IGNORECASE):
            return tech_id

    return None


def extract_severity(text: str) -> Optional[str]:
    """
    Extract normalized severity level: critical, high, medium, low, informational.
    Returns None if no explicit severity indicator is detected.
    """
    if not text:
        return None

    # 1. Prefix: severity: critical, severity=high, priority: low
    prefix_match = re.search(
        r"\b(?:severity|priority|level)\s*[:=]\s*(critical|high|medium|low|informational|info)\b",
        text,
        re.IGNORECASE,
    )
    if prefix_match:
        val = prefix_match.group(1).lower()
        return "informational" if val == "info" else val

    # 2. Suffix: high severity alert, critical severity
    suffix_match = re.search(
        r"\b(critical|high|medium|low|informational|info)\s+severity\b",
        text,
        re.IGNORECASE,
    )
    if suffix_match:
        val = suffix_match.group(1).lower()
        return "informational" if val == "info" else val

    # 3. Phrasing: severity is critical
    phrasing_match = re.search(
        r"\bseverity\s+is\s+(critical|high|medium|low|informational|info)\b",
        text,
        re.IGNORECASE,
    )
    if phrasing_match:
        val = phrasing_match.group(1).lower()
        return "informational" if val == "info" else val

    return None


def extract_entities(text: str) -> Dict[str, Optional[str]]:
    """
    Main entity extraction entry point.
    Returns a dictionary of extracted entities:
    {
        "host": str or None,
        "process": str or None,
        "technique": str or None,
        "severity": str or None
    }
    """
    if not text or not text.strip():
        return {
            "host": None,
            "process": None,
            "technique": None,
            "severity": None,
        }

    return {
        "host": extract_host(text),
        "process": extract_process(text),
        "technique": extract_technique(text),
        "severity": extract_severity(text),
    }
