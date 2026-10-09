export default function StatusChip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-border bg-panel-alt text-secondary',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    critical: 'border-critical/30 bg-critical/10 text-critical',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}
