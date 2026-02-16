# StoreScore.app — Product Roadmap

## Vision
AI-powered store quality management platform for Ace Hardware franchises, with white-label potential for other brands.

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
- [x] Walk status tracking (scheduled → in progress → completed)
- [x] PWA setup (manifest, service worker, icons, iOS standalone)
- [x] Auto-save with dirty tracking + unsaved changes protection
- [x] Mobile-first touch targets (56px score buttons, touch-manipulation)
- [x] Live dashboard (stats, in-progress walks, recent walks)
- [x] Historical data import (137 walks, 2022–2025, management command)
- [x] Resend email integration with evaluator reply-to
- [x] 6 evaluator user accounts created from import

## Phase 3: Roles + Permissions
*User management and access control*

- [ ] Expanded role system: owner, admin, finance, regional_manager, store_manager, member
- [ ] RegionAssignment model (links users to regions)
- [ ] StoreAssignment model (links users to stores)
- [ ] Role-based data scoping:
  - Owner/Admin: all stores
  - Finance: read-only scores/reports
  - Regional Manager: only their region's stores
  - Store Manager: only their assigned store(s)
  - Member: read-only, can mark issues resolved
- [ ] Platform-level roles: Super Admin (is_superuser), Site Support (is_staff)
- [ ] User invitation flow (invite by email, assign role + store/region)
- [ ] User management UI (admin panel)

## Phase 4: Reporting + Analytics
*Trending, dashboards, data export*

- [x] Live dashboard with real data (stats, in-progress, recent walks)
- [ ] Store scorecard view (latest walk, trend over time)
- [ ] Section-level trend charts (is Curb Appeal improving?)
- [ ] Regional comparison views (which stores need attention?)
- [ ] Date range filtering
- [ ] CSV/PDF export of walk results
- [ ] Scheduled report emails (weekly/monthly digest)
- [ ] Sales data correlation (tie walk scores to sales numbers) — see [INTEGRATIONS.md](./INTEGRATIONS.md)

## Phase 4.5: Data Integrations (Eagle POS, Mango Report)
*Connect to Ace's data ecosystem — [Full details in INTEGRATIONS.md](./INTEGRATIONS.md)*

- [ ] IntegrationConfig model (per-org connection settings)
- [ ] StoreDataPoint model (flexible time-series metrics per store)
- [ ] Manual data entry forms (weekly sales, staffing, complaints)
- [ ] CSV import endpoint with column mapping (Eagle exports, Mango Excel)
- [ ] Eagle POS API integration (Epicor REST/OData — requires franchisee auth)
- [ ] Mango Report data import (Excel automation or future API)
- [ ] Walk score ↔ sales correlation analytics
- [ ] Ace Corporate partnership exploration

## Phase 5: Onboarding + Employee Experience
*Self-service signup, benefits communication*

- [ ] Public-facing "Why StoreScore" / benefits page
- [ ] Store employee onboarding flow
- [ ] Member dashboard (see your store's scores, what needs fixing)
- [ ] Issue tracking (criterion failed → action item → resolved)
- [ ] Recognition system (store improvements, high scores, streaks)
- [ ] Training resources linked to low-scoring criteria

## Phase 6: White-Label + Multi-Brand
*Prepare for other brands beyond Ace*

- [ ] BrandConfig model (subdomain → theme, logo, colors)
- [ ] ace.storescore.app subdomain routing
- [ ] Per-org theming on frontend (dynamic colors, logo)
- [ ] Neutral storescore.app landing page (brand-agnostic)
- [ ] Shared API backend (already org-scoped)
- [ ] Brand-specific email templates
- [ ] Onboarding flow per brand

## Phase 7: Advanced AI Features
*Deeper AI integration*

- [ ] AI-powered action item generation from walk scores
- [ ] Photo analysis (Claude vision — auto-detect issues from walk photos)
- [ ] Predictive scoring (flag stores likely to decline)
- [ ] Natural language walk queries ("Show me all stores with declining Safety scores")
- [ ] AI coaching suggestions for store managers
- [ ] Automated follow-up reminders based on AI recommendations

---

## Infrastructure Backlog

- [x] Resend email setup (DNS records + API key — pending domain verification)
- [ ] Automated database backups (pg_dump to DO Spaces)
- [ ] Monitoring / alerting (uptime, container health)
- [ ] CI/CD pipeline (GitHub Actions → auto-deploy on push)
- [ ] Staging environment
- [ ] Rate limiting on API
- [ ] Audit logging (who changed what, when)
- [ ] Server migration plan (when droplet resources get tight)

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
| Walks | 137 (historical import, 2022–2025) |
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
