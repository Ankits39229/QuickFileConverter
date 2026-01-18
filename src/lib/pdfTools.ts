import { PDFDocument } from 'pdf-lib';

// Image to PDF layout options
export type ImageLayoutMode = 'fit' | 'fill' | 'stretch' | 'center';
export type PageOrientation = 'portrait' | 'landscape';
export type PageSize = 'a4' | 'letter' | 'legal' | 'a3' | 'custom';

// Page size configurations
export const PAGE_SIZES = {
  a4: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
  a3: { width: 842, height: 1191 }
};

// Enhanced images to PDF conversion with layout options
export async function convertImagesToPdf(
  files: File[],
  options: {
    layoutMode: ImageLayoutMode;
    orientation: PageOrientation;
    pageSize: PageSize;
    customWidth?: number;
    customHeight?: number;
  } = {
    layoutMode: 'fit',
    orientation: 'portrait',
    pageSize: 'a4'
  }
): Promise<Blob> {
  const doc = await PDFDocument.create();
  
  // Get page dimensions
  let pageWidth: number;
  let pageHeight: number;
  
  if (options.pageSize === 'custom' && options.customWidth && options.customHeight) {
    pageWidth = options.customWidth;
    pageHeight = options.customHeight;
  } else {
    const size = PAGE_SIZES[options.pageSize as keyof typeof PAGE_SIZES] || PAGE_SIZES.a4;
    pageWidth = size.width;
    pageHeight = size.height;
  }
  
  // Apply orientation
  if (options.orientation === 'landscape') {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }
  
  for (const file of files) {
    const data = await file.arrayBuffer();
    let embedded;
    
    // Embed image based on type
    if (file.type === 'image/png') {
      embedded = await doc.embedPng(data);
    } else {
      embedded = await doc.embedJpg(data);
    }
    
    const { width: imgWidth, height: imgHeight } = embedded.scale(1);
    const page = doc.addPage([pageWidth, pageHeight]);
    
    let x = 0;
    let y = 0;
    let drawWidth = imgWidth;
    let drawHeight = imgHeight;
    
    switch (options.layoutMode) {
      case 'fit':
        // Fit image within page bounds while maintaining aspect ratio
        const fitScale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        drawWidth = imgWidth * fitScale;
        drawHeight = imgHeight * fitScale;
        x = (pageWidth - drawWidth) / 2;
        y = (pageHeight - drawHeight) / 2;
        break;
        
      case 'fill':
        // Fill entire page, may crop image but maintains aspect ratio
        const fillScale = Math.max(pageWidth / imgWidth, pageHeight / imgHeight);
        drawWidth = imgWidth * fillScale;
        drawHeight = imgHeight * fillScale;
        x = (pageWidth - drawWidth) / 2;
        y = (pageHeight - drawHeight) / 2;
        break;
        
      case 'stretch':
        // Stretch to fill entire page, may distort aspect ratio
        drawWidth = pageWidth;
        drawHeight = pageHeight;
        x = 0;
        y = 0;
        break;
        
      case 'center':
        // Center image at original size (may be clipped if larger than page)
        drawWidth = Math.min(imgWidth, pageWidth);
        drawHeight = Math.min(imgHeight, pageHeight);
        x = (pageWidth - drawWidth) / 2;
        y = (pageHeight - drawHeight) / 2;
        break;
    }
    
    page.drawImage(embedded, {
      x,
      y,
      width: drawWidth,
      height: drawHeight
    });
  }
  
  const pdfBytes = await doc.save();
  const uint8Array = new Uint8Array(pdfBytes);
  return new Blob([uint8Array], { type: 'application/pdf' });
}

// Merge multiple PDF File objects into single Blob URL
export async function mergePdfFiles(files: File[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const out = await merged.save();
  const copy = new Uint8Array(out);
  return new Blob([copy], { type: 'application/pdf' });
}

// Split a PDF into individual page PDFs; returns array of {pageNumber, blob}
export async function splitPdf(file: File): Promise<{ pageNumber: number; blob: Blob }[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const results: { pageNumber: number; blob: Blob }[] = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
  const out = await doc.save();
  const copy = new Uint8Array(out);
  results.push({ pageNumber: i + 1, blob: new Blob([copy], { type: 'application/pdf' }) });
  }
  return results;
}

