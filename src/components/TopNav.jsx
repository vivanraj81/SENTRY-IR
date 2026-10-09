import { Link } from 'react-router-dom';
import { CircleUserRound } from 'lucide-react';

export default function TopNav() {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-panel border-b border-border">
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="w-3 h-3 rounded-full bg-accent"></div>
        <div className="flex flex-col">
          <span className="font-bold text-[16px] leading-tight">SENTRY-IR</span>
          <span className="text-[12px] text-muted leading-tight">Mitigation Retrieval</span>
        </div>
      </Link>
      
      <div className="flex items-center gap-6">
        <Link to="/admin" className="text-sm font-semibold text-secondary hover:text-primary transition-colors">
          Knowledge Base
        </Link>
        <div className="flex items-center gap-2 border-l border-border pl-6">
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-muted leading-tight uppercase tracking-wider">Analyst</span>
            <span className="text-sm font-semibold leading-tight">R. Menon</span>
          </div>
          <CircleUserRound className="w-8 h-8 text-accent" strokeWidth={1.5} />
        </div>
      </div>
    </header>
  );
}
