# StoreScore Evaluation System — Comprehensive Analysis & Proposal

## Current State: Three Evaluation Types

StoreScore currently has **three distinct evaluation mechanisms** that overlap in confusing ways. This document breaks down each type, who uses it, what it does, and proposes a cleaner architecture.

---

## 1. Plan-Based Feature Availability

| Feature | Starter ($29/store/mo) | Pro ($49/store/mo) | Enterprise ($79/store/mo) |
|---|:---:|:---:|:---:|
| **Store Walks** (core_walks) | ✅ | ✅ | ✅ |
| **Department Evals** | ✅ (no gate) | ✅ | ✅ |
| **Self-Assessments** | ❌ | ❌ | ✅ |
| **Quick Assessments** | ❌ | ❌ | ✅ |
| AI Summaries (walk completion) | ❌ | ✅ | ✅ |
| AI Photo Analysis (scoring) | ❌ | ❌ | ✅ only |
| Action Items | ❌ | ✅ | ✅ |
| Evaluation Schedules | ❌ | ✅ | ✅ |
| Calendar Feeds | ❌ | ✅ | ✅ |
| Multiple Templates | ❌ (1 template) | ✅ (unlimited) | ✅ |
| External Evaluators | ❌ | ❌ | ✅ only |
| Gamification (basic) | ❌ | ✅ | ✅ |
| Gamification (advanced) | ❌ | ❌ | ✅ only |
| Corrective Actions | ❌ | ✅ | ✅ |

### Key Implications by Plan

- **Starter** orgs can ONLY do basic Store Walks + Department Evals with 1 template, no AI, no action items, no schedules. Their walks are essentially manual scoring with email results.
- **Pro** orgs get the full experience: walks with AI summaries, action items, self-assessments, schedules, and analytics.
- **Enterprise** adds AI photo analysis during walks, external evaluators, and advanced gamification.

---

## 2. Evaluation Type Breakdown

### A. Store Walks

| Aspect | Detail |
|---|---|
| **Model** | `Walk` with `template` FK set, `department` null |
| **Purpose** | Comprehensive, template-driven store evaluation with scored criteria |
| **Who creates** | `manager`+ roles (owner, admin, regional_manager, store_manager, manager) OR auto-created by Evaluation Schedules |
| **Who conducts** | The user in `conducted_by` field (can be anyone assigned, including evaluators) |
| **Evaluator role** | Evaluators can ONLY see/work on their own walks. Cannot create walks. |
| **Scoring** | Criteria from ScoringTemplate → scores 1-5 per criterion → weighted total |
| **AI features** | AI summary on completion (Pro+), AI photo scoring during walk (Enterprise) |
| **Action items** | **Auto-generated** on completion for any score ≤ 60%. Assigned to store manager with 14-day due date. |
| **Manager review** | Required. Any org member EXCEPT the evaluator can review. Requires drawn signature. Can mark "reviewed" or "disputed". |
| **Escalation** | Unreviewed walks after 3 days → auto-creates Corrective Action. Escalates at 7 and 14 days. |
| **Lock** | Walk becomes read-only 14 days after completion |
| **Plan gate** | `core_walks` (all plans). AI summaries gated behind `ai_summaries` (Pro+). Photo analysis behind `ai_photo_analysis` (Enterprise). |

**Lifecycle**: `SCHEDULED → IN_PROGRESS → COMPLETED` → Manager Review (PENDING → REVIEWED/DISPUTED)

### B. Department Evaluations

| Aspect | Detail |
|---|---|
| **Model** | `Walk` with `department` FK set, `template` null |
| **Purpose** | One-off, department-specific evaluation. Uses department sections instead of template criteria. |
| **Who creates** | `manager`+ roles (same as store walks) |
| **Who conducts** | The user in `conducted_by` field |
| **Scoring** | Criteria from Department's sections → same 1-5 scoring |
| **AI features** | AI summary attempted on completion BUT **the code has a bug** — `services.py` assumes `walk.template` for building the AI prompt, which is `null` for department walks. Falls back to basic summary. |
| **Action items** | **Auto-generated** (same logic as store walks — runs on all completed walks regardless of type) |
| **Manager review** | Same flow as store walks (signature, reviewed/disputed) |
| **Escalation** | Same unacknowledged walk escalation applies |
| **Lock** | Same 14-day lock |
| **Plan gate** | **No explicit gate** — department evals use the same `WalkViewSet` and have no separate feature flag. Any plan can use them. |
| **Calendar** | Excluded from iCal feeds |

