import React, { useCallback, useEffect, useRef, useState } from 'react';
import styling from '../../../styling.json';
import { Upload, File as FileIcon, X, ArrowUp, ArrowDown, Wand2, FileSymlink, Download, AlertCircle, Scissors, FileSpreadsheet, Filter, SortAsc, Lock, FileDown, Trash2 } from 'lucide-react';
import styles from './pdfTools.module.css';
import { 
  mergeExcelFiles,
  splitExcelFile,
  compressExcelFile,
  convertExcelToPdf,
  convertExcelToCsv,
  removeSheetsFromExcel,
  getExcelSheetNames,
  protectExcelFile,
  sortExcelByColumn,
  filterExcelByColumn,
  getCompressionInfo,
  formatFileSize,
  CompressionLevel
} from '../../lib/excelTools';
import { sanitizePassword, sanitizeColumnValue, sanitizeNumber, validateBatchFileSize, FILE_SIZE_LIMITS } from '../../lib/sanitize';
import { generateUniqueFilename } from '../../lib/fileNameUtils';

type ExcelOperation = 'excel-merge' | 'excel-split' | 'excel-compress' | 'excel-to-pdf' | 'excel-to-csv' | 'excel-remove-sheets' | 'excel-protect' | 'excel-sort' | 'excel-filter';

interface LocalFile {
  id: string;
  file: File;
}

