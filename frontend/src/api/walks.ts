import api from './client';
import type {
  Store,
  ScoringTemplate,
  Walk,
  WalkPhoto,
  WalkSectionNote,
} from '../types';

// ---------- Stores ----------

export async function getStores(orgId: string): Promise<Store[]> {
  const response = await api.get<Store[]>('/stores/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

// ---------- Templates ----------

export async function getTemplates(
  orgId: string
): Promise<ScoringTemplate[]> {
  const response = await api.get<ScoringTemplate[]>('/walks/templates/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getTemplate(
  orgId: string,
  templateId: string
): Promise<ScoringTemplate> {
  const response = await api.get<ScoringTemplate>(
    `/walks/templates/${templateId}/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ---------- Walks ----------

export interface CreateWalkData {
  store: string;
  template: string;
  conducted_by: string;
  scheduled_date: string;
  status?: string;
}

export async function createWalk(
  orgId: string,
  data: CreateWalkData
): Promise<Walk> {
  const response = await api.post<Walk>('/walks/walks/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getWalks(orgId: string): Promise<Walk[]> {
  const response = await api.get<Walk[]>('/walks/walks/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getWalk(
  orgId: string,
  walkId: string
): Promise<Walk> {
  const response = await api.get<Walk>(`/walks/walks/${walkId}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export interface SubmitScoresPayload {
  scores: Array<{
    criterion: string;
    points: number;
    notes?: string;
  }>;
}

export interface SubmitScoresResponse {
  scores: Array<{
    id: string;
    criterion: string;
    criterion_name: string;
    points: number;
    notes: string;
  }>;
  total_score: number | null;
  errors?: Array<{
    criterion: string;
    errors: Record<string, string[]>;
  }>;
}

export async function submitScores(
  orgId: string,
  walkId: string,
  scores: SubmitScoresPayload
): Promise<SubmitScoresResponse> {
  const response = await api.post<SubmitScoresResponse>(
    `/walks/walks/${walkId}/scores/`,
    scores,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export interface CompleteWalkOptions {
  notify_manager?: boolean;
  notify_evaluator?: boolean;
  additional_emails?: string[];
}

export async function completeWalk(
  orgId: string,
  walkId: string,
  notifyOptions: CompleteWalkOptions = {}
): Promise<Walk> {
  const response = await api.post<Walk>(
    `/walks/walks/${walkId}/complete/`,
    notifyOptions,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ---------- Photos ----------

export async function uploadWalkPhoto(
  orgId: string,
  walkId: string,
  sectionId: string,
  file: File,
  caption: string = ''
): Promise<WalkPhoto> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('walk', walkId);
  formData.append('section', sectionId);
  if (caption) {
    formData.append('caption', caption);
  }

  const response = await api.post<WalkPhoto>(
    `/walks/walks/${walkId}/photos/`,
    formData,
    {
      headers: {
        'X-Organization': orgId,
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

// ---------- Section Notes ----------

export async function saveSectionNote(
  orgId: string,
  walkId: string,
  sectionId: string,
  notes: string,
  areasNeedingAttention: string = ''
): Promise<WalkSectionNote> {
  const response = await api.post<WalkSectionNote>(
    `/walks/walks/${walkId}/section-notes/`,
    {
      section: sectionId,
      notes,
      areas_needing_attention: areasNeedingAttention,
    },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}