**Lifecycle**: Same as Store Walks

### C. Self-Assessments

| Aspect | Detail |
|---|---|
| **Model** | `SelfAssessment` + `SelfAssessmentTemplate` + `AssessmentPrompt` + `AssessmentSubmission` (entirely separate model tree) |
| **Purpose** | Photo/video-based compliance checks. Store personnel take photos matching prompts, AI evaluates them. |
| **Who creates template** | `admin`/`owner` only |
| **Who creates assessment** | `admin`/`owner` only (assigns to a store + user) |
| **Who submits** | The `submitted_by` user (typically store_manager). Any `manager`+ can upload photos. |
| **Scoring** | AI-generated rating (good/fair/poor) per photo submission via Gemini 2.5 Flash. Self-rating by submitter compared to AI rating. |
| **AI features** | Core to the feature — Gemini AI analyzes every photo/video submission. Not optional. |
| **Action items** | **Manual only** — reviewer must explicitly create action items from AI findings via `/create-action-items/` endpoint. NOT auto-generated. |
| **Review** | Any `manager`+ can review. Can override AI ratings per submission. No signature required. |
| **Escalation** | **None** — no auto-escalation for unreviewed assessments |
| **Lock** | **None** — no time-based lock |
| **Plan gate** | `self_assessments` feature flag — **Enterprise only** (moved from Pro in Feb 2026) |

**Lifecycle**: `PENDING → SUBMITTED → REVIEWED`

### C2. Quick Assessments (New — Feb 2026)

| Aspect | Detail |
|---|---|
| **Model** | `SelfAssessment` with `assessment_type='quick'`, `template` null |
| **Purpose** | Freeform photo capture during store visits. Regional managers snap photos, AI analyzes and auto-creates action items. No template or predefined prompts. |
| **Who creates** | `regional_manager`, `admin`, `owner` |
| **Who submits** | The creating user uploads photos directly |
| **Scoring** | AI-generated analysis per photo via Gemini 2.5 Flash. No self-rating (no prompts). |
| **AI features** | Core — AI analyzes every photo with freeform prompt. Auto-extracts action items. |
| **Action items** | **Auto-generated** — AI findings automatically create action items with priority-based due dates (critical=1d, high=3d, medium=7d, low=14d). No manual approval needed. |
| **Review** | Same review flow as self-assessments. |
| **Plan gate** | `self_assessments` feature flag — **Enterprise only** |

**Lifecycle**: Same as Self-Assessments (`PENDING → SUBMITTED → REVIEWED`)

---

## 3. Role-by-Evaluation Matrix

| Role | Store Walks | Department Evals | Self-Assessments |
|---|---|---|---|
| **Owner** | Create, conduct, complete, review, sign-off action items | Same | Create templates, create assessments, submit, review, create action items |
| **Admin** | Create, conduct, complete, review, sign-off action items | Same | Create templates, create assessments, submit, review, create action items |
| **Regional Manager** | Create, conduct, complete, review, sign-off action items | Same | View, submit, review, create action items, sign-off action items |
| **Store Manager** | Create, conduct, complete, review (not own) | Same | View (own stores only), submit photos, review |
| **Manager** | Create, conduct, complete, review (not own) | Same | View, submit, review, create action items |
| **Evaluator** | Conduct (own walks only). Cannot create, review, or see others' walks | Same | ❌ No access (below IsOrgManagerOrAbove) |
| **Finance** | ❌ No access (below IsOrgManagerOrAbove for create/conduct) | Same | ❌ No access |
| **Member** | ❌ No access | Same | ❌ No access |

### Action Item Sign-Off

For ALL action item types (from walks, assessments, or manual):
- **Can sign off**: `regional_manager`, `admin`, `owner` ONLY
- **Cannot self-sign-off**: The person who resolved it cannot approve their own resolution
- **Push-back**: Same roles can push back with required notes

---

## 4. Problems Identified

### 4.1 Confusing Overlap
- **Store Walks vs Department Evals** share the same model (`Walk`), same endpoints, same lifecycle, and same permissions. The only difference is whether you fill `template` or `department`. Users don't understand when to use which.
- Department Evals are not gated by any feature flag, so even Starter users get them, while the action items they generate are gated (Pro+). This means Starter users trigger action item creation that they can't access.

