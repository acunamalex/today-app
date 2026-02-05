import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Check, Save, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';
import { useQuestionStore } from '../stores/questionStore';
import { useUIStore } from '../stores/uiStore';
import { QuestionForm } from '../components/questions';
import { Button, Card, LoadingCard } from '../components/common';
import type { QuestionTemplate, QuestionResponse } from '../types';

export function VisitForm() {
  const navigate = useNavigate();
  const { stopId } = useParams<{ stopId: string }>();

  const [responses, setResponses] = useState<
    Record<string, { value: any; imageData?: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const { user } = useAuthStore();
  const { currentRoute, stops, markStopDeparted, goToNextStop } = useRouteStore();
  const {
    templates,
    currentResponses,
    loadTemplates,
    loadResponses,
    saveResponse,
    isLoading: questionsLoading,
  } = useQuestionStore();
  const { addToast } = useUIStore();

  const stop = stops.find((s) => s.id === stopId);
  const activeQuestions = templates.filter((t) => t.isActive);

  // Load questions and existing responses
  useEffect(() => {
    if (user) {
      loadTemplates(user.id);
    }
  }, [user, loadTemplates]);

  useEffect(() => {
    if (stopId) {
      loadResponses(stopId);
    }
  }, [stopId, loadResponses]);

  // Initialize responses from existing data
  useEffect(() => {
    if (currentResponses.length > 0) {
      const existingResponses: Record<string, { value: any; imageData?: string }> = {};
      currentResponses.forEach((r) => {
        existingResponses[r.questionId] = {
          value: r.value,
          imageData: r.imageData,
        };
      });
      setResponses(existingResponses);
    }
  }, [currentResponses]);

  const handleResponseChange = (
    questionId: string,
    value: any,
    imageData?: string
  ) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { value, imageData },
    }));
  };

  const validateResponses = (): boolean => {
    const requiredQuestions = activeQuestions.filter((q) => q.required);

    for (const question of requiredQuestions) {
      const response = responses[question.id];
      if (
        response === undefined ||
        response.value === null ||
        response.value === ''
      ) {
        addToast(`Please answer: "${question.text}"`, 'warning');
        return false;
      }
    }

    return true;
  };

  const handleSave = async (complete: boolean = false) => {
    if (!stop || !currentRoute) return;

    if (complete && !validateResponses()) {
      return;
    }

    setIsSaving(true);

    try {
      // Save all responses
      for (const question of activeQuestions) {
        const response = responses[question.id];
        if (response !== undefined) {
          await saveResponse(
            stop.id,
            currentRoute.id,
            question.id,
            question.text,
            question.type,
            response.value,
            response.imageData
          );
        }
      }

      if (complete) {
        await markStopDeparted(stop.id);
        addToast('Visit completed!', 'success');
        goToNextStop();
        navigate('/route');
      } else {
        addToast('Progress saved', 'success');
      }
    } catch (error) {
      addToast('Failed to save responses', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!stop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-500">Stop not found</p>
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <LoadingCard message="Loading questions..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/route')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-slate-900 truncate">
              {stop.name || 'Visit Form'}
            </h1>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {stop.address}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {activeQuestions.length > 0 ? (
          <Card padding="lg">
            <QuestionForm
              questions={activeQuestions}
              responses={responses}
              onResponseChange={handleResponseChange}
            />
          </Card>
        ) : (
          <Card className="text-center py-8">
            <p className="text-slate-500">
              No questions configured. You can complete this visit without
              filling out a form.
            </p>
          </Card>
        )}
      </main>

      {/* Fixed bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-20">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            leftIcon={
              isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
            className="flex-1"
          >
            Save Progress
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            leftIcon={
              isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )
            }
            className="flex-1"
          >
            Complete Visit
          </Button>
        </div>
      </div>
    </div>
  );
}
