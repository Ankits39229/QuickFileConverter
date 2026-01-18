// Excel processing utilities using ExcelJS
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type CompressionLevel = 'low' | 'medium' | 'high';

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Merge multiple Excel files into one workbook
export async function mergeExcelFiles(files: File[]): Promise<Blob> {
  const mergedWorkbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    // Copy each worksheet from the source workbook
    workbook.eachSheet((worksheet) => {
      const originalName = worksheet.name;
      // Create unique sheet name by prefixing with file number if needed
      let newName = files.length > 1 ? `${i + 1}_${originalName}` : originalName;
      
      // Ensure unique name even if sheets have same name
      let counter = 1;
      while (usedNames.has(newName)) {
        newName = files.length > 1 ? `${i + 1}_${originalName}_${counter}` : `${originalName}_${counter}`;
        counter++;
      }
      usedNames.add(newName);
      
      // Add worksheet to merged workbook
      const newWorksheet = mergedWorkbook.addWorksheet(newName);
      
      // Copy column definitions
      worksheet.columns.forEach((col, colIndex) => {
        if (newWorksheet.getColumn(colIndex + 1)) {
          newWorksheet.getColumn(colIndex + 1).width = col.width || 10;
        }
      });
      
      // Copy all cells with styles
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const newRow = newWorksheet.getRow(rowNumber);
        newRow.height = row.height;
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const newCell = newRow.getCell(colNumber);
          newCell.value = cell.value;
          newCell.style = cell.style;
        });
        
        newRow.commit();
      });
      
      // Copy merged cells
      if (worksheet.model.merges) {
        worksheet.model.merges.forEach(merge => {
          newWorksheet.mergeCells(merge);
        });
      }
    });
  }
  
  const buffer = await mergedWorkbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Split Excel file into separate files (one per worksheet)
export async function splitExcelFile(file: File): Promise<Array<{ sheetName: string; blob: Blob }>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  if (workbook.worksheets.length === 0) {
    throw new Error('The Excel file contains no worksheets');
  }
  
  const results: Array<{ sheetName: string; blob: Blob }> = [];
  
  for (const worksheet of workbook.worksheets) {
    const newWorkbook = new ExcelJS.Workbook();
    const newWorksheet = newWorkbook.addWorksheet(worksheet.name);
    
    // Copy column definitions
    worksheet.columns.forEach((col, colIndex) => {
      if (newWorksheet.getColumn(colIndex + 1)) {
        newWorksheet.getColumn(colIndex + 1).width = col.width || 10;
      }
    });
    
    // Copy all cells with styles
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const newRow = newWorksheet.getRow(rowNumber);
      newRow.height = row.height;
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = cell.style;
      });
      
      newRow.commit();
    });
    
    // Copy merged cells
    if (worksheet.model.merges) {
      worksheet.model.merges.forEach(merge => {
        newWorksheet.mergeCells(merge);
      });
    }
    
    const buffer = await newWorkbook.xlsx.writeBuffer();
    results.push({
      sheetName: worksheet.name,
      blob: new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
    });
  }
  
  return results;
}

// Compress Excel file by removing styles and optimizing
export async function compressExcelFile(
  file: File, 
  level: CompressionLevel = 'medium'
): Promise<{
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  optimizationsApplied: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  if (workbook.worksheets.length === 0) {
    throw new Error('The Excel file contains no worksheets');
  }
  
  const optimizationsApplied: string[] = [];
  
  workbook.eachSheet((worksheet) => {
    if (level === 'medium' || level === 'high') {
      // Remove excessive formatting
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (level === 'high') {
            // Remove all styling in high compression
            cell.style = {};
            optimizationsApplied.push('Removed all cell styling');
          } else if (level === 'medium') {
            // Keep essential styling only
            const essentialStyle: any = {};
            if (cell.style.numFmt) essentialStyle.numFmt = cell.style.numFmt;
            if (cell.style.font?.bold) essentialStyle.font = { bold: true };
            cell.style = essentialStyle;
            optimizationsApplied.push('Simplified cell styling');
          }
        });
      });
    }
    
    if (level === 'high') {
      // Remove empty rows and columns
      const lastRow = worksheet.lastRow?.number || 0;
      
      // Trim empty trailing rows
      for (let i = lastRow; i >= 1; i--) {
        const row = worksheet.getRow(i);
        const rowValues = row.values as any[];
        const isEmpty = Array.isArray(rowValues) && rowValues.every((val: any) => !val);
        if (isEmpty) {
          worksheet.spliceRows(i, 1);
        } else {
          break;
        }
      }
      optimizationsApplied.push('Removed empty rows');
    }
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  const compressedBlob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  return {
    blob: compressedBlob,
    originalSize: arrayBuffer.byteLength,
    compressedSize: buffer.byteLength,
    compressionRatio: (1 - buffer.byteLength / arrayBuffer.byteLength) * 100,
    optimizationsApplied: [...new Set(optimizationsApplied)]
  };
}

