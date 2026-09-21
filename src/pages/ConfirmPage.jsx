import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import SeverityBadge from '../components/SeverityBadge';
import { mockAlerts } from '../data/mockAlerts';

export default function ConfirmPage() {
  const navigate = useNavigate();
  const alertId = sessionStorage.getItem('currentAlertId') || 'alert-1';
  const alert = mockAlerts.find(a => a.id === alertId) || mockAlerts[0];

  const handleConfirm = () => {
    navigate('/results');
  };

  return (
    <div className="flex-1 flex flex-col items-center py-12 px-6 max-w-3xl mx-auto w-full">
      <div className="text-center mb-10">
        <h1 className="text-[26px] font-bold mb-3">Confirm what we extracted</h1>
        <p className="text-[18px] font-semibold text-secondary">
          Review the entities pulled from the raw alert. Edit any tag before we search the knowledge base.
        </p>
      </div>

      <div className="w-full mb-10">
        <h3 className="text-sm font-bold text-secondary mb-3 uppercase tracking-wider">RAW ALERT</h3>
        <div className="bg-panel border border-border rounded-md p-4 overflow-x-auto">
          <pre className="font-mono text-[13px] text-primary whitespace-pre-wrap">
            {alert.raw}
          </pre>
        </div>
      </div>

      <div className="w-full mb-12">
        <h3 className="text-sm font-bold text-secondary mb-4 uppercase tracking-wider">EXTRACTED ENTITIES</h3>
        <div className="flex flex-col gap-3">
          <EntityRow label="Host" value={alert.host} />
          <EntityRow label="Process" value={alert.process} />
          <EntityRow label="MITRE Technique" value={`${alert.techniqueId} — ${alert.techniqueName}`} status="Confirmed" />
          <EntityRow label="Severity" value={<SeverityBadge severity={alert.severity} />} status="Confirmed" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        <Button onClick={handleConfirm}>Confirm & Search</Button>
      </div>
    </div>
  );
}

function EntityRow({ label, value, status }) {
  return (
    <div className="flex items-center justify-between p-4 bg-panel border border-border rounded-md hover:bg-panel-alt transition-colors group">
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 items-center">
        <span className="text-sm font-semibold text-secondary">{label}</span>
        <span className="text-sm font-mono text-primary col-span-1 md:col-span-2">{value}</span>
      </div>
      <div className="flex items-center gap-4 pl-4">
        {status ? (
          <span className="text-xs font-semibold text-success uppercase tracking-wider">{status}</span>
        ) : (
          <button className="text-sm font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
            [Edit]
          </button>
        )}
      </div>
    </div>
  );
}
