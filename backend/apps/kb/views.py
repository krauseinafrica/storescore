from django.db.models import Q
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import KnowledgeArticle, KnowledgeSection, OnboardingLesson, UserLessonProgress
from .serializers import (
    KnowledgeArticleDetailSerializer,
    KnowledgeSectionSerializer,
    OnboardingLessonSerializer,
)


class KnowledgeArticleListView(ListAPIView):
    """
    List all published knowledge base articles with their sections.

    Supports query parameters:
    - `search`: filter by title, summary, or section title/content (icontains)
    - `category`: filter by article category
    """
    permission_classes = [AllowAny]
    serializer_class = KnowledgeArticleDetailSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = KnowledgeArticle.objects.filter(
            is_published=True,
        ).prefetch_related('sections')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(summary__icontains=search)
                | Q(sections__title__icontains=search)
                | Q(sections__content__icontains=search)
            ).distinct()

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset


class KnowledgeArticleDetailView(RetrieveAPIView):
    """Retrieve a single knowledge base article by slug, including all sections."""
    permission_classes = [AllowAny]
    serializer_class = KnowledgeArticleDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return KnowledgeArticle.objects.filter(
            is_published=True,
        ).prefetch_related('sections')


class KnowledgeContextView(APIView):
    """
    Return a single knowledge section by its anchor key, along with
    parent article metadata. Used for contextual help tooltips.

    Query parameters:
    - `key`: the section anchor slug to look up
    """
    permission_classes = [AllowAny]

    def get(self, request):
        key = request.query_params.get('key')
        if not key:
            return Response(
                {'detail': 'Query parameter "key" is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            section = KnowledgeSection.objects.select_related('article').get(
                anchor=key,
                article__is_published=True,
            )
        except KnowledgeSection.DoesNotExist:
            return Response(
                {'detail': 'Section not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'section': KnowledgeSectionSerializer(section).data,
            'article_title': section.article.title,
            'article_slug': section.article.slug,
            'app_route': section.article.app_route,
        })


class OnboardingLessonListView(ListAPIView):
    """Return all published onboarding lessons with per-user completion status."""
    permission_classes = [IsAuthenticated]
    serializer_class = OnboardingLessonSerializer
    pagination_class = None

    def get_queryset(self):
        return OnboardingLesson.objects.filter(
            is_published=True,
        ).select_related('section')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        progress_qs = UserLessonProgress.objects.filter(
            user=self.request.user,
        ).values_list('lesson_id', 'completed_at')
        ctx['progress_map'] = {lid: cat for lid, cat in progress_qs}
        return ctx


class OnboardingCompleteView(APIView):
    """Mark a lesson as complete (POST) or undo completion (DELETE)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        try:
            lesson = OnboardingLesson.objects.get(pk=lesson_id, is_published=True)
        except OnboardingLesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        progress, created = UserLessonProgress.objects.get_or_create(
            user=request.user,
            lesson=lesson,
        )
        return Response({
            'lesson_id': str(lesson.pk),
            'completed_at': progress.completed_at.isoformat(),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, lesson_id):
        deleted, _ = UserLessonProgress.objects.filter(
            user=request.user,
            lesson_id=lesson_id,
        ).delete()
        if not deleted:
            return Response({'detail': 'No progress found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OnboardingProgressView(APIView):
    """Return aggregate onboarding progress for the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        total = OnboardingLesson.objects.filter(is_published=True).count()
        completed = UserLessonProgress.objects.filter(
            user=request.user,
            lesson__is_published=True,
        ).count()
        percentage = round((completed / total) * 100) if total > 0 else 0
        return Response({
            'total': total,
            'completed': completed,
            'percentage': percentage,
        })
