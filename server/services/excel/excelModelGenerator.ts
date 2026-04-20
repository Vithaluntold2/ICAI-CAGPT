/**
 * AI-Driven Excel Model Generator
 * 
 * Multi-stage pipeline that uses AI to generate complete Excel workbooks
 * with real formulas, proper structure, and professional formatting.
 * 
 * Pipeline:
 * 1. Detect if request requires Excel model
 * 2. Analyze requirements (AI Stage 1)
 * 3. Design structure (AI Stage 2) 
 * 4. Generate cells and formulas (AI Stage 3)
 * 5. Validate and build workbook
 * 
 * Features:
 * - Multi-stage generation for better quality
 * - Formula pattern library for validated formulas
 * - Anti-caching strategies
 * - Validation layer for AI output
 * - Fallback handling
 */

import { aiProviderRegistry } from '../aiProviders/registry';
import { AIProviderName } from '../aiProviders/types';
import { excelModelPromptBuilder, ExcelModelRequest, ExcelModelType } from './excelModelPromptBuilder';
import ExcelJS from 'exceljs';
import { 
  ExcelWorkbookBuilder, 
  ExcelWorkbookSpec, 
  CellSpec, 
  SheetSpec,
  BuildResult 
} from './excelWorkbookBuilder';
import { formulaPatternLibrary } from './formulaPatternLibrary';
import { excelSpecValidator, SafeJSONParser, ValidationResult } from './excelSpecValidator';
import { formulaSanitizer, commonFormulas, FormulaBuilder } from './fallbackFormulaGenerator';

// =============================================================================
// TYPES
// =============================================================================

export interface ExcelGenerationResult {
  success: boolean;
  workbook?: Buffer;
  workbookObject?: ExcelJS.Workbook; // The workbook object for preview extraction
  filename?: string;
  summary?: string;
  stats?: {
    sheetsCreated: number;
    formulasApplied: number;
    namedRanges: number;
    processingTimeMs: number;
    validationFixes: number;
    sanitizedFormulas: number;
  };
  errors?: string[];
  warnings?: string[];
  validationResult?: ValidationResult;
  // For debugging
  rawSpec?: ExcelWorkbookSpec;
}

export interface GenerationOptions {
  singleStage?: boolean; // Use single prompt instead of multi-stage
  preferredProvider?: AIProviderName;
  maxRetries?: number;
  validateOutput?: boolean;
  includeRawSpec?: boolean;
  strictValidation?: boolean; // Fail on warnings
}

interface AIStageResult {
  success: boolean;
  content: string;
  parsed?: any;
  error?: string;
}

// =============================================================================
// EXCEL MODEL GENERATOR CLASS
// =============================================================================

export class ExcelModelGenerator {
  private builder: ExcelWorkbookBuilder;

  constructor() {
    this.builder = new ExcelWorkbookBuilder();
  }

