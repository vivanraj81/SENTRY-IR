export const mockDocuments = [
  {
    id: "IR-Runbook-Credential-Theft",
    title: "IR-Runbook-Credential-Theft",
    type: "Runbook",
    version: "v3.2",
    updated: "Aug 14, 2026",
    published: "",
    chunks: 42,
    status: "Indexed",
    owner: "SOC Platform Team",
    content: "3. Containment\n\n3.1 Upon confirmation of a credential-theft indicator on a production host, the responding analyst must disconnect the affected endpoint from all network segments immediately, including VPN and wireless interfaces.\n\nDo not power off the machine — this destroys volatile memory needed for forensic capture. Isolation must occur within 5 minutes of confirmed detection.\n\nProceed to Section 3.2 for memory acquisition steps once isolation is confirmed by the SOC lead."
  },
  {
    id: "Threat-Intel-2025-14",
    title: "Threat-Intel-2025-14",
    type: "Threat Intel",
    version: "",
    updated: "",
    published: "Feb 2, 2026",
    chunks: 63,
    status: "Indexed",
    owner: "Threat Intel Team",
    content: "Recent campaigns show adversaries using custom tooling to access LSASS memory.\n\nAnalysts should filter for System Event ID 10 targeting lsass.exe within the last 24 hours to identify the source process and access mask.\n\nCross-reference running processes and loaded modules against known credential-dumping tool hashes."
  },
  {
    id: "Legacy-IR-Playbook-2024",
    title: "Legacy-IR-Playbook-2024",
    type: "Runbook",
    version: "v1.4",
    updated: "Mar 2, 2024",
    published: "",
    chunks: 37,
    status: "Stale",
    flagged: true,
    owner: "SOC Operations",
    content: "Isolate the host within 30 minutes and power down if isolation is not possible within that window."
  },
  {
    id: "CVE-2024-3094-advisory",
    title: "CVE-2024-3094-advisory",
    type: "Advisory",
    version: "",
    updated: "Apr 1, 2024",
    published: "",
    chunks: 8,
    status: "Indexed",
    owner: "Vulnerability Management",
    content: "Advisory for CVE-2024-3094 regarding xz-utils."
  },
  {
    id: "IR-Runbook-Phishing-Response",
    title: "IR-Runbook-Phishing-Response",
    type: "Runbook",
    version: "v2.1",
    updated: "Jan 15, 2026",
    published: "",
    chunks: 0,
    status: "Parsing",
    owner: "SOC Platform Team",
    content: ""
  }
];
