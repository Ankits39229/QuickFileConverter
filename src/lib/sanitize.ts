/**
 * Security utilities for input sanitization
 */

// File size limits in bytes
export const FILE_SIZE_LIMITS = {
  PDF: 200 * 1024 * 1024,      // 200 MB
  EXCEL: 70 * 1024 * 1024,     // 70 MB
  WORD: 70 * 1024 * 1024,      // 70 MB
  IMAGE: 75 * 1024 * 1024,     // 75 MB per image
  IMAGE_BATCH: 400 * 1024 * 1024, // 400 MB total for batch
} as const;

/**
 * Format bytes to human-readable file size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Validate individual file size
 */
export function validateFileSize(
  file: File,
  maxSize: number,
  fileType: string = 'file'
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `${file.name} is too large (${formatBytes(file.size)}). Maximum ${fileType} size is ${formatBytes(maxSize)}.`
    };
  }
  return { valid: true };
}

/**
 * Validate multiple files' total size
 */
export function validateBatchFileSize(
  files: File[],
  maxTotalSize: number,
  maxIndividualSize?: number,
  fileType: string = 'file'
): { valid: boolean; error?: string } {
  // Check individual file sizes if limit provided
  if (maxIndividualSize) {
    for (const file of files) {
      const result = validateFileSize(file, maxIndividualSize, fileType);
      if (!result.valid) {
        return result;
      }
    }
  }
  
  // Check total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      error: `Total file size (${formatBytes(totalSize)}) exceeds maximum limit of ${formatBytes(maxTotalSize)}. Please select fewer or smaller files.`
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize text input to prevent injection attacks
 * Removes potentially dangerous characters and limits length
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Remove null bytes and control characters (except newlines, tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  sanitized = sanitized.slice(0, maxLength);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize filename to prevent directory traversal and invalid characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'output';
  
  // Remove path separators and other dangerous characters
  let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  
  // Prevent directory traversal
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Limit length
  sanitized = sanitized.slice(0, 255);
  
  // Fallback if empty
  return sanitized || 'output';
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(
  input: number,
  min: number,
  max: number,
  defaultValue: number
): number {
  // Check if valid number
  if (typeof input !== 'number' || isNaN(input) || !isFinite(input)) {
    return defaultValue;
  }
  
  // Clamp to range
  return Math.max(min, Math.min(max, Math.floor(input)));
}

/**
 * Validate page range string (e.g., "1-5,7,9-12")
 */
export function sanitizePageRange(input: string, maxPage: number): string {
  if (!input) return '';
  
  // Only allow numbers, commas, hyphens, and spaces
  let sanitized = input.replace(/[^0-9,\-\s]/g, '');
  
  // Validate format
  const parts = sanitized.split(',');
  const validParts: string[] = [];
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      if (start > 0 && end > 0 && start <= maxPage && end <= maxPage && start <= end) {
        validParts.push(`${start}-${end}`);
      }
    } else {
      const num = parseInt(trimmed);
      if (num > 0 && num <= maxPage) {
        validParts.push(trimmed);
      }
    }
  }
  
  return validParts.join(',');
}

/**
 * Sanitize password input
 */
export function sanitizePassword(password: string): string {
  if (!password) return '';
  
  // Limit length for security (prevent DOS attacks with huge strings)
  const sanitized = password.slice(0, 128);
  
  return sanitized;
}

/**
 * Validate and sanitize opacity value (0-1)
 */
export function sanitizeOpacity(value: number): number {
  return sanitizeNumber(value, 0, 1, 0.5);
}

/**
 * Validate and sanitize rotation angle
 */
export function sanitizeRotation(value: number): number {
  return sanitizeNumber(value, -360, 360, 0);
}

/**
 * Sanitize column name/value for Excel operations
 */
export function sanitizeColumnValue(input: string): string {
  // Allow alphanumeric, spaces, and common punctuation
  return sanitizeText(input, 500);
}

/**
 * Validate array of page numbers
 */
export function sanitizePageNumbers(pages: number[], maxPage: number): number[] {
  return pages
    .filter(p => typeof p === 'number' && p > 0 && p <= maxPage)
    .map(p => Math.floor(p));
}
