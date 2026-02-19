import { useEffect, useState } from 'react';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';
import {
  getAssessmentTemplates,
  getAssessmentTemplate,
  createAssessmentTemplate,
  updateAssessmentTemplate,
  deleteAssessmentTemplate,
} from '../api/walks';
import type { SelfAssessmentTemplate, AssessmentPrompt } from '../types';

// Prompt form state (no id for new prompts)
interface PromptForm {
  id?: string;
  name: string;
  description: string;
  ai_evaluation_prompt: string;
  order: number;
  rating_type: 'none' | 'three_scale';
}

function emptyPrompt(order: number): PromptForm {
  return { name: '', description: '', ai_evaluation_prompt: '', order, rating_type: 'none' };
}

export function AssessmentTemplatesContent() {
  return <AssessmentTemplatesInner />;
}

export default function AssessmentTemplates() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Assessment Templates</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Create and manage self-assessment templates for your organization.
        </p>
      </div>
      <AssessmentTemplatesInner />
    </div>
  );
}

function AssessmentTemplatesInner() {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [templates, setTemplates] = useState<SelfAssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editing, setEditing] = useState<'new' | string | null>(null); // null=list, 'new'=create, uuid=edit
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateActive, setTemplateActive] = useState(true);
  const [prompts, setPrompts] = useState<PromptForm[]>([emptyPrompt(0)]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadTemplates() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAssessmentTemplates(orgId);
      setTemplates(data);
    } catch {
      setError('Failed to load assessment templates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, [orgId]);

  function openCreate() {
    setEditing('new');
    setTemplateName('');
    setTemplateDescription('');
    setTemplateActive(true);
    setPrompts([emptyPrompt(0)]);
    setConfirmDelete(false);
  }

  async function openEdit(id: string) {
    if (!orgId) return;
    setEditing(id);
    setError(null);
    try {
      const tpl = await getAssessmentTemplate(orgId, id);
      setTemplateName(tpl.name);
      setTemplateDescription(tpl.description || '');
      setTemplateActive(tpl.is_active);
      const sorted = [...(tpl.prompts || [])].sort((a, b) => a.order - b.order);
      setPrompts(
        sorted.length > 0
          ? sorted.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              ai_evaluation_prompt: p.ai_evaluation_prompt || '',
              order: p.order,
              rating_type: p.rating_type,
            }))
          : [emptyPrompt(0)]
      );
      setConfirmDelete(false);
    } catch {
      setError('Failed to load template details.');
      setEditing(null);
    }
  }

  function cancelEdit() {
    setEditing(null);
    setConfirmDelete(false);
  }

  // Prompt management
  function addPrompt() {
    setPrompts((prev) => [...prev, emptyPrompt(prev.length)]);
  }

  function removePrompt(index: number) {
    setPrompts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((p, i) => ({ ...p, order: i }));
    });
  }

  function movePrompt(index: number, direction: -1 | 1) {
    setPrompts((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((p, i) => ({ ...p, order: i }));
    });
  }

  function updatePrompt(index: number, field: keyof PromptForm, value: string) {
    setPrompts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  async function handleSave() {
    if (!orgId || !templateName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const promptsPayload = prompts
        .filter((p) => p.name.trim())
        .map((p, i) => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(),
          description: p.description.trim(),
          ai_evaluation_prompt: p.ai_evaluation_prompt.trim(),
          order: i,
          rating_type: p.rating_type,
        }));

      if (editing === 'new') {
        await createAssessmentTemplate(orgId, {
          name: templateName.trim(),
          description: templateDescription.trim(),
          prompts: promptsPayload,
        });
      } else if (editing) {
        await updateAssessmentTemplate(orgId, editing, {
          name: templateName.trim(),
          description: templateDescription.trim(),
          is_active: templateActive,
          prompts: promptsPayload,
        });
      }
      setEditing(null);
      await loadTemplates();
    } catch {
      setError('Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!orgId || !editing || editing === 'new') return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAssessmentTemplate(orgId, editing);
      setEditing(null);
      setConfirmDelete(false);
      await loadTemplates();
    } catch {
      setError('Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Loading assessment templates...
      </div>
    );
  }

  // Editor view
  if (editing !== null) {
    return (
      <div className="mt-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing === 'new' ? 'Create Template' : 'Edit Template'}
          </h2>
          <button
            onClick={cancelEdit}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to list
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Template fields */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Weekly Store Assessment"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Optional description of this assessment template"
            />
          </div>
          {editing !== 'new' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="template-active"
                checked={templateActive}
                onChange={(e) => setTemplateActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="template-active" className="text-sm text-gray-700">
                Active (visible when creating assessments)
              </label>
            </div>
          )}
        </div>

        {/* Prompts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Prompts ({prompts.filter((p) => p.name.trim()).length})
            </h3>
            <button
              onClick={addPrompt}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              + Add Prompt
            </button>
          </div>

          <div className="space-y-3">
            {prompts.map((prompt, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Prompt {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePrompt(index, -1)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => movePrompt(index, 1)}
                      disabled={index === prompts.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {prompts.length > 1 && (
                      <button
                        onClick={() => removePrompt(index)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove prompt"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={prompt.name}
                      onChange={(e) => updatePrompt(index, 'name', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g. Entrance & Exterior"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rating Type</label>
                    <select
                      value={prompt.rating_type}
                      onChange={(e) => updatePrompt(index, 'rating_type', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="none">No self-rating</option>
                      <option value="three_scale">3-point scale (Good / Fair / Poor)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={prompt.description}
                    onChange={(e) => updatePrompt(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Instructions shown to the user for this prompt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    AI Evaluation Prompt
                  </label>
                  <textarea
                    value={prompt.ai_evaluation_prompt}
                    onChange={(e) => updatePrompt(index, 'ai_evaluation_prompt', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Instructions for the AI when evaluating this prompt's photo submission"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {editing !== 'new' && isAdmin && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">Delete this template?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete Template
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !templateName.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="mt-4">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Create Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-500">No assessment templates yet.</p>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Create your first template
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => openEdit(tpl.id)}
              className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 text-left hover:ring-primary-300 transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                  {tpl.name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    tpl.is_active
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
                      : 'bg-gray-50 text-gray-500 ring-1 ring-gray-500/20'
                  }`}
                >
                  {tpl.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {tpl.description && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{tpl.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                <span>{tpl.prompt_count ?? tpl.prompts?.length ?? 0} prompts</span>
                <span>&middot;</span>
                <span>{tpl.created_by_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
