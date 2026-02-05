import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal, Button, Card } from '../common';
import { parseQuestionsCSV } from '../../services/importService';
import type { QuestionType } from '../../types';

interface ParsedQuestion {
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
}

interface ImportQuestionsProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: ParsedQuestion[]) => void;
}

export function ImportQuestions({ isOpen, onClose, onImport }: ImportQuestionsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExt = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));

    if (!validTypes.includes(fileExt)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      const questions = parseQuestionsCSV(text);

      if (questions.length === 0) {
        setError('No valid questions found in file. Please check the format.');
        setParsedQuestions([]);
      } else {
        setParsedQuestions(questions);
      }
    } catch (err) {
      setError('Failed to parse file. Please check the format.');
      setParsedQuestions([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (parsedQuestions.length > 0) {
      onImport(parsedQuestions);
      handleClose();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedQuestions([]);
    setError(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getTypeDisplay = (type: string) => {
    const displays: Record<string, string> = {
      text: 'Text',
      multipleChoice: 'Multiple Choice',
      yesNo: 'Yes/No',
      photo: 'Photo',
      signature: 'Signature',
      rating: 'Rating',
    };
    return displays[type] || type;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Questions"
      size="lg"
    >
      <div className="space-y-4">
        {/* File Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            {file ? file.name : 'Click to upload CSV or Excel file'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Supported formats: .csv, .xlsx, .xls
          </p>
        </div>

        {/* Format Instructions */}
        <Card className="bg-slate-50">
          <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Expected Format
          </h4>
          <p className="text-sm text-slate-600 mb-2">
            Your file should have columns for:
          </p>
          <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
            <li><strong>text</strong> or <strong>question</strong> - The question text (required)</li>
            <li><strong>type</strong> - One of: text, multipleChoice, yesNo, photo, signature, rating</li>
            <li><strong>options</strong> - For multipleChoice, separate with | (e.g., "Option 1|Option 2|Option 3")</li>
            <li><strong>required</strong> - true or false</li>
          </ul>
          <div className="mt-3 p-2 bg-white rounded text-xs font-mono overflow-x-auto">
            text,type,options,required<br/>
            "What is the store condition?",multipleChoice,"Excellent|Good|Fair|Poor",true<br/>
            "Any additional notes?",text,,false<br/>
            "Was the manager present?",yesNo,,true
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger-50 text-danger-700 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Parsed Questions Preview */}
        {parsedQuestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success-500" />
              Found {parsedQuestions.length} questions
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {parsedQuestions.map((question, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {question.text}
                    </p>
                    <p className="text-xs text-slate-500">
                      {getTypeDisplay(question.type)}
                      {question.options && ` (${question.options.length} options)`}
                      {question.required && ' • Required'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleClose} fullWidth>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedQuestions.length === 0 || isProcessing}
            fullWidth
          >
            Import {parsedQuestions.length > 0 ? `${parsedQuestions.length} Questions` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
