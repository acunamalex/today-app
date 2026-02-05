import imageCompression from 'browser-image-compression';

const DEFAULT_OPTIONS = {
  maxSizeMB: 0.1, // 100KB
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

/**
 * Compress an image file
 */
export async function compressImage(
  file: File,
  options?: Partial<typeof DEFAULT_OPTIONS>
): Promise<File> {
  const compressionOptions = { ...DEFAULT_OPTIONS, ...options };
  return imageCompression(file, compressionOptions);
}

/**
 * Convert a file to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 string to Blob
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const mimeType = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Compress image from file input and return as base64
 */
export async function compressAndConvertToBase64(
  file: File,
  options?: Partial<typeof DEFAULT_OPTIONS>
): Promise<string> {
  const compressedFile = await compressImage(file, options);
  return fileToBase64(compressedFile);
}

/**
 * Compress image from canvas and return as base64
 */
export function canvasToBase64(
  canvas: HTMLCanvasElement,
  quality = 0.8
): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(
  base64: string,
  maxSize = 200
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = base64;
  });
}

/**
 * Validate image file
 */
export function validateImageFile(
  file: File,
  maxSizeMB = 10
): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.',
    };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File size (${sizeMB.toFixed(1)}MB) exceeds maximum of ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}
