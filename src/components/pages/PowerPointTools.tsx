import React, { useCallback, useEffect, useRef, useState } from 'react';
import styling from '../../../styling.json';
import { Upload, File as FileIcon, X, ArrowUp, ArrowDown, FileDown, Scissors, Lock, Unlock, Droplet, Image as ImageIcon, Wrench, Layers, ArrowDownToLine } from 'lucide-react';
import styles from './pdfTools.module.css';
import { 
  convertPptToPdf,
  mergePptFiles,
  splitPptFile,
  compressPptFile,
  convertImagesToPpt,
  protectPptFile,
  unlockPptFile,
  addWatermarkToPpt,
  extractSlidesAsImages,
  getPptSlideCount,
  repairPptFile,
  getCompressionInfo,
  formatFileSize,
  CompressionLevel
} from '../../lib/powerPointTools';
import { sanitizePassword, sanitizeText, sanitizeNumber, validateBatchFileSize, FILE_SIZE_LIMITS } from '../../lib/sanitize';
import { generateUniqueFilename } from '../../lib/fileNameUtils';

type PptOperation = 
  | 'ppt-to-pdf' 
  | 'ppt-merge' 
  | 'ppt-split' 
  | 'ppt-compress' 
  | 'image-to-ppt' 
  | 'ppt-protect' 
  | 'ppt-unlock' 
  | 'ppt-watermark'
  | 'ppt-extract-images'
  | 'ppt-repair';

interface LocalFile {
  id: string;
  file: File;
}

