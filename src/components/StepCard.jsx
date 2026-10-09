import { RotateCcw, SearchCheck, ShieldCheck } from 'lucide-react';
import CitationChip from './CitationChip';

const PHASE_STYLES = {
  immediate: {
    icon: ShieldCheck,
    number: 'border-critical/30 bg-critical/10 text-critical',
    iconColor: 'text-critical',
  },
  investigate: {
    icon: SearchCheck,
    number: 'border-warning/30 bg-warning/10 text-warning',
    iconColor: 'text-warning',
  },
  recover: {
    icon: RotateCcw,
    number: 'border-success/30 bg-success/10 text-success',
    iconColor: 'text-success',
  },
};

export default function StepCard({ step, number, onOpenCitation }) {
  const style = PHASE_STYLES[step.phase] || PHASE_STYLES.investigate;
  const PhaseIcon = style.icon;

  return (
    <article className="rounded-lg border border-border bg-panel p-4 transition-colors hover:border-accent/40 sm:p-5">
      <div className="flex gap-3.5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold ${style.number}`}>
            {number}
          </span>
          <PhaseIcon size={15} className={style.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-[15px] font-semibold leading-5 text-primary">{step.title}</h3>
          <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-secondary">{step.description}</p>
          <CitationChip citation={step.citation} onClick={() => onOpenCitation?.(step.citation)} />
        </div>
      </div>
    </article>
  );
}
