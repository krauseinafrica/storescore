import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { KnowledgeContext } from '../context/KnowledgeContext';
import TierBadge from './TierBadge';

export default function HelpModal() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx || !ctx.activeHelp) return null;

  const { section, articleTitle, articleSlug, appRoute } = ctx.activeHelp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={ctx.closeHelp}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{section.title}</h2>
            <TierBadge tier={section.feature_tier} />
          </div>
          <button
            onClick={ctx.closeHelp}
            className="ml-3 flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_a]:text-primary-600 [&_a]:underline [&_strong]:font-semibold [&_p]:mt-2 [&_p:first-child]:mt-0 [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-1 [&_h4]:font-medium [&_h4]:text-gray-800 [&_h4]:mt-3 [&_table]:w-full [&_table]:mt-2 [&_th]:text-left [&_th]:py-1 [&_th]:px-2 [&_th]:bg-gray-50 [&_th]:text-xs [&_th]:font-semibold [&_td]:py-1 [&_td]:px-2 [&_td]:text-xs [&_td]:border-t [&_td]:border-gray-100"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Link
            to={`/help/${articleSlug}#${section.anchor}`}
            onClick={ctx.closeHelp}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Read full article &rarr;
          </Link>
          {appRoute && (
            <Link
              to={appRoute}
              onClick={ctx.closeHelp}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Go to feature &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