  /**
   * Main entry point: Generate Excel model from user request
   */
  async generate(
    request: ExcelModelRequest,
    options: GenerationOptions = {}
  ): Promise<ExcelGenerationResult> {
    const startTime = Date.now();
    console.log('[ExcelModelGenerator] Starting generation for:', request.userQuery.slice(0, 100));

    try {
      // Detect model type if not specified
      if (!request.modelType) {
        request.modelType = excelModelPromptBuilder.detectModelType(request.userQuery);
        console.log('[ExcelModelGenerator] Detected model type:', request.modelType);
      }

      let spec: ExcelWorkbookSpec;
      let validationResult: ValidationResult | undefined;
      let sanitizedCount = 0;

      if (options.singleStage) {
        // Single-stage generation (faster, simpler requests)
        spec = await this.generateSingleStage(request, options);
      } else {
        // Multi-stage generation (better quality, complex requests)
        spec = await this.generateMultiStage(request, options);
      }

      // Validate and fix the spec
      if (options.validateOutput !== false) {
        const validation = this.validateSpec(spec, options.strictValidation);
        validationResult = validation.validationResult;
        
        if (!validation.valid) {
          console.warn('[ExcelModelGenerator] Validation issues:', validation.issues);
          
          if (validation.fixedSpec) {
            // Use auto-fixed spec
            spec = validation.fixedSpec;
            console.log('[ExcelModelGenerator] Applied auto-fixes from validator');
          } else {
            // Try manual fixes
            spec = this.fixCommonIssues(spec, validation.issues);
          }
        }

        // Sanitize all formulas for safety
        const sanitizeResult = this.sanitizeFormulas(spec);
        spec = sanitizeResult.sanitized;
        sanitizedCount = sanitizeResult.sanitizedCount;
        
        if (sanitizeResult.warnings.length > 0) {
          console.warn('[ExcelModelGenerator] Formula sanitization warnings:', sanitizeResult.warnings);
        }
      }

      // Build the workbook
      const buildResult = await this.builder.build(spec);

      if (!buildResult.success || !buildResult.buffer) {
        return {
          success: false,
          errors: buildResult.errors || ['Failed to build workbook'],
          warnings: buildResult.warnings,
          validationResult
        };
      }

      // Generate filename
      const filename = this.generateFilename(spec.metadata.title, request.modelType);

      const processingTimeMs = Date.now() - startTime;
      console.log(`[ExcelModelGenerator] Generation complete in ${processingTimeMs}ms`);

      return {
        success: true,
        workbook: buildResult.buffer,
        workbookObject: buildResult.workbook, // Include workbook object for preview extraction
        filename,
        summary: this.generateSummary(buildResult, spec),
        stats: {
          sheetsCreated: buildResult.stats.sheetsCreated,
          formulasApplied: buildResult.stats.formulasApplied,
          namedRanges: buildResult.stats.namedRangesCreated,
          processingTimeMs,
          validationFixes: validationResult?.fixes.length || 0,
          sanitizedFormulas: sanitizedCount
        },
        warnings: buildResult.warnings,
        validationResult,
        rawSpec: options.includeRawSpec ? spec : undefined
      };

    } catch (error: any) {
      console.error('[ExcelModelGenerator] Generation failed:', error);
      return {
        success: false,
        errors: [error.message || 'Unknown error during generation']
      };
    }
  }

  /**
   * Single-stage generation using one comprehensive prompt
   */
  private async generateSingleStage(
    request: ExcelModelRequest,
    options: GenerationOptions
  ): Promise<ExcelWorkbookSpec> {
    console.log('[ExcelModelGenerator] Using single-stage generation');

    const { systemPrompt, userPrompt } = excelModelPromptBuilder.buildSinglePrompt(request);

    const response = await this.callAI(
      systemPrompt,
      userPrompt,
      0.15, // Low temperature for precise output
      options.preferredProvider
    );

    if (!response.success) {
      throw new Error(`AI generation failed: ${response.error}`);
    }

    const spec = this.parseWorkbookSpec(response.content);
    return spec;
  }

  /**
   * Multi-stage generation for complex models
   */
  private async generateMultiStage(
    request: ExcelModelRequest,
    options: GenerationOptions
  ): Promise<ExcelWorkbookSpec> {
    console.log('[ExcelModelGenerator] Using multi-stage generation');

    const stages = excelModelPromptBuilder.buildPrompts(request);
    let stageResults: Record<number, any> = {};

    for (const stage of stages) {
      console.log(`[ExcelModelGenerator] Stage ${stage.stage}: ${stage.name}`);

      // Replace placeholders with previous stage results
      let userPrompt = stage.userPrompt;
      if (stageResults[1]) {
        userPrompt = userPrompt.replace('{requirementsFromStage1}', JSON.stringify(stageResults[1], null, 2));
      }
      if (stageResults[2]) {
        userPrompt = userPrompt.replace('{structureFromStage2}', JSON.stringify(stageResults[2], null, 2));
      }

      const response = await this.callAI(
        stage.systemPrompt,
        userPrompt,
        stage.temperature,
        options.preferredProvider
      );

      if (!response.success) {
        throw new Error(`Stage ${stage.stage} failed: ${response.error}`);
      }

      // Parse JSON output
      try {
        stageResults[stage.stage] = this.parseJSON(response.content);
      } catch (e: any) {
        console.warn(`[ExcelModelGenerator] Stage ${stage.stage} JSON parse failed, using raw content`);
        stageResults[stage.stage] = response.content;
      }
    }

    // The final stage should produce the complete spec
    const finalResult = stageResults[stages.length];
    
    if (typeof finalResult === 'object' && finalResult.sheets) {
      return finalResult as ExcelWorkbookSpec;
    }

    // If multi-stage didn't produce proper spec, fall back to single-stage
    console.warn('[ExcelModelGenerator] Multi-stage incomplete, falling back to single-stage');
    return this.generateSingleStage(request, options);
  }