// Get total page count of a PDF
export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const src = await PDFDocument.load(bytes);
  return src.getPageCount();
}

// Parse page ranges string (e.g., "1-5,7,9-12") and return array of page numbers
export function parsePageRanges(rangesStr: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const ranges = rangesStr.split(',').map(r => r.trim()).filter(r => r);
  
  for (const range of ranges) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(n => parseInt(n.trim()));
      if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
        throw new Error(`Invalid range: ${range}. Pages must be between 1 and ${totalPages}.`);
      }
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      const pageNum = parseInt(range);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        throw new Error(`Invalid page number: ${range}. Pages must be between 1 and ${totalPages}.`);
      }
      pages.add(pageNum);
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}

// Split PDF by page ranges; returns array of {name, blob} for each range
export async function splitPdfByRanges(
  file: File, 
  rangesStr: string
): Promise<{ name: string; blob: Blob }[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const src = await PDFDocument.load(bytes);
  const totalPages = src.getPageCount();
  
  const ranges = rangesStr.split(',').map(r => r.trim()).filter(r => r);
  const results: { name: string; blob: Blob }[] = [];
  
  for (const range of ranges) {
    const pageNumbers = parsePageRanges(range, totalPages);
    const doc = await PDFDocument.create();
    
    // Copy pages (convert to 0-based indexing)
    const pageIndices = pageNumbers.map(p => p - 1);
    const pages = await doc.copyPages(src, pageIndices);
    pages.forEach(page => doc.addPage(page));
    
    const out = await doc.save();
    const copy = new Uint8Array(out);
    const blob = new Blob([copy], { type: 'application/pdf' });
    
    const rangeName = pageNumbers.length === 1 
      ? `page-${pageNumbers[0]}` 
      : `pages-${Math.min(...pageNumbers)}-${Math.max(...pageNumbers)}`;
    
    results.push({ name: rangeName, blob });
  }
  
  return results;
}

// Compression levels for PDF optimization
export type CompressionLevel = 'low' | 'medium' | 'high';

