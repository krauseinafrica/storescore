from rest_framework import serializers

from .models import KnowledgeArticle, KnowledgeSection, OnboardingLesson


class KnowledgeSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeSection
        fields = ['id', 'anchor', 'title', 'content', 'feature_tier', 'order']


class KnowledgeArticleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeArticle
        fields = [
            'id', 'title', 'slug', 'summary', 'category',
            'feature_tier', 'app_route', 'icon_name', 'order',
        ]


class KnowledgeArticleDetailSerializer(serializers.ModelSerializer):
    sections = KnowledgeSectionSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgeArticle
        fields = [
            'id', 'title', 'slug', 'summary', 'category',
            'feature_tier', 'app_route', 'icon_name', 'order', 'sections',
        ]


class OnboardingLessonSerializer(serializers.ModelSerializer):
    section_content = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingLesson
        fields = [
            'id', 'title', 'summary', 'content', 'app_route',
            'action_label', 'roles', 'feature_tier', 'order',
            'section_content', 'is_completed', 'completed_at',
        ]

    def get_section_content(self, obj):
        if not obj.section:
            return None
        return {
            'anchor': obj.section.anchor,
            'title': obj.section.title,
            'content': obj.section.content,
            'feature_tier': obj.section.feature_tier,
        }

    def get_is_completed(self, obj):
        progress_map = self.context.get('progress_map', {})
        return obj.pk in progress_map

    def get_completed_at(self, obj):
        progress_map = self.context.get('progress_map', {})
        completed_at = progress_map.get(obj.pk)
        if completed_at:
            return completed_at.isoformat()
        return None
