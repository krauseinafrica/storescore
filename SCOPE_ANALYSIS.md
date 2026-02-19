# StoreScore — Scope & Strategic Analysis

**Date:** February 19, 2026
**Purpose:** Ensure the project stays on track without feature bloat, and clearly define what each piece of the platform does and why it exists.

---

## Executive Summary

StoreScore has completed Phases 1 through 5.75 — a substantial SaaS platform with **40+ frontend routes**, **100+ backend API endpoints**, and **25+ data models**. The core thesis ("store quality → customer experience → sales → staffing") remains tight and well-served by everything built so far. However, the platform has reached a complexity inflection point where every new feature must justify its existence against the risk of confusing users and diluting the core value proposition.

**Current state:** 1 organization (Northwest Ace), 16 stores, 137 walks, 8 users, 85.3% average score.

---

## What We Set Out to Build

The original vision was a **store quality management platform for retail franchises** built on four pillars:

1. **Evaluate** — Structured store walks with scoring, photos, and location verification
2. **Analyze** — AI-powered summaries, trend analytics, and benchmarking
3. **Improve** — Action items, corrective actions, SOPs, and coaching
4. **Prove** — Data integration (sales, staffing) to correlate quality with business outcomes

Everything built should serve one of these four pillars. Anything that doesn't is scope creep.

---

## Feature Inventory — What's Built & Why

### PILLAR 1: EVALUATE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Store Walks** (core scoring flow) | 1-2 | The core product. Section-by-section scoring with photos. | None — this is the product |
| **Department Evaluations** | 5.7 | Extends walks to department-level (grocery needs 8-15 dept evals). AI photo scoring prevents bias. | LOW — clearly differentiated from walks |
| **Self-Assessments** | 5.75 | Store managers self-evaluate with photos; AI compares to standards. Franchise accountability tool. | MEDIUM — users may confuse with walks. Need clearer UX separation. |
| **Evaluation Schedules** | 4 | Plan recurring walks. Prevents ad-hoc chaos. | LOW |
| **QR + GPS Location Verification** | 5.3 | Proves evaluator was physically present. Trust signal for franchise owners. | LOW — mostly invisible to users |
| **Scoring Templates** | 1.5 | Define what gets scored. Different templates for different use cases. | LOW — admin-only |
| **Template Library** | 5.7 | Browse and install pre-built templates. Speeds onboarding. | LOW |
| **Template Duplication** | 5.7 | Fork templates for customization. | LOW — admin-only |

**Assessment:** Pillar 1 is strong. The three evaluation types (Walks, Department Evals, Self-Assessments) each serve distinct use cases. The main risk is **user confusion between the three types** — the Dashboard and Evaluations page need to clearly explain when to use which.

### PILLAR 2: ANALYZE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Dashboard** | 1-2 | At-a-glance health: in-progress walks, recent scores, key stats. | LOW |
| **Reports / Analytics** | 4 | Trend lines, regional comparison, store rankings, section breakdown. 10+ analytics endpoints. | LOW — critical for value prop |
| **Benchmarking** | 5 | "Your store is in the 75th percentile." Anonymized cross-org comparison. | LOW |
| **Scoring Drivers** | 5.7 | Tag root causes (staffing, training, supply chain) on scores. Unique differentiator. | MEDIUM — many users may not understand/use this without guidance |
| **AI Walk Summaries** | 1.5 | Claude generates narrative summary of walk findings. Unique in market. | LOW |
| **AI Photo Analysis** | 5.75 | Gemini analyzes photos for objective quality assessment. | LOW |
| **Evaluator Consistency** | 4 | Detect scoring bias across evaluators. | LOW — admin-only |

**Assessment:** Pillar 2 needs **Phase 5.8 (Advanced Reports)** to reach its full potential. The current reports page covers the basics but lacks drill-down, driver correlation, and action item resolution analytics. This is the #1 priority for converting trials to paid.

### PILLAR 3: IMPROVE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Action Items** | 4 | Track issues found during walks → assign → resolve with photo proof. | LOW |
| **Corrective Actions** | 4 | Formal corrective process for serious/recurring issues. | MEDIUM — users may not understand difference from Action Items |
| **SOP Documents** | 5.7 | Link standard operating procedures to specific criteria. In-context guidance. | LOW — but underutilized |
| **SOP-Criterion Links** | 5.7 | Connect SOPs to the exact scoring criteria they support. | LOW — admin-only |
| **Reference Images** | 5.7 | "This is what a 5/5 looks like" for each criterion. | LOW |
| **AI-Suggested Action Items** | 5.75 | AI generates recommended actions from assessment findings. | LOW — saves time |

**Assessment:** The Action Items vs. Corrective Actions distinction is the biggest confusion risk here. Consider whether Corrective Actions should be merged into Action Items with a "severity" flag rather than being a separate concept.

