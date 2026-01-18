/**
 * PDF.js Worker Configuration
 * Centralizes PDF.js setup to handle worker loading properly in Electron
 */

import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker URL from CDN - matches the installed version
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';

let isConfigured = false;

/**
 * Configure PDF.js worker globally
 * This should be called once before using any PDF.js functionality
 */
export function configurePdfWorker(): void {
  if (isConfigured) return;
  
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    isConfigured = true;
  }
}

/**
 * Get configured PDF.js library
 * Ensures worker is configured before returning the library
 */
export async function getPdfLib(): Promise<typeof pdfjsLib> {
  const lib = await import('pdfjs-dist');
  
  if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  }
  
  return lib;
}

/**
 * Load a PDF document with proper configuration
 */
export async function loadPdfDocument(data: ArrayBuffer | Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  const lib = await getPdfLib();
  return lib.getDocument({ data }).promise;
}

// Auto-configure on module load
configurePdfWorker();

// Re-export pdfjsLib for convenience
export { pdfjsLib };
