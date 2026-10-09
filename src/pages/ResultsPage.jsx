import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, SearchCheck, ShieldCheck, ThumbsUp, RotateCcw } from 'lucide-react';
import AlertBanner from '../components/AlertBanner';
import StepCard from '../components/StepCard';
import Button from '../components/Button';
import StatusChip from '../components/StatusChip';
import { sendFeedback } from '../api';

const PHASES = [
  { id: 'immediate', label: 'IMMEDIATE — DO NOW', icon: ShieldCheck, iconColor: 'text-critical' },
  { id: 'investigate', label: 'INVESTIGATE', icon: SearchCheck, iconColor: 'text-warning' },
  { id: 'recover', label: 'RECOVER', icon: RotateCcw, iconColor: 'text-success' },
];

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const retrieval = state?.retrieval;
  const alert = state?.alert || {};
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const sourceDocuments = retrieval?.sourceDocuments || [];

  if (!retrieval) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="mb-3 text-2xl font-bold">No search results to show</h1>
        <p className="mb-6 text-sm text-secondary">Run an alert or question to retrieve mitigation guidance.</p>
        <Button onClick={() => navigate('/')}>Try Another Search</Button>
      </div>
    );
  }

  const technique = alert.technique || alert.techniqueId || '';
  const techniqueName = alert.techniqueName || '';
  const stepCount = retrieval.steps.length;

  async function handleFeedback(helpful) {
    setFeedbackError('');
    setFeedbackLoading(true);
    try {
      await sendFeedback(state.alertId, helpful);
      setFeedback(helpful ? 'Helpful' : 'Not relevant');
    } catch (requestError) {
      setFeedbackError(requestError.message || 'Feedback could not be saved.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 lg:px-8">
      <AlertBanner
        title={alert.detection || alert.rule || alert.alert || 'Incident response query'}
        severity={alert.severity || 'Low'}
        metadata={{
          host: alert.host || '—',
          proc: alert.process || '—',
          detected: alert.timestamp || '—',
        }}
        tag={[technique, techniqueName].filter(Boolean).join(' · ') || 'Technique not identified'}
      />

      {retrieval.conflicts.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-warning/25 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <AlertTriangle size={16} /> Conflicting guidance found
        </div>
      )}

      {stepCount === 0 ? (
        <div className="rounded-xl border border-border bg-panel px-6 py-12 text-center">
          <h2 className="mb-2 text-lg font-semibold">No mitigation found for this alert</h2>
          <p className="mb-6 text-sm text-secondary">Try a different alert or question to search the indexed guidance.</p>
          <Button onClick={() => navigate('/')}>Try Another Search</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Mitigation steps" className="min-w-0">
            {PHASES.map((phase) => {
              const steps = retrieval.steps.filter((step) => step.phase === phase.id);
              if (!steps.length) return null;
              return (
                <div key={phase.id} className="mb-7">
                  <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                    <phase.icon size={16} className={phase.iconColor} />
                    <h2 className="text-xs font-bold tracking-[0.12em] text-secondary">
                      {phase.label} ({steps.length})
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {steps.map((step) => (
                      <StepCard
                        key={`${step.citation.docId}-${step.order}-${step.title}`}
                        step={step}
                        number={step.order}
                        onOpenCitation={() => {}}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-border bg-panel p-5">
              <h2 className="mb-5 text-xs font-bold tracking-[0.14em] text-muted">RETRIEVAL SUMMARY</h2>
              <dl className="space-y-4">
                <SummaryRow label="Confidence"><StatusChip>{retrieval.confidence}</StatusChip></SummaryRow>
                <SummaryRow label="MITRE TECHNIQUE">
                  <span className="font-mono text-[13px] text-primary">{technique || '—'}</span>
                </SummaryRow>
                <SummaryRow label="SOURCES MATCHED">
                  <span className="text-sm font-semibold text-primary">{retrieval.sourcesMatched.length} documents</span>
                </SummaryRow>
                <SummaryRow label="RETRIEVAL TIME">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-primary">
                    <Clock3 size={14} className="text-muted" /> {retrieval.retrievalSeconds.toFixed(3)}s
                  </span>
                </SummaryRow>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-panel p-5">
              <h2 className="mb-4 text-xs font-bold tracking-[0.14em] text-muted">SOURCE DOCUMENTS</h2>
              {sourceDocuments.length ? (
                <ul className="space-y-3">
                  {sourceDocuments.map((document) => (
                    <li key={document.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <p className="break-words text-sm font-semibold text-primary">{document.name}</p>
                      <p className="mt-1 text-xs text-secondary">
                        {[document.version, document.date && `updated ${document.date}`].filter(Boolean).join(' · ') || 'Indexed source'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No source documents matched.</p>}
            </section>

            <section className="rounded-xl border border-border bg-panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <ThumbsUp size={15} className="text-accent" />
                <h2 className="text-sm font-semibold">Was this mitigation helpful?</h2>
              </div>
              {feedback ? (
                <p role="status" className="text-sm font-medium text-success">Thanks for the feedback</p>
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={feedbackLoading} onClick={() => handleFeedback(true)} className="flex-1 px-2 py-2 text-xs">Helpful</Button>
                  <Button variant="secondary" disabled={feedbackLoading} onClick={() => handleFeedback(false)} className="flex-1 px-2 py-2 text-xs">Not relevant</Button>
                </div>
              )}
              {feedbackError && <p role="alert" className="mt-3 text-xs text-critical">{feedbackError}</p>}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div>
      <dt className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