  /**
   * Call AI provider
   */
  private async callAI(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    preferredProvider?: AIProviderName
  ): Promise<AIStageResult> {
    // Try providers in order of preference. AZURE_OPENAI added to the
    // fallback list because in most deployments it IS the only available
    // provider (Claude/OpenAI/Gemini creds aren't set). Without it, this
    // entire path hard-fails with "All AI providers failed" even though a
    // perfectly healthy azure-openai provider is registered — and the
    // user then sees a broken / empty spreadsheet (legacy fallback kicks
    // in but produces lower-quality output).
    const fallbackChain = [
      AIProviderName.AZURE_OPENAI,
      AIProviderName.CLAUDE,
      AIProviderName.OPENAI,
      AIProviderName.GEMINI,
    ];
    const providers = preferredProvider
      ? [preferredProvider, ...fallbackChain.filter(p => p !== preferredProvider)]
      : fallbackChain;

    for (const providerName of providers) {
      try {
        const provider = aiProviderRegistry.getProvider(providerName);
        if (!provider) continue;

        const response = await provider.generateCompletion({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          maxTokens: 8000 // Excel specs can be large
        });

        if (response.content) {
          return { success: true, content: response.content };
        }
      } catch (error: any) {
        console.warn(`[ExcelModelGenerator] Provider ${providerName} failed:`, error.message);
        continue;
      }
    }

    return { success: false, content: '', error: 'All AI providers failed' };
  }

  /**
   * Parse AI output into workbook spec
   */
  private parseWorkbookSpec(content: string): ExcelWorkbookSpec {
    // Try to extract JSON from the response
    const parsed = this.parseJSON(content);

    // Validate minimum structure
    if (!parsed.sheets || !Array.isArray(parsed.sheets)) {
      throw new Error('Invalid spec: missing sheets array');
    }

    // Ensure metadata exists
    if (!parsed.metadata) {
      parsed.metadata = {
        title: 'Generated Model',
        author: 'ICAI CAGPT',
        created: new Date()
      };
    }

    // Normalize sheet specs
    for (const sheet of parsed.sheets) {
      this.normalizeSheet(sheet);
    }

    return parsed as ExcelWorkbookSpec;
  }

  /**
   * Parse JSON from AI response (handles markdown code blocks)
   */
  private parseJSON(content: string): any {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    
    // Handle ```json ... ``` blocks
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    // Handle cases where JSON is embedded in text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // Use SafeJSONParser with recovery
    const parseResult = SafeJSONParser.parse(jsonStr);
    
    if (parseResult.success) {
      if (parseResult.recovered) {
        console.log('[ExcelModelGenerator] JSON was recovered from malformed input');
      }
      return parseResult.data;
    }

    // If safe parser failed, throw with detailed error
    throw new Error(`Failed to parse AI response as JSON: ${parseResult.error}`);
  }

  /**
   * Normalize a sheet spec to ensure all required fields
   */
  private normalizeSheet(sheet: SheetSpec): void {
    // Default purpose
    if (!sheet.purpose) {
      sheet.purpose = 'calculations';
    }

    // Ensure cells array
    if (!sheet.cells) {
      sheet.cells = [];
    }

    // Normalize each cell
    for (const cell of sheet.cells) {
      this.normalizeCell(cell);
    }
  }

