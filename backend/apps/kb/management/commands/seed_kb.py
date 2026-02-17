"""
Seed the knowledge base with initial platform documentation articles.

Usage:
    python manage.py seed_kb
    python manage.py seed_kb --clear  # Delete existing articles first
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.kb.models import KnowledgeArticle, KnowledgeSection

logger = logging.getLogger(__name__)


ARTICLES = [
    # ── Getting Started ──────────────────────────────────────────────
    {
        'title': 'Welcome to StoreScore',
        'slug': 'welcome-to-storescore',
        'summary': 'An overview of the StoreScore platform, its core concepts, and how to navigate the app.',
        'category': 'getting_started',
        'feature_tier': 'starter',
        'app_route': '/dashboard',
        'order': 0,
        'sections': [
            {
                'anchor': 'dashboard-overview',
                'title': 'Dashboard Overview',
                'order': 0,
                'content': (
                    '<p>The <strong>Dashboard</strong> is your home base in StoreScore. '
                    'It gives you a quick snapshot of your organization\'s evaluation activity, '
                    'including recent walks, score trends, and outstanding action items.</p>'
                    '<ul>'
                    '<li><strong>Score summary</strong> — see average scores across all stores</li>'
                    '<li><strong>Recent activity</strong> — latest walks, action items, and assessments</li>'
                    '<li><strong>Quick actions</strong> — start a new walk or view reports</li>'
                    '</ul>'
                    '<p>Use the sidebar to navigate to any section of the app.</p>'
                ),
            },
            {
                'anchor': 'platform-navigation',
                'title': 'Navigating the Platform',
                'order': 1,
                'content': (
                    '<p>StoreScore is organized around a sidebar navigation that adapts to your role:</p>'
                    '<ul>'
                    '<li><strong>Dashboard</strong> — overview of activity and metrics</li>'
                    '<li><strong>Stores</strong> — manage your store locations</li>'
                    '<li><strong>Walks</strong> — conduct and review evaluations</li>'
                    '<li><strong>Action Items</strong> — track follow-up tasks from evaluations</li>'
                    '<li><strong>Reports</strong> — view trends and export data</li>'
                    '<li><strong>Settings</strong> — configure goals, templates, and organization preferences</li>'
                    '</ul>'
                    '<p>Your role determines which sections are visible. Admins and owners have access to all areas, '
                    'while evaluators see a focused view of walks and stores.</p>'
                ),
            },
            {
                'anchor': 'key-concepts',
                'title': 'Key Concepts',
                'order': 2,
                'content': (
                    '<p>Before you get started, here are the core concepts in StoreScore:</p>'
                    '<ul>'
                    '<li><strong>Walks</strong> — in-store evaluations conducted using a scoring template</li>'
                    '<li><strong>Scoring Templates</strong> — customizable checklists with sections, criteria, and point values</li>'
                    '<li><strong>Action Items</strong> — follow-up tasks created from walk findings</li>'
                    '<li><strong>Drivers</strong> — root cause categories assigned to low-scoring criteria</li>'
                    '<li><strong>Self-Assessments</strong> — photo-based store self-checks submitted by managers</li>'
                    '<li><strong>Corrective Actions</strong> — automated escalations for overdue evaluations or unacknowledged walks</li>'
                    '</ul>'
                ),
            },
        ],
    },
    {
        'title': 'Quick Start Guide',
        'slug': 'quick-start-guide',
        'summary': 'Get up and running fast — create your first store, build a template, and conduct your first walk.',
        'category': 'getting_started',
        'feature_tier': 'starter',
        'app_route': '',
        'order': 1,
        'sections': [
            {
                'anchor': 'quick-start-stores',
                'title': 'Step 1: Add Your First Store',
                'order': 0,
                'content': (
                    '<p>Head to <a href="/stores">Stores</a> and click <strong>Add Store</strong>. '
                    'Fill in the store name, number, address, and optionally assign it to a region.</p>'
                    '<p>Tip: Adding latitude/longitude enables GPS verification during walks, '
                    'confirming evaluators are physically at the store.</p>'
                ),
            },
            {
                'anchor': 'quick-start-template',
                'title': 'Step 2: Create a Scoring Template',
                'order': 1,
                'content': (
                    '<p>Go to <a href="/settings">Settings</a> and find the <strong>Scoring Templates</strong> section. '
                    'Click <strong>Create Template</strong> to build your first evaluation checklist.</p>'
                    '<ul>'
                    '<li>Add <strong>sections</strong> to group related criteria (e.g., "Cleanliness", "Merchandising")</li>'
                    '<li>Add <strong>criteria</strong> within each section with point values</li>'
                    '<li>Set <strong>section weights</strong> to control how much each area affects the total score</li>'
                    '</ul>'
                ),
            },
            {
                'anchor': 'quick-start-walk',
                'title': 'Step 3: Conduct Your First Walk',
                'order': 2,
                'content': (
                    '<p>Navigate to <a href="/walks">Walks</a> and click <strong>New Walk</strong>. '
                    'Select a store and template, then begin scoring.</p>'
                    '<ul>'
                    '<li>Score each criterion on the template</li>'
                    '<li>Add notes and photos as evidence</li>'
                    '<li>Select <strong>drivers</strong> for low-scoring items to identify root causes</li>'
                    '<li>Complete the walk and review the summary</li>'
                    '</ul>'
                    '<p>After completion, an AI summary is generated automatically to highlight key findings.</p>'
                ),
            },
        ],
    },
    {
        'title': 'Understanding Plans & Tiers',
        'slug': 'understanding-plans',
        'summary': 'Compare Starter, Pro, and Enterprise plans to understand which features are available at each tier.',
        'category': 'getting_started',
        'feature_tier': 'starter',
        'app_route': '/billing',
        'order': 2,
        'sections': [
            {
                'anchor': 'tier-comparison',
                'title': 'Plan Comparison',
                'order': 0,
                'content': (
                    '<p>StoreScore offers three tiers to match your organization\'s needs:</p>'
                    '<table>'
                    '<tr><th>Feature</th><th>Starter</th><th>Pro</th><th>Enterprise</th></tr>'
                    '<tr><td>Stores & Walks</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>'
                    '<tr><td>Scoring Templates</td><td>1</td><td>Unlimited</td><td>Unlimited</td></tr>'
                    '<tr><td>Team Members</td><td>Up to 5</td><td>Up to 25</td><td>Unlimited</td></tr>'
                    '<tr><td>Action Items</td><td>&mdash;</td><td>Included</td><td>Included</td></tr>'
                    '<tr><td>AI Summaries</td><td>&mdash;</td><td>Included</td><td>Included</td></tr>'
                    '<tr><td>Evaluation Schedules</td><td>&mdash;</td><td>Included</td><td>Included</td></tr>'
                    '<tr><td>SOP Document Linking</td><td>&mdash;</td><td>Included</td><td>Included</td></tr>'
                    '<tr><td>AI Photo Analysis</td><td>&mdash;</td><td>&mdash;</td><td>Included</td></tr>'
                    '<tr><td>Anonymous Benchmarking</td><td>&mdash;</td><td>&mdash;</td><td>Included</td></tr>'
                    '<tr><td>Priority Support</td><td>&mdash;</td><td>&mdash;</td><td>Included</td></tr>'
                    '</table>'
                    '<p>You can upgrade or downgrade at any time from the <a href="/billing">Billing</a> page.</p>'
                ),
            },
        ],
    },

    # ── Store Management ─────────────────────────────────────────────
    {
        'title': 'Managing Stores',
        'slug': 'managing-stores',
        'summary': 'Learn how to add, edit, and organize your store locations with regions and geolocation.',
        'category': 'store_management',
        'feature_tier': 'starter',
        'app_route': '/stores',
        'order': 0,
        'sections': [
            {
                'anchor': 'stores-overview',
                'title': 'Stores Overview',
                'order': 0,
                'content': (
                    '<p>The <a href="/stores">Stores</a> page is where you manage all your store locations. '
                    'Each store has a name, number, address, and can be assigned to a region for organization.</p>'
                    '<ul>'
                    '<li><strong>Add stores</strong> individually or in bulk</li>'
                    '<li><strong>Edit</strong> store details, contact info, and manager assignments</li>'
                    '<li><strong>Deactivate</strong> stores that are closed or temporarily offline</li>'
                    '<li><strong>Geolocation</strong> — add latitude/longitude for GPS-verified walks</li>'
                    '</ul>'
                    '<p>Stores can be filtered by region, status, and searched by name or number.</p>'
                ),
            },
            {
                'anchor': 'stores-regions',
                'title': 'Regions',
                'order': 1,
                'content': (
                    '<p><strong>Regions</strong> let you group stores geographically or organizationally. '
                    'Regional managers can be assigned to regions to scope their access.</p>'
                    '<ul>'
                    '<li>Go to the <a href="/stores?manage-regions">Stores</a> page and click <strong>Manage Regions</strong> to create, edit, or delete regions</li>'
                    '<li>Assign a store to a region when creating or editing the store</li>'
                    '<li>Regional managers only see stores in their assigned regions</li>'
                    '</ul>'
                ),
            },
        ],
    },
    {
        'title': 'Store Assignments',
        'slug': 'store-assignments',
        'summary': 'Understand how to assign managers, evaluators, and regional managers to specific stores.',
        'category': 'store_management',
        'feature_tier': 'starter',
        'app_route': '/team',
        'order': 1,
        'sections': [
            {
                'anchor': 'store-assignments-overview',
                'title': 'How Assignments Work',
                'order': 0,
                'content': (
                    '<p>Team members can be scoped to specific stores or regions, controlling what they can see and do:</p>'
                    '<ul>'
                    '<li><strong>Store Managers</strong> — assigned to specific stores, can view walks and respond to action items for their stores</li>'
                    '<li><strong>Regional Managers</strong> — assigned to regions, can manage all stores within their region</li>'
                    '<li><strong>Evaluators</strong> — can conduct walks at any store they\'re assigned to</li>'
                    '</ul>'
                    '<p>Assignments are managed from the <a href="/team">Team</a> page by editing a member\'s profile.</p>'
                ),
            },
        ],
    },

    # ── Evaluations & Walks ──────────────────────────────────────────
    {
        'title': 'Scoring Templates',
        'slug': 'scoring-templates',
        'summary': 'Create and customize scoring templates with sections, criteria, weights, and point values.',
        'category': 'evaluations',
        'feature_tier': 'starter',
        'app_route': '/settings',
        'order': 0,
        'sections': [
            {
                'anchor': 'templates-overview',
                'title': 'Template Structure',
                'order': 0,
                'content': (
                    '<p>Scoring templates define what gets evaluated during a walk. Each template contains:</p>'
                    '<ul>'
                    '<li><strong>Sections</strong> — logical groupings like "Cleanliness", "Customer Service", "Safety"</li>'
                    '<li><strong>Criteria</strong> — individual items to score within each section</li>'
                    '<li><strong>Point values</strong> — maximum points per criterion</li>'
                    '<li><strong>Section weights</strong> — percentage weight for each section\'s contribution to the total score</li>'
                    '</ul>'
                    '<p>Templates are managed from <a href="/settings">Settings</a>. You can have multiple templates '
                    'for different evaluation types (e.g., full audit vs. quick check).</p>'
                ),
            },
            {
                'anchor': 'templates-criteria',
                'title': 'Configuring Criteria',
                'order': 1,
                'content': (
                    '<p>Each criterion can include:</p>'
                    '<ul>'
                    '<li><strong>Name & description</strong> — what the evaluator is looking for</li>'
                    '<li><strong>Max points</strong> — the highest score possible</li>'
                    '<li><strong>Scoring guidance</strong> — instructions for how to assign points consistently</li>'
                    '<li><strong>SOP reference</strong> — link to relevant standard operating procedures</li>'
                    '</ul>'
                ),
            },
        ],
    },
    {
        'title': 'Conducting a Walk',
        'slug': 'conducting-a-walk',
        'summary': 'A step-by-step guide to conducting an in-store evaluation from start to finish.',
        'category': 'evaluations',
        'feature_tier': 'starter',
        'app_route': '/walks',
        'order': 1,
        'sections': [
            {
                'anchor': 'walks-overview',
                'title': 'Walks Overview',
                'order': 0,
                'content': (
                    '<p>A <strong>walk</strong> is an in-store evaluation where you score each criterion on a template. '
                    'Walks can be scheduled in advance or started on-demand.</p>'
                    '<p>To start a walk, go to <a href="/walks">Walks</a> &rarr; <strong>New Walk</strong>, '
                    'select a store and template, then begin the evaluation.</p>'
                ),
            },
            {
                'anchor': 'walks-scoring',
                'title': 'Scoring Criteria',
                'order': 1,
                'content': (
                    '<p>During a walk, you\'ll score each criterion in the template:</p>'
                    '<ul>'
                    '<li>Enter a <strong>point value</strong> from 0 to the maximum for each criterion</li>'
                    '<li>Add <strong>notes</strong> to explain your score or provide context</li>'
                    '<li>For low scores, select a <strong>driver</strong> (root cause) to categorize the issue</li>'
                    '<li>Use <strong>section notes</strong> to summarize observations for each section</li>'
                    '</ul>'
                    '<p>Scores are saved automatically as you work through the template.</p>'
                ),
            },
            {
                'anchor': 'walks-photos',
                'title': 'Adding Photos',
                'order': 2,
                'content': (
                    '<p>Photos provide visual evidence to support your evaluation findings:</p>'
                    '<ul>'
                    '<li>Attach photos to specific <strong>criteria</strong> or to the walk as a whole</li>'
                    '<li>Add <strong>captions</strong> to describe what the photo shows</li>'
                    '<li>Photos can be taken directly from your device camera or uploaded from your gallery</li>'
                    '</ul>'
                    '<p>On Pro and Enterprise plans, photos are automatically analyzed by AI to provide '
                    'additional observations and SOP compliance checks.</p>'
                ),
            },
            {
                'anchor': 'walks-gps',
                'title': 'GPS Verification',
                'order': 3,
                'content': (
                    '<p>When a store has latitude/longitude configured, StoreScore can verify that the evaluator '
                    'is physically at the store location when starting a walk.</p>'
                    '<ul>'
                    '<li>GPS check happens automatically when you start the walk</li>'
                    '<li>The distance from the store is recorded</li>'
                    '<li>Location verification status is shown on the walk detail page</li>'
                    '</ul>'
                ),
            },
        ],
    },
    {
        'title': 'Walk Results & Review',
        'slug': 'walk-results-and-review',
        'summary': 'Review completed walks, AI-generated summaries, scores, and manager acknowledgment.',
        'category': 'evaluations',
        'feature_tier': 'starter',
        'app_route': '/walks',
        'order': 2,
        'sections': [
            {
                'anchor': 'walk-results',
                'title': 'Reviewing Walk Results',
                'order': 0,
                'content': (
                    '<p>After completing a walk, you can review the full results including:</p>'
                    '<ul>'
                    '<li><strong>Total score</strong> — the weighted aggregate score</li>'
                    '<li><strong>Section breakdowns</strong> — scores per section with weights applied</li>'
                    '<li><strong>Individual criteria</strong> — each score, note, driver, and photo</li>'
                    '<li><strong>AI summary</strong> — an auto-generated narrative highlighting key findings</li>'
                    '</ul>'
                ),
            },
            {
                'anchor': 'walk-signatures',
                'title': 'Signatures & Manager Review',
                'order': 1,
                'content': (
                    '<p>Walks support a two-signature workflow:</p>'
                    '<ul>'
                    '<li><strong>Evaluator signature</strong> — the person who conducted the walk signs off</li>'
                    '<li><strong>Manager signature</strong> — the store manager acknowledges the walk results</li>'
                    '</ul>'
                    '<p>Managers can add review notes and mark their acknowledgment status as '
                    '<strong>reviewed</strong> or <strong>disputed</strong>.</p>'
                ),
            },
        ],
    },
    {
        'title': 'Scoring Drivers',
        'slug': 'scoring-drivers',
        'summary': 'Use drivers to identify root causes when criteria score low during evaluations.',
        'category': 'evaluations',
        'feature_tier': 'starter',
        'app_route': '/settings',
        'order': 3,
        'sections': [
            {
                'anchor': 'drivers-overview',
                'title': 'What Are Drivers?',
                'order': 0,
                'content': (
                    '<p><strong>Drivers</strong> are root cause categories that help you understand '
                    '<em>why</em> a criterion scored low. When an evaluator gives a low score, '
                    'they select a driver to categorize the issue.</p>'
                    '<p>Examples of drivers:</p>'
                    '<ul>'
                    '<li>Training — staff need more training</li>'
                    '<li>Equipment — broken or missing equipment</li>'
                    '<li>Process — unclear or outdated process</li>'
                    '<li>Staffing — not enough staff on shift</li>'
                    '</ul>'
                    '<p>Drivers are configured in <a href="/settings">Settings</a> and can be customized '
                    'to match your organization\'s needs. Driver data appears in reports to help '
                    'identify systemic issues.</p>'
                ),
            },
        ],
    },

    # ── Action & Corrective Tracking ─────────────────────────────────
    {
        'title': 'Action Items',
        'slug': 'action-items',
        'summary': 'Create, assign, and track follow-up tasks from walk findings with photo verification.',
        'category': 'action_tracking',
        'feature_tier': 'pro',
        'app_route': '/action-items',
        'order': 0,
        'sections': [
            {
                'anchor': 'action-items-overview',
                'title': 'Action Items Overview',
                'order': 0,
                'feature_tier': 'pro',
                'content': (
                    '<p><strong>Action Items</strong> are follow-up tasks created from walk findings. '
                    'When a criterion scores below expectations, you can create an action item to '
                    'track the remediation.</p>'
                    '<ul>'
                    '<li><strong>Create</strong> action items directly from walk results</li>'
                    '<li><strong>Assign</strong> them to store managers or team members</li>'
                    '<li><strong>Set priority</strong> — low, medium, high, or critical</li>'
                    '<li><strong>Set due dates</strong> for timely resolution</li>'
                    '</ul>'
                    '<p>Action items can be viewed and filtered from the '
                    '<a href="/action-items">Action Items</a> page.</p>'
                ),
            },
            {
                'anchor': 'action-items-responses',
                'title': 'Responding to Action Items',
                'order': 1,
                'feature_tier': 'pro',
                'content': (
                    '<p>Assigned team members can respond to action items with:</p>'
                    '<ul>'
                    '<li><strong>Notes</strong> — describe what was done to address the issue</li>'
                    '<li><strong>Photos</strong> — provide visual proof of the fix (before/after)</li>'
                    '</ul>'
                    '<p>Once resolved, the action item can be marked as complete. The full history '
                    'of responses is preserved for audit trail purposes.</p>'
                ),
            },
        ],
    },
    {
        'title': 'Corrective Actions',
        'slug': 'corrective-actions',
        'summary': 'Automated escalations for overdue evaluations and unacknowledged walks.',
        'category': 'action_tracking',
        'feature_tier': 'pro',
        'app_route': '/corrective-actions',
        'order': 1,
        'sections': [
            {
                'anchor': 'corrective-actions-overview',
                'title': 'Corrective Actions Overview',
                'order': 0,
                'feature_tier': 'pro',
                'content': (
                    '<p><strong>Corrective Actions</strong> are automatically generated when evaluations '
                    'are overdue or walks go unacknowledged by store managers.</p>'
                    '<p>There are three escalation levels:</p>'
                    '<ul>'
                    '<li><strong>Reminder</strong> — initial notification that action is needed</li>'
                    '<li><strong>Escalated</strong> — issue has persisted, escalated to regional manager</li>'
                    '<li><strong>Critical</strong> — requires immediate attention from admin</li>'
                    '</ul>'
                    '<p>Corrective actions are resolved automatically when the underlying issue is addressed '
                    '(e.g., the overdue walk is completed or the manager acknowledges the walk).</p>'
                ),
            },
        ],
    },

    # ── AI Features ──────────────────────────────────────────────────
    {
        'title': 'AI Walk Summaries',
        'slug': 'ai-walk-summaries',
        'summary': 'Understand how AI-generated summaries are created after each walk evaluation.',
        'category': 'ai_features',
        'feature_tier': 'pro',
        'app_route': '/walks',
        'order': 0,
        'sections': [
            {
                'anchor': 'ai-summaries-overview',
                'title': 'How AI Summaries Work',
                'order': 0,
                'feature_tier': 'pro',
                'content': (
                    '<p>When a walk is completed, StoreScore automatically generates an '
                    '<strong>AI summary</strong> that highlights:</p>'
                    '<ul>'
                    '<li>Key strengths — areas where the store scored well</li>'
                    '<li>Areas for improvement — low-scoring criteria and patterns</li>'
                    '<li>Recommended actions — suggested next steps based on findings</li>'
                    '<li>Comparison context — how this walk compares to recent performance</li>'
                    '</ul>'
                    '<p>AI summaries appear on the walk detail page and are included in reports. '
                    'They save time by distilling a complex evaluation into clear, actionable insights.</p>'
                ),
            },
        ],
    },
    {
        'title': 'AI Photo Analysis & SOP Matching',
        'slug': 'ai-photo-analysis',
        'summary': 'AI-powered photo scoring and automatic SOP compliance checking for walk photos.',
        'category': 'ai_features',
        'feature_tier': 'enterprise',
        'app_route': '/walks',
        'order': 1,
        'sections': [
            {
                'anchor': 'ai-photo-analysis-overview',
                'title': 'AI Photo Analysis',
                'order': 0,
                'feature_tier': 'enterprise',
                'content': (
                    '<p>On Enterprise plans, photos attached to walks are automatically analyzed by AI:</p>'
                    '<ul>'
                    '<li><strong>Visual assessment</strong> — AI evaluates the photo for cleanliness, organization, compliance</li>'
                    '<li><strong>SOP matching</strong> — photos are compared against uploaded SOP documents to check compliance</li>'
                    '<li><strong>Observations</strong> — AI provides detailed notes about what it sees in the image</li>'
                    '</ul>'
                    '<p>This feature works with self-assessments too, giving managers instant feedback on their '
                    'submitted photos.</p>'
                ),
            },
        ],
    },

    # ── Reports & Analytics ──────────────────────────────────────────
    {
        'title': 'Reports & Trends',
        'slug': 'reports-and-trends',
        'summary': 'View score trends, compare stores, and export evaluation data.',
        'category': 'reports',
        'feature_tier': 'starter',
        'app_route': '/reports',
        'order': 0,
        'sections': [
            {
                'anchor': 'reports-overview',
                'title': 'Reports Overview',
                'order': 0,
                'content': (
                    '<p>The <a href="/reports">Reports</a> page provides insights into your evaluation data:</p>'
                    '<ul>'
                    '<li><strong>Score trends</strong> — see how scores change over time for stores or regions</li>'
                    '<li><strong>Store comparisons</strong> — compare performance across locations</li>'
                    '<li><strong>Driver analysis</strong> — identify the most common root causes</li>'
                    '<li><strong>CSV export</strong> — download raw data for further analysis</li>'
                    '</ul>'
                    '<p>Filter reports by date range, store, region, or template to focus on what matters.</p>'
                ),
            },
        ],
    },
    {
        'title': 'Goals & Benchmarking',
        'slug': 'goals-and-benchmarking',
        'summary': 'Set KPI targets for your stores and optionally compare against anonymous industry benchmarks.',
        'category': 'reports',
        'feature_tier': 'starter',
        'app_route': '/settings',
        'order': 1,
        'sections': [
            {
                'anchor': 'settings-goals',
                'title': 'Setting Goals',
                'order': 0,
                'content': (
                    '<p>Goals let you set performance targets for your organization:</p>'
                    '<ul>'
                    '<li><strong>Score targets</strong> — set minimum acceptable scores for stores or regions</li>'
                    '<li><strong>Frequency targets</strong> — ensure evaluations happen on schedule</li>'
                    '<li><strong>Custom KPIs</strong> — track metrics specific to your business</li>'
                    '</ul>'
                    '<p>Goals are configured in <a href="/settings">Settings</a> and progress is tracked on the dashboard.</p>'
                ),
            },
            {
                'anchor': 'settings-benchmarking',
                'title': 'Anonymous Benchmarking',
                'order': 1,
                'feature_tier': 'enterprise',
                'content': (
                    '<p>Enterprise organizations can opt into <strong>anonymous benchmarking</strong> to see how '
                    'their scores compare against similar organizations in the industry.</p>'
                    '<ul>'
                    '<li>All benchmarking data is fully anonymized</li>'
                    '<li>See percentile rankings for your scores</li>'
                    '<li>Identify areas where you lead or lag the industry</li>'
                    '</ul>'
                    '<p>Benchmarking is opt-in and can be enabled from <a href="/settings">Settings</a>.</p>'
                ),
            },
        ],
    },

    # ── Scheduling ───────────────────────────────────────────────────
    {
        'title': 'Evaluation Schedules',
        'slug': 'evaluation-schedules',
        'summary': 'Automate walk scheduling with recurring frequencies and calendar integration.',
        'category': 'scheduling',
        'feature_tier': 'pro',
        'app_route': '/schedules',
        'order': 0,
        'sections': [
            {
                'anchor': 'schedules-overview',
                'title': 'Schedules Overview',
                'order': 0,
                'feature_tier': 'pro',
                'content': (
                    '<p>Evaluation schedules automate the creation of walks on a recurring basis:</p>'
                    '<ul>'
                    '<li><strong>Frequencies</strong> — weekly, biweekly, monthly, or quarterly</li>'
                    '<li><strong>Scope</strong> — schedule for the entire org, a region, or a specific store</li>'
                    '<li><strong>Evaluator assignment</strong> — optionally pre-assign an evaluator</li>'
                    '<li><strong>Reminders</strong> — configurable reminder notifications before scheduled walks</li>'
                    '</ul>'
                    '<p>Manage schedules from the <a href="/schedules">Schedules</a> page. '
                    'You can also subscribe to a calendar feed (iCal) to see scheduled walks in your calendar app.</p>'
                ),
            },
        ],
    },

    # ── Team ─────────────────────────────────────────────────────────
    {
        'title': 'Team & Roles',
        'slug': 'team-and-roles',
        'summary': 'Understand the role hierarchy, permissions, and how to manage team members.',
        'category': 'team',
        'feature_tier': 'starter',
        'app_route': '/team',
        'order': 0,
        'sections': [
            {
                'anchor': 'team-roles',
                'title': 'Role Hierarchy & Permissions',
                'order': 0,
                'content': (
                    '<p>StoreScore uses a role-based permission system. Here are the roles from most to least access:</p>'
                    '<ul>'
                    '<li><strong>Owner</strong> — full access to everything, including billing and organization deletion</li>'
                    '<li><strong>Admin</strong> — manage team, settings, templates, stores, and all evaluations</li>'
                    '<li><strong>Regional Manager</strong> — manage stores and walks within assigned regions</li>'
                    '<li><strong>Store Manager</strong> — view walks and respond to action items for assigned stores</li>'
                    '<li><strong>Manager</strong> — general management access</li>'
                    '<li><strong>Finance</strong> — access to billing and reports</li>'
                    '<li><strong>Evaluator</strong> — conduct walks and view assigned stores only</li>'
                    '<li><strong>Member</strong> — basic read access</li>'
                    '</ul>'
                    '<p>Invite new team members and manage roles from the <a href="/team">Team</a> page.</p>'
                ),
            },
            {
                'anchor': 'team-invitations',
                'title': 'Inviting Team Members',
                'order': 1,
                'content': (
                    '<p>To add someone to your organization:</p>'
                    '<ol>'
                    '<li>Go to <a href="/team">Team</a></li>'
                    '<li>Click <strong>Invite Member</strong></li>'
                    '<li>Enter their email address and select a role</li>'
                    '<li>Optionally assign them to specific regions or stores</li>'
                    '</ol>'
                    '<p>They\'ll receive an email invitation to join your organization.</p>'
                ),
            },
        ],
    },

    # ── Settings ─────────────────────────────────────────────────────
    {
        'title': 'Organization Settings',
        'slug': 'organization-settings',
        'summary': 'Configure your organization\'s branding, scoring preferences, and feature toggles.',
        'category': 'settings',
        'feature_tier': 'starter',
        'app_route': '/settings',
        'order': 0,
        'sections': [
            {
                'anchor': 'settings-overview',
                'title': 'Settings Overview',
                'order': 0,
                'content': (
                    '<p>The <a href="/settings">Settings</a> page is where admins configure the organization:</p>'
                    '<ul>'
                    '<li><strong>Scoring templates</strong> — create and manage evaluation templates</li>'
                    '<li><strong>Drivers</strong> — configure root cause categories</li>'
                    '<li><strong>Goals</strong> — set performance targets</li>'
                    '<li><strong>Benchmarking</strong> — opt in/out of anonymous benchmarking</li>'
                    '</ul>'
                    '<p>Only users with Admin or Owner roles can access Settings.</p>'
                ),
            },
        ],
    },

    # ── SOP Documents ────────────────────────────────────────────────
    {
        'title': 'SOP Documents',
        'slug': 'sop-documents',
        'summary': 'Upload standard operating procedures and link them to scoring criteria for reference during walks.',
        'category': 'evaluations',
        'feature_tier': 'pro',
        'app_route': '/sop-documents',
        'order': 4,
        'sections': [
            {
                'anchor': 'sop-documents-overview',
                'title': 'SOP Documents Overview',
                'order': 0,
                'feature_tier': 'pro',
                'content': (
                    '<p><strong>SOP Documents</strong> let you upload your standard operating procedures '
                    'and link them directly to scoring criteria in your templates.</p>'
                    '<ul>'
                    '<li><strong>Upload</strong> PDFs or documents with your SOPs</li>'
                    '<li><strong>Link to criteria</strong> — associate SOPs with specific scoring criteria</li>'
                    '<li><strong>AI suggestions</strong> — StoreScore can automatically suggest which criteria '
                    'relate to each SOP based on content analysis</li>'
                    '<li><strong>Reference during walks</strong> — evaluators can see linked SOPs while scoring</li>'
                    '</ul>'
                    '<p>Manage SOP documents from the <a href="/sop-documents">SOP Documents</a> page.</p>'
                ),
            },
        ],
    },

    # ── Self-Assessments ─────────────────────────────────────────────
    {
        'title': 'Self-Assessments',
        'slug': 'self-assessments',
        'summary': 'Photo-based store self-checks submitted by managers between formal evaluations.',
        'category': 'evaluations',
        'feature_tier': 'starter',
        'app_route': '/self-assessments',
        'order': 5,
        'sections': [
            {
                'anchor': 'self-assessments-overview',
                'title': 'Self-Assessments Overview',
                'order': 0,
                'content': (
                    '<p><strong>Self-Assessments</strong> let store managers submit photo-based evaluations '
                    'of their store between formal walks.</p>'
                    '<ul>'
                    '<li>Admins create <strong>assessment templates</strong> with prompts</li>'
                    '<li>Store managers <strong>submit photos</strong> with self-ratings for each prompt</li>'
                    '<li>On Pro/Enterprise, <strong>AI analyzes</strong> the photos and provides its own rating</li>'
                    '<li>Admins <strong>review</strong> submissions and add feedback</li>'
                    '</ul>'
                    '<p>Self-assessments help maintain standards between formal evaluations and give managers '
                    'ownership of their store\'s presentation.</p>'
                ),
            },
        ],
    },

    # ── Billing ──────────────────────────────────────────────────────
    {
        'title': 'Plans & Pricing',
        'slug': 'plans-and-pricing',
        'summary': 'Compare feature availability across Starter, Pro, and Enterprise plans.',
        'category': 'billing',
        'feature_tier': 'starter',
        'app_route': '/billing',
        'order': 0,
        'sections': [
            {
                'anchor': 'billing-plans',
                'title': 'Choosing a Plan',
                'order': 0,
                'content': (
                    '<p>StoreScore offers flexible plans based on your organization\'s size and needs. '
                    'Each tier builds on the previous one:</p>'
                    '<ul>'
                    '<li><strong>Starter</strong> — core evaluation features for small teams getting started</li>'
                    '<li><strong>Pro</strong> — adds action items, AI summaries, scheduling, and SOP linking for growing organizations</li>'
                    '<li><strong>Enterprise</strong> — adds AI photo analysis, benchmarking, and priority support for large operations</li>'
                    '</ul>'
                    '<p>Pricing is per-store, per-month with volume discounts for larger organizations. '
                    'Visit <a href="/billing">Billing</a> to see current pricing and upgrade options.</p>'
                ),
            },
        ],
    },
    {
        'title': 'Billing Management',
        'slug': 'billing-management',
        'summary': 'Manage your subscription, view invoices, and upgrade or downgrade your plan.',
        'category': 'billing',
        'feature_tier': 'starter',
        'app_route': '/billing',
        'order': 1,
        'sections': [
            {
                'anchor': 'billing-management',
                'title': 'Managing Your Subscription',
                'order': 0,
                'content': (
                    '<p>From the <a href="/billing">Billing</a> page, admins and owners can:</p>'
                    '<ul>'
                    '<li><strong>View current plan</strong> — see your active tier and store count</li>'
                    '<li><strong>Upgrade or downgrade</strong> — switch plans at any time (prorated)</li>'
                    '<li><strong>View invoices</strong> — access past invoices and payment history</li>'
                    '<li><strong>Manage payment method</strong> — update your card or payment details via the billing portal</li>'
                    '</ul>'
                    '<p>Billing is managed through Stripe for secure payment processing.</p>'
                ),
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the knowledge base with initial platform documentation articles.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing KB articles before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            count = KnowledgeArticle.objects.count()
            KnowledgeArticle.objects.all().delete()
            self.stdout.write(f'Deleted {count} existing article(s).')

        created_articles = 0
        created_sections = 0
        skipped = 0

        for article_data in ARTICLES:
            sections_data = article_data.pop('sections', [])

            article, created = KnowledgeArticle.objects.update_or_create(
                slug=article_data['slug'],
                defaults=article_data,
            )

            if created:
                created_articles += 1
            else:
                skipped += 1
                # Update existing sections too
                article.sections.all().delete()

            for section_data in sections_data:
                section_data.setdefault('feature_tier', article.feature_tier)
                KnowledgeSection.objects.create(
                    article=article,
                    **section_data,
                )
                created_sections += 1

            # Restore sections key for reuse safety
            article_data['sections'] = sections_data

        self.stdout.write(self.style.SUCCESS(
            f'Done! Created {created_articles} articles, '
            f'updated {skipped}, '
            f'{created_sections} sections total.'
        ))
