import { useState, useRef } from 'react';
import { Upload, Download, FileText, X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button, Modal, Card } from '../common';
import { importStopsFromCSV, downloadTemplate } from '../../services/importService';
import type { Coordinates } from '../../types';

export interface ImportStopsProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (stops: { address: string; name?: string; coordinates: Coordinates }[]) => void;
}

export function ImportStops({ isOpen, onClose, onImport }: ImportStopsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const importResult = await importStopsFromCSV(file, (current, total) => {
        setProgress({ current, total });
      });

      setResult({
        success: importResult.success,
        count: importResult.data.length,
        errors: importResult.errors,
        warnings: importResult.warnings,
      });

      if (importResult.success && importResult.data.length > 0) {
        onImport(importResult.data);
      }
    } catch (error) {
      setResult({
        success: false,
        count: 0,
        errors: [`Import failed: ${error}`],
        warnings: [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setProgress({ current: 0, total: 0 });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Stops from CSV" size="md">
      <div className="space-y-4">
        {/* Instructions */}
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-600">
            Upload a CSV file with your stop addresses. The file should have an{' '}
            <strong>address</strong> column (required) and optionally a{' '}
            <strong>name</strong> column.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadTemplate('stops')}
            leftIcon={<Download className="w-4 h-4" />}
            className="mt-2"
          >
            Download Template
          </Button>
        </Card>

        {/* File Input */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${file ? 'border-primary-300 bg-primary-50' : 'border-slate-300 hover:border-primary-400'}
          `}
        >
          {file ? (
            <>
              <FileText className="w-8 h-8 text-primary-500" />
              <span className="text-sm font-medium text-slate-900">{file.name}</span>
              <span className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm text-slate-600">Click to select CSV file</span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Progress */}
        {isImporting && (
          <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary-900">
                Geocoding addresses...
              </p>
              <p className="text-xs text-primary-700">
                {progress.current} of {progress.total} addresses
              </p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success ? 'bg-success-50' : 'bg-danger-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <Check className="w-5 h-5 text-success-600" />
              ) : (
                <X className="w-5 h-5 text-danger-600" />
              )}
              <p
                className={`font-medium ${
                  result.success ? 'text-success-900' : 'text-danger-900'
                }`}
              >
                {result.success
                  ? `Successfully imported ${result.count} stops`
                  : 'Import failed'}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-danger-700 mb-1">Errors:</p>
                {result.errors.slice(0, 3).map((error, i) => (
                  <p key={i} className="text-xs text-danger-600">
                    • {error}
                  </p>
                ))}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-warning-700 mb-1">Warnings:</p>
                {result.warnings.slice(0, 3).map((warning, i) => (
                  <p key={i} className="text-xs text-warning-600">
                    • {warning}
                  </p>
                ))}
                {result.warnings.length > 3 && (
                  <p className="text-xs text-warning-600">
                    ...and {result.warnings.length - 3} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {result?.success ? 'Done' : 'Cancel'}
          </Button>
          {!result?.success && (
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              isLoading={isImporting}
              className="flex-1"
            >
              Import Stops
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
