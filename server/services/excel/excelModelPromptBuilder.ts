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

const exampleSpecs: Record<string, Partial<ExcelWorkbookSpec>> = {
  dcfSimple: {
    metadata: { title: 'DCF Valuation Model' },
    sheets: [
      {
        name: 'Assumptions',
        purpose: 'inputs',
        tabColor: 'FF4472C4',
        cells: [
          { cell: 'A1', type: 'header', value: 'DCF Model Assumptions' },
          { cell: 'A3', type: 'label', value: 'WACC' },
          { cell: 'B3', type: 'input', value: 0.10, format: { type: 'percentage', decimals: 1 }, name: 'WACC' },
          { cell: 'A4', type: 'label', value: 'Terminal Growth Rate' },
          { cell: 'B4', type: 'input', value: 0.025, format: { type: 'percentage', decimals: 1 }, name: 'TerminalGrowth' },
          { cell: 'A5', type: 'label', value: 'Tax Rate' },
          { cell: 'B5', type: 'input', value: 0.21, format: { type: 'percentage', decimals: 0 }, name: 'TaxRate' }
        ],
        columnWidths: { 'A': 25, 'B': 15 },
        freezePanes: { row: 1, col: 0 }
      },
      {
        name: 'DCF Calculation',
        purpose: 'calculations',
        tabColor: 'FF70AD47',
        cells: [
          { cell: 'A1', type: 'header', value: 'Year' },
          { cell: 'B1', type: 'header', value: '1' },
          { cell: 'C1', type: 'header', value: '2' },
          { cell: 'A2', type: 'label', value: 'Free Cash Flow' },
          { cell: 'B2', type: 'input', value: 100000, format: { type: 'currency' } },
          { cell: 'C2', type: 'formula', formula: '=B2*1.05', format: { type: 'currency' } },
          { cell: 'A3', type: 'label', value: 'Discount Factor' },
          { cell: 'B3', type: 'formula', formulaPattern: { patternId: 'discountFactor', params: { rate: 'WACC', period: 'B1' } } },
          { cell: 'A4', type: 'label', value: 'Present Value' },
          { cell: 'B4', type: 'formula', formula: '=B2*B3', format: { type: 'currency' } },
          { cell: 'A6', type: 'total', value: 'Enterprise Value' },
          { cell: 'B6', type: 'formula', formula: '=SUM(B4:C4)+D5', format: { type: 'currency' } }
        ]
      }
    ],
    namedRanges: [
      { name: 'FCF_Range', range: 'B2:G2', scope: 'DCF Calculation' }
    ]
  },

  loanAmortization: {
    metadata: { title: 'Loan Amortization Schedule' },
    sheets: [
      {
        name: 'Loan Details',
        purpose: 'inputs',
        cells: [
          { cell: 'A1', type: 'header', value: 'Loan Parameters' },
          { cell: 'A3', type: 'label', value: 'Principal Amount' },
          { cell: 'B3', type: 'input', value: 250000, format: { type: 'currency' }, name: 'Principal' },
          { cell: 'A4', type: 'label', value: 'Annual Interest Rate' },
          { cell: 'B4', type: 'input', value: 0.065, format: { type: 'percentage', decimals: 2 }, name: 'AnnualRate' },
          { cell: 'A5', type: 'label', value: 'Loan Term (Years)' },
          { cell: 'B5', type: 'input', value: 30, name: 'LoanYears' },
          { cell: 'A7', type: 'label', value: 'Monthly Payment' },
          { cell: 'B7', type: 'formula', formulaPattern: { 
            patternId: 'pmt', 
            params: { rate: 'AnnualRate/12', nper: 'LoanYears*12', pv: '-Principal' } 
          }, format: { type: 'currency' }, name: 'MonthlyPayment' }
        ]
      },
      {
        name: 'Schedule',
        purpose: 'calculations',
        cells: [
          { cell: 'A1', type: 'header', value: 'Payment #' },
          { cell: 'B1', type: 'header', value: 'Payment' },
          { cell: 'C1', type: 'header', value: 'Principal' },
          { cell: 'D1', type: 'header', value: 'Interest' },
          { cell: 'E1', type: 'header', value: 'Balance' },
          { cell: 'A2', type: 'value', value: 1 },
          { cell: 'B2', type: 'formula', formula: '=MonthlyPayment', format: { type: 'currency' } },
          { cell: 'C2', type: 'formula', formulaPattern: {
            patternId: 'ppmt',
            params: { rate: 'AnnualRate/12', per: 'A2', nper: 'LoanYears*12', pv: '-Principal' }
          }, format: { type: 'currency' } },
          { cell: 'D2', type: 'formula', formulaPattern: {
            patternId: 'ipmt',
            params: { rate: 'AnnualRate/12', per: 'A2', nper: 'LoanYears*12', pv: '-Principal' }
          }, format: { type: 'currency' } },
          { cell: 'E2', type: 'formula', formula: '=Principal+C2', format: { type: 'currency' } }
        ],
        conditionalFormatting: [
          { range: 'E2:E361', type: 'dataBar', rule: { colors: ['#63BE7B'] } }
        ]
      }
    ]
  },

  budgetTemplate: {
    metadata: { title: 'Annual Budget Template' },
    sheets: [
      {
        name: 'Budget',
        purpose: 'inputs',
        cells: [
          { cell: 'A1', type: 'header', value: 'Category' },
          { cell: 'B1', type: 'header', value: 'Jan' },
          { cell: 'C1', type: 'header', value: 'Feb' },
          { cell: 'N1', type: 'header', value: 'Total' },
          { cell: 'A2', type: 'subheader', value: 'REVENUE' },
          { cell: 'A3', type: 'label', value: 'Product Sales' },
          { cell: 'B3', type: 'input', value: 50000, format: { type: 'currency' } },
          { cell: 'N3', type: 'formula', formula: '=SUM(B3:M3)', format: { type: 'currency' } },
          { cell: 'A10', type: 'total', value: 'Total Revenue' },
          { cell: 'B10', type: 'formula', formula: '=SUM(B3:B9)', format: { type: 'currency' } },
          { cell: 'A12', type: 'subheader', value: 'EXPENSES' },
          { cell: 'A20', type: 'total', value: 'Net Income' },
          { cell: 'B20', type: 'formula', formula: '=B10-B18', format: { type: 'currency' } }
        ],
        dataValidation: [
          { range: 'B3:M9', type: 'decimal', operator: 'greaterThan', min: 0, errorMessage: 'Please enter a positive number' }
        ]
      }
    ]
  }
};

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

