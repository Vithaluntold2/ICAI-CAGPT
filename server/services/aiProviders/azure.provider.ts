/**
 * Azure AI Document Intelligence Provider
 * Specialized for financial document analysis (invoices, receipts, tax forms, statements)
 */

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from '@azure/ai-form-recognizer';
import { AIProvider } from './base';
import {
  AIProviderName,
  ProviderFeature,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  CostEstimate,
  ProviderError,
} from './types';

export class AzureDocumentIntelligenceProvider extends AIProvider {
  private client: DocumentAnalysisClient | null = null;
  private endpoint: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super(config);
    
    if (!config.endpoint) {
      throw new Error('Azure Document Intelligence endpoint is required');
    }
    if (!config.apiKey) {
      throw new Error('Azure Document Intelligence API key is required');
    }

    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;

    try {
      this.client = new DocumentAnalysisClient(
        this.endpoint,
        new AzureKeyCredential(this.apiKey)
      );
    } catch (error) {
      console.error('[Azure] Failed to initialize Document Intelligence client:', error);
      throw new ProviderError(
        'Failed to initialize Azure Document Intelligence',
        AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
        'INIT_ERROR',
        false,
        error
      );
    }
  }

  getName(): AIProviderName {
    return AIProviderName.AZURE_DOCUMENT_INTELLIGENCE;
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    this.validateRequest(request);

    if (!this.client) {
      throw new ProviderError(
        'Azure client not initialized',
        AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
        'CLIENT_ERROR',
        false
      );
    }

    try {
      // Check for attachment in request first (new architecture)
      if (request.attachment) {
        // Use the provided attachment buffer
        const documentType = this.mapMimeTypeToDocumentType(request.attachment.mimeType, request.attachment.documentType);
        const model = this.selectModel(documentType);
        
        console.log(`[Azure] Analyzing document from attachment: ${request.attachment.filename} (${request.attachment.mimeType})`);
        
        const poller = await this.client.beginAnalyzeDocument(model, request.attachment.buffer);
        const result = await poller.pollUntilDone();
        
        // Format the analysis results
        const formattedResult = this.formatAnalysisResult(result, documentType);

        return {
          content: formattedResult,
          tokensUsed: {
            input: this.estimateTokenCount(request.messages),
            output: Math.ceil(formattedResult.length / 4),
            total: this.estimateTokenCount(request.messages) + Math.ceil(formattedResult.length / 4),
          },
          model: model,
          provider: AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
          finishReason: 'stop',
          metadata: {
            documentType: documentType,
            pagesAnalyzed: result.pages?.length || 0,
            filename: request.attachment.filename,
          },
        };
      }
      
      // Fallback: Extract document URL or data from the last user message (legacy)
      const lastMessage = request.messages[request.messages.length - 1];
      const documentInfo = this.extractDocumentInfo(lastMessage.content);

      // Use prebuilt models for financial documents
      const model = this.selectModel(documentInfo.type);
      
      let result;
      if (documentInfo.url) {
        // Analyze from URL
        const poller = await this.client.beginAnalyzeDocumentFromUrl(
          model,
          documentInfo.url
        );
        result = await poller.pollUntilDone();
      } else if (documentInfo.base64Data) {
        // Analyze from base64 data
        const buffer = Buffer.from(documentInfo.base64Data, 'base64');
        const poller = await this.client.beginAnalyzeDocument(model, buffer);
        result = await poller.pollUntilDone();
      } else {
        // No document - throw retryable error for fallback
        throw new ProviderError(
          'No document URL or data provided',
          AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
          'NO_DOCUMENT',
          true // Retryable - allows fallback to other providers
        );
      }

      // Format the analysis results
      const formattedResult = this.formatAnalysisResult(result, documentInfo.type);

      return {
        content: formattedResult,
        tokensUsed: {
          input: this.estimateTokenCount(request.messages),
          output: Math.ceil(formattedResult.length / 4),
          total: this.estimateTokenCount(request.messages) + Math.ceil(formattedResult.length / 4),
        },
        model: model,
        provider: AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
        finishReason: 'stop',
        metadata: {
          documentType: documentInfo.type,
          pagesAnalyzed: result.pages?.length || 0,
        },
      };
    } catch (error: any) {
      console.error('[Azure] Document analysis failed:', error);
      
      // If it's already a ProviderError, preserve its retryable status
      if (error instanceof ProviderError) {
        throw error;
      }
      
      // For other errors, determine retryability from status code
      const isRetryable = error.statusCode === 429 || error.statusCode >= 500;
      
      throw new ProviderError(
        error.message || 'Azure Document Intelligence analysis failed',
        AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
        error.code || 'ANALYSIS_ERROR',
        isRetryable,
        error
      );
    }
  }

  supportsFeature(feature: ProviderFeature): boolean {
    const supportedFeatures = [
      ProviderFeature.DOCUMENT_INTELLIGENCE,
      ProviderFeature.STRUCTURED_OUTPUT,
      ProviderFeature.VISION,
    ];
    return supportedFeatures.includes(feature);
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    // Azure Document Intelligence pricing (approximate)
    // ~$1.50 per 1000 pages for prebuilt models
    const estimatedPages = 1; // Default to 1 page
    const costPerPage = 0.0015; // $1.50 / 1000
    
    return {
      inputCost: costPerPage * estimatedPages,
      outputCost: 0,
      totalCost: costPerPage * estimatedPages,
      currency: 'USD',
    };
  }

  getAvailableModels(): string[] {
    return [
      'prebuilt-read',      // OCR - best for text extraction
      'prebuilt-layout',    // Layout analysis with tables
      'prebuilt-invoice',
      'prebuilt-receipt',
      'prebuilt-tax.us.w2',
      'prebuilt-tax.us.1040',
      'prebuilt-tax.us.1098',
      'prebuilt-tax.us.1099',
      'prebuilt-document',
    ];
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Simple health check - client initialization succeeded
      return true;
    } catch (error) {
      console.error('[Azure] Health check failed:', error);
      return false;
    }
  }

  /**
   * Extract document URL or base64 data from message content
   */
  private extractDocumentInfo(content: string): {
    url?: string;
    base64Data?: string;
    type: string;
  } {
    // Try to parse JSON format: {"url": "...", "type": "invoice"}
    try {
      const parsed = JSON.parse(content);
      return {
        url: parsed.url,
        base64Data: parsed.data,
        type: parsed.type || 'document',
      };
    } catch {
      // Check if content is a URL
      if (content.startsWith('http://') || content.startsWith('https://')) {
        return { url: content, type: 'document' };
      }
      
      // Check if content is base64 data (more than 100 chars, mostly base64 chars)
      if (content.length > 100 && content.match(/^[A-Za-z0-9+/]+=*$/)) {
        return { base64Data: content, type: 'document' };
      }

      // No document found - this is a retryable error (fallback to other providers)
      throw new ProviderError(
        'No document attached. Azure Document Intelligence requires a document URL or file data.',
        AIProviderName.AZURE_DOCUMENT_INTELLIGENCE,
        'NO_DOCUMENT',
        true // This is retryable - allows fallback to other providers
      );
    }
  }

  /**
   * Select the appropriate Azure model based on document type
   */
  /**
   * Map MIME type to document type for model selection
   */
  private mapMimeTypeToDocumentType(mimeType: string, documentType?: string): string {
    // If explicit documentType provided, use it
    if (documentType) {
      return documentType;
    }
    
    // Map common MIME types to document types
    // Use 'read' for images to trigger OCR with prebuilt-read model
    const mimeToTypeMap: Record<string, string> = {
      'application/pdf': 'read',  // Use OCR-capable model for all PDFs
      'image/png': 'read',        // OCR for images
      'image/jpeg': 'read',       // OCR for images
      'image/jpg': 'read',        // OCR for images  
      'image/tiff': 'read',       // OCR for images
      'image/tif': 'read',        // OCR for images
    };
    
    return mimeToTypeMap[mimeType.toLowerCase()] || 'read';
  }

  private selectModel(documentType: string): string {
    const modelMap: Record<string, string> = {
      // OCR model - best for text extraction from any document
      read: 'prebuilt-read',
      // Specialized models for structured documents
      invoice: 'prebuilt-invoice',
      receipt: 'prebuilt-receipt',
      w2: 'prebuilt-tax.us.w2',
      '1040': 'prebuilt-tax.us.1040',
      '1098': 'prebuilt-tax.us.1098',
      '1099': 'prebuilt-tax.us.1099',
      tax: 'prebuilt-document',
      document: 'prebuilt-read',  // Use read model for general documents
    };

    return modelMap[documentType.toLowerCase()] || 'prebuilt-read';
  }

  /**
   * Format analysis results into readable text
   */
  private formatAnalysisResult(result: any, documentType: string): string {
    let output = `# Document Analysis Results\n\n`;
    output += `**Document Type:** ${documentType}\n`;
    output += `**Pages Analyzed:** ${result.pages?.length || 0}\n\n`;

    // Extract key-value pairs
    if (result.keyValuePairs && result.keyValuePairs.length > 0) {
      output += `## Extracted Fields\n\n`;
      for (const pair of result.keyValuePairs) {
        const key = pair.key?.content || 'Unknown';
        const value = pair.value?.content || 'N/A';
        output += `- **${key}:** ${value}\n`;
      }
      output += '\n';
    }

    // Extract tables
    if (result.tables && result.tables.length > 0) {
      output += `## Tables\n\n`;
      for (let i = 0; i < result.tables.length; i++) {
        const table = result.tables[i];
        output += `### Table ${i + 1}\n`;
        output += `Rows: ${table.rowCount}, Columns: ${table.columnCount}\n\n`;
        
        // Format first few rows as preview
        if (table.cells && table.cells.length > 0) {
          const preview = table.cells.slice(0, 10);
          for (const cell of preview) {
            output += `Row ${cell.rowIndex}, Col ${cell.columnIndex}: ${cell.content}\n`;
          }
          if (table.cells.length > 10) {
            output += `... (${table.cells.length - 10} more cells)\n`;
          }
        }
        output += '\n';
      }
    }

    // Extract text content - Azure DI returns content in multiple places
    // Priority: result.content > pages[].lines > paragraphs
    let fullText = '';
    
    // Try result.content first (some models return this directly)
    if (result.content) {
      fullText = result.content;
    } 
    // Try extracting from pages (most common for prebuilt-document model)
    else if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        // Extract from lines (most reliable)
        if (page.lines && page.lines.length > 0) {
          for (const line of page.lines) {
            fullText += (line.content || '') + '\n';
          }
        }
        // Fallback to words if no lines
        else if (page.words && page.words.length > 0) {
          fullText += page.words.map((w: any) => w.content).join(' ') + '\n';
        }
      }
    }
    // Try paragraphs (some models structure text this way)
    else if (result.paragraphs && result.paragraphs.length > 0) {
      for (const para of result.paragraphs) {
        fullText += (para.content || '') + '\n\n';
      }
    }

    if (fullText.trim()) {
      output += `## Full Text Content\n\n`;
      const trimmedText = fullText.trim();
      output += trimmedText.substring(0, 8000); // Limit to 8000 chars
      if (trimmedText.length > 8000) {
        output += `\n\n... (${trimmedText.length - 8000} more characters)`;
      }
      console.log(`[Azure] Extracted ${trimmedText.length} characters of text content`);
    } else {
      output += `## Text Content\n\n*No readable text content was extracted from this document.*\n`;
      console.log('[Azure] No text content extracted from document');
    }

    return output;
  }
}