// Convert Excel to PDF
export async function convertExcelToPdf(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  for (const worksheet of workbook.worksheets) {
    const page = pdfDoc.addPage([842, 595]); // A4 landscape
    const { height } = page.getSize();
    
    // Add sheet name as title
    page.drawText(worksheet.name, {
      x: 50,
      y: height - 50,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0)
    });
    
    let yPosition = height - 80;
    const cellWidth = 100;
    const cellHeight = 20;
    const startX = 50;
    
    // Render visible rows (limit to prevent huge PDFs)
    const maxRows = 25;
    let rowCount = 0;
    
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (rowCount >= maxRows) return;
      
      let xPosition = startX;
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 7) return; // Limit columns
        
        const cellValue = cell.value?.toString() || '';
        const displayValue = cellValue.length > 15 ? cellValue.substring(0, 12) + '...' : cellValue;
        
        // Draw cell border
        page.drawRectangle({
          x: xPosition,
          y: yPosition - cellHeight,
          width: cellWidth,
          height: cellHeight,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 0.5
        });
        
        // Draw cell text
        page.drawText(displayValue, {
          x: xPosition + 5,
          y: yPosition - 15,
          size: 10,
          font: cell.style?.font?.bold ? boldFont : font,
          color: rgb(0, 0, 0),
          maxWidth: cellWidth - 10
        });
        
        xPosition += cellWidth;
      });
      
      yPosition -= cellHeight;
      rowCount++;
      
      // Add new page if needed
      if (yPosition < 100 && rowCount < maxRows) {
        const newPage = pdfDoc.addPage([842, 595]);
        yPosition = newPage.getSize().height - 50;
      }
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

// Convert Excel to CSV
export async function convertExcelToCsv(file: File, sheetIndex: number = 0): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[sheetIndex];
  if (!worksheet) {
    throw new Error('Sheet not found');
  }
  
  const csvRows: string[] = [];
  
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let value = '';
      if (cell.value !== null && cell.value !== undefined) {
        // Handle different cell value types
        if (typeof cell.value === 'object') {
          if ('result' in cell.value) {
            // Formula cell - use calculated result
            value = (cell.value as any).result?.toString() || '';
          } else if ('text' in cell.value) {
            // Rich text cell
            value = (cell.value as any).text;
          } else if (cell.value instanceof Date) {
            // Date cell
            value = cell.value.toISOString().split('T')[0];
          } else {
            value = JSON.stringify(cell.value);
          }
        } else {
          value = cell.value.toString();
        }
      }
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      values.push(value);
    });
    csvRows.push(values.join(','));
  });
  
  const csvContent = csvRows.join('\n');
  return new Blob([csvContent], { type: 'text/csv' });
}

