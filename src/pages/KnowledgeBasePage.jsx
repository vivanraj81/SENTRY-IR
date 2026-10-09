import { useEffect, useRef, useState } from 'react';
import { FileText, RefreshCw, Upload } from 'lucide-react';
import Button from '../components/Button';
import MetricCard from '../components/MetricCard';
import { getDocuments, getKnowledgeBaseStats, uploadDocument } from '../api';

function loadKnowledgeBase() {
  return Promise.all([getDocuments(), getKnowledgeBaseStats()]);
}

export default function KnowledgeBasePage() {
  const fileInput = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function refresh() {
    try {
      const [documentList, currentStats] = await loadKnowledgeBase();
      setDocuments(documentList);
      setStats(currentStats);
    } catch (requestError) {
      setError(requestError.message || 'Could not load the knowledge base.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadKnowledgeBase()
      .then(([documentList, currentStats]) => {
        if (!active) return;
        setDocuments(documentList);
        setStats(currentStats);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load the knowledge base.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setSuccess('');
    setError('');
    try {
      await uploadDocument(file);
      setSuccess(`${file.name} was indexed successfully.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not upload the document.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 lg:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.14em] text-accent">KNOWLEDGE OPERATIONS</p>
          <h1 className="mb-2 text-[26px] font-bold">Knowledge Base</h1>
          <p className="text-sm text-secondary">Ingested documents, parsing status, and feed sync</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={loading} onClick={() => { setLoading(true); setError(''); refresh(); }} aria-label="Refresh knowledge base">
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> {uploading ? 'Parsing…' : 'Upload Document'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            className="hidden"
            onChange={handleUpload}
            aria-label="Choose document to upload"
          />
        </div>
      </header>

      {error && <p role="alert" className="mb-5 rounded-md border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</p>}
      {success && <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{success}</p>}
      {uploading && <p role="status" className="mb-5 text-sm text-accent">Parsing and indexing uploaded document…</p>}

      {loading && !stats ? (
        <div aria-label="Loading knowledge base" className="animate-pulse">
          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-xl border border-border bg-panel" />)}
          </div>
          <div className="h-72 rounded-xl border border-border bg-panel" />
        </div>
      ) : stats && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="DOCUMENTS" value={stats.documentCount} subtext="Indexed source documents" />
            <MetricCard label="CHUNKS INDEXED" value={stats.chunksIndexed.toLocaleString()} subtext="Section-level retrieval units" />
            <MetricCard label="CVE FEED SYNC" value={stats.cveFeedSync} subtext="NVD · auto-sync every 30m (simulated)" />
            <MetricCard label="PARSING QUEUE" value={stats.parsingQueueCount} subtext={stats.parsingQueueCount ? 'Documents processing' : 'No documents waiting'} />
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-xs font-bold tracking-[0.14em] text-muted">DOCUMENT INVENTORY</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-panel-alt">
                  <tr>
                    {['DOCUMENT', 'TYPE', 'CHUNKS', 'STATUS'].map((label) => (
                      <th key={label} className="px-5 py-3 text-[10px] font-bold tracking-[0.14em] text-muted">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((document) => (
                    <tr key={document.id} className="transition-colors hover:bg-panel-alt/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="shrink-0 text-secondary" />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-primary">{document.title}</p>
                            <p className="mt-0.5 text-xs text-muted">{document.version || 'Version not specified'}{document.date ? ` · ${document.date}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-secondary">{document.type}</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-secondary">{document.chunks}</td>
                      <td className="px-5 py-3.5"><DocumentStatus status={document.status} flagged={document.flagged} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!documents.length && <p className="p-8 text-center text-sm text-muted">No documents are indexed yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DocumentStatus({ status, flagged }) {
  const stale = status?.toLowerCase().includes('stale') || status?.toLowerCase().includes('flagged') || flagged;
  const parsing = status?.toLowerCase().includes('parsing');
  const tone = stale ? 'warning' : parsing ? 'neutral' : 'success';
  const label = stale ? 'Stale — flagged' : parsing ? 'Parsing…' : status || 'Unknown';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone === 'warning' ? 'border-warning/30 bg-warning/10 text-warning' : tone === 'success' ? 'border-success/30 bg-success/10 text-success' : 'animate-pulse border-accent/30 bg-accent/10 text-accent'}`}>
      {label}
    </span>
  );
}
