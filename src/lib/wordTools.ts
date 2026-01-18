// Word document processing utilities with formatting preservation
import { 
  Document, 
  Paragraph, 
  TextRun, 
  Packer,
  Header,
  AlignmentType,
  HeadingLevel,
  BorderStyle
} from 'docx';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Merge Word documents with better formatting preservation
export async function mergeWordDocuments(files: File[]): Promise<Blob> {
  try {
    const allSections: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      
      // Use mammoth to convert to HTML first, then parse back to structured format
      const result = await mammoth.convertToHtml({ 
        arrayBuffer
      });
      
      const htmlContent = result.value;
      const paragraphs: any[] = [];
      
      // Add document separator if not first document
      if (i > 0) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '', break: 2 })],
            pageBreakBefore: true
          }),
          new Paragraph({
            children: [new TextRun({ 
              text: `Document ${i + 1}: ${file.name}`, 
              bold: true,
              size: 28,
              color: "2E74B5"
            })],
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 240,
              after: 120
            }
          }),
          new Paragraph({
            children: [new TextRun({ text: '', break: 1 })],
          })
        );
      }
      
      // Parse HTML and convert back to docx elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bodyElements = doc.body.children;
      
      for (let j = 0; j < bodyElements.length; j++) {
        const element = bodyElements[j];
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'h1') {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: element.textContent || '', 
              bold: true,
              size: 32 
            })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
          }));
        } else if (tagName === 'h2') {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: element.textContent || '', 
              bold: true,
              size: 28 
            })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }));
        } else if (tagName === 'h3') {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: element.textContent || '', 
              bold: true,
              size: 24 
            })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 }
          }));
        } else if (tagName === 'p') {
          const textRuns: TextRun[] = [];
          parseInlineElements(element, textRuns);
          
          if (textRuns.length > 0) {
            paragraphs.push(new Paragraph({
              children: textRuns,
              spacing: { after: 100 }
            }));
          } else {
            paragraphs.push(new Paragraph({
              children: [new TextRun(element.textContent || ' ')],
              spacing: { after: 100 }
            }));
          }
        } else if (tagName === 'ul' || tagName === 'ol') {
          const listItems = element.querySelectorAll('li');
          listItems.forEach((li, idx) => {
            paragraphs.push(new Paragraph({
              children: [new TextRun(`${tagName === 'ol' ? `${idx + 1}.` : '\u2022'} ${li.textContent || ''}`)],
              spacing: { after: 60 },
              indent: { left: 720 }
            }));
          });
        }
      }
      
      allSections.push({
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: paragraphs
      });
    }
    
    const mergedDoc = new Document({
      sections: allSections
    });
    
    const blob = await Packer.toBlob(mergedDoc);
    return blob;
  } catch (err: any) {
    throw new Error(`Failed to merge documents: ${err.message}`);
  }
}

// Helper function to parse inline elements (bold, italic, etc.)
function parseInlineElements(element: Element, textRuns: TextRun[]): void {
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        textRuns.push(new TextRun({ text }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      const tagName = elem.tagName.toLowerCase();
      const text = elem.textContent || '';
      
      if (text.trim()) {
        if (tagName === 'strong' || tagName === 'b') {
          textRuns.push(new TextRun({ text, bold: true }));
        } else if (tagName === 'em' || tagName === 'i') {
          textRuns.push(new TextRun({ text, italics: true }));
        } else if (tagName === 'u') {
          textRuns.push(new TextRun({ text, underline: {} }));
        } else {
          textRuns.push(new TextRun({ text }));
        }
      }
    }
  }
}

