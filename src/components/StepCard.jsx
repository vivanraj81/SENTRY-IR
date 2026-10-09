import React, { useState } from 'react';
import { Check } from 'lucide-react';
import CitationChip from './CitationChip';

export default function StepCard({ step, number, onOpenCitation }) {
  const [completed, setCompleted] = useState(false);

  return (
    <div className={`relative p-5 rounded-md border transition-all duration-200 ${completed ? 'bg-panel/50 border-success/30 opacity-70' : 'bg-panel border-border hover:border-accent/40'}`}>
      <div className="flex gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-xs font-bold text-accent">{number}</span>
          <button 
            type="button"
            onClick={() => setCompleted(!completed)}
            aria-label={completed ? 'Mark step incomplete' : 'Mark step complete'}
            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${completed ? 'bg-success border-success' : 'bg-panel-alt border-muted hover:border-accent'}`}
          >
            {completed && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        </div>
        
        <div className="flex-1">
          <h4 className={`text-base font-bold mb-2 ${completed ? 'text-secondary line-through decoration-muted' : 'text-primary'}`}>
            {step.title}
          </h4>
          <p className="text-sm text-secondary mb-4 whitespace-pre-wrap leading-relaxed">
            {step.description}
          </p>
          
          <div className="flex items-center gap-3">
            <CitationChip citation={step.citation} onClick={onOpenCitation} />
          </div>
        </div>
      </div>
    </div>
  );
}