### PILLAR 4: PROVE (Data Integration)

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Manual Data Entry** | 4.5 | Store managers input weekly sales/staffing numbers. | LOW |
| **CSV Import** | 4.5 | Finance uploads Excel/CSV exports from POS systems. | LOW |
| **Integration Settings** | 4.5 | Configure external data connections (Mango, Eagle). | LOW — admin-only |
| **Store Data Points** | 4.5 | Flexible time-series model for any metric type. | LOW — invisible to users |

**Assessment:** This pillar is the weakest right now (60% complete). Mango SFTP and Eagle POS integrations are pending. **This is the "holy grail" unlock** — once quality scores correlate with sales data, the ROI story writes itself. Prioritize completing this.

### SUPPORTING FEATURES (Not a Pillar — Enablers)

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Role-Based Access (8 tiers)** | 3 | Owner → Admin → Regional Mgr → Store Mgr → Manager → Finance → Member → Evaluator | MEDIUM — 8 roles may be overkill. Most orgs need 3-4. |
| **Region Hierarchy** | 5.2 | Parent/child regions with scoped data visibility. | LOW |
| **Store Management** | 5 | CRUD stores, CSV import, geocoding. | LOW |
| **Department Management** | 5.7 | Library of 15 department types across 3 categories. | LOW |
| **Team Management** | 3 | Invite, assign roles/regions/stores. | LOW |
| **Gamification** | 8 (partial) | Leaderboards, challenges, achievements. Competitive motivation. | HIGH — see below |
| **Knowledge Base** | 5.6 | In-app help articles. | LOW |
| **Onboarding Checklist** | 5.6 | Guided setup for new orgs. | LOW |
| **Platform Admin** | 5 | Super admin across all orgs (for us). | LOW |
| **Lead Capture / Demo System** | 5.5 | Public site → demo org provisioning. | LOW |
| **Billing** | Placeholder | Not implemented yet. | N/A |

---

## Scope Creep Assessment

### RED FLAGS — Features at Risk of Bloating the Platform

#### 1. Gamification (Phase 8) — HIGH RISK
**Status:** Leaderboards, challenges, and achievements are partially built into the frontend. Backend models exist.
**Risk:** Gamification is powerful when done right but confusing when half-baked. If store managers see leaderboard ranks, challenges, and achievement badges but don't understand the rules, it creates noise rather than motivation.
**Recommendation:** Either fully ship gamification with clear rules and documentation, or **hide it entirely** until it's ready. Don't leave half-built gamification visible in the sidebar. Currently `/gamification` is a route — if it's not polished, gate it behind a feature flag or remove from nav.

#### 2. Corrective Actions vs. Action Items — MEDIUM RISK
**Status:** Two separate systems for tracking follow-up work.
**Risk:** Users already struggle with "what's the difference?" Action Items are generated from walks; Corrective Actions are formal remediation plans. But in practice, most users just need one follow-up system.
**Recommendation:** Consider merging these. An Action Item with a `severity: critical` flag and a `corrective_plan` field would serve both use cases without the cognitive overhead of two separate lists.

#### 3. Eight Role Tiers — MEDIUM RISK
**Status:** Owner, admin, regional_manager, store_manager, manager, finance, member, evaluator.
**Risk:** Most organizations with 16 stores don't need 8 role types. The distinction between "manager" and "member" or "member" and "evaluator" is unclear for small orgs.
**Recommendation:** Keep the backend flexibility but simplify the frontend UI. Show 4 roles (Owner, Admin, Manager, Member) by default and offer "Advanced roles" as an expansion for enterprises.

#### 4. Video Analysis (Phase 9) — LOW RISK (future)
**Status:** Fully planned (33K-word doc) but not built.
**Risk:** Exciting tech demo but expensive to build/operate. Could distract from completing the fundamentals.
**Recommendation:** Keep as Phase 9 — enterprise-only. Do NOT start this until Phases 5.8, 5.9, and 4.5 are complete and you have paying customers.

#### 5. Too Many Tabs in Consolidated Pages — MEDIUM RISK
**Status:**
- `/evaluations` has 4 tabs: Store Walks | Department Evals | Assessments | Schedules
- `/templates` has 5 tabs: Your Templates | Library | Scoring Drivers | SOPs | Reference Images
- `/follow-ups` has 2 tabs: Action Items | Corrective Actions
**Risk:** New users opening Templates and seeing 5 tabs don't know where to start. Evaluations with 4 evaluation types requires understanding the difference between walks, department evals, and assessments.
**Recommendation:** Add contextual help (tooltips, short descriptions) to each tab explaining its purpose. Consider whether SOPs and Reference Images belong in Templates or should be accessible in-context during walk execution.

### GREEN FLAGS — Features That Are Well-Scoped

