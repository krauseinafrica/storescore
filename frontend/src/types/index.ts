export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export type Role = 'owner' | 'admin' | 'regional_manager' | 'store_manager' | 'manager' | 'finance' | 'member' | 'evaluator';

export interface Membership {
  id: string;
  organization: Organization;
  role: Role;
  created_at?: string;
}

export interface RegionAssignment {
  id: string;
  region__id: string;
  region__name: string;
}

export interface StoreAssignment {
  id: string;
  store__id: string;
  store__name: string;
}

export interface OrgMember {
  id: string;
  user: User;
  role: Role;
  assigned_regions: RegionAssignment[];
  assigned_stores: StoreAssignment[];
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  org_name: string;
}

// --- Store-related types ---

export interface RegionChild {
  id: string;
  name: string;
  color: string;
  store_count: number;
  manager: string | null;
  manager_name: string | null;
}

export interface Region {
  id: string;
  name: string;
  color: string;
  parent: string | null;
  parent_name: string | null;
  manager: string | null;
  manager_name: string | null;
  children: RegionChild[];
  store_count: number;
  created_at: string;
  updated_at: string;
}

export type VerificationMethod = 'gps_only' | 'qr_only' | 'gps_and_qr' | 'either';

export interface Store {
  id: string;
  name: string;
  store_number: string;
  region: string | null;
  region_name: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  manager_name: string;
  manager_phone: string;
  manager_email: string;
  qr_verification_token: string;
  verification_method: VerificationMethod;
  department_ids?: string[];
  department_names?: string[];
  created_at: string;
  updated_at: string;
}

// --- Department types ---

export type DepartmentCategory = 'standard' | 'branded' | 'specialty';

export interface DepartmentType {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  category: DepartmentCategory;
  category_display: string;
  industry: string;
  industry_display: string;
  is_active: boolean;
  install_count: number;
  section_count: number;
  default_structure?: {
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
      }>;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  department_type?: string | null;
  department_type_name?: string | null;
  sections?: Section[];
  section_count?: number;
  store_count?: number;
  created_at: string;
  updated_at: string;
}

// --- Walk/Scoring types ---

export interface Driver {
  id: string;
  criterion?: string;
  criterion_name?: string;
  name: string;
  order: number;
  is_active: boolean;
}

export interface SOPCriterionLinkBrief {
  id: string;
  sop_document: string;
  sop_title: string;
  relevant_excerpt: string;
}

export interface CriterionReferenceImage {
  id: string;
  criterion: string;
  image: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  order: number;
  max_points: number;
  sop_text: string;
  sop_url: string;
  scoring_guidance: string;
  drivers?: Driver[];
  sop_links?: SOPCriterionLinkBrief[];
  reference_images?: CriterionReferenceImage[];
}

export interface Section {
  id: string;
  name: string;
  order: number;
  weight: string; // Decimal returned as string from DRF
  criteria: Criterion[];
}

