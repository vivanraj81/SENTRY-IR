import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import SeverityBadge from '../components/SeverityBadge';
import { getDocuments, retrieveMitigation } from '../api';

const FIELDS = [
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!state?.rawAlert) {
    return <div className="m-auto p-8 text-center"><p className="mb-4">No alert to confirm.</p><Button onClick={() => navigate('/')}>Back to Intake</Button></div>;
  }

  function changeEntity(key, value) {
    if (key === 'technique') {
      const [technique, ...name] = value.split(/\s+[—·]\s+/);
      setEntities((old) => ({ ...old, technique, techniqueName: name.join(' — ') }));
    } else {
      setEntities((old) => ({ ...old, [key]: value }));
    }
  }

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      const [retrieval, documents] = await Promise.all([
        retrieveMitigation({
          alert: state.rawAlert,
          entities: {
            detection: entities.detection || entities.rule || '',
            host: entities.host || '',
            process: entities.process || '',
            technique: entities.technique || '',
            severity: entities.severity || '',
          },
        }),
        getDocuments(),
      ]);
      navigate('/results', {
        state: {
          retrieval,
          documents,
          alertId: `alert-${Date.now()}`,
          alert: { ...(retrieval.alert || {}), ...entities, query: state.rawAlert },
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
        <p className="text-sm leading-6 text-secondary">Review the entities pulled from the raw alert. Edit any tag before we search the knowledge base.</p>
      </header>
      <section className="mb-7">
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted">RAW ALERT</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-panel p-4 font-mono text-[13px] leading-6">{state.rawAlert}</pre>
      </section>
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted">EXTRACTED ENTITIES</h2>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
          {FIELDS.map(([key, label]) => {
            const value = key === 'technique'
              ? [entities.technique, entities.techniqueName].filter(Boolean).join(' — ')
              : entities[key] || '';
            return (
              <div key={key} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,2fr)_auto] items-center gap-3 px-4 py-3.5">
                <span className="text-sm text-secondary">{label}</span>
                {editing === key ? (
                  <input autoFocus value={value} onChange={(event) => changeEntity(key, event.target.value)} className="min-w-0 rounded border border-accent bg-background px-3 py-2 font-mono text-[13px] outline-none" />
                ) : key === 'severity' && value ? (
                  <span><SeverityBadge severity={value} /></span>
                ) : (
                  <span className="break-words font-mono text-[13px]">{value || 'Not detected'}</span>
                )}
                <button type="button" onClick={() => setEditing(editing === key ? '' : key)} className="text-xs font-semibold text-accent">
                  {editing === key ? 'Done' : 'Edit'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      {loading && <div aria-label="Searching" className="mb-4 animate-pulse space-y-2"><div className="h-3 w-2/3 rounded bg-panel-alt" /><div className="h-3 w-1/2 rounded bg-panel-alt" /></div>}
      {error && <p role="alert" className="mb-4 rounded border border-critical/30 bg-critical/10 p-3 text-sm text-critical">{error}</p>}
      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <Button variant="secondary" disabled={loading} onClick={() => navigate('/')}>Back</Button>
        <Button disabled={loading} onClick={confirm}>{loading ? 'Searching…' : 'Confirm & Search'}</Button>
      </div>
    </div>
  );
}
