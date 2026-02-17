from django.contrib import admin

from .models import KnowledgeArticle, KnowledgeSection, OnboardingLesson


class KnowledgeSectionInline(admin.TabularInline):
    model = KnowledgeSection
    fields = ('anchor', 'title', 'content', 'feature_tier', 'order')
    extra = 1


@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(admin.ModelAdmin):
    inlines = [KnowledgeSectionInline]
    list_display = ('title', 'category', 'feature_tier', 'order', 'is_published')
    list_filter = ('category', 'feature_tier', 'is_published')
    search_fields = ('title', 'summary')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(OnboardingLesson)
class OnboardingLessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'order', 'feature_tier', 'roles', 'is_published')
    list_filter = ('feature_tier', 'is_published')
    search_fields = ('title', 'summary')
    ordering = ('order',)