CRITICAL RULES:
1. ALL calculations MUST use Excel formulas - NEVER hardcode computed values
2. Use the formula patterns provided - they are tested and validated
3. Use named ranges in formulas for readability: "=Revenue*GrossMargin" not "=B5*C12"
4. For formula patterns, specify the patternId and params
5. For simple formulas, write the formula directly
6. Include proper number formatting for each cell

CELL SPECIFICATION FORMAT:
{
  "cell": "A1",
  "type": "label|input|formula|value|header|subheader|total",
  "value": "Static value (for label/value/header types)",
  "formula": "=Direct Excel formula",
  "formulaPattern": {
    "patternId": "npv|irr|pmt|...",
    "params": { "rate": "B2", "cashFlowRange": "C5:C10" }
  },
  "name": "NamedRangeName (if this cell should be named)",
  "format": {
    "type": "number|currency|percentage|date|text|accounting",
    "decimals": 2,
    "currencySymbol": "$",
    "negativeRed": true
  },
  "comment": "Tooltip/comment for user guidance"
}

EXAMPLE WORKBOOK SPECS:
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
    return `You are an expert Excel financial modeler and formula engineer. Your task is to generate complete, professional Excel workbook specifications as JSON.

# REQUEST ID: ${uniqueContext.requestId}
# TIMESTAMP: ${uniqueContext.timestamp}

## CRITICAL RULES - FOLLOW EXACTLY

### 1. ALL CALCULATIONS MUST USE EXCEL FORMULAS
- NEVER hardcode calculated values. The user needs a dynamic model.
- Every number that depends on another number MUST be a formula.
- Example: If Revenue is $100,000 and Growth is 5%, Year 2 Revenue is NOT $105,000
  It is: formula: "=B5*(1+B6)" or "=Revenue*(1+GrowthRate)"

### 2. USE THE FORMULA PATTERN LIBRARY
For complex financial formulas, use the validated patterns:
${formulaContext}

To use a pattern, specify:
"formulaPattern": {
  "patternId": "npv",
  "params": { "rate": "WACC", "cashFlowRange": "B5:G5", "initialInvestment": "B4" }
}

### 3. NAME EVERYTHING
- Create named ranges for ALL inputs: Revenue, GrowthRate, WACC, TaxRate, etc.
- Use names in formulas: "=EBITDA*EBITDAMargin" not "=B10*B11"
- This makes the model readable and maintainable

### 4. PROFESSIONAL STRUCTURE
- Sheet 1: Inputs/Assumptions (yellow input cells)
- Sheet 2: Calculations (intermediate calcs)
- Sheet 3: Outputs/Summary (results, dashboards)
- Use proper headers, sections, and formatting

### 5. FORMATTING
- Currency cells: { "type": "currency", "decimals": 0 }
- Percentages: { "type": "percentage", "decimals": 1 }
- Input cells: type: "input" (will be yellow, unlocked)
- Formula cells: type: "formula" (will be protected)

### 6. ERROR HANDLING
- Wrap division formulas in IFERROR: "=IFERROR(A1/B1,0)"
- Use named ranges to avoid #REF! errors

## OUTPUT FORMAT
Return a valid JSON object matching ExcelWorkbookSpec schema:
{
  "metadata": {
    "title": "Model name",
    "description": "What this model does",
    "author": "ICAI CAGPT",
    "keywords": ["financial", "model", "dcf"]
  },
  "sheets": [
    {
      "name": "Sheet Name",
      "purpose": "inputs|calculations|outputs|dashboard",
      "tabColor": "FF4472C4",
      "cells": [
        { "cell": "A1", "type": "header", "value": "Header Text" },
        { "cell": "B3", "type": "input", "value": 0.10, "format": {"type": "percentage"}, "name": "WACC" },
        { "cell": "C5", "type": "formula", "formula": "=NPV(WACC,B10:B15)+B9", "format": {"type": "currency"} }
      ],
      "columnWidths": { "A": 30, "B": 15 },
      "freezePanes": { "row": 1, "col": 1 },
      "dataValidation": [],
      "conditionalFormatting": []
    }
  ],
  "namedRanges": [
    { "name": "WACC", "range": "Assumptions!B3", "comment": "Weighted Average Cost of Capital" }
  ]
}

## EXAMPLE SPECIFICATIONS
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
   * Check if a query requires Excel model generation
   */
  isExcelModelRequest(query: string): boolean {
    const q = query.toLowerCase();
    
    const excelIndicators = [
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
      /\bforecast model\b/
    ];

    return excelIndicators.some(pattern => pattern.test(q));
  }
}

interface UniqueContext {
  requestId: string;
  timestamp: string;
  randomSeed: string;
}

export const excelModelPromptBuilder = new ExcelModelPromptBuilder();
