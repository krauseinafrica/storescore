from django.contrib import admin

from .models import (
    CorrectiveAction, Criterion, Driver, ReportSchedule, Score,
    ScoringTemplate, Section, SOPCriterionLink, SOPDocument, Walk,
)


class SectionInline(admin.TabularInline):
    model = Section
    extra = 0


class CriterionInline(admin.TabularInline):
    model = Criterion
    extra = 0


class ScoreInline(admin.TabularInline):
    model = Score
    extra = 0
    readonly_fields = ('criterion', 'points', 'notes')


@admin.register(ScoringTemplate)
class ScoringTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'is_active', 'created_at')
    list_filter = ('is_active', 'organization')
    search_fields = ('name',)
    inlines = [SectionInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'template', 'order', 'weight')
    list_filter = ('template',)
    inlines = [CriterionInline]


@admin.register(Criterion)
class CriterionAdmin(admin.ModelAdmin):
    list_display = ('name', 'section', 'order', 'max_points')
    list_filter = ('section__template',)
    search_fields = ('name',)


@admin.register(Walk)
class WalkAdmin(admin.ModelAdmin):
    list_display = ('store', 'template', 'conducted_by', 'scheduled_date', 'status', 'total_score', 'organization')
    list_filter = ('status', 'organization')
    search_fields = ('store__name',)
    inlines = [ScoreInline]


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ('walk', 'criterion', 'points')
    list_filter = ('walk__status',)


@admin.register(ReportSchedule)
class ReportScheduleAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'frequency', 'is_active', 'last_sent_at')
    list_filter = ('frequency', 'is_active', 'organization')


@admin.register(CorrectiveAction)
class CorrectiveActionAdmin(admin.ModelAdmin):
    list_display = ('store', 'action_type', 'escalation_level', 'status', 'days_overdue', 'responsible_user', 'created_at')
    list_filter = ('action_type', 'escalation_level', 'status', 'organization')
    search_fields = ('store__name',)


@admin.register(SOPDocument)
class SOPDocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'organization', 'file_type', 'is_active', 'uploaded_by', 'created_at')
    list_filter = ('file_type', 'is_active', 'organization')
    search_fields = ('title',)


class SOPCriterionLinkInline(admin.TabularInline):
    model = SOPCriterionLink
    extra = 0


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('name', 'criterion', 'organization', 'order', 'is_active')
    list_filter = ('is_active', 'organization')
    search_fields = ('name',)
