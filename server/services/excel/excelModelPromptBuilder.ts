/**
 * Excel Model Prompt Builder
 * 
 * Builds specialized prompts for AI to generate Excel workbook specifications.
 * Implements anti-caching strategies and forces structured JSON output.
 * 
 * Key features:
 * - Multi-stage prompt generation
 * - Formula pattern library context injection
 * - Unique context injection for anti-caching
 * - Dynamic example rotation
 * - Strict JSON output enforcement
 */

import crypto from 'crypto';
import { formulaPatternLibrary, FormulaCategory } from './formulaPatternLibrary';
import { ExcelWorkbookSpec, CellSpec } from './excelWorkbookBuilder';

// =============================================================================
// TYPES
// =============================================================================

export interface ExcelModelRequest {
  userQuery: string;
  modelType?: ExcelModelType;
  industry?: string;
  companyName?: string;
  contextData?: Record<string, any>;
  preferences?: ExcelPreferences;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export type ExcelModelType = 
  | 'dcf'
  | 'lbo'
  | '3-statement'
  | 'budget'
  | 'forecast'
  | 'loan-amortization'
  | 'depreciation'
  | 'sensitivity'
  | 'scenario'
  | 'dashboard'
  | 'invoice'
  | 'project-tracker'
  | 'inventory'
  | 'payroll'
  | 'custom';

export interface ExcelPreferences {
  excelVersion?: '2016' | '2019' | '2021' | '365';
  currencySymbol?: string;
  dateFormat?: string;
  includeCharts?: boolean;
  protectFormulas?: boolean;
  colorScheme?: 'professional' | 'minimal' | 'colorful';
}

export interface PromptStage {
  stage: number;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  expectedOutputType: 'json' | 'text';
  temperature: number;
}

// =============================================================================
// EXAMPLE TEMPLATES FOR AI CONTEXT
// =============================================================================

// =============================================================================
// WORKED EXAMPLES — ALL verified-clean against HyperFormula + the
// enforced layout convention below. Any future edit MUST preserve:
//
//   • Row 1 = title cell
//   • Row 2 = column headers LABEL | VALUE | FORMULA | NOTES
//   • Col A = label text
//   • Col B = numeric / date INPUTS ONLY (no labels, no formulas)
//   • Col C = formulas that reference same-or-earlier-row col-B cells
//   • Col D = notes / units
//
// If you change these examples, re-run `npx tsx scripts/smoke-calc-agents.ts`
// or a focused smoke that builds each example via ExcelWorkbookBuilder
// and evaluates every formula via HyperFormula — every cell must
// resolve to a numeric value, not a DetailedCellError.
// =============================================================================

export const exampleSpecs: Record<string, Partial<ExcelWorkbookSpec>> = {
  /**
   * Example 1 — NPV / IRR Analysis.
   * Layout: Year 0 (initial investment as negative) + Year 1..N cash
   * flows live in one contiguous column-B range so IRR can reference
   * `B6:B11` directly — no tuple syntax, no array gymnastics.
   */
  npvSimple: {
    metadata: { title: 'NPV / IRR Analysis — 5-year project' },
    sheets: [
      {
        name: 'NPV Analysis',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'header', value: 'NPV / IRR Analysis — 5-year project' },
          { cell: 'A2', type: 'header', value: 'LABEL' },
          { cell: 'B2', type: 'header', value: 'VALUE' },
          { cell: 'C2', type: 'header', value: 'FORMULA / RESULT' },
          { cell: 'D2', type: 'header', value: 'NOTES' },
          { cell: 'A3', type: 'subheader', value: 'Inputs' },
          { cell: 'A4', type: 'label', value: 'Discount Rate' },
          { cell: 'B4', type: 'input', value: 0.12, format: { type: 'percentage', decimals: 2 } },
          { cell: 'D4', type: 'label', value: 'Cost of capital' },
          { cell: 'A5', type: 'subheader', value: 'Cash Flow Stream' },
          { cell: 'A6', type: 'label', value: 'Year 0 (Initial Investment)' },
          { cell: 'B6', type: 'input', value: -100000, format: { type: 'currency', decimals: 2, negativeRed: true } },
          { cell: 'D6', type: 'label', value: 'Cash outflow (negative)' },
          { cell: 'A7', type: 'label', value: 'Year 1 Cash Flow' },
          { cell: 'B7', type: 'input', value: 30000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A8', type: 'label', value: 'Year 2 Cash Flow' },
          { cell: 'B8', type: 'input', value: 40000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A9', type: 'label', value: 'Year 3 Cash Flow' },
          { cell: 'B9', type: 'input', value: 50000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A10', type: 'label', value: 'Year 4 Cash Flow' },
          { cell: 'B10', type: 'input', value: 40000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A11', type: 'label', value: 'Year 5 Cash Flow' },
          { cell: 'B11', type: 'input', value: 30000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A12', type: 'subheader', value: 'Outputs' },
          { cell: 'A13', type: 'total', value: 'Net Present Value (NPV)' },
          { cell: 'C13', type: 'formula', formula: '=NPV(B4,B7:B11)+B6', format: { type: 'currency', decimals: 2, negativeRed: true } },
          { cell: 'A14', type: 'total', value: 'Internal Rate of Return (IRR)' },
          { cell: 'C14', type: 'formula', formula: '=IRR(B6:B11)', format: { type: 'percentage', decimals: 2 } },
          { cell: 'D14', type: 'label', value: 'Year 0..5 contiguous range' },
        ],
        columnWidths: { A: 32, B: 18, C: 28, D: 30 },
        freezePanes: { row: 2, col: 0 },
      },
    ],
  },

  /**
   * Example 2 — Loan Amortisation (first 3 periods illustrated; a
   * real workbook would extend B8..Bn for the full term but the
   * PATTERN must match: every formula references same-row col-B or
   * earlier-row col-B only).
   */
  loanAmortization: {
    metadata: { title: 'Loan Amortisation — monthly payment' },
    sheets: [
      {
        name: 'Loan',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'header', value: 'Loan Amortisation — monthly payment' },
          { cell: 'A2', type: 'header', value: 'LABEL' },
          { cell: 'B2', type: 'header', value: 'VALUE' },
          { cell: 'C2', type: 'header', value: 'FORMULA / RESULT' },
          { cell: 'D2', type: 'header', value: 'NOTES' },
          { cell: 'A3', type: 'subheader', value: 'Loan Parameters' },
          { cell: 'A4', type: 'label', value: 'Principal' },
          { cell: 'B4', type: 'input', value: 250000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A5', type: 'label', value: 'Annual Interest Rate' },
          { cell: 'B5', type: 'input', value: 0.065, format: { type: 'percentage', decimals: 2 } },
          { cell: 'A6', type: 'label', value: 'Term (Years)' },
          { cell: 'B6', type: 'input', value: 30, format: { type: 'number', decimals: 0 } },
          { cell: 'A7', type: 'subheader', value: 'Computed' },
          { cell: 'A8', type: 'total', value: 'Monthly Payment' },
          { cell: 'C8', type: 'formula', formula: '=PMT(B5/12,B6*12,-B4)', format: { type: 'currency', decimals: 2 } },
          { cell: 'D8', type: 'label', value: 'PMT returns positive when PV negative' },
          { cell: 'A9', type: 'total', value: 'Total Paid Over Life' },
          { cell: 'C9', type: 'formula', formula: '=PMT(B5/12,B6*12,-B4)*B6*12', format: { type: 'currency', decimals: 2 } },
          { cell: 'A10', type: 'total', value: 'Total Interest' },
          { cell: 'C10', type: 'formula', formula: '=PMT(B5/12,B6*12,-B4)*B6*12-B4', format: { type: 'currency', decimals: 2 } },
        ],
        columnWidths: { A: 32, B: 18, C: 28, D: 30 },
        freezePanes: { row: 2, col: 0 },
      },
    ],
  },

  /**
   * Example 3 — Straight-line depreciation schedule.
   * Shows the per-year pattern with formulas that only reference
   * same-or-earlier-row col-B inputs.
   */
  depreciationSLM: {
    metadata: { title: 'Straight-Line Depreciation Schedule' },
    sheets: [
      {
        name: 'Depreciation',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'header', value: 'Straight-Line Depreciation Schedule' },
          { cell: 'A2', type: 'header', value: 'LABEL' },
          { cell: 'B2', type: 'header', value: 'VALUE' },
          { cell: 'C2', type: 'header', value: 'FORMULA / RESULT' },
          { cell: 'D2', type: 'header', value: 'NOTES' },
          { cell: 'A3', type: 'subheader', value: 'Inputs' },
          { cell: 'A4', type: 'label', value: 'Asset Cost' },
          { cell: 'B4', type: 'input', value: 500000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A5', type: 'label', value: 'Salvage Value' },
          { cell: 'B5', type: 'input', value: 50000, format: { type: 'currency', decimals: 2 } },
          { cell: 'A6', type: 'label', value: 'Useful Life (Years)' },
          { cell: 'B6', type: 'input', value: 5, format: { type: 'number', decimals: 0 } },
          { cell: 'A7', type: 'subheader', value: 'Annual Schedule' },
          { cell: 'A8', type: 'label', value: 'Year 1 Depreciation' },
          { cell: 'C8', type: 'formula', formula: '=(B4-B5)/B6', format: { type: 'currency', decimals: 2 } },
          { cell: 'A9', type: 'label', value: 'Year 2 Depreciation' },
          { cell: 'C9', type: 'formula', formula: '=(B4-B5)/B6', format: { type: 'currency', decimals: 2 } },
          { cell: 'A10', type: 'label', value: 'Year 3 Depreciation' },
          { cell: 'C10', type: 'formula', formula: '=(B4-B5)/B6', format: { type: 'currency', decimals: 2 } },
          { cell: 'A11', type: 'label', value: 'Year 4 Depreciation' },
          { cell: 'C11', type: 'formula', formula: '=(B4-B5)/B6', format: { type: 'currency', decimals: 2 } },
          { cell: 'A12', type: 'label', value: 'Year 5 Depreciation' },
          { cell: 'C12', type: 'formula', formula: '=(B4-B5)/B6', format: { type: 'currency', decimals: 2 } },
          { cell: 'A13', type: 'total', value: 'Total Accumulated Depreciation' },
          { cell: 'C13', type: 'formula', formula: '=SUM(C8:C12)', format: { type: 'currency', decimals: 2 } },
          { cell: 'A14', type: 'total', value: 'Ending Book Value' },
          { cell: 'C14', type: 'formula', formula: '=B4-SUM(C8:C12)', format: { type: 'currency', decimals: 2 } },
          { cell: 'D14', type: 'label', value: 'Should equal salvage value' },
        ],
        columnWidths: { A: 32, B: 18, C: 28, D: 30 },
        freezePanes: { row: 2, col: 0 },
      },
    ],
  },
};

// Retained names so `selectExamples` can keep routing by modelType
// without churn. Older keys (`dcfSimple`, `budgetTemplate`) are
// aliased to the closest new verified example.
(exampleSpecs as any).dcfSimple = exampleSpecs.npvSimple;
(exampleSpecs as any).budgetTemplate = exampleSpecs.depreciationSLM;

// =============================================================================
// PROMPT BUILDER CLASS
// =============================================================================

export class ExcelModelPromptBuilder {
  
  /**
   * Build multi-stage prompts for Excel model generation
   */
  buildPrompts(request: ExcelModelRequest): PromptStage[] {
    const stages: PromptStage[] = [];
    
    // Stage 1: Requirements Analysis
    stages.push(this.buildRequirementsStage(request));
    
    // Stage 2: Structure Design
    stages.push(this.buildStructureStage(request));
    
    // Stage 3: Formula & Cell Generation
    stages.push(this.buildFormulaStage(request));
    
    return stages;
  }

  /**
   * Build single comprehensive prompt (for simpler requests)
   */
  buildSinglePrompt(request: ExcelModelRequest): { systemPrompt: string; userPrompt: string } {
    const uniqueContext = this.generateUniqueContext();
    const examples = this.selectExamples(request.modelType);
    const formulaContext = this.getRelevantFormulaPatterns(request.modelType);

    const systemPrompt = this.buildSystemPrompt(formulaContext, examples, uniqueContext);
    const userPrompt = this.buildUserPrompt(request, uniqueContext);

    return { systemPrompt, userPrompt };
  }

  /**
   * Stage 1: Requirements Analysis
   */
  private buildRequirementsStage(request: ExcelModelRequest): PromptStage {
    return {
      stage: 1,
      name: 'Requirements Analysis',
      temperature: 0.3,
      expectedOutputType: 'json',
      systemPrompt: `You are an Excel financial modeling expert analyzing user requirements.

Your task: Extract and structure the requirements from the user's request.

Output JSON with this structure:
{
  "modelType": "dcf|lbo|budget|forecast|loan|depreciation|custom",
  "purpose": "Brief description of what the model should accomplish",
  "requiredSheets": ["Sheet names needed"],
  "keyInputs": [
    {"name": "Input name", "type": "number|percentage|date|text", "description": "What this input represents"}
  ],
  "requiredCalculations": [
    {"name": "Calculation name", "formula": "Excel formula pattern needed", "description": "What this calculates"}
  ],
  "outputMetrics": ["List of key outputs/results the user wants"],
  "timeHorizon": "Number of periods (months/years)",
  "specialRequirements": ["Any special features mentioned"]
}

Be thorough. Extract ALL implicit requirements even if not explicitly stated.`,
      userPrompt: `Analyze this Excel model request and extract structured requirements:

"${request.userQuery}"

${request.industry ? `Industry context: ${request.industry}` : ''}
${request.companyName ? `Company: ${request.companyName}` : ''}

Output the requirements as JSON.`
    };
  }

  /**
   * Stage 2: Structure Design
   */
  private buildStructureStage(request: ExcelModelRequest): PromptStage {
    return {
      stage: 2,
      name: 'Structure Design',
      temperature: 0.2,
      expectedOutputType: 'json',
      systemPrompt: `You are an Excel financial modeling architect designing workbook structure.

Based on the requirements analysis, design the complete workbook structure.

CRITICAL RULES:
1. Separate sheets by purpose: Inputs, Calculations, Outputs/Dashboard
2. Use named ranges for ALL key values (inputs, intermediate results)
3. Design for user-friendliness: yellow input cells, protected formulas
4. Ensure proper data flow: Inputs → Calculations → Outputs

Output JSON structure:
{
  "sheets": [
    {
      "name": "Sheet name",
      "purpose": "inputs|calculations|outputs|dashboard",
      "tabColor": "Hex color code",
      "sections": [
        {
          "title": "Section title",
          "startRow": 1,
          "columns": ["A", "B", "C"],
          "cellTypes": ["label", "input", "formula"],
          "namedRanges": ["Name1", "Name2"]
        }
      ],
      "protectSheet": true/false
    }
  ],
  "namedRanges": [
    {"name": "RangeName", "sheet": "SheetName", "range": "A1:A10", "description": "What it represents"}
  ],
  "dataFlow": "Description of how data flows between sheets"
}`,
      userPrompt: `Based on these requirements, design the Excel workbook structure:

REQUIREMENTS:
{requirementsFromStage1}

Design a professional, well-organized workbook structure. Output as JSON.`
    };
  }

  /**
   * Stage 3: Formula & Cell Generation
   */
  private buildFormulaStage(request: ExcelModelRequest): PromptStage {
    const formulaContext = this.getRelevantFormulaPatterns(request.modelType);
    const examples = this.selectExamples(request.modelType);

    return {
      stage: 3,
      name: 'Formula Generation',
      temperature: 0.1, // Low temperature for precise formula generation
      expectedOutputType: 'json',
      systemPrompt: `You are an Excel formula expert generating precise cell specifications.

AVAILABLE FORMULA PATTERNS (use these for complex formulas):
${formulaContext}

# LAYOUT CONVENTION — MANDATORY, NON-NEGOTIABLE

Every sheet MUST follow this exact layout. Workbooks that break it
will fail the downstream smoke-test and the generation will be
rejected. This is not a suggestion.

  Row 1          Sheet title cell (type=header)
  Row 2          Column headers — exactly these four, in this order:
                 A2 "LABEL", B2 "VALUE", C2 "FORMULA / RESULT", D2 "NOTES"
  Row 3+         Data rows, optionally broken up by subheader rows
                 spanning A..D.

Column discipline:
  • Column A — label text ONLY. type: 'label' | 'subheader' | 'total' | 'header'.
  • Column B — numeric or date INPUTS ONLY. type: 'input'. Never a
    label. Never a formula. Never empty in a row that has a value.
  • Column C — formulas ONLY. type: 'formula'. Every formula must
    reference cells in column B on the SAME row or an EARLIER row.
    FORWARD REFERENCES ARE FORBIDDEN: a formula in C5 may not
    reference B9. Cross-sheet refs are allowed only to column B of an
    existing sheet in this spec.
  • Column D — notes / units / audit comments. type: 'label' only.

# CRITICAL RULES

1. ALL calculations MUST be Excel formulas. NEVER hardcode a computed
   value in column B. If a cell is the result of a calculation, it
   belongs in column C with a formula.
2. Every formula must reference concrete, defined col-B cells. If a
   formula references cell Bn, there MUST be a type='input' cell at
   Bn with a numeric value. Reference a label or empty cell → #VALUE!.
3. Functions that take ONE range argument (NPV, IRR, XIRR, SUM,
   AVERAGE, PRODUCT, STDEV, VAR, SUMPRODUCT) must get ONE contiguous
   range. \`=IRR(B2, B5:B10)\` is INVALID. Use \`=IRR(B2:B10)\` by
   laying out the stream contiguously.
4. Cell addresses must be unique. Never emit two cell entries with
   the same 'cell' field. Later entries will NOT overwrite earlier
   ones — they will be rejected.
5. For percentage inputs, use the decimal form (e.g. 0.12 for 12%)
   and format: { type: 'percentage' }.

# ANTI-PATTERNS — DO NOT DO THESE

Each of these has broken real workbooks. Reject any impulse to emit:

  ❌ \`{cell:'C3', value:'Year 1 Cash Flow'}\` followed by
     \`{cell:'C3', value:30000}\`.
     (duplicate cell — second is dropped or errors)

  ❌ \`{cell:'B5', type:'label', value:'Input'}\` with
     \`{cell:'B6', type:'formula', formula:'=SUM(B5:B10)'}\`.
     (formula range includes a label → #VALUE!)

  ❌ \`=IRR(B2, C3:C7)\` or \`=IRR((B2, C3:C7))\`.
     (IRR takes ONE range — rearrange so the stream is contiguous)

  ❌ \`{cell:'C5', formula:'=B8+B9'}\` when B8/B9 are defined LATER.
     (forward reference — move the inputs above the formula)

  ❌ \`=Sheet2!A1\` when no sheet named 'Sheet2' exists in the spec.
     (cross-sheet ref to missing sheet → #REF!)

  ❌ \`{cell:'B3', formula:'=B3*0.05'}\`.
     (self-reference — #CYCLE!)

# CELL SPECIFICATION FORMAT
{
  "cell": "A1",
  "type": "label|input|formula|value|header|subheader|total",
  "value": "Static value (for label/value/header types) or literal number (for input)",
  "formula": "=Direct Excel formula (column C cells ONLY)",
  "formulaPattern": {
    "patternId": "npv|irr|pmt|...",
    "params": { "rate": "B2", "cashFlowRange": "B5:B10" }
  },
  "name": "NamedRangeName (if this col-B cell should be named)",
  "format": {
    "type": "number|currency|percentage|date|text|accounting",
    "decimals": 2,
    "currencySymbol": "$",
    "negativeRed": true
  },
  "comment": "Tooltip/comment for user guidance"
}

# VERIFIED WORKED EXAMPLES

Each of the specs below has been smoke-tested end-to-end: built via
ExcelWorkbookBuilder and every formula evaluated via HyperFormula
with zero errors. Use them as your template — match the layout, the
type assignments, and the formula styles exactly.

${JSON.stringify(examples, null, 2)}`,
      userPrompt: `Generate the complete cell specifications for this workbook.

REQUIREMENTS:
{requirementsFromStage1}

STRUCTURE:
{structureFromStage2}

Generate ALL cells for ALL sheets. Every calculation must use a formula.
Output as complete ExcelWorkbookSpec JSON matching this schema:
{
  "metadata": { "title": "...", "description": "..." },
  "sheets": [{ 
    "name": "...", 
    "purpose": "inputs|calculations|outputs",
    "cells": [/* CellSpec array */],
    ...
  }],
  "namedRanges": [...]
}`
    };
  }

  /**
   * Build comprehensive system prompt
   */
  private buildSystemPrompt(
    formulaContext: string, 
    examples: Partial<ExcelWorkbookSpec>[], 
    uniqueContext: UniqueContext
  ): string {
    return `You are an expert Excel financial modeler. Emit a complete Excel workbook specification as strict JSON.

REQUEST ID: ${uniqueContext.requestId}
TIMESTAMP: ${uniqueContext.timestamp}

# LAYOUT CONVENTION — MANDATORY, NON-NEGOTIABLE

Every sheet MUST follow this exact layout. Workbooks that break it
will be rejected by the downstream smoke-test.

  Row 1          Title (type='header')
  Row 2          A2 "LABEL", B2 "VALUE", C2 "FORMULA / RESULT", D2 "NOTES"
  Row 3+         Data rows. Subheader rows may span A..D.

  Column A       Label text ONLY.
  Column B       Numeric / date INPUTS ONLY. Never a label, never a formula.
  Column C       Formulas ONLY. Must reference same-or-earlier-row col-B
                 cells. FORWARD REFERENCES ARE FORBIDDEN.
  Column D       Notes / units ONLY.

# CRITICAL RULES

1. ALL calculations MUST be Excel formulas. NEVER hardcode a computed
   value.
2. Every formula must reference concrete, defined col-B cells. If it
   references Bn, there MUST be an input cell at Bn with a numeric
   value. Referencing a label or empty cell → #VALUE!.
3. Single-range functions (NPV, IRR, XIRR, SUM, AVERAGE, PRODUCT,
   STDEV, VAR, SUMPRODUCT) need ONE contiguous range. Lay out cash
   flows contiguously so \`=IRR(B6:B11)\` works; never
   \`=IRR(B4, B6:B11)\`.
4. Every cell address must be unique. Duplicate entries are rejected.
5. Percentages are decimals with format.type='percentage' (0.12 for 12%).
6. Division formulas wrapped in IFERROR: "=IFERROR(A/B,0)".
7. Only reference a named range if you also define it in namedRanges
   pointing at a real col-B cell.

# ANTI-PATTERNS — THESE HAVE BROKEN REAL WORKBOOKS

  ❌ Same cell emitted twice (one label, one value) — dropped or errors.
  ❌ Formula range includes a label/header cell — #VALUE!.
  ❌ IRR or NPV with two arguments separated by comma — wrong arity.
  ❌ Formula references a col-B cell defined LATER in the sheet.
  ❌ Cross-sheet reference to a sheet name that isn't in this spec.
  ❌ Self-reference (\`=B3*0.05\` at B3) — #CYCLE!.

# FORMULA PATTERN LIBRARY

For complex formulas, prefer validated patterns:
${formulaContext}

Use: "formulaPattern": { "patternId": "npv", "params": { "rate": "B4", "cashFlowRange": "B7:B11", "initialInvestment": "B6" } }

# OUTPUT SCHEMA

{
  "metadata": { "title": "...", "description": "...", "author": "ICAI CAGPT" },
  "sheets": [
    {
      "name": "Sheet Name",
      "purpose": "inputs|calculations|outputs|dashboard",
      "cells": [ /* CellSpec array per layout convention */ ],
      "columnWidths": { "A": 32, "B": 18, "C": 28, "D": 30 },
      "freezePanes": { "row": 2, "col": 0 }
    }
  ],
  "namedRanges": [ /* optional — each must point at a col-B cell of an existing sheet */ ]
}

# VERIFIED WORKED EXAMPLES

Each example has been smoke-tested — built via ExcelWorkbookBuilder
and every formula evaluated via HyperFormula with zero errors. Use
these as your template.

${JSON.stringify(examples, null, 2)}

DO NOT explain or comment. Return ONLY the JSON specification.`;
  }

  /**
   * Build user prompt with unique context
   */
  private buildUserPrompt(request: ExcelModelRequest, uniqueContext: UniqueContext): string {
    let prompt = `Create a complete Excel workbook specification for the following request:

## USER REQUEST
"${request.userQuery}"

## CONTEXT
- Request ID: ${uniqueContext.requestId}
- Generated: ${uniqueContext.timestamp}
${request.industry ? `- Industry: ${request.industry}` : ''}
${request.companyName ? `- Company/Entity: ${request.companyName}` : ''}
${request.modelType ? `- Model Type: ${request.modelType}` : ''}

## PREFERENCES
- Excel Version: ${request.preferences?.excelVersion || '365'}
- Currency: ${request.preferences?.currencySymbol || '$'}
- Include Charts: ${request.preferences?.includeCharts !== false ? 'Yes' : 'No'}
- Protect Formulas: ${request.preferences?.protectFormulas !== false ? 'Yes' : 'No'}
`;

    if (request.contextData) {
      prompt += `\n## PROVIDED DATA\n${JSON.stringify(request.contextData, null, 2)}\n`;
    }

    if (request.conversationHistory?.length) {
      prompt += `\n## CONVERSATION CONTEXT\n`;
      const recentHistory = request.conversationHistory.slice(-4);
      for (const msg of recentHistory) {
        prompt += `${msg.role}: ${msg.content.slice(0, 200)}...\n`;
      }
    }

    prompt += `
## REQUIREMENTS
1. Create ALL sheets needed for this model
2. Include ALL cells with proper formulas (NO hardcoded calculations)
3. Use named ranges for all inputs and key values
4. Apply appropriate formatting (currency, percentage, etc.)
5. Customize all labels for this specific ${request.industry || 'business'} use case

Return ONLY the JSON ExcelWorkbookSpec. No explanation.`;

    return prompt;
  }

  /**
   * Generate unique context for anti-caching
   */
  private generateUniqueContext(): UniqueContext {
    return {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      randomSeed: Math.random().toString(36).substring(7)
    };
  }

  /**
   * Select relevant examples based on model type
   */
  private selectExamples(modelType?: ExcelModelType): Partial<ExcelWorkbookSpec>[] {
    const examples: Partial<ExcelWorkbookSpec>[] = [];
    const allExamples = Object.values(exampleSpecs);
    
    // Always include one relevant example
    switch (modelType) {
      case 'dcf':
      case 'lbo':
      case '3-statement':
        examples.push(exampleSpecs.dcfSimple);
        break;
      case 'loan-amortization':
        examples.push(exampleSpecs.loanAmortization);
        break;
      case 'budget':
      case 'forecast':
        examples.push(exampleSpecs.budgetTemplate);
        break;
      default:
        // Random selection for variety
        const randomIndex = Math.floor(Math.random() * allExamples.length);
        examples.push(allExamples[randomIndex]);
    }

    // Add one more random example for variety (but different from first)
    const remaining = allExamples.filter(e => !examples.includes(e));
    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      examples.push(remaining[randomIndex]);
    }

    return examples;
  }

  /**
   * Get relevant formula patterns for the model type
   */
  private getRelevantFormulaPatterns(modelType?: ExcelModelType): string {
    const relevantCategories: FormulaCategory[] = [];

    switch (modelType) {
      case 'dcf':
      case 'lbo':
      case '3-statement':
        relevantCategories.push('financial', 'accounting');
        break;
      case 'loan-amortization':
        relevantCategories.push('financial');
        break;
      case 'budget':
      case 'forecast':
        relevantCategories.push('aggregation', 'logical', 'date');
        break;
      case 'dashboard':
        relevantCategories.push('aggregation', 'lookup', 'array');
        break;
      default:
        relevantCategories.push('financial', 'aggregation', 'logical');
    }

    let context = '';
    for (const category of relevantCategories) {
      const patterns = formulaPatternLibrary.getByCategory(category);
      context += `\n### ${category.toUpperCase()} FORMULAS:\n`;
      for (const pattern of patterns.slice(0, 5)) { // Limit to avoid token explosion
        context += `- **${pattern.id}**: ${pattern.name}\n`;
        context += `  Template: \`${pattern.template}\`\n`;
        context += `  Example: \`${pattern.example.result}\`\n`;
      }
    }

    return context;
  }

  /**
   * Detect model type from user query
   */
  detectModelType(query: string): ExcelModelType {
    const q = query.toLowerCase();

    if (q.match(/dcf|discounted cash flow|valuation|enterprise value/)) return 'dcf';
    if (q.match(/lbo|leveraged buyout|buyout model/)) return 'lbo';
    if (q.match(/3.?statement|three.?statement|integrated model/)) return '3-statement';
    if (q.match(/budget|annual plan|expense tracking/)) return 'budget';
    if (q.match(/forecast|projection|revenue forecast/)) return 'forecast';
    if (q.match(/loan|mortgage|amortiz/)) return 'loan-amortization';
    if (q.match(/depreciation|asset|capex/)) return 'depreciation';
    if (q.match(/sensitivity|what.?if|scenario analysis/)) return 'sensitivity';
    if (q.match(/dashboard|kpi|summary/)) return 'dashboard';
    if (q.match(/invoice|billing/)) return 'invoice';
    if (q.match(/project|task|tracker/)) return 'project-tracker';
    if (q.match(/inventory|stock/)) return 'inventory';
    if (q.match(/payroll|salary|wage/)) return 'payroll';

    return 'custom';
  }

  /**
   * Check if a query requires Excel model generation.
   *
   * Routes two broad classes of query through the LLM Excel path
   * (which has layout convention + JSON schema + smoke-test +
   * self-heal gating):
   *
   *   1. Explicit Excel/workbook/spreadsheet asks.
   *   2. Investment-appraisal prose (NPV / IRR / DCF / capex
   *      proposals with year-by-year cash flows). The calc-agent
   *      regex path can't parse prose cash flows cleanly, so for
   *      these we defer to the LLM which can extract the structure.
   */
  isExcelModelRequest(query: string): boolean {
    const q = query.toLowerCase();

    const explicitExcelIndicators = [
      /\bexcel\b/,
      /\bspreadsheet\b/,
      /\bworkbook\b/,
      /\b\.xlsx?\b/,
      /\bcreate.*model\b/,
      /\bbuild.*model\b/,
      /\bfinancial model\b/,
      /\btemplate\b/,
      /\bwith formulas?\b/,
      /\bcalculation sheet\b/,
      /\bdcf model\b/,
      /\blbo model\b/,
      /\bamortization schedule\b/,
      /\bdepreciation schedule\b/,
      /\bbudget template\b/,
      /\bforecast model\b/,
    ];
    if (explicitExcelIndicators.some((p) => p.test(q))) return true;

    // Investment-appraisal queries. We want the LLM Excel path to
    // handle these because the user typically supplies prose inputs
    // (e.g. "Revenue: ₹6.5cr/yr, costs: ₹3.2cr/yr, life: 5 years,
    // discount rate: 11%, terminal value: ₹1cr") that the calc-
    // agent regex parser can't structure. Require NPV/IRR/DCF
    // intent PLUS some signal that the user has concrete numeric
    // inputs — to avoid tripping on casual mentions ("what's NPV?").
    const npvIntent = /\b(npv|irr|xirr|discounted cash flow|dcf)\b/.test(q);
    const capexIntent = /\b(capex|capital expenditure|capital budget|investment appraisal|investment decision)\b/.test(q);
    const hasConcreteInputs =
      /\b(?:₹|rs\.?|inr|usd|\$|€|£)\s*\d/.test(query) || // money amount
      /\d+\s*(?:cr|crore|lakh|lac|million|billion|bn|m|k)\b/i.test(q) || // number + scale
      /discount rate|wacc|hurdle rate/.test(q) ||
      /cash\s*flow.*\d/.test(q);
    if ((npvIntent || capexIntent) && hasConcreteInputs) return true;

    return false;
  }
}

interface UniqueContext {
  requestId: string;
  timestamp: string;
  randomSeed: string;
}

export const excelModelPromptBuilder = new ExcelModelPromptBuilder();
