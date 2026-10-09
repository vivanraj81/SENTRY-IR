"""Normalize alert text and map common detection names to MITRE ATT&CK."""

from typing import Any, Dict, Optional

from backend.entity_extractor import extract_entities, extract_severity, extract_technique

DETECTION_MAPPINGS = (
    (
        "Suspicious LSASS Access",
        ("suspicious lsass access", "lsass access", "credential dumping"),
        "T1003.001",
        "OS Credential Dumping: LSASS Memory",
        "Critical",
    ),
    (
        "Encoded PowerShell",
        ("encoded powershell", "powershell encoded", "encoded command"),
        "T1059.001",
        "PowerShell",
        "High",
    ),
    (
        "Outbound SMB to rare IP",
        ("outbound smb to rare ip", "outbound smb", "smb to rare ip"),
        "T1021.002",
        "SMB/Windows Admin Shares",
        "High",
    ),
    (
        "Brute force / account compromise",
        ("brute force", "account compromise", "password spray"),
        "T1110",
        "Brute Force",
        "High",
    ),
    (
        "Suspicious scheduled task / persistence",
        ("suspicious scheduled task", "scheduled task", "schtasks"),
        "T1053.005",
        "Scheduled Task",
        "High",
    ),
)

TECHNIQUE_NAMES = {
    technique: name
    for _, _, technique, name, _ in DETECTION_MAPPINGS
}


def flatten_alert(value: Any) -> str:
    """Flatten nested JSON fields into searchable, labeled alert text."""
    if isinstance(value, dict):
        parts = []
        for key, child in value.items():
            flattened = flatten_alert(child)
            if flattened:
                parts.append(f"{key}: {flattened}")
        return " ".join(parts)
    if isinstance(value, (list, tuple)):
        return " ".join(filter(None, (flatten_alert(item) for item in value)))
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value).strip()
    return ""


def parse_alert(alert_text: str) -> Dict[str, Optional[str]]:
    """Extract entities, technique metadata, and severity from alert text."""
    text = alert_text.strip()
    lowered = text.casefold()
    matched = next(
        (
            mapping
            for mapping in DETECTION_MAPPINGS
            if any(alias in lowered for alias in mapping[1])
        ),
        None,
    )

    entities = extract_entities(text)
    technique = matched[2] if matched else extract_technique(text)
    severity = matched[4] if matched else extract_severity(text)

    return {
        "alert": text,
        "detection": matched[0] if matched else None,
        "host": entities["host"],
        "process": entities["process"],
        "technique": technique,
        "techniqueName": TECHNIQUE_NAMES.get(technique) if technique else None,
        "severity": severity.title() if severity else None,
    }