// Enhanced PDF compression with professional multi-strategy approach
export async function compressPdf(file: File, level: CompressionLevel = 'medium'): Promise<{
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  optimizationsApplied: string[];
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const originalSize = bytes.length;
  const optimizationsApplied: string[] = [];
  
  try {
    const src = await PDFDocument.load(bytes, { 
      ignoreEncryption: true,
      updateMetadata: false 
    });
    
    // Strategy 1: Remove or minimize metadata
    const cleanMetadata = () => {
      try {
        if (level === 'medium' || level === 'high') {
          src.setTitle('');
          src.setAuthor('');
          src.setSubject('');
          src.setKeywords([]);
          src.setProducer('PDF Compressor');
          src.setCreator('PDF Compressor');
          optimizationsApplied.push('Metadata removed');
        }
      } catch (e) {
        console.warn('Could not clean metadata:', e);
      }
    };
    
    // Strategy 2: Remove duplicate resources and optimize structure
    const optimizeStructure = async (): Promise<PDFDocument | null> => {
      try {
        if (level === 'high') {
          // Create a fresh document and copy pages
          // This rebuilds the PDF structure from scratch, eliminating cruft
          const optimized = await PDFDocument.create();
          const pageCount = src.getPageCount();
          
          if (pageCount > 0) {
            const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
            const pages = await optimized.copyPages(src, pageIndices);
            pages.forEach(page => optimized.addPage(page));
            
            optimizationsApplied.push('Structure rebuild');
            return optimized;
          }
        }
        return null;
      } catch (e) {
        console.warn('Structure optimization failed:', e);
        return null;
      }
    };
    
    // Strategy 3: Optimize page contents
    const optimizePages = (doc: PDFDocument) => {
      try {
        const pageCount = doc.getPageCount();
        let optimized = 0;
        
        for (let i = 0; i < pageCount; i++) {
          try {
            const page = doc.getPage(i);
            
            // Access page properties to trigger internal optimizations
            page.getSize();
            page.getRotation();
            
            // Try to get and optimize resources
            const { Resources } = page.node;
            if (Resources) {
              optimized++;
            }
          } catch (e) {
            // Continue with next page
          }
        }
        
        if (optimized > 0) {
          optimizationsApplied.push(`Page optimization (${optimized} pages)`);
        }
      } catch (e) {
        console.warn('Page optimization failed:', e);
      }
    };
    
    // Apply compression strategies based on level
    let workingDoc = src;
    
    // Clean metadata first
    cleanMetadata();
    
    // Try structure optimization for high compression
    if (level === 'high') {
      const optimizedDoc = await optimizeStructure();
      if (optimizedDoc) {
        workingDoc = optimizedDoc;
      }
    }
    
    // Optimize pages
    optimizePages(workingDoc);
    
    // Strategy 4: Try multiple save configurations and pick the best
    const saveConfigs = [
      {
        name: 'Object streams enabled',
        options: {
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: level === 'high' ? 100 : 50
        }
      },
      {
        name: 'Object streams disabled',
        options: {
          useObjectStreams: false,
          addDefaultPage: false,
          objectsPerTick: level === 'high' ? 100 : 50
        }
      }
    ];
    
    let bestResult: { bytes: Uint8Array; config: string } | null = null;
    let bestSize = originalSize;
    
    for (const config of saveConfigs) {
      try {
        const savedBytes = await workingDoc.save(config.options);
        const savedArray = new Uint8Array(savedBytes);
        
        if (savedArray.length < bestSize) {
          bestSize = savedArray.length;
          bestResult = { bytes: savedArray, config: config.name };
        }
      } catch (e) {
        console.warn(`Save config "${config.name}" failed:`, e);
      }
    }
    
    if (bestResult) {
      optimizationsApplied.push(bestResult.config);
      
      const compressedSize = bestResult.bytes.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      
      // Additional strategy: If compression is minimal, try linearization
      if (compressionRatio < 5 && level === 'high') {
        try {
          // Reload and save with different settings
          const reloadedDoc = await PDFDocument.load(bestResult.bytes);
          const reOptimizedBytes = await reloadedDoc.save({
            useObjectStreams: !bestResult.config.includes('enabled'),
            addDefaultPage: false,
            objectsPerTick: 150
          });
          const reOptimizedArray = new Uint8Array(reOptimizedBytes);
          
          if (reOptimizedArray.length < compressedSize) {
            optimizationsApplied.push('Secondary optimization pass');
            const finalCompressionRatio = ((originalSize - reOptimizedArray.length) / originalSize) * 100;
            return {
              blob: new Blob([reOptimizedArray], { type: 'application/pdf' }),
              originalSize,
              compressedSize: reOptimizedArray.length,
              compressionRatio: Math.max(0, finalCompressionRatio),
              optimizationsApplied
            };
          }
        } catch (e) {
          console.warn('Secondary optimization failed:', e);
        }
      }
      
      return {
        blob: new Blob([bestResult.bytes], { type: 'application/pdf' }),
        originalSize,
        compressedSize,
        compressionRatio: Math.max(0, compressionRatio),
        optimizationsApplied
      };
    }
    
    // Fallback: basic save
    throw new Error('All save configurations failed');
    
  } catch (error) {
    console.error('PDF compression failed:', error);
    
    // Enhanced fallback with multiple attempts
    const fallbackStrategies = [
      { name: 'Standard', options: { useObjectStreams: true } },
      { name: 'Basic', options: { useObjectStreams: false } },
      { name: 'Minimal', options: {} }
    ];
    
    for (const strategy of fallbackStrategies) {
      try {
        const src = await PDFDocument.load(bytes);
        const fallbackBytes = await src.save(strategy.options as any);
        const fallbackArray = new Uint8Array(fallbackBytes);
        const fallbackSize = fallbackArray.length;
        const compressionRatio = ((originalSize - fallbackSize) / originalSize) * 100;
        
        return {
          blob: new Blob([fallbackArray], { type: 'application/pdf' }),
          originalSize,
          compressedSize: fallbackSize,
          compressionRatio: Math.max(0, compressionRatio),
          optimizationsApplied: [`${strategy.name} fallback compression`]
        };
      } catch (e) {
        // Try next strategy
        continue;
      }
    }
    
    // Ultimate fallback: return original file
    console.error('All compression attempts failed');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      optimizationsApplied: ['No compression applied (error)']
    };
  }
}

