# Digital Signature API Integration Guide

## Overview
This guide provides instructions for integrating real digital signature functionality using iLovePDF API or alternative services.

## Current Implementation
The current implementation in `src/components/pages/DigitalSignature.tsx` is a **demo version** with simulated signing and verification. To enable real digital signatures, you need to integrate with an API service.

## Recommended API Services

### 1. iLovePDF API (Recommended)
- **Website**: https://developer.ilovepdf.com/
- **Features**: 
  - PDF digital signatures
  - Certificate-based signing
  - Signature verification
  - Multiple signature types (visible/invisible)
- **Pricing**: Free tier available + paid plans

### 2. DocuSign API
- **Website**: https://developers.docusign.com/
- **Features**: Advanced e-signature workflows
- **Pricing**: Developer sandbox + paid plans

### 3. Adobe Sign API
- **Website**: https://www.adobe.io/apis/documentcloud/sign.html
- **Features**: Enterprise-grade digital signatures
- **Pricing**: Enterprise pricing

## Integration Steps

### Step 1: Install Required Packages

```bash
npm install axios form-data
```

### Step 2: Create API Integration File

Create `src/lib/signatureApi.ts`:

```typescript
import axios from 'axios';
import FormData from 'form-data';

// iLovePDF API Configuration
const API_BASE_URL = 'https://api.ilovepdf.com/v1';
const PUBLIC_KEY = process.env.REACT_APP_ILOVEPDF_PUBLIC_KEY;
const SECRET_KEY = process.env.REACT_APP_ILOVEPDF_SECRET_KEY;

interface AuthResponse {
  token: string;
}

interface TaskResponse {
  server: string;
  task: string;
}

interface SignatureOptions {
  signerName: string;
  reason?: string;
  location?: string;
  certificate?: File;
  password?: string;
}

// Get authentication token
async function getAuthToken(): Promise<string> {
  const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth`, {
    public_key: PUBLIC_KEY
  });
  return response.data.token;
}

// Start a new task
async function startTask(token: string, tool: string): Promise<TaskResponse> {
  const response = await axios.get<TaskResponse>(`${API_BASE_URL}/start/${tool}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

// Upload file to task
async function uploadFile(
  server: string, 
  task: string, 
  token: string, 
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append('task', task);
  formData.append('file', file);

  const response = await axios.post(
    `https://${server}/v1/upload`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders()
      }
    }
  );
  
  return response.data.server_filename;
}

