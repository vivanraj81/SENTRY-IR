export default function StatusChip({ children, tone = 'success' }) {
  const colors = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    neutral: 'border-border bg-panel-alt text-secondary',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[tone] || colors.neutral}`}>
      {children}
    </span>
  );
}
