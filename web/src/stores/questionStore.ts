import { create } from 'zustand';
import type { QuestionTemplate, QuestionResponse, QuestionType } from '../types';
import { db, addToSyncQueue, getActiveQuestions } from '../db/dexie';

interface QuestionState {
  templates: QuestionTemplate[];
  currentResponses: QuestionResponse[];
  isLoading: boolean;
  error: string | null;

  // Template Actions
  loadTemplates: (userId: string) => Promise<void>;
  createTemplate: (
    userId: string,
    text: string,
    type: QuestionType,
    options?: string[]
  ) => Promise<QuestionTemplate>;
  updateTemplate: (templateId: string, updates: Partial<QuestionTemplate>) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  reorderTemplates: (templateIds: string[]) => Promise<void>;
  toggleTemplateActive: (templateId: string) => Promise<void>;

  // Response Actions
  loadResponses: (stopId: string) => Promise<void>;
  saveResponse: (
    stopId: string,
    routeId: string,
    questionId: string,
    questionText: string,
    type: QuestionType,
    value: string | boolean | number | null,
    imageData?: string
  ) => Promise<QuestionResponse>;
  updateResponse: (responseId: string, value: string | boolean | number | null, imageData?: string) => Promise<void>;
  deleteResponse: (responseId: string) => Promise<void>;
  clearResponses: () => void;

  // Utilities
  getResponsesForStop: (stopId: string) => Promise<QuestionResponse[]>;
  clearError: () => void;
}

export const useQuestionStore = create<QuestionState>()((set, get) => ({
  templates: [],
  currentResponses: [],
  isLoading: false,
  error: null,

  loadTemplates: async (userId) => {
    set({ isLoading: true, error: null });

    try {
      const templates = await getActiveQuestions(userId);
      set({ templates, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load templates',
        isLoading: false,
      });
    }
  },

  createTemplate: async (userId, text, type, options) => {
    const { templates } = get();

    const newTemplate: QuestionTemplate = {
      id: crypto.randomUUID(),
      userId,
      text,
      type,
      options,
      required: false,
      isDefault: false,
      isActive: true,
      order: templates.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.questionTemplates.add(newTemplate);
    await addToSyncQueue('create', 'question', newTemplate.id, newTemplate);

    set({ templates: [...templates, newTemplate] });

    return newTemplate;
  },

  updateTemplate: async (templateId, updates) => {
    const { templates } = get();

    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await db.questionTemplates.update(templateId, updatedData);
    await addToSyncQueue('update', 'question', templateId, updatedData);

    set({
      templates: templates.map((t) =>
        t.id === templateId ? { ...t, ...updatedData } : t
      ),
    });
  },

  deleteTemplate: async (templateId) => {
    const { templates } = get();

    await db.questionTemplates.delete(templateId);
    await addToSyncQueue('delete', 'question', templateId, { id: templateId });

    const updatedTemplates = templates
      .filter((t) => t.id !== templateId)
      .map((t, index) => ({ ...t, order: index }));

    // Update order in database
    await Promise.all(
      updatedTemplates.map((t) =>
        db.questionTemplates.update(t.id, { order: t.order, updatedAt: new Date() })
      )
    );

    set({ templates: updatedTemplates });
  },

  reorderTemplates: async (templateIds) => {
    const { templates } = get();

    const reorderedTemplates = templateIds.map((id, index) => {
      const template = templates.find((t) => t.id === id);
      if (!template) throw new Error(`Template ${id} not found`);
      return { ...template, order: index, updatedAt: new Date() };
    });

    // Update in database
    await Promise.all(
      reorderedTemplates.map((t) =>
        db.questionTemplates.update(t.id, { order: t.order, updatedAt: t.updatedAt })
      )
    );

    set({ templates: reorderedTemplates });
  },

  toggleTemplateActive: async (templateId) => {
    const { templates } = get();
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const newActiveState = !template.isActive;

    await db.questionTemplates.update(templateId, {
      isActive: newActiveState,
      updatedAt: new Date(),
    });
    await addToSyncQueue('update', 'question', templateId, { isActive: newActiveState });

    set({
      templates: templates.map((t) =>
        t.id === templateId
          ? { ...t, isActive: newActiveState, updatedAt: new Date() }
          : t
      ),
    });
  },

  loadResponses: async (stopId) => {
    set({ isLoading: true, error: null });

    try {
      const responses = await db.questionResponses
        .where({ stopId })
        .toArray();

      set({ currentResponses: responses, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load responses',
        isLoading: false,
      });
    }
  },

  saveResponse: async (stopId, routeId, questionId, questionText, type, value, imageData) => {
    const { currentResponses } = get();

    // Check if response already exists for this question
    const existingResponse = currentResponses.find(
      (r) => r.stopId === stopId && r.questionId === questionId
    );

    if (existingResponse) {
      await get().updateResponse(existingResponse.id, value, imageData);
      return currentResponses.find((r) => r.id === existingResponse.id)!;
    }

    const newResponse: QuestionResponse = {
      id: crypto.randomUUID(),
      stopId,
      routeId,
      questionId,
      questionText,
      type,
      value,
      imageData,
      timestamp: new Date(),
    };

    await db.questionResponses.add(newResponse);
    await addToSyncQueue('create', 'response', newResponse.id, newResponse);

    set({ currentResponses: [...currentResponses, newResponse] });

    return newResponse;
  },

  updateResponse: async (responseId, value, imageData) => {
    const { currentResponses } = get();

    const updates = {
      value,
      imageData,
      timestamp: new Date(),
    };

    await db.questionResponses.update(responseId, updates);
    await addToSyncQueue('update', 'response', responseId, updates);

    set({
      currentResponses: currentResponses.map((r) =>
        r.id === responseId ? { ...r, ...updates } : r
      ),
    });
  },

  deleteResponse: async (responseId) => {
    const { currentResponses } = get();

    await db.questionResponses.delete(responseId);
    await addToSyncQueue('delete', 'response', responseId, { id: responseId });

    set({
      currentResponses: currentResponses.filter((r) => r.id !== responseId),
    });
  },

  clearResponses: () => {
    set({ currentResponses: [] });
  },

  getResponsesForStop: async (stopId) => {
    return db.questionResponses
      .where({ stopId })
      .toArray();
  },

  clearError: () => set({ error: null }),
}));
