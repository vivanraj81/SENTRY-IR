import { Clock3, Cpu, Monitor } from 'lucide-react';
import SeverityBadge from './SeverityBadge';

function formatUtc(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default function AlertBanner({ title, metadata = {}, tag, severity = 'low' }) {
  return (
    <section className="mb-6 rounded-xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            <h1 className="break-words text-lg font-semibold leading-6 text-primary">{title}</h1>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-secondary">
            <span className="inline-flex items-center gap-1.5"><Monitor size={13} className="text-muted" /> host: {metadata.host || '—'}</span>
            <span className="inline-flex items-center gap-1.5"><Cpu size={13} className="text-muted" /> proc: {metadata.proc || '—'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={13} className="text-muted" /> detected: {formatUtc(metadata.detected)} UTC</span>
          </div>
        </div>
        {tag && (
          <span className="w-fit shrink-0 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 font-mono text-xs text-accent">
            {tag}
          </span>
        )}
      </div>
    </section>
  );
}
