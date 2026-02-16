export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export type Role = 'owner' | 'admin' | 'regional_manager' | 'store_manager' | 'manager' | 'finance' | 'member';

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

export interface Region {
  id: string;
  name: string;
  store_count: number;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  updated_at: string;
}

// --- Walk/Scoring types ---

export interface Criterion {
  id: string;
  name: string;
  description: string;
  order: number;
  max_points: number;
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
  created_at: string;
  updated_at: string;
}

export interface Score {
  id: string;
  criterion: string;
  criterion_name: string;
  points: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface WalkPhoto {
  id: string;
  walk: string;
  section: string | null;
  score: string | null;
  image: string;
  caption: string;
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

export interface Walk {
  id: string;
  store: string;
  store_name: string;
  template: string;
  template_name: string;
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
  scores: Score[];
  section_notes: WalkSectionNote[];
  photos: WalkPhoto[];
  created_at: string;
  updated_at: string;
}