const PowerPointToolsPage: React.FC = () => {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [operation, setOperation] = useState<PptOperation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [compressionResults, setCompressionResults] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    optimizationsApplied: string[];
  } | null>(null);
  
  const [slideCount, setSlideCount] = useState<number>(0);
  const [slideIndices, setSlideIndices] = useState<string>('');
  const [pptPassword, setPptPassword] = useState<string>('');
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [imageLayout, setImageLayout] = useState<'fit' | 'fill' | 'one-per-slide'>('one-per-slide');
  
  const downloadedFilenames = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const colors = styling.colors;

  useEffect(() => {
    if (wrapperRef.current) {
      const el = wrapperRef.current;
      el.style.setProperty('--pdf-bg-item', colors.background.itemBackground);
      el.style.setProperty('--pdf-bg-hover', colors.background.hover);
      el.style.setProperty('--pdf-bg-item-hover', colors.background.itemHover);
      el.style.setProperty('--pdf-bg-button', colors.background.buttonBackground);
      el.style.setProperty('--pdf-bg-button-hover', colors.background.buttonHover);
      el.style.setProperty('--pdf-bg-transparent', colors.background.transparent);
      el.style.setProperty('--pdf-border-primary', colors.border.primary);
      el.style.setProperty('--pdf-text-primary', colors.text.primary);
      el.style.setProperty('--pdf-text-opacity', '0.75');
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
      el.style.setProperty('--pdf-button-height', styling.dimensions.button.height);
      el.style.setProperty('--pdf-button-width', styling.dimensions.button.width);
      el.style.setProperty('--pdf-item-height', styling.dimensions.item.height);
      el.style.setProperty('--pdf-container-padding', styling.spacing.container.padding);
      el.style.setProperty('--pdf-item-padding-left', styling.spacing.item.paddingLeft);
      el.style.setProperty('--pdf-item-padding-right', styling.spacing.item.paddingRight);
      el.style.setProperty('--pdf-item-gap', styling.spacing.item.gap);
      el.style.setProperty('--pdf-button-border-width', styling.borders.button.borderWidth);
      el.style.setProperty('--pdf-button-border-radius', styling.borders.button.borderRadius);
      el.style.setProperty('--pdf-item-border-radius', styling.borders.item.borderRadius);
      el.style.setProperty('--pdf-transition-all', styling.transitions.all);
      el.style.setProperty('--pdf-transition-colors', styling.transitions.colors);
      el.style.setProperty('--pdf-transition-transform', styling.transitions.transform);
    }
  }, [colors, styling]);

  const isPowerPoint = (f: File) => 
    f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
    f.type === 'application/vnd.ms-powerpoint' ||
    f.name.toLowerCase().endsWith('.pptx') ||
    f.name.toLowerCase().endsWith('.ppt');

  const isImage = (f: File) =>
    f.type.startsWith('image/') ||
    f.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);

  const validateFiles = useCallback((incoming: File[]): boolean => {
    if (!incoming.length) return false;
    if (operation === 'image-to-ppt') {
      return incoming.every(isImage);
    }
    return incoming.every(isPowerPoint);
  }, [operation]);

  const onFiles = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (!validateFiles(arr)) {
      if (operation === 'image-to-ppt') {
        setError('All files must be images (JPG, PNG, GIF, BMP, WebP).');
      } else {
        setError('All files must be PowerPoint files (.pptx, .ppt).');
      }
      return;
    }
    
    const sizeValidation = validateBatchFileSize(
      arr, 
      FILE_SIZE_LIMITS.POWERPOINT * arr.length, 
      FILE_SIZE_LIMITS.POWERPOINT, 
      'PowerPoint'
    );
    if (!sizeValidation.valid) {
      setError(sizeValidation.error || 'File size validation failed.');
      return;
    }
    
    setError(null);
    setFiles(prev => ([...prev, ...arr.map(f => ({ id: crypto.randomUUID(), file: f }))]));
    
    if (arr.length === 1 && isPowerPoint(arr[0])) {
      try {
        const count = await getPptSlideCount(arr[0]);
        setSlideCount(count);
      } catch (err) {
        console.error('Failed to get slide count:', err);
      }
    }
  }, [validateFiles, operation]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setError(null);
    setCompressionResults(null);
  };

  const moveFileUp = (id: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx <= 0) return prev;
      const newArr = [...prev];
      [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
      return newArr;
    });
  };

  const moveFileDown = (id: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const newArr = [...prev];
      [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
      return newArr;
    });
  };

  const clearAll = () => {
    setFiles([]);
    setError(null);
    setCompressionResults(null);
    setSlideCount(0);
    setSlideIndices('');
    setPptPassword('');
    setWatermarkText('CONFIDENTIAL');
    setWatermarkOpacity(0.3);
  };

  const handleProcess = async () => {
    if (!operation || files.length === 0) return;
    
    setProcessing(true);
    setError(null);
    setCompressionResults(null);
    
    try {
      let blob: Blob | null = null;
      let filename = '';
      const firstFile = files[0].file;
      
      switch (operation) {
        case 'ppt-to-pdf': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          blob = await convertPptToPdf(firstFile);
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?|PPTX?)$/, '.pdf'),
            downloadedFilenames.current
          );
          break;
        }
        
        case 'ppt-merge': {
          if (files.length < 2) throw new Error('Select at least two PowerPoint files to merge.');
          blob = await mergePptFiles(files.map(f => f.file));
          filename = generateUniqueFilename('merged-presentation.pptx', downloadedFilenames.current);
          break;
        }
        
        case 'ppt-split': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          if (!slideIndices.trim()) throw new Error('Enter slide indices to extract (e.g., 1,3,5).');
          
          const indices = slideIndices
            .split(',')
            .map(s => {
              const num = parseInt(s.trim(), 10);
              return sanitizeNumber(num, 1, slideCount || 100, 1) - 1;
            })
            .filter(n => !isNaN(n) && n >= 0);
          
          if (indices.length === 0) throw new Error('Invalid slide indices.');
          
          blob = await splitPptFile(firstFile, indices);
          filename = generateUniqueFilename('split-presentation.pptx', downloadedFilenames.current);
          break;
        }
        
        case 'ppt-compress': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          const result = await compressPptFile(firstFile, compressionLevel);
          blob = result.blob;
          setCompressionResults({
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            optimizationsApplied: result.optimizationsApplied,
          });
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?)$/i, '-compressed.$1'),
            downloadedFilenames.current
          );
          break;
        }
        
        case 'image-to-ppt': {
          if (files.length === 0) throw new Error('Select at least one image.');
          blob = await convertImagesToPpt(files.map(f => f.file), imageLayout);
          filename = generateUniqueFilename('images-presentation.pptx', downloadedFilenames.current);
          break;
        }
        
        case 'ppt-protect': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          const sanitizedPassword = sanitizePassword(pptPassword);
          if (!sanitizedPassword) throw new Error('Password is required and must be at least 4 characters.');
          
          blob = await protectPptFile(firstFile, sanitizedPassword);
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?)$/i, '-protected.$1'),
            downloadedFilenames.current
          );
          break;
        }
        
        case 'ppt-unlock': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          const sanitizedPassword = sanitizePassword(pptPassword);
          if (!sanitizedPassword) throw new Error('Password is required.');
          
          blob = await unlockPptFile(firstFile, sanitizedPassword);
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?)$/i, '-unlocked.$1'),
            downloadedFilenames.current
          );
          break;
        }
        
        case 'ppt-watermark': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          const sanitizedText = sanitizeText(watermarkText, 100);
          if (!sanitizedText) throw new Error('Watermark text is required.');
          
          blob = await addWatermarkToPpt(firstFile, sanitizedText, {
            opacity: watermarkOpacity,
            fontSize: 60,
            rotation: -45,
          });
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?)$/i, '-watermarked.$1'),
            downloadedFilenames.current
          );
          break;
        }
        
        case 'ppt-extract-images': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          if (!slideIndices.trim()) throw new Error('Enter slide indices to extract (e.g., 1,3,5).');
          
          const indices = slideIndices
            .split(',')
            .map(s => {
              const num = parseInt(s.trim(), 10);
              return sanitizeNumber(num, 1, slideCount || 100, 1) - 1;
            })
            .filter(n => !isNaN(n) && n >= 0);
          
          if (indices.length === 0) throw new Error('Invalid slide indices.');
          
          const images = await extractSlidesAsImages(firstFile, indices);
          
          for (const { slideNumber, blob: imgBlob } of images) {
            const imgFilename = generateUniqueFilename(
              `slide-${slideNumber}.png`,
              downloadedFilenames.current
            );
            const url = URL.createObjectURL(imgBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = imgFilename;
            a.click();
            URL.revokeObjectURL(url);
            downloadedFilenames.current.push(imgFilename);
          }
          
          setProcessing(false);
          return;
        }
        
        case 'ppt-repair': {
          if (files.length !== 1) throw new Error('Select exactly one PowerPoint file.');
          blob = await repairPptFile(firstFile);
          filename = generateUniqueFilename(
            firstFile.name.replace(/\.(pptx?)$/i, '-repaired.$1'),
            downloadedFilenames.current
          );
          break;
        }
        
        default:
          throw new Error('Unknown operation.');
      }
      
      if (blob) {
        const url = URL.createObjectURL(blob);
        downloadedFilenames.current.push(filename);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('PowerPoint processing error:', err);
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`space-y-8 ${styles.wrapper} ${styles.theme}`}> 
      <header className="space-y-2">
        <h1 className={styles.heading}>PowerPoint Tools</h1>
        <p className={styles.sub}>Convert, merge, split, and optimize PowerPoint presentations</p>
      </header>

      {!operation && (
        <section className="grid md:grid-cols-3 gap-6">
          {[
            { key: 'ppt-to-pdf', title: 'PowerPoint to PDF', desc: 'Convert PPTX to PDF', icon: <FileDown size={20}/> },
            { key: 'ppt-merge', title: 'Merge PowerPoint', desc: 'Combine multiple presentations', icon: <Layers size={20}/> },
            { key: 'ppt-split', title: 'Split PowerPoint', desc: 'Extract specific slides', icon: <Scissors size={20}/> },
            { key: 'ppt-compress', title: 'Compress PowerPoint', desc: 'Reduce file size', icon: <ArrowDownToLine size={20}/> },
            { key: 'image-to-ppt', title: 'Images to PowerPoint', desc: 'Create presentation from images', icon: <ImageIcon size={20}/> },
            { key: 'ppt-protect', title: 'Protect PowerPoint', desc: 'Add password protection', icon: <Lock size={20}/> },
            { key: 'ppt-unlock', title: 'Unlock PowerPoint', desc: 'Remove password', icon: <Unlock size={20}/> },
            { key: 'ppt-watermark', title: 'Add Watermark', desc: 'Add text watermark', icon: <Droplet size={20}/> },
            { key: 'ppt-extract-images', title: 'Extract Slides', desc: 'Save slides as images', icon: <ImageIcon size={20}/> },
            { key: 'ppt-repair', title: 'Repair PowerPoint', desc: 'Fix corrupted files', icon: <Wrench size={20}/> }
          ].map(card => (
            <button key={card.key}
              onClick={() => { setOperation(card.key as PptOperation); clearAll(); }}
              className={`text-left p-5 flex flex-col gap-3 ${styles.operationCard}`}
            >
              <span className="flex items-center gap-2">
                {card.icon}
                <span className={styles.itemTitle}>{card.title}</span>
              </span>
              <p className={styles.itemDesc}>{card.desc}</p>
            </button>
          ))}
        </section>
      )}

      {operation && (
        <section className="space-y-6">
          <button
            onClick={() => { setOperation(null); clearAll(); }}
            className={styles.backButton}
          >
            ← Back to Operations
          </button>

          <div className={styles.uploadArea}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onFiles(e.dataTransfer.files); }}
          >
            <Upload size={40} strokeWidth={1.5} />
            <p className="text-base font-medium">Click or drag {operation === 'image-to-ppt' ? 'images' : 'PowerPoint files'} here</p>
            <p className="text-sm opacity-75">
              {operation === 'image-to-ppt' 
                ? 'JPG, PNG, GIF, BMP, or WebP' 
                : 'PPTX or PPT files (max 100MB each)'}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            style={{ display: 'none' }}
            multiple={['ppt-merge', 'image-to-ppt'].includes(operation)}
            accept={operation === 'image-to-ppt' 
              ? 'image/*' 
              : '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'}
            onChange={(e) => onFiles(e.target.files)}
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
              <div className="space-y-2">
                {files.map((lf) => (
                  <div key={lf.id} className={styles.fileItem}>
                    <FileIcon size={18} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lf.file.name}</p>
                      <p className="text-xs opacity-75">{formatFileSize(lf.file.size)}</p>
                    </div>
                    {['ppt-merge', 'image-to-ppt'].includes(operation) && (
                      <div className="flex gap-1">
                        <button onClick={() => moveFileUp(lf.id)} className={styles.iconBtn} title="Move up">
                          <ArrowUp size={16} />
                        </button>
                        <button onClick={() => moveFileDown(lf.id)} className={styles.iconBtn} title="Move down">
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    )}
                    <button onClick={() => removeFile(lf.id)} className={styles.iconBtn} title="Remove">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-4">
              {operation === 'ppt-compress' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Compression Level</label>
                  <select
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                    className={styles.select}
                  >
                    <option value="low">Low - {getCompressionInfo('low').estimatedReduction}</option>
                    <option value="medium">Medium - {getCompressionInfo('medium').estimatedReduction}</option>
                    <option value="high">High - {getCompressionInfo('high').estimatedReduction}</option>
                  </select>
                  <p className="text-xs opacity-75">{getCompressionInfo(compressionLevel).description}</p>
                </div>
              )}

              {(operation === 'ppt-split' || operation === 'ppt-extract-images') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Slide Numbers (comma-separated)</label>
                  <input
                    type="text"
                    value={slideIndices}
                    onChange={(e) => setSlideIndices(e.target.value)}
                    placeholder="e.g., 1,3,5"
                    className={styles.input}
                  />
                  {slideCount > 0 && (
                    <p className="text-xs opacity-75">Total slides: {slideCount}</p>
                  )}
                </div>
              )}

              {(operation === 'ppt-protect' || operation === 'ppt-unlock') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Password</label>
                  <input
                    type="password"
                    value={pptPassword}
                    onChange={(e) => setPptPassword(e.target.value)}
                    placeholder="Enter password"
                    className={styles.input}
                  />
                </div>
              )}

              {operation === 'ppt-watermark' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Watermark Text</label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Enter watermark text"
                      className={styles.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Opacity: {watermarkOpacity.toFixed(2)}</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.1"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {operation === 'image-to-ppt' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Layout Mode</label>
                  <select
                    value={imageLayout}
                    onChange={(e) => setImageLayout(e.target.value as any)}
                    className={styles.select}
                  >
                    <option value="one-per-slide">One image per slide</option>
                    <option value="fit">Fit to slide</option>
                    <option value="fill">Fill slide</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {compressionResults && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="text-sm font-semibold mb-2 text-green-800">Compression Results</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="opacity-75">Original:</span>
                  <span className="font-medium ml-2">{formatFileSize(compressionResults.originalSize)}</span>
                </div>
                <div>
                  <span className="opacity-75">Compressed:</span>
                  <span className="font-medium ml-2">{formatFileSize(compressionResults.compressedSize)}</span>
                </div>
                <div className="col-span-2">
                  <span className="opacity-75">Reduction:</span>
                  <span className="font-semibold ml-2 text-green-700">{compressionResults.compressionRatio.toFixed(1)}%</span>
                </div>
              </div>
              {compressionResults.optimizationsApplied.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs opacity-75 mb-1">Optimizations:</p>
                  <ul className="text-xs ml-4 list-disc">
                    {compressionResults.optimizationsApplied.map((opt, i) => (
                      <li key={i}>{opt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}

          {files.length > 0 && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className={styles.processButton}
            >
              {processing ? 'Processing...' : 'Process & Download'}
            </button>
          )}
        </section>
      )}
    </div>
  );
};

export default PowerPointToolsPage;
