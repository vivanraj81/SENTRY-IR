export const mockAlerts = [
  {
    id: "alert-1",
    detection: "Suspicious LSASS Access",
    host: "FIN-WS-07",
    process: "rundll32.exe",
    rule: "Sigma_T1003_001",
    timestamp: "2026-09-17T09:41:03Z",
    raw: '{\n  "detection": "Suspicious LSASS Access",\n  "host": "FIN-WS-07",\n  "process": "rundll32.exe",\n  "rule": "Sigma_T1003_001",\n  "timestamp": "2026-09-17T09:41:03Z"\n}',
    techniqueId: "T1003.001",
    techniqueName: "LSASS Memory",
    severity: "Critical"
  },
  {
    id: "alert-2",
    detection: "Anomalous DNS tunneling",
    host: "WEB-SRV-12",
    process: "dns.exe",
    rule: "Sigma_T1071_004",
    timestamp: "2026-09-17T11:22:15Z",
    raw: '{\n  "detection": "Anomalous DNS tunneling",\n  "host": "WEB-SRV-12",\n  "process": "dns.exe",\n  "rule": "Sigma_T1071_004",\n  "timestamp": "2026-09-17T11:22:15Z"\n}',
    techniqueId: "T1071.004",
    techniqueName: "DNS",
    severity: "High"
  },
  {
    id: "alert-3",
    detection: "Credential dumping detected",
    host: "HR-LT-04",
    process: "mimikatz.exe",
    rule: "Sigma_T1003",
    timestamp: "2026-09-17T14:05:59Z",
    raw: '{\n  "detection": "Credential dumping detected",\n  "host": "HR-LT-04",\n  "process": "mimikatz.exe",\n  "rule": "Sigma_T1003",\n  "timestamp": "2026-09-17T14:05:59Z"\n}',
    techniqueId: "T1003",
    techniqueName: "OS Credential Dumping",
    severity: "Critical"
  }
];
