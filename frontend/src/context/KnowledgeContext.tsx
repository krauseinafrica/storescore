import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { KnowledgeArticle, KnowledgeSection } from '../types';
import { getArticles } from '../api/kb';
import HelpModal from '../components/HelpModal';

export interface ActiveHelp {
  section: KnowledgeSection;
  articleTitle: string;
  articleSlug: string;
  appRoute: string;
}

export interface KnowledgeContextType {
  articles: KnowledgeArticle[];
  loading: boolean;
  activeHelp: ActiveHelp | null;
  findSection: (contextKey: string) => { section: KnowledgeSection; article: KnowledgeArticle } | null;
  openHelp: (contextKey: string) => void;
  closeHelp: () => void;
}

export const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

interface KnowledgeProviderProps {
  children: ReactNode;
}

export function KnowledgeProvider({ children }: KnowledgeProviderProps) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHelp, setActiveHelp] = useState<ActiveHelp | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      try {
        const data = await getArticles();
        if (!cancelled) setArticles(data);
      } catch {
        // KB is non-critical — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticles();
    return () => { cancelled = true; };
  }, []);

  const findSection = useCallback((contextKey: string) => {
    for (const article of articles) {
      if (article.sections) {
        const section = article.sections.find((s) => s.anchor === contextKey);
        if (section) return { section, article };
      }
    }
    return null;
  }, [articles]);

  const openHelp = useCallback((contextKey: string) => {
    const found = findSection(contextKey);
    if (found) {
      setActiveHelp({
        section: found.section,
        articleTitle: found.article.title,
        articleSlug: found.article.slug,
        appRoute: found.article.app_route,
      });
    }
  }, [findSection]);

  const closeHelp = useCallback(() => {
    setActiveHelp(null);
  }, []);

  return (
    <KnowledgeContext.Provider value={{ articles, loading, activeHelp, findSection, openHelp, closeHelp }}>
      {children}
      <HelpModal />
    </KnowledgeContext.Provider>
  );
}