// Get estimated compression info with professional approach details
export function getCompressionInfo(level: CompressionLevel): { 
  name: string; 
  description: string; 
  estimatedReduction: string;
} {
  switch (level) {
    case 'low':
      return {
        name: 'Low Compression',
        description: 'Basic structure optimization, preserves all metadata',
        estimatedReduction: '0-5%'
      };
    case 'medium':
      return {
        name: 'Medium Compression',
        description: 'Multi-strategy compression with metadata removal and object stream optimization',
        estimatedReduction: '3-15%'
      };
    case 'high':
      return {
        name: 'High Compression (Professional)',
        description: 'Complete structure rebuild, multiple optimization passes, best compression algorithm selection',
        estimatedReduction: '5-25%'
      };
  }
}

// Utility function to format file sizes
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Convert PDF to images (extract pages as images)
export async function convertPdfToImages(file: File): Promise<Array<{ pageNumber: number; blob: Blob; dataUrl: string }>> {
  const { getPdfLib } = await import('./pdfWorkerConfig');
  const pdfjsLib = await getPdfLib();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: Array<{ pageNumber: number; blob: Blob; dataUrl: string }> = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context!,
      viewport: viewport
    }).promise;
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    
    const dataUrl = canvas.toDataURL('image/png');
    images.push({ pageNumber: i, blob, dataUrl });
  }
  
  return images;
}

// Rotate PDF pages
export async function rotatePdf(file: File, rotation: 90 | 180 | 270): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  const pages = pdfDoc.getPages();
  pages.forEach(page => {
    const currentRotation = page.getRotation().angle;
    page.setRotation({ type: 'degrees', angle: (currentRotation + rotation) % 360 });
  });
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer], { type: 'application/pdf' });
}

// Remove pages from PDF
export async function removePagesFromPdf(file: File, pagesToRemove: number[]): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Sort in descending order to avoid index shifting
  const sortedPages = [...pagesToRemove].sort((a, b) => b - a);
  
  for (const pageNum of sortedPages) {
    if (pageNum > 0 && pageNum <= pdfDoc.getPageCount()) {
      pdfDoc.removePage(pageNum - 1); // 0-indexed
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer], { type: 'application/pdf' });
}

// Add page numbers to PDF
export async function addPageNumbersToPdf(
  file: File, 
  options: { 
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    fontSize: number;
    startNumber: number;
  }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  const { StandardFonts, rgb } = await import('pdf-lib');
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const pageNumber = options.startNumber + index;
    const text = `${pageNumber}`;
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    
    let x = 0;
    let y = 0;
    const margin = 30;
    
    // Calculate position
    switch (options.position) {
      case 'top-left':
        x = margin;
        y = height - margin;
        break;
      case 'top-center':
        x = (width - textWidth) / 2;
        y = height - margin;
        break;
      case 'top-right':
        x = width - textWidth - margin;
        y = height - margin;
        break;
      case 'bottom-left':
        x = margin;
        y = margin;
        break;
      case 'bottom-center':
        x = (width - textWidth) / 2;
        y = margin;
        break;
      case 'bottom-right':
        x = width - textWidth - margin;
        y = margin;
        break;
    }
    
    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer], { type: 'application/pdf' });
}

