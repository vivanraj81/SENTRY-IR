const PHASES = ['Immediate', 'Investigate', 'Recover'];

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload.detail || `Request failed (${response.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return payload;
}

function payloadFromRaw(raw) {
  try {
    return { body: JSON.stringify(JSON.parse(raw)), contentType: 'application/json' };
  } catch {
    return { body: raw, contentType: 'text/plain' };
  }
}

function findTimestamp(value) {
  if (Array.isArray(value)) {
    return value.map(findTimestamp).find(Boolean) || '';
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.toLowerCase() === 'timestamp' && typeof child === 'string') return child;
    }
    return Object.values(value).map(findTimestamp).find(Boolean) || '';
  }
  return '';
}

export async function parseAlert(raw) {
  const payload = payloadFromRaw(raw);
  const extracted = await requestJson('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': payload.contentType },
    body: payload.body,
  });
  let source;
  try {
    source = JSON.parse(raw);
  } catch {
    source = null;
  }
  return { ...extracted, timestamp: extracted.timestamp || findTimestamp(source) };
}

export async function retrieveMitigation(query) {
  return requestJson('/api/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
}

export async function getDocuments() {
  const payload = await requestJson('/api/documents');
  const documents = Array.isArray(payload) ? payload : payload.documents || [];
  return documents.map(normalizeDocument);
}

function normalizeDocument(document) {
  return {
    ...document,
    title: document.name || document.title || document.id,
    date: document.date || document.updated || document.published || '',
    flagged: Boolean(document.flagged) || String(document.status || '').toLowerCase().includes('flagged'),
  };
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

export function normalizeRetrieval(payload, documents = []) {
  const documentById = new Map(documents.map((document) => [document.id, document]));
  if (Array.isArray(payload.steps)) {
    const steps = payload.steps.slice(0, 5).map((step, index) => ({
      ...step,
      order: step.order || index + 1,
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
      ...payload,
      steps,
      confidence: payload.confidence || (topScore >= 0.65 ? 'High' : topScore >= 0.4 ? 'Medium' : 'Low'),
      sourceDocuments: (payload.sourcesMatched || []).map((name) => {
        const document = documents.find(
          (item) => item.title === name || item.name === name || item.id === name,
        );
        return {
          id: document?.id || name,
          name: document?.title || document?.name || name,
          version: document?.version || '',
          date: document?.updated || document?.date || document?.published || '',
        };
      }),
      sourcesMatched: payload.sourcesMatched || [],
      retrievalSeconds: Number(payload.retrievalSeconds) || 0,
      conflicts: payload.conflicts || [],
    };
  }
  const groups = payload.results || {};
  const steps = PHASES.flatMap((phase) => {
    const items = groups[phase] || groups[phase.toLowerCase()] || [];
    return items.map((item) => {
      const docId = item.document_id || item.doc_id || item.citation?.docId || '';
      const document = documentById.get(docId);
      const citationText = typeof item.citation === 'string' ? item.citation : '';
      const sectionMatch = citationText.match(/(?:§|p\.)\s*([\d.]+)/i);

      return {
        phase: phase.toLowerCase(),
        title: item.title || item.step_title || '',
        description: item.description || item.step_text || '',
        score: item.score || 0,
        citation: {
          docId,
          docName: document?.title || item.doc_title || docId,
          section: item.section || sectionMatch?.[1] || '',
          reference: citationText,
          sectionTitle: item.title || item.step_title || '',
          version: document?.version || '',
          date: document?.updated || document?.date || document?.published || '',
        },
      };
    });
  }).slice(0, 5).map((step, index) => ({ ...step, order: index + 1 }));

  const topScore = Math.max(0, ...steps.map((step) => step.score));
  const confidence =
    payload.confidence ||
    (topScore >= 0.65 ? 'High' : topScore >= 0.4 ? 'Medium' : 'Low');
  const sourceNames = payload.sourcesMatched || [];

  return {
    steps,
    confidence,
    retrievalSeconds: payload.retrievalSeconds || 0,
    sourcesMatched: sourceNames,
    conflicts: payload.conflicts || [],
    sourceDocuments: sourceNames.map((name) => {
      const document = documents.find(
        (item) => item.title === name || item.name === name || item.id === name,
      );
      return {
        id: document?.id || name,
        name: document?.title || document?.name || name,
        version: document?.version || '',
        date: document?.updated || document?.date || document?.published || '',
      };
    }),
    alert: payload.alert || {},
  };
}