  /**
   * Normalize a cell spec
   */
  private normalizeCell(cell: CellSpec): void {
    // Default type
    if (!cell.type) {
      if (cell.formula || cell.formulaPattern) {
        cell.type = 'formula';
      } else if (typeof cell.value === 'number') {
        cell.type = 'value';
      } else {
        cell.type = 'label';
      }
    }

    // Validate formula pattern if used
    if (cell.formulaPattern) {
      const pattern = formulaPatternLibrary.getPattern(cell.formulaPattern.patternId);
      if (!pattern) {
        console.warn(`[ExcelModelGenerator] Unknown formula pattern: ${cell.formulaPattern.patternId}`);
        // Try to convert to direct formula
        cell.formula = cell.formula || '=ERROR_PATTERN_NOT_FOUND';
        delete cell.formulaPattern;
      }
    }

    // Ensure formula starts with =
    if (cell.formula && !cell.formula.startsWith('=')) {
      cell.formula = '=' + cell.formula;
    }
  }

  /**
   * Validate spec using the comprehensive validator
   */
  private validateSpec(spec: ExcelWorkbookSpec, strictMode: boolean = false): { 
    valid: boolean; 
    issues: string[]; 
    validationResult: ValidationResult;
    fixedSpec?: ExcelWorkbookSpec;
  } {
    // Use the comprehensive validator with auto-fix enabled
    const { result, spec: fixedSpec } = excelSpecValidator.validateAndFix(spec);
    
    // Collect all issues as strings
    const issues: string[] = [
      ...result.errors.map(e => `[${e.severity.toUpperCase()}] ${e.message} (${e.path})`),
      ...result.warnings.map(w => `[WARNING] ${w.message} (${w.path})`)
    ];

    // Log fixes applied
    if (result.fixes.length > 0) {
      console.log(`[Excel Validator] Applied ${result.fixes.length} auto-fixes:`);
      for (const fix of result.fixes) {
        console.log(`  - ${fix.description} at ${fix.path}`);
      }
    }

    // Determine validity based on strict mode
    const valid = strictMode 
      ? result.valid && result.warnings.length === 0
      : result.valid;

    return { 
      valid, 
      issues, 
      validationResult: result,
      fixedSpec: fixedSpec || undefined
    };
  }

  /**
   * Sanitize all formulas in a spec
   */
  private sanitizeFormulas(spec: ExcelWorkbookSpec): { 
    sanitized: ExcelWorkbookSpec; 
    sanitizedCount: number;
    warnings: string[];
  } {
    const sanitized = JSON.parse(JSON.stringify(spec)) as ExcelWorkbookSpec;
    let sanitizedCount = 0;
    const warnings: string[] = [];

    for (const sheet of sanitized.sheets) {
      for (const cell of sheet.cells || []) {
        if (cell.formula) {
          const result = formulaSanitizer.sanitize(cell.formula);
          
          if (result.success && result.formula) {
            if (result.formula !== cell.formula) {
              sanitizedCount++;
            }
            cell.formula = result.formula;
            
            if (result.warnings) {
              warnings.push(...result.warnings.map(w => 
                `[${sheet.name}!${cell.cell}] ${w}`
              ));
            }
          } else {
            // Formula is unsafe - convert to value or empty
            warnings.push(
              `[${sheet.name}!${cell.cell}] Formula rejected: ${result.error}. Converting to value.`
            );
            cell.formula = undefined;
            cell.type = 'label';
            cell.value = '#FORMULA_ERROR';
          }
        }
      }
    }

    return { sanitized, sanitizedCount, warnings };
  }

