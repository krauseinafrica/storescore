from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AchievementViewSet,
    BenchmarkingView,
    ChallengeViewSet,
    GoalViewSet,
    IntegrationConfigViewSet,
    LeaderboardView,
    OrgSettingsView,
    RegionViewSet,
    StoreDataPointViewSet,
    StoreViewSet,
)

app_name = 'stores'

router = DefaultRouter()
router.register(r'regions', RegionViewSet, basename='region')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'challenges', ChallengeViewSet, basename='challenge')
router.register(r'achievements', AchievementViewSet, basename='achievement')
router.register(r'integrations', IntegrationConfigViewSet, basename='integration')
router.register(r'data-points', StoreDataPointViewSet, basename='datapoint')
router.register(r'', StoreViewSet, basename='store')

urlpatterns = [
    path('settings/', OrgSettingsView.as_view(), name='org-settings'),
    path('benchmarking/', BenchmarkingView.as_view(), name='benchmarking'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('', include(router.urls)),
]
