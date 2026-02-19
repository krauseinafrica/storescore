# StoreScore.app — Product Roadmap

## Vision
AI-powered store quality management platform for multi-location retailers, restaurants, and franchise operations. Industry-agnostic — hardware, QSR, grocery, specialty retail. The platform connects the dots between **store quality → customer experience → sales → staffing**, proving that well-run stores convert more and identifying exactly what it takes to get there. Integrates with existing retail infrastructure (POS, reporting, scheduling) to provide the qualitative "why" behind quantitative data.

---

## Phase 1: Foundation (COMPLETE)
*Infrastructure, auth, core data models*

- [x] Docker Compose deployment (7 services: db, redis, backend, celery worker/beat, frontend, landing)
- [x] Django 5.1 + DRF backend with JWT auth
- [x] React 18 + Vite + Tailwind frontend
- [x] PostgreSQL 16, Redis 7
- [x] Nginx reverse proxy + Cloudflare Origin Certificate (Full Strict)
- [x] Domain architecture: storescore.app, app.storescore.app, api.storescore.app
- [x] Custom User model (email-based, UUID PKs)
- [x] Organization + Membership models (multi-tenant, org-scoped)
- [x] Store + Region models
- [x] Walk + ScoringTemplate + Section + Criterion + Score models
- [x] Login page, Dashboard shell, Sidebar navigation
- [x] Ace Hardware branding (light theme, red #D40029)
- [x] Landing page (coming soon)

## Phase 1.5: Storage + AI + Survey (COMPLETE)
*File storage, AI summaries, survey template*

- [x] DigitalOcean Spaces integration (S3-compatible, CDN-enabled)
- [x] Org/store-scoped file path structure (images-media/storescore/{org}/{store}/...)
- [x] Organization logo field
- [x] WalkPhoto model (tied to section + criterion)
- [x] WalkSectionNote model (section-level notes + areas needing attention)
- [x] Full survey template loaded: "Regional Manager/Manager Store Walk"
  - Curb Appeal (5 criteria)
  - Store Cleanliness (6 criteria)
  - Shelf Maintenance (6 criteria)
  - Backroom/Warehouse (4 criteria)
  - Safety (2 criteria)
  - Additional Notes (photos/notes only)
- [x] Claude API integration (Sonnet 4.5) for AI walk summaries
- [x] Celery task: auto-generate AI summary on walk completion
- [x] Resend email integration (pending API key)
- [x] Walk completion email with branded HTML template
- [x] Email recipient options (manager, evaluator, additional emails)
- [x] Walk timestamps (scheduled_date, started_at, completed_date)
- [x] Northwest franchise created with 16 stores

---

## Phase 2: Walk Experience (COMPLETE)
*The core product — conducting walks on mobile/tablet*

- [x] Walk creation flow (select store, template, schedule date)
- [x] Walk execution UI (section-by-section scoring, 1-5 tap buttons)
- [x] Photo capture per section (camera integration on mobile)
- [x] Section notes input
- [x] Walk completion + review screen
- [x] AI summary display after completion
- [x] Walk history per store (list + detail views)
- [x] Walk status tracking (scheduled -> in progress -> completed)
- [x] PWA setup (manifest, service worker, icons, iOS standalone)
- [x] Auto-save with dirty tracking + unsaved changes protection
- [x] Mobile-first touch targets (56px score buttons, touch-manipulation)
- [x] Live dashboard (stats, in-progress walks, recent walks)
- [x] Historical data import (137 walks, 2022-2025, management command)
- [x] Resend email integration with evaluator reply-to
- [x] 6 evaluator user accounts created from import

## Phase 3: Roles + Permissions (COMPLETE)
*User management and access control*

- [x] Expanded role system: owner, admin, regional_manager, store_manager, manager, finance, member, evaluator
- [x] RegionAssignment model (links users to regions)
- [x] StoreAssignment model (links users to stores)
- [x] Role-based data scoping via `get_accessible_store_ids()`:
  - Owner/Admin/Manager/Finance: all stores
  - Regional Manager: only their assigned region's stores (+ child regions)
  - Store Manager: only their assigned store(s)
  - Member: read-only, all stores
  - Evaluator: walks assigned to them
- [x] User invitation flow (invite by email, assign role + region/store)
- [x] User management UI (Team page with role editing, assignment modal)
- [x] Role hierarchy enforcement in permissions
- [x] Stores page (search, region filter, active/inactive toggle)

## Phase 4: Reporting + Analytics (COMPLETE)
*Trending, dashboards, data export*

- [x] Live dashboard with real data (stats, in-progress, recent walks)
- [x] Store scorecard endpoint (latest walk, score history, section trends)
- [x] Section-level trend sparklines (monthly avg per section)
- [x] Regional comparison table (avg score, store count, best/worst store)
- [x] Date range filtering (30d, 90d, 6m, 1y, all)
- [x] CSV export of walk results
- [x] Email digest reports (weekly/monthly subscription toggle)
- [x] Celery Beat periodic task for sending scheduled digests
- [x] Branded digest email template (top/bottom stores, recent walks, stats)
- [ ] Sales data correlation (tie walk scores to sales numbers) — see Phase 4.5

## Phase 4.5: Data Integrations (IN PROGRESS)
*Connect to external data — sales, staffing, customer metrics*

- [x] IntegrationConfig model (per-org connection settings)
- [x] StoreDataPoint model (flexible time-series metrics per store)
- [x] IntegrationConfig API (CRUD, admin-only create/edit)
- [x] StoreDataPoint API (CRUD, filters by store/metric/date range)
- [x] CSV upload endpoint with column mapping
- [x] Manual data entry forms (weekly sales, staffing, complaints)
- [x] Frontend: Data Entry page (manual entry + CSV import tabs)
- [x] Frontend: Integration Settings page (admin)
- [ ] Mango Report SFTP import (Sunday night cron job via Celery Beat)
  - [ ] SFTP client (paramiko) connecting to userfiles.mangoreport.com:24
  - [ ] Excel/CSV parser for Mango workbooks (openpyxl)
  - [ ] Auto-map Mango data to StoreDataPoint records
  - [ ] **Prerequisite:** Verify SFTP credentials and available file formats
- [ ] Eagle POS API integration (Epicor REST/OData — requires franchisee auth)
- [ ] Staffing data integration (source TBD — correlate staff hours to quality + sales)
- [ ] Walk score <-> sales/staffing correlation analytics dashboard
  - [ ] "X staff hours/day → quality score of Y → sales of Z" analysis
  - [ ] Normalize for store size (not all stores sell equally — focus on quality-per-staff-hour)
- [ ] Ace Corporate partnership exploration

## Phase 5: Platform Admin + Store Management (COMPLETE)
*Multi-franchise platform management and store CRUD*

- [x] Platform admin dashboard (super admin / site support view across ALL orgs)
  - [x] Platform admin role detection (is_superuser / is_staff)
  - [x] Org listing with stats (store count, walk count, last activity)
  - [x] Create organizations with auto-generated owner account
  - [x] Edit organization name
  - [x] Activate / deactivate organizations
  - [x] Impersonate org (view as franchise owner)
  - [x] Platform-wide analytics (total walks, total stores, active orgs)
- [x] Store CRUD from frontend
  - [x] Add Store form (name, number, address, region, lat/lng)
  - [x] Edit Store details
  - [x] Deactivate / reactivate store
  - [x] Region CRUD (create/edit/delete regions)
- [x] CSV store import (platform admin — bulk upload)
- [x] Anonymized performance benchmarking for store managers
  - [x] Percentile rank ("Your store is in the 75th percentile")
  - [x] Org-level toggle: allow/disallow store managers seeing peer scores
  - [x] Blinded comparison charts (your store vs org average)
- [ ] Franchise onboarding wizard
  - [ ] Step-by-step: create org -> add regions -> add stores -> invite team

## Phase 5.2: Region Hierarchy & Org Structure (COMPLETE)
*One-level parent/child nesting + responsible person per region*

- [x] Region `parent` field (self-referential FK, one-level max depth)
- [x] Region `manager` field (FK to Membership — responsible person)
- [x] `clean()` validation: parent can't have a parent; region with children can't become a child
- [x] `RegionChildSerializer` for lightweight nested children in API
- [x] `?tree=true` query param to return only top-level regions with nested children
- [x] `assign-manager` action on RegionViewSet
- [x] Permission scoping: regional managers see stores in child regions too
- [x] Frontend: tree view in Regions modal (parent/child, expandable)
- [x] Frontend: "Manages: [Region]" badge on Team page

## Phase 5.3: Location Verification — GPS + QR Code (COMPLETE)
*Warn-but-allow for GPS, QR code alternative, org-configurable per store*

- [x] Store model: `qr_verification_token` (UUID, unique, regenerable)
- [x] Store model: `verification_method` (gps_only, qr_only, gps_and_qr, either)
- [x] Walk model: `qr_verified`, `qr_scanned_at`
- [x] GPS capture during walk creation (send coords with createWalk)
- [x] LocationWarningModal — shows distance warning if > 500m from store
- [x] `verify-qr` action on WalkViewSet
- [x] `regenerate-qr` and `qr-code` actions on StoreViewSet
- [x] Geocoding utility (Nominatim/OpenStreetMap, rate-limited)
- [x] `geocode` action on StoreViewSet (auto-fill lat/lng from address)
- [x] Frontend: verification badges in walk list (GPS Verified / QR Verified / Unverified)
- [ ] Frontend: QR scanner integration (BarcodeDetector API or html5-qrcode)
- [ ] Frontend: verification details in WalkDetail page
- [ ] Printable QR code endpoint (PDF/PNG)

## Phase 5.4: Public-Facing Pages (COMPLETE)
*Features, Pricing, Request Demo — brand-neutral language for broader market*

- [x] PublicLayout component (header, footer, responsive nav)
- [x] Features page (8 feature sections with icons and descriptions)
- [x] Pricing page (4 tiers: Free/Starter/Pro/Enterprise, monthly/annual toggle)
- [x] Request Demo page (lead capture form)
- [x] Public routes in App.tsx (/features, /pricing, /request-demo)
- [ ] SEO: react-helmet-async for per-page meta tags
- [ ] Landing page update (link to Features/Pricing/Request Demo)

## Phase 5.5: Lead Capture & Demo System (COMPLETE)
*Auto-provisioned demo organizations for prospective customers*

- [x] Lead model (email, name, company, status, demo_org FK, demo_expires_at)
- [x] Public lead creation endpoint (POST /api/v1/auth/leads/ — no auth)
- [x] Celery task: `setup_demo_for_lead` — creates demo org, user, membership, sample data, sends welcome email
- [x] Celery task: `cleanup_expired_demos` — deactivates expired demo orgs
- [x] Branded welcome email with login credentials via Resend
- [x] Platform admin: Leads tab (list, status management, details)
- [ ] "Convert to Customer" action (transition demo org to real org)
- [ ] Demo expiration warning email (2 days before expiry)

## Phase 5.6: Onboarding + Knowledge Base (COMPLETE)
*Help content, guided setup*

- [x] In-app knowledge base / help center
  - [x] Getting started guide (for franchise owners)
  - [x] How to conduct a walk (for evaluators)
  - [x] How to read your scores (for store managers)
  - [x] Admin guide (managing team, stores, templates)
- [x] Contextual help and onboarding lessons
- [x] Getting Started page with progress tracking
- [x] Floating onboarding checklist popup (auto-marks: org settings, stores, departments, dept→stores, team, templates, walks)
- [x] Expanded Quick Start checklist (org settings, departments, apply departments to stores)
- [x] Onboarding reminder email (Celery daily — 3-7 days after org creation, lists incomplete items)
- [ ] Franchise onboarding wizard (multi-step: org -> regions -> stores -> team)
- [ ] Store employee onboarding flow
- [ ] Training resources linked to low-scoring criteria

## Phase 5.7: Store Departments + Template Duplication (COMPLETE)
*Department-level evaluations with AI photo scoring + template management*

- [x] Template duplication (backend)
  - [x] `ScoringTemplate.source_template` self-FK for lineage tracking
  - [x] `duplicate` action on ScoringTemplateViewSet — deep-clones Template → Sections → Criteria → Drivers
  - [x] Deduplication naming: "Template (Copy)", "Template (Copy 2)", etc.
- [x] Template duplication (frontend)
  - [x] "Your Templates" tab in Template Library with Duplicate button
  - [x] `duplicateTemplate()` API function
- [x] Department models + migrations
  - [x] `DepartmentType` model — platform catalog (name, category, industry, default_structure JSON)
  - [x] `Department` model — org-scoped instances (installed from catalog or custom)
  - [x] `Section.department` FK (nullable) — sections belong to template OR department (check constraint)
  - [x] `Walk.department` FK (nullable) — walks use template OR department (check constraint)
  - [x] `Store.departments` M2M field
  - [x] 2 migrations applied (walks + stores)
- [x] Department backend (views, serializers, URLs)
  - [x] `DepartmentTypeViewSet` with `install` action (clones default_structure into sections/criteria)
  - [x] `DepartmentViewSet` (org-scoped CRUD)
  - [x] `WalkViewSet` filters by `walk_type` (standard/department/all) — department walks excluded from default listing
  - [x] Department serializers (list, detail with nested sections/criteria)
  - [x] Store serializer: `department_ids` (writable M2M) + `department_names` (read-only)
  - [x] Walk serializer: `department_name`, `is_department_walk`, `department_sections`
- [x] Department seed data — 15 DepartmentTypes across 3 categories
  - [x] Standard (7): Paint, Lumber, Plumbing, Electrical, Tools, Outdoor/Garden, Hardware/Fasteners
  - [x] Branded (5): Hallmark, Stihl, Carhartt, Benjamin Moore, Milwaukee
  - [x] Specialty (3): Firearms, Key/Lock, Rental
  - [x] Each with 2-4 sections and 3-4 criteria per section (140 total criteria)
- [x] Frontend: Department Management page (`/departments`)
  - [x] "Your Departments" tab — list, delete, start evaluation
  - [x] "Department Library" tab — browse catalog, install with one click
  - [x] "Start Evaluation" flow — pick department → pick store → creates walk → navigate to eval
- [x] Frontend: Department Evaluation page (`/department-eval/:walkId`)
  - [x] Photo-driven AI scoring — upload photo per criterion, AI analyzes and scores (1-5)
  - [x] AI analysis display with score badge
  - [x] Progress tracking (X of Y criteria scored)
  - [x] Complete evaluation when all criteria scored
  - [x] **This is the "knives evaluation" flow** — store managers upload photos, AI prevents tampering
- [x] Frontend: Store form — department multi-select checkboxes
- [x] Frontend: Sidebar — "Departments" nav item (admin only)
- [x] Frontend: Routes — `/departments`, `/department-eval/:walkId`
- [x] TypeScript fixes — null-safe template loading in ConductWalk, WalkDetail, WalkReview

## Phase 5.75: Self-Assessments + AI Photo Evaluation (COMPLETE)
*Photo-based store assessments with AI-powered analysis using Gemini 2.5 Flash*

- [x] Backend: `SelfAssessment`, `SelfAssessmentTemplate`, `AssessmentPrompt`, `AssessmentSubmission` models
- [x] Backend: Full CRUD API — create, submit, review assessments
- [x] Backend: Gemini 2.5 Flash integration for photo analysis (768px downsampling)
- [x] Backend: Structured JSON AI output (rating, summary, findings, action items with priority)
- [x] Backend: Celery task `process_assessment_submissions` — async AI evaluation after submit
- [x] Frontend: Assessment list with status tabs (all/pending/submitted/reviewed)
- [x] Frontend: Assessment detail with photo upload per prompt, self-rating, captions
- [x] Frontend: URL-based detail routing (`?assessment=<id>#assessments` — survives page refresh)
- [x] Frontend: AI processing spinner with auto-polling (detects submitted + no AI → polls every 3s)
- [x] Frontend: Structured AI analysis cards (summary, key findings bullets, prioritized action items)
- [x] Frontend: Rating mismatch indicator (self-rating vs AI rating)
- [x] Frontend: Inline edit for self-rating and caption after upload
- [x] Frontend: Re-upload photo support (replaces existing submission)
- [x] Frontend: Assessment Templates CRUD tab on Templates page
- [x] Backend: Safe prompt update serializer (update-or-create, no cascade-delete of submissions)
- [x] S3 ACL fix: public-read for media files, disabled querystring auth
- [x] Email notification after AI analysis completes — role-based routing:
  - Admin/RM submitted → notify store manager(s) to acknowledge
  - Store manager submitted → notify admins + regional managers for review
- [x] AI-suggested action items with reviewer approval:
  - Checkboxes to select which AI suggestions to create
  - Inline editing of description and priority before approval
  - Auto-assigns to store manager with priority-based due dates (HIGH=3d, MEDIUM=7d, LOW=14d)
  - Email notification to assigned store manager with action item details
- [x] Congratulatory email when assessment has no action items (good result)
- [x] Delete assessments — orphans linked action items (`assessment_removed` indicator)
- [x] Upload spinner with progress animation during photo upload
- [x] Reviewer rating override — admins can adjust AI ratings per submission and add commentary
  - `reviewer_rating`, `reviewer_notes`, `reviewed_by`, `reviewed_at` on AssessmentSubmission
  - Per-submission inline override UI with violet styling
  - Review endpoint (`/review/`) marks assessment as reviewed
- [x] Action item completion with photo:
  - "Resolve with Photo" flow — upload completion evidence photo
  - No AI analysis on completion photos
  - Email to regional manager + admins with photo embedded for sign-off
- [x] Floating onboarding checklist popup widget:
  - Chat-like floating widget (bottom-right) that persists across pages
  - Auto-marks items as complete based on real data (org settings, stores, departments, team, templates, walks)
  - Collapsible to pill, dismissable, auto-refreshes on focus
  - Links to relevant pages for each incomplete item
  - "View full walkthrough" link to Getting Started page
- [x] Onboarding reminder email (Celery daily task):
  - Checks orgs created 3-7 days ago with incomplete setup
  - Sends checklist email to org admins listing remaining steps
  - Branded HTML email with progress percentage and "Continue Setup" CTA
- [x] Video upload support for assessments (MP4/MOV, Gemini Files API for analysis)
- [x] Upload flow UX fix: select file → preview → fill rating/caption → Save (no premature upload lock)
- [x] AI-suggested action item checkbox persistence (stay checked with green "CREATED" badge)
- [x] Auto-dismiss onboarding checklist at 100% completion (admin/owner only)
- [x] Exit/Discard buttons in ConductWalk
- [x] Continue/Delete buttons on assessment cards
- [x] Getting Started page horizontal card layout
- [x] Back to Setup floating button
- [x] **Quick Assessment mode** — freeform photo capture by regional managers/admins:
  - [x] `assessment_type` field ('self'/'quick') on SelfAssessment model
  - [x] `area` field (optional freeform text, e.g. "produce", "bakery")
  - [x] Template and due_date made nullable for quick assessments
  - [x] Prompt FK made nullable on AssessmentSubmission
  - [x] Branched AI prompt construction (quick vs self-assessment)
  - [x] Auto-created action items from AI findings (critical=1d, high=3d, medium=7d, low=14d)
  - [x] Frontend: type filter pills (All Types | Self-Assessment | Quick Assessment)
  - [x] Frontend: quick create modal (store + optional area, no template/due date)
  - [x] Frontend: branched detail view (photo grid for quick, prompt-slots for self)
  - [x] Frontend: violet "Quick" badge on assessment cards
  - [x] Frontend: read-only AI findings with "Action items created automatically" message
- [x] **Enterprise-only assessment gate** — moved assessments from Pro to Enterprise:
  - [x] Billing migration: Pro plan `self_assessments` feature set to false
  - [x] FeatureGate updated from `requiredPlan="Pro"` to `requiredPlan="Enterprise"`
- [x] **AI Usage Tracking** (AiUsageLog model, ai_costs.py):
  - [x] Log every AI API call with model, tokens, estimated cost
  - [x] Platform admin AI cost dashboard
  - [x] System health endpoints
- [ ] Video walkthrough support (Phase 9 dependency)

## Phase 5.75b: Review Sign-Off & Push-Back Flow (COMPLETE)
*Full action item lifecycle with reviewer approval/rejection*

- [x] ActionItem model: `pending_review` and `approved` statuses added
- [x] ActionItem model: `reviewed_by`, `reviewed_at`, `review_notes` fields
- [x] ActionItemEvent model — full lifecycle timeline tracking (created, assigned, status changed, photo uploaded, AI verified, submitted for review, approved, rejected)
- [x] `resolve-with-photo` now routes to `pending_review` instead of `resolved`
- [x] `sign-off` endpoint (POST) — approves action items, blocks self-review
- [x] `push-back` endpoint (POST) — rejects with required feedback notes, resets to `in_progress`
- [x] Self-review blocking (resolver cannot be their own reviewer)
- [x] Role-based reviewer access (regional_manager, admin, owner)
- [x] Email notifications: approval confirmation, push-back with feedback, pending review reminders (Celery daily, 3+ days stale)
- [x] Frontend: Reviewer section on ActionItemDetail with before/after photo comparison
- [x] Frontend: Approve/Push-back buttons with notes modal
- [x] Frontend: Timeline component with color-coded event icons
- [x] Frontend: Status banners (approved, pending review for non-reviewers)
- [x] Frontend: Resolution time display
- [x] Frontend: ActionItems list with `pending_review` and `approved` status tabs + badges

## Phase 5.8: Advanced Reports & Analytics (COMPLETE)
*Multi-tab reporting with drill-down, action item insights, driver analytics*

- [x] **Tabbed report structure** — 5 tabs with hash-based URL routing
  - [x] **Overview tab** — KPI cards, score gauge, region bars, trend chart, quick insights
  - [x] **Store Deep Dive tab** — store selector, scorecard, full score history, section trends, comparison to org average
  - [x] **Section Analysis tab** — section/criteria performance, consistently low-scoring criteria, cross-store comparison
  - [x] **Evaluator Insights tab** — consistency patterns, scoring distributions, per-evaluator trends (admin only)
  - [x] **Action Items & Drivers tab** — resolution rates, common root cause drivers, recurring issues by section/store
- [x] **Click-to-drill interactions** — store bar clicks drill to Store Deep Dive, section legend clicks drill to Section Analysis
- [x] **Driver insights** — aggregate driver selections across walks
  - [x] Top drivers by section (e.g., "Staffing" is the #1 driver for low Shelf Maintenance)
  - [x] Driver trends over time
  - [ ] Driver-to-action-item correlation (which drivers generate the most follow-up work?)
- [x] **Action item analytics** — tie corrective actions back to evaluation data
  - [x] Open vs resolved action items by store/region
  - [x] Average resolution time
  - [ ] Impact measurement: do scores improve after action items are resolved?
  - [ ] Resolution time display by priority level with SLA color coding
- [ ] **Notes & observations callouts** — surface notable walk notes/observations in the insights banner
- [ ] **Template editing** — edit "Your Templates" inline (sections, criteria, point values) with "customized" indicator
- [x] **N+1 query fix** — SectionBreakdownView pre-aggregates criterion averages in single query

---

## Phase 5.9: Public Site as Digital Pitch Deck (PLANNED)
*Convert storescore.app into a high-converting sales funnel — brand-agnostic, industry-flexible*

### Core Thesis
StoreScore connects the dots between **store quality → customer experience → sales performance → staffing efficiency**. The platform answers: "What does it take to run a great store, and how do we prove it with data?" This applies to hardware stores, QSR, grocery, specialty retail — any multi-location operation where physical store conditions impact revenue.

### Strategy: 4-Pillar Messaging
1. **The Problem** — "Manual Audit Fatigue" and inconsistency across locations. The "black box" of regional management. Every chain knows some stores perform better, but can't pinpoint why.
2. **The Solution** — Visual-first approach + AI photo analysis as the modern alternative to paper clipboards. Structured evaluations that produce actionable data, not just scores.
3. **Retail Infrastructure Integration** — StoreScore provides the qualitative "why" behind quantitative data. Integrates with existing POS, reporting, and operations tools (Epicor Eagle, Mango Report, Square, Toast, etc.) to correlate quality scores with sales and staffing.
4. **ROI Storytelling** — Position store quality as the physical equivalent of "lowering bounce rates." A clean, well-stocked, well-staffed store converts more foot traffic into sales. StoreScore proves it.

### The Quality → Sales → Staffing Triangle
The ultimate insight StoreScore unlocks:
- **Quality ↔ Sales**: Do higher-scoring stores generate more revenue per sq ft?
- **Staffing ↔ Quality**: What's the minimum staff hours/day needed to maintain a target quality score?
- **Staffing ↔ Sales**: What's the ROI of each additional staff hour in terms of sales lift?
- This is the "holy grail" metric: **quality score per staff hour per dollar of revenue**
- Staffing data source TBD — could come from POS (hours logged), scheduling software (Deputy, HotSchedules, 7shifts), or manual entry

### Homepage Overhaul
- [ ] **Hero section** — Brand-agnostic headline focused on the universal problem. 60-second conviction.
- [ ] **"How It Works" section** — 3 steps with visuals (Evaluate → Analyze → Improve)
- [ ] **Industry examples** — Hardware, restaurant/QSR, grocery, specialty retail. Show the platform adapts to any store type.
- [ ] **Comparison table** — Manual audits vs. StoreScore (time, consistency, AI insights, photo evidence, data correlation)
- [ ] **Before/After AI view** — Photo of disorganized department → StoreScore AI overlay with action item callout
- [ ] **Multi-store map visual** — Dashboard mockup showing store pins with green/yellow/red scores ("God-view" for operators)
- [ ] **Integration logos** — "Works with your existing tools" — POS, reporting, scheduling software logos
- [ ] **Social proof section** — Testimonials, store count, evaluation count

### Enterprise / Mega-Group Strategy
- [ ] **`/enterprise` landing page** — Tailored for 10-50+ location operators (any industry)
  - Focus on: benchmarking, regional manager efficiency, API integrations, quality-to-sales correlation
  - "Operations at scale" language — VP of Ops / Director of Store Standards pain points
  - ROI calculator (estimate time saved, consistency improvement, revenue lift)
- [ ] **Dynamic form logic** — Enterprise tier "Get Started" triggers a short lead form (# locations, industry, current tools, main pain point)
- [ ] **In-app lead ticketing** — Form submissions create "Lead Tickets" in platform admin, respond via templated email
- [ ] **Automated scheduling** — Calendly/SavvyCal embed for "Platform Walkthrough" booking
- [ ] **Enterprise one-pager** — Downloadable PDF for decision-makers

### Audience Segmentation
| Segment | Entry Point | Key Message | CTA |
|---------|------------|-------------|-----|
| Single-location owner/GM | Homepage / Pricing | "See your store clearly" | Free trial signup |
| Multi-location owner (3-10) | Homepage / Features | "Compare locations instantly" | Start free, upgrade |
| Regional chain / franchise group (10-50+) | `/enterprise` | "Regional visibility at scale" | Book a walkthrough |
| Franchise corporate (HQ-level) | Direct outreach | "The quality layer your franchisees need" | Partnership meeting |

### Industry-Specific Angles (for future vertical landing pages)
| Industry | Key Hook | Integration Targets |
|----------|----------|-------------------|
| Hardware (Ace, True Value, Do It Best) | Department readiness, vendor compliance | Epicor Eagle, Mango Report |
| QSR / Restaurant | Food safety, cleanliness, speed of service | Toast, Square, 7shifts |
| Grocery | Shelf stocking, freshness, department rotation | POS systems, scheduling tools |
| Specialty Retail | Visual merchandising, brand standards | Shopify POS, Lightspeed |

---

## Phase 6: White-Label + Multi-Brand (DEFERRED — tied to marketing plan)
*Prepare for other brands beyond Ace*

- [ ] BrandConfig model (subdomain -> theme, logo, colors)
- [ ] ace.storescore.app subdomain routing
- [ ] Per-org theming on frontend (dynamic colors, logo)
- [ ] Neutral storescore.app landing page (brand-agnostic)
- [ ] Shared API backend (already org-scoped)
- [ ] Brand-specific email templates
- [ ] Onboarding flow per brand

## Phase 7: Advanced AI Features
*Deeper AI integration — dual-model strategy: Claude for text, Gemini for vision*

- [x] AI-powered action item generation from walk scores
- [x] Photo analysis (Claude vision — auto-detect issues from walk photos)
- [x] SOP document analysis and criterion linking
- [x] Gemini 2.5 Flash integration for assessment photo analysis (structured JSON output)
- [x] AI model comparison tooling (management commands: `compare_ai_vision`, `deep_compare_vision`)
- [x] Dual-model strategy: Claude for walk summaries/email; Gemini 2.5 Flash for photo/video analysis
- [x] Photo downsampling pipeline (768px default, LANCZOS, JPEG quality 85)
- [ ] Predictive scoring (flag stores likely to decline)
- [ ] Natural language walk queries ("Show me all stores with declining Safety scores")
- [ ] AI coaching suggestions for store managers
- [ ] Automated follow-up reminders based on AI recommendations
- [ ] Price tag / signage reading mode (1024px for fine text)

## Phase 8: Store Gamification (LARGELY COMPLETE)
*Competition, achievements, and engagement features*

- [x] Leaderboards — auto-generated rankings by walk scores, improvement rate, consistency
  - [x] Scoped by org, region, or platform-wide
  - [x] 4 leaderboard types: avg_score, walk_count, most_improved, consistency
  - [ ] Streaks leaderboard (consecutive weeks with walks)
  - [ ] Periodic leaderboard caching (Celery task, every 6 hours)
- [x] Challenges — admin-created time-bound competitions
  - [x] Challenge model with types: score_target, most_improved, walk_count, highest_score
  - [x] ChallengeViewSet with full CRUD and computed standings
  - [ ] Section-scoped challenges (e.g., "Best Curb Appeal — March 2026")
  - [ ] Prizes text field
  - [ ] Challenge finalization emails (Celery daily task)
- [x] Achievements / Badges — 12 pre-built achievements
  - [x] Bronze/silver/gold/platinum tiers
  - [x] 7 criteria types with rules engine
  - [x] Achievement checking triggered on walk completion
  - [x] Seed data management command
  - [ ] Achievement notification emails
  - [ ] Async achievement checking (move to Celery task)
- [x] OrgSettings.gamification_enabled toggle
  - [ ] Role-based visibility control (gamification_visible_roles)
- [x] Dashboard widgets: Mini Leaderboard, Active Challenge, Recent Badges
- [x] Frontend: Full `/gamification` page with 3 tabs (Leaderboard, Challenges, Achievements)
- [x] Plan-gated visibility (Pro/Enterprise via useSubscription + FeatureGate)

## Phase 9: AI Video Analysis (After Phase 8 + 7)
*Video-based store walk analysis using Google Gemini — requires Gemini API setup*

See [VIDEO_AI_ANALYSIS.md](./VIDEO_AI_ANALYSIS.md) for the full technical plan, pricing analysis, and implementation details.

- [ ] **Phase 9.1: Post-Walk Video Upload + Analysis**
  - [ ] Google Gemini API integration (gemini-2.5-flash for video analysis)
  - [ ] WalkVideo model (video storage in DO Spaces, analysis tracking)
  - [ ] WalkVideoObservation model (timestamped AI findings per criterion)
  - [ ] Celery task: upload video to Gemini File API, analyze, parse structured results
  - [ ] Video recording component in mobile PWA (MediaRecorder API)
  - [ ] Chunked/resumable video upload with progress indicator
  - [ ] Video observation timeline UI (click observation to jump to timestamp)
  - [ ] AI suggested scores overlay (Gemini suggestions vs evaluator scores)
  - [ ] Integration with existing Claude summary pipeline (enrich summaries with video observations)
  - [ ] Auto-generate ActionItems from critical video observations
- [ ] **Phase 9.2: Real-Time AI Guidance During Walks**
  - [ ] Live video stream with periodic frame analysis
  - [ ] Real-time section detection and scoring suggestions
  - [ ] Walk completeness tracking ("You haven't captured the backroom yet")
  - [ ] Safety hazard alerts during walk
- [ ] **Phase 9.3: Automated Video Comparison Over Time**
  - [ ] Before/after video comparison (cross-walk analysis)
  - [ ] Change detection and trend visualization
  - [ ] Context caching for cost-optimized multi-video analysis
  - [ ] Monthly automated comparison reports
- [ ] **Phase 9.4: Advanced Video Intelligence**
  - [ ] Multi-store video comparison
  - [ ] Auto-extracted training clips from high-scoring walks
  - [ ] Natural language video queries
  - [ ] Anomaly detection alerts

**Estimated Gemini API cost**: ~$0.023 per 5-minute walk video (Gemini 2.5 Flash). Profitable from first paying organization.

---

## Infrastructure Backlog

- [x] Resend email setup (DNS records + API key)
- [x] Sentry.io error monitoring integration
- [x] Sentry cleanup — resolved 8+ stale issues (Feb 2026)
- [ ] Automated database backups (pg_dump to DO Spaces)
- [ ] Monitoring / alerting (uptime, container health)
- [ ] CI/CD pipeline (GitHub Actions -> auto-deploy on push)
- [ ] Staging environment
- [ ] Rate limiting on API (CRITICAL — see security audit)
- [ ] JWT refresh token blacklisting after rotation (CRITICAL — see security audit)
- [ ] S3 private ACL for uploaded files (HIGH — currently public-read)
- [ ] HSTS + security headers in Nginx (HIGH)
- [ ] Docker containers: run as non-root user (HIGH)
- [ ] Redis authentication (MEDIUM)
- [ ] Audit logging (who changed what, when)
- [ ] Server migration plan (when droplet resources get tight)
- [ ] Offline-first with sync (PWA enhancement)
- [ ] Public API / webhook system for third-party integrations

---

## Implementation Priority (as of Feb 2026)

| Priority | Phase | Notes |
|----------|-------|-------|
| 1 | **Phase 5.8 remaining** | Resolution time by priority + SLA color coding, driver-to-action-item correlation, notes/observations callouts, template inline editing |
| 2 | **Phase 8 remaining** | Streaks leaderboard, section-scoped challenges, achievement emails, role visibility, leaderboard caching |
| 3 | **Phase 5.9: Public Site Pitch Deck** | Homepage overhaul, /enterprise page, lead funnels, before/after visuals |
| 4 | **Security hardening** | JWT blacklisting, rate limiting, S3 private ACL, HSTS, Redis auth — see SECURITY_AUDIT.md |
| 5 | **AI Assessment Feedback** | Track unchecked AI suggestions to refine future assessments, user feedback mechanism |
| 6 | **Phase 7: Advanced AI** | Predictive scoring, NL queries, AI coaching. Department AI eval already done (knives demo ready for Jordan) |
| 7 | **Phase 9: AI Video Analysis** | Gemini API setup done. Post-walk video upload + analysis |
| 8 | **Phase 4.5: Data Integrations** | Mango SFTP import (pending cred verification), staffing data (source TBD), sales correlation dashboard |
| 9 | **Phase 6: White-Label** | Tied to marketing expansion plan. Deferred until other verticals are pursued |

**Key dependencies:**
- Mango SFTP: Need to verify credentials and available file formats before building importer
- Staffing data: Need to identify source (manual entry? POS? scheduling software?)
- Gemini API: **DONE** — API key configured, google-genai SDK installed, Gemini 2.5 Flash active for assessments + video
- Department AI eval for knives: **DONE** — ready to demo with Jordan
- Security audit: **DONE** — 4 critical, 6 high, 9 medium, 6 low findings documented

**Core insight for data integrations:** Not all stores sell equally. Raw sales numbers are misleading. The real metric is **quality score per staff hour** — "it takes X staff hours/day to maintain a quality score of Y, which correlates to sales efficiency of Z." This lets stores run lean while maintaining quality.

---

## Current Data

| Entity | Count |
|--------|-------|
| Organizations | 1 (Northwest) |
| Stores | 16 |
| Scoring Templates | 1 (Regional Manager/Manager Store Walk) |
| Sections | 6 (5 scored + Additional Notes) |
| Criteria | 23 |
| Users | 8 (1 admin + 1 test + 6 evaluators) |
| Walks | 137 (historical import, 2022-2025) |
| Scores | 3,151 |
| Avg Walk Score | 85.3% |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5.1, DRF, Celery, PostgreSQL 16, Redis 7 |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| AI | Claude API (Sonnet 4.5 — text/summaries), Gemini 2.5 Flash (photo/video analysis) |
| Email | Resend |
| Storage | DigitalOcean Spaces (S3-compatible) |
| Hosting | DigitalOcean Droplet, Docker Compose |
| SSL | Cloudflare Origin Certificate (Full Strict) |
| DNS | Cloudflare |

## Key People

| Person | Role |
|--------|------|
| Admin | Franchise owner, super admin |
| Jordan Karnes | Regional manager (brother-in-law), manages subset of Northwest stores |

## Competitive Context

See [COMPETITION.md](./COMPETITION.md) for detailed analysis of competing platforms, feature comparisons, and market positioning.
