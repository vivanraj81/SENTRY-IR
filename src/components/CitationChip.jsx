import { FileText } from 'lucide-react';

export default function CitationChip({ citation, onClick }) {
  const label = typeof citation === 'string'
    ? citation
    : citation?.reference || [citation?.docName, citation?.section && `§${citation.section}`].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-alt px-2 py-1 text-left font-mono text-[11px] text-secondary transition-colors hover:border-accent/50 hover:text-accent"
      >
        <FileText size={12} />
        {label || 'Source'}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-alt px-2 py-1 font-mono text-[11px] text-secondary">
      <FileText size={12} />
      {label || 'Source'}
    </span>
  );
}
