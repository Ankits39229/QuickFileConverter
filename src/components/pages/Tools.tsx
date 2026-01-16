import React, { useCallback, useEffect, useRef, useState } from 'react';
import styling from '../../../styling.json';
import { Upload, File as FileIcon, X, ArrowUp, ArrowDown, Wand2, Images, FileSymlink, Download, AlertCircle, Scissors, RotateCw, Trash2, Hash, Droplet, FileType2, Undo2, Redo2, Eye, FileText } from 'lucide-react';
import styles from './pdfTools.module.css';
import { FilePreviewModal } from '../ui/FilePreviewModal';
import { generateFilePreview, FilePreview } from '../../lib/filePreview';
import { useStateHistory } from '../../lib/stateHistory';
import { generateUniqueFilename } from '../../lib/fileNameUtils';
import { 
  mergePdfFiles, 
  splitPdf, 
  splitPdfByRanges, 
  getPdfPageCount, 
  compressPdf, 
  getCompressionInfo, 
  formatFileSize, 
  convertImagesToPdf, 
  convertPdfToImages,
  rotatePdf,
  removePagesFromPdf,
  addPageNumbersToPdf,
  addWatermarkToPdf,
  convertPdfToWord,
  CompressionLevel, 
  ImageLayoutMode, 
  PageOrientation, 
  PageSize 
} from '../../lib/pdfTools';
import { 
  convertImageToSearchablePdf, 
  convertPdfToSearchable, 
  extractTextFromImage,
  OCRProgress 
} from '../../lib/ocrTools';
import { sanitizeText, sanitizeNumber, sanitizePageRange, sanitizePageNumbers, validateFileSize, validateBatchFileSize, FILE_SIZE_LIMITS } from '../../lib/sanitize';

type Operation = 'merge' | 'images-to-pdf' | 'split' | 'compress' | 'pdf-to-images' | 'rotate' | 'remove-pages' | 'page-numbers' | 'watermark' | 'pdf-to-word' | 'ocr-image' | 'ocr-pdf' | 'extract-text';

interface LocalFile {
  id: string;
  file: File;
}

