/**
 * File preview utilities for PDF, Excel, Word, and Image files
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - disable to avoid Promise.withResolvers issue
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  (pdfjsLib as any).GlobalWorkerOptions.workerPort = null;
}

export interface FilePreview {
  type: 'pdf' | 'excel' | 'word' | 'image';
  fileName: string;
  fileSize: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate PDF preview with thumbnail and metadata
 */
export async function generatePdfPreview(file: File): Promise<FilePreview> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const metadataInfo = await pdf.getMetadata();
  const metadata: Record<string, any> = {
    pages: pdf.numPages,
    pdfVersion: `PDF ${(metadataInfo.info as any)?.PDFFormatVersion || 'Unknown'}`,
  };

  // Generate thumbnail from first page
  let thumbnail: string | undefined;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    thumbnail = canvas.toDataURL();
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err);
  }

  return {
    type: 'pdf',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    thumbnail,
    metadata,
  };
}

/**
 * Generate Excel preview with metadata
 */
export async function generateExcelPreview(file: File): Promise<FilePreview> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const sheets = workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rowCount,
    columns: sheet.columnCount,
  }));

  const metadata = {
    sheets: sheets.length,
    sheetNames: sheets.map(s => s.name).join(', '),
    totalRows: sheets.reduce((sum, s) => sum + s.rows, 0),
    totalColumns: Math.max(...sheets.map(s => s.columns)),
  };

  return {
    type: 'excel',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    metadata,
  };
}

/**
 * Generate Word preview with metadata
 */
export async function generateWordPreview(file: File): Promise<FilePreview> {
  const mammoth = await import('mammoth');
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  const text = result.value;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const lines = text.split('\n').length;
  
  const metadata = {
    words,
    characters: chars,
    lines,
    estimatedPages: Math.ceil(words / 250), // Rough estimate: 250 words per page
  };

  return {
    type: 'word',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    metadata,
  };
}

/**
 * Generate Image preview
 */
export async function generateImagePreview(file: File): Promise<FilePreview> {
  const thumbnail = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Get image dimensions
  const metadata = await new Promise<Record<string, any>>((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        aspectRatio: (img.width / img.height).toFixed(2),
        format: file.type.split('/')[1].toUpperCase(),
      });
    };
    img.onerror = () => resolve({ format: file.type.split('/')[1].toUpperCase() });
    img.src = thumbnail;
  });

  return {
    type: 'image',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    thumbnail,
    metadata,
  };
}

/**
 * Main function to generate preview based on file type
 */
export async function generateFilePreview(file: File): Promise<FilePreview> {
  const fileName = file.name.toLowerCase();
  
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    return generatePdfPreview(file);
  }
  
  if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.type === 'application/vnd.ms-excel' ||
      fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return generateExcelPreview(file);
  }
  
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/msword' ||
      fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return generateWordPreview(file);
  }
  
  if (file.type.startsWith('image/')) {
    return generateImagePreview(file);
  }
  
  // Fallback for unknown types
  return {
    type: 'image',
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    metadata: { type: file.type },
  };
}
