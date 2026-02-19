import api from './client';
import type {
  ActionItem,
  ActionItemDetail,
  ActionItemResponse,
  CalendarToken,
  CorrectiveAction,
  CorrectiveActionSummary,
  CriterionReferenceImage,
  Department,
  DepartmentType,
  Driver,
  EvaluationSchedule,
  Region,
  SelfAssessment,
  SelfAssessmentTemplate,
  AssessmentSubmission,
  SOPCriterionLink,
  SOPDocument,
  Store,
  ScoringTemplate,
  Walk,
  WalkPhoto,
  WalkSectionNote,
} from '../types';

// ---------- Regions ----------

export async function getRegions(orgId: string): Promise<Region[]> {
  const response = await api.get('/stores/regions/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

// ---------- Stores ----------

export async function getStores(orgId: string): Promise<Store[]> {
  const response = await api.get('/stores/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  // Handle both paginated and flat array responses
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export interface StoreData {
  name: string;
  store_number: string;
  region?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  verification_method?: string;
  department_ids?: string[];
}

export async function createStore(
  orgId: string,
  data: StoreData
): Promise<Store> {
  const response = await api.post<Store>('/stores/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateStore(
  orgId: string,
  storeId: string,
  data: Partial<StoreData>
): Promise<Store> {
  const response = await api.patch<Store>(`/stores/${storeId}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export interface RegionData {
  name: string;
  color?: string;
  parent?: string | null;
}

export async function getRegionTree(orgId: string): Promise<Region[]> {
  const response = await api.get('/stores/regions/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, tree: true },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function assignRegionManager(
  orgId: string,
  regionId: string,
  membershipId: string | null
): Promise<Region> {
  const response = await api.post<Region>(
    `/stores/regions/${regionId}/assign-manager/`,
    { membership_id: membershipId || null },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function createRegion(
  orgId: string,
  data: RegionData
): Promise<Region> {
  const response = await api.post<Region>('/stores/regions/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateRegion(
  orgId: string,
  regionId: string,
  data: RegionData
): Promise<Region> {
  const response = await api.patch<Region>(
    `/stores/regions/${regionId}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteRegion(
  orgId: string,
  regionId: string
): Promise<void> {
  await api.delete(`/stores/regions/${regionId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Templates ----------

export async function getTemplates(
  orgId: string
): Promise<ScoringTemplate[]> {
  const response = await api.get('/walks/templates/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
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

export async function duplicateTemplate(
  orgId: string,
  templateId: string
): Promise<ScoringTemplate> {
  const response = await api.post<ScoringTemplate>(
    `/walks/templates/${templateId}/duplicate/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteTemplate(
  orgId: string,
  templateId: string
): Promise<void> {
  await api.delete(`/walks/templates/${templateId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Walks ----------

export interface CreateWalkData {
  store: string;
  template: string;
  conducted_by: string;
  scheduled_date: string;
  status?: string;
  start_latitude?: number;
  start_longitude?: number;
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
  const response = await api.get('/walks/walks/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
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

export async function deleteWalk(
  orgId: string,
  walkId: string
): Promise<void> {
  await api.delete(`/walks/walks/${walkId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

export interface SubmitScoresPayload {
  scores: Array<{
    criterion: string;
    points: number;
    notes?: string;
    driver?: string | null;
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

export async function generateWalkSummary(
  orgId: string,
  walkId: string
): Promise<string> {
  const response = await api.post<{ summary: string }>(
    `/walks/walks/${walkId}/generate-summary/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data.summary;
}

export interface CompleteWalkOptions {
  notify_manager?: boolean;
  notify_evaluator?: boolean;
  additional_emails?: string[];
  summary?: string;
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

// ---------- Geolocation / Start Walk ----------

export async function startWalk(
  orgId: string,
  walkId: string,
  latitude: number,
  longitude: number
): Promise<Walk> {
  const response = await api.post<Walk>(
    `/walks/walks/${walkId}/start/`,
    { latitude, longitude },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ---------- Photos ----------

export async function getWalkPhotos(
  orgId: string,
  walkId: string
): Promise<WalkPhoto[]> {
  const response = await api.get<WalkPhoto[]>(
    `/walks/walks/${walkId}/photos/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function uploadWalkPhoto(
  orgId: string,
  walkId: string,
  sectionId: string | null,
  file: File,
  caption?: string,
  criterionId?: string | null
): Promise<WalkPhoto> {
  const formData = new FormData();
  formData.append('image', file);
  if (sectionId) formData.append('section', sectionId);
  if (criterionId) formData.append('criterion', criterionId);
  if (caption) formData.append('caption', caption);

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

export async function deleteWalkPhoto(
  orgId: string,
  walkId: string,
  photoId: string
): Promise<void> {
  await api.delete(`/walks/walks/${walkId}/photos/${photoId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Org Settings ----------

// ---------- AI Photo Analysis ----------

export interface PhotoAnalysisResult {
  analysis: string;
  suggested_score?: number;
}

export async function analyzePhoto(
  orgId: string,
  file: File,
  criterionName?: string,
  sectionName?: string,
  caption?: string,
  criterionId?: string
): Promise<PhotoAnalysisResult> {
  const formData = new FormData();
  formData.append('image', file);
  if (criterionName) formData.append('criterion_name', criterionName);
  if (sectionName) formData.append('section_name', sectionName);
  if (caption) formData.append('caption', caption);
  if (criterionId) formData.append('criterion_id', criterionId);

  const response = await api.post<PhotoAnalysisResult>(
    '/walks/analyze-photo/',
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

// ---------- Criterion Reference Images ----------

export async function listReferenceImages(
  orgId: string,
  criterionId: string
): Promise<CriterionReferenceImage[]> {
  const response = await api.get<CriterionReferenceImage[]>(
    `/walks/criteria/${criterionId}/reference-images/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function uploadReferenceImage(
  orgId: string,
  criterionId: string,
  file: File,
  description: string
): Promise<CriterionReferenceImage> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('description', description);

  const response = await api.post<CriterionReferenceImage>(
    `/walks/criteria/${criterionId}/reference-images/`,
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

export async function updateReferenceImageDescription(
  orgId: string,
  criterionId: string,
  imageId: string,
  description: string
): Promise<CriterionReferenceImage> {
  const response = await api.patch<CriterionReferenceImage>(
    `/walks/criteria/${criterionId}/reference-images/${imageId}/`,
    { description },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteReferenceImage(
  orgId: string,
  criterionId: string,
  imageId: string
): Promise<void> {
  await api.delete(
    `/walks/criteria/${criterionId}/reference-images/${imageId}/`,
    { headers: { 'X-Organization': orgId } }
  );
}

export interface OrgSettingsData {
  id: string;
  ai_photo_analysis: boolean;
  allow_benchmarking: boolean;
  benchmarking_period_days: number;
  gamification_enabled: boolean;
  gamification_visible_roles: string[];
  action_item_deadline_critical: number;
  action_item_deadline_high: number;
  action_item_deadline_medium: number;
  action_item_deadline_low: number;
}

export interface OrgProfileData {
  id: string;
  name: string;
  slug: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
}

export async function getOrgProfile(orgId: string): Promise<OrgProfileData> {
  const response = await api.get<OrgProfileData>('/auth/organization/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateOrgProfile(
  orgId: string,
  data: Partial<OrgProfileData>
): Promise<OrgProfileData> {
  const response = await api.patch<OrgProfileData>('/auth/organization/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getOrgSettings(orgId: string): Promise<OrgSettingsData> {
  const response = await api.get<OrgSettingsData>('/stores/settings/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateOrgSettings(
  orgId: string,
  data: Partial<OrgSettingsData>
): Promise<OrgSettingsData> {
  const response = await api.put<OrgSettingsData>('/stores/settings/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

// ---------- Goals ----------

export interface GoalData {
  id?: string;
  name: string;
  goal_type: 'score_target' | 'walk_frequency';
  scope: 'organization' | 'region' | 'store';
  region?: string | null;
  region_name?: string | null;
  store?: string | null;
  store_name?: string | null;
  target_value: number;
  is_active: boolean;
  created_at?: string;
}

export async function getGoals(orgId: string): Promise<GoalData[]> {
  const response = await api.get('/stores/goals/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createGoal(
  orgId: string,
  data: Omit<GoalData, 'id' | 'created_at' | 'region_name' | 'store_name'>
): Promise<GoalData> {
  const response = await api.post<GoalData>('/stores/goals/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateGoal(
  orgId: string,
  goalId: string,
  data: Partial<GoalData>
): Promise<GoalData> {
  const response = await api.patch<GoalData>(`/stores/goals/${goalId}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function deleteGoal(
  orgId: string,
  goalId: string
): Promise<void> {
  await api.delete(`/stores/goals/${goalId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Benchmarking ----------

export interface BenchmarkStore {
  store_id: string;
  store_name: string;
  avg_score: number;
  walk_count: number;
  percentile: number;
  rank: number;
  total_stores: number;
}

export interface BenchmarkData {
  enabled: boolean;
  detail?: string;
  period_days?: number;
  store_count?: number;
  org_average?: number | null;
  my_stores?: BenchmarkStore[];
  distribution?: Array<{ label: string; count: number }>;
  goals?: GoalData[];
}

export async function getBenchmarking(orgId: string): Promise<BenchmarkData> {
  const response = await api.get<BenchmarkData>('/stores/benchmarking/', {
    headers: { 'X-Organization': orgId },
  });
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

// ==================== Feature 1: Evaluation Schedules ====================

export interface EvaluationScheduleData {
  name: string;
  template: string;
  frequency: string;
  day_of_month?: number | null;
  day_of_week?: number | null;
  assigned_evaluator?: string | null;
  scope: string;
  region?: string | null;
  store?: string | null;
  is_active?: boolean;
  next_run_date: string;
  reminder_days_before?: number;
}

export async function getSchedules(orgId: string): Promise<EvaluationSchedule[]> {
  const response = await api.get('/walks/schedules/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getSchedule(orgId: string, id: string): Promise<EvaluationSchedule> {
  const response = await api.get<EvaluationSchedule>(`/walks/schedules/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createSchedule(
  orgId: string,
  data: EvaluationScheduleData
): Promise<EvaluationSchedule> {
  const response = await api.post<EvaluationSchedule>('/walks/schedules/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateSchedule(
  orgId: string,
  id: string,
  data: Partial<EvaluationScheduleData>
): Promise<EvaluationSchedule> {
  const response = await api.patch<EvaluationSchedule>(`/walks/schedules/${id}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function deleteSchedule(orgId: string, id: string): Promise<void> {
  await api.delete(`/walks/schedules/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Calendar Feed ----------

export async function getCalendarToken(orgId: string): Promise<CalendarToken> {
  const response = await api.get<CalendarToken>('/walks/calendar-token/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function regenerateCalendarToken(orgId: string): Promise<CalendarToken> {
  const response = await api.post<CalendarToken>('/walks/calendar-token/', {}, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

// ==================== Feature 2: Action Items ====================

export async function getActionItems(
  orgId: string,
  params?: Record<string, string>
): Promise<ActionItem[]> {
  const response = await api.get('/walks/action-items/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getActionItem(
  orgId: string,
  id: string
): Promise<ActionItemDetail> {
  const response = await api.get<ActionItemDetail>(`/walks/action-items/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateActionItem(
  orgId: string,
  id: string,
  data: { status?: string; assigned_to?: string; due_date?: string }
): Promise<ActionItemDetail> {
  const response = await api.patch<ActionItemDetail>(`/walks/action-items/${id}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createActionItem(
  orgId: string,
  data: { store: string; description: string; priority?: string; assigned_to?: string; due_date?: string }
): Promise<ActionItem> {
  const response = await api.post<ActionItem>('/walks/action-items/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function submitActionItemResponse(
  orgId: string,
  actionItemId: string,
  notes: string
): Promise<ActionItemResponse> {
  const response = await api.post<ActionItemResponse>(
    `/walks/action-items/${actionItemId}/respond/`,
    { notes },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export interface VerifyPhotoResult {
  photo_id: string;
  ai_analysis: string;
}

export async function verifyActionItemPhoto(
  orgId: string,
  actionItemId: string,
  file: File,
  caption?: string
): Promise<VerifyPhotoResult> {
  const formData = new FormData();
  formData.append('image', file);
  if (caption) formData.append('caption', caption);
  const response = await api.post<VerifyPhotoResult>(
    `/walks/action-items/${actionItemId}/verify-photo/`,
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

export async function resolveActionItemWithPhoto(
  orgId: string,
  actionItemId: string,
  file: File,
  notes?: string
): Promise<{ status: string; photo_id: string; resolved_at: string }> {
  const formData = new FormData();
  formData.append('image', file);
  if (notes) formData.append('notes', notes);
  const response = await api.post(
    `/walks/action-items/${actionItemId}/resolve-with-photo/`,
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

export async function signOffActionItem(
  orgId: string,
  actionItemId: string,
  notes?: string
): Promise<{ status: string; reviewed_at: string }> {
  const response = await api.post(
    `/walks/action-items/${actionItemId}/sign-off/`,
    { notes: notes || '' },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function pushBackActionItem(
  orgId: string,
  actionItemId: string,
  notes: string
): Promise<{ status: string; detail: string }> {
  const response = await api.post(
    `/walks/action-items/${actionItemId}/push-back/`,
    { notes },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ==================== Feature 3: Self-Assessments ====================

export async function getAssessmentTemplates(
  orgId: string
): Promise<SelfAssessmentTemplate[]> {
  const response = await api.get('/walks/assessment-templates/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getAssessmentTemplate(
  orgId: string,
  id: string
): Promise<SelfAssessmentTemplate> {
  const response = await api.get<SelfAssessmentTemplate>(
    `/walks/assessment-templates/${id}/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function createAssessmentTemplate(
  orgId: string,
  data: { name: string; description?: string; prompts?: Array<{ name: string; description?: string; ai_evaluation_prompt?: string; order: number; rating_type: string }> }
): Promise<SelfAssessmentTemplate> {
  const response = await api.post<SelfAssessmentTemplate>(
    '/walks/assessment-templates/',
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function updateAssessmentTemplate(
  orgId: string,
  id: string,
  data: { name?: string; description?: string; is_active?: boolean; prompts?: Array<{ id?: string; name: string; description?: string; ai_evaluation_prompt?: string; order: number; rating_type: string }> }
): Promise<SelfAssessmentTemplate> {
  const response = await api.put<SelfAssessmentTemplate>(
    `/walks/assessment-templates/${id}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteAssessmentTemplate(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/assessment-templates/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

export async function getAssessments(
  orgId: string,
  params?: Record<string, string>
): Promise<SelfAssessment[]> {
  const response = await api.get('/walks/assessments/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getAssessment(
  orgId: string,
  id: string
): Promise<SelfAssessment> {
  const response = await api.get<SelfAssessment>(`/walks/assessments/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createAssessment(
  orgId: string,
  data: { template?: string; store: string; submitted_by: string; due_date?: string; assessment_type?: string; area?: string }
): Promise<SelfAssessment> {
  const response = await api.post<SelfAssessment>('/walks/assessments/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createQuickAssessment(
  orgId: string,
  data: { store: string; submitted_by: string; area?: string }
): Promise<SelfAssessment> {
  return createAssessment(orgId, {
    store: data.store,
    submitted_by: data.submitted_by,
    assessment_type: 'quick',
    area: data.area || '',
  });
}

export async function submitAssessment(
  orgId: string,
  id: string
): Promise<SelfAssessment> {
  const response = await api.post<SelfAssessment>(
    `/walks/assessments/${id}/submit/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function reviewAssessment(
  orgId: string,
  assessmentId: string,
  submissions: Array<{ id: string; reviewer_rating?: string; reviewer_notes?: string }>
): Promise<{ updated: string[]; assessment_status: string }> {
  const response = await api.post(
    `/walks/assessments/${assessmentId}/review/`,
    { submissions },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteAssessment(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/assessments/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

export async function uploadAssessmentSubmission(
  orgId: string,
  assessmentId: string,
  promptId: string | null,
  file: File,
  caption?: string,
  selfRating?: string
): Promise<AssessmentSubmission> {
  const formData = new FormData();
  formData.append('image', file);
  if (promptId) formData.append('prompt', promptId);
  if (caption) formData.append('caption', caption);
  if (selfRating) formData.append('self_rating', selfRating);
  const response = await api.post<AssessmentSubmission>(
    `/walks/assessments/${assessmentId}/submissions/`,
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

export async function updateAssessmentSubmission(
  orgId: string,
  assessmentId: string,
  submissionId: string,
  data: { self_rating?: string; caption?: string }
): Promise<AssessmentSubmission> {
  const response = await api.patch<AssessmentSubmission>(
    `/walks/assessments/${assessmentId}/submissions/`,
    { submission_id: submissionId, ...data },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function createAssessmentActionItems(
  orgId: string,
  assessmentId: string,
  items: Array<{ description: string; priority: string }>
): Promise<{ created: Array<{ id: string; description: string; priority: string; due_date: string; assigned_to_name: string | null }>; count: number }> {
  const response = await api.post(
    `/walks/assessments/${assessmentId}/create-action-items/`,
    { items },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ==================== Corrective Actions ====================

export async function getCorrectiveActions(
  orgId: string,
  params?: Record<string, string>
): Promise<CorrectiveAction[]> {
  const response = await api.get('/walks/corrective-actions/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getCorrectiveActionSummary(
  orgId: string
): Promise<CorrectiveActionSummary> {
  const response = await api.get<CorrectiveActionSummary>(
    '/walks/corrective-actions/summary/',
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function updateCorrectiveAction(
  orgId: string,
  id: string,
  data: { status?: string; notes?: string }
): Promise<CorrectiveAction> {
  const response = await api.patch<CorrectiveAction>(
    `/walks/corrective-actions/${id}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function createCorrectiveAction(
  orgId: string,
  data: { store: string; notes: string; escalation_level?: string; responsible_user?: string }
): Promise<CorrectiveAction> {
  const response = await api.post<CorrectiveAction>('/walks/corrective-actions/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

// ==================== SOP Documents ====================

export async function getSOPDocuments(
  orgId: string
): Promise<SOPDocument[]> {
  const response = await api.get('/walks/sop-documents/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getSOPDocument(
  orgId: string,
  id: string
): Promise<SOPDocument> {
  const response = await api.get<SOPDocument>(`/walks/sop-documents/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createSOPDocument(
  orgId: string,
  title: string,
  description: string,
  file: File
): Promise<SOPDocument> {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('file', file);
  const response = await api.post<SOPDocument>('/walks/sop-documents/', formData, {
    headers: {
      'X-Organization': orgId,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function deleteSOPDocument(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/sop-documents/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

export async function analyzeSOPDocument(
  orgId: string,
  id: string
): Promise<void> {
  await api.post(`/walks/sop-documents/${id}/analyze/`, {}, {
    headers: { 'X-Organization': orgId },
  });
}

export async function getSOPLinks(
  orgId: string,
  params?: Record<string, string>
): Promise<SOPCriterionLink[]> {
  const response = await api.get('/walks/sop-links/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function updateSOPLink(
  orgId: string,
  id: string,
  data: { is_confirmed?: boolean }
): Promise<SOPCriterionLink> {
  const response = await api.patch<SOPCriterionLink>(
    `/walks/sop-links/${id}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteSOPLink(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/sop-links/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ==================== Scoring Drivers ====================

export async function getDrivers(
  orgId: string,
  params?: Record<string, string>
): Promise<Driver[]> {
  const response = await api.get('/walks/drivers/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 200, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createDriver(
  orgId: string,
  data: { criterion: string; name: string; order?: number }
): Promise<Driver> {
  const response = await api.post<Driver>('/walks/drivers/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateDriver(
  orgId: string,
  id: string,
  data: { name?: string; order?: number; is_active?: boolean }
): Promise<Driver> {
  const response = await api.patch<Driver>(`/walks/drivers/${id}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function deleteDriver(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/drivers/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ==================== QR Verification ====================

export async function verifyWalkQR(
  orgId: string,
  walkId: string,
  qrToken: string
): Promise<Walk> {
  const response = await api.post<Walk>(
    `/walks/walks/${walkId}/verify-qr/`,
    { qr_token: qrToken },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function getStoreQRCode(
  orgId: string,
  storeId: string
): Promise<Blob> {
  const response = await api.get(`/stores/${storeId}/qr-code/`, {
    headers: { 'X-Organization': orgId },
    responseType: 'blob',
  });
  return response.data;
}

export async function regenerateStoreQR(
  orgId: string,
  storeId: string
): Promise<Store> {
  const response = await api.post<Store>(
    `/stores/${storeId}/regenerate-qr/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function geocodeStore(
  orgId: string,
  storeId: string
): Promise<Store> {
  const response = await api.post<Store>(
    `/stores/${storeId}/geocode/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ==================== Template Library ====================

export interface IndustryTemplateListItem {
  id: string;
  name: string;
  description: string;
  industry: string;
  industry_display: string;
  version: number;
  is_active: boolean;
  is_featured: boolean;
  install_count: number;
  section_count: number;
  criterion_count: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IndustryTemplateStructure {
  sections: Array<{
    name: string;
    order: number;
    weight: string;
    criteria: Array<{
      name: string;
      description: string;
      order: number;
      max_points: number;
      scoring_guidance: string;
      drivers: Array<{ name: string; order: number }>;
    }>;
  }>;
}

export interface IndustryTemplateDetail extends IndustryTemplateListItem {
  structure: IndustryTemplateStructure;
}

export async function getIndustryTemplates(
  orgId: string,
  params?: Record<string, string>
): Promise<IndustryTemplateListItem[]> {
  const response = await api.get('/walks/library/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getIndustryTemplate(
  orgId: string,
  id: string
): Promise<IndustryTemplateDetail> {
  const response = await api.get<IndustryTemplateDetail>(
    `/walks/library/${id}/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function installIndustryTemplate(
  orgId: string,
  templateId: string
): Promise<ScoringTemplate> {
  const response = await api.post<ScoringTemplate>(
    `/walks/library/${templateId}/install/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ==================== Departments ====================

export async function getDepartmentTypes(
  orgId: string,
  params?: Record<string, string>
): Promise<DepartmentType[]> {
  const response = await api.get('/walks/department-types/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getDepartmentType(
  orgId: string,
  id: string
): Promise<DepartmentType> {
  const response = await api.get<DepartmentType>(
    `/walks/department-types/${id}/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function installDepartmentType(
  orgId: string,
  departmentTypeId: string
): Promise<Department> {
  const response = await api.post<Department>(
    `/walks/department-types/${departmentTypeId}/install/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function getDepartments(orgId: string): Promise<Department[]> {
  const response = await api.get('/walks/departments/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getDepartment(
  orgId: string,
  id: string
): Promise<Department> {
  const response = await api.get<Department>(
    `/walks/departments/${id}/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function createDepartment(
  orgId: string,
  data: { name: string; description?: string; sections?: unknown[] }
): Promise<Department> {
  const response = await api.post<Department>('/walks/departments/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateDepartment(
  orgId: string,
  id: string,
  data: Partial<{ name: string; description: string; is_active: boolean; sections: unknown[] }>
): Promise<Department> {
  const response = await api.patch<Department>(
    `/walks/departments/${id}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteDepartment(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/walks/departments/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ==================== Department Evaluations ====================

export interface CreateDepartmentWalkData {
  store: string;
  department: string;
  conducted_by: string;
  scheduled_date: string;
  status?: string;
  start_latitude?: number;
  start_longitude?: number;
}

export async function createDepartmentWalk(
  orgId: string,
  data: CreateDepartmentWalkData
): Promise<Walk> {
  const response = await api.post<Walk>('/walks/walks/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getDepartmentWalks(
  orgId: string,
  params?: Record<string, string>
): Promise<Walk[]> {
  const response = await api.get('/walks/walks/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, walk_type: 'department', ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}
