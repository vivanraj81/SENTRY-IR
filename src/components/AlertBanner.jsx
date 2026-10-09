import React from 'react';

export default function AlertBanner({ title, metadata, tag, severity = 'critical' }) {
  const normalized = severity.toLowerCase();
  const color = normalized === 'critical' ? 'critical' : normalized === 'high' ? 'warning' : normalized === 'medium' ? 'accent' : 'success';
  const colorClasses = {
    critical: 'border-critical/30 bg-critical/5 text-critical',
    warning: 'border-warning/30 bg-warning/5 text-warning',
    accent: 'border-accent/30 bg-accent/5 text-accent',
    success: 'border-success/30 bg-success/5 text-success',
  }[color];
  
  return (
    <div className={`mb-6 rounded-xl border ${colorClasses}`}>
      <div className={`flex items-center gap-3 border-b px-4 py-2 ${colorClasses}`}>
        <div className={`h-2 w-2 rounded-full bg-current ${normalized === 'high' ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-bold tracking-wider uppercase">
          {normalized}
        </span>
      </div>
      <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          {metadata && (
            <div className="flex flex-wrap gap-4 text-sm font-mono text-secondary">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted">{key}:</span> <span className="text-primary">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {tag && (
          <div className="rounded border border-border bg-panel px-3 py-1 font-mono text-xs text-secondary whitespace-nowrap">
            {tag}
          </div>
        )}
      </div>
    </div>
  );
}
