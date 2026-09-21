import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, CheckCircle2 } from 'lucide-react';
import Button from '../components/Button';
import { mockAlerts } from '../data/mockAlerts';
import { mockMitigations } from '../data/mockMitigations';

export default function NoResultPage() {
  const navigate = useNavigate();
  const alertId = sessionStorage.getItem('currentAlertId') || 'alert-2';
  const alert = mockAlerts.find(a => a.id === alertId) || mockAlerts[1];
  const mitigation = mockMitigations[alertId];
  
  const [escalated, setEscalated] = useState(false);

  const handleEscalate = () => {
    setEscalated(true);
    setTimeout(() => {
      setEscalated(false);
    }, 3000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full text-center">
      <div className="w-20 h-20 rounded-full bg-panel border-4 border-border flex items-center justify-center mb-8 mx-auto text-secondary">
        <HelpCircle size={40} strokeWidth={1.5} />
      </div>
      
      <h1 className="text-3xl font-bold mb-4">No mitigation found for this alert</h1>
      
      <p className="text-[16px] text-secondary mb-12 max-w-lg mx-auto">
        {mitigation?.message || `The knowledge base has no runbook or advisory matching '${alert.detection}' or its detected technique.`}
      </p>

      <div className="w-full bg-panel border border-border rounded-md p-8 text-left mb-10">
        <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-6">SUGGESTED NEXT STEPS</h3>
        
        <ul className="space-y-4 text-[15px]">
          <li className="flex items-start gap-3">
            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-accent"></div>
            <span>Escalate to the on-call IR lead for manual triage</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-accent"></div>
            <span>Search MITRE ATT&CK directly for related techniques</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-accent"></div>
            <span>Flag this alert type so a runbook can be authored</span>
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-4 justify-center">
        <Button variant="secondary" onClick={() => navigate('/')}>
          Try Another Search
        </Button>
        <Button onClick={handleEscalate} disabled={escalated} className="w-40">
          {escalated ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Escalated
            </span>
          ) : (
            'Escalate Now'
          )}
        </Button>
      </div>
    </div>
  );
}
