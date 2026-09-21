import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Button from '../components/Button';
import { mockMitigations } from '../data/mockMitigations';
import { mockAlerts } from '../data/mockAlerts';

export default function ConflictPage() {
  const navigate = useNavigate();
  const alertId = sessionStorage.getItem('currentAlertId') || 'alert-3';
  const alert = mockAlerts.find(a => a.id === alertId) || mockAlerts[2];
  const mitigation = mockMitigations[alertId];

  if (!mitigation || mitigation.type !== 'conflict') {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
      <div className="border border-warning/30 bg-warning/5 rounded-md mb-10 overflow-hidden">
        <div className="px-5 py-3 border-b border-warning/20 flex items-center gap-3">
          <AlertTriangle className="text-warning" size={18} />
          <span className="text-sm font-bold tracking-wider uppercase text-warning">
            Conflicting guidance found
          </span>
        </div>
        <div className="p-6">
          <p className="text-lg font-semibold whitespace-pre-wrap">
            {mitigation.message}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-6">COMPARE SOURCES</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {mitigation.cards.map(card => (
          <div key={card.id} className="bg-panel border border-border rounded-md p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-xl font-bold text-accent hover:underline cursor-pointer mb-2" onClick={() => navigate(`/document/${card.id}`)}>
                  {card.title}
                </h4>
                <div className="text-sm text-secondary font-mono">
                  {card.version} · {card.date}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${card.badge === 'Newer' ? 'bg-success/20 text-success border border-success/30' : 'bg-critical/20 text-critical border border-critical/30'}`}>
                {card.badge}
              </span>
            </div>
            
            <div className="mt-4 p-4 bg-panel-alt border border-border rounded border-l-4 border-l-accent flex-1">
              <p className="text-sm italic text-primary leading-relaxed font-mono">
                {card.quote}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-panel border border-border rounded-md p-6">
        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Recommendation</h3>
        <p className="text-[15px] leading-relaxed mb-6">
          {mitigation.recommendation}
        </p>
        
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/')}>Use v3.2 Guidance</Button>
          <Button variant="secondary">Flag for Runbook Owner</Button>
        </div>
      </div>
    </div>
  );
}
