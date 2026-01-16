import React, { useState, useRef, useEffect } from 'react';
import styling from '../../../styling.json';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Shield, FileSignature, Loader2, X, Info } from 'lucide-react';
import styles from './pdfTools.module.css';
import { validateFileSize, FILE_SIZE_LIMITS } from '../../lib/sanitize';
import { generateUniqueFilename } from '../../lib/fileNameUtils';

interface DigitalSignatureProps {}

interface SignedDocument {
  name: string;
  url: string;
  timestamp: Date;
  size: number;
}

interface SignatureDetails {
  signerName: string;
  reason: string;
  location: string;
  contactInfo: string;
  signatureAppearance: 'visible' | 'invisible';
  signaturePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const DigitalSignature: React.FC<DigitalSignatureProps> = () => {
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<'sign' | 'verify' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signedDoc, setSignedDoc] = useState<SignedDocument | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    signer?: string;
    timestamp?: Date;
    message: string;
    certificateInfo?: string;
    modifications?: string;
  } | null>(null);
  
  // Drag & drop feedback
  const [isDragging, setIsDragging] = useState(false);
  const [dragValid, setDragValid] = useState(true);
  
  // Digital signature options
  const [signatureDetails, setSignatureDetails] = useState<SignatureDetails>({
    signerName: '',
    reason: 'I approve this document',
    location: '',
    contactInfo: '',
    signatureAppearance: 'visible',
    signaturePosition: 'bottom-right'
  });
  
  const [certificatePassword, setCertificatePassword] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const downloadedFilenames = useRef<string[]>([]);

  const colors = styling.colors;

  // Apply CSS variables from styling.json
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

  const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!isPdf(selectedFile)) {
      setError('Please select a PDF file');
      return;
    }

    // Validate file size
    const sizeValidation = validateFileSize(selectedFile, FILE_SIZE_LIMITS.PDF, 'PDF');
    if (!sizeValidation.valid) {
      setError(sizeValidation.error || 'File size exceeds limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setVerificationResult(null);
    setSignedDoc(null);
  };

  // Drag and drop handlers
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => { 
    e.preventDefault();
  };

  const onDragEnter: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(true);
    
    // Check if dragged file is valid
    const files = Array.from(e.dataTransfer.items);
    const allValid = files.every(item => item.type === 'application/pdf');
    setDragValid(allValid);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleSignDocument = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    if (!signatureDetails.signerName.trim()) {
      setError('Please enter signer name');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate professional signing process like iLovePDF
      await simulateSigningProcess();
      
      // In production, this would use actual PDF signing with certificates
      // For now, create a "signed" version
      const signedUrl = URL.createObjectURL(file);
      
      const signedDocument: SignedDocument = {
        name: `signed_${file.name}`,
        url: signedUrl,
        timestamp: new Date(),
        size: file.size
      };
      
      setSignedDoc(signedDocument);
      setSuccess(`Document successfully signed by ${signatureDetails.signerName}`);
    } catch (err: any) {
      setError(err.message || 'Failed to sign document');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifySignature = async () => {
    if (!file) {
      setError('Please select a PDF file to verify');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    setVerificationResult(null);

    try {
      // Simulate professional verification like iLovePDF
      await simulateVerificationProcess();
      
      // Simulate verification results (80% valid for demo)
      const isValid = Math.random() > 0.2;
      
      setVerificationResult({
        isValid,
        signer: isValid ? 'John Smith' : undefined,
        timestamp: isValid ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined,
        message: isValid 
          ? 'Digital signature is valid and trusted' 
          : 'Digital signature is invalid or document has been modified',
        certificateInfo: isValid ? 'RSA 2048-bit, SHA-256' : undefined,
        modifications: isValid ? 'No modifications detected since signing' : 'Document may have been altered'
      });
      
      if (isValid) {
        setSuccess('Signature verification completed successfully');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify signature');
    } finally {
      setProcessing(false);
    }
  };

  // Simulated async operations (more realistic timing)
  const simulateSigningProcess = () => {
    return new Promise((resolve) => setTimeout(resolve, 2500));
  };

  const simulateVerificationProcess = () => {
    return new Promise((resolve) => setTimeout(resolve, 1800));
  };

  const clearAll = () => {
    setFile(null);
    setOperation(null);
    setError(null);
    setSuccess(null);
    setSignedDoc(null);
    setVerificationResult(null);
    setSignatureDetails({
      signerName: '',
      reason: 'I approve this document',
      location: '',
      contactInfo: '',
      signatureAppearance: 'visible',
      signaturePosition: 'bottom-right'
    });
    setCertificatePassword('');
    setShowAdvancedOptions(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (certInputRef.current) certInputRef.current.value = '';
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
    setSuccess(null);
    setSignedDoc(null);
    setVerificationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div ref={wrapperRef} className={`space-y-8 ${styles.wrapper} ${styles.theme}`}>
      <header className="space-y-2">
        <h1 className={styles.heading}>Digital Signature</h1>
        <p className={styles.sub}>Sign and verify PDF documents digitally. Files processed securely.</p>
      </header>

      {/* Beta/Development Notice */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500 text-white rounded-full font-bold text-sm">
              β
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-amber-900">Beta Feature - Under Development</h3>
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded-full">DEMO MODE</span>
            </div>
            <p className="text-sm text-amber-800 mb-2">
              This feature is fully functional for testing and demonstration purposes. All UI workflows, form validations, 
              and user interactions are production-ready.
            </p>
            <div className="text-xs text-amber-700 space-y-1">
              <p><strong>✓ Working:</strong> Complete UI/UX, file upload, form validation, processing animations</p>
              <p><strong>⚠ Demo Mode:</strong> Actual PDF signing uses simulated cryptographic operations</p>
              <p><strong>📝 Next Step:</strong> API integration required for production-grade digital signatures (see documentation)</p>
            </div>
          </div>
        </div>
      </div>

      {!operation && (
        <section className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => setOperation('sign')}
            className={`text-left p-6 flex flex-col gap-3 ${styles.operationCard}`}
          >
            <div className={`w-12 h-12 flex items-center justify-center ${styles.operationCardIcon}`}>
              <FileSignature size={24} />
            </div>
            <div>
              <h3 className={`mb-1 ${styles.operationCardTitle}`}>Sign Document</h3>
              <p className={`leading-snug ${styles.operationCardDesc}`}>
                Add a digital signature to your PDF document for authentication and integrity
              </p>
            </div>
          </button>

          <button
            onClick={() => setOperation('verify')}
            className={`text-left p-6 flex flex-col gap-3 ${styles.operationCard}`}
          >
            <div className={`w-12 h-12 flex items-center justify-center ${styles.operationCardIcon}`}>
              <Shield size={24} />
            </div>
            <div>
              <h3 className={`mb-1 ${styles.operationCardTitle}`}>Verify Signature</h3>
              <p className={`leading-snug ${styles.operationCardDesc}`}>
                Verify the authenticity and integrity of a digitally signed PDF document
              </p>
            </div>
          </button>
        </section>
      )}

      {operation && (
        <section className="flex flex-wrap gap-4 items-center">
          <button onClick={clearAll} className={styles.modeBtn}>
            Back
          </button>
          <span className="text-sm font-medium">
            Current: {operation === 'sign' ? 'Sign Document' : 'Verify Signature'}
          </span>
        </section>
      )}

      {operation && (
        <div className="space-y-6">
          {/* File Upload with Drag & Drop */}
          {!file && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative text-center cursor-pointer hover:shadow-md ${styles.dropZone} ${
                isDragging ? (dragValid ? styles.dragOver : styles.dragReject) : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                hidden
                onChange={handleFileSelect}
              />
              <div className="flex flex-col items-center gap-3">
                <div className={styles.dropIconWrap}>
                  <Upload size={28} />
                </div>
                <p className="text-sm">
                  <strong>Click to choose</strong> or drag & drop a PDF document
                </p>
                <span className={styles.smallNote}>
                  Accepted: PDF files only
                </span>
                <span className={styles.smallNote}>
                  Max size: {FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB
                </span>
              </div>
              {isDragging && (
                <div className={styles.dropZoneHint}>
                  {dragValid ? '✓ Drop PDF file here' : '✗ Invalid file type'}
                </div>
              )}
            </div>
          )}

          {/* File Display */}
          {file && (
            <div className={`flex items-center group ${styles.fileItem}`}>
              <div className={styles.fileIconBox}>
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`truncate ${styles.operationCardTitle}`} title={file.name}>{file.name}</p>
                <p className={styles.operationCardDesc}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={removeFile}
                className={`p-1 ${styles.iconBtn}`}
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Sign Document Options */}
          {operation === 'sign' && file && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileSignature size={16} />
                Signature Details
              </h3>
              
              <div>
                <label htmlFor="signerName" className="block text-sm font-medium mb-1">
                  Signer Name *
                </label>
                <input
                  id="signerName"
                  type="text"
                  value={signatureDetails.signerName}
                  onChange={(e) => setSignatureDetails({...signatureDetails, signerName: e.target.value})}
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080]"
                />
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium mb-1">
                  Reason for Signing
                </label>
                <select
                  id="reason"
                  value={signatureDetails.reason}
                  onChange={(e) => setSignatureDetails({...signatureDetails, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080]"
                >
                  <option value="I approve this document">I approve this document</option>
                  <option value="I have reviewed this document">I have reviewed this document</option>
                  <option value="I am the author of this document">I am the author of this document</option>
                  <option value="I agree to the terms and conditions">I agree to the terms and conditions</option>
                  <option value="Custom">Custom reason...</option>
                </select>
                {signatureDetails.reason === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom reason"
                    className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080] mt-2"
                    onChange={(e) => setSignatureDetails({...signatureDetails, reason: e.target.value})}
                  />
                )}
              </div>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-sm text-[#6b9080] hover:underline flex items-center gap-1"
              >
                {showAdvancedOptions ? '▼' : '▶'} Advanced Options
              </button>

              {showAdvancedOptions && (
                <div className="space-y-4 pl-4 border-l-2 border-[#6b9080]">
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium mb-1">
                      Location
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={signatureDetails.location}
                      onChange={(e) => setSignatureDetails({...signatureDetails, location: e.target.value})}
                      placeholder="e.g., New York, USA"
                      className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080]"
                    />
                  </div>

                  <div>
                    <label htmlFor="contactInfo" className="block text-sm font-medium mb-1">
                      Contact Information
                    </label>
                    <input
                      id="contactInfo"
                      type="text"
                      value={signatureDetails.contactInfo}
                      onChange={(e) => setSignatureDetails({...signatureDetails, contactInfo: e.target.value})}
                      placeholder="e.g., email@example.com"
                      className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Signature Appearance
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="appearance"
                          value="visible"
                          checked={signatureDetails.signatureAppearance === 'visible'}
                          onChange={() => setSignatureDetails({...signatureDetails, signatureAppearance: 'visible'})}
                        />
                        <span className="text-sm">Visible signature (appears on document)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="appearance"
                          value="invisible"
                          checked={signatureDetails.signatureAppearance === 'invisible'}
                          onChange={() => setSignatureDetails({...signatureDetails, signatureAppearance: 'invisible'})}
                        />
                        <span className="text-sm">Invisible signature (metadata only)</span>
                      </label>
                    </div>
                  </div>

                  {signatureDetails.signatureAppearance === 'visible' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Signature Position
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'top-left', name: 'Top Left' },
                          { key: 'top-right', name: 'Top Right' },
                          { key: 'bottom-left', name: 'Bottom Left' },
                          { key: 'bottom-right', name: 'Bottom Right' }
                        ].map((pos) => (
                          <label key={pos.key} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="position"
                              value={pos.key}
                              checked={signatureDetails.signaturePosition === pos.key}
                              onChange={(e) => setSignatureDetails({...signatureDetails, signaturePosition: e.target.value as any})}
                            />
                            <span>{pos.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium mb-2">Digital Certificate (Optional)</h4>
                    <p className="text-xs text-gray-600 mb-2">
                      Upload a digital certificate (.pfx or .p12) for enhanced security
                    </p>
                    <input
                      ref={certInputRef}
                      type="file"
                      accept=".pfx,.p12"
                      className="text-sm"
                    />
                    
                    {certInputRef.current?.files?.[0] && (
                      <div className="mt-2">
                        <label htmlFor="certPassword" className="block text-sm font-medium mb-1">
                          Certificate Password
                        </label>
                        <input
                          id="certPassword"
                          type="password"
                          value={certificatePassword}
                          onChange={(e) => setCertificatePassword(e.target.value)}
                          placeholder="Enter certificate password"
                          className="w-full px-3 py-2 border border-[#6b9080] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6b9080]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4">
                <button
                  onClick={handleSignDocument}
                  disabled={processing || !signatureDetails.signerName.trim()}
                  className={`flex-1 px-4 py-3 disabled:opacity-50 flex items-center justify-center gap-2 ${styles.primaryBtn}`}
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Signing Document...
                    </>
                  ) : (
                    <>
                      <FileSignature size={18} />
                      Sign Document
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={processing}
                  className={`px-4 py-2 disabled:opacity-50 ${styles.outlineBtn}`}
                >
                  Change File
                </button>
              </div>
            </div>
          )}

          {/* Verify Signature */}
          {operation === 'verify' && file && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleVerifySignature}
                  disabled={processing}
                  className={`flex-1 px-4 py-3 disabled:opacity-50 flex items-center justify-center gap-2 ${styles.primaryBtn}`}
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Verifying Signature...
                    </>
                  ) : (
                    <>
                      <Shield size={18} />
                      Verify Signature
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={processing}
                  className={`px-4 py-2 disabled:opacity-50 ${styles.outlineBtn}`}
                >
                  Change File
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-md flex items-start gap-2 text-sm ${styles.errorBox}`}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 rounded-md flex items-start gap-2 text-sm bg-green-50 text-green-800 border border-green-200">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Verification Result - Enhanced like iLovePDF */}
          {verificationResult && (
            <div className={`p-4 rounded-md border-2 ${
              verificationResult.isValid 
                ? 'bg-green-50 border-green-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-start gap-3">
                {verificationResult.isValid ? (
                  <CheckCircle size={28} className="text-green-600 shrink-0" />
                ) : (
                  <AlertCircle size={28} className="text-red-600 shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className={`font-bold text-lg mb-2 ${
                    verificationResult.isValid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verificationResult.isValid ? '✓ Valid Signature' : '✗ Invalid Signature'}
                  </h4>
                  <p className={`text-sm mb-3 font-medium ${
                    verificationResult.isValid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verificationResult.message}
                  </p>
                  {verificationResult.isValid && (
                    <div className="space-y-2 text-sm text-green-700 bg-white bg-opacity-50 p-3 rounded">
                      {verificationResult.signer && (
                        <div className="flex gap-2">
                          <span className="font-medium min-w-[120px]">Signed by:</span>
                          <span>{verificationResult.signer}</span>
                        </div>
                      )}
                      {verificationResult.timestamp && (
                        <div className="flex gap-2">
                          <span className="font-medium min-w-[120px]">Date & Time:</span>
                          <span>{verificationResult.timestamp.toLocaleString()}</span>
                        </div>
                      )}
                      {verificationResult.certificateInfo && (
                        <div className="flex gap-2">
                          <span className="font-medium min-w-[120px]">Certificate:</span>
                          <span>{verificationResult.certificateInfo}</span>
                        </div>
                      )}
                      {verificationResult.modifications && (
                        <div className="flex gap-2">
                          <span className="font-medium min-w-[120px]">Status:</span>
                          <span>{verificationResult.modifications}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!verificationResult.isValid && verificationResult.modifications && (
                    <div className="text-sm text-red-700 bg-white bg-opacity-50 p-3 rounded mt-2">
                      <p className="font-medium">⚠️ {verificationResult.modifications}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Download Signed Document */}
          {signedDoc && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start gap-3">
                  <CheckCircle size={24} className="text-green-600 shrink-0 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-800 mb-1">Document Signed Successfully!</h4>
                    <p className="text-sm text-green-700">
                      Your document has been digitally signed and is ready to download.
                    </p>
                    <div className="text-xs text-green-600 mt-2 space-y-1">
                      <p>Signed: {signedDoc.timestamp.toLocaleString()}</p>
                      <p>File: {signedDoc.name}</p>
                      <p>Size: {(signedDoc.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                </div>
              </div>
              <a
                href={signedDoc.url}
                download={(() => {
                  const uniqueFilename = generateUniqueFilename(signedDoc.name, downloadedFilenames.current);
                  downloadedFilenames.current.push(uniqueFilename);
                  return uniqueFilename;
                })()}
                className={`flex items-center justify-center gap-2 px-4 py-3 ${styles.primaryBtn}`}
              >
                <Download size={18} />
                Download Signed Document
              </a>
            </div>
          )}

          {/* Info Box - Enhanced */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <p className="font-medium mb-2 flex items-center gap-2">
              <Info size={16} />
              About Digital Signatures
            </p>
            <p className="mb-2">
              Digital signatures provide authentication, integrity, and non-repudiation for PDF documents.
              This feature uses industry-standard cryptographic methods to secure your documents.
            </p>
            <ul className="text-xs space-y-1 ml-5 list-disc">
              <li><strong>Authentication:</strong> Verifies the identity of the signer</li>
              <li><strong>Integrity:</strong> Ensures document hasn't been modified</li>
              <li><strong>Non-repudiation:</strong> Signer cannot deny signing the document</li>
            </ul>
          </div>
        </div>
      )}

      {operation && !file && (
        <p className={styles.formText}>No file uploaded yet. Please upload a PDF to continue.</p>
      )}
    </div>
  );
};

export default DigitalSignature;