1. **Store Walks** — Core product, well-executed, clear UX
2. **AI Summaries** — Unique differentiator, adds obvious value, no confusion
3. **Location Verification** — Invisible complexity, visible trust signal
4. **Department Evaluations** — Clear use case (grocery/retail with departments)
5. **Self-Assessments** — Franchise accountability, AI prevents gaming
6. **Reports/Analytics** — Standard expectations, well-delivered
7. **Onboarding** — Reduces time-to-value, guides new users
8. **Template Library** — Speeds setup, obvious UX

---

## Competitive Positioning — Where We Stand

### Our 8 Unique Differentiators (vs. 15 direct competitors):

1. **AI Walk Summaries** — NO competitor offers narrative AI summaries of inspection findings
2. **Location Verification Badges** — Dual QR+GPS verification visible in reports. New trust standard.
3. **Franchise-Native Self-Assessments** — Only FranConnect offers similar (at 10-40x our cost)
4. **Gamified Store Quality** — Blue ocean. No competitor gamifies inspections themselves.
5. **SOP-to-Finding Linking** — In-context guidance during walks. Only Xenia/FranConnect have SOPs; neither links them to findings.
6. **Purpose-Built for Retail Franchises** — No competitor is retail-franchise-native with this depth
7. **Affordable Franchise Pricing** — Competitors: $1K+/mo (FranConnect), $150+/location (Zenput). StoreScore targets $49-99/mo flat.
8. **Scoring Drivers** — Root cause tagging (staffing, training, supply chain). No competitor offers this.

### Biggest Competitive Threats:
- **SafetyCulture** — 75K+ orgs, 1.5M users. If they add AI summaries + franchise features → serious threat.
- **Xenia** — Closest feature set, modern UI, QR+GPS. Could add franchise features easily.
- **FranConnect** — 1,500+ brands. Could modernize UI, lower SMB pricing, add AI.

### Our Moat:
The combination of AI + franchise-native + affordable + department-level evals is unique. No single competitor has all four. Our job is to deepen each of these rather than adding new surface area.

---

## Priority Recommendations

### Must Do Next (in order):

1. **Phase 5.8: Advanced Reports** — Multi-tab drill-down reporting is what converts tire-kickers. The Quality → Sales → Staffing triangle needs data visualization to prove. This is the #1 conversion driver.

2. **Phase 4.5 Completion: Mango SFTP** — This unlocks the sales correlation story. Once you show "Store A's quality score improved 12% → sales increased 8%," the ROI story is undeniable.

3. **UX Clarity Pass** — Before adding new features, ensure existing features are understandable:
   - Add brief descriptions to each tab on consolidated pages
   - Consider merging Action Items + Corrective Actions
   - Simplify role display (show 4 by default, expand for enterprise)
   - Either polish gamification or hide it

4. **Phase 5.9: Public Site** — Homepage rewrite + enterprise landing page will directly impact lead generation and conversion.

### Should Defer:
- Phase 6 (White-Label) — No paying customers in other verticals yet
- Phase 9 (Video Analysis) — Enterprise-only, expensive, wait for revenue
- Phase 7 completion (Predictive AI, NL queries) — Nice-to-have, not conversion-critical
- Phase 8 completion (Gamification) — Only finish this if it can be done well. Half-built gamification is worse than none.

### Should Consider Removing/Simplifying:
- Corrective Actions (merge into Action Items with severity flag)
- Reduce visible role tiers from 8 to 4 (keep backend, simplify frontend)
- Evaluate whether Data Integrations page needs to be in main nav for non-admin users

---

## Feature-Purpose Matrix

Every feature should pass this test: **"Does this help a user Evaluate, Analyze, Improve, or Prove store quality?"**

| Feature | Evaluate | Analyze | Improve | Prove | Verdict |
|---------|----------|---------|---------|-------|---------|
| Store Walks | Yes | | | | CORE |
| Dept Evals | Yes | | | | CORE |
| Self-Assessments | Yes | | | | CORE |
| AI Summaries | | Yes | | | CORE |
| Reports | | Yes | | | CORE |
| Benchmarking | | Yes | | | CORE |
| Action Items | | | Yes | | CORE |
| SOPs | | | Yes | | CORE |
| Scoring Drivers | | Yes | | | CORE |
| Data Integrations | | | | Yes | CORE |
| Gamification | | | Yes (motivation) | | SUPPORTING — only if polished |
| Knowledge Base | | | | | ENABLING — onboarding |
| Lead Capture | | | | | GTM — necessary for growth |
| Video Analysis | Yes | Yes | | | FUTURE — enterprise only |

---

## Summary

**StoreScore is NOT bloated.** The platform is comprehensive but purposeful — every major feature maps to the four-pillar thesis. The risk isn't that we've built too much; it's that **the volume of features may overwhelm new users** if not properly organized and explained.

**The path forward is depth, not breadth:**
1. Make existing features more understandable (UX clarity pass)
2. Complete the data story (Phase 4.5 → sales correlation)
3. Build the reporting that proves ROI (Phase 5.8)
4. Tell the story publicly (Phase 5.9)

Don't add new feature categories. Deepen the ones you have.
