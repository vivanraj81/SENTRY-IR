export const mockMitigations = {
  "alert-1": {
    type: "results",
    summary: {
      confidence: "High",
      technique: "T1003.001",
      sourcesMatched: 2,
      retrievalTime: "1.8s",
      documents: [
        {
          id: "IR-Runbook-Credential-Theft",
          title: "IR-Runbook-Credential-Theft",
          version: "v3.2",
          updated: "Aug 14, 2026"
        },
        {
          id: "Threat-Intel-2025-14",
          title: "Threat-Intel-2025-14",
          published: "Feb 2, 2026"
        }
      ]
    },
    sections: [
      {
        title: "IMMEDIATE — DO NOW",
        count: 2,
        steps: [
          {
            id: "step-1",
            title: "Isolate host from network",
            description: "Disconnect FIN-WS-07 from all network segments immediately.\nDo not power off — preserve volatile memory for forensic capture.",
            citation: "IR-Runbook-Credential-Theft §3.1",
            docId: "IR-Runbook-Credential-Theft"
          },
          {
            id: "step-2",
            title: "Do not reboot — capture memory image",
            description: "Use approved memory acquisition tooling before any further action.\nRebooting destroys evidence of injected credentials.",
            citation: "IR-Runbook-Credential-Theft §3.2",
            docId: "IR-Runbook-Credential-Theft"
          }
        ]
      },
      {
        title: "INVESTIGATE",
        count: 2,
        steps: [
          {
            id: "step-3",
            title: "Pull System Event ID 10 for the host",
            description: "Filter for process access events targeting lsass.exe within the last 24 hours to identify the source process and access mask.",
            citation: "Threat-Intel-2025-14 p.4",
            docId: "Threat-Intel-2025-14"
          },
          {
            id: "step-4",
            title: "Check for known T1003.001 tooling signatures",
            description: "Cross-reference running processes and loaded modules against known credential-dumping tool hashes.",
            citation: "Threat-Intel-2025-14 p.6",
            docId: "Threat-Intel-2025-14"
          }
        ]
      },
      {
        title: "RECOVER",
        count: 1,
        steps: [
          {
            id: "step-5",
            title: "Force credential rotation for all accounts active on host",
            description: "Reset passwords and invalidate Kerberos tickets for any account that logged into FIN-WS-07 in the affected window.",
            citation: "IR-Runbook-Credential-Theft §5.1",
            docId: "IR-Runbook-Credential-Theft"
          }
        ]
      }
    ]
  },
  "alert-2": {
    type: "no-result",
    technique: "T1071.004",
    message: "The knowledge base has no runbook or advisory matching 'Anomalous DNS tunneling' or its detected technique."
  },
  "alert-3": {
    type: "conflict",
    technique: "T1003",
    message: "Two sources disagree on the recommended containment window.\nReview both before acting.",
    cards: [
      {
        id: "IR-Runbook-Credential-Theft",
        title: "IR-Runbook-Credential-Theft",
        version: "v3.2",
        date: "Aug 14, 2026",
        badge: "Newer",
        quote: "\"Isolation must occur within 5 minutes of confirmed detection. Do not power off the machine.\""
      },
      {
        id: "Legacy-IR-Playbook-2024",
        title: "Legacy-IR-Playbook-2024",
        version: "v1.4",
        date: "Mar 2, 2024",
        badge: "Outdated",
        quote: "\"Isolate the host within 30 minutes and power down if isolation is not possible within that window.\""
      }
    ],
    recommendation: "Follow the newer source (v3.2). The 2024 playbook has not been reviewed since the containment SLA changed and should be retired."
  }
};
