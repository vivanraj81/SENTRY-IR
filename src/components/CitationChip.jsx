import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function CitationChip({ citation, to }) {
  if (to) {
    return (
      <Link 
        to={to}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-panel-alt border border-border text-[11px] font-mono text-secondary hover:text-accent hover:border-accent/50 transition-colors"
      >
        <FileText size={12} />
        {citation}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-panel-alt border border-border text-[11px] font-mono text-secondary">
      <FileText size={12} />
      {citation}
    </span>
  );
}
