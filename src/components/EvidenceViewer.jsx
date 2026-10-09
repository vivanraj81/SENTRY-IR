import { useEffect, useState } from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';
import Button from './Button';
import StatusChip from './StatusChip';
import { getDocument, getEvidence } from '../api';

export default function EvidenceViewer({ citation, onClose }) {
  const [evidence, setEvidence] = useState(null);
  const [fullDocument, setFullDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (fullDocument) setFullDocument(null);
        else onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullDocument, onClose]);

  useEffect(() => {
    let active = true;
    getEvidence(citation)
      .then((data) => { if (active) setEvidence(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [citation]);

  async function openFullDocument() {
    setDocumentLoading(true);
    setError('');
    try {
      setFullDocument(await getDocument(citation.docId));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the full document.');
    } finally {
      setDocumentLoading(false);
    }
  }

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default bg-black/60" aria-label="Close evidence viewer" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border bg-panel px-6 py-5">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-accent">SOURCE EVIDENCE</p>
            <h2 id="evidence-title" className="break-words text-lg font-semibold">{evidence?.docName || citation.docName}</h2>
            <p className="mt-1 text-sm text-secondary">
              Section {evidence?.section || citation.section} · {evidence?.sectionTitle || citation.sectionTitle}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close evidence viewer" className="rounded-md p-2 text-secondary hover:bg-panel-alt hover:text-primary">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-border px-6 py-4">
          <StatusChip tone="neutral">{evidence?.version || citation.version || 'Version unavailable'}</StatusChip>
          <StatusChip tone="neutral">{evidence?.date ? `Updated ${evidence.date}` : 'Date unavailable'}</StatusChip>
          {evidence?.owner && <StatusChip tone="neutral">Owner: {evidence.owner}</StatusChip>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div aria-label="Loading evidence" className="animate-pulse space-y-3">
              <div className="h-4 w-3/4 rounded bg-panel-alt" />
              <div className="h-24 rounded-lg bg-panel" />
              <div className="h-4 w-full rounded bg-panel-alt" />
            </div>
          ) : error ? (
            <p role="alert" className="rounded-md border border-critical/30 bg-critical/10 p-4 text-sm text-critical">{error}</p>
          ) : (
            <div className="space-y-4">
              {evidence.highlight && (
                <blockquote className="rounded-lg border border-accent/30 border-l-4 border-l-accent bg-accent/10 p-4 text-sm leading-6 text-primary">
                  {evidence.highlight}
                </blockquote>
              )}
              <div className="rounded-lg border border-border bg-panel p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-muted">
                  <FileText size={14} /> SECTION EXCERPT
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-secondary">{evidence.text}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-border bg-panel px-6 py-4">
          <Button disabled={loading || documentLoading || Boolean(error)} onClick={openFullDocument} className="w-full">
            <ExternalLink size={15} />
            {documentLoading ? 'Loading document…' : 'Open Full Document'}
          </Button>
        </footer>
      </aside>

      {fullDocument && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="full-document-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-border bg-panel px-5 py-4">
              <div>
                <h2 id="full-document-title" className="text-lg font-semibold">{fullDocument.name}</h2>
                <p className="mt-1 text-xs text-secondary">{fullDocument.version} · {fullDocument.date} · {fullDocument.owner}</p>
              </div>
              <button onClick={() => setFullDocument(null)} aria-label="Close full document" className="rounded-md p-2 text-secondary hover:bg-panel-alt hover:text-primary">
                <X size={18} />
              </button>
            </header>
            <pre className="overflow-y-auto whitespace-pre-wrap p-6 font-mono text-[13px] leading-6 text-secondary">{fullDocument.text}</pre>
          </section>
        </div>
      )}
    </>
  );
}
