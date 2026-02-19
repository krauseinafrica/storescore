from django.urls import path

from . import views

app_name = 'kb'

urlpatterns = [
    path('articles/', views.KnowledgeArticleListView.as_view(), name='article-list'),
    path('articles/<slug:slug>/', views.KnowledgeArticleDetailView.as_view(), name='article-detail'),
    path('context/', views.KnowledgeContextView.as_view(), name='context'),
    path('onboarding/', views.OnboardingLessonListView.as_view(), name='onboarding-list'),
    path('onboarding/progress/', views.OnboardingProgressView.as_view(), name='onboarding-progress'),
    path('onboarding/<uuid:lesson_id>/complete/', views.OnboardingCompleteView.as_view(), name='onboarding-complete'),
    path('onboarding-progress/', views.QuickStartProgressView.as_view(), name='quick-start-progress'),
]
