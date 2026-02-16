from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import (
    ExportCSVView,
    OverviewView,
    SectionBreakdownView,
    StoreComparisonView,
    TrendsView,
)
from .views import ScoringTemplateViewSet, WalkViewSet

app_name = 'walks'

router = DefaultRouter()
router.register(r'templates', ScoringTemplateViewSet, basename='scoringtemplate')
router.register(r'', WalkViewSet, basename='walk')

analytics_patterns = [
    path('overview/', OverviewView.as_view(), name='analytics-overview'),
    path('trends/', TrendsView.as_view(), name='analytics-trends'),
    path('stores/', StoreComparisonView.as_view(), name='analytics-stores'),
    path('sections/', SectionBreakdownView.as_view(), name='analytics-sections'),
    path('export/', ExportCSVView.as_view(), name='analytics-export'),
]

urlpatterns = [
    path('analytics/', include((analytics_patterns, 'analytics'))),
    path('', include(router.urls)),
]
