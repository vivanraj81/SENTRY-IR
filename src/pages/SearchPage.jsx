import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardPaste, MessageSquareText } from 'lucide-react';
import Button from '../components/Button';
import { parseAlert, retrieveMitigation, getDocuments, normalizeRetrieval } from '../api';

const SAMPLES = [
  {
    label: 'Suspicious LSASS Access',
    raw: '{"detection":"Suspicious LSASS Access","host":"FIN-WS-07","process":"rundll32.exe","rule":"Sigma_T1003_001"}',
  },
  {
    label: 'Encoded PowerShell Command',
    raw: '{"detection":"Encoded PowerShell Command","host":"FIN-WS-07","process":"powershell.exe","rule":"Sigma_T1059_001"}',
  },
  {
    label: 'Outbound SMB to rare IP',
    raw: '{"detection":"Outbound SMB to rare IP","host":"FIN-WS-07","process":"System","rule":"Sigma_T1021_002"}',
  },
];

const PLACEHOLDER = `{
  "detection": "Suspicious LSASS Access",
  "host": "FIN-WS-07",
  "process": "rundll32.exe",
  "rule": "Sigma_T1003_001"
}`;

export default function SearchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('paste');
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRetrieve(event) {
    event.preventDefault();
    if (!inputText.trim()) {
      setError('Enter an alert or question before continuing.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      if (activeTab === 'paste') {
        const extracted = await parseAlert(inputText);
        navigate('/confirm', {
          state: { rawAlert: inputText, entities: extracted },
        });
      } else {
        const [entities, retrieved, documents] = await Promise.all([
          parseAlert(inputText.trim()),
          retrieveMitigation({ question: inputText.trim() }),
          getDocuments(),
        ]);
        navigate('/results', {
          state: {
            retrieval: normalizeRetrieval(retrieved, documents),
            documents,
            alertId: `alert-${Date.now()}`,
            alert: {
              ...entities,
              detection: entities.detection || inputText.trim(),
              query: inputText.trim(),
            },
          },
        });
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to retrieve mitigation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-9 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          INCIDENT RESPONSE WORKSPACE
        </div>
        <h1 className="mb-3 text-[26px] font-bold leading-tight">Find the exact mitigation step</h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-secondary">
          Paste a raw alert or ask in plain language — SENTRY-IR retrieves the step, not the whole document.
        </p>
      </div>

      <form onSubmit={handleRetrieve} className="rounded-xl border border-border bg-panel p-5 shadow-2xl shadow-black/10 sm:p-7">
        <div className="mb-5 flex w-fit rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('paste'); setError(''); }}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'paste' ? 'bg-panel-alt text-primary' : 'text-secondary hover:text-primary'}`}
          >
            <ClipboardPaste size={15} /> Paste Alert
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('ask'); setError(''); }}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'ask' ? 'bg-panel-alt text-primary' : 'text-secondary hover:text-primary'}`}
          >
            <MessageSquareText size={15} /> Ask a Question
          </button>
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="alert-input">
          {activeTab === 'paste' ? 'Raw alert payload' : 'Incident question'}
        </label>
        <textarea
          id="alert-input"
          className="min-h-56 w-full resize-y rounded-lg border border-border bg-background p-4 font-mono text-[13px] leading-6 text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          placeholder={activeTab === 'paste' ? PLACEHOLDER : 'e.g. How should I contain a host after LSASS credential dumping?'}
          value={inputText}
          onChange={(event) => { setInputText(event.target.value); setError(''); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'search-error' : undefined}
        />
        {error && <p id="search-error" role="alert" className="mt-3 text-sm text-critical">{error}</p>}

        <div className="mt-5 flex flex-col items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
          <p className="text-xs text-muted">Local keyword retrieval · results cite indexed response guidance</p>
          <Button type="submit" disabled={loading} className="w-full gap-2 px-6 py-3 sm:w-auto">
            {loading ? 'Searching knowledge base…' : <>Retrieve Mitigation <ArrowRight size={16} /></>}
          </Button>
        </div>
        {loading && (
          <div aria-label="Searching the knowledge base" className="mt-4 animate-pulse space-y-2">
            <div className="h-2.5 w-3/4 rounded bg-panel-alt" />
            <div className="h-2.5 w-1/2 rounded bg-panel-alt" />
          </div>
        )}
      </form>

      <section className="mt-8" aria-labelledby="sample-alerts-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="sample-alerts-heading" className="text-xs font-bold tracking-[0.14em] text-muted">RECENT / SAMPLE ALERTS</h2>
          <span className="text-xs text-muted">Select to populate</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => { setActiveTab('paste'); setInputText(sample.raw); setError(''); }}
              className="rounded-full border border-border bg-panel px-3.5 py-2 text-sm text-secondary transition-colors hover:border-accent/60 hover:text-primary"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