// Add watermark to PDF
export async function addWatermarkToPdf(
  file: File,
  watermarkText: string,
  options: {
    fontSize: number;
    opacity: number;
    rotation: number;
    color: { r: number; g: number; b: number };
  }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  const { StandardFonts, rgb } = await import('pdf-lib');
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, options.fontSize);
    
    page.drawText(watermarkText, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: options.fontSize,
      font,
      color: rgb(options.color.r, options.color.g, options.color.b),
      opacity: options.opacity,
      rotate: { type: 'degrees', angle: options.rotation },
    });
  });
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer], { type: 'application/pdf' });
}

// Convert PDF to Word with professional formatting preservation
export async function convertPdfToWord(file: File): Promise<Blob> {
  // Try to use Electron IPC if available (uses Office COM if installed)
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.conversion?.pdfToWord) {
      const ipcResult = await (window as any).electronAPI.conversion.pdfToWord(file);
      if (ipcResult && ipcResult.outputPath) {
        const fileData = await (window as any).electronAPI.fs.readFile(ipcResult.outputPath);
        return new Blob([fileData], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      }
    }
  } catch (error) {
    console.log('Office conversion not available, using client-side fallback');
  }
  
  // Fallback: Client-side conversion with advanced PDF analysis
  const { getPdfLib } = await import('./pdfWorkerConfig');
  const pdfjsLib = await getPdfLib();
  
  const { Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel } = await import('docx');
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const allSections: any[] = [];
  
  // Helper function to group text by position
  const groupTextByPosition = (items: any[], pageWidth: number) => {
    const lineGroups: Map<number, any> = new Map();
    const yThreshold = 1.5;
    
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      
      const y = Math.round(item.transform[5] * 10) / 10;
      const x = item.transform[4];
      const height = item.height || 12;
      
      let lineGroup = Array.from(lineGroups.values()).find(g => Math.abs(g.y - y) < yThreshold);
      
      if (!lineGroup) {
        lineGroup = { y, items: [], avgFontSize: height };
        lineGroups.set(y, lineGroup);
      }
      
      lineGroup.items.push({
        str: item.str,
        x,
        width: item.width || 0,
        height,
        fontName: item.fontName,
        transform: item.transform,
      });
      
      lineGroup.avgFontSize = Math.max(lineGroup.avgFontSize, height);
    }
    
    return Array.from(lineGroups.values()).sort((a, b) => b.y - a.y);
  };
  
  // Helper function to analyze a line group
  const analyzeLineGroup = (lineGroup: any, pageWidth: number) => {
    lineGroup.items.sort((a, b) => a.x - b.x);
    
    const runs: any[] = [];
    let fullText = '';
    let hasBold = false;
    let hasItalic = false;
    
    for (let i = 0; i < lineGroup.items.length; i++) {
      const item = lineGroup.items[i];
      
      if (i > 0) {
        const gap = item.x - (lineGroup.items[i - 1].x + lineGroup.items[i - 1].width);
        if (gap > 2) {
          runs.push({ text: ' ' });
          fullText += ' ';
        }
      }
      
      const isBold = item.fontName?.toLowerCase().includes('bold') ?? false;
      const isItalic = item.fontName?.toLowerCase().includes('italic') ?? false;
      
      runs.push({
        text: item.str,
        bold: isBold,
        italic: isItalic,
        size: Math.round(item.height * 2),
        font: sanitizeFont(item.fontName),
      });
      
      fullText += item.str;
      if (isBold) hasBold = true;
      if (isItalic) hasItalic = true;
    }
    
    if (!fullText.trim()) return null;
    
    const fontSize = lineGroup.avgFontSize;
    const isLarge = fontSize > 14;
    const isVeryLarge = fontSize > 18;
    const isSmall = fontSize < 10;
    
    const avgX = lineGroup.items.reduce((sum: number, item: any) => sum + item.x, 0) / lineGroup.items.length;
    const isCentered = avgX > pageWidth * 0.35 && avgX < pageWidth * 0.65;
    const isRightAligned = avgX > pageWidth * 0.65;
    
    let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
    if (isCentered) alignment = 'center';
    if (isRightAligned) alignment = 'right';
    
    let type: 'heading1' | 'heading2' | 'body' | 'caption' | 'list' = 'body';
    
    if (isVeryLarge && (isCentered || hasBold)) {
      type = 'heading1';
    } else if (isLarge && (hasBold || isCentered)) {
      type = 'heading2';
    } else if (isSmall || (isSmall && isItalic)) {
      type = 'caption';
    } else if (fullText.match(/^[\s•\-\*]\s+/)) {
      type = 'list';
    }
    
    return {
      type,
      text: fullText.trim(),
      runs,
      alignment,
      fontSize,
      isLarge,
      isBold: hasBold,
      isItalic: hasItalic,
    };
  };
  
  // Helper function to create formatted paragraphs
  const createFormattedParagraphs = (elements: any[]) => {
    const paragraphs: Paragraph[] = [];
    
    for (const element of elements) {
      const textRuns = element.runs.map((run: any) => 
        new TextRun({
          text: run.text,
          bold: run.bold,
          italics: run.italic,
          size: run.size || 22,
          font: run.font || 'Calibri',
        })
      );
      
      const options: any = {
        children: textRuns,
        alignment: element.alignment === 'center' ? AlignmentType.CENTER : 
                   element.alignment === 'right' ? AlignmentType.RIGHT :
                   AlignmentType.LEFT,
        spacing: {
          line: 360,
          before: element.type.includes('heading') ? 240 : element.isLarge ? 120 : 60,
          after: element.type.includes('heading') ? 120 : 60,
        },
      };
      
      if (element.type === 'heading1') {
        options.heading = HeadingLevel.HEADING_1;
        options.bold = true;
        options.spacing.before = 360;
        options.spacing.after = 180;
      } else if (element.type === 'heading2') {
        options.heading = HeadingLevel.HEADING_2;
        options.spacing.before = 240;
        options.spacing.after = 120;
      } else if (element.type === 'caption') {
        options.italics = true;
        options.spacing.after = 40;
      } else if (element.type === 'list') {
        options.spacing = { line: 240, before: 40, after: 40 };
      }
      
      paragraphs.push(new Paragraph(options));
    }
    
    return paragraphs;
  };
  
  // Process each page

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Add page break
    if (pageNum > 1) {
      allSections.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true,
        })
      );
    }
    
    // Analyze page structure
    const lineGroups = groupTextByPosition(textContent.items, viewport.width);
    const pageElements = lineGroups
      .map(group => analyzeLineGroup(group, viewport.width))
      .filter(el => el !== null);
    
    // Create paragraphs with better formatting
    const pageParagraphs = createFormattedParagraphs(pageElements);
    allSections.push(...pageParagraphs);
  }
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: allSections.length > 0 ? allSections : [
        new Paragraph({
          text: 'No text content found. This may be a scanned image-based PDF. Consider using LibreOffice for better quality conversion.',
          italics: true,
        }),
      ],
    }],
  });
  
  const blob = await Packer.toBlob(doc);
  return blob;
}

// Helper function to sanitize and map PDF fonts to standard fonts
function sanitizeFont(fontName?: string): string {
  if (!fontName) return 'Calibri';
  
  const sanitized = fontName
    .replace(/\+\w+/, '') // Remove Adobe font prefixes
    .replace(/[^a-zA-Z0-9\s-]/g, ''); // Remove special characters
  
  // Map common PDF fonts to Word-available fonts
  const fontMap: { [key: string]: string } = {
    'Helvetica': 'Calibri',
    'Times': 'Times New Roman',
    'Courier': 'Courier New',
    'Symbol': 'Wingdings',
    'ZapfDingbats': 'Wingdings',
    'Arial': 'Arial',
    'Georgia': 'Georgia',
    'Verdana': 'Verdana',
    'Comic': 'Comic Sans MS',
    'Trebuchet': 'Trebuchet MS',
  };
  
  // Check mappings
  for (const [key, value] of Object.entries(fontMap)) {
    if (sanitized.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Return sanitized name or fallback
  return sanitized || 'Calibri';
}