export interface ScoringTemplate {
  id: string;
  name: string;
  is_active: boolean;
  sections: Section[];
  section_count?: number;
  source_template?: string | null;
  source_template_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Score {
  id: string;
  criterion: string;
  criterion_name: string;
  points: number;
  notes: string;
  driver?: string | null;
  driver_name?: string | null;
  driver_ids?: string[];
  driver_names?: string[];
  created_at: string;
  updated_at: string;
}

export interface WalkPhoto {
  id: string;
  walk: string;
  section: string | null;
  criterion: string | null;
  criterion_name: string | null;
  score: string | null;
  image: string;
  caption: string;
  exif_date: string | null;
  image_hash: string;
  is_fresh: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalkSectionNote {
  id: string;
  walk: string;
  section: string;
  notes: string;
  areas_needing_attention: string;
  created_at: string;
  updated_at: string;
}

export type WalkStatus = 'scheduled' | 'in_progress' | 'completed';

export type ManagerReviewStatus = 'pending_review' | 'reviewed' | 'disputed';

export interface Walk {
  id: string;
  store: string;
  store_name: string;
  store_phone?: string;
  store_manager_name?: string;
  store_manager_phone?: string;
  store_manager_email?: string;
  store_latitude?: number | null;
  store_longitude?: number | null;
  template: string | null;
  template_name: string | null;
  department?: string | null;
  department_name?: string | null;
  is_department_walk?: boolean;
  department_sections?: Section[];
  conducted_by: string;
  conducted_by_name?: string;
  conducted_by_detail?: User;
  scheduled_date: string;
  started_at: string | null;
  completed_date: string | null;
  status: WalkStatus;
  notes: string;
  total_score: number | null;
  ai_summary: string;
  is_locked: boolean;
  lock_date: string | null;
  scores: Score[];
  section_notes: WalkSectionNote[];
  photos: WalkPhoto[];
  // Signature fields
  evaluator_signature: string | null;
  evaluator_signed_at: string | null;
  manager_signature: string | null;
  manager_signed_at: string | null;
  manager_reviewed_by: string | null;
  manager_reviewed_by_name: string | null;
  manager_review_notes: string;
  manager_review_status: ManagerReviewStatus;
  // Geolocation fields
  start_latitude: number | null;
  start_longitude: number | null;
  location_verified: boolean;
  location_distance_meters: number | null;
  // QR verification
  qr_verified: boolean;
  qr_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Feature 1: Evaluation Schedules ---

export type ScheduleFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type ScheduleScope = 'organization' | 'region' | 'store';

export interface EvaluationSchedule {
  id: string;
  name: string;
  template: string;
  template_name: string;
  frequency: ScheduleFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  assigned_evaluator: string | null;
  assigned_evaluator_name: string | null;
  scope: ScheduleScope;
  region: string | null;
  region_name: string | null;
  store: string | null;
  store_name: string | null;
  created_by: string;
  created_by_name: string;
  is_active: boolean;
  next_run_date: string;
  last_run_date: string | null;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarToken {
  token: string;
  created_at: string;
}

// --- Feature 2: Action Items ---

export type ActionItemStatus = 'open' | 'in_progress' | 'resolved' | 'pending_review' | 'approved' | 'dismissed';
export type ActionItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ActionItemPhoto {
  id: string;
  image: string;
  ai_analysis: string;
  caption: string;
  created_at: string;
}

export interface ActionItemResponse {
  id: string;
  action_item: string;
  submitted_by: string;
  submitted_by_name: string;
  notes: string;
  photos: ActionItemPhoto[];
  created_at: string;
}

export interface ActionItem {
  id: string;
  walk: string | null;
  criterion_name: string;
  store_name: string;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  assigned_to: string | null;
  assigned_to_name: string | null;
  walk_date: string | null;
  due_date: string | null;
  response_count?: number;
  description?: string;
  is_manual?: boolean;
  store?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  resolution_days?: number | null;
}

export interface ActionItemEvent {
  id: string;
  event_type: string;
  actor: string | null;
  actor_name: string;
  notes: string;
  old_status: string;
  new_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActionItemDetail extends ActionItem {
  criterion: string | null;
  criterion_description: string;
  criterion_max_points: number | null;
  score: string | null;
  score_points: number | null;
  original_photo: string | null;
  original_photo_url: string | null;
  created_by: string;
  created_by_name: string;
  description: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string;
  responses: ActionItemResponse[];
  events: ActionItemEvent[];
  resolution_days: number | null;
  updated_at: string;
}

// --- Feature 3: Self-Assessments ---

export type AssessmentRating = 'good' | 'fair' | 'poor';

export interface AssessmentPrompt {
  id: string;
  name: string;
  description: string;
  ai_evaluation_prompt: string;
  order: number;
  rating_type: 'none' | 'three_scale';
}

export interface SelfAssessmentTemplate {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_by_name: string;
  is_active: boolean;
  prompt_count?: number;
  prompts?: AssessmentPrompt[];
  created_at: string;
  updated_at: string;
}

export interface AssessmentSubmission {
  id: string;
  assessment: string;
  prompt: string;
  prompt_name: string;
  image: string;
  is_video: boolean;
  caption: string;
  self_rating: AssessmentRating | '';
  ai_analysis: string;
  ai_rating: AssessmentRating | '';
  reviewer_rating: AssessmentRating | '';
  reviewer_notes: string;
  reviewed_by_name: string;
  reviewed_at: string | null;
  submitted_at: string;
}

export type SelfAssessmentStatus = 'pending' | 'submitted' | 'reviewed';

export interface SelfAssessment {
  id: string;
  template: string;
  template_name: string;
  store: string;
  store_name: string;
  submitted_by: string;
  submitted_by_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  status: SelfAssessmentStatus;
  due_date: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_notes: string;
  submission_count?: number;
  action_items_count?: number;
  submissions?: AssessmentSubmission[];
  prompts?: AssessmentPrompt[];
  created_at: string;
  updated_at: string;
}

// --- Corrective Actions ---

export type CorrectiveActionType = 'overdue_evaluation' | 'unacknowledged_walk' | 'manual';
export type EscalationLevel = 'reminder' | 'escalated' | 'critical';
export type CorrectiveActionStatus = 'open' | 'resolved';

export interface CorrectiveAction {
  id: string;
  action_type: CorrectiveActionType;
  escalation_level: EscalationLevel;
  status: CorrectiveActionStatus;
  walk: string | null;
  walk_date: string | null;
  store: string;
  store_name: string;
  responsible_user: string | null;
  responsible_user_name: string | null;
  days_overdue: number;
  notes: string;
  is_manual?: boolean;
  last_notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectiveActionSummary {
  total: number;
  critical: number;
  escalated: number;
  reminder: number;
  overdue_evaluations: number;
  unacknowledged_walks: number;
}

// --- Knowledge Base ---

export interface KnowledgeSection {
  id: string;
  anchor: string;
  title: string;
  content: string;
  feature_tier: 'starter' | 'pro' | 'enterprise';
  order: number;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  feature_tier: 'starter' | 'pro' | 'enterprise';
  app_route: string;
  icon_name: string;
  order: number;
  sections?: KnowledgeSection[];
}

// --- Onboarding ---

export interface OnboardingLesson {
  id: string;
  title: string;
  summary: string;
  content: string;
  section_content: {
    anchor: string;
    title: string;
    content: string;
    feature_tier: string;
  } | null;
  app_route: string;
  action_label: string;
  roles: string;
  feature_tier: 'starter' | 'pro' | 'enterprise';
  order: number;
  is_completed: boolean;
  completed_at: string | null;
}

export interface OnboardingProgress {
  total: number;
  completed: number;
  percentage: number;
}

// --- SOP Documents ---

export interface SOPCriterionLink {
  id: string;
  sop_document: string;
  sop_title?: string;
  criterion: string;
  criterion_name?: string;
  is_ai_suggested: boolean;
  ai_confidence: number | null;
  ai_reasoning: string;
  is_confirmed: boolean;
  relevant_excerpt: string;
  created_at: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  description: string;
  file: string;
  file_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploaded_by_name: string;
  is_active: boolean;
  link_count?: number;
  criterion_links?: SOPCriterionLink[];
  created_at: string;
  updated_at: string;
}

// --- Lead Capture ---

export type LeadStatus = 'new' | 'contacted' | 'demo_active' | 'converted' | 'closed';

export interface Lead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  store_count: number | null;
  message: string;
  status: LeadStatus;
  source: string;
  demo_org: string | null;
  demo_expires_at: string | null;
  created_at: string;
}

// --- Gamification ---

export type ChallengeType = 'score_target' | 'most_improved' | 'walk_count' | 'highest_score';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementCriteriaType = 'perfect_score' | 'score_above_90' | 'walk_streak' | 'score_streak' | 'walk_count' | 'improvement' | 'action_speed';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_type: ChallengeType;
  scope: 'organization' | 'region';
  region: string | null;
  region_name: string | null;
  target_value: number | null;
  start_date: string;
  end_date: string;
  created_by: string;
  created_by_name: string;
  is_active: boolean;
  is_ongoing: boolean;
  days_remaining: number;
  prizes_text: string;
  section_name: string;
  created_at: string;
}

export interface ChallengeStanding {
  rank: number;
  store_id: string;
  store_name: string;
  value: number;
  meets_target: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  tier: AchievementTier;
  criteria_type: AchievementCriteriaType;
  criteria_value: number;
  is_active: boolean;
  created_at: string;
}

export interface AwardedAchievement {
  id: string;
  achievement: Achievement;
  store: string | null;
  store_name: string | null;
  user: string | null;
  user_name: string | null;
  walk: string | null;
  awarded_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  store_id: string;
  store_name: string;
  store_number: string;
  region_name: string;
  value: number;
  change: number | null;
  trend: 'up' | 'down' | 'stable';
}

// --- Data Integrations ---

export interface IntegrationConfig {
  id: string;
  name: string;
  integration_type: string;
  provider: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  data_point_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoreDataPoint {
  id: string;
  store: string;
  store_name: string;
  metric: string;
  value: string;
  date: string;
  source: string;
  integration: string | null;
  integration_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