const ToolsPage: React.FC = () => {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [pageRanges, setPageRanges] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<'all' | 'ranges'>('all');
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [compressionResults, setCompressionResults] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    optimizationsApplied: string[];
  } | null>(null);
  const [imageLayoutMode, setImageLayoutMode] = useState<ImageLayoutMode>('fit');
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>('portrait');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  
  // Rotate options
  const [rotationAngle, setRotationAngle] = useState<90 | 180 | 270>(90);
  
  // Remove pages options
  const [pagesToRemove, setPagesToRemove] = useState<string>('');
  
  // Page numbers options
  const [pageNumberPosition, setPageNumberPosition] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>('bottom-center');
  const [pageNumberSize, setPageNumberSize] = useState<number>(12);
  const [pageNumberStart, setPageNumberStart] = useState<number>(1);
  
  // Watermark options
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkSize, setWatermarkSize] = useState<number>(60);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkRotation, setWatermarkRotation] = useState<number>(45);
  
  // PDF to images result
  const [extractedImages, setExtractedImages] = useState<Array<{ pageNumber: number; dataUrl: string }>>([]);
  
  // OCR results
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  
  // Drag & drop feedback
  const [isDragging, setIsDragging] = useState(false);
  const [dragValid, setDragValid] = useState(true);
  
  // File preview
  const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Track downloaded filenames to prevent duplicates
  const downloadedFilenames = useRef<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  // Undo/Redo functionality
  const stateHistory = useStateHistory({ files, operation, pageRanges, totalPages });

  const colors = styling.colors;

  const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  const isImage = (f: File) => f.type.startsWith('image/');

  const validateFiles = useCallback((incoming: File[]): boolean => {
    if (!incoming.length) return false;
    if (operation === 'merge' || operation === 'split' || operation === 'compress' || 
        operation === 'pdf-to-images' || operation === 'rotate' || operation === 'remove-pages' || 
        operation === 'page-numbers' || operation === 'watermark' || operation === 'pdf-to-word' || operation === 'ocr-pdf') {
      return incoming.every(isPdf);
    }
    if (operation === 'images-to-pdf' || operation === 'ocr-image' || operation === 'extract-text') {
      return incoming.every(isImage);
    }
    return false;
  }, [operation]);

  const onFiles = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (!validateFiles(arr)) {
      setError(operation === 'images-to-pdf' ? 'All files must be images (png/jpg).' : 'All files must be PDFs.');
      return;
    }
    
    // Validate file sizes
    const sizeLimit = operation === 'images-to-pdf' ? FILE_SIZE_LIMITS.IMAGE : FILE_SIZE_LIMITS.PDF;
    const sizeValidation = operation === 'images-to-pdf' 
      ? validateBatchFileSize(arr, FILE_SIZE_LIMITS.IMAGE_BATCH, FILE_SIZE_LIMITS.IMAGE, 'image')
      : validateBatchFileSize(arr, sizeLimit * arr.length, sizeLimit, 'PDF');
    
    if (!sizeValidation.valid) {
      setError(sizeValidation.error || 'File size validation failed.');
      return;
    }
    
    setError(null);
    setResultUrl(null);
    setFiles(prev => ([...prev, ...arr.map(f => ({ id: crypto.randomUUID(), file: f }))]));
    
    // Get page count for split operation
    if (operation === 'split' && arr.length === 1 && isPdf(arr[0])) {
      try {
        const count = await getPdfPageCount(arr[0]);
        setTotalPages(count);
      } catch (err) {
        console.error('Failed to get page count:', err);
        setTotalPages(0);
      }
    }
  }, [validateFiles, operation]);

  const onDrop: React.DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    setIsDragging(false);
    onFiles(e.dataTransfer.files);
  };
  
  const onDragOver: React.DragEventHandler<HTMLDivElement> = e => { 
    e.preventDefault();
  };
  
  const onDragEnter: React.DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    setIsDragging(true);
    
    // Check if dragged files are valid
    const files = Array.from(e.dataTransfer.items);
    const allValid = files.every(item => {
      if (operation === 'images-to-pdf') {
        return item.type.startsWith('image/');
      }
      return item.type === 'application/pdf';
    });
    setDragValid(allValid);
  };
  
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    // Only set dragging false if leaving the drop zone itself
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handlePreviewFile = async (file: File) => {
    setLoadingPreview(true);
    try {
      const preview = await generateFilePreview(file);
      setPreviewFile(preview);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setError('Failed to generate file preview');
    } finally {
      setLoadingPreview(false);
    }
  };
  
  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const moveFile = (id: string, dir: -1 | 1) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return prev;
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      return next;
    });
  };

  const clearAll = () => {
    // Save current state before clearing
    stateHistory.saveState(
      { files, operation, pageRanges, totalPages },
      `Clear ${files.length} file(s)`
    );
    
    setFiles([]); 
    setResultUrl(null); 
    setError(null); 
    setSuccess(null);
    setPageRanges(''); 
    setTotalPages(0); 
    setSplitMode('all'); 
    setCompressionLevel('medium');
    setCompressionResults(null);
    setImageLayoutMode('fit');
    setPageOrientation('portrait');
    setPageSize('a4');
    setRotationAngle(90);
    setPagesToRemove('');
    setPageNumberPosition('bottom-center');
    setPageNumberSize(12);
    setPageNumberStart(1);
    setWatermarkText('CONFIDENTIAL');
    setWatermarkSize(60);
    setWatermarkOpacity(0.3);
    setWatermarkRotation(45);
    setExtractedImages([]);
    setOcrProgress(null);
    setExtractedText('');
  };
  
  const handleUndo = () => {
    const prevState = stateHistory.undo();
    if (prevState) {
      setFiles(prevState.files || []);
      setOperation(prevState.operation || null);
      setPageRanges(prevState.pageRanges || '');
      setTotalPages(prevState.totalPages || 0);
    }
  };
  
  const handleRedo = () => {
    const nextState = stateHistory.redo();
    if (nextState) {
      setFiles(nextState.files || []);
      setOperation(nextState.operation || null);
      setPageRanges(nextState.pageRanges || '');
      setTotalPages(nextState.totalPages || 0);
    }
  };



  const process = async () => {
    if (!files.length) { setError('Add at least one file.'); return; }
    if (!validateFiles(files.map(f => f.file) as File[])) return;
    setProcessing(true); setError(null); setResultUrl(null);
    try {
      let url: string | null = null;
      const fileList = files.map(f => f.file);
      
      switch (operation) {
        case 'merge': {
          if (fileList.length < 2) {
            setError('Please select at least two PDF files to merge.');
            return;
          }
          const blob = await mergePdfFiles(fileList);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'images-to-pdf': {
          const blob = await convertImagesToPdf(fileList, {
            layoutMode: imageLayoutMode,
            orientation: pageOrientation,
            pageSize: pageSize
          });
          url = URL.createObjectURL(blob);
          break;
        }
        case 'split': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file to split.');
            return;
          }
          
          if (splitMode === 'all') {
            // Original split functionality - split into individual pages
            const pages = await splitPdf(fileList[0]);
            // Create ZIP of all pages
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            
            for (const page of pages) {
              zip.file(`page-${page.pageNumber}.pdf`, page.blob);
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            url = URL.createObjectURL(zipBlob);
          } else {
            // New range-based split functionality
            if (!pageRanges.trim()) {
              setError('Please enter page ranges (e.g., 1-5,7,9-12).');
              return;
            }
            
            const sanitizedPageRanges = sanitizePageRange(pageRanges, totalPages);
            if (!sanitizedPageRanges) {
              setError('Invalid page ranges. Please use format like: 1-5,7,9-12');
              return;
            }
            
            try {
              const rangePdfs = await splitPdfByRanges(fileList[0], sanitizedPageRanges);
              
              if (rangePdfs.length === 1) {
                // Single range, return PDF directly
                url = URL.createObjectURL(rangePdfs[0].blob);
              } else {
                // Multiple ranges, create ZIP
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();
                
                for (const range of rangePdfs) {
                  zip.file(`${range.name}.pdf`, range.blob);
                }
                
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                url = URL.createObjectURL(zipBlob);
              }
            } catch (err: any) {
              setError(err.message || 'Invalid page ranges.');
              return;
            }
          }
          break;
        }
        case 'compress': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file to compress.');
            return;
          }
          const result = await compressPdf(fileList[0], compressionLevel);
          setCompressionResults({
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            optimizationsApplied: result.optimizationsApplied
          });
          url = URL.createObjectURL(result.blob);
          break;
        }
        case 'pdf-to-images': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file to convert.');
            return;
          }
          const images = await convertPdfToImages(fileList[0]);
          setExtractedImages(images.map(img => ({ pageNumber: img.pageNumber, dataUrl: img.dataUrl })));
          
          // Create ZIP of all images
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          
          for (const img of images) {
            zip.file(`page-${img.pageNumber}.png`, img.blob);
          }
          
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          url = URL.createObjectURL(zipBlob);
          break;
        }
        case 'rotate': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file to rotate.');
            return;
          }
          const blob = await rotatePdf(fileList[0], rotationAngle);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'remove-pages': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file.');
            return;
          }
          if (!pagesToRemove.trim()) {
            setError('Please enter page numbers to remove (e.g., 1,3,5 or 2-4).');
            return;
          }
          
          // Parse page numbers
          const pages: number[] = [];
          const parts = pagesToRemove.split(',');
          for (const part of parts) {
            if (part.includes('-')) {
              const [start, end] = part.split('-').map(n => parseInt(n.trim()));
              if (isNaN(start) || isNaN(end) || start < 1 || end < 1) continue;
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
            } else {
              const num = parseInt(part.trim());
              if (!isNaN(num) && num > 0) {
                pages.push(num);
              }
            }
          }
          
          const sanitizedPages = sanitizePageNumbers(pages, totalPages || 1000);
          if (sanitizedPages.length === 0) {
            setError('Invalid page numbers provided.');
            return;
          }
          
          const blob = await removePagesFromPdf(fileList[0], sanitizedPages);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'page-numbers': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file.');
            return;
          }
          const sanitizedSize = sanitizeNumber(pageNumberSize, 6, 72, 12);
          const sanitizedStart = sanitizeNumber(pageNumberStart, 1, 10000, 1);
          
          const blob = await addPageNumbersToPdf(fileList[0], {
            position: pageNumberPosition,
            fontSize: sanitizedSize,
            startNumber: sanitizedStart
          });
          url = URL.createObjectURL(blob);
          break;
        }
        case 'watermark': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file.');
            return;
          }
          const sanitizedWatermarkText = sanitizeText(watermarkText, 200);
          if (!sanitizedWatermarkText) {
            setError('Please enter valid watermark text.');
            return;
          }
          const sanitizedSize = sanitizeNumber(watermarkSize, 8, 200, 60);
          const sanitizedOpacity = Math.max(0, Math.min(1, watermarkOpacity));
          const sanitizedRotation = Math.max(-360, Math.min(360, watermarkRotation));
          
          const blob = await addWatermarkToPdf(fileList[0], sanitizedWatermarkText, {
            fontSize: sanitizedSize,
            opacity: sanitizedOpacity,
            rotation: sanitizedRotation,
            color: { r: 0.5, g: 0.5, b: 0.5 }
          });
          url = URL.createObjectURL(blob);
          break;
        }
        case 'pdf-to-word': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file to convert.');
            return;
          }
          const blob = await convertPdfToWord(fileList[0]);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'ocr-image': {
          if (fileList.length !== 1) {
            setError('Please select exactly one image file.');
            return;
          }
          const blob = await convertImageToSearchablePdf(fileList[0], setOcrProgress);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'ocr-pdf': {
          if (fileList.length !== 1) {
            setError('Please select exactly one PDF file.');
            return;
          }
          const blob = await convertPdfToSearchable(fileList[0], setOcrProgress);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'extract-text': {
          if (fileList.length !== 1) {
            setError('Please select exactly one image file.');
            return;
          }
          const text = await extractTextFromImage(fileList[0], setOcrProgress);
          setExtractedText(text);
          // No URL for text extraction, just display the text
          break;
        }
        
        default:
          break;
      }
      if (url) setResultUrl(url);
    } catch (e: any) {
      setError(e.message || 'Processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (wrapperRef.current) {
      const el = wrapperRef.current;
      
      // Background colors
      el.style.setProperty('--pdf-bg-item', colors.background.itemBackground);
      el.style.setProperty('--pdf-bg-hover', colors.background.hover);
      el.style.setProperty('--pdf-bg-item-hover', colors.background.itemHover);
      el.style.setProperty('--pdf-bg-button', colors.background.buttonBackground);
      el.style.setProperty('--pdf-bg-button-hover', colors.background.buttonHover);
      el.style.setProperty('--pdf-bg-transparent', colors.background.transparent);
      
      // Border colors
      el.style.setProperty('--pdf-border-primary', colors.border.primary);
      
      // Text colors
      el.style.setProperty('--pdf-text-primary', colors.text.primary);
      el.style.setProperty('--pdf-text-opacity', '0.75');
      
      // Typography
      el.style.setProperty('--pdf-font', styling.fonts.primary);
      el.style.setProperty('--pdf-heading-size', styling.typography.heading.fontSize);
      el.style.setProperty('--pdf-heading-weight', styling.typography.heading.fontWeight);
      el.style.setProperty('--pdf-heading-margin', styling.typography.heading.marginBottom);
      el.style.setProperty('--pdf-description-size', styling.typography.description.fontSize);
      el.style.setProperty('--pdf-description-weight', styling.typography.description.fontWeight);
      el.style.setProperty('--pdf-description-margin', styling.typography.description.marginBottom);
      el.style.setProperty('--pdf-button-font-size', styling.typography.button.fontSize);
      el.style.setProperty('--pdf-button-font-weight', styling.typography.button.fontWeight);
      el.style.setProperty('--pdf-item-title-size', styling.typography.itemTitle.fontSize);
      el.style.setProperty('--pdf-item-title-weight', styling.typography.itemTitle.fontWeight);
      el.style.setProperty('--pdf-item-title-margin', styling.typography.itemTitle.marginBottom);
      el.style.setProperty('--pdf-item-desc-size', styling.typography.itemDescription.fontSize);
      el.style.setProperty('--pdf-item-desc-weight', styling.typography.itemDescription.fontWeight);
      
      // Dimensions
      el.style.setProperty('--pdf-button-height', styling.dimensions.button.height);
      el.style.setProperty('--pdf-button-width', styling.dimensions.button.width);
      el.style.setProperty('--pdf-item-height', styling.dimensions.item.height);
      
      // Spacing
      el.style.setProperty('--pdf-container-padding', styling.spacing.container.padding);
      el.style.setProperty('--pdf-item-padding-left', styling.spacing.item.paddingLeft);
      el.style.setProperty('--pdf-item-padding-right', styling.spacing.item.paddingRight);
      el.style.setProperty('--pdf-item-gap', styling.spacing.item.gap);
      
      // Borders
      el.style.setProperty('--pdf-button-border-width', styling.borders.button.borderWidth);
      el.style.setProperty('--pdf-button-border-radius', styling.borders.button.borderRadius);
      el.style.setProperty('--pdf-item-border-radius', styling.borders.item.borderRadius);
      
      // Transitions
      el.style.setProperty('--pdf-transition-all', styling.transitions.all);
      el.style.setProperty('--pdf-transition-colors', styling.transitions.colors);
      el.style.setProperty('--pdf-transition-transform', styling.transitions.transform);
    }
  }, [colors, styling]);

  return (
    <div ref={wrapperRef} className={`space-y-8 ${styles.wrapper} ${styles.theme}`}> 
      <header className="space-y-2">
        <h1 className={styles.heading}>PDF Toolkit</h1>
        <p className={styles.sub}>Fast local PDF operations. Files never leave your device.</p>
      </header>

      {!operation && (
        <section className="grid md:grid-cols-3 gap-6">
          {[
            { key: 'merge', title: 'Merge PDF', desc: 'Combine multiple PDFs in order (min 2 files).', icon: <Wand2 size={20}/> },
            { key: 'split', title: 'Split PDF', desc: 'Split a PDF into individual pages or ranges.', icon: <Scissors size={20}/> },
            { key: 'compress', title: 'Compress PDF', desc: 'Reduce file size with optimizations.', icon: <Wand2 size={20}/> },
            { key: 'images-to-pdf', title: 'Images → PDF', desc: 'Turn images into a single PDF.', icon: <Images size={20}/> },
            { key: 'pdf-to-images', title: 'PDF → Images', desc: 'Extract PDF pages as images.', icon: <Images size={20}/> },
            { key: 'rotate', title: 'Rotate PDF', desc: 'Rotate all pages by 90, 180, or 270 degrees.', icon: <RotateCw size={20}/> },
            { key: 'remove-pages', title: 'Remove Pages', desc: 'Delete specific pages from PDF.', icon: <Trash2 size={20}/> },
            { key: 'page-numbers', title: 'Page Numbers', desc: 'Add page numbers to PDF.', icon: <Hash size={20}/> },
            { key: 'watermark', title: 'Watermark', desc: 'Add watermark text to all pages.', icon: <Droplet size={20}/> },
            { key: 'pdf-to-word', title: 'PDF → Word', desc: 'Convert PDF to editable Word document.', icon: <FileType2 size={20}/> },
            { key: 'ocr-image', title: 'OCR Image → PDF', desc: 'Convert image to searchable PDF with OCR.', icon: <FileText size={20}/> },
            { key: 'ocr-pdf', title: 'OCR Scanned PDF', desc: 'Make scanned PDF searchable with OCR.', icon: <FileText size={20}/> },
            { key: 'extract-text', title: 'Extract Text (OCR)', desc: 'Extract text from image using OCR.', icon: <FileText size={20}/> }
          ].map(card => (
            <button key={card.key}
              onClick={() => { setOperation(card.key as Operation); clearAll(); }}
              className={`text-left p-5 flex flex-col gap-3 ${styles.operationCard}`}
            >
              <div className={`w-10 h-10 flex items-center justify-center ${styles.operationCardIcon}`}>
                {card.icon}
              </div>
              <div>
                <h3 className={`mb-1 ${styles.operationCardTitle}`}>{card.title}</h3>
                <p className={`leading-snug ${styles.operationCardDesc}`}>{card.desc}</p>
              </div>
            </button>
          ))}
        </section>
      )}
      {operation && (
        <section className="flex flex-wrap gap-4 items-center">
          <button onClick={() => { setOperation(null); clearAll(); }} className={styles.modeBtn}>Back</button>
          <span className="text-sm font-medium">Current: {operation}</span>
          
          {/* Undo/Redo buttons */}
          <div className={styles.historyButtons}>
            <button 
              onClick={handleUndo} 
              disabled={!stateHistory.canUndo}
              className={styles.undoBtn}
              title={stateHistory.getUndoOperation() || 'Undo'}
            >
              <Undo2 size={16} />
              <span>Undo</span>
            </button>
            <button 
              onClick={handleRedo} 
              disabled={!stateHistory.canRedo}
              className={styles.redoBtn}
              title={stateHistory.getRedoOperation() || 'Redo'}
            >
              <Redo2 size={16} />
              <span>Redo</span>
            </button>
          </div>
        </section>
      )}

  {operation && <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`group relative text-center hover:shadow-md ${styles.dropZone} ${
          isDragging ? (dragValid ? styles.dragOver : styles.dragReject) : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={operation === 'images-to-pdf' || operation === 'ocr-image' || operation === 'extract-text' ? 'image/*' : '.pdf,application/pdf'}
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={styles.dropIconWrap}>
            <Upload size={28} />
          </div>
          <p className="text-sm">
            <strong>Click to choose</strong> or drag & drop {
              operation === 'images-to-pdf' || operation === 'ocr-image' || operation === 'extract-text' 
                ? 'images' 
                : 'PDF files'
            } here
          </p>
          <span className={styles.smallNote}>
            Accepted: {
              operation === 'images-to-pdf' || operation === 'ocr-image' || operation === 'extract-text'
                ? 'PNG, JPG, JPEG, WebP, GIF' 
                : 'PDF files only'
            }
          </span>
          <span className={styles.smallNote}>Order matters for the output</span>
        </div>
        {isDragging && (
          <div className={styles.dropZoneHint}>
            {dragValid ? '✓ Drop files here' : '✗ Invalid file type'}
          </div>
        )}
      </div>}

      {error && (
        <div className={`p-3 rounded-md flex items-start gap-2 text-sm ${styles.errorBox}`}>
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="p-3 rounded-md flex items-start gap-2 text-sm bg-green-50 text-green-800 border border-green-200">
          <AlertCircle size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

  {operation && !!files.length && (
        <div className="space-y-4">
          {/* Split mode selection */}
          {operation === 'split' && totalPages > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Split Options</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitMode"
                    value="all"
                    checked={splitMode === 'all'}
                    onChange={(e) => setSplitMode(e.target.value as 'all' | 'ranges')}
                    className="text-sm"
                  />
                  <span className="text-sm">Split into individual pages ({totalPages} pages)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitMode"
                    value="ranges"
                    checked={splitMode === 'ranges'}
                    onChange={(e) => setSplitMode(e.target.value as 'all' | 'ranges')}
                    className="text-sm"
                  />
                  <span className="text-sm">Split by page ranges</span>
                </label>
              </div>
              
              {splitMode === 'ranges' && (
                <div className="space-y-2">
                  <label htmlFor="pageRanges" className="block text-sm font-medium">
                    Page Ranges
                  </label>
                  <input
                    id="pageRanges"
                    type="text"
                    value={pageRanges}
                    onChange={(e) => setPageRanges(e.target.value)}
                    placeholder="e.g., 1-5,7,9-12"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-600">
                    Enter page ranges separated by commas. Examples: "1-5" (pages 1 to 5), "1,3,5" (individual pages), "1-3,8-10" (multiple ranges)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rotation angle selection */}
          {operation === 'rotate' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Rotation Angle</h3>
              <div className="space-y-2">
                {[
                  { angle: 90, name: '90° Clockwise', desc: 'Rotate right by 90 degrees' },
                  { angle: 180, name: '180°', desc: 'Flip upside down' },
                  { angle: 270, name: '270° Clockwise (90° Counter)', desc: 'Rotate left by 90 degrees' }
                ].map((option) => (
                  <label key={option.angle} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="rotationAngle"
                      value={option.angle}
                      checked={rotationAngle === option.angle}
                      onChange={(e) => setRotationAngle(Number(e.target.value) as 90 | 180 | 270)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{option.name}</div>
                      <div className="text-xs text-gray-600">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Remove pages options */}
          {operation === 'remove-pages' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Pages to Remove</h3>
              <div className="space-y-2">
                <label htmlFor="pagesToRemove" className="block text-sm font-medium">
                  Enter page numbers
                </label>
                <input
                  id="pagesToRemove"
                  type="text"
                  value={pagesToRemove}
                  onChange={(e) => setPagesToRemove(e.target.value)}
                  placeholder="e.g., 1,3,5 or 2-4,7-9"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-600">
                  Enter individual pages (1,3,5) or ranges (2-4) separated by commas
                </p>
              </div>
            </div>
          )}

          {/* Page numbers options */}
          {operation === 'page-numbers' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Page Number Options</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Position:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'top-left', name: 'Top Left' },
                      { key: 'top-center', name: 'Top Center' },
                      { key: 'top-right', name: 'Top Right' },
                      { key: 'bottom-left', name: 'Bottom Left' },
                      { key: 'bottom-center', name: 'Bottom Center' },
                      { key: 'bottom-right', name: 'Bottom Right' }
                    ].map((pos) => (
                      <label key={pos.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="pageNumberPosition"
                          value={pos.key}
                          checked={pageNumberPosition === pos.key}
                          onChange={(e) => setPageNumberPosition(e.target.value as typeof pageNumberPosition)}
                        />
                        <span>{pos.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="pageNumberSize" className="block text-sm font-medium mb-1">
                    Font Size: {pageNumberSize}pt
                  </label>
                  <input
                    id="pageNumberSize"
                    type="range"
                    min="8"
                    max="24"
                    value={pageNumberSize}
                    onChange={(e) => setPageNumberSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="pageNumberStart" className="block text-sm font-medium mb-1">
                    Start Number:
                  </label>
                  <input
                    id="pageNumberStart"
                    type="number"
                    min="1"
                    value={pageNumberStart}
                    onChange={(e) => setPageNumberStart(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Watermark options */}
          {operation === 'watermark' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Watermark Options</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="watermarkText" className="block text-sm font-medium mb-1">
                    Watermark Text:
                  </label>
                  <input
                    id="watermarkText"
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Enter watermark text"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="watermarkSize" className="block text-sm font-medium mb-1">
                    Font Size: {watermarkSize}pt
                  </label>
                  <input
                    id="watermarkSize"
                    type="range"
                    min="20"
                    max="100"
                    value={watermarkSize}
                    onChange={(e) => setWatermarkSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="watermarkOpacity" className="block text-sm font-medium mb-1">
                    Opacity: {(watermarkOpacity * 100).toFixed(0)}%
                  </label>
                  <input
                    id="watermarkOpacity"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="watermarkRotation" className="block text-sm font-medium mb-1">
                    Rotation: {watermarkRotation}°
                  </label>
                  <input
                    id="watermarkRotation"
                    type="range"
                    min="0"
                    max="90"
                    value={watermarkRotation}
                    onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Compression level selection */}
          {operation === 'compress' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Compression Level</h3>
              <div className="space-y-2">
                {(['low', 'medium', 'high'] as CompressionLevel[]).map((level) => {
                  const info = getPdfCompressionInfo(level);
                  return (
                    <label key={level} className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="compressionLevel"
                        value={level}
                        checked={compressionLevel === level}
                        onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{info.name}</div>
                        <div className="text-xs text-gray-600">{info.description}</div>
                        <div className="text-xs text-green-600">Est. reduction: {info.estimatedReduction}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image to PDF options */}
          {operation === 'images-to-pdf' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Layout Options</h3>
              
              {/* Layout Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Image Layout:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'fit', name: 'Fit', desc: 'Fit image within page (maintain aspect)' },
                    { key: 'fill', name: 'Fill', desc: 'Fill page (may crop, maintain aspect)' },
                    { key: 'stretch', name: 'Stretch', desc: 'Stretch to fill page (may distort)' },
                    { key: 'center', name: 'Center', desc: 'Center at original size' }
                  ].map((mode) => (
                    <label key={mode.key} className="flex items-start gap-2 p-2 border border-[#6b9080] rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="layoutMode"
                        value={mode.key}
                        checked={imageLayoutMode === mode.key}
                        onChange={(e) => setImageLayoutMode(e.target.value as ImageLayoutMode)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{mode.name}</div>
                        <div className="text-xs text-gray-600">{mode.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Orientation */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Page Orientation:</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="orientation"
                      value="portrait"
                      checked={pageOrientation === 'portrait'}
                      onChange={(e) => setPageOrientation(e.target.value as PageOrientation)}
                    />
                    <span className="text-sm">Portrait</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="orientation"
                      value="landscape"
                      checked={pageOrientation === 'landscape'}
                      onChange={(e) => setPageOrientation(e.target.value as PageOrientation)}
                    />
                    <span className="text-sm">Landscape</span>
                  </label>
                </div>
              </div>
              
              {/* Page Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Page Size:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'a4', name: 'A4' },
                    { key: 'letter', name: 'Letter' },
                    { key: 'legal', name: 'Legal' },
                    { key: 'a3', name: 'A3' }
                  ].map((size) => (
                    <label key={size.key} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pageSize"
                        value={size.key}
                        checked={pageSize === size.key}
                        onChange={(e) => setPageSize(e.target.value as PageSize)}
                      />
                      <span className="text-sm">{size.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {files.map((lf, idx) => (
              <li key={lf.id}
                  className={`flex items-center group ${styles.fileItem}`}>
                <div className={styles.fileIconBox}>
                  <FileIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`truncate ${styles.operationCardTitle}`} title={lf.file.name}>{lf.file.name}</p>
                  <p className={styles.operationCardDesc}>{(lf.file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePreviewFile(lf.file)}
                    className={styles.previewBtn}
                    title="Preview file"
                    disabled={loadingPreview}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    disabled={idx === 0}
                    onClick={() => moveFile(lf.id, -1)}
                    className={`p-1 disabled:opacity-30 ${styles.iconBtn}`}
                    title="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    disabled={idx === files.length - 1}
                    onClick={() => moveFile(lf.id, 1)}
                    className={`p-1 disabled:opacity-30 ${styles.iconBtn}`}
                    title="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    onClick={() => removeFile(lf.id)}
                    className={`p-1 ${styles.iconBtn}`}
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={process}
              disabled={processing || (operation === 'merge' && files.length < 2)}
              className={`px-4 py-2 disabled:opacity-50 flex items-center gap-2 ${styles.primaryBtn}`}
            >
              <FileSymlink size={16} className={processing ? 'animate-pulse' : ''} />
              {processing ? 'Processing...' : 
                operation === 'merge' ? 'Merge PDFs' :
                operation === 'split' ? (splitMode === 'all' ? 'Split into Pages' : 'Split by Ranges') :
                operation === 'compress' ? 'Compress PDF' :
                operation === 'ocr-image' ? 'Convert with OCR' :
                operation === 'ocr-pdf' ? 'Apply OCR to PDF' :
                operation === 'extract-text' ? 'Extract Text (OCR)' :
                'Generate PDF'}
            </button>
            <button
              onClick={clearAll}
              disabled={processing}
              className={`px-4 py-2 disabled:opacity-50 ${styles.outlineBtn}`}
            >
              Clear
            </button>
            {resultUrl && (
              <a
                href={resultUrl}
                download={(() => {
                  const baseFilename = 
                    operation === 'merge' ? 'merged.pdf' :
                    operation === 'split' ? (splitMode === 'all' ? 'split-pages.zip' : 
                      pageRanges.split(',').length === 1 ? `pages-${pageRanges}.pdf` : 'split-ranges.zip') :
                    operation === 'compress' ? `compressed-${compressionLevel}.pdf` :
                    operation === 'rotate' ? `rotated-${rotationAngle}.pdf` :
                    operation === 'remove-pages' ? 'pages-removed.pdf' :
                    operation === 'page-numbers' ? 'with-page-numbers.pdf' :
                    operation === 'watermark' ? 'with-watermark.pdf' :
                    operation === 'ocr-image' ? 'searchable.pdf' :
                    operation === 'ocr-pdf' ? 'searchable-pdf.pdf' :
                    operation === 'pdf-to-word' ? 'converted.docx' :
                    operation === 'pdf-to-images' ? 'extracted-images.zip' :
                    operation === 'images-to-pdf' ? 'images-to-pdf.pdf' :
                    'output.pdf';
                  
                  const uniqueFilename = generateUniqueFilename(baseFilename, downloadedFilenames.current);
                  downloadedFilenames.current.push(uniqueFilename);
                  return uniqueFilename;
                })()}
                className={`px-4 py-2 flex items-center gap-2 ${styles.primaryBtn}`}
              >
                <Download size={16} /> Download
              </a>
            )}
          </div>
          
          {/* Compression Results */}
          {operation === 'compress' && compressionResults && (
            <p className={styles.operationCardDesc}>
              New size: {formatFileSize(compressionResults.compressedSize)}
            </p>
          )}
          
          {/* OCR Progress */}
          {ocrProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{ocrProgress.status}</span>
                <span>{Math.round(ocrProgress.progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress.progress * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Extracted Text Display */}
          {operation === 'extract-text' && extractedText && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Extracted Text:</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">{extractedText}</pre>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(extractedText);
                  setSuccess('Text copied to clipboard!');
                  setTimeout(() => setSuccess(null), 3000);
                }}
                className={`px-4 py-2 ${styles.outlineBtn}`}
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}

      {operation && !files.length && (
        <p className={styles.formText}>No files added yet.</p>
      )}
      
      {operation === 'merge' && files.length === 1 && (
        <p className={styles.formText}>Add at least one more PDF file to merge.</p>
      )}
      
      {/* File Preview Modal */}
      <FilePreviewModal 
        preview={previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>
  );
};

export default ToolsPage;