// Remove specific sheets from Excel file
export async function removeSheetsFromExcel(
  file: File, 
  sheetIndicesToRemove: number[]
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  // Sort in descending order to avoid index shifting issues
  const sortedIndices = [...sheetIndicesToRemove].sort((a, b) => b - a);
  
  for (const index of sortedIndices) {
    if (index >= 0 && index < workbook.worksheets.length) {
      workbook.removeWorksheet(workbook.worksheets[index].id);
    }
  }
  
  if (workbook.worksheets.length === 0) {
    throw new Error('Cannot remove all sheets. At least one sheet must remain.');
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Get sheet names from Excel file
export async function getExcelSheetNames(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  return workbook.worksheets.map(ws => ws.name);
}

// Add password protection to Excel file
export async function protectExcelFile(file: File, password: string): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  workbook.eachSheet((worksheet) => {
    worksheet.protect(password, {
      selectLockedCells: true,
      selectUnlockedCells: true
    });
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Sort Excel data by column
export async function sortExcelByColumn(
  file: File, 
  sheetIndex: number, 
  columnIndex: number, 
  ascending: boolean = true
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[sheetIndex];
  if (!worksheet) {
    throw new Error('Sheet not found');
  }
  
  // Validate column index
  const maxCol = worksheet.columnCount;
  if (columnIndex < 1 || columnIndex > maxCol) {
    throw new Error(`Invalid column index. Must be between 1 and ${maxCol}`);
  }
  
  // Get all rows with their data and styles
  const rows: Array<{ values: any[]; styles: any[]; height?: number }> = [];
  
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip header row (rowNumber 1)
    if (rowNumber === 1) return;
    
    const rowData = {
      values: row.values as any[],
      styles: [] as any[],
      height: row.height
    };
    
    // Capture cell styles
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData.styles[colNumber] = cell.style;
    });
    
    rows.push(rowData);
  });
  
  if (rows.length === 0) {
    // No data rows to sort
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }
  
  // Sort data rows
  rows.sort((a, b) => {
    const aVal = a.values[columnIndex];
    const bVal = b.values[columnIndex];
    
    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    
    // Handle string comparison case-insensitively
    const aStr = typeof aVal === 'string' ? aVal.toLowerCase() : aVal;
    const bStr = typeof bVal === 'string' ? bVal.toLowerCase() : bVal;
    
    const comparison = aStr < bStr ? -1 : 1;
    return ascending ? comparison : -comparison;
  });
  
  // Clear data rows (keep header)
  worksheet.spliceRows(2, worksheet.rowCount);
  
  // Rewrite sorted data with styles preserved
  rows.forEach((rowData, index) => {
    const row = worksheet.getRow(index + 2);
    if (rowData.height) row.height = rowData.height;
    
    rowData.values.forEach((cellValue, colIndex) => {
      if (colIndex > 0) { // Skip the first empty element
        const cell = row.getCell(colIndex);
        cell.value = cellValue;
        if (rowData.styles[colIndex]) {
          cell.style = rowData.styles[colIndex];
        }
      }
    });
    row.commit();
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Filter Excel data by column value
export async function filterExcelByColumn(
  file: File, 
  sheetIndex: number, 
  columnIndex: number, 
  filterValue: string
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[sheetIndex];
  if (!worksheet) {
    throw new Error('Sheet not found');
  }
  
  // Validate column index
  const maxCol = worksheet.columnCount;
  if (columnIndex < 1 || columnIndex > maxCol) {
    throw new Error(`Invalid column index. Must be between 1 and ${maxCol}`);
  }
  
  const newWorkbook = new ExcelJS.Workbook();
  const newWorksheet = newWorkbook.addWorksheet(worksheet.name);
  
  // Copy column widths
  worksheet.columns.forEach((col, colIndex) => {
    if (newWorksheet.getColumn(colIndex + 1)) {
      newWorksheet.getColumn(colIndex + 1).width = col.width || 10;
    }
  });
  
  let newRowNumber = 1;
  
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Always include header row
    if (rowNumber === 1) {
      const newRow = newWorksheet.getRow(newRowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = cell.style;
      });
      newRow.commit();
      newRowNumber++;
      return;
    }
    
    // Check if row matches filter
    const cellValue = row.getCell(columnIndex).value?.toString() || '';
    if (cellValue.toLowerCase().includes(filterValue.toLowerCase())) {
      const newRow = newWorksheet.getRow(newRowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = cell.style;
      });
      newRow.commit();
      newRowNumber++;
    }
  });
  
  const buffer = await newWorkbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Convert PDF to Excel
export async function convertPdfToExcel(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const { getPdfLib } = await import('./pdfWorkerConfig');
  const pdfjsLib = await getPdfLib();
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('PDF Content');
  
  let currentRow = 1;
  
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    
    // Add page header
    worksheet.getCell(`A${currentRow}`).value = `Page ${i}`;
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    currentRow++;
    
    // Extract text items
    const textItems = textContent.items as any[];
    textItems.forEach((item: any) => {
      if (item.str && item.str.trim()) {
        worksheet.getCell(`A${currentRow}`).value = item.str.trim();
        currentRow++;
      }
    });
    
    // Add spacing between pages
    currentRow += 2;
  }
  
  // Auto-fit column width
  worksheet.getColumn(1).width = 80;
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Convert Word to Excel
export async function convertWordToExcel(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use mammoth to extract text from Word document
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Word Content');
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim());
  
  // Add header
  worksheet.getCell('A1').value = 'Content';
  worksheet.getCell('A1').font = { bold: true, size: 12 };
  
  // Add content line by line
  lines.forEach((line, index) => {
    worksheet.getCell(`A${index + 2}`).value = line.trim();
  });
  
  // Auto-fit column width
  worksheet.getColumn(1).width = 80;
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Get compression level information
export function getCompressionInfo(level: CompressionLevel): {
  name: string;
  description: string;
  estimatedReduction: string;
} {
  const levels = {
    low: {
      name: 'Low Compression',
      description: 'Minimal optimization, preserves most formatting',
      estimatedReduction: '10-20%'
    },
    medium: {
      name: 'Medium Compression',
      description: 'Balanced optimization, keeps essential formatting',
      estimatedReduction: '20-40%'
    },
    high: {
      name: 'High Compression',
      description: 'Maximum optimization, removes most formatting',
      estimatedReduction: '40-60%'
    }
  };
  return levels[level];
}