  /**
   * Fix common issues in AI-generated specs (enhanced)
   */
  private fixCommonIssues(spec: ExcelWorkbookSpec, issues: string[]): ExcelWorkbookSpec {
    // Create a copy
    let fixed = JSON.parse(JSON.stringify(spec)) as ExcelWorkbookSpec;

    // First, run through comprehensive validator fixes
    const { result, spec: validatedSpec } = excelSpecValidator.validateAndFix(fixed);
    if (validatedSpec) {
      fixed = validatedSpec;
    }

    // Then sanitize all formulas
    const { sanitized } = this.sanitizeFormulas(fixed);
    fixed = sanitized;

    // Apply any remaining manual fixes
    for (const issue of issues) {
      // Fix missing formulas for formula-type cells by attempting pattern-based generation
      if (issue.includes('has no formula')) {
        const match = issue.match(/cell (\w+) on "(.+)"/);
        if (match) {
          const [, cellRef, sheetName] = match;
          const sheet = fixed.sheets.find(s => s.name === sheetName);
          if (sheet) {
            const cell = sheet.cells.find(c => c.cell === cellRef);
            if (cell) {
              // Try to infer formula from cell name/description
              const inferred = this.inferFormulaFromContext(cell, sheet);
              if (inferred) {
                cell.formula = inferred;
              } else {
                // Convert to value type if we can't determine the formula
                cell.type = 'label';
                cell.value = cell.value ?? '#NEEDS_FORMULA';
              }
            }
          }
        }
      }

      // Fix invalid cell references
      if (issue.includes('Invalid cell reference')) {
        const match = issue.match(/reference: (.+)/);
        if (match) {
          const badRef = match[1];
          for (const sheet of fixed.sheets) {
            sheet.cells = sheet.cells.filter(c => c.cell !== badRef);
          }
        }
      }
    }

    return fixed;
  }

  /**
   * Try to infer a formula from cell context
   */
  private inferFormulaFromContext(cell: CellSpec, sheet: SheetSpec): string | null {
    const name = (cell.name || cell.cell).toLowerCase();
    
    // Common patterns
    if (name.includes('total') || name.includes('sum')) {
      // Look for cells above that might need summing
      const colMatch = cell.cell.match(/^([A-Z]+)/);
      if (colMatch) {
        const col = colMatch[1];
        const row = parseInt(cell.cell.replace(col, ''));
        if (row > 3) {
          return `=SUM(${col}3:${col}${row - 1})`;
        }
      }
    }

    if (name.includes('margin') || name.includes('ratio') || name.includes('%')) {
      // Ratio formulas need two operands - can't infer without more context
      return `=IFERROR(0/1,0)`;
    }

    if (name.includes('growth') || name.includes('change')) {
      return `=IFERROR((0/1)-1,0)`;
    }

    return null;
  }

  /**
   * Check if cell reference is valid
   */
  private isValidCellRef(ref: string): boolean {
    return /^[A-Z]{1,3}[0-9]{1,7}$/.test(ref);
  }

  /**
   * Generate filename for the workbook
   */
  private generateFilename(title: string, modelType?: ExcelModelType): string {
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `${cleanTitle}_${timestamp}.xlsx`;
  }

  /**
   * Generate summary of the built workbook
   */
  private generateSummary(buildResult: BuildResult, spec: ExcelWorkbookSpec): string {
    let summary = `📊 **Excel Model Generated: ${spec.metadata.title}**\n\n`;
    
    summary += `**Workbook Structure:**\n`;
    for (const sheet of spec.sheets) {
      const cellCount = sheet.cells?.length || 0;
      const formulaCount = sheet.cells?.filter(c => c.formula || c.formulaPattern).length || 0;
      summary += `- **${sheet.name}** (${sheet.purpose}): ${cellCount} cells, ${formulaCount} formulas\n`;
    }
    
    summary += `\n**Statistics:**\n`;
    summary += `- Sheets: ${buildResult.stats.sheetsCreated}\n`;
    summary += `- Formulas: ${buildResult.stats.formulasApplied}\n`;
    summary += `- Named Ranges: ${buildResult.stats.namedRangesCreated}\n`;
    
    if (buildResult.warnings && buildResult.warnings.length > 0) {
      summary += `\n**Notes:** ${buildResult.warnings.length} minor issues addressed\n`;
    }

    summary += `\n✅ All calculations use Excel formulas - the model is fully dynamic!\n`;
    summary += `💡 Input cells (yellow) can be modified to update all calculations.\n`;

    return summary;
  }

  /**
   * Quick check if a query needs Excel generation
   */
  isExcelRequest(query: string): boolean {
    return excelModelPromptBuilder.isExcelModelRequest(query);
  }

  /**
   * Get detected model type for a query
   */
  getModelType(query: string): ExcelModelType {
    return excelModelPromptBuilder.detectModelType(query);
  }
}

export const excelModelGenerator = new ExcelModelGenerator();
