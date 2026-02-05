import Papa from 'papaparse';
import type { Coordinates, QuestionType } from '../types';
import { getCoordinates } from './geocodeService';

export interface StopImportRow {
  address: string;
  name?: string;
}

export interface QuestionImportRow {
  text: string;
  type: QuestionType;
  options?: string;
  required?: string | boolean;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse CSV file and return rows
 */
export function parseCSV<T>(file: File): Promise<Papa.ParseResult<T>> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => resolve(results),
      error: (error) => reject(error),
    });
  });
}

/**
 * Import stops from CSV file
 * Expected columns: address (required), name (optional)
 */
export async function importStopsFromCSV(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult<{ address: string; name?: string; coordinates: Coordinates }>> {
  const result: ImportResult<{ address: string; name?: string; coordinates: Coordinates }> = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  try {
    const parsed = await parseCSV<StopImportRow>(file);

    if (parsed.errors.length > 0) {
      result.errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
    }

    const rows = parsed.data.filter((row) => row.address?.trim());

    if (rows.length === 0) {
      result.errors.push('No valid addresses found in CSV. Make sure you have an "address" column.');
      result.success = false;
      return result;
    }

    // Geocode each address (with rate limiting)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      onProgress?.(i + 1, rows.length);

      try {
        const coordinates = await getCoordinates(row.address.trim());

        if (coordinates) {
          result.data.push({
            address: row.address.trim(),
            name: row.name?.trim(),
            coordinates,
          });
        } else {
          result.warnings.push(`Could not geocode: "${row.address}"`);
        }
      } catch (error) {
        result.warnings.push(`Error geocoding "${row.address}": ${error}`);
      }

      // Rate limiting - wait between requests
      if (i < rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    if (result.data.length === 0) {
      result.success = false;
      result.errors.push('No addresses could be geocoded.');
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to parse CSV: ${error}`);
  }

  return result;
}

/**
 * Import questions from CSV file
 * Expected columns: text (required), type (required), options (optional, comma-separated), required (optional)
 */
export async function importQuestionsFromCSV(
  file: File
): Promise<ImportResult<{ text: string; type: QuestionType; options?: string[]; required: boolean }>> {
  const result: ImportResult<{ text: string; type: QuestionType; options?: string[]; required: boolean }> = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  const validTypes: QuestionType[] = [
    'text',
    'multipleChoice',
    'yesNo',
    'photo',
    'signature',
    'rating',
    'number',
    'date',
    'time',
  ];

  try {
    const parsed = await parseCSV<QuestionImportRow>(file);

    if (parsed.errors.length > 0) {
      result.errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
    }

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const rowNum = i + 2; // Account for header row

      if (!row.text?.trim()) {
        result.warnings.push(`Row ${rowNum}: Missing question text, skipping.`);
        continue;
      }

      const type = row.type?.trim().toLowerCase() as QuestionType;
      if (!validTypes.includes(type)) {
        result.warnings.push(
          `Row ${rowNum}: Invalid type "${row.type}". Valid types: ${validTypes.join(', ')}. Defaulting to "text".`
        );
      }

      const finalType = validTypes.includes(type) ? type : 'text';

      // Parse options for multipleChoice
      let options: string[] | undefined;
      if (finalType === 'multipleChoice' && row.options) {
        options = row.options
          .split(',')
          .map((o) => o.trim())
          .filter((o) => o);

        if (options.length < 2) {
          result.warnings.push(
            `Row ${rowNum}: Multiple choice needs at least 2 options. Found ${options.length}.`
          );
        }
      }

      // Parse required field
      const required =
        row.required === true ||
        row.required === 'true' ||
        row.required === 'yes' ||
        row.required === '1';

      result.data.push({
        text: row.text.trim(),
        type: finalType,
        options,
        required,
      });
    }

    if (result.data.length === 0) {
      result.success = false;
      result.errors.push('No valid questions found in CSV.');
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to parse CSV: ${error}`);
  }

  return result;
}

/**
 * Generate sample CSV template for stops
 */
export function generateStopsTemplate(): string {
  return Papa.unparse([
    { address: '123 Main St, New York, NY 10001', name: 'Client A' },
    { address: '456 Oak Ave, Los Angeles, CA 90001', name: 'Client B' },
    { address: '789 Pine Rd, Chicago, IL 60601', name: '' },
  ]);
}

/**
 * Generate sample CSV template for questions
 */
export function generateQuestionsTemplate(): string {
  return Papa.unparse([
    { text: 'Contact name', type: 'text', options: '', required: 'false' },
    { text: 'Was anyone present?', type: 'yesNo', options: '', required: 'true' },
    { text: 'Visit outcome', type: 'multipleChoice', options: 'Completed,Partial,Failed,Rescheduled', required: 'true' },
    { text: 'Customer rating', type: 'rating', options: '', required: 'false' },
    { text: 'Photo documentation', type: 'photo', options: '', required: 'false' },
  ]);
}

/**
 * Parse questions from CSV text string
 * For use when reading file as text directly
 */
export function parseQuestionsCSV(
  csvText: string
): { text: string; type: QuestionType; options?: string[]; required: boolean; order: number }[] {
  const validTypes: QuestionType[] = [
    'text',
    'multipleChoice',
    'yesNo',
    'photo',
    'signature',
    'rating',
    'number',
    'date',
    'time',
  ];

  const parsed = Papa.parse<QuestionImportRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const questions: { text: string; type: QuestionType; options?: string[]; required: boolean; order: number }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];

    // Check for text column (could be 'text' or 'question')
    const questionText = row.text?.trim() || (row as any).question?.trim();

    if (!questionText) continue;

    const rawType = row.type?.trim().toLowerCase() as QuestionType;
    const type = validTypes.includes(rawType) ? rawType : 'text';

    // Parse options - can be separated by | or ,
    let options: string[] | undefined;
    if (type === 'multipleChoice' && row.options) {
      const separator = row.options.includes('|') ? '|' : ',';
      options = row.options
        .split(separator)
        .map((o) => o.trim())
        .filter((o) => o);
    }

    // Parse required field
    const required =
      row.required === true ||
      row.required === 'true' ||
      row.required === 'yes' ||
      row.required === '1';

    questions.push({
      text: questionText,
      type,
      options,
      required,
      order: i,
    });
  }

  return questions;
}

/**
 * Download a template file
 */
export function downloadTemplate(type: 'stops' | 'questions'): void {
  const content = type === 'stops' ? generateStopsTemplate() : generateQuestionsTemplate();
  const filename = type === 'stops' ? 'stops-template.csv' : 'questions-template.csv';

  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
