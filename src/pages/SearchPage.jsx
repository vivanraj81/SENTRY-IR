import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { mockAlerts } from '../data/mockAlerts';

export default function SearchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('paste');
  const [inputText, setInputText] = useState('');

  const handleRetrieve = () => {
    if (!inputText.trim()) return;
    
    // Find if the pasted text matches any of our mock alerts
    const matchedAlert = mockAlerts.find(a => a.raw === inputText);
    
    if (matchedAlert) {
      // Store in session storage to pass to confirm page
      sessionStorage.setItem('currentAlertId', matchedAlert.id);
    } else {
      // Create a dummy alert for unknown text
      sessionStorage.setItem('currentAlertId', 'alert-1'); // Fallback to alert-1
    }
    
    navigate('/confirm');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
      <div className="text-center mb-12">
        <h1 className="text-[26px] font-bold mb-4">Find the exact mitigation step</h1>
        <p className="text-[18px] font-semibold text-secondary max-w-2xl mx-auto">
          Paste a raw alert or ask in plain language — SENTRY-IR retrieves the step, not the whole document.
        </p>
      </div>

      <div className="w-full mb-8">
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-panel rounded-md p-1 border border-border">
            <button
              className={`px-6 py-2 text-sm font-semibold rounded ${activeTab === 'paste' ? 'bg-panel-alt text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
              onClick={() => setActiveTab('paste')}
            >
              Paste Alert
            </button>
            <button
              className={`px-6 py-2 text-sm font-semibold rounded ${activeTab === 'ask' ? 'bg-panel-alt text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
              onClick={() => setActiveTab('ask')}
            >
              Ask a Question
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            className="w-full h-64 bg-panel border border-border rounded-md p-6 font-mono text-[13px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none placeholder-muted"
            placeholder={activeTab === 'paste' ? '{\n  "detection": "Suspicious LSASS Access",\n  "host": "FIN-WS-07",\n  "process": "rundll32.exe",\n  "rule": "Sigma_T1003_001"\n}' : 'e.g., How do I isolate a host after LSASS dumping?'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          ></textarea>
        </div>

        <div className="mt-6 flex justify-center">
          <Button onClick={handleRetrieve} className="px-8 py-3 text-[16px]">
            Retrieve Mitigation
          </Button>
        </div>
      </div>

      <div className="w-full pt-8 border-t border-border">
        <h3 className="text-[12px] font-bold text-muted tracking-wider uppercase mb-4">RECENT / SAMPLE ALERTS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockAlerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => setInputText(alert.raw)}
              className="flex flex-col items-start p-4 bg-panel rounded-md border border-border hover:border-accent/50 transition-colors text-left"
            >
              <span className="font-semibold text-sm mb-2">{alert.detection}</span>
              <div className="text-[12px] font-mono text-secondary flex items-center gap-2">
                <span>{alert.host}</span>
                <span className="text-muted">•</span>
                <span>{alert.techniqueId}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
