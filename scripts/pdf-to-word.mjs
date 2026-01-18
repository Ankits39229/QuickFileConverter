/**
 * CLI tool to convert PDF to Word using the app's conversion function
 * Usage: node scripts/pdf-to-word.mjs <input.pdf> [output.docx]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename, extname } from 'path';

// Import the conversion function
async function convertPdfToWord(file) {
  // Polyfill Promise.withResolvers if needed
  if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const pdfLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel } = await import('docx');
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
  
  const allParagraphs = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Add page break for pages after the first
    if (i > 1) {
      allParagraphs.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true
        })
      );
    }
    
    // Group text items by approximate Y position (allow small variations)
    const lineGroups = [];
    const yThreshold = 2; // Group items within 2 pixels vertically
    
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue;
      
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const height = item.height;
      
      // Find existing line group or create new one
      let lineGroup = lineGroups.find(group => Math.abs(group.y - y) < yThreshold);
      
      if (!lineGroup) {
        lineGroup = { y, items: [], fontSize: height };
        lineGroups.push(lineGroup);
      }
      
      lineGroup.items.push({
        text: item.str,
        x: x,
        width: item.width,
        fontSize: height
      });
      
      lineGroup.fontSize = Math.max(lineGroup.fontSize, height);
    }
    
    // Sort line groups from top to bottom
    lineGroups.sort((a, b) => b.y - a.y);
    
    // Combine lines into paragraphs
    let currentParagraph = [];
    let prevY = null;
    let prevFontSize = null;
    
    for (const lineGroup of lineGroups) {
      // Sort items in line from left to right
      lineGroup.items.sort((a, b) => a.x - b.x);
      
      // Build line text
      let lineText = '';
      let lastX = 0;
      
      for (let idx = 0; idx < lineGroup.items.length; idx++) {
        const item = lineGroup.items[idx];
        
        if (idx > 0) {
          const gap = item.x - (lastX + lineGroup.items[idx - 1].width);
          // Add space if gap is significant
          if (gap > 3) {
            lineText += ' ';
          }
        }
        
        lineText += item.text;
        lastX = item.x;
      }
      
      lineText = lineText.trim();
      if (!lineText) continue;
      
      // Determine if this line should start a new paragraph
      let startNewParagraph = false;
      
      if (prevY !== null) {
        const yGap = prevY - lineGroup.y;
        const fontSizeChange = prevFontSize && Math.abs(lineGroup.fontSize - prevFontSize) > 3;
        
        // Start new paragraph if:
        // - Large vertical gap (more than 1.5x line height)
        // - Font size changed significantly
        // - Current line is very short (might be heading)
        if (yGap > lineGroup.fontSize * 1.5 || fontSizeChange || lineText.length < 50) {
          startNewParagraph = true;
        }
      } else {
        startNewParagraph = true;
      }
      
      // If starting new paragraph, save previous one
      if (startNewParagraph && currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const firstLine = lineGroups[lineGroups.indexOf(lineGroup) - currentParagraph.length];
        const fontSize = firstLine ? firstLine.fontSize : 12;
        
        const options = {
          children: [new TextRun(paragraphText)],
          spacing: { line: 360, before: 120, after: 120 }
        };
        
        // Apply heading styles for larger fonts
        if (fontSize > 16) {
          options.heading = HeadingLevel.HEADING_1;
          options.spacing.before = 240;
          options.spacing.after = 120;
        } else if (fontSize > 14) {
          options.heading = HeadingLevel.HEADING_2;
          options.spacing.before = 200;
        }
        
        // Detect potential center alignment
        const avgX = firstLine.items.reduce((sum, item) => sum + item.x, 0) / firstLine.items.length;
        if (avgX > viewport.width * 0.3 && avgX < viewport.width * 0.7 && paragraphText.length < 80) {
          options.alignment = AlignmentType.CENTER;
        }
        
        allParagraphs.push(new Paragraph(options));
        currentParagraph = [];
      }
      
      // Add current line to paragraph
      currentParagraph.push(lineText);
      prevY = lineGroup.y;
      prevFontSize = lineGroup.fontSize;
    }
    
    // Don't forget the last paragraph
    if (currentParagraph.length > 0) {
      allParagraphs.push(
        new Paragraph({
          children: [new TextRun(currentParagraph.join(' '))],
          spacing: { line: 360, before: 120, after: 120 }
        })
      );
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          }
        }
      },
      children: allParagraphs
    }]
  });
  
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// Main CLI function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/pdf-to-word.mjs <input.pdf> [output.docx]');
    console.error('Example: node scripts/pdf-to-word.mjs sample.pdf output.docx');
    process.exit(1);
  }
  
  const inputPath = resolve(args[0]);
  const outputPath = args[1] 
    ? resolve(args[1])
    : inputPath.replace(extname(inputPath), '.docx');
  
  console.log(`Converting PDF to Word...`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  
  try {
    // Read PDF file
    const pdfBuffer = readFileSync(inputPath);
    
    // Create File object from buffer
    const file = new File([pdfBuffer], basename(inputPath), { type: 'application/pdf' });
    
    // Convert PDF to Word
    const wordBuffer = await convertPdfToWord(file);
    
    // Write output file
    writeFileSync(outputPath, wordBuffer);
    
    console.log(`✓ Conversion complete!`);
    console.log(`✓ Word document saved to: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Conversion failed:`, error.message);
    process.exit(1);
  }
}

main();
