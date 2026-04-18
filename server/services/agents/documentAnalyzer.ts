/**
 * Document Analyzer Agent
 * 
 * Specialized agent for comprehensive document analysis.
 * Uses Azure Document Intelligence for structured data extraction
 * and provides thorough insights from financial documents.
 * 
 * This agent's sole objective is to scan every document thoroughly
 * and extract maximum value from attachments.
 */

import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';
import { AzureDocumentIntelligenceProvider } from '../aiProviders/azure.provider';
import type { CompletionRequest } from '../aiProviders/types';

export interface DocumentAnalysisResult {
  success: boolean;
  analysis: {
    documentType: string;
    extractedText?: string;
    structuredData?: any;
    keyFindings: string[];
    tables?: Array<{
      headers: string[];
      rows: string[][];
    }>;
    keyValuePairs?: Record<string, string>;
  };
  error?: string;
  provider: 'azure-document-intelligence' | 'fallback-extraction';
}

export class DocumentAnalyzerAgent {
  /**
   * Main entry point - thoroughly analyze any attached document
   * Strategy: 
   * 1. Try Azure Document Intelligence (OCR + structured extraction)
   * 2. If Azure fails or returns minimal text, try pdf-parse for text-based PDFs
   * 3. Combine results if both provide useful data
   */
  async analyzeDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<DocumentAnalysisResult> {
    console.log(`[DocumentAnalyzer] Starting analysis of ${filename} (${mimeType}), ${buffer.length} bytes`);

    // Tabular formats: parse to structured rows directly; Azure DI is not suited for row-level extraction.
    if (this.isTabular(mimeType, filename)) {
      try {
        const tabular = await this.parseTabular(buffer, filename, mimeType);
        console.log(`[DocumentAnalyzer] Tabular parse extracted ${tabular.analysis.structuredData?.items?.length || 0} rows`);
        return tabular;
      } catch (error: any) {
        console.error('[DocumentAnalyzer] Tabular parse failed:', error.message);
        // fall through to generic fallback
      }
    }

    let azureResult: DocumentAnalysisResult | null = null;
    let pdfParseResult: DocumentAnalysisResult | null = null;
    
    // Step 1: Try Azure Document Intelligence (has OCR for images and scanned PDFs)
    try {
      azureResult = await this.analyzeWithAzure(buffer, filename, mimeType);
      // FIXED: Lowered threshold from 100 to 20 chars to accept more extractions
      if (azureResult.success && azureResult.analysis.extractedText && azureResult.analysis.extractedText.length > 20) {
        console.log(`[DocumentAnalyzer] Azure DI extracted ${azureResult.analysis.extractedText.length} chars`);
        return azureResult;
      }
      console.log('[DocumentAnalyzer] Azure DI returned minimal/no text');
    } catch (error: any) {
      console.log('[DocumentAnalyzer] Azure DI failed:', error.message);
    }
    
    // Step 2: For PDFs, also try pdf-parse (works better for text-based PDFs)
    if (mimeType === 'application/pdf') {
      try {
        pdfParseResult = await this.fallbackExtraction(buffer, filename, mimeType);
        // FIXED: Lowered threshold from 100 to 20 chars
        if (pdfParseResult.success && pdfParseResult.analysis.extractedText && pdfParseResult.analysis.extractedText.length > 20) {
          console.log(`[DocumentAnalyzer] pdf-parse extracted ${pdfParseResult.analysis.extractedText.length} chars`);
          
          // If Azure also got some text, combine them
          if (azureResult?.analysis?.extractedText && azureResult.analysis.extractedText.length > 10) {
            pdfParseResult.analysis.extractedText = 
              `--- Azure OCR Analysis ---\n${azureResult.analysis.extractedText}\n\n--- PDF Text Extraction ---\n${pdfParseResult.analysis.extractedText}`;
            pdfParseResult.provider = 'hybrid';
          }
          return pdfParseResult;
        }
      } catch (error: any) {
        console.log('[DocumentAnalyzer] pdf-parse failed:', error.message);
      }
    }
    
    // Step 3: Return whatever we got, preferring Azure results
    if (azureResult?.success) {
      return azureResult;
    }
    if (pdfParseResult?.success) {
      return pdfParseResult;
    }
    
    // Step 4: Return partial results even if below success threshold
    // This ensures user sees SOMETHING extracted rather than silent failure
    if (azureResult?.analysis?.extractedText && azureResult.analysis.extractedText.length > 0) {
      console.warn(`[DocumentAnalyzer] Returning Azure partial result (${azureResult.analysis.extractedText.length} chars)`);
      return {
        ...azureResult,
        success: true, // Mark as successful so content is included
        analysis: {
          ...azureResult.analysis,
          extractedText: azureResult.analysis.extractedText + 
            `\n\n[Note: Limited text extracted from document. If this seems incomplete, the document may be image-based or poorly formatted.]`
        }
      };
    }
    
    if (pdfParseResult?.analysis?.extractedText && pdfParseResult.analysis.extractedText.length > 0) {
      console.warn(`[DocumentAnalyzer] Returning pdf-parse partial result (${pdfParseResult.analysis.extractedText.length} chars)`);
      return {
        ...pdfParseResult,
        success: true,
        analysis: {
          ...pdfParseResult.analysis,
          extractedText: pdfParseResult.analysis.extractedText + 
            `\n\n[Note: Limited text extracted from document. If this seems incomplete, the document may be image-based or poorly formatted.]`
        }
      };
    }
    
    // Step 5: For images without Azure DI, return helpful message
    if (mimeType.startsWith('image/')) {
      return {
        success: true, // Changed to true so message is shown to AI
        analysis: {
          documentType: 'image',
          extractedText: `[Image file uploaded: ${filename}]\n\nTo extract text from images, Azure Document Intelligence with OCR is required. Please ensure AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY are configured.\n\nAlternatively, you can describe the image content in your message.`,
          keyFindings: [],
        },
        error: 'OCR requires Azure Document Intelligence',
        provider: 'fallback-extraction'
      };
    }
    
    // Step 6: Last resort fallback
    try {
      return await this.fallbackExtraction(buffer, filename, mimeType);
    } catch (error: any) {
      // Even on total failure, inform the AI that a file was attached
      return {
        success: true, // Changed to true so AI knows a file was attempted
        analysis: { 
          documentType: 'unknown', 
          extractedText: `[Document uploaded: ${filename}]\n\nUnable to extract text from this document. Error: ${error.message}\n\nPlease describe the document content in your message, or try uploading a different format.`,
          keyFindings: [] 
        },
        error: error.message,
        provider: 'fallback-extraction'
      };
    }
  }

