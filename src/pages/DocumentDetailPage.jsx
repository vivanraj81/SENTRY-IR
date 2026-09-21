import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Button from '../components/Button';
import { mockDocuments } from '../data/mockDocuments';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const document = mockDocuments.find(d => d.id === id) || mockDocuments[0];

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Mitigation Results
        </button>
      </div>

      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">{document.title}</h1>
        {document.id === 'IR-Runbook-Credential-Theft' && (
          <h2 className="text-xl text-secondary mb-6 font-semibold">Section 3.1 · Containment Procedure</h2>
        )}
        
        <div className="flex flex-wrap items-center gap-3">
          {document.version && (
            <span className="px-3 py-1 bg-panel border border-border rounded-full text-[12px] font-mono text-secondary">
              {document.version}
            </span>
          )}
          {(document.updated || document.published) && (
            <span className="px-3 py-1 bg-panel border border-border rounded-full text-[12px] font-mono text-secondary">
              {document.updated ? `Updated ${document.updated}` : `Published ${document.published}`}
            </span>
          )}
          {document.owner && (
            <span className="px-3 py-1 bg-panel border border-border rounded-full text-[12px] font-mono text-secondary">
              Owner: {document.owner}
            </span>
          )}
        </div>
      </div>

      <div className="bg-panel border border-border rounded-md p-8 shadow-sm max-w-4xl font-mono text-[14px] leading-relaxed text-primary">
        <div className="whitespace-pre-wrap">
          {document.content.split('\n\n').map((paragraph, idx) => {
            if (paragraph.startsWith('Do not power off')) {
              return (
                <div key={idx} className="my-6 p-4 border border-critical/30 bg-critical/5 rounded-md border-l-4 border-l-critical">
                  <span className="font-bold text-critical block mb-1">WARNING</span>
                  <span className="text-primary">{paragraph}</span>
                </div>
              );
            }
            return <p key={idx} className="mb-6 last:mb-0">{paragraph}</p>;
          })}
        </div>
      </div>

      <div className="mt-8">
        <Button className="flex items-center gap-2">
          Open Full Document
          <ExternalLink size={16} />
        </Button>
      </div>
    </div>
  );
}
