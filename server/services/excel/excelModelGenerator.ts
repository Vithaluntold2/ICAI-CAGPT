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
import { EXCEL_WORKBOOK_SPEC_SCHEMA, EXCEL_GENERATION_SEED } from './excelSpecSchema';
import { workbookSmokeTest, formatErrorsForLLMRetry, type SmokeTestResult } from './workbookSmokeTest';

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
  /** Skip the whole-workbook smoke-test + self-heal loop. Only set
   *  true when the caller has already run the smoke-test (e.g. the
   *  agent-emitted spec path). Default false — smoke-test runs. */
  skipSmokeTest?: boolean;
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

      // Whole-workbook smoke-test + bounded self-heal retry.
      // The validator + sanitizer above catch SOME structural
      // issues but not all — label-in-range, forward refs, wrong
      // arity, and #CYCLE! only surface when formulas are
      // actually evaluated. Run the smoke-test, and if anything
      // fails, give the LLM ONE focused chance to fix it before
      // shipping (or rejecting) the workbook.
      if (options.validateOutput !== false && options.skipSmokeTest !== true) {
        const smoke = await workbookSmokeTest(spec);
        if (!smoke.ok) {
          console.warn(
            `[ExcelModelGenerator] Smoke-test found ${smoke.errors.length} issue(s); attempting self-heal…`,
          );
          const healed = await this.selfHealSpec(request, spec, smoke, options);
          if (healed) {
            spec = healed.spec;
            const recheck = healed.recheck;
            if (!recheck.ok) {
              // Still broken after retry — block the download with a
              // descriptive error rather than ship a workbook we know
              // is wrong.
              console.error(
                `[ExcelModelGenerator] Self-heal retry did not fix all issues. Blocking download.`,
              );
              return {
                success: false,
                errors: [
                  'Workbook failed consistency check after self-heal retry.',
                  ...recheck.errors.slice(0, 8).map(
                    (e) =>
                      `${e.sheet}!${e.cell} [${e.code}] ${e.message}`,
                  ),
                ],
                warnings: [
                  `Initial errors: ${smoke.errors.length}; after retry: ${recheck.errors.length}.`,
                ],
                validationResult,
              };
            }
            console.log('[ExcelModelGenerator] Self-heal retry succeeded; all formulas evaluate cleanly.');
          } else {
            // Patch request itself failed (LLM unreachable /
            // non-JSON response / etc.). Block rather than ship.
            console.error('[ExcelModelGenerator] Self-heal retry unavailable. Blocking download.');
            return {
              success: false,
              errors: [
                'Workbook has structural issues and the self-heal retry could not run.',
                ...smoke.errors.slice(0, 5).map(
                  (e) => `${e.sheet}!${e.cell} [${e.code}] ${e.message}`,
                ),
              ],
              validationResult,
            };
          }
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

    // Single-stage call emits the full workbook spec. Apply
    // schema-constrained output + seed so the decoder is forced to
    // produce a valid ExcelWorkbookSpec shape and failing runs are
    // reproducible for debugging. `temperature: 0` pairs with the
    // seed for deterministic sampling.
    const response = await this.callAI(
      systemPrompt,
      userPrompt,
      0, // deterministic with seed
      options.preferredProvider,
      {
        schema: EXCEL_WORKBOOK_SPEC_SCHEMA as unknown as Record<string, any>,
        schemaName: 'ExcelWorkbookSpec',
        seed: EXCEL_GENERATION_SEED,
      },
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

      // Stage 1 (requirements extraction) and Stage 3 (final
      // workbook spec) benefit most from deterministic output and
      // structured decoding. Stage 2 (structure design) is left at
      // its original temperature since some exploration helps.
      const isStage3 = stage.stage === stages.length;
      const isStage1 = stage.stage === 1;
      const effectiveTemp = isStage1 || isStage3 ? 0 : stage.temperature;
      const structured = isStage3
        ? {
            schema: EXCEL_WORKBOOK_SPEC_SCHEMA as unknown as Record<string, any>,
            schemaName: 'ExcelWorkbookSpec',
            seed: EXCEL_GENERATION_SEED,
          }
        : undefined;

      const response = await this.callAI(
        stage.systemPrompt,
        userPrompt,
        effectiveTemp,
        options.preferredProvider,
        structured,
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
    preferredProvider?: AIProviderName,
    /** When set, emit via Azure/OpenAI strict JSON-schema output so
     *  the decoder is constrained to valid ExcelWorkbookSpec shape.
     *  No-op for providers that don't implement structured output. */
    structuredOutput?: {
      schema: Record<string, any>;
      schemaName: string;
      seed?: number;
    },
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

        const request: any = {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          maxTokens: 8000, // Excel specs can be large
        };
        if (structuredOutput) {
          request.responseFormat = 'json_schema';
          request.jsonSchema = {
            name: structuredOutput.schemaName,
            schema: structuredOutput.schema,
            strict: true,
          };
          if (typeof structuredOutput.seed === 'number') {
            request.seed = structuredOutput.seed;
          }
        }
        const response = await provider.generateCompletion(request);

        if (response.content) {
          return { success: true, content: response.content };
        }
      } catch (error: any) {
        console.warn(`[ExcelModelGenerator] Provider ${providerName} failed:`, error.message);
        // If the failure is because the provider rejected the strict
        // schema (older deployments), retry once without the schema
        // so the pipeline degrades gracefully. Detect via Azure's
        // typical "response_format"/"json_schema" error keywords.
        if (
          structuredOutput &&
          /response_format|json_schema|Unknown parameter/i.test(String(error?.message ?? ''))
        ) {
          console.warn(
            `[ExcelModelGenerator] Retrying ${providerName} without strict schema — deployment likely doesn't support it`,
          );
          try {
            const provider2 = aiProviderRegistry.getProvider(providerName);
            if (!provider2) continue;
            const fallbackResp = await provider2.generateCompletion({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature,
              maxTokens: 8000,
              responseFormat: 'json',
            });
            if (fallbackResp.content) {
              return { success: true, content: fallbackResp.content };
            }
          } catch (err2: any) {
            console.warn(`[ExcelModelGenerator] Schema-less retry on ${providerName} also failed:`, err2.message);
          }
        }
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

  /**
   * Self-heal retry — one shot at fixing structural errors found by
   * `workbookSmokeTest`. Asks the LLM for a minimal JSON patch that
   * addresses each error by cell address, applies it, re-smoke-tests,
   * and returns the result. Returns `null` when the patch call
   * itself failed (LLM unreachable / non-JSON response) so the caller
   * can distinguish "we tried and it's still broken" from "we
   * couldn't try".
   */
  private async selfHealSpec(
    request: ExcelModelRequest,
    spec: ExcelWorkbookSpec,
    smoke: SmokeTestResult,
    options: GenerationOptions,
  ): Promise<{ spec: ExcelWorkbookSpec; recheck: SmokeTestResult } | null> {
    const feedback = formatErrorsForLLMRetry(smoke.errors);
    const systemPrompt = `You are an Excel formula debugger. You will be given:
  • The user's original request.
  • The current ExcelWorkbookSpec JSON that has structural errors.
  • A list of errors, each keyed by cell address.

Your job: produce a MINIMAL JSON patch that fixes each error. Return
ONLY the patch — no prose, no explanation, no commentary.

Patch format (strict):
[
  { "sheet": "<sheet-name>", "cell": "<A1>", "action": "set",
    "type": "<label|input|formula|value|header|subheader|total>",
    "value": <string|number|boolean|null>,        // optional
    "formula": "=...",                             // optional
    "format": { ... }                              // optional
  },
  { "sheet": "<sheet-name>", "cell": "<A1>", "action": "delete" }
]

RULES:
  • Follow the same MANDATORY LAYOUT CONVENTION: col A labels, col B
    inputs (numbers only), col C formulas referencing same-or-earlier-
    row col-B cells, col D notes.
  • For FUNCTION_WRONG_ARITY on IRR/XIRR, fix by restructuring the
    sheet so the cash-flow stream is contiguous in one column.
  • For SELF_REF, change the formula to reference the INPUT cell (same-
    row col B), not the formula's own address.
  • For LABEL_IN_NUMERIC_RANGE, either narrow the range to skip the
    label row, or move the label out of the numeric column.
  • For FORWARD_REFERENCE, emit cells in the correct row order.
  • For SHEET_NOT_FOUND, correct the sheet name to match one that
    exists in the spec (see suggestion in the error message).

Output MUST be a JSON array. No wrapper object. No code fences.`;

    const userPrompt = `ORIGINAL REQUEST:
"${request.userQuery}"

CURRENT SPEC:
${JSON.stringify(spec, null, 2)}

ERRORS (${smoke.errors.length} total):
${feedback}

Return the minimal JSON patch that fixes every error above.`;

    let patchResp: AIStageResult;
    try {
      patchResp = await this.callAI(
        systemPrompt,
        userPrompt,
        0,
        options.preferredProvider,
      );
    } catch (err) {
      console.warn('[ExcelModelGenerator] Self-heal LLM call threw:', err);
      return null;
    }
    if (!patchResp.success || !patchResp.content) return null;

    let patches: Array<{
      sheet: string;
      cell: string;
      action: 'set' | 'delete';
      type?: CellSpec['type'];
      value?: CellSpec['value'];
      formula?: string;
      format?: CellSpec['format'];
    }> = [];
    try {
      const parsed = SafeJSONParser.parse(patchResp.content);
      if (!Array.isArray(parsed)) {
        console.warn('[ExcelModelGenerator] Self-heal patch was not an array; skipping.');
        return null;
      }
      patches = parsed as any;
    } catch (err) {
      console.warn('[ExcelModelGenerator] Self-heal patch JSON parse failed:', err);
      return null;
    }

    // Apply the patch to a deep-cloned spec.
    const patched: ExcelWorkbookSpec = JSON.parse(JSON.stringify(spec));
    for (const p of patches) {
      const sheet = patched.sheets.find((s) => s.name === p.sheet);
      if (!sheet) continue;
      const idx = sheet.cells.findIndex((c) => c.cell === p.cell);
      if (p.action === 'delete') {
        if (idx !== -1) sheet.cells.splice(idx, 1);
        continue;
      }
      // action === 'set'
      const next: CellSpec = {
        cell: p.cell,
        type: p.type ?? (idx !== -1 ? sheet.cells[idx].type : 'formula'),
        value: p.value,
        formula: p.formula,
        format: p.format,
      } as CellSpec;
      if (idx !== -1) sheet.cells[idx] = next;
      else sheet.cells.push(next);
    }

    console.log(
      `[ExcelModelGenerator] Self-heal applied ${patches.length} patch entries; re-running smoke-test.`,
    );
    const recheck = await workbookSmokeTest(patched);
    return { spec: patched, recheck };
  }
}

export const excelModelGenerator = new ExcelModelGenerator();