const ExcelToolsPage: React.FC = () => {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [operation, setOperation] = useState<ExcelOperation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [compressionResults, setCompressionResults] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    optimizationsApplied: string[];
  } | null>(null);
  
  // Excel-specific state
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [sheetsToRemove, setSheetsToRemove] = useState<number[]>([]);
  const [excelPassword, setExcelPassword] = useState<string>('');
  const [sortColumnIndex, setSortColumnIndex] = useState<number>(1);
  const [sortAscending, setSortAscending] = useState<boolean>(true);
  const [filterColumnIndex, setFilterColumnIndex] = useState<number>(1);
  const [filterValue, setFilterValue] = useState<string>('');
  
  // Track downloaded filenames to prevent duplicates
  const downloadedFilenames = useRef<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
  const colors = styling.colors;

  const isExcel = (f: File) => 
    f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
    f.type === 'application/vnd.ms-excel' ||
    f.name.toLowerCase().endsWith('.xlsx') ||
    f.name.toLowerCase().endsWith('.xls');

  const validateFiles = useCallback((incoming: File[]): boolean => {
    if (!incoming.length) return false;
    return incoming.every(isExcel);
  }, []);

  const onFiles = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (!validateFiles(arr)) {
      setError('All files must be Excel files (.xlsx, .xls).');
      return;
    }
    
    // Validate file sizes
    const sizeValidation = validateBatchFileSize(
      arr, 
      FILE_SIZE_LIMITS.EXCEL * arr.length, 
      FILE_SIZE_LIMITS.EXCEL, 
      'Excel'
    );
    if (!sizeValidation.valid) {
      setError(sizeValidation.error || 'File size validation failed.');
      return;
    }
    
    setError(null);
    setResultUrl(null);
    setFiles(prev => ([...prev, ...arr.map(f => ({ id: crypto.randomUUID(), file: f }))]));
    
    // Get sheet names for Excel operations
    if (arr.length === 1 && isExcel(arr[0])) {
      try {
        const names = await getExcelSheetNames(arr[0]);
        setSheetNames(names);
      } catch (err) {
        console.error('Failed to get sheet names:', err);
        setSheetNames([]);
      }
    }
  }, [validateFiles]);

  const onDrop: React.DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  };
  const onDragOver: React.DragEventHandler<HTMLDivElement> = e => { e.preventDefault(); };

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
    setFiles([]); 
    setResultUrl(null); 
    setError(null); 
    setCompressionLevel('medium');
    setCompressionResults(null);
    setSheetNames([]);
    setSelectedSheetIndex(0);
    setSheetsToRemove([]);
    setExcelPassword('');
    setSortColumnIndex(1);
    setSortAscending(true);
    setFilterColumnIndex(1);
    setFilterValue('');
  };

  const process = async () => {
    if (!files.length) { setError('Add at least one file.'); return; }
    if (!validateFiles(files.map(f => f.file) as File[])) return;
    setProcessing(true); setError(null); setResultUrl(null);
    try {
      let url: string | null = null;
      const fileList = files.map(f => f.file);
      
      switch (operation) {
        case 'excel-merge': {
          if (fileList.length < 2) {
            setError('Please select at least two Excel files to merge.');
            return;
          }
          const blob = await mergeExcelFiles(fileList);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-split': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file to split.');
            return;
          }
          const sheets = await splitExcelFile(fileList[0]);
          
          if (sheets.length === 1) {
            url = URL.createObjectURL(sheets[0].blob);
          } else {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            
            for (const sheet of sheets) {
              zip.file(`${sheet.sheetName}.xlsx`, sheet.blob);
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            url = URL.createObjectURL(zipBlob);
          }
          break;
        }
        case 'excel-compress': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file to compress.');
            return;
          }
          const result = await compressExcelFile(fileList[0], compressionLevel);
          setCompressionResults({
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            optimizationsApplied: result.optimizationsApplied
          });
          url = URL.createObjectURL(result.blob);
          break;
        }
        case 'excel-to-pdf': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file to convert.');
            return;
          }
          const blob = await convertExcelToPdf(fileList[0]);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-to-csv': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file to convert.');
            return;
          }
          const blob = await convertExcelToCsv(fileList[0], selectedSheetIndex);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-remove-sheets': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file.');
            return;
          }
          if (sheetsToRemove.length === 0) {
            setError('Please select at least one sheet to remove.');
            return;
          }
          const blob = await removeSheetsFromExcel(fileList[0], sheetsToRemove);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-protect': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file.');
            return;
          }
          if (!excelPassword.trim()) {
            setError('Please enter a password.');
            return;
          }
          const sanitizedPassword = sanitizePassword(excelPassword);
          if (sanitizedPassword.length < 4) {
            setError('Password must be at least 4 characters.');
            return;
          }
          const blob = await protectExcelFile(fileList[0], sanitizedPassword);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-sort': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file.');
            return;
          }
          const sanitizedColumnIndex = sanitizeNumber(sortColumnIndex, 1, 1000, 1);
          const blob = await sortExcelByColumn(fileList[0], selectedSheetIndex, sanitizedColumnIndex, sortAscending);
          url = URL.createObjectURL(blob);
          break;
        }
        case 'excel-filter': {
          if (fileList.length !== 1) {
            setError('Please select exactly one Excel file.');
            return;
          }
          if (!filterValue.trim()) {
            setError('Please enter a filter value.');
            return;
          }
          const sanitizedFilterValue = sanitizeColumnValue(filterValue);
          const sanitizedColumnIndex = sanitizeNumber(filterColumnIndex, 1, 1000, 1);
          const blob = await filterExcelByColumn(fileList[0], selectedSheetIndex, sanitizedColumnIndex, sanitizedFilterValue);
          url = URL.createObjectURL(blob);
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

  return (
    <div ref={wrapperRef} className={`space-y-8 ${styles.wrapper} ${styles.theme}`}> 
      <header className="space-y-2">
        <h1 className={styles.heading}>Excel Toolkit</h1>
        <p className={styles.sub}>Fast local Excel operations. Files never leave your device.</p>
      </header>

      {!operation && (
        <section className="grid md:grid-cols-3 gap-6">
          {[
            { key: 'excel-merge', title: 'Merge Excel', desc: 'Combine multiple Excel files into one.', icon: <Wand2 size={20}/> },
            { key: 'excel-split', title: 'Split Excel', desc: 'Split Excel sheets into separate files.', icon: <Scissors size={20}/> },
            { key: 'excel-compress', title: 'Compress Excel', desc: 'Reduce Excel file size.', icon: <FileSpreadsheet size={20}/> },
            { key: 'excel-to-pdf', title: 'Excel → PDF', desc: 'Convert Excel to PDF document.', icon: <FileDown size={20}/> },
            { key: 'excel-to-csv', title: 'Excel → CSV', desc: 'Export Excel sheet to CSV format.', icon: <FileDown size={20}/> },
            { key: 'excel-remove-sheets', title: 'Remove Sheets', desc: 'Delete specific sheets from Excel.', icon: <Trash2 size={20}/> },
            { key: 'excel-protect', title: 'Protect Excel', desc: 'Add password protection to sheets.', icon: <Lock size={20}/> },
            { key: 'excel-sort', title: 'Sort Data', desc: 'Sort Excel data by column.', icon: <SortAsc size={20}/> },
            { key: 'excel-filter', title: 'Filter Data', desc: 'Filter Excel data by criteria.', icon: <Filter size={20}/> }
          ].map(card => (
            <button key={card.key}
              onClick={() => { setOperation(card.key as ExcelOperation); clearAll(); }}
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
        <section className="flex flex-wrap gap-4">
          <button onClick={() => { setOperation(null); clearAll(); }} className={styles.modeBtn}>Back</button>
          <span className="text-sm font-medium">Current: {operation}</span>
        </section>
      )}

      {operation && <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => inputRef.current?.click()}
        className={`group relative text-center hover:shadow-md ${styles.dropZone}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={styles.dropIconWrap}>
            <Upload size={28} />
          </div>
          <p className="text-sm">
            <strong>Click to choose</strong> or drag & drop Excel files (.xlsx, .xls) here
          </p>
          <span className={styles.smallNote}>Order matters for the output</span>
        </div>
      </div>}

      {error && (
        <div className={`p-3 rounded-md flex items-start gap-2 text-sm ${styles.errorBox}`}>
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {operation && !!files.length && (
        <div className="space-y-4">
          {/* Excel Compress options */}
          {operation === 'excel-compress' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Compression Level</h3>
              <div className="space-y-2">
                {(['low', 'medium', 'high'] as CompressionLevel[]).map((level) => {
                  const info = getCompressionInfo(level);
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
          
          {operation === 'excel-to-csv' && sheetNames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Select Sheet to Export</h3>
              <select
                value={selectedSheetIndex}
                onChange={(e) => setSelectedSheetIndex(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sheetNames.map((name, index) => (
                  <option key={index} value={index}>{name}</option>
                ))}
              </select>
            </div>
          )}
          
          {operation === 'excel-remove-sheets' && sheetNames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Select Sheets to Remove</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sheetNames.map((name, index) => (
                  <label key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sheetsToRemove.includes(index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSheetsToRemove([...sheetsToRemove, index]);
                        } else {
                          setSheetsToRemove(sheetsToRemove.filter(i => i !== index));
                        }
                      }}
                    />
                    <span className="text-sm">{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {operation === 'excel-protect' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Password Protection</h3>
              <div className="space-y-2">
                <label htmlFor="excelPassword" className="block text-sm font-medium">
                  Enter Password:
                </label>
                <input
                  id="excelPassword"
                  type="password"
                  value={excelPassword}
                  onChange={(e) => setExcelPassword(e.target.value)}
                  placeholder="Enter protection password"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          
          {operation === 'excel-sort' && sheetNames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Sort Options</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="sortSheet" className="block text-sm font-medium mb-1">
                    Select Sheet:
                  </label>
                  <select
                    id="sortSheet"
                    value={selectedSheetIndex}
                    onChange={(e) => setSelectedSheetIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sheetNames.map((name, index) => (
                      <option key={index} value={index}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sortColumn" className="block text-sm font-medium mb-1">
                    Column Index (1-based):
                  </label>
                  <input
                    id="sortColumn"
                    type="number"
                    min="1"
                    value={sortColumnIndex}
                    onChange={(e) => setSortColumnIndex(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sortOrder"
                      checked={sortAscending}
                      onChange={() => setSortAscending(true)}
                    />
                    <span className="text-sm">Ascending (A-Z, 0-9)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sortOrder"
                      checked={!sortAscending}
                      onChange={() => setSortAscending(false)}
                    />
                    <span className="text-sm">Descending (Z-A, 9-0)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {operation === 'excel-filter' && sheetNames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Filter Options</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="filterSheet" className="block text-sm font-medium mb-1">
                    Select Sheet:
                  </label>
                  <select
                    id="filterSheet"
                    value={selectedSheetIndex}
                    onChange={(e) => setSelectedSheetIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sheetNames.map((name, index) => (
                      <option key={index} value={index}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filterColumn" className="block text-sm font-medium mb-1">
                    Column Index (1-based):
                  </label>
                  <input
                    id="filterColumn"
                    type="number"
                    min="1"
                    value={filterColumnIndex}
                    onChange={(e) => setFilterColumnIndex(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="filterValue" className="block text-sm font-medium mb-1">
                    Filter Value (contains):
                  </label>
                  <input
                    id="filterValue"
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Enter text to filter by"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {files.map((lf, idx) => (
              <li key={lf.id} className={`flex items-center group ${styles.fileItem}`}>
                <div className={styles.fileIconBox}>
                  <FileIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`truncate ${styles.operationCardTitle}`} title={lf.file.name}>{lf.file.name}</p>
                  <p className={styles.operationCardDesc}>{(lf.file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex items-center gap-1">
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
              disabled={processing || (operation === 'excel-merge' && files.length < 2)}
              className={`px-4 py-2 disabled:opacity-50 flex items-center gap-2 ${styles.primaryBtn}`}
            >
              <FileSymlink size={16} className={processing ? 'animate-pulse' : ''} />
              {processing ? 'Processing...' : 
                operation === 'excel-merge' ? 'Merge Excel Files' :
                operation === 'excel-split' ? 'Split Excel Sheets' :
                operation === 'excel-compress' ? 'Compress Excel' :
                operation === 'excel-to-pdf' ? 'Convert to PDF' :
                operation === 'excel-to-csv' ? 'Export to CSV' :
                operation === 'excel-remove-sheets' ? 'Remove Sheets' :
                operation === 'excel-protect' ? 'Protect Excel' :
                operation === 'excel-sort' ? 'Sort Data' :
                operation === 'excel-filter' ? 'Filter Data' :
                'Process'}
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
                    operation === 'excel-merge' ? 'merged.xlsx' :
                    operation === 'excel-split' ? 'split-sheets.zip' :
                    operation === 'excel-compress' ? `compressed-${compressionLevel}.xlsx` :
                    operation === 'excel-to-pdf' ? 'converted.pdf' :
                    operation === 'excel-to-csv' ? 'exported.csv' :
                    operation === 'excel-remove-sheets' ? 'sheets-removed.xlsx' :
                    operation === 'excel-protect' ? 'protected.xlsx' :
                    operation === 'excel-sort' ? 'sorted.xlsx' :
                    operation === 'excel-filter' ? 'filtered.xlsx' :
                    'output.xlsx';
                  
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
          
          {operation === 'excel-compress' && compressionResults && (
            <div className="p-3 rounded-md bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800">Compression Results:</p>
              <p className="text-sm text-green-700">
                Original: {formatFileSize(compressionResults.originalSize)} → 
                Compressed: {formatFileSize(compressionResults.compressedSize)} 
                ({compressionResults.compressionRatio.toFixed(1)}% reduction)
              </p>
            </div>
          )}
        </div>
      )}

      {operation && !files.length && (
        <p className={styles.formText}>No files added yet.</p>
      )}
      
      {operation === 'excel-merge' && files.length === 1 && (
        <p className={styles.formText}>Add at least one more Excel file to merge.</p>
      )}
    </div>
  );
};

export default ExcelToolsPage;
