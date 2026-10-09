const PHASES = ['immediate', 'investigate', 'recover'];

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail || `Request failed (${response.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload;
}

function parseRaw(raw) {
  try {
    return { body: JSON.stringify(JSON.parse(raw)), contentType: 'application/json' };
  } catch {
    return { body: raw, contentType: 'text/plain' };
  }
}

function findTimestamp(value) {
  if (Array.isArray(value)) return value.map(findTimestamp).find(Boolean) || '';
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === 'timestamp' && typeof child === 'string') return child;
  }
  return Object.values(value).map(findTimestamp).find(Boolean) || '';
}

export async function parseAlert(raw) {
  const request = parseRaw(raw);
  const parsed = await requestJson('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': request.contentType },
    body: request.body,
  });
  let source;
  try {
    source = JSON.parse(raw);
  } catch {
    source = null;
  }
  return { ...parsed, timestamp: parsed.timestamp || findTimestamp(source) };
}

export function normalizeRetrieval(payload) {
  const steps = (payload.steps || []).slice(0, 5).map((step, index) => ({
    ...step,
    order: index + 1,
    phase: String(step.phase || 'investigate').toLowerCase(),
    citation: {
      ...step.citation,
      docId: step.citation?.docId || '',
      docName: step.citation?.docName || step.citation?.docId || 'Unknown source',
      section: step.citation?.section || '',
      sectionTitle: step.citation?.sectionTitle || step.title || '',
      version: step.citation?.version || '',
      date: step.citation?.date || '',
    },
  }));
  const topScore = Math.max(0, ...steps.map((step) => step.score || 0));

  return {
    steps,
    confidence: payload.confidence || (topScore >= 0.65 ? 'High' : topScore >= 0.4 ? 'Medium' : 'Low'),
    retrievalSeconds: Number(payload.retrievalSeconds) || 0,
    sourcesMatched: Array.isArray(payload.sourcesMatched) ? payload.sourcesMatched : [],
    conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
  };
}

export async function retrieveMitigation(body) {
  const payload = await requestJson('/api/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeRetrieval(payload);
}

export async function getDocuments() {
  const payload = await requestJson('/api/documents');
  return Array.isArray(payload) ? payload.map(normalizeDocument) : [];
}

export async function getDocument(id) {
  const payload = await requestJson(`/api/documents/${encodeURIComponent(id)}`);
  return {
    ...payload,
    id: payload.id || id,
    name: payload.name || payload.title || payload.id || id,
    text: payload.text || payload.content || '',
  };
}

export async function getEvidence(citation) {
  const section = citation.section || citation.sectionTitle;
  const payload = await requestJson(
    `/api/documents/${encodeURIComponent(citation.docId)}/sections/${encodeURIComponent(section)}`,
  );
  return normalizeEvidence(payload, citation);
}

export function normalizeEvidence(payload, citation = {}) {
  return {
    docId: citation.docId || '',
    docName: payload.docName || citation.docName || '',
    section: citation.section || '',
    sectionTitle: payload.sectionTitle || citation.sectionTitle || '',
    version: payload.version || citation.version || '',
    date: payload.date || citation.date || '',
    owner: payload.owner || '',
    text: payload.text || '',
    highlight: payload.highlight || '',
  };
}

function normalizeDocument(document) {
  return {
    ...document,
    title: document.name || document.title || document.id,
    date: document.date || document.updated || document.published || '',
    flagged: Boolean(document.flagged) || String(document.status || '').toLowerCase().includes('flagged'),
  };
}

export async function getKnowledgeBaseStats() {
  const stats = await requestJson('/api/kb/stats');
  return {
    documentCount: Number(stats.documentCount) || 0,
    chunksIndexed: Number(stats.chunksIndexed) || 0,
    parsingQueueCount: Number(stats.parsingQueueCount) || 0,
    cveFeedSync: stats.cveFeedSync || 'Unknown',
  };
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const payload = await requestJson('/api/documents', { method: 'POST', body });
  return normalizeDocument(payload);
}

export async function flagRunbook(docId, reason) {
  return requestJson('/api/runbook-flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId, reason }),
  });
}

export async function escalateAlert(alert) {
  return requestJson('/api/escalations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alert: alert.query || alert.detection || alert.alert || '',
      technique: alert.technique || '',
      host: alert.host || '',
      reason: 'No mitigation found in the indexed knowledge base',
    }),
  });
}

export async function sendFeedback(alertId, helpful) {
  return requestJson('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId, helpful }),
  });
}

export { PHASES };
