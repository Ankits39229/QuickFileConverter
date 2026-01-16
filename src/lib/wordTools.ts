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
  try {
    // Extract text with mammoth with enhanced styling
    const arrayBuffer = await file.arrayBuffer();
    
    // mammoth expects Buffer in Node.js or ArrayBuffer in browser
    let mammothInput;
    if (typeof Buffer !== 'undefined' && !(arrayBuffer instanceof Buffer)) {
      // Node.js - convert ArrayBuffer to Buffer
      mammothInput = { buffer: Buffer.from(arrayBuffer) };
    } else {
      // Browser
      mammothInput = { arrayBuffer };
    }
    
    // Enhanced style mapping for better formatting preservation
    const result = await mammoth.convertToHtml({
      ...mammothInput,
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "r[style-name='Strong'] => strong",
        "p[style-name='Quote'] => blockquote",
      ]
    });
    const htmlContent = result.value;
    
    // Parse HTML - browser has DOMParser, Node.js doesn't
    let bodyElements: HTMLCollection;
    
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      // Browser environment - use DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      bodyElements = doc.body.children;
    } else {
      // Node.js environment - manually parse simple HTML
      // For production Electron app, this path won't be used as Electron provides DOMParser
      const lines = htmlContent
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .filter(line => line.trim());
      
      // Create a minimal mock structure for Node.js testing
      bodyElements = lines.map(text => ({
        tagName: 'P',
        textContent: text,
        querySelector: () => null
      })) as any;
    }
    
    // Create PDF with better font support
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const timesRomanBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
    
    const margin = 72; // 1 inch
    const pageWidth = 595; // A4 width in points
    const pageHeight = 842; // A4 height in points
    const maxWidth = pageWidth - (margin * 2);
    
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    
    // Helper function to check if element has specific child tag
    const hasChildTag = (element: any, tagName: string): boolean => {
      if (element.querySelector) {
        return element.querySelector(tagName) !== null;
      }
      return false;
    };
    
    // Helper function to process text with inline formatting
    const processTextWithFormatting = (element: any, baseFontSize: number, baseFont: any): void => {
      if (!element.childNodes || element.childNodes.length === 0) {
        // No child nodes, process as plain text
        const text = element.textContent || '';
        if (text.trim()) {
          drawTextWithWrapping(text, baseFontSize, baseFont);
        }
        return;
      }
      
      // Process child nodes with their formatting
      const fragments: Array<{text: string, font: any}> = [];
      
      const processNode = (node: any): void => {
        if (node.nodeType === 3) { // Text node
          const text = node.textContent || '';
          if (text) {
            fragments.push({ text, font: baseFont });
          }
        } else if (node.nodeType === 1) { // Element node
          const tagName = node.tagName.toLowerCase();
          const text = node.textContent || '';
          if (!text) return;
          
          let nodeFont = baseFont;
          if (tagName === 'strong' || tagName === 'b') {
            nodeFont = baseFontSize >= 16 ? timesRomanBold : 
                      (baseFont === timesRomanItalic ? timesRomanBoldItalic : timesRomanBold);
          } else if (tagName === 'em' || tagName === 'i') {
            nodeFont = baseFont === timesRomanBold ? timesRomanBoldItalic : timesRomanItalic;
          } else if (tagName === 'code') {
            nodeFont = courierFont;
          }
          
          fragments.push({ text, font: nodeFont });
        }
      };
      
      element.childNodes.forEach((node: any) => processNode(node));
      
      // Now draw fragments with word wrapping
      let currentLine = '';
      let currentLineFragments: Array<{text: string, font: any}> = [];
      
      for (const fragment of fragments) {
        const words = fragment.text.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = fragment.font.widthOfTextAtSize(testLine, baseFontSize);
          
          if (testWidth > maxWidth && currentLine) {
            // Draw current line
            drawLine(currentLine, baseFontSize, fragment.font);
            currentLine = word;
            currentLineFragments = [{ text: word, font: fragment.font }];
          } else {
            currentLine = testLine;
            if (currentLineFragments.length === 0 || currentLineFragments[currentLineFragments.length - 1].font !== fragment.font) {
              currentLineFragments.push({ text: word, font: fragment.font });
            }
          }
        }
      }
      
      // Draw remaining line
      if (currentLine) {
        const font = fragments.length > 0 ? fragments[0].font : baseFont;
        drawLine(currentLine, baseFontSize, font);
      }
    };
    
    const drawLine = (text: string, fontSize: number, font: any): void => {
      const lineHeight = fontSize * 1.3;
      
      if (yPosition < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      page.drawText(text, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });
      
      yPosition -= lineHeight;
    };
    
    const drawTextWithWrapping = (text: string, fontSize: number, font: any): void => {
      const lineHeight = fontSize * 1.3;
      const words = text.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        
        if (width > maxWidth && currentLine) {
          drawLine(currentLine, fontSize, font);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        drawLine(currentLine, fontSize, font);
      }
    };
    
    for (let i = 0; i < bodyElements.length; i++) {
      const element = bodyElements[i];
      const tagName = element.tagName.toLowerCase();
      const text = element.textContent || '';
      
      if (!text.trim()) continue;
      
      let fontSize = 12;
      let font = timesRomanFont;
      let lineSpacing = 1.3;
      let paragraphSpacing = 0.3;
      let indentation = 0;
      
      // Adjust for different elements
      if (tagName === 'h1') {
        fontSize = 24;
        font = timesRomanBold;
        paragraphSpacing = 0.8;
      } else if (tagName === 'h2') {
        fontSize = 20;
        font = timesRomanBold;
        paragraphSpacing = 0.6;
      } else if (tagName === 'h3') {
        fontSize = 16;
        font = timesRomanBold;
        paragraphSpacing = 0.5;
      } else if (tagName === 'blockquote') {
        fontSize = 11;
        font = timesRomanItalic;
        indentation = 36; // 0.5 inch indent
        paragraphSpacing = 0.4;
      } else {
        // Check for inline formatting
        const hasBold = hasChildTag(element, 'strong') || hasChildTag(element, 'b');
        const hasItalic = hasChildTag(element, 'em') || hasChildTag(element, 'i');
        const hasCode = hasChildTag(element, 'code');
        
        if (hasCode) {
          font = courierFont;
          fontSize = 11;
        } else if (hasBold && hasItalic) {
          font = timesRomanBoldItalic;
        } else if (hasBold) {
          font = timesRomanBold;
        } else if (hasItalic) {
          font = timesRomanItalic;
        }
      }
      
      const lineHeight = fontSize * lineSpacing;
      
      // Add space before paragraph
      if (i > 0) {
        yPosition -= lineHeight * paragraphSpacing;
      }
      
      // Check if we need a new page
      if (yPosition < margin + lineHeight * 2) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      // Process text with proper formatting
      processTextWithFormatting(element, fontSize, font);
      
      // Small extra spacing after paragraph
      yPosition -= lineHeight * 0.1;
    }
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  } catch (err: any) {
    throw new Error(`Failed to convert to PDF: ${err.message}`);
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
