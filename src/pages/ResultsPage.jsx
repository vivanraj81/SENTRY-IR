import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock3, SearchCheck, ShieldCheck, RotateCcw } from 'lucide-react';
import AlertBanner from '../components/AlertBanner';
import StepCard from '../components/StepCard';
import Button from '../components/Button';
import StatusChip from '../components/StatusChip';
import EvidenceViewer from '../components/EvidenceViewer';
import ConflictWarning from '../components/ConflictWarning';
import NoResultPage from './NoResultPage';
import { PHASES, sendFeedback } from '../api';

const PHASE_PRESENTATION = {
  immediate: { title: 'IMMEDIATE — DO NOW', icon: ShieldCheck, color: 'text-critical' },
  investigate: { title: 'INVESTIGATE', icon: SearchCheck, color: 'text-warning' },
  recover: { title: 'RECOVER', icon: RotateCcw, color: 'text-success' },
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const retrieval = state?.retrieval;
  const alert = state?.alert || {};
  const [citation, setCitation] = useState(null);
  const [feedback, setFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  if (!retrieval) {
    return <div className="m-auto p-8 text-center"><p className="mb-4">No retrieval to display.</p><Button onClick={() => navigate('/')}>Try Another Search</Button></div>;
  }

  if (!retrieval.steps.length) return <NoResultPage alert={alert} />;

  async function submitFeedback(helpful) {
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      await sendFeedback(state.alertId, helpful);
      setFeedback(true);
    } catch (requestError) {
      setFeedbackError(requestError.message || 'Feedback could not be saved.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  const technique = alert.technique || '';
  const techniqueName = alert.techniqueName || '';
  const detection = alert.detection || alert.rule || alert.alert || alert.query || 'Security incident query';
  const sourceDocuments = state.documents || [];
  const displayOrder = new Map(
    PHASES.flatMap((phase) => retrieval.steps.filter((step) => step.phase === phase))
      .map((step, index) => [step, index + 1]),
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 lg:px-8">
      <AlertBanner
        title={detection}
        severity={alert.severity || 'Low'}
        metadata={{
          host: alert.host || '—',
          proc: alert.process || '—',
          detected: alert.timestamp || '—',
        }}
        tag={[technique, techniqueName].filter(Boolean).join(' · ') || 'Technique not identified'}
      />
      <ConflictWarning conflicts={retrieval.conflicts} documents={sourceDocuments} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Mitigation steps" className="min-w-0">
          {PHASES.map((phase) => {
            const steps = retrieval.steps.filter((step) => step.phase === phase);
            if (!steps.length) return null;
            const presentation = PHASE_PRESENTATION[phase];
            const PhaseIcon = presentation.icon;
            return (
              <section key={phase} className="mb-7">
                <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                  <PhaseIcon size={16} className={presentation.color} />
                  <h2 className="text-xs font-bold tracking-[0.12em] text-secondary">{presentation.title} ({steps.length})</h2>
                </div>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <StepCard
                      key={`${step.citation.docId}-${step.order}-${step.title}`}
                      step={step}
                      number={displayOrder.get(step)}
                      onOpenCitation={setCitation}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-panel p-5">
            <h2 className="mb-5 text-xs font-bold tracking-[0.14em] text-muted">RETRIEVAL SUMMARY</h2>
            <dl className="space-y-4">
              <SummaryRow label="CONFIDENCE"><StatusChip>{retrieval.confidence}</StatusChip></SummaryRow>
              <SummaryRow label="MITRE TECHNIQUE"><span className="font-mono text-[13px]">{technique || '—'}</span></SummaryRow>
              <SummaryRow label="SOURCES MATCHED"><span className="text-sm font-semibold">{retrieval.sourcesMatched.length} documents</span></SummaryRow>
              <SummaryRow label="RETRIEVAL TIME"><span className="inline-flex items-center gap-1.5 font-mono text-[13px]"><Clock3 size={14} className="text-muted" /> {retrieval.retrievalSeconds.toFixed(3)}s</span></SummaryRow>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-panel p-5">
            <h2 className="mb-4 text-xs font-bold tracking-[0.14em] text-muted">SOURCE DOCUMENTS</h2>
            <ul className="space-y-3">
              {retrieval.sourcesMatched.map((name) => {
                const doc = sourceDocuments.find((item) => item.title === name || item.name === name || item.id === name);
                return (
                  <li key={name} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="break-words text-sm font-semibold text-primary">{doc?.title || doc?.name || name}</p>
                    <p className="mt-1 text-xs text-secondary">{doc?.version ? `${doc.version} · ` : ''}{doc?.date ? `updated ${doc.date}` : 'Indexed source'}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-panel p-5">
            <h2 className="mb-4 text-sm font-semibold">Was this mitigation helpful?</h2>
            {feedback ? (
              <p role="status" className="text-sm font-semibold text-success">Thanks for the feedback</p>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" disabled={feedbackLoading} onClick={() => submitFeedback(true)} className="flex-1 text-xs">Helpful</Button>
                <Button variant="secondary" disabled={feedbackLoading} onClick={() => submitFeedback(false)} className="flex-1 text-xs">Not relevant</Button>
              </div>
            )}
            {feedbackError && <p role="alert" className="mt-3 text-xs text-critical">{feedbackError}</p>}
          </section>
        </aside>
      </div>
      {citation && <EvidenceViewer citation={citation} onClose={() => setCitation(null)} />}
    </div>
  );
}

function SummaryRow({ label, children }) {
  return <div><dt className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-muted">{label}</dt><dd>{children}</dd></div>;
}
