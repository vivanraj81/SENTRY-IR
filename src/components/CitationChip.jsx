import { FileText } from 'lucide-react';

export default function CitationChip({ citation, onClick }) {
  const label = typeof citation === 'string'
    ? citation
    : [citation?.docName, citation?.section && `§${citation.section}`].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(citation)}
        className="inline-flex items-center gap-1.5 rounded bg-panel-alt border border-border px-2 py-1 text-left text-[11px] font-mono text-secondary transition-colors hover:border-accent/50 hover:text-accent"
      >
        <FileText size={12} />
        {label || 'Source'}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-panel-alt border border-border text-[11px] font-mono text-secondary">
      <FileText size={12} />
      {label || 'Source'}
    </span>
  );
}
