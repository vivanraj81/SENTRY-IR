import React from 'react';

export default function MetricCard({ label, value, subtext }) {
  return (
    <div className="bg-panel border border-border rounded-md p-5 flex flex-col justify-between">
      <div className="flex items-end justify-between mb-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">{label}</h3>
        <span className="text-2xl font-bold text-primary leading-none">{value}</span>
      </div>
      {subtext && (
        <p className="text-xs font-semibold text-secondary">{subtext}</p>
      )}
    </div>
  );
}
