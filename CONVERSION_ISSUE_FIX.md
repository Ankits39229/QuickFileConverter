# Word ↔ PDF Conversion Issue

## Problem
Word to PDF and PDF to Word conversions work via PowerShell CLI scripts but fail when executed within the Electron app.

## Root Cause
The current implementation in `wordTools.ts` and `pdfTools.ts` uses client-side JavaScript libraries (mammoth, pdf-lib, docx) which have limitations:

1. **Word to PDF**: The `docx` library can create DOCX files but cannot generate proper PDFs directly. It relies on browser/Node.js text rendering which lacks proper font embedding and layout.

2. **PDF to Word**: The current implementation extracts text but loses formatting, images, tables, and proper document structure.

## Why PowerShell Works
Your PowerShell scripts use Microsoft Office COM automation which has full access to Word's rendering engine for proper conversion.

## Solution Options

### Option 1: Use Electron IPC to Call PowerShell Scripts (Recommended)
Modify the conversion functions to call your existing PowerShell scripts via Electron's main process:

**In `main.js`**, add IPC handlers:
```javascript
const { ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Word to PDF conversion
ipcMain.handle('convert-word-to-pdf', async (event, { filePath, outputPath }) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/Convert-WordToPdf.ps1');
    const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -InputFile "${filePath}" -OutputFile "${outputPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

// PDF to Word conversion
ipcMain.handle('convert-pdf-to-word', async (event, { filePath, outputPath }) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/Convert-PdfToWord.ps1');
    const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -InputFile "${filePath}" -OutputFile "${outputPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});
```

**In `preload.js`**, expose the IPC methods:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertWordToPdf: (filePath, outputPath) => 
    ipcRenderer.invoke('convert-word-to-pdf', { filePath, outputPath }),
  convertPdfToWord: (filePath, outputPath) => 
    ipcRenderer.invoke('convert-pdf-to-word', { filePath, outputPath }),
});
```

**In `wordTools.ts`**, replace the conversion function:
```typescript
export async function convertWordToPdfEnhanced(file: File): Promise<Blob> {
  // Save file to temp location
  const tempDir = await (window as any).electronAPI.getTempDir();
  const inputPath = path.join(tempDir, file.name);
  const outputPath = path.join(tempDir, `${file.name}.pdf`);
  
  // Write file
  const buffer = await file.arrayBuffer();
  await (window as any).electronAPI.writeFile(inputPath, buffer);
  
  // Convert using PowerShell
  await (window as any).electronAPI.convertWordToPdf(inputPath, outputPath);
  
  // Read result
  const pdfBuffer = await (window as any).electronAPI.readFile(outputPath);
  
  // Clean up
  await (window as any).electronAPI.deleteFile(inputPath);
  await (window as any).electronAPI.deleteFile(outputPath);
  
  return new Blob([pdfBuffer], { type: 'application/pdf' });
}
```

**In `pdfTools.ts`**, do the same for PDF to Word:
```typescript
export async function convertPdfToWord(file: File): Promise<Blob> {
  const tempDir = await (window as any).electronAPI.getTempDir();
  const inputPath = path.join(tempDir, file.name);
  const outputPath = path.join(tempDir, `${file.name}.docx`);
  
  const buffer = await file.arrayBuffer();
  await (window as any).electronAPI.writeFile(inputPath, buffer);
  
  await (window as any).electronAPI.convertPdfToWord(inputPath, outputPath);
  
  const docxBuffer = await (window as any).electronAPI.readFile(outputPath);
  
  await (window as any).electronAPI.deleteFile(inputPath);
  await (window as any).electronAPI.deleteFile(outputPath);
  
  return new Blob([docxBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
}
```

### Option 2: Use LibreOffice Command Line
Install LibreOffice and use its headless conversion:

```javascript
// In main.js
ipcMain.handle('convert-word-to-pdf-libre', async (event, { inputPath, outputDir }) => {
  return new Promise((resolve, reject) => {
    const command = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ success: true });
    });
  });
});
```

### Option 3: Use Online API (Requires Internet)
Services like CloudConvert, iLovePDF, or Zamzar offer APIs but require internet connection and have usage limits.

## Recommended Implementation Steps

1. **Create PowerShell conversion scripts** (if not already exist):
   - `scripts/Convert-WordToPdf.ps1`
   - `scripts/Convert-PdfToWord.ps1`

2. **Update main.js** with IPC handlers

3. **Update preload.js** to expose conversion methods

4. **Add file system helpers** to preload.js:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', { filePath, data }),
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', { filePath }),
});
```

5. **Update wordTools.ts and pdfTools.ts** to use the new IPC methods

6. **Add error handling and progress reporting** for better UX

## Testing
After implementation, test with:
- Simple Word documents
- Complex Word documents (images, tables, formatting)
- Large PDF files
- Password-protected files
- Various file encodings

## Notes
- PowerShell requires Microsoft Office to be installed
- LibreOffice is free but quality may vary
- Consider adding a fallback to the current client-side method if Office is not available
