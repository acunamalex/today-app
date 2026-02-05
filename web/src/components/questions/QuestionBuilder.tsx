import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  ListChecks,
  ToggleLeft,
  Camera,
  PenTool,
  Star,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QuestionTemplate, QuestionType } from '../../types';
import { Button, Card, Input, Toggle, Modal, Select } from '../common';

const questionTypeConfig: Record<
  QuestionType,
  { label: string; icon: React.ReactNode; description: string }
> = {
  text: {
    label: 'Text',
    icon: <Type className="w-4 h-4" />,
    description: 'Short or long text answer',
  },
  multipleChoice: {
    label: 'Multiple Choice',
    icon: <ListChecks className="w-4 h-4" />,
    description: 'Select from predefined options',
  },
  yesNo: {
    label: 'Yes/No',
    icon: <ToggleLeft className="w-4 h-4" />,
    description: 'Simple yes or no toggle',
  },
  photo: {
    label: 'Photo',
    icon: <Camera className="w-4 h-4" />,
    description: 'Capture or upload a photo',
  },
  signature: {
    label: 'Signature',
    icon: <PenTool className="w-4 h-4" />,
    description: 'Capture a signature',
  },
  rating: {
    label: 'Rating',
    icon: <Star className="w-4 h-4" />,
    description: '1-5 star rating',
  },
  number: {
    label: 'Number',
    icon: <Type className="w-4 h-4" />,
    description: 'Numeric input',
  },
  date: {
    label: 'Date',
    icon: <Type className="w-4 h-4" />,
    description: 'Date picker',
  },
  time: {
    label: 'Time',
    icon: <Type className="w-4 h-4" />,
    description: 'Time picker',
  },
};

interface SortableQuestionProps {
  question: QuestionTemplate;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableQuestion({
  question,
  onToggleActive,
  onEdit,
  onDelete,
}: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = questionTypeConfig[question.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-center gap-3 p-4 bg-white rounded-xl border transition-all',
        isDragging
          ? 'shadow-lg border-primary-300'
          : 'border-slate-200 hover:border-slate-300',
        !question.isActive && 'opacity-60'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{question.text}</p>
        <p className="text-xs text-slate-500">
          {config.label}
          {question.required && (
            <span className="ml-2 text-danger-500">Required</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Toggle
          checked={question.isActive}
          onChange={onToggleActive}
          size="sm"
        />
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        {!question.isDefault && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export interface QuestionBuilderProps {
  questions: QuestionTemplate[];
  onReorder: (questionIds: string[]) => void;
  onToggleActive: (questionId: string) => void;
  onCreate: (text: string, type: QuestionType, options?: string[]) => void;
  onUpdate: (questionId: string, updates: Partial<QuestionTemplate>) => void;
  onDelete: (questionId: string) => void;
}

export function QuestionBuilder({
  questions,
  onReorder,
  onToggleActive,
  onCreate,
  onUpdate,
  onDelete,
}: QuestionBuilderProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionTemplate | null>(
    null
  );

  // Add modal state
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'text' as QuestionType,
    options: [''],
    required: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      const newOrder = [...questions];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);

      onReorder(newOrder.map((q) => q.id));
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) return;

    const options =
      newQuestion.type === 'multipleChoice'
        ? newQuestion.options.filter((o) => o.trim())
        : undefined;

    onCreate(newQuestion.text.trim(), newQuestion.type, options);

    setNewQuestion({
      text: '',
      type: 'text',
      options: [''],
      required: false,
    });
    setIsAddModalOpen(false);
  };

  const handleUpdateQuestion = () => {
    if (!editingQuestion) return;

    onUpdate(editingQuestion.id, {
      text: editingQuestion.text,
      type: editingQuestion.type,
      options: editingQuestion.options,
      required: editingQuestion.required,
    });

    setEditingQuestion(null);
  };

  const handleAddOption = () => {
    setNewQuestion((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? value : o)),
    }));
  };

  const handleRemoveOption = (index: number) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {questions.map((question) => (
              <SortableQuestion
                key={question.id}
                question={question}
                onToggleActive={() => onToggleActive(question.id)}
                onEdit={() => setEditingQuestion(question)}
                onDelete={() => onDelete(question.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        fullWidth
        onClick={() => setIsAddModalOpen(true)}
        leftIcon={<Plus className="w-4 h-4" />}
      >
        Add Question
      </Button>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Question"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddQuestion} disabled={!newQuestion.text.trim()}>
              Add Question
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Question Text"
            value={newQuestion.text}
            onChange={(e) =>
              setNewQuestion((prev) => ({ ...prev, text: e.target.value }))
            }
            placeholder="Enter your question..."
          />

          <Select
            label="Question Type"
            value={newQuestion.type}
            onChange={(e) =>
              setNewQuestion((prev) => ({
                ...prev,
                type: e.target.value as QuestionType,
              }))
            }
            options={Object.entries(questionTypeConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          {newQuestion.type === 'multipleChoice' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Options
              </label>
              {newQuestion.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                  />
                  {newQuestion.options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-slate-400 hover:text-danger-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddOption}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Option
              </Button>
            </div>
          )}

          <Toggle
            label="Required"
            description="User must answer this question"
            checked={newQuestion.required}
            onChange={(checked) =>
              setNewQuestion((prev) => ({ ...prev, required: checked }))
            }
          />
        </div>
      </Modal>

      {/* Edit Question Modal */}
      <Modal
        isOpen={!!editingQuestion}
        onClose={() => setEditingQuestion(null)}
        title="Edit Question"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingQuestion(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateQuestion}>Save Changes</Button>
          </>
        }
      >
        {editingQuestion && (
          <div className="space-y-4">
            <Input
              label="Question Text"
              value={editingQuestion.text}
              onChange={(e) =>
                setEditingQuestion((prev) =>
                  prev ? { ...prev, text: e.target.value } : null
                )
              }
            />

            <Toggle
              label="Required"
              checked={editingQuestion.required}
              onChange={(checked) =>
                setEditingQuestion((prev) =>
                  prev ? { ...prev, required: checked } : null
                )
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
