import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import Button from '../components/Button';
import { escalateAlert } from '../api';

export default function NoResultPage({ alert: alertProp }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const alert = alertProp || state?.alert || {};
  const query = alert.query || alert.detection || alert.alert || 'this alert';
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState('');

  async function escalate() {
    setLoading(true);
    setError('');
    try {
      await escalateAlert({ ...alert, query });
      setEscalated(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not submit escalation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-panel text-secondary">
        <HelpCircle size={34} strokeWidth={1.6} />
      </div>
      <h1 className="mb-3 text-2xl font-bold">No mitigation found for this alert</h1>
      <p className="mb-7 max-w-xl text-sm leading-6 text-secondary">
        No runbook matches “{query}”{alert.technique ? ` or detected technique ${alert.technique}` : ''}.
      </p>

      <section className="w-full rounded-xl border border-border bg-panel p-5 text-left">
        <h2 className="mb-4 text-xs font-bold tracking-[0.14em] text-muted">SUGGESTED NEXT STEPS</h2>
        <ul className="space-y-3 text-sm text-primary">
          {[
            'Escalate to the on-call IR lead for manual triage',
            'Search MITRE ATT&CK directly for related techniques',
            'Flag this alert type so a runbook can be authored',
          ].map((step) => (
            <li key={step} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {step}
            </li>
          ))}
        </ul>
      </section>

      {error && <p role="alert" className="mt-4 text-sm text-critical">{error}</p>}
      {escalated && <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16} /> Escalation sent to the IR lead.</p>}
      <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => navigate('/')}>Try Another Search</Button>
        <Button variant="danger" disabled={loading || escalated} onClick={escalate}>
          {loading ? 'Escalating…' : escalated ? 'Escalated' : 'Escalate Now'}
        </Button>
      </div>
    </div>
  );
}