// Split Word document by pages with formatting preservation
export async function splitWordByPages(file: File, pagesPerSplit: number = 1): Promise<Blob[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert to HTML with formatting
    const result = await mammoth.convertToHtml({ 
      arrayBuffer
    });
    
    const htmlContent = result.value;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const bodyElements = Array.from(doc.body.children);
    
    const wordsPerPage = 250;
    const wordsPerSplit = wordsPerPage * pagesPerSplit;
    
    const blobs: Blob[] = [];
    let currentWords = 0;
    let currentParagraphs: any[] = [];
    
    for (const element of bodyElements) {
      const text = element.textContent || '';
      const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      
      if (currentWords + wordCount > wordsPerSplit && currentParagraphs.length > 0) {
        // Create document from current paragraphs
        const splitDoc = new Document({
          sections: [{
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440
                }
              }
            },
            children: currentParagraphs
          }]
        });
        const blob = await Packer.toBlob(splitDoc);
        blobs.push(blob);
        
        // Reset for next split
        currentWords = 0;
        currentParagraphs = [];
      }
      
      // Convert HTML element to docx paragraph
      const paragraph = htmlElementToParagraph(element);
      if (paragraph) {
        currentParagraphs.push(paragraph);
        currentWords += wordCount;
      }
    }
    
    // Add remaining paragraphs
    if (currentParagraphs.length > 0) {
      const splitDoc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: currentParagraphs
        }]
      });
      const blob = await Packer.toBlob(splitDoc);
      blobs.push(blob);
    }
    
    return blobs;
  } catch (err: any) {
    throw new Error(`Failed to split document: ${err.message}`);
  }
}

// Convert HTML element to docx paragraph
function htmlElementToParagraph(element: Element): any {
  const tagName = element.tagName.toLowerCase();
  const text = element.textContent || '';
  
  if (!text.trim()) {
    return new Paragraph({ children: [new TextRun(' ')] });
  }
  
  const textRuns: TextRun[] = [];
  parseInlineElements(element, textRuns);
  
  if (tagName === 'h1') {
    return new Paragraph({
      children: textRuns.length > 0 ? textRuns : [new TextRun({ text, bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 }
    });
  } else if (tagName === 'h2') {
    return new Paragraph({
      children: textRuns.length > 0 ? textRuns : [new TextRun({ text, bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    });
  } else if (tagName === 'h3') {
    return new Paragraph({
      children: textRuns.length > 0 ? textRuns : [new TextRun({ text, bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 160, after: 80 }
    });
  } else {
    return new Paragraph({
      children: textRuns.length > 0 ? textRuns : [new TextRun(text)],
      spacing: { after: 100 }
    });
  }
}

// Add headers to Word document with formatting preservation
export async function addHeadersToWord(file: File, headerText: string): Promise<Blob> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert to HTML with formatting
    const result = await mammoth.convertToHtml({ 
      arrayBuffer
    });
    
    const htmlContent = result.value;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const bodyElements = Array.from(doc.body.children);
    
    const paragraphs: any[] = [];
    
    for (const element of bodyElements) {
      const paragraph = htmlElementToParagraph(element);
      if (paragraph) {
        paragraphs.push(paragraph);
      }
    }
    
    const docWithHeader = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: headerText,
                    bold: true,
                    size: 24,
                    color: "2E74B5"
                  })
                ],
                spacing: { after: 120 },
                border: {
                  bottom: {
                    color: "2E74B5",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6
                  }
                }
              })
            ]
          })
        },
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(docWithHeader);
    return blob;
  } catch (err: any) {
    throw new Error(`Failed to add headers: ${err.message}`);
  }
}