// Sign PDF with digital signature
export async function signPdfDocument(
  file: File,
  options: SignatureOptions
): Promise<Blob> {
  try {
    // 1. Get authentication token
    const token = await getAuthToken();
    
    // 2. Start sign task
    const taskInfo = await startTask(token, 'sign');
    
    // 3. Upload PDF file
    const serverFilename = await uploadFile(
      taskInfo.server,
      taskInfo.task,
      token,
      file
    );
    
    // 4. Process signature
    const processResponse = await axios.post(
      `https://${taskInfo.server}/v1/process`,
      {
        task: taskInfo.task,
        tool: 'sign',
        files: [{
          server_filename: serverFilename,
          filename: file.name
        }],
        signature_info: {
          name: options.signerName,
          reason: options.reason || 'Document signing',
          location: options.location || '',
          contact_info: ''
        }
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    // 5. Download signed file
    const downloadUrl = processResponse.data.download_url;
    const signedFileResponse = await axios.get(downloadUrl, {
      responseType: 'blob'
    });
    
    return signedFileResponse.data;
  } catch (error: any) {
    console.error('Digital signature error:', error);
    throw new Error(error.response?.data?.message || 'Failed to sign document');
  }
}

// Verify PDF signature
export async function verifyPdfSignature(file: File): Promise<{
  isValid: boolean;
  signer?: string;
  timestamp?: Date;
  message: string;
}> {
  try {
    // 1. Get authentication token
    const token = await getAuthToken();
    
    // 2. Start validate_pdfa task (can be used for signature validation)
    const taskInfo = await startTask(token, 'validatepdfa');
    
    // 3. Upload PDF file
    const serverFilename = await uploadFile(
      taskInfo.server,
      taskInfo.task,
      token,
      file
    );
    
    // 4. Process validation
    const processResponse = await axios.post(
      `https://${taskInfo.server}/v1/process`,
      {
        task: taskInfo.task,
        tool: 'validatepdfa',
        files: [{
          server_filename: serverFilename,
          filename: file.name
        }]
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    // Extract validation results
    const validations = processResponse.data.validations || [];
    const hasValidSignature = validations.some((v: any) => 
      v.type === 'signature' && v.valid
    );
    
    return {
      isValid: hasValidSignature,
      signer: hasValidSignature ? 'Verified Signer' : undefined,
      timestamp: hasValidSignature ? new Date() : undefined,
      message: hasValidSignature 
        ? 'Digital signature is valid and trusted'
        : 'No valid digital signature found'
    };
  } catch (error: any) {
    console.error('Signature verification error:', error);
    return {
      isValid: false,
      message: 'Failed to verify signature'
    };
  }
}
```

### Step 3: Update Environment Variables

Create/update `.env` file in your project root:

```env
REACT_APP_ILOVEPDF_PUBLIC_KEY=your_public_key_here
REACT_APP_ILOVEPDF_SECRET_KEY=your_secret_key_here
```

**Important**: Never commit API keys to version control. Add `.env` to `.gitignore`.

### Step 4: Update DigitalSignature Component

Replace the simulated functions in `src/components/pages/DigitalSignature.tsx`:

```typescript
// Import the real API functions
import { signPdfDocument, verifyPdfSignature } from '../../lib/signatureApi';

// Replace handleSignDocument function:
const handleSignDocument = async () => {
  if (!file) {
    setError('Please select a PDF file');
    return;
  }

  if (!signerName.trim()) {
    setError('Please enter signer name');
    return;
  }

  setProcessing(true);
  setError(null);
  setSuccess(null);

  try {
    const signedBlob = await signPdfDocument(file, {
      signerName,
      reason,
      location,
      certificate: certInputRef.current?.files?.[0],
      password: certificatePassword
    });
    
    const signedUrl = URL.createObjectURL(signedBlob);
    
    const signedDocument: SignedDocument = {
      name: `signed_${file.name}`,
      url: signedUrl,
      timestamp: new Date()
    };
    
    setSignedDoc(signedDocument);
    setSuccess(`Document successfully signed by ${signerName}`);
  } catch (err: any) {
    setError(err.message || 'Failed to sign document');
  } finally {
    setProcessing(false);
  }
};

// Replace handleVerifySignature function:
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
    const result = await verifyPdfSignature(file);
    setVerificationResult(result);
  } catch (err: any) {
    setError(err.message || 'Failed to verify signature');
  } finally {
    setProcessing(false);
  }
};
```

## Alternative: Node.js Backend Integration

For better security, implement API calls on the backend:

### Backend Setup (Express.js)

```javascript
// server.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Sign PDF endpoint
app.post('/api/sign-pdf', upload.single('file'), async (req, res) => {
  try {
    const { signerName, reason, location } = req.body;
    const file = req.file;
    
    // Call iLovePDF API
    // ... (authentication and signing logic)
    
    res.send(signedPdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify signature endpoint
app.post('/api/verify-signature', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    
    // Call iLovePDF API for verification
    // ... (verification logic)
    
    res.json({ isValid: true, signer: 'Verified', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));
```

### Electron IPC Integration

For Electron apps, use IPC to call backend functions:

```javascript
// main.js
const { ipcMain } = require('electron');
const { signPdfDocument, verifyPdfSignature } = require('./lib/signatureApi');

ipcMain.handle('sign-pdf', async (event, { filePath, options }) => {
  try {
    const signedPdf = await signPdfDocument(filePath, options);
    return { success: true, data: signedPdf };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('verify-signature', async (event, filePath) => {
  try {
    const result = await verifyPdfSignature(filePath);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## Testing

1. Get API credentials from iLovePDF developer portal
2. Add credentials to `.env` file
3. Test signing workflow with a sample PDF
4. Test verification with a signed PDF
5. Handle error cases (network issues, invalid PDFs, etc.)

## Security Best Practices

1. **Never expose API keys in frontend code**
2. Use environment variables or backend proxy
3. Implement rate limiting
4. Validate file types and sizes
5. Sanitize user inputs
6. Use HTTPS for all API calls
7. Implement proper error handling
8. Add logging for audit trails

## Troubleshooting

### Common Issues

1. **CORS errors**: Use backend proxy or configure CORS properly
2. **Authentication failures**: Check API key validity
3. **File upload errors**: Verify file format and size limits
4. **Network timeouts**: Implement retry logic with exponential backoff

### Error Codes

- `401`: Invalid authentication
- `403`: Insufficient permissions
- `413`: File too large
- `429`: Rate limit exceeded
- `500`: Server error

## Resources

- [iLovePDF API Documentation](https://developer.ilovepdf.com/docs)
- [PDF Digital Signatures Standard (PAdES)](https://en.wikipedia.org/wiki/PAdES)
- [X.509 Certificates](https://en.wikipedia.org/wiki/X.509)

## Support

For API-specific issues, contact:
- iLovePDF Support: support@ilovepdf.com
- Check API status: https://status.ilovepdf.com/
