import { useState, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

const CATEGORIES = Object.keys(CATEGORY_LABELS);

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function KnowledgeBase() {
  const ctx = useContext(KnowledgeContext);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!ctx) return [];
    let results = ctx.articles;

    if (selectedCategory) {
      results = results.filter((a) => a.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter((a) => {
        if (a.title.toLowerCase().includes(q)) return true;
        if (a.summary.toLowerCase().includes(q)) return true;
        if (a.sections) {
          return a.sections.some(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              stripHtml(s.content).toLowerCase().includes(q)
          );
        }
        return false;
      });
    }

    return results;
  }, [ctx, search, selectedCategory]);

  if (!ctx) return null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search our knowledge base or browse by category to learn how to get the most out of StoreScore.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {ctx.loading && (
        <div className="text-center py-12 text-gray-400">Loading articles...</div>
      )}

      {/* No results */}
      {!ctx.loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No articles found.</p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-2 text-sm text-primary-600 hover:text-primary-700">
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Article grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((article) => (
          <Link
            key={article.id}
            to={`/help/${article.slug}`}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {CATEGORY_LABELS[article.category] || article.category}
              </span>
              <TierBadge tier={article.feature_tier} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{article.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{article.summary}</p>
            {article.app_route && (
              <span className="inline-block mt-3 text-xs text-primary-600 font-medium">
                Go to feature &rarr;
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
