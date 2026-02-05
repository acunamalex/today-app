import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Upload, Download } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useQuestionStore } from '../stores/questionStore';
import { useUIStore } from '../stores/uiStore';
import { QuestionBuilder, ImportQuestions } from '../components/questions';
import { Button, Card, CardHeader, LoadingCard } from '../components/common';
import { downloadTemplate } from '../services/importService';
import type { QuestionType, QuestionTemplate } from '../types';

export function Questions() {
  const navigate = useNavigate();
  const [showImportModal, setShowImportModal] = useState(false);

  const { user } = useAuthStore();
  const {
    templates,
    isLoading,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    reorderTemplates,
    toggleTemplateActive,
  } = useQuestionStore();
  const { addToast } = useUIStore();

  // Load question templates
  useEffect(() => {
    if (user) {
      loadTemplates(user.id);
    }
  }, [user, loadTemplates]);

  const handleCreate = async (
    text: string,
    type: QuestionType,
    options?: string[]
  ) => {
    if (!user) return;

    try {
      await createTemplate(user.id, text, type, options);
      addToast('Question added', 'success');
    } catch (error) {
      addToast('Failed to add question', 'error');
    }
  };

  const handleUpdate = async (
    questionId: string,
    updates: Parameters<typeof updateTemplate>[1]
  ) => {
    try {
      await updateTemplate(questionId, updates);
      addToast('Question updated', 'success');
    } catch (error) {
      addToast('Failed to update question', 'error');
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      await deleteTemplate(questionId);
      addToast('Question deleted', 'success');
    } catch (error) {
      addToast('Failed to delete question', 'error');
    }
  };

  const handleReorder = async (questionIds: string[]) => {
    try {
      await reorderTemplates(questionIds);
    } catch (error) {
      addToast('Failed to reorder questions', 'error');
    }
  };

  const handleToggleActive = async (questionId: string) => {
    try {
      await toggleTemplateActive(questionId);
    } catch (error) {
      addToast('Failed to update question', 'error');
    }
  };

  const handleImportQuestions = async (
    importedQuestions: { text: string; type: QuestionType; options?: string[]; required: boolean }[]
  ) => {
    if (!user) return;

    let successCount = 0;
    for (const question of importedQuestions) {
      try {
        await createTemplate(user.id, question.text, question.type, question.options);
        successCount++;
      } catch (error) {
        console.error('Failed to create question:', error);
      }
    }

    if (successCount > 0) {
      addToast(`Imported ${successCount} questions`, 'success');
    }
    setShowImportModal(false);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate('questions');
    addToast('Template downloaded', 'success');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <LoadingCard message="Loading questions..." />
      </div>
    );
  }

  const activeCount = templates.filter((t) => t.isActive).length;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-slate-900">Questions</h1>
            <p className="text-xs text-slate-500">
              {activeCount} active question{activeCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Instructions */}
        <Card className="bg-primary-50 border-primary-100">
          <div className="flex gap-3">
            <HelpCircle className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div className="text-sm text-primary-800">
              <p className="font-medium">Configure your visit questions</p>
              <p className="mt-1 text-primary-700">
                These questions will appear at each stop. Drag to reorder, toggle
                to enable/disable, or add custom questions.
              </p>
            </div>
          </div>
        </Card>

        {/* Import/Export Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Import CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadTemplate}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download Template
          </Button>
        </div>

        {/* Question Builder */}
        <QuestionBuilder
          questions={templates}
          onReorder={handleReorder}
          onToggleActive={handleToggleActive}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </main>

      {/* Import Questions Modal */}
      <ImportQuestions
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportQuestions}
      />
    </div>
  );
}
