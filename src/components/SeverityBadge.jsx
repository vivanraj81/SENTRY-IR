import React from 'react';

export default function SeverityBadge({ severity }) {
  const normalized = severity.toLowerCase();
  
  let colorClass = '';
  switch (normalized) {
    case 'critical':
      colorClass = 'bg-critical/20 text-critical border-critical/30';
      break;
    case 'high':
      colorClass = 'bg-warning/20 text-warning border-warning/30';
      break;
    case 'medium':
      colorClass = 'bg-accent/20 text-accent border-accent/30';
      break;
    case 'low':
      colorClass = 'bg-panel-alt text-secondary border-border';
      break;
    case 'resolved':
      colorClass = 'bg-success/20 text-success border-success/30';
      break;
    default:
      colorClass = 'bg-panel-alt text-secondary border-border';
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${colorClass}`}>
      {severity}
    </span>
  );
}
