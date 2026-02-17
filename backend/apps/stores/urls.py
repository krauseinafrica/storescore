from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BenchmarkingView,
    GoalViewSet,
    IntegrationConfigViewSet,
    OrgSettingsView,
    RegionViewSet,
    StoreDataPointViewSet,
    StoreViewSet,
)

app_name = 'stores'

router = DefaultRouter()
router.register(r'regions', RegionViewSet, basename='region')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'integrations', IntegrationConfigViewSet, basename='integration')
router.register(r'data-points', StoreDataPointViewSet, basename='datapoint')
router.register(r'', StoreViewSet, basename='store')

urlpatterns = [
    path('settings/', OrgSettingsView.as_view(), name='org-settings'),
    path('benchmarking/', BenchmarkingView.as_view(), name='benchmarking'),
    path('', include(router.urls)),
]
