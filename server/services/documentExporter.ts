import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from 'docx';
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
  /**
   * Build a docx Table from parsed GFM headers + rows.
   */
  private static buildDocxTable(headers: string[], rows: string[][]): Table {
    const headerCells = headers.map(h => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: this.stripMarkdown(h), bold: true })] })],
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F4F6' },
    }));
    const bodyRows = rows.map(r => new TableRow({
      children: r.map(c => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: this.stripMarkdown(c) })] })],
      })),
    }));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: headerCells, tableHeader: true }), ...bodyRows],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
      },
    });
  }

  static async exportToDocx(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const lines = content.split('\n');
    const children: Array<Paragraph | Table> = [];

    // Add title
    children.push(
      new Paragraph({
        text: this.stripMarkdown(title),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Process content line-by-line, consuming multiple lines for table / code blocks.
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // --- Fenced code block ---
      const fenceMatch = /^```(\w*)\s*$/.exec(trimmed);
      if (fenceMatch) {
        const lang = fenceMatch[1] || '';
        const bodyLines: string[] = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
          bodyLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;

        if (lang.toLowerCase() === 'mermaid') {
          children.push(new Paragraph({
            children: [new TextRun({ text: '[Diagram — rendered version available in the app]', italics: true, color: '666666' })],
            spacing: { before: 100, after: 100 },
          }));
        } else {
          // Render as monospace block (one paragraph per code line)
          for (const codeLine of bodyLines) {
            children.push(new Paragraph({
              children: [new TextRun({ text: codeLine, font: 'Courier New', size: 20 })],
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' },
            }));
          }
          children.push(new Paragraph({ text: '' }));
        }
        continue;
      }

      // --- GFM table block ---
      const table = this.parseTableBlock(lines, i);
      if (table) {
        children.push(this.buildDocxTable(table.headers, table.rows));
        children.push(new Paragraph({ text: '' }));
        i = table.end;
        continue;
      }

      // Handle headers
      if (trimmed.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^#\s+/, '')),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmed.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^##\s+/, '')),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 100 },
          })
        );
      } else if (trimmed.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^###\s+/, '')),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 50 },
          })
        );
      } else if (trimmed.startsWith('#### ')) {
        children.push(
          new Paragraph({
            text: this.stripMarkdown(trimmed.replace(/^####\s+/, '')),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 100, after: 50 },
          })
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
        // Bullet point
        const bulletText = this.stripMarkdown(trimmed.replace(/^[-*+]\s+/, ''));
        children.push(
          new Paragraph({
            text: bulletText,
            bullet: { level: 0 },
            spacing: { after: 50 },
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed)) {
        // Numbered list
        const listText = this.stripMarkdown(trimmed.replace(/^\d+\.\s+/, ''));
        children.push(
          new Paragraph({
            text: listText,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { after: 50 },
          })
        );
      } else if (trimmed.startsWith('> ')) {
        // Blockquote
        const quoteText = this.stripMarkdown(trimmed.replace(/^>\s+/, ''));
        children.push(
          new Paragraph({
            text: quoteText,
            
            indent: { left: 720 }, // 0.5 inch indent
            spacing: { after: 100 },
          })
        );
      } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        // Horizontal rule - add an empty paragraph with a border
        children.push(
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
        
        children.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun({ text: this.stripMarkdown(trimmed) })],
            spacing: { after: 100 },
          })
        );
      } else {
        // Empty line
        children.push(new Paragraph({ text: '' }));
      }
      i++;
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children,
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
  /**
   * Remove emoji / pictographic characters.
   *
   * PDFKit's built-in fonts (Helvetica / Times / Courier) only cover Latin-1,
   * so emoji codepoints render as garbled ANSI punctuation like "Ø=ÜÊ".
   * DOCX / PPTX / XLSX can technically render emoji if the end-user's Office
   * install has a colour-emoji font, but results vary wildly. Stripping them
   * up-front gives us consistent, professional output across every format.
   */
  private static stripEmojis(text: string): string {
    // Covers the main emoji ranges + variation selectors + ZWJ + regional indicators.
    return text.replace(
      /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
      '',
    ).replace(/\s{2,}/g, ' ');
  }

  /**
   * Replace whiteboard <artifact id="..."/> placeholders with a short inline
   * marker — the rendered diagram cannot be embedded in these export formats,
   * but a raw tag in the output is worse than a one-line hint.
   */
  private static stripArtifactTags(text: string): string {
    return text.replace(
      /<artifact\s+id="([^"]+)"\s*\/?>\s*<\/artifact>|<artifact\s+id="([^"]+)"\s*\/>/g,
      () => '[Diagram — view in the app]',
    );
  }

  /**
   * Sanitize text for export to any document format.
   *
   * Returns plain text with markdown syntax stripped, emojis removed (fonts in
   * PDF/DOCX/PPTX/XLSX vary in pictographic coverage — safer to drop them than
   * render garbled codepoints), and whiteboard `<artifact>` placeholders
   * replaced with a one-line hint. ALL exporters reach every user-visible
   * string through this function via their existing stripMarkdown calls.
   */
  private static stripMarkdown(text: string): string {
    if (!text) return '';
    const noArtifacts = this.stripArtifactTags(text);
    const noEmojis = this.stripEmojis(noArtifacts);
    return noEmojis
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
   * Detect a GFM table block starting at `start`.
   * Returns { rows, end } where `end` is the index AFTER the last table line,
   * or null when the block at `start` is not a table.
   */
  private static parseTableBlock(lines: string[], start: number): { headers: string[]; rows: string[][]; end: number } | null {
    const headerLine = lines[start]?.trim();
    const separatorLine = lines[start + 1]?.trim();
    if (!headerLine || !separatorLine) return null;
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;
    if (!/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|$/.test(separatorLine)) return null;

    const splitRow = (raw: string): string[] =>
      raw.replace(/^\||\|$/g, '').split('|').map(c => c.trim());

    const headers = splitRow(headerLine);
    const rows: string[][] = [];
    let i = start + 2;
    while (i < lines.length) {
      const rowLine = lines[i].trim();
      if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;
      rows.push(splitRow(rowLine));
      i++;
    }
    return { headers, rows, end: i };
  }

  /**
   * Render a table block into the PDF using pdfkit primitives.
   */
  private static renderPdfTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
  ): void {
    const marginLeft = (doc.page.margins?.left ?? 50);
    const marginRight = (doc.page.margins?.right ?? 50);
    const tableWidth = doc.page.width - marginLeft - marginRight;
    const colCount = Math.max(1, headers.length);
    const colWidth = tableWidth / colCount;
    const cellPadX = 4;
    const cellPadY = 3;

    const measureRowHeight = (cells: string[], font: string, size: number): number => {
      doc.font(font).fontSize(size);
      let h = 0;
      for (const c of cells) {
        const text = DocumentExporter.stripMarkdown(c || '');
        const textH = doc.heightOfString(text || ' ', { width: colWidth - cellPadX * 2 });
        if (textH > h) h = textH;
      }
      return h + cellPadY * 2;
    };

    const drawRow = (cells: string[], y: number, height: number, bold: boolean, fill?: string) => {
      if (fill) {
        doc.save();
        doc.rect(marginLeft, y, tableWidth, height).fill(fill);
        doc.restore();
      }
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000000');
      for (let c = 0; c < colCount; c++) {
        const text = DocumentExporter.stripMarkdown(cells[c] ?? '');
        doc.text(text, marginLeft + c * colWidth + cellPadX, y + cellPadY, {
          width: colWidth - cellPadX * 2,
          height: height - cellPadY * 2,
          ellipsis: false,
        });
      }
      // vertical column separators
      doc.strokeColor('#dddddd').lineWidth(0.5);
      for (let c = 0; c <= colCount; c++) {
        const x = marginLeft + c * colWidth;
        doc.moveTo(x, y).lineTo(x, y + height).stroke();
      }
      // top and bottom
      doc.moveTo(marginLeft, y).lineTo(marginLeft + tableWidth, y).stroke();
      doc.moveTo(marginLeft, y + height).lineTo(marginLeft + tableWidth, y + height).stroke();
    };

    const ensureRoom = (neededH: number) => {
      const bottom = doc.page.height - (doc.page.margins?.bottom ?? 50);
      if (doc.y + neededH > bottom) doc.addPage();
    };

    // header
    const headerH = measureRowHeight(headers, 'Helvetica-Bold', 10);
    ensureRoom(headerH);
    drawRow(headers, doc.y, headerH, true, '#f3f4f6');
    doc.y = doc.y + headerH;

    // rows
    for (const row of rows) {
      const h = measureRowHeight(row, 'Helvetica', 10);
      ensureRoom(h);
      drawRow(row, doc.y, h, false);
      doc.y = doc.y + h;
    }

    doc.moveDown(0.4);
    doc.strokeColor('#000000').lineWidth(1); // reset stroke
    // CRITICAL: reset the text cursor x to the left margin.
    // drawRow positions text at marginLeft + colOffset; without this reset,
    // the next doc.text(...) call inherits that column x and renders from
    // the middle of the page.
    doc.x = marginLeft;
  }

  /**
   * Render a fenced code block. For `mermaid`, a placeholder note is emitted
   * (the diagram cannot be rendered server-side without a headless browser);
   * otherwise the block is rendered in a monospace font with a gray background.
   */
  private static renderPdfCodeBlock(
    doc: PDFKit.PDFDocument,
    lang: string,
    body: string,
  ): void {
    if (lang.toLowerCase() === 'mermaid') {
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666')
        .text('[Diagram — rendered version available in the app]');
      doc.fillColor('#000000');
      doc.moveDown(0.3);
      return;
    }

    const marginLeft = (doc.page.margins?.left ?? 50);
    const marginRight = (doc.page.margins?.right ?? 50);
    const blockWidth = doc.page.width - marginLeft - marginRight;
    const padX = 6;
    const padY = 4;

    doc.font('Courier').fontSize(9).fillColor('#111111');
    const textH = doc.heightOfString(body, { width: blockWidth - padX * 2 });

    const bottom = doc.page.height - (doc.page.margins?.bottom ?? 50);
    if (doc.y + textH + padY * 2 + 6 > bottom) doc.addPage();

    doc.save();
    doc.rect(marginLeft, doc.y, blockWidth, textH + padY * 2).fill('#f5f5f5');
    doc.restore();

    doc.font('Courier').fontSize(9).fillColor('#111111')
      .text(body, marginLeft + padX, doc.y + padY, { width: blockWidth - padX * 2 });

    doc.y = doc.y + padY;
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    // Reset text cursor x so the next paragraph starts at the left margin.
    doc.x = marginLeft;
  }

  /**
   * Export content to PDF format. Block-aware: renders GFM tables as real
   * tables, fenced code blocks as code (or as a placeholder for mermaid),
   * and strips whiteboard <artifact/> placeholders.
   */
  static async exportToPdf(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const cleaned = this.stripArtifactTags(content);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text(this.stripMarkdown(title), { align: 'left' });
      doc.moveDown();

      const lines = cleaned.split('\n');
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // --- Fenced code block ---
        const fenceMatch = /^```(\w*)\s*$/.exec(trimmed);
        if (fenceMatch) {
          const lang = fenceMatch[1] || '';
          const bodyLines: string[] = [];
          i++;
          while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
            bodyLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) i++; // skip closing fence
          this.renderPdfCodeBlock(doc, lang, bodyLines.join('\n'));
          continue;
        }

        // --- GFM table block ---
        const table = this.parseTableBlock(lines, i);
        if (table) {
          this.renderPdfTable(doc, table.headers, table.rows);
          i = table.end;
          continue;
        }

        // --- Headings ---
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
          const bulletText = this.stripMarkdown(trimmed.replace(/^[-*+]\s+/, ''));
          doc.fontSize(11).font('Helvetica').text('• ' + bulletText, { indent: 20 });
        } else if (/^\d+\.\s+/.test(trimmed)) {
          const listText = this.stripMarkdown(trimmed);
          doc.fontSize(11).font('Helvetica').text(listText, { indent: 20 });
        } else if (trimmed.startsWith('> ')) {
          const quoteText = this.stripMarkdown(trimmed.replace(/^>\s+/, ''));
          doc.fontSize(11).font('Helvetica-Oblique').fillColor('#666666').text(quoteText, { indent: 30 });
          doc.fillColor('#000000');
        } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
          doc.moveDown(0.3);
        } else if (trimmed) {
          const cleanText = this.stripMarkdown(trimmed);
          doc.fontSize(11).font('Helvetica').text(cleanText, { align: 'left' });
        } else {
          doc.moveDown(0.5);
        }

        i++;
      }

      doc.end();
    });
  }

  /**
   * Replace fenced code / mermaid blocks with a single-line placeholder so the
   * raw source doesn't leak into slides/spreadsheets. Also strips GFM table
   * separator rows (the "|---|---|" dividers) that look like line noise outside
   * a table-aware renderer. Table cell rows are left intact so they still carry
   * information as pipe-delimited lines.
   */
  private static flattenContentForLinearExport(content: string): string {
    // Replace fenced code blocks
    const withoutFences = content.replace(/```(\w*)\s*\n[\s\S]*?\n```/g, (_m, lang) => {
      if ((lang || '').toLowerCase() === 'mermaid') {
        return '[Diagram — rendered version available in the app]';
      }
      return '[Code block — see the app for syntax-highlighted version]';
    });
    // Strip GFM separator rows (they're just noise outside a real table renderer)
    return withoutFences.replace(/^\s*\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|\s*$/gm, '');
  }

  /**
   * Export content to PowerPoint format with markdown cleaning
   */
  static async exportToPptx(content: string, title: string = 'CA GPT Output'): Promise<Buffer> {
    const preprocessed = this.flattenContentForLinearExport(content);
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

    const lines = preprocessed.split('\n');
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
    const preprocessed = this.flattenContentForLinearExport(content);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CA GPT Agent';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Output');

    // Process content and identify tables vs text
    const lines = preprocessed.split('\n');
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
