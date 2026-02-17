import { useContext } from 'react';
import { KnowledgeContext } from '../context/KnowledgeContext';

interface InfoButtonProps {
  contextKey: string;
  className?: string;
}

export default function InfoButton({ contextKey, className = '' }: InfoButtonProps) {
  const ctx = useContext(KnowledgeContext);

  // Graceful degradation: render nothing if no content found or context not loaded
  if (!ctx || ctx.loading) return null;
  const found = ctx.findSection(contextKey);
  if (!found) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.openHelp(contextKey);
      }}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors ${className}`}
      title="Learn more"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}
