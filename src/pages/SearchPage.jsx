import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../components/Button';
import { getDocuments, parseAlert, retrieveMitigation } from '../api';

const SAMPLES = [
  'Suspicious LSASS Access',
  'Encoded PowerShell Command',
  'Outbound SMB to rare IP',
];

const SAMPLE_ALERTS = {
  'Suspicious LSASS Access': {
    detection: 'Suspicious LSASS Access', host: 'FIN-WS-07', process: 'rundll32.exe', rule: 'Sigma_T1003_001',
  },
  'Encoded PowerShell Command': {
    detection: 'Encoded PowerShell', host: 'FIN-WS-07', process: 'powershell.exe', rule: 'Sigma_T1059_001',
  },
  'Outbound SMB to rare IP': {
    detection: 'Outbound SMB to rare IP', host: 'FIN-WS-07', process: 'System', rule: 'Sigma_T1021_002',
  },
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('paste');
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!raw.trim()) {
      setError('Enter an alert or question before continuing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'paste') {
        const entities = await parseAlert(raw);
        navigate('/confirm', { state: { rawAlert: raw, entities } });
      } else {
        const [entities, retrieval, documents] = await Promise.all([
          parseAlert(raw.trim()),
          retrieveMitigation({ question: raw.trim() }),
          getDocuments(),
        ]);
        navigate('/results', {
          state: {
            retrieval,
            documents,
            alertId: `alert-${Date.now()}`,
            alert: {
              ...entities,
              query: raw.trim(),
              detection: entities.detection || raw.trim(),
            },
          },
        });
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to search the knowledge base.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-10">
      <header className="mb-8 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-accent">INCIDENT RESPONSE WORKSPACE</p>
        <h1 className="mb-3 text-[26px] font-bold">Find the exact mitigation step</h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-secondary">
          Paste a raw alert or ask in plain language — SENTRY-IR retrieves the step, not the whole document.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-xl border border-border bg-panel p-5 sm:p-7">
        <div className="mb-5 inline-flex rounded-lg border border-border bg-background p-1">
          {['paste', 'question'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setMode(tab); setError(''); }}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === tab ? 'bg-panel-alt text-primary' : 'text-secondary hover:text-primary'}`}
            >
              {tab === 'paste' ? 'Paste Alert' : 'Ask a Question'}
            </button>
          ))}
        </div>
        <label htmlFor="raw-alert" className="mb-2 block text-xs font-bold tracking-wider text-muted">
          {mode === 'paste' ? 'RAW ALERT' : 'QUESTION'}
        </label>
        <textarea
          id="raw-alert"
          value={raw}
          onChange={(event) => { setRaw(event.target.value); setError(''); }}
          placeholder={mode === 'paste'
            ? '{\n  "detection": "Suspicious LSASS Access",\n  "host": "FIN-WS-07",\n  "process": "rundll32.exe",\n  "rule": "Sigma_T1003_001"\n}'
            : 'e.g. How do I isolate a host after LSASS credential dumping?'}
          className="min-h-56 w-full resize-y rounded-lg border border-border bg-background p-4 font-mono text-[13px] leading-6 text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          aria-invalid={Boolean(error)}
        />
        {error && <p role="alert" className="mt-3 text-sm text-critical">{error}</p>}
        {loading && (
          <div aria-label="Loading" className="mt-4 animate-pulse space-y-2">
            <div className="h-3 w-3/4 rounded bg-panel-alt" />
            <div className="h-3 w-1/2 rounded bg-panel-alt" />
          </div>
        )}
        <div className="mt-5 flex flex-col items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
          <p className="text-xs text-muted">Local keyword retrieval · guidance includes source citations</p>
          <Button type="submit" disabled={loading} className="w-full px-6 sm:w-auto">
            {loading ? 'Searching…' : <>Retrieve Mitigation <ArrowRight size={16} /></>}
          </Button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted">RECENT / SAMPLE ALERTS</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => { setMode('paste'); setRaw(JSON.stringify(SAMPLE_ALERTS[sample], null, 2)); setError(''); }}
              className="rounded-full border border-border bg-panel px-3.5 py-2 text-sm text-secondary transition-colors hover:border-accent/60 hover:text-primary"
            >
              {sample}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
