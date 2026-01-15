import React from 'react';
import { X, FileText, FileSpreadsheet, File } from 'lucide-react';
import { FilePreview } from '../../lib/filePreview';
import styles from '../pages/pdfTools.module.css';

interface FilePreviewModalProps {
  preview: FilePreview | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ preview, onClose }) => {
  if (!preview) return null;

  const getFileIcon = () => {
    switch (preview.type) {
      case 'pdf':
        return <File size={48} className="text-red-600" />;
      case 'excel':
        return <FileSpreadsheet size={48} className="text-green-600" />;
      case 'word':
        return <FileText size={48} className="text-blue-600" />;
      case 'image':
        return null; // Images show thumbnail
      default:
        return <File size={48} />;
    }
  };

  const renderMetadata = () => {
    if (!preview.metadata) return null;

    return (
      <div className={styles.previewMetadata}>
        {Object.entries(preview.metadata).map(([key, value]) => (
          <div key={key} className={styles.metadataItem}>
            <div className={styles.metadataLabel}>{key}</div>
            <div className={styles.metadataValue}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.previewModal} onClick={onClose}>
      <div className={styles.previewContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.previewClose} onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: '#333' }}>
          File Preview
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
          {preview.fileName} • {preview.fileSize}
        </p>

        {preview.thumbnail ? (
          <img 
            src={preview.thumbnail} 
            alt="File preview" 
            className={styles.previewThumbnail}
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: '3rem',
            background: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            {getFileIcon()}
          </div>
        )}

        {renderMetadata()}
      </div>
    </div>
  );
};
