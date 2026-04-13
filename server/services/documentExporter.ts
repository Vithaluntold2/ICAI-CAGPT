import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table } from 'docx';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import type { VisualizationData } from '../../shared/types/visualization';

/**
 * DocumentExporter - Exports content to various document formats
 * 
 * Converts markdown/text content into professional document formats
 * suitable for distribution and archival.
 */
export class DocumentExporter {
  /**
   * Convert visualization data to a markdown table
   */
  private static visualizationToMarkdown(viz: VisualizationData): string {
    if (!viz || !('data' in viz) || !viz.data || viz.data.length === 0) {
      return '';
    }

    let markdown = '\n\n';
    if (viz.title) {
      markdown += `## ${viz.title}\n\n`;
    }

    // Get all unique keys from the data
    const allKeys = Array.from(
      new Set(viz.data.flatMap((obj: any) => Object.keys(obj)))
    );

    // Create table header
    markdown += '| ' + allKeys.join(' | ') + ' |\n';
    markdown += '|' + allKeys.map(() => '---').join('|') + '|\n';

    // Create table rows
    for (const row of viz.data) {
      markdown += '| ' + allKeys.map(key => {
        const value = (row as any)[key];
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        return value || '';
      }).join(' | ') + ' |\n';
    }

    return markdown + '\n';
  }
  /**
   * Export content to DOCX format with proper markdown parsing
   */
  static async exportToDocx(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const lines = content.split('\n');
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: this.stripMarkdown(title),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Process content
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Handle headers
      if (trimmed.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^#\s+/, '')),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmed.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^##\s+/, '')),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 100 },
          })
        );
      } else if (trimmed.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^###\s+/, '')),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 50 },
          })
        );
      } else if (trimmed.startsWith('#### ')) {
        paragraphs.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^####\s+/, '')),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 100, after: 50 },
          })
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
        // Bullet point
        const bulletText = this.stripMarkdown(trimmed.replace(/^[-*+]\s+/, ''));
        paragraphs.push(
          new Paragraph({
            text: bulletText,
            bullet: { level: 0 },
            spacing: { after: 50 },
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed)) {
        // Numbered list
        const listText = this.stripMarkdown(trimmed.replace(/^\d+\.\s+/, ''));
        paragraphs.push(
          new Paragraph({
            text: listText,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { after: 50 },
          })
        );
      } else if (trimmed.startsWith('> ')) {
        // Blockquote
        const quoteText = this.stripMarkdown(trimmed.replace(/^>\s+/, ''));
        paragraphs.push(
          new Paragraph({
            text: quoteText,
            
            indent: { left: 720 }, // 0.5 inch indent
            spacing: { after: 100 },
          })
        );
      } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        // Horizontal rule - add an empty paragraph with a border
        paragraphs.push(
          new Paragraph({
            text: '',
            border: {
              bottom: {
                color: 'auto',
                space: 1,
                style: 'single',
                size: 6,
              },
            },
            spacing: { before: 100, after: 100 },
          })
        );
      } else if (trimmed) {
        // Regular text with inline markdown formatting
        const segments = this.parseMarkdownSegments(trimmed);
        const runs: TextRun[] = segments.map(segment => 
          new TextRun({
            text: segment.text,
            bold: segment.bold,
            italics: segment.italic,
          })
        );
        
        paragraphs.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun({ text: this.stripMarkdown(trimmed) })],
            spacing: { after: 100 },
          })
        );
      } else {
        // Empty line
        paragraphs.push(new Paragraph({ text: '' }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.START,
              },
            ],
          },
        ],
      },
    });

    const { Packer } = await import('docx');
    return await Packer.toBuffer(doc);
  }

  /**
   * Strip markdown formatting and return plain text
   */
  private static stripMarkdown(text: string): string {
    return text
      // Remove bold (**text** or __text__)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      // Remove italic (*text* or _text_)
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove inline code (`code`)
      .replace(/`([^`]+)`/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove strikethrough (~~text~~)
      .replace(/~~(.*?)~~/g, '$1')
      // Remove list markers (-, *, +, numbers)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove blockquote markers
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Clean up any remaining special chars
      .trim();
  }

  /**
   * Parse markdown text segments with formatting information
   */
  private static parseMarkdownSegments(text: string): Array<{ text: string; bold?: boolean; italic?: boolean }> {
    const segments: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
    let remaining = text;
    
    // Process bold and italic patterns
    const patterns = [
      { regex: /\*\*\*(.*?)\*\*\*/g, bold: true, italic: true },  // Bold + Italic
      { regex: /\*\*(.*?)\*\*/g, bold: true, italic: false },      // Bold
      { regex: /\*(.*?)\*/g, bold: false, italic: true },          // Italic
      { regex: /___(.*?)___/g, bold: true, italic: true },         // Bold + Italic (underscores)
      { regex: /__(.*?)__/g, bold: true, italic: false },          // Bold (underscores)
      { regex: /_(.*?)_/g, bold: false, italic: true },            // Italic (underscores)
    ];

    // Track positions of all matches
    const matches: Array<{ start: number; end: number; text: string; bold: boolean; italic: boolean }> = [];
    
    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex);
      while ((match = regex.exec(remaining)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[1],
          bold: pattern.bold,
          italic: pattern.italic,
        });
      }
    }

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build segments
    let lastIndex = 0;
    for (const match of matches) {
      // Add plain text before this match
      if (match.start > lastIndex) {
        const plainText = remaining.substring(lastIndex, match.start);
        if (plainText) {
          segments.push({ text: plainText });
        }
      }
      
      // Add formatted segment
      segments.push({
        text: match.text,
        bold: match.bold,
        italic: match.italic,
      });
      
      lastIndex = match.end;
    }

    // Add remaining plain text
    if (lastIndex < remaining.length) {
      const plainText = remaining.substring(lastIndex);
      if (plainText) {
        segments.push({ text: plainText });
      }
    }

    // If no segments were created, return the plain text
    if (segments.length === 0) {
      segments.push({ text: this.stripMarkdown(remaining) });
    }

    return segments;
  }

  /**
   * Export content to PDF format with proper markdown parsing
   */
  static async exportToPdf(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text(this.stripMarkdown(title), { align: 'left' });
      doc.moveDown();

      // Process content
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Handle headers
        if (trimmed.startsWith('# ')) {
          doc.moveDown(0.5);
          doc.fontSize(18).font('Helvetica-Bold').text(this.stripMarkdown(trimmed.replace(/^#\s+/, '')));
          doc.moveDown(0.3);
        } else if (trimmed.startsWith('## ')) {
          doc.moveDown(0.4);
          doc.fontSize(16).font('Helvetica-Bold').text(this.stripMarkdown(trimmed.replace(/^##\s+/, '')));
          doc.moveDown(0.2);
        } else if (trimmed.startsWith('### ')) {
          doc.moveDown(0.3);
          doc.fontSize(14).font('Helvetica-Bold').text(this.stripMarkdown(trimmed.replace(/^###\s+/, '')));
          doc.moveDown(0.2);
        } else if (trimmed.startsWith('#### ')) {
          doc.moveDown(0.2);
          doc.fontSize(12).font('Helvetica-Bold').text(this.stripMarkdown(trimmed.replace(/^####\s+/, '')));
          doc.moveDown(0.1);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
          // Bullet points
          const bulletText = this.stripMarkdown(trimmed.replace(/^[-*+]\s+/, ''));
          doc.fontSize(11).font('Helvetica').text('• ' + bulletText, { indent: 20 });
        } else if (/^\d+\.\s+/.test(trimmed)) {
          // Numbered list
          const listText = this.stripMarkdown(trimmed);
          doc.fontSize(11).font('Helvetica').text(listText, { indent: 20 });
        } else if (trimmed.startsWith('> ')) {
          // Blockquote
          const quoteText = this.stripMarkdown(trimmed.replace(/^>\s+/, ''));
          doc.fontSize(11).font('Helvetica-Oblique').fillColor('#666666').text(quoteText, { indent: 30 });
          doc.fillColor('#000000');
        } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          // Horizontal rule
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
          doc.moveDown(0.3);
        } else if (trimmed) {
          // Regular text with inline formatting
          const cleanText = this.stripMarkdown(trimmed);
          doc.fontSize(11).font('Helvetica').text(cleanText, { align: 'left' });
        } else {
          // Empty line
          doc.moveDown(0.5);
        }
      }

      doc.end();
    });
  }

  /**
   * Export content to PowerPoint format with markdown cleaning
   */
  static async exportToPptx(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const pptx = new PptxGenJS();
    
    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(this.stripMarkdown(title), {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: '363636',
      align: 'center',
    });
    titleSlide.addText('Generated by CA GPT', {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: '666666',
      align: 'center',
    });

    // Process content into slides
    const sections: { heading: string; content: string[] }[] = [];
    let currentSection: { heading: string; content: string[] } | null = null;

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: this.stripMarkdown(trimmed.replace(/^#{1,2}\s+/, '')),
          content: [],
        };
      } else if (currentSection && trimmed) {
        // Clean markdown from content lines
        const cleanLine = this.stripMarkdown(trimmed);
        if (cleanLine) {
          currentSection.content.push(cleanLine);
        }
      }
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    // Create slides for each section
    for (const section of sections) {
      const slide = pptx.addSlide();
      
      // Add heading
      slide.addText(section.heading, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.8,
        fontSize: 32,
        bold: true,
        color: '363636',
      });

      // Add content - join and format
      const contentText = section.content.join('\n');
      if (contentText) {
        slide.addText(contentText, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4.5,
          fontSize: 18,
          color: '444444',
          valign: 'top',
        });
      }
    }

    return await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  }

  /**
   * Parse a currency string like "$1,250,000" or "1,250,000" to a number
   */
  private static parseCurrency(value: string): number | null {
    if (!value) return null;
    const cleaned = value.replace(/[$,\s]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse a percentage string like "16.46%" to a decimal
   */
  private static parsePercentage(value: string): number | null {
    if (!value) return null;
    const match = value.match(/([\d.]+)%/);
    if (match) {
      return parseFloat(match[1]) / 100;
    }
    return null;
  }

  /**
   * Parse a markdown table into rows of cells
   */
  private static parseMarkdownTable(tableLines: string[]): string[][] {
    const rows: string[][] = [];
    for (const line of tableLines) {
      // Skip separator lines (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
      
      // Parse table row
      const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter((cell, index, arr) => index > 0 && index < arr.length - 1); // Remove empty first/last from split
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    return rows;
  }

  /**
   * Detect if a value should be formatted as currency, percentage, or number
   */
  private static detectAndFormatCell(
    cell: ExcelJS.Cell, 
    value: string,
    isHeader: boolean = false
  ): void {
    // Strip markdown formatting first
    const cleanValue = this.stripMarkdown(value);
    
    if (isHeader) {
      cell.value = cleanValue;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      return;
    }

    // Check for currency (starts with $ or contains currency patterns)
    if (cleanValue.startsWith('$') || /^\$?[\d,]+(\.\d{2})?$/.test(cleanValue.replace(/\s/g, ''))) {
      const num = this.parseCurrency(cleanValue);
      if (num !== null) {
        cell.value = num;
        cell.numFmt = '"$"#,##0.00';
        return;
      }
    }

    // Check for percentage
    if (cleanValue.includes('%')) {
      const pct = this.parsePercentage(cleanValue);
      if (pct !== null) {
        cell.value = pct;
        cell.numFmt = '0.00%';
        return;
      }
    }

    // Check for years (e.g., "3.54 years")
    const yearsMatch = cleanValue.match(/([\d.]+)\s*years?/i);
    if (yearsMatch) {
      cell.value = parseFloat(yearsMatch[1]);
      cell.numFmt = '0.00" years"';
      return;
    }

    // Check for plain numbers with commas
    const plainNum = cleanValue.replace(/,/g, '');
    if (/^-?[\d.]+$/.test(plainNum)) {
      const num = parseFloat(plainNum);
      if (!isNaN(num)) {
        cell.value = num;
        if (num > 1000) {
          cell.numFmt = '#,##0.00';
        }
        return;
      }
    }

    // Default: plain text (already cleaned of markdown)
    cell.value = cleanValue;
  }

  /**
   * Export content to Excel format with proper formulas and formatting
   */
  static async exportToExcel(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CA GPT Agent';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Output');

    // Process content and identify tables vs text
    const lines = content.split('\n');
    let currentRow = 1;
    let inTable = false;
    let tableLines: string[] = [];
    let tableStartRow = 0;
    const dataRanges: { name: string; startRow: number; endRow: number; cols: number }[] = [];

    // Add title
    worksheet.getCell(currentRow, 1).value = title;
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    currentRow += 2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect table start (line starts with |)
      if (trimmedLine.startsWith('|') && !inTable) {
        inTable = true;
        tableLines = [trimmedLine];
        tableStartRow = currentRow;
        continue;
      }

      // Continue collecting table lines
      if (inTable && trimmedLine.startsWith('|')) {
        tableLines.push(trimmedLine);
        continue;
      }

      // Table ended - process it
      if (inTable && !trimmedLine.startsWith('|')) {
        inTable = false;
        const parsedTable = this.parseMarkdownTable(tableLines);
        
        if (parsedTable.length > 0) {
          const numCols = parsedTable[0].length;
          
          // Set column widths based on content
          for (let col = 0; col < numCols; col++) {
            const maxWidth = Math.max(...parsedTable.map(row => (row[col] || '').length));
            worksheet.getColumn(col + 1).width = Math.min(Math.max(maxWidth + 2, 12), 25);
          }

          // Add table data
          for (let rowIdx = 0; rowIdx < parsedTable.length; rowIdx++) {
            const rowData = parsedTable[rowIdx];
            const isHeader = rowIdx === 0;
            
            for (let colIdx = 0; colIdx < rowData.length; colIdx++) {
              const cell = worksheet.getCell(currentRow, colIdx + 1);
              this.detectAndFormatCell(cell, rowData[colIdx], isHeader);
              
              // Add borders
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            }
            currentRow++;
          }

          // Track data range for formulas
          dataRanges.push({
            name: `Table${dataRanges.length + 1}`,
            startRow: tableStartRow,
            endRow: currentRow - 1,
            cols: numCols
          });
          
          currentRow++; // Add spacing after table
        }
        tableLines = [];
      }

      // Process non-table content
      if (!inTable) {
        if (trimmedLine.startsWith('# ')) {
          // Main heading
          worksheet.getCell(currentRow, 1).value = this.stripMarkdown(trimmedLine.replace(/^#\s+/, ''));
          worksheet.getCell(currentRow, 1).font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
          worksheet.mergeCells(currentRow, 1, currentRow, 8);
          currentRow++;
        } else if (trimmedLine.startsWith('## ')) {
          // Sub heading
          worksheet.getCell(currentRow, 1).value = this.stripMarkdown(trimmedLine.replace(/^##\s+/, ''));
          worksheet.getCell(currentRow, 1).font = { bold: true, size: 12, color: { argb: 'FF2E75B6' } };
          worksheet.mergeCells(currentRow, 1, currentRow, 8);
          currentRow++;
        } else if (trimmedLine.startsWith('### ')) {
          // Section heading
          worksheet.getCell(currentRow, 1).value = this.stripMarkdown(trimmedLine.replace(/^###\s+/, ''));
          worksheet.getCell(currentRow, 1).font = { bold: true, size: 11 };
          currentRow++;
        } else if (trimmedLine.startsWith('#### ')) {
          // Sub-section heading
          worksheet.getCell(currentRow, 1).value = this.stripMarkdown(trimmedLine.replace(/^####\s+/, ''));
          worksheet.getCell(currentRow, 1).font = { bold: true, size: 10, italic: true };
          currentRow++;
        } else if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
          // Separator - add thin line
          currentRow++;
        } else if (trimmedLine) {
          // Regular content - strip markdown
          worksheet.getCell(currentRow, 1).value = this.stripMarkdown(trimmedLine);
          worksheet.mergeCells(currentRow, 1, currentRow, 8);
          currentRow++;
        } else {
          // Empty line
          currentRow++;
        }
      }
    }

    // Process any remaining table
    if (inTable && tableLines.length > 0) {
      const parsedTable = this.parseMarkdownTable(tableLines);
      if (parsedTable.length > 0) {
        const numCols = parsedTable[0].length;
        
        for (let col = 0; col < numCols; col++) {
          const maxWidth = Math.max(...parsedTable.map(row => (row[col] || '').length));
          worksheet.getColumn(col + 1).width = Math.min(Math.max(maxWidth + 2, 12), 25);
        }

        for (let rowIdx = 0; rowIdx < parsedTable.length; rowIdx++) {
          const rowData = parsedTable[rowIdx];
          const isHeader = rowIdx === 0;
          
          for (let colIdx = 0; colIdx < rowData.length; colIdx++) {
            const cell = worksheet.getCell(currentRow, colIdx + 1);
            this.detectAndFormatCell(cell, rowData[colIdx], isHeader);
            
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
          currentRow++;
        }
      }
    }

    // Add a Formulas sheet with common financial calculations if data exists
    if (dataRanges.length > 0) {
      const formulaSheet = workbook.addWorksheet('Formulas');
      formulaSheet.getColumn(1).width = 25;
      formulaSheet.getColumn(2).width = 20;
      formulaSheet.getColumn(3).width = 40;

      formulaSheet.getCell(1, 1).value = 'Financial Formula Reference';
      formulaSheet.getCell(1, 1).font = { bold: true, size: 14 };
      formulaSheet.mergeCells(1, 1, 1, 3);

      const formulas = [
        ['Function', 'Example', 'Description'],
        ['NPV', '=NPV(rate, value1, value2, ...)', 'Net Present Value of cash flows'],
        ['IRR', '=IRR(values, [guess])', 'Internal Rate of Return'],
        ['XNPV', '=XNPV(rate, values, dates)', 'NPV for irregular cash flows'],
        ['XIRR', '=XIRR(values, dates, [guess])', 'IRR for irregular cash flows'],
        ['PMT', '=PMT(rate, nper, pv)', 'Periodic payment amount'],
        ['PV', '=PV(rate, nper, pmt)', 'Present Value'],
        ['FV', '=FV(rate, nper, pmt)', 'Future Value'],
        ['SUM', '=SUM(range)', 'Sum of values'],
        ['AVERAGE', '=AVERAGE(range)', 'Mean of values'],
      ];

      for (let i = 0; i < formulas.length; i++) {
        for (let j = 0; j < formulas[i].length; j++) {
          const cell = formulaSheet.getCell(i + 3, j + 1);
          cell.value = formulas[i][j];
          if (i === 0) {
            cell.font = { bold: true };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF4472C4' }
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Export content to specified format
   */
  static async export(options: {
    content: string;
    visualization?: VisualizationData;
    format: 'docx' | 'pdf' | 'pptx' | 'xlsx';
    title?: string;
  }): Promise<Buffer> {
    const { content, visualization, format, title } = options;
    
    // Combine content with visualization table if present
    let fullContent = content;
    if (visualization) {
      fullContent += this.visualizationToMarkdown(visualization);
    }
    
    switch (format) {
      case 'docx':
        return this.exportToDocx(fullContent, title);
      case 'pdf':
        return this.exportToPdf(fullContent, title);
      case 'pptx':
        return this.exportToPptx(fullContent, title);
      case 'xlsx':
        return this.exportToExcel(fullContent, title);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export content to plain text format with all markdown stripped
   */
  static exportToPlainText(content: string, title?: string): string {
    const lines = content.split('\n');
    const outputLines: string[] = [];

    // Add title if provided
    if (title) {
      outputLines.push(this.stripMarkdown(title));
      outputLines.push('='.repeat(this.stripMarkdown(title).length));
      outputLines.push('');
    }

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Process headers
      if (trimmed.startsWith('# ')) {
        const headerText = this.stripMarkdown(trimmed.replace(/^#\s+/, ''));
        outputLines.push('');
        outputLines.push(headerText);
        outputLines.push('='.repeat(headerText.length));
      } else if (trimmed.startsWith('## ')) {
        const headerText = this.stripMarkdown(trimmed.replace(/^##\s+/, ''));
        outputLines.push('');
        outputLines.push(headerText);
        outputLines.push('-'.repeat(headerText.length));
      } else if (trimmed.startsWith('### ')) {
        const headerText = this.stripMarkdown(trimmed.replace(/^###\s+/, ''));
        outputLines.push('');
        outputLines.push(headerText);
      } else if (trimmed.startsWith('#### ')) {
        const headerText = this.stripMarkdown(trimmed.replace(/^####\s+/, ''));
        outputLines.push('');
        outputLines.push('  ' + headerText);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
        // Bullet points
        const bulletText = this.stripMarkdown(trimmed.replace(/^[-*+]\s+/, ''));
        outputLines.push('  • ' + bulletText);
      } else if (/^\d+\.\s+/.test(trimmed)) {
        // Numbered list
        const listText = this.stripMarkdown(trimmed);
        outputLines.push('  ' + listText);
      } else if (trimmed.startsWith('> ')) {
        // Blockquote
        const quoteText = this.stripMarkdown(trimmed.replace(/^>\s+/, ''));
        outputLines.push('  > ' + quoteText);
      } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        // Horizontal rule
        outputLines.push('');
        outputLines.push('-'.repeat(80));
        outputLines.push('');
      } else if (trimmed) {
        // Regular text
        outputLines.push(this.stripMarkdown(trimmed));
      } else {
        // Empty line
        outputLines.push('');
      }
    }

    return outputLines.join('\n');
  }
}
