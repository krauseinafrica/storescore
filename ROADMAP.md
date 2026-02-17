# StoreScore.app — Product Roadmap

## Vision
AI-powered store quality management platform for multi-location retailers, restaurants, and franchise operations. Built initially for Ace Hardware franchises, designed to serve any brand with minimal customization — from hardware stores to QSR chains to grocery.

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
*Deeper AI integration*

- [x] AI-powered action item generation from walk scores
- [x] Photo analysis (Claude vision — auto-detect issues from walk photos)
- [x] SOP document analysis and criterion linking
- [ ] Predictive scoring (flag stores likely to decline)
- [ ] Natural language walk queries ("Show me all stores with declining Safety scores")
- [ ] AI coaching suggestions for store managers
- [ ] Automated follow-up reminders based on AI recommendations

## Phase 8: Store Gamification (NEXT UP)
*Competition, achievements, and engagement features*

- [ ] Leaderboards — auto-generated rankings by walk scores, improvement rate, streaks
  - [ ] Scoped by org, region, or platform-wide
  - [ ] Configurable period (weekly, monthly, quarterly, all-time)
- [ ] Challenges — admin-created time-bound competitions
  - [ ] e.g., "Best Curb Appeal — March 2026"
  - [ ] Metric-based scoring, start/end dates, prizes text
- [ ] Achievements / Badges — "Perfect Score", "10-Walk Streak", "Most Improved"
  - [ ] Bronze/silver/gold tiers
  - [ ] Criteria rules engine (JSON-based)
- [ ] CompetitionSettings per org — configurable visibility by role
  - [ ] Default: management roles only (owner, admin, regional_manager)
- [ ] Dashboard widgets: "Your Rank", "Active Challenges", "Recent Achievements"

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
- [ ] Automated database backups (pg_dump to DO Spaces)
- [ ] Monitoring / alerting (uptime, container health)
- [ ] CI/CD pipeline (GitHub Actions -> auto-deploy on push)
- [ ] Staging environment
- [ ] Rate limiting on API
- [ ] Audit logging (who changed what, when)
- [ ] Server migration plan (when droplet resources get tight)
- [ ] Offline-first with sync (PWA enhancement)
- [ ] Public API / webhook system for third-party integrations

---

## Implementation Priority (as of Feb 2026)

| Priority | Phase | Notes |
|----------|-------|-------|
| 1 | **Phase 8: Store Gamification** | Leaderboards, challenges, badges |
| 2 | **Phase 7: Advanced AI** | Predictive scoring, NL queries, AI coaching. Department AI eval already done (knives demo ready for Jordan) |
| 3 | **Phase 9: AI Video Analysis** | Gemini API setup needed. Post-walk video upload + analysis |
| 4 | **Phase 4.5: Data Integrations** | Mango SFTP import (pending cred verification), staffing data (source TBD), sales correlation dashboard |
| 5 | **Phase 6: White-Label** | Tied to marketing expansion plan. Deferred until other verticals are pursued |

**Key dependencies:**
- Mango SFTP: Need to verify credentials and available file formats before building importer
- Staffing data: Need to identify source (manual entry? POS? scheduling software?)
- Gemini API: Need API key + billing setup before Phase 9
- Department AI eval for knives: **DONE** — ready to demo with Jordan

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
| AI | Claude API (Anthropic Sonnet 4.5) |
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
