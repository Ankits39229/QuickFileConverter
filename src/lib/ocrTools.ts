import Tesseract from 'tesseract.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface OCRProgress {
  status: string;
  progress: number;
}

export type OCRProgressCallback = (progress: OCRProgress) => void;

// Perform OCR on an image and return text
export async function performOCR(
  imageFile: File, 
  onProgress?: OCRProgressCallback
): Promise<string> {
  try {
    // Create a worker with CDN paths for Tesseract.js
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status) {
          onProgress({
            status: m.status,
            progress: m.progress || 0
          });
        }
      },
      // Use CDN for worker and language files (will be cached)
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
    });

    const result = await worker.recognize(imageFile);
    await worker.terminate();
    
    return result.data.text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to perform OCR on image. Please check your internet connection for the first use.');
  }
}

// Convert image to searchable PDF with OCR text layer
export async function convertImageToSearchablePdf(
  imageFile: File,
  onProgress?: OCRProgressCallback
): Promise<Blob> {
  // Perform OCR first
  const text = await performOCR(imageFile, onProgress);
  
  // Create PDF with image and text layer
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  
  // Embed image
  const imageBytes = await imageFile.arrayBuffer();
  let embeddedImage;
  
  if (imageFile.type === 'image/png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }
  
  const { width, height } = page.getSize();
  const imageScale = Math.min(width / embeddedImage.width, height / embeddedImage.height);
  const scaledWidth = embeddedImage.width * imageScale;
  const scaledHeight = embeddedImage.height * imageScale;
  
  // Draw image
  page.drawImage(embeddedImage, {
    x: (width - scaledWidth) / 2,
    y: (height - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  });
  
  // Add invisible text layer for searchability
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  
  // Split text into lines and add to PDF
  const lines = text.split('\n');
  let yPosition = height - 50;
  
  for (const line of lines) {
    if (line.trim()) {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0, // Make text invisible but searchable
      });
      yPosition -= fontSize + 5;
    }
    
    if (yPosition < 50) break; // Prevent overflow
  }
  
  const pdfBytes = await pdfDoc.save();
  const uint8Array = new Uint8Array(Array.from(pdfBytes));
  return new Blob([uint8Array], { type: 'application/pdf' });
}

// Convert scanned PDF to searchable PDF with OCR
export async function convertPdfToSearchable(
  pdfFile: File,
  onProgress?: OCRProgressCallback
): Promise<Blob> {
  const { getPdfLib } = await import('./pdfWorkerConfig');
  const pdfjsLib = await getPdfLib();
  
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const newPdfDoc = await PDFDocument.create();
  const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
  
  for (let pageNum = 1; pageNum <= loadedPdf.numPages; pageNum++) {
    if (onProgress) {
      onProgress({
        status: `Processing page ${pageNum} of ${loadedPdf.numPages}`,
        progress: ((pageNum - 1) / loadedPdf.numPages)
      });
    }
    
    const page = await loadedPdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    
    // Render page to canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context!,
      viewport: viewport
    }).promise;
    
    // Convert canvas to blob
    const imageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
    
    // Perform OCR on page image
    const imageFile = new File([imageBlob], `page-${pageNum}.png`, { type: 'image/png' });
    const ocrText = await performOCR(imageFile, (prog) => {
      if (onProgress) {
        const overallProgress = ((pageNum - 1) / loadedPdf.numPages) + (prog.progress / loadedPdf.numPages);
        onProgress({
          status: `OCR on page ${pageNum}: ${prog.status}`,
          progress: overallProgress
        });
      }
    });
    
    // Create new page with image and text
    const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
    
    // Embed and draw image
    const pngImageBytes = await imageBlob.arrayBuffer();
    const pngImage = await newPdfDoc.embedPng(pngImageBytes);
    
    newPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    
    // Add invisible text layer
    const lines = ocrText.split('\n');
    let yPosition = viewport.height - 20;
    
    for (const line of lines) {
      if (line.trim()) {
        newPage.drawText(line, {
          x: 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0, 0, 0),
          opacity: 0, // Invisible but searchable
        });
        yPosition -= 15;
      }
      
      if (yPosition < 20) break;
    }
  }
  
  if (onProgress) {
    onProgress({
      status: 'Finalizing PDF...',
      progress: 1
    });
  }
  
  const pdfBytes = await newPdfDoc.save();
  const uint8Array = new Uint8Array(Array.from(pdfBytes));
  return new Blob([uint8Array], { type: 'application/pdf' });
}

// Extract text from image using OCR
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: OCRProgressCallback
): Promise<string> {
  return performOCR(imageFile, onProgress);
}
