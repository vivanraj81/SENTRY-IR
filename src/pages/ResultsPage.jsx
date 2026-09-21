import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertBanner from '../components/AlertBanner';
import StepCard from '../components/StepCard';
import Button from '../components/Button';
import { mockAlerts } from '../data/mockAlerts';
import { mockMitigations } from '../data/mockMitigations';

export default function ResultsPage() {
  const navigate = useNavigate();
  const alertId = sessionStorage.getItem('currentAlertId') || 'alert-1';
  const alert = mockAlerts.find(a => a.id === alertId) || mockAlerts[0];
  const mitigation = mockMitigations[alertId];

  // If this alert should lead to conflict or no-result, redirect
  if (mitigation.type === 'no-result') {
    navigate('/no-result', { replace: true });
    return null;
  }
  
  if (mitigation.type === 'conflict') {
    navigate('/conflict', { replace: true });
    return null;
  }

  const [feedback, setFeedback] = useState(null);

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
      <AlertBanner 
        title={alert.detection}
        severity={alert.severity}
        metadata={{
          host: alert.host,
          proc: alert.process,
          detected: alert.timestamp.replace('T', ' ').replace('Z', ' UTC')
        }}
        tag={`${alert.techniqueId} · ${alert.techniqueName}`}
      />

      <div className="flex flex-col lg:flex-row gap-8 mt-2">
        {/* Main Mitigations Column */}
        <div className="flex-1">
          {mitigation.sections.map((section, idx) => (
            <div key={idx} className="mb-10">
              <h3 className="text-[13px] font-bold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">
                {section.title} ({section.count})
              </h3>
              <div className="flex flex-col gap-4">
                {section.steps.map(step => (
                  <StepCard key={step.id} step={step} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Sidebar - Retrieval Summary */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="bg-panel border border-border rounded-md p-5">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-5">RETRIEVAL SUMMARY</h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1">Confidence</div>
                <div className="text-sm font-semibold text-success">{mitigation.summary.confidence}</div>
              </div>
              
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1">MITRE TECHNIQUE</div>
                <div className="text-sm font-mono text-primary">{mitigation.summary.technique}</div>
              </div>
              
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1">SOURCES MATCHED</div>
                <div className="text-sm font-semibold text-primary">{mitigation.summary.sourcesMatched} documents</div>
              </div>
              
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-1">RETRIEVAL TIME</div>
                <div className="text-sm font-mono text-primary">{mitigation.summary.retrievalTime}</div>
              </div>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-md p-5">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">SOURCE DOCUMENTS</h3>
            
            <div className="flex flex-col gap-4">
              {mitigation.summary.documents.map((doc, idx) => (
                <div key={idx} className="flex flex-col border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <span className="text-sm font-bold text-accent hover:underline cursor-pointer mb-1 break-all" onClick={() => navigate(`/document/${doc.id}`)}>
                    {doc.title}
                  </span>
                  <span className="text-[12px] text-secondary">
                    {doc.version && `${doc.version} · `}{doc.updated ? `updated ${doc.updated}` : `published ${doc.published}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-md p-5 text-center">
            <h3 className="text-sm font-semibold mb-4">Was this mitigation helpful?</h3>
            <div className="flex gap-3 justify-center">
              <Button 
                variant={feedback === 'helpful' ? 'primary' : 'secondary'} 
                onClick={() => setFeedback('helpful')}
                className="flex-1 py-1.5"
              >
                Helpful
              </Button>
              <Button 
                variant={feedback === 'not-helpful' ? 'primary' : 'secondary'} 
                onClick={() => setFeedback('not-helpful')}
                className="flex-1 py-1.5"
              >
                Not relevant
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