  /**
   * Use Azure Document Intelligence for comprehensive structured extraction
   */
  private async analyzeWithAzure(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<DocumentAnalysisResult> {
    try {
      // Get Azure DI provider from registry
      const provider = aiProviderRegistry.getProvider(AIProviderName.AZURE_DOCUMENT_INTELLIGENCE) as AzureDocumentIntelligenceProvider;
      
      if (!provider) {
        throw new Error('Azure Document Intelligence provider not available');
      }

      // Use Azure DI provider's generateCompletion with attachment.
      // Pass a filename-based documentType hint so specialized models (receipt,
      // invoice, W-2, 1040, ...) are selected when the filename indicates one.
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Please analyze this document comprehensively.' }],
        attachment: {
          buffer,
          filename,
          mimeType,
          documentType: this.hintDocumentType(filename),
        }
      };

      const azureResponse = await provider.generateCompletion(request);

      if (!azureResponse) {
        return {
          success: false,
          analysis: {
            documentType: 'unknown',
            keyFindings: [],
          },
          error: 'Azure Document Intelligence returned no results',
          provider: 'azure-document-intelligence'
        };
      }

      console.log(`[DocumentAnalyzer] Azure response received: ${azureResponse.content?.length || 0} chars, tables=${azureResponse.metadata?.tables?.length ?? 0}, kvPairs=${azureResponse.metadata?.keyValuePairs?.length ?? 0}`);

      // Extract comprehensive data from Azure response
      // The content from Azure DI is already formatted markdown with extracted text
      const extractedText = azureResponse.content || '';
      const tables = this.extractTables(azureResponse.metadata);
      const keyValuePairs = this.extractKeyValuePairs(azureResponse.metadata);
      const items = this.synthesizeItemsFromTables(tables);

      const analysis = {
        documentType: this.detectDocumentType(filename, azureResponse.metadata),
        extractedText: extractedText,
        // structuredData carries downstream-useful shapes: items (for per-row forensic
        // detection), tables (for evidence provenance), keyValuePairs (for key findings).
        structuredData: {
          ...(azureResponse.metadata || {}),
          items,
          rowCount: items.length,
          tables,
          keyValuePairs,
        },
        keyFindings: this.extractKeyFindings(azureResponse.metadata),
        tables,
        keyValuePairs,
      };

      // FIXED: Lowered threshold from 50 to 10 chars to be less strict
      if (!extractedText || extractedText.length < 10) {
        console.warn('[DocumentAnalyzer] Azure DI returned minimal/no content, falling back');
        return {
          success: false,
          analysis,
          error: 'Azure DI returned minimal content',
          provider: 'azure-document-intelligence'
        };
      }

      return {
        success: true,
        analysis,
        provider: 'azure-document-intelligence'
      };

    } catch (error: any) {
      console.error('[DocumentAnalyzer] Azure DI error:', error.message);
      return {
        success: false,
        analysis: {
          documentType: 'unknown',
          keyFindings: [],
        },
        error: error.message,
        provider: 'azure-document-intelligence'
      };
    }
  }

