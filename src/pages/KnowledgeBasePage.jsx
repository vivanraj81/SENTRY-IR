import React, { useState } from 'react';
import { Upload, X, File, FileText } from 'lucide-react';
import Button from '../components/Button';
import MetricCard from '../components/MetricCard';
import { mockDocuments as initialDocs } from '../data/mockDocuments';

export default function KnowledgeBasePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState(initialDocs);

  const handleUpload = (newDoc) => {
    setDocuments(prev => [newDoc, ...prev]);
    setIsModalOpen(false);
    
    // Simulate parsing delay
    setTimeout(() => {
      setDocuments(prev => prev.map(d => 
        d.id === newDoc.id ? { ...d, status: 'Indexed', chunks: 12 } : d
      ));
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-[26px] font-bold mb-2">Knowledge Base</h1>
          <p className="text-secondary font-semibold">Ingested documents, parsing status, and feed sync</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Upload size={16} />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <MetricCard label="DOCUMENTS" value={184} subtext="runbooks, advisories, threat intel" />
        <MetricCard label="CHUNKS INDEXED" value="6,412" subtext="step-level + product-level" />
        <MetricCard label="CVE FEED SYNC" value="12m ago" subtext="NVD · auto-sync every 30m" />
        <MetricCard label="PARSING QUEUE" value={documents.filter(d => d.status === 'Parsing').length} subtext="ETA ~2 min" />
      </div>

      <div className="bg-panel border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-panel-alt">
                <th className="py-4 px-6 text-xs font-bold text-muted uppercase tracking-wider w-1/2">DOCUMENT</th>
                <th className="py-4 px-6 text-xs font-bold text-muted uppercase tracking-wider">TYPE</th>
                <th className="py-4 px-6 text-xs font-bold text-muted uppercase tracking-wider">CHUNKS</th>
                <th className="py-4 px-6 text-xs font-bold text-muted uppercase tracking-wider">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc, idx) => (
                <tr key={idx} className="hover:bg-panel-alt/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-secondary" />
                      <span className="font-semibold text-primary">{doc.title}{doc.title.includes('.') ? '' : '.pdf'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-secondary">{doc.type}</td>
                  <td className="py-4 px-6 text-sm font-mono text-secondary">{doc.chunks || '—'}</td>
                  <td className="py-4 px-6">
                    <StatusBadge status={doc.status} flagged={doc.flagged} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <UploadModal onClose={() => setIsModalOpen(false)} onUpload={handleUpload} />
      )}
    </div>
  );
}

function StatusBadge({ status, flagged }) {
  if (status === 'Indexed') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success border border-success/20">Indexed</span>;
  }
  if (status === 'Parsing') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent/10 text-accent border border-accent/20 animate-pulse">Parsing</span>;
  }
  if (status === 'Stale') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-critical/10 text-critical border border-critical/20">
        Stale {flagged && '· flagged'}
      </span>
    );
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-panel-alt text-secondary border border-border">{status}</span>;
}

function UploadModal({ onClose, onUpload }) {
  const [docType, setDocType] = useState('Runbook');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleSimulateUpload = () => {
    if (!fileName) {
      setFileName('IR-Runbook-New-Threat.pdf');
      return;
    }
    
    onUpload({
      id: `new-doc-${Date.now()}`,
      title: fileName,
      type: docType,
      version: 'v1.0',
      updated: 'Just now',
      chunks: 0,
      status: 'Parsing',
      owner: 'SOC Analyst',
      content: 'Pending...'
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">Upload Document</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-bold text-secondary mb-2 uppercase tracking-wider">Document Type</label>
            <select 
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-panel-alt border border-border rounded-md px-4 py-2 text-sm text-primary focus:outline-none focus:border-accent"
            >
              <option>Runbook</option>
              <option>Advisory</option>
              <option>Threat Intel</option>
            </select>
          </div>

          <div 
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-colors ${
              isDragging ? 'border-accent bg-accent/5' : 'border-border bg-panel-alt/50 hover:bg-panel-alt hover:border-muted'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              setFileName(e.dataTransfer.files[0]?.name || 'uploaded-file.pdf');
            }}
          >
            {fileName ? (
              <div className="flex flex-col items-center gap-2">
                <File className="text-accent mb-2" size={32} />
                <span className="text-sm font-semibold text-primary">{fileName}</span>
                <span className="text-[12px] text-success">Ready to upload</span>
              </div>
            ) : (
              <>
                <Upload className="text-secondary mb-4" size={32} />
                <p className="text-sm font-semibold text-primary mb-1">Drag and drop file here</p>
                <p className="text-[12px] text-secondary mb-4">or click to browse</p>
                <Button variant="secondary" onClick={() => setFileName('IR-Runbook-New-Threat.pdf')} className="text-[12px] py-1.5 px-3">
                  Choose File
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="p-5 border-t border-border flex justify-end gap-3 bg-panel-alt/30">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSimulateUpload} disabled={!fileName}>
            Upload to Index
          </Button>
        </div>
      </div>
    </div>
  );
}