// Word to PDF conversion with better formatting preservation
export async function convertWordToPdfEnhanced(file: File): Promise<Blob> {
  // Client-side Word to PDF conversion using mammoth + pdf-lib
  // Note: This provides basic conversion. For professional quality, Microsoft Office is required.
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract HTML from Word document
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const htmlContent = result.value;
    
    // Parse HTML to extract text with basic formatting
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
    
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 50;
    let yPosition = height - margin;
    const lineHeight = 14;
    const maxWidth = width - (2 * margin);
    
    // Helper function to add new page when needed
    const checkPageBreak = () => {
      if (yPosition < margin + lineHeight) {
        page = pdfDoc.addPage();
        yPosition = height - margin;
        return true;
      }
      return false;
    };
    
    // Helper function to wrap text
    const wrapText = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (textWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines;
    };
    
    // Process HTML elements
    const bodyElements = doc.body.children;
    
    for (let i = 0; i < bodyElements.length; i++) {
      const element = bodyElements[i];
      const tagName = element.tagName.toLowerCase();
      const text = element.textContent?.trim() || '';
      
      if (!text) continue;
      
      let font = timesRomanFont;
      let fontSize = 12;
      let color = rgb(0, 0, 0);
      let extraSpaceBefore = 0;
      let extraSpaceAfter = 0;
      
      // Apply formatting based on element type
      if (tagName === 'h1') {
        font = timesRomanBold;
        fontSize = 18;
        extraSpaceBefore = 20;
        extraSpaceAfter = 10;
      } else if (tagName === 'h2') {
        font = timesRomanBold;
        fontSize = 16;
        extraSpaceBefore = 16;
        extraSpaceAfter = 8;
      } else if (tagName === 'h3') {
        font = timesRomanBold;
        fontSize = 14;
        extraSpaceBefore = 12;
        extraSpaceAfter = 6;
      } else if (tagName === 'strong' || tagName === 'b') {
        font = timesRomanBold;
      } else if (tagName === 'code' || tagName === 'pre') {
        font = courierFont;
        fontSize = 10;
      }
      
      // Add space before
      yPosition -= extraSpaceBefore;
      checkPageBreak();
      
      // Wrap and draw text
      const lines = wrapText(text, font, fontSize, maxWidth);
      
      for (const line of lines) {
        checkPageBreak();
        
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: color,
        });
        
        yPosition -= lineHeight;
      }
      
      // Add space after
      yPosition -= extraSpaceAfter;
    }
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
    
  } catch (error) {
    console.error('Word to PDF conversion error:', error);
    throw new Error(`Failed to convert Word to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Extract text from Word document
export async function extractTextFromWord(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (err) {
    throw new Error(`Failed to extract text: ${err}`);
  }
}

// Convert Word to plain text
export async function convertWordToTxt(file: File): Promise<Blob> {
  try {
    const text = await extractTextFromWord(file);
    return new Blob([text], { type: 'text/plain' });
  } catch (err: any) {
    throw new Error(`Failed to convert to TXT: ${err.message}`);
  }
}

// Convert Word to HTML
export async function convertWordToHtml(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value;
  } catch (err: any) {
    throw new Error(`Failed to convert to HTML: ${err.message}`);
  }
}

// Get Word document statistics
export async function getWordStats(file: File): Promise<{
  words: number;
  chars: number;
  lines: number;
  pages: number;
}> {
  try {
    const text = await extractTextFromWord(file);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;
    const lines = text.split('\n').length;
    const pages = Math.ceil(words / 250); // Approximate pages (250 words per page)
    
    return { words, chars, lines, pages };
  } catch (err: any) {
    throw new Error(`Failed to get statistics: ${err.message}`);
  }
}

// Convert Excel to Word
export async function convertExcelToWord(file: File): Promise<Blob> {
  try {
    const ExcelJS = await import('exceljs');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const sections: any[] = [];
    
    // Process each worksheet
    workbook.eachSheet((worksheet, sheetIndex) => {
      const paragraphs: any[] = [];
      
      // Add sheet name as heading
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ 
            text: worksheet.name, 
            bold: true,
            size: 32,
            color: "2E74B5"
          })],
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: sheetIndex > 0 ? 480 : 240,
            after: 240
          }
        })
      );
      
      // Convert worksheet to text table
      let tableData: string[][] = [];
      
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const rowData: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let value = '';
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              if ('result' in cell.value) {
                value = (cell.value as any).result?.toString() || '';
              } else if ('text' in cell.value) {
                value = (cell.value as any).text;
              } else if (cell.value instanceof Date) {
                value = cell.value.toISOString().split('T')[0];
              } else {
                value = JSON.stringify(cell.value);
              }
            } else {
              value = cell.value.toString();
            }
          }
          rowData.push(value);
        });
        tableData.push(rowData);
      });
      
      // Create text representation of table
      tableData.forEach((row, rowIndex) => {
        const rowText = row.join(' | ');
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ 
              text: rowText,
              font: 'Courier New',
              size: 20
            })],
            spacing: {
              after: 120
            }
          })
        );
        
        // Add separator after header row
        if (rowIndex === 0 && tableData.length > 1) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ 
                text: '-'.repeat(80),
                color: "CCCCCC"
              })],
              spacing: {
                after: 120
              }
            })
          );
        }
      });
      
      sections.push({
        children: paragraphs
      });
    });
    
    // Create document
    const doc = new Document({
      sections: sections
    });
    
    const blob = await Packer.toBlob(doc);
    return blob;
  } catch (err: any) {
    throw new Error(`Failed to convert Excel to Word: ${err.message}`);
  }
}