### 4.2 Broken AI Summary for Department Evals
- `generate_walk_summary` in `services.py` builds the AI prompt using `walk.template.sections`. For department walks, `walk.template` is `null`. The fallback summary is bare-bones. This is a code bug.

### 4.3 Inconsistent Action Item Behavior
- Store Walks/Department Evals: **auto-generated** on completion (scores ≤ 60%)
- Self-Assessments: **manual** — reviewer must explicitly create them
- Users don't know what to expect. Some evaluations automatically generate follow-up, others require manual intervention.

### 4.4 No Unified Dashboard
- Three separate tabs (Store Walks, Department Evals, Assessments) with different UX patterns
- No unified "evaluation" concept that shows all pending evaluations across types

### 4.5 Self-Assessment is Completely Separate
- Different model tree, different permissions structure, different AI provider (Gemini vs Claude)
- No shared concept of "template" — `ScoringTemplate` vs `SelfAssessmentTemplate` are unrelated models
- Different rating scale: walks use 1-5 numeric, assessments use good/fair/poor

### 4.6 Department Eval Calendar Gap
- Department evals are explicitly excluded from calendar/iCal feeds. Users scheduling department evals get no calendar visibility.

---

## 5. Proposal: Unified Evaluation Experience

### Option A: Consolidate UI, Keep Models (Recommended — Minimal Risk)

Keep the existing backend models and APIs intact but redesign the frontend to present a unified evaluation experience.

#### Changes:

**1. Rename the Evaluations page tabs:**
- "Store Walks" → "**Store Evaluations**" (template-based, scored)
- "Department Evals" → "**Department Checks**" (department-based, scored)
- "Assessments" → "**Photo Assessments**" (photo/video, AI-scored)
- "Schedules" remains

**2. Add a unified "Evaluation Activity" card at the top of the page:**
- Shows all pending/in-progress items across all three types in a single feed
- "3 walks awaiting review, 1 assessment pending submission, 2 department checks scheduled"
- Acts as a command center for what needs attention

**3. Add clear "When to use this" descriptions on each tab:**
- Store Evaluations: "Comprehensive scored walkthrough of an entire store using your scoring template"
- Department Checks: "Quick evaluation of a specific department (produce, bakery, etc.)"
- Photo Assessments: "Visual compliance check — staff photograph conditions, AI evaluates" (Pro+)

**4. Standardize action item behavior with clear messaging:**
- Walks/Department Checks: Show badge "Action items auto-created for scores below 60%"
- Photo Assessments: Show badge "Review AI findings and create action items as needed"

**5. Fix the department eval AI summary bug** to give department evals proper AI summaries.

**6. Gate department evals properly** — if they generate action items, the action item feature should be checked.

#### Effort: Low-Medium (frontend-focused, one backend bug fix)

---

### Option B: Fully Merge Store Walks + Department Evals

Merge department evaluations into the walk system more deeply.

#### Changes:

**1. Eliminate the "department eval" as a distinct concept.** A walk can target a whole store (via template) OR a specific department within a store, but it's all a "Store Evaluation."

**2. On walk creation, add a "Scope" picker:**
- "Full Store" → uses ScoringTemplate (existing behavior)
- "Single Department" → uses Department sections (existing behavior)
- The scope selection is part of the walk creation flow, not a separate tab

**3. Single list view** showing all walks regardless of scope, with a filter for "Full Store" / "Department" / "All".

**4. Fix AI summary to handle both scope types.**

**5. Self-Assessments remain separate** (fundamentally different: photo-based, different AI provider, different rating model).

#### Effort: Medium (frontend + some backend serializer changes)

---

### Option C: Full Unification (Long-Term)

Create a single `Evaluation` model that encompasses all three types, with a `type` field. Unified templates. Single lifecycle. This would require significant backend refactoring and data migration.

#### Not recommended now — too much risk for existing users and data.

---

## 6. Quick Wins (Do Now)

Regardless of which option above is chosen, these should be fixed immediately:

1. **Fix department eval AI summary bug** — `services.py:_build_walk_data()` should handle `walk.department.sections` when `walk.template` is null.
2. **Add "When to use" helper text** on each evaluation tab so users understand the difference.
3. **Add plan-gated feature badges** in the UI — gray out Self-Assessments tab for Starter users with "Pro plan required" badge. Show "Enterprise" badge on AI photo analysis features.
4. **Prevent action item generation for Starter plans** — the auto-generation runs but Starter users can't see action items. Either skip generation or show a "Upgrade to Pro to track action items" prompt.
