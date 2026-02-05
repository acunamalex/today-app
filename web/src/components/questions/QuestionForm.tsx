import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Camera, Trash2, RotateCcw } from 'lucide-react';
import SignaturePad from 'signature_pad';
import type { QuestionTemplate, QuestionResponse, QuestionType } from '../../types';
import { Input, Textarea, Toggle, Rating, Button, Card } from '../common';
import { compressAndConvertToBase64, validateImageFile } from '../../utils/imageCompression';

interface QuestionInputProps {
  question: QuestionTemplate;
  value: string | boolean | number | null;
  imageData?: string;
  onChange: (value: string | boolean | number | null, imageData?: string) => void;
}

function TextInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Textarea
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter your answer..."
      rows={3}
    />
  );
}

function MultipleChoiceInput({ question, value, onChange }: QuestionInputProps) {
  const options = question.options || [];

  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <label
          key={index}
          className={clsx(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
            value === option
              ? 'border-primary-500 bg-primary-50'
              : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <input
            type="radio"
            name={question.id}
            value={option}
            checked={value === option}
            onChange={(e) => onChange(e.target.value)}
            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-slate-900">{option}</span>
        </label>
      ))}
    </div>
  );
}

function YesNoInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={clsx(
          'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all',
          value === true
            ? 'border-success-500 bg-success-50 text-success-700'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        )}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={clsx(
          'flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all',
          value === false
            ? 'border-danger-500 bg-danger-50 text-danger-700'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        )}
      >
        No
      </button>
    </div>
  );
}

function PhotoInput({ question, value, imageData, onChange }: QuestionInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const base64 = await compressAndConvertToBase64(file);
      onChange('captured', base64);
    } catch (err) {
      setError('Failed to process image');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    onChange(null, undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {imageData ? (
        <div className="relative">
          <img
            src={imageData}
            alt="Captured"
            className="w-full h-48 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg text-danger-500 hover:bg-danger-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            isLoading
              ? 'border-primary-300 bg-primary-50'
              : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50/50'
          )}
        >
          <Camera className="w-8 h-8 text-slate-400" />
          <span className="text-sm text-slate-600">
            {isLoading ? 'Processing...' : 'Tap to take photo or select from gallery'}
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-danger-500">{error}</p>}
    </div>
  );
}

function SignatureInput({ question, value, imageData, onChange }: QuestionInputProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });

      // Load existing signature
      if (imageData) {
        signaturePadRef.current.fromDataURL(imageData);
      }

      // Handle canvas resize
      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext('2d')?.scale(ratio, ratio);
          signaturePadRef.current?.clear();
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    onChange(null, undefined);
  };

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL('image/png');
      onChange('signed', dataUrl);
    }
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none"
          onMouseUp={handleSave}
          onTouchEnd={handleSave}
        />
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          leftIcon={<RotateCcw className="w-4 h-4" />}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

function RatingInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Rating
      value={(value as number) || 0}
      onChange={(newValue) => onChange(newValue)}
      size="lg"
      showValue
    />
  );
}

function NumberInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Input
      type="number"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder="Enter a number..."
    />
  );
}

function DateInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Input
      type="date"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TimeInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Input
      type="time"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const inputComponents: Record<QuestionType, React.ComponentType<QuestionInputProps>> = {
  text: TextInput,
  multipleChoice: MultipleChoiceInput,
  yesNo: YesNoInput,
  photo: PhotoInput,
  signature: SignatureInput,
  rating: RatingInput,
  number: NumberInput,
  date: DateInput,
  time: TimeInput,
};

export interface QuestionFormProps {
  questions: QuestionTemplate[];
  responses: Record<string, { value: any; imageData?: string }>;
  onResponseChange: (
    questionId: string,
    value: string | boolean | number | null,
    imageData?: string
  ) => void;
}

export function QuestionForm({
  questions,
  responses,
  onResponseChange,
}: QuestionFormProps) {
  return (
    <div className="space-y-6">
      {questions.map((question) => {
        const InputComponent = inputComponents[question.type];
        const response = responses[question.id] || { value: null };

        return (
          <div key={question.id} className="space-y-2">
            <label className="block text-sm font-medium text-slate-900">
              {question.text}
              {question.required && (
                <span className="ml-1 text-danger-500">*</span>
              )}
            </label>
            <InputComponent
              question={question}
              value={response.value}
              imageData={response.imageData}
              onChange={(value, imageData) =>
                onResponseChange(question.id, value, imageData)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
