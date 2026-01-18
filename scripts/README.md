# Quick File Converter - CLI Tools
# Command-line utilities for file conversion

This directory contains CLI tools for batch processing files.

## PDF to Word Converter

Convert PDF files to Word documents (.docx) from the command line.

### Usage

**PowerShell (Recommended):**
```powershell
.\scripts\Convert-PdfToWord.ps1 input.pdf
.\scripts\Convert-PdfToWord.ps1 input.pdf output.docx
.\scripts\Convert-PdfToWord.ps1 "C:\path\to\document.pdf"
```

**Node.js:**
```bash
node scripts/pdf-to-word.mjs input.pdf
node scripts/pdf-to-word.mjs input.pdf output.docx
```

### Examples

```powershell
# Convert a single PDF (output will be same name with .docx extension)
.\scripts\Convert-PdfToWord.ps1 report.pdf

# Specify output filename
.\scripts\Convert-PdfToWord.ps1 report.pdf converted-report.docx

# Convert file from another directory
.\scripts\Convert-PdfToWord.ps1 "D:\Documents\file.pdf"

# Batch convert multiple PDFs
Get-ChildItem *.pdf | ForEach-Object {
    .\scripts\Convert-PdfToWord.ps1 $_.FullName
}
```

### Features

- Preserves text content and layout
- Extracts text from each page
- Page separators for multi-page PDFs
- Maintains line breaks and paragraphs
- No external dependencies (uses app's built-in functions)

### Notes

- Font warnings are normal and can be ignored
- Complex PDFs with images work but images are not extracted (text only)
- For best results, use PDFs with selectable text (not scanned images)
