from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import (
    EvaluatorConsistencyView,
    ExportCSVView,
    OverviewView,
    RegionComparisonView,
    ReportScheduleView,
    SectionBreakdownView,
    SectionTrendsView,
    StoreComparisonView,
    StoreScorecardView,
    TrendsView,
)
from .views import (
    ActionItemViewSet,
    AnalyzePhotoView,
    AssessmentSubmissionView,
    CalendarFeedTokenView,
    CalendarFeedView,
    CorrectiveActionSummaryView,
    CorrectiveActionViewSet,
    DepartmentTypeViewSet,
    DepartmentViewSet,
    DriverViewSet,
    EvaluationScheduleViewSet,
    IndustryTemplateViewSet,
    ScoringTemplateViewSet,
    SelfAssessmentTemplateViewSet,
    SelfAssessmentViewSet,
    SOPCriterionLinkViewSet,
    SOPDocumentViewSet,
    WalkPhotoView,
    WalkSectionNoteView,
    WalkViewSet,
)

app_name = 'walks'

router = DefaultRouter()
router.register(r'templates', ScoringTemplateViewSet, basename='scoringtemplate')
router.register(r'walks', WalkViewSet, basename='walk')
router.register(r'schedules', EvaluationScheduleViewSet, basename='evaluationschedule')
router.register(r'action-items', ActionItemViewSet, basename='actionitem')
router.register(r'assessment-templates', SelfAssessmentTemplateViewSet, basename='selfassessmenttemplate')
router.register(r'assessments', SelfAssessmentViewSet, basename='selfassessment')
router.register(r'corrective-actions', CorrectiveActionViewSet, basename='correctiveaction')
router.register(r'sop-documents', SOPDocumentViewSet, basename='sopdocument')
router.register(r'sop-links', SOPCriterionLinkViewSet, basename='sopcriterionlink')
router.register(r'drivers', DriverViewSet, basename='driver')
router.register(r'department-types', DepartmentTypeViewSet, basename='departmenttype')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'library', IndustryTemplateViewSet, basename='industrytemplate')

analytics_patterns = [
    path('overview/', OverviewView.as_view(), name='analytics-overview'),
    path('trends/', TrendsView.as_view(), name='analytics-trends'),
    path('stores/', StoreComparisonView.as_view(), name='analytics-stores'),
    path('sections/', SectionBreakdownView.as_view(), name='analytics-sections'),
    path('section-trends/', SectionTrendsView.as_view(), name='analytics-section-trends'),
    path('regions/', RegionComparisonView.as_view(), name='analytics-regions'),
    path('scorecard/<uuid:store_id>/', StoreScorecardView.as_view(), name='analytics-scorecard'),
    path('export/', ExportCSVView.as_view(), name='analytics-export'),
    path('report-schedules/', ReportScheduleView.as_view(), name='analytics-report-schedules'),
    path('evaluator-consistency/', EvaluatorConsistencyView.as_view(), name='analytics-evaluator-consistency'),
]

urlpatterns = [
    path('analytics/', include((analytics_patterns, 'analytics'))),
    path('walks/<uuid:walk_id>/photos/', WalkPhotoView.as_view(), name='walk-photos'),
    path('walks/<uuid:walk_id>/photos/<uuid:photo_id>/', WalkPhotoView.as_view(), name='walk-photo-delete'),
    path('walks/<uuid:walk_id>/section-notes/', WalkSectionNoteView.as_view(), name='walk-section-notes'),
    path('analyze-photo/', AnalyzePhotoView.as_view(), name='analyze-photo'),
    path('corrective-actions/summary/', CorrectiveActionSummaryView.as_view(), name='corrective-action-summary'),
    # Calendar feed
    path('calendar-token/', CalendarFeedTokenView.as_view(), name='calendar-token'),
    path('calendar-feed/<str:token>/', CalendarFeedView.as_view(), name='calendar-feed'),
    # Self-assessment submissions
    path('assessments/<uuid:assessment_id>/submissions/', AssessmentSubmissionView.as_view(), name='assessment-submissions'),
    path('', include(router.urls)),
]
