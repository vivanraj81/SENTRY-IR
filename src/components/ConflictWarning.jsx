import { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import Button from './Button';
import StatusChip from './StatusChip';
import { flagRunbook } from '../api';

const RECOMMENDATION = 'Follow the newer source (v3.2). The 2024 playbook has not been reviewed since the containment SLA changed and should be retired.';

function dateVersion(source) {
  return [source.version, source.date].filter(Boolean).join(' · ');
}

export default function ConflictWarning({ conflicts, documents = [] }) {
  const [useNewer, setUseNewer] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!conflicts?.length) return null;

  const conflict = conflicts[0];
  const olderDocument = documents.find((document) => document.title === conflict.older.docName || document.name === conflict.older.docName);
  const sources = [
    { ...conflict.newer, label: 'Newer', tone: 'success' },
    { ...conflict.older, label: 'Outdated', tone: 'warning' },
  ];

  async function flagOlderSource() {
    setLoading(true);
    setError('');
    try {
      await flagRunbook(conflict.older.docId || olderDocument?.id || conflict.older.docName, `Conflicting guidance: ${conflict.topic || 'response guidance'}`);
      setFlagged(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not flag this runbook.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-warning/30 bg-panel">
      <div className="flex items-start gap-3 border-b border-warning/20 bg-warning/10 px-5 py-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <h2 className="text-sm font-bold text-warning">Conflicting guidance found</h2>
          <p className="mt-1 text-sm leading-5 text-secondary">Two sources disagree on the recommended containment window. Review both before acting.</p>
        </div>
      </div>

      <div className="p-5">
        <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted">COMPARE SOURCES</h3>
        <div className={`grid gap-3 ${useNewer ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {(useNewer ? sources.slice(0, 1) : sources).map((source) => (
            <article key={`${source.docName}-${source.version}`} className="flex min-w-0 flex-col rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-semibold text-primary">{source.docName}</h4>
                  <p className="mt-1 font-mono text-xs text-secondary">{dateVersion(source)}</p>
                </div>
                <StatusChip tone={source.tone}>{source.label}</StatusChip>
              </div>
              <blockquote className="flex-1 rounded-md border-l-2 border-accent bg-panel-alt p-3 text-sm leading-5 text-secondary">
                “{source.quote}”
              </blockquote>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><FileText size={12} /> {conflict.topic}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-panel-alt p-4">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-secondary">Recommendation</h4>
          <p className="text-sm leading-6 text-primary">{RECOMMENDATION}</p>
        </div>
        <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          {flagged ? (
            <p role="status" className="text-sm font-semibold text-success">Runbook flagged for owner review.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setUseNewer(true)}>Use v3.2 Guidance</Button>
              <Button variant="secondary" disabled={loading} onClick={flagOlderSource}>
                {loading ? 'Flagging…' : 'Flag for Runbook Owner'}
              </Button>
            </div>
          )}
          {useNewer && <button type="button" onClick={() => setUseNewer(false)} className="text-xs font-semibold text-accent">Show both sources</button>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-critical">{error}</p>}
      </div>
    </section>
  );
}
