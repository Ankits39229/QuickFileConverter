import { useState, useRef } from 'react';
import { 
  Upload,
  X,
  FileIcon,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Import conversion functions
import {
  convertImagesToPdf,
  convertPdfToImages,
  convertPdfToWord
} from '../../lib/pdfTools';
import {
  convertWordToPdfEnhanced,
  convertWordToTxt,
  convertWordToHtml,
  convertExcelToWord
} from '../../lib/wordTools';
import {
  convertExcelToPdf,
  convertExcelToCsv,
  convertPdfToExcel,
  convertWordToExcel
} from '../../lib/excelTools';
import {
  convertPptToPdf,
  convertImagesToPpt
} from '../../lib/powerPointTools';
import {
  convertImageToSearchablePdf
} from '../../lib/ocrTools';

interface ConversionOption {
  label: string;
  value: string;
  fileTypes: string[];
}

const HomePage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableConversions, setAvailableConversions] = useState<ConversionOption[]>([]);
  const [selectedConversion, setSelectedConversion] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File type detection and conversion mapping
  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || '';
  };

  const getConversionOptions = (fileType: string): ConversionOption[] => {
    const options: ConversionOption[] = [];
    
    // PDF conversions
    if (fileType === 'pdf') {
      options.push(
        { label: 'PDF → Word (.docx)', value: 'pdf-to-word', fileTypes: ['pdf'] },
        { label: 'PDF → Excel (.xlsx)', value: 'pdf-to-excel', fileTypes: ['pdf'] },
        { label: 'PDF → Images (.png)', value: 'pdf-to-images', fileTypes: ['pdf'] }
      );
    }
    
    // Word conversions
    if (['doc', 'docx'].includes(fileType)) {
      options.push(
        { label: 'Word → PDF', value: 'word-to-pdf', fileTypes: ['doc', 'docx'] },
        { label: 'Word → Excel (.xlsx)', value: 'word-to-excel', fileTypes: ['doc', 'docx'] },
        { label: 'Word → Text (.txt)', value: 'word-to-txt', fileTypes: ['doc', 'docx'] },
        { label: 'Word → HTML', value: 'word-to-html', fileTypes: ['doc', 'docx'] }
      );
    }
    
    // Excel conversions
    if (['xls', 'xlsx'].includes(fileType)) {
      options.push(
        { label: 'Excel → PDF', value: 'excel-to-pdf', fileTypes: ['xls', 'xlsx'] },
        { label: 'Excel → Word (.docx)', value: 'excel-to-word', fileTypes: ['xls', 'xlsx'] },
        { label: 'Excel → CSV', value: 'excel-to-csv', fileTypes: ['xls', 'xlsx'] }
      );
    }
    
    // PowerPoint conversions
    if (['ppt', 'pptx'].includes(fileType)) {
      options.push(
        { label: 'PowerPoint → PDF', value: 'ppt-to-pdf', fileTypes: ['ppt', 'pptx'] }
      );
    }
    
    // Image conversions
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'].includes(fileType)) {
      options.push(
        { label: 'Image → PDF', value: 'image-to-pdf', fileTypes: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] },
        { label: 'Image → Searchable PDF (OCR)', value: 'image-to-searchable-pdf', fileTypes: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] },
        { label: 'Image → PowerPoint', value: 'image-to-ppt', fileTypes: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] }
      );
    }
    
    return options;
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setConversionResult(null);
    const fileType = getFileType(file.name);
    const options = getConversionOptions(fileType);
    setAvailableConversions(options);
    setSelectedConversion(options[0]?.value || '');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setAvailableConversions([]);
    setSelectedConversion('');
    setConversionResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConvert = async () => {
    if (!selectedFile || !selectedConversion) return;

    setConverting(true);
    setConversionResult(null);

    try {
      let result: Blob | Blob[] | string;
      const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));

      console.log('Starting conversion:', selectedConversion, 'File:', selectedFile.name);

      switch (selectedConversion) {
        case 'pdf-to-word':
          console.log('Converting PDF to Word...');
          result = await convertPdfToWord(selectedFile);
          downloadBlob(result as Blob, `${baseName}.docx`);
          break;
        
        case 'pdf-to-excel':
          console.log('Converting PDF to Excel...');
          result = await convertPdfToExcel(selectedFile);
          downloadBlob(result as Blob, `${baseName}.xlsx`);
          break;
        
        case 'pdf-to-images':
          const images = await convertPdfToImages(selectedFile);
          images.forEach((img, idx) => {
            downloadBlob(img.blob, `${baseName}_page${idx + 1}.png`);
          });
          break;
        
        case 'word-to-pdf':
          result = await convertWordToPdfEnhanced(selectedFile);
          downloadBlob(result as Blob, `${baseName}.pdf`);
          break;
        
        case 'word-to-excel':
          result = await convertWordToExcel(selectedFile);
          downloadBlob(result as Blob, `${baseName}.xlsx`);
          break;
        
        case 'word-to-txt':
          result = await convertWordToTxt(selectedFile);
          downloadBlob(result as Blob, `${baseName}.txt`);
          break;
        
        case 'word-to-html':
          result = await convertWordToHtml(selectedFile);
          const htmlBlob = new Blob([result as string], { type: 'text/html' });
          downloadBlob(htmlBlob, `${baseName}.html`);
          break;
        
        case 'excel-to-pdf':
          result = await convertExcelToPdf(selectedFile);
          downloadBlob(result as Blob, `${baseName}.pdf`);
          break;
        
        case 'excel-to-word':
          result = await convertExcelToWord(selectedFile);
          downloadBlob(result as Blob, `${baseName}.docx`);
          break;
        
        case 'excel-to-csv':
          result = await convertExcelToCsv(selectedFile);
          downloadBlob(result as Blob, `${baseName}.csv`);
          break;
        
        case 'ppt-to-pdf':
          result = await convertPptToPdf(selectedFile);
          downloadBlob(result as Blob, `${baseName}.pdf`);
          break;
        
        case 'image-to-pdf':
          result = await convertImagesToPdf([selectedFile]);
          downloadBlob(result as Blob, `${baseName}.pdf`);
          break;
        
        case 'image-to-searchable-pdf':
          result = await convertImageToSearchablePdf(selectedFile);
          downloadBlob(result as Blob, `${baseName}_searchable.pdf`);
          break;
        
        case 'image-to-ppt':
          result = await convertImagesToPpt([selectedFile]);
          downloadBlob(result as Blob, `${baseName}.pptx`);
          break;
        
        default:
          throw new Error('Unsupported conversion type');
      }

      setConversionResult({ success: true, message: 'Conversion completed successfully!' });
    } catch (error) {
      console.error('Conversion error:', error);
      setConversionResult({ success: false, message: 'Conversion failed. Please try again.' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="home-container">
      {/* Header Section */}
      <div className="home-header">
        <h1 className="home-heading">
          Quick Conversion
        </h1>
        <p className="home-description">
          Drag and drop a file or click to select for instant conversion
        </p>
      </div>

      {/* Main Conversion Area */}
      <div className="home-section">
        {/* Drag and Drop Area */}
        <div
          className={`quick-conversion-dropzone ${isDragging ? 'dropzone-dragging' : ''} ${selectedFile ? 'dropzone-has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff"
          />

          {!selectedFile ? (
            <div className="dropzone-empty">
              <Upload size={48} strokeWidth={1.5} className="dropzone-icon" />
              <h3 className="dropzone-title">Drag & Drop File Here</h3>
              <p className="dropzone-description">or</p>
              <button className="dropzone-button">
                <FileIcon size={16} />
                Browse Files
              </button>
              <p className="dropzone-hint">
                Supported: PDF, Word, Excel, PowerPoint, Images
              </p>
            </div>
          ) : (
            <div className="dropzone-file">
              <div className="file-info">
                <FileIcon size={32} className="file-icon" />
                <div className="file-details">
                  <p className="file-name">{selectedFile.name}</p>
                  <p className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="file-remove"
                >
                  <X size={20} />
                </button>
              </div>

              {availableConversions.length > 0 && (
                <div className="conversion-options">
                  <label className="conversion-label">Convert to:</label>
                  <select
                    value={selectedConversion}
                    onChange={(e) => setSelectedConversion(e.target.value)}
                    className="conversion-select"
                  >
                    {availableConversions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {availableConversions.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConvert();
                  }}
                  disabled={converting || !selectedConversion}
                  className="convert-button"
                >
                  {converting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      Convert
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              )}

              {conversionResult && (
                <div className={`conversion-result ${conversionResult.success ? 'result-success' : 'result-error'}`}>
                  {conversionResult.success ? (
                    <CheckCircle size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{conversionResult.message}</span>
                </div>
              )}

              {availableConversions.length === 0 && (
                <div className="conversion-result result-error">
                  <AlertCircle size={16} />
                  <span>No conversions available for this file type</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
