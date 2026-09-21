import React from 'react';

export default function AlertBanner({ title, metadata, tag, severity = 'critical' }) {
  const isCritical = severity.toLowerCase() === 'critical';
  
  return (
    <div className={`border rounded-md mb-6 ${isCritical ? 'border-critical/30 bg-critical/5' : 'border-warning/30 bg-warning/5'}`}>
      <div className={`px-4 py-2 border-b ${isCritical ? 'border-critical/20' : 'border-warning/20'} flex items-center gap-3`}>
        <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-critical' : 'bg-warning animate-pulse'}`}></div>
        <span className={`text-xs font-bold tracking-wider uppercase ${isCritical ? 'text-critical' : 'text-warning'}`}>
          {isCritical ? 'CRITICAL' : 'WARNING'}
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
          <div className="px-3 py-1 bg-panel border border-border rounded font-mono text-xs text-secondary whitespace-nowrap">
            {tag}
          </div>
        )}
      </div>
    </div>
  );
}
