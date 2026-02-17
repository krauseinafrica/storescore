import api from './client';
import type { KnowledgeArticle } from '../types';

export async function getArticles(search?: string, category?: string): Promise<KnowledgeArticle[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (category) params.category = category;
  const response = await api.get<KnowledgeArticle[]>('/kb/articles/', { params });
  return response.data;
}

export async function getArticle(slug: string): Promise<KnowledgeArticle> {
  const response = await api.get<KnowledgeArticle>(`/kb/articles/${slug}/`);
  return response.data;
}

export interface ContextSectionResponse {
  section: {
    id: string;
    anchor: string;
    title: string;
    content: string;
    feature_tier: 'starter' | 'pro' | 'enterprise';
    order: number;
  };
  article_title: string;
  article_slug: string;
  app_route: string;
}

export async function getContextSection(key: string): Promise<ContextSectionResponse> {
  const response = await api.get<ContextSectionResponse>('/kb/context/', {
    params: { key },
  });
  return response.data;
}
