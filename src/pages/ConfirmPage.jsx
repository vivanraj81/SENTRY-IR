import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import SeverityBadge from '../components/SeverityBadge';
import { getDocuments, normalizeRetrieval, retrieveMitigation } from '../api';

const ENTITY_FIELDS = [
  ['host', 'Host'],
  ['process', 'Process'],
  ['technique', 'MITRE Technique'],
  ['severity', 'Severity'],
];

export default function ConfirmPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [entities, setEntities] = useState(state?.entities || {});
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state?.rawAlert) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="mb-3 text-2xl font-bold">No alert to confirm</h1>
        <p className="mb-6 text-sm text-secondary">Start by pasting an alert for analysis.</p>
        <Button onClick={() => navigate('/')}>Back to Alert Intake</Button>
      </div>
    );
  }

  function updateEntity(key, value) {
    if (key === 'technique') {
      const [technique, ...name] = value.split(/\s+[—·]\s+/);
      setEntities((current) => ({
        ...current,
        technique,
        techniqueName: name.join(' — ') || current.techniqueName,
      }));
    } else {
      setEntities((current) => ({ ...current, [key]: value }));
    }
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);
    try {
      const payload = {
        entities: {
          detection: entities.detection || entities.rule || '',
          host: entities.host || '',
          process: entities.process || '',
          technique: entities.technique || '',
          severity: entities.severity || '',
        },
      };
      const [retrieved, documents] = await Promise.all([
        retrieveMitigation(payload),
        getDocuments(),
      ]);
      navigate('/results', {
        state: {
          retrieval: normalizeRetrieval(retrieved, documents),
          alertId: `alert-${Date.now()}`,
          alert: { ...retrieved.alert, ...entities },
        },
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to retrieve mitigation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold tracking-[0.14em] text-accent">ALERT INTAKE / CONFIRM</p>
        <h1 className="mb-2 text-[26px] font-bold">Confirm what we extracted</h1>
        <p className="text-sm leading-6 text-secondary">
          Review the entities pulled from the raw alert. Edit any tag before we search the knowledge base.
        </p>
      </header>

      <section className="mb-7">
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted">RAW ALERT</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-panel p-4 font-mono text-[13px] leading-6 text-primary">
          {state.rawAlert}
        </pre>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.14em] text-muted">EXTRACTED ENTITIES</h2>
          <span className="text-xs text-muted">Edit values before retrieval</span>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
          {ENTITY_FIELDS.map(([key, label]) => {
            const value = key === 'technique'
              ? [entities.technique, entities.techniqueName].filter(Boolean).join(' — ')
              : entities[key] || '';
            return (
              <div key={key} className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,2fr)_auto] items-center gap-3 px-4 py-3.5">
                <span className="text-sm font-medium text-secondary">{label}</span>
                {editing === key ? (
                  <input
                    autoFocus
                    value={value}
                    onChange={(event) => updateEntity(key, event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && setEditing('')}
                    className="min-w-0 rounded-md border border-accent bg-background px-3 py-2 font-mono text-[13px] text-primary outline-none focus:ring-2 focus:ring-accent/20"
                    aria-label={`Edit ${label}`}
                  />
                ) : key === 'severity' && value ? (
                  <span><SeverityBadge severity={value} /></span>
                ) : (
                  <span className="min-w-0 break-words font-mono text-[13px] text-primary">{value || 'Not detected'}</span>
                )}
                {editing === key ? (
                  <button type="button" onClick={() => setEditing('')} className="text-xs font-semibold text-accent">Done</button>
                ) : (
                  <button type="button" onClick={() => setEditing(key)} className="text-xs font-semibold text-accent hover:text-white">Edit</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && <p role="alert" className="mb-4 rounded-md border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</p>}
      {loading && (
        <div aria-label="Searching the knowledge base" className="mb-4 animate-pulse space-y-2">
          <div className="h-3 w-2/3 rounded bg-panel-alt" />
          <div className="h-3 w-1/2 rounded bg-panel-alt" />
        </div>
      )}
      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => navigate('/')}>Back</Button>
        <Button disabled={loading} onClick={handleConfirm}>
          {loading ? 'Searching knowledge base…' : 'Confirm & Search'}
        </Button>
      </div>
    </div>
  );
}
