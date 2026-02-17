import { useContext, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { KnowledgeContext } from '../context/KnowledgeContext';
import TierBadge from '../components/TierBadge';

const CATEGORY_LABELS: Record<string, string> = {
  getting_started: 'Getting Started',
  store_management: 'Store Management',
  evaluations: 'Evaluations',
  action_tracking: 'Action Tracking',
  ai_features: 'AI Features',
  reports: 'Reports',
  scheduling: 'Scheduling',
  team: 'Team',
  settings: 'Settings',
  billing: 'Billing',
};

export default function KnowledgeArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const ctx = useContext(KnowledgeContext);

  const article = useMemo(() => {
    if (!ctx || !slug) return null;
    return ctx.articles.find((a) => a.slug === slug) || null;
  }, [ctx, slug]);

  // Scroll to anchor on load or hash change
  useEffect(() => {
    if (!article) return;
    const hash = location.hash.replace('#', '');
    if (hash) {
      // Small delay for DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo(0, 0);
    }
  }, [article, location.hash]);

  if (!ctx) return null;

  if (ctx.loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading...</div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Article not found.</p>
        <Link to="/help" className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700">
          &larr; Back to Help Center
        </Link>
      </div>
    );
  }

  const sections = article.sections || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/help" className="hover:text-primary-600">Help Center</Link>
        <span>/</span>
        <span>{CATEGORY_LABELS[article.category] || article.category}</span>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{article.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{article.summary}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {CATEGORY_LABELS[article.category] || article.category}
            </span>
            <TierBadge tier={article.feature_tier} />
          </div>
        </div>
        {article.app_route && (
          <Link
            to={article.app_route}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go to feature
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        )}
      </div>

      {/* Table of Contents */}
      {sections.length > 1 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">In this article</h2>
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.anchor}`}
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <div
            key={section.id}
            id={section.anchor}
            className="scroll-mt-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
              <TierBadge tier={section.feature_tier} />
            </div>
            <div
              className="text-sm text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_a]:text-primary-600 [&_a]:underline [&_strong]:font-semibold [&_p]:mt-2 [&_p:first-child]:mt-0 [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-1 [&_h4]:font-medium [&_h4]:text-gray-800 [&_h4]:mt-3 [&_table]:w-full [&_table]:mt-3 [&_th]:text-left [&_th]:py-2 [&_th]:px-3 [&_th]:bg-gray-50 [&_th]:text-xs [&_th]:font-semibold [&_td]:py-2 [&_td]:px-3 [&_td]:text-sm [&_td]:border-t [&_td]:border-gray-100"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          </div>
        ))}
      </div>

      {/* Back link */}
      <div className="pt-4 border-t border-gray-200">
        <Link to="/help" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          &larr; Back to Help Center
        </Link>
      </div>
    </div>
  );
}