  /**
   * Pick an Azure DI document-type hint from filename so specialised models
   * run when we have evidence the file is an invoice / receipt / tax form.
   * Undefined means "use the provider default" (layout).
   */
  private hintDocumentType(filename: string): string | undefined {
    const lower = (filename || '').toLowerCase();
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('invoice')) return 'invoice';
    if (lower.includes('w-2') || lower.includes('w2')) return 'w2';
    if (lower.includes('1040')) return '1040';
    if (lower.includes('1098')) return '1098';
    if (lower.includes('1099')) return '1099';
    return undefined;
  }

  private isTabular(mimeType: string, filename: string): boolean {
    const mt = (mimeType || '').toLowerCase();
    const fn = (filename || '').toLowerCase();
    return (
      mt === 'text/csv' ||
      mt === 'application/vnd.ms-excel' ||
      mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fn.endsWith('.csv') ||
      fn.endsWith('.xls') ||
      fn.endsWith('.xlsx')
    );
  }

  /**
   * Parse CSV / XLSX / XLS into structured rows.
   * Returns structuredData.items so forensic agents can iterate transactions.
   */
  private async parseTabular(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<DocumentAnalysisResult> {
    const fn = filename.toLowerCase();
    const isCSV = mimeType === 'text/csv' || fn.endsWith('.csv');
    const rawRows: Array<Record<string, any>> = isCSV
      ? this.parseCSV(buffer)
      : await this.parseXLSX(buffer);

    const rows = rawRows.map(r => this.normalizeRow(r));

    if (rows.length === 0) {
      return {
        success: true,
        analysis: {
          documentType: 'tabular',
          extractedText: `[Empty tabular file: ${filename}]`,
          structuredData: { items: [], rowCount: 0 },
          keyFindings: [],
        },
        provider: 'fallback-extraction',
      };
    }

    const headers = Object.keys(rows[0]);
    const preview = rows.slice(0, 20);
    const previewText = [
      headers.join(' | '),
      ...preview.map(r => headers.map(h => String(r[h] ?? '')).join(' | ')),
    ].join('\n');

    return {
      success: true,
      analysis: {
        documentType: 'tabular',
        extractedText:
          `Tabular data from ${filename}: ${rows.length} rows, ${headers.length} columns\n` +
          `Columns: ${headers.join(', ')}\n\n` +
          `Preview (first 20 rows):\n${previewText}`,
        structuredData: {
          items: rows,
          rowCount: rows.length,
          headers,
        },
        keyFindings: [`Parsed ${rows.length} rows across ${headers.length} columns`],
      },
      provider: 'fallback-extraction',
    };
  }

  /**
   * Add canonical aliases (Amount / Date / Vendor) on top of existing columns
   * so the forensic agents can find values across heterogeneous column names.
   */
  private normalizeRow(row: Record<string, any>): Record<string, any> {
    const amountKeys = ['amount', 'txnamount', 'transactionamount', 'value', 'debit', 'credit', 'total', 'totalamount', 'amt', 'grossamount', 'netamount'];
    const dateKeys = ['date', 'transactiondate', 'txndate', 'postdate', 'postingdate', 'valuedate', 'invoicedate', 'entrydate'];
    const vendorKeys = ['vendor', 'vendorname', 'payee', 'beneficiary', 'supplier', 'counterparty', 'party', 'description', 'narration'];

    const out: Record<string, any> = { ...row };
    const lookup: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      lookup[String(k).toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
    }

    const pick = (aliases: string[]): any => {
      for (const a of aliases) {
        const v = lookup[a];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    };

    const amt = pick(amountKeys);
    if (amt !== undefined && out.Amount === undefined) out.Amount = amt;
    if (amt !== undefined && out.totalAmount === undefined) {
      const parsed = typeof amt === 'number' ? amt : parseFloat(String(amt).replace(/[^0-9.\-]/g, ''));
      if (!isNaN(parsed)) out.totalAmount = parsed;
    }

    const dt = pick(dateKeys);
    if (dt !== undefined && out.Date === undefined) out.Date = dt;
    if (dt !== undefined && out.transactionDate === undefined) out.transactionDate = dt;

    const vn = pick(vendorKeys);
    if (vn !== undefined && out.Vendor === undefined) out.Vendor = vn;
    if (vn !== undefined && out.vendor === undefined) out.vendor = vn;

    return out;
  }

  private parseCSV(buffer: Buffer): Array<Record<string, any>> {
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const splitCsvLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { cur += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { out.push(cur); cur = ''; }
          else { cur += ch; }
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };

    const headers = splitCsvLine(lines[0]);
    const rows: Array<Record<string, any>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i]);
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      rows.push(row);
    }
    return rows;
  }

  private async parseXLSX(buffer: Buffer): Promise<Array<Record<string, any>>> {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? `col${colNumber}`).trim();
    });

    const rows: Array<Record<string, any>> = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const obj: Record<string, any> = {};
      let anyValue = false;
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        let v: any = cell.value;
        if (v && typeof v === 'object' && 'text' in v) v = (v as any).text;
        if (v && typeof v === 'object' && 'result' in v) v = (v as any).result;
        if (v !== null && v !== undefined && v !== '') anyValue = true;
        obj[h] = v ?? '';
      });
      if (anyValue) rows.push(obj);
    }
    return rows;
  }

  /**
   * Fallback extraction using pdf-parse for PDFs or basic text extraction
   */
  private async fallbackExtraction(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<DocumentAnalysisResult> {
    try {
      let extractedText = '';

      // For PDFs, use pdf-parse
      if (mimeType === 'application/pdf') {
        // Import the internal module directly. pdf-parse's top-level index.js
        // has a "debug mode" check (`!module.parent`) that reads a nonexistent
        // test PDF under ESM dynamic import, causing ENOENT. The actual parser
        // lives in lib/pdf-parse.js and has no such side effect.
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js' as any)).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
        console.log(`[DocumentAnalyzer] PDF parsed: ${extractedText.length} characters extracted`);
      } else if (mimeType.startsWith('image/')) {
        // For images, we can't extract text without OCR
        // Azure DI would handle this, but for fallback just note the limitation
        extractedText = `[Image file: ${filename}]\nNote: Image text extraction requires Azure Document Intelligence. Please configure AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY for OCR support.`;
        console.log('[DocumentAnalyzer] Image file - fallback cannot extract text');
      } else {
        // For other formats, attempt basic buffer conversion
        extractedText = buffer.toString('utf-8');
        console.log(`[DocumentAnalyzer] Text extracted from buffer: ${extractedText.length} characters`);
      }

      // Limit text to prevent overwhelming responses
      const limitedText = extractedText.substring(0, 15000);

      return {
        success: true,
        analysis: {
          documentType: this.detectDocumentType(filename, null),
          extractedText: limitedText,
          keyFindings: this.extractBasicFindings(limitedText),
        },
        provider: 'fallback-extraction'
      };

    } catch (error: any) {
      console.error('[DocumentAnalyzer] Fallback extraction error:', error);
      return {
        success: false,
        analysis: {
          documentType: 'unknown',
          keyFindings: [],
        },
        error: error.message,
        provider: 'fallback-extraction'
      };
    }
  }

  /**
   * Detect document type from filename and content
   */
  private detectDocumentType(filename: string, azureResponse: any): string {
    const lower = filename.toLowerCase();
    
    // Check filename patterns
    if (lower.includes('annual') && lower.includes('report')) return 'Annual Report';
    if (lower.includes('financial') && lower.includes('statement')) return 'Financial Statement';
    if (lower.includes('balance') && lower.includes('sheet')) return 'Balance Sheet';
    if (lower.includes('income') && lower.includes('statement')) return 'Income Statement';
    if (lower.includes('cash') && lower.includes('flow')) return 'Cash Flow Statement';
    if (lower.includes('tax') && lower.includes('return')) return 'Tax Return';
    if (lower.includes('audit')) return 'Audit Report';
    if (lower.includes('invoice')) return 'Invoice';
    if (lower.includes('receipt')) return 'Receipt';
    if (lower.includes('contract')) return 'Contract';
    
    // Check Azure DI response if available
    if (azureResponse?.docType) return azureResponse.docType;
    
    return 'Financial Document';
  }

  /**
   * Extract key findings from Azure DI response
   */
  private extractKeyFindings(azureResponse: any): string[] {
    const findings: string[] = [];
    
    // Extract from key-value pairs
    if (azureResponse.keyValuePairs) {
      const pairs = azureResponse.keyValuePairs;
      
      // Look for important financial fields
      const importantKeys = [
        'company', 'revenue', 'assets', 'liabilities', 'equity',
        'net income', 'total', 'location', 'jurisdiction', 'date',
        'tax year', 'fiscal year', 'geography', 'operations'
      ];
      
      Object.entries(pairs).forEach(([key, value]) => {
        const keyLower = key.toLowerCase();
        if (importantKeys.some(k => keyLower.includes(k))) {
          findings.push(`${key}: ${value}`);
        }
      });
    }
    
    return findings;
  }

  /**
   * Convert Azure DI tables into a {headers, rows} representation.
   * Azure returns `cells: [{ rowIndex, columnIndex, content, kind? }]`; we need
   * to group cells into rows and treat row 0 (or cells with kind='columnHeader')
   * as headers.
   */
  private extractTables(azureResponse: any): Array<{ headers: string[]; rows: string[][] }> {
    const src = azureResponse?.tables;
    if (!Array.isArray(src) || src.length === 0) return [];

    return src.map((table: any) => {
      const cells: any[] = Array.isArray(table.cells) ? table.cells : [];
      const rowCount = table.rowCount ?? cells.reduce((m, c) => Math.max(m, (c.rowIndex ?? 0) + 1), 0);
      const colCount = table.columnCount ?? cells.reduce((m, c) => Math.max(m, (c.columnIndex ?? 0) + 1), 0);

      const grid: string[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(''));
      for (const c of cells) {
        const r = c.rowIndex ?? 0;
        const col = c.columnIndex ?? 0;
        if (r < rowCount && col < colCount) {
          grid[r][col] = String(c.content ?? '').trim();
        }
      }

      // Heuristic: if any cell on the first row is marked columnHeader, or if the first row
      // is non-numeric, treat it as headers.
      let headers: string[];
      let rows: string[][];
      const hasExplicitHeaders = cells.some((c: any) => c.kind === 'columnHeader');
      if (hasExplicitHeaders || (grid[0] && grid[0].every(v => v && isNaN(Number(v.replace(/[,$]/g, '')))))) {
        headers = grid[0] ?? [];
        rows = grid.slice(1);
      } else {
        headers = Array.from({ length: colCount }, (_, i) => `col${i + 1}`);
        rows = grid;
      }
      return { headers, rows };
    });
  }

  /**
   * Convert Azure DI tables into row objects suitable for forensic per-row detection.
   * Uses the same normalization as CSV/XLSX parsing (Amount/Date/Vendor aliases).
   */
  private synthesizeItemsFromTables(tables: Array<{ headers: string[]; rows: string[][] }>): any[] {
    const items: any[] = [];
    for (const t of tables) {
      for (const row of t.rows) {
        const obj: Record<string, any> = {};
        t.headers.forEach((h, i) => {
          if (h) obj[h] = row[i] ?? '';
        });
        if (Object.keys(obj).length > 0) {
          items.push(this.normalizeRow(obj));
        }
      }
    }
    return items;
  }

  /**
   * Extract key-value pairs from Azure DI response.
   * Azure returns `[{ key: {content}, value: {content} }]`.
   */
  private extractKeyValuePairs(azureResponse: any): Record<string, string> {
    const src = azureResponse?.keyValuePairs;
    if (!Array.isArray(src)) return {};
    const out: Record<string, string> = {};
    for (const pair of src) {
      const k = (pair?.key?.content ?? '').trim();
      const v = (pair?.value?.content ?? '').trim();
      if (k) out[k] = v;
    }
    return out;
  }

  /**
   * Extract basic findings from plain text (fallback)
   */
  private extractBasicFindings(text: string): string[] {
    const findings: string[] = [];
    const lines = text.split('\n');
    
    // Look for lines that might contain important information
    const patterns = [
      /company.*:/i,
      /revenue.*:/i,
      /total.*:/i,
      /location.*:/i,
      /geography.*:/i,
      /operations.*:/i,
      /jurisdiction.*:/i,
      /fiscal.*year.*:/i,
      /tax.*year.*:/i
    ];
    
    lines.forEach(line => {
      if (patterns.some(pattern => pattern.test(line))) {
        findings.push(line.trim());
      }
    });
    
    return findings.slice(0, 20); // Limit to top 20 findings
  }
}

// Export singleton instance
export const documentAnalyzerAgent = new DocumentAnalyzerAgent();
