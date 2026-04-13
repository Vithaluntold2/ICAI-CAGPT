/**
 * AI-Driven Excel Formula Generator
 * Uses Claude/GPT-4 to generate complex Excel formulas from natural language
 * Supports: XLOOKUP, INDEX-MATCH, nested IFs, array formulas, dynamic arrays
 */

import { aiProviderRegistry } from '../aiProviders/registry';

export interface FormulaGenerationRequest {
  prompt: string;
  context?: {
    sheetStructure?: SheetStructure;
    existingFormulas?: string[];
    dataTypes?: Record<string, string>;
  };
  complexity: 'simple' | 'moderate' | 'advanced' | 'expert';
}

export interface SheetStructure {
  headers: string[];
  columns: { [key: string]: string }; // Column letter to name mapping
  namedRanges?: string[];
  tables?: string[];
}

export interface FormulaGenerationResult {
  formula: string;
  explanation: string;
  cellRange?: string;
  dependencies: string[];
  formulaType: 'lookup' | 'logical' | 'financial' | 'statistical' | 'array' | 'text' | 'date' | 'custom';
  excelVersion: '2016' | '2019' | '2021' | '365';
  alternatives?: Array<{
    formula: string;
    description: string;
    pros: string[];
    cons: string[];
  }>;
}

export class AIFormulaGenerator {
  /**
   * Generate Excel formula from natural language prompt using AI
   */
  async generateFormula(request: FormulaGenerationRequest): Promise<FormulaGenerationResult> {
    const systemPrompt = this.buildFormulaSystemPrompt();
    const userPrompt = this.buildFormulaUserPrompt(request);

    // Use Claude Sonnet or GPT-4 for formula generation
    const provider = aiProviderRegistry.getProvider('claude' as any) || aiProviderRegistry.getProvider('openai' as any);
    
    if (!provider) {
      throw new Error('No AI provider available for formula generation');
    }

    const response = await provider.generateCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for precise formula generation
      maxTokens: 2000
    });

    return this.parseFormulaResponse(response.content);
  }

  /**
   * Generate multiple formula alternatives
   */
  async generateFormulaAlternatives(
    prompt: string,
    count: number = 3
  ): Promise<FormulaGenerationResult[]> {
    const results: FormulaGenerationResult[] = [];

    for (let i = 0; i < count; i++) {
      const complexity = ['simple', 'moderate', 'advanced'][i] as any;
      const result = await this.generateFormula({ prompt, complexity });
      results.push(result);
    }

    return results;
  }

  /**
   * Optimize existing formula
   */
  async optimizeFormula(formula: string, context?: string): Promise<FormulaGenerationResult> {
    const systemPrompt = `You are an Excel formula optimization expert. Analyze the given formula and provide an optimized version.
Focus on:
1. Performance improvements
2. Readability
3. Modern Excel functions (XLOOKUP vs VLOOKUP, FILTER vs array formulas)
4. Error handling
5. Dynamic array compatibility

Return JSON with: formula, explanation, improvements, performance_gain`;

    const userPrompt = `Optimize this Excel formula:
${formula}

${context ? `Context: ${context}` : ''}

Provide optimized formula and detailed explanation.`;

    const provider = aiProviderRegistry.getProvider('claude' as any) || aiProviderRegistry.getProvider('openai' as any);
    
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const response = await provider.generateCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      maxTokens: 1500
    });

    return this.parseFormulaResponse(response.content);
  }

  /**
   * Build system prompt for formula generation
   */
  private buildFormulaSystemPrompt(): string {
    return `You are an Excel formula expert with deep knowledge of:
- Modern Excel functions (XLOOKUP, FILTER, SORT, UNIQUE, SEQUENCE, XMATCH)
- Legacy functions (VLOOKUP, INDEX-MATCH, SUMIF, COUNTIF)
- Advanced logical functions (nested IF, IFS, SWITCH, CHOOSE)
- Array formulas and dynamic arrays (Excel 365)
- Financial functions (NPV, IRR, XIRR, PMT, FV, PV, RATE)
- Statistical functions (AGGREGATE, SUBTOTAL, array operations)
- Text functions (TEXTJOIN, CONCAT, REGEX equivalents)
- Date functions (EDATE, EOMONTH, NETWORKDAYS, WORKDAY)
- Error handling (IFERROR, IFNA, ISERROR)
- Named ranges and structured references
- Performance optimization techniques

When generating formulas:
1. Always start formulas with "="
2. Use proper Excel syntax
3. Include error handling where appropriate
4. Consider Excel version compatibility
5. Optimize for performance
6. Use meaningful cell references or named ranges
7. Add comments for complex nested formulas
8. Provide step-by-step explanation

Return response as JSON:
{
  "formula": "=XLOOKUP(...)",
  "explanation": "Detailed explanation",
  "cellRange": "B2:B100",
  "dependencies": ["A2:A100", "D2:D100"],
  "formulaType": "lookup|logical|financial|statistical|array|text|date|custom",
  "excelVersion": "2016|2019|2021|365",
  "alternatives": [
    {
      "formula": "=INDEX(MATCH(...))",
      "description": "Legacy alternative",
      "pros": ["Works in older Excel", "Widely known"],
      "cons": ["More complex syntax", "Slower"]
    }
  ]
}`;
  }

  /**
   * Build user prompt for formula generation
   */
  private buildFormulaUserPrompt(request: FormulaGenerationRequest): string {
    let prompt = `Generate an Excel formula for: ${request.prompt}\n\n`;

    prompt += `Complexity level: ${request.complexity}\n\n`;

    if (request.context?.sheetStructure) {
      prompt += `Sheet structure:\n`;
      prompt += `Headers: ${request.context.sheetStructure.headers.join(', ')}\n`;
      
      if (request.context.sheetStructure.columns) {
        prompt += `Columns:\n`;
        Object.entries(request.context.sheetStructure.columns).forEach(([col, name]) => {
          prompt += `  ${col}: ${name}\n`;
        });
      }

      if (request.context.sheetStructure.namedRanges) {
        prompt += `Named ranges: ${request.context.sheetStructure.namedRanges.join(', ')}\n`;
      }

      if (request.context.sheetStructure.tables) {
        prompt += `Tables: ${request.context.sheetStructure.tables.join(', ')}\n`;
      }
    }

    if (request.context?.existingFormulas) {
      prompt += `\nExisting formulas in sheet:\n`;
      request.context.existingFormulas.forEach((f, i) => {
        prompt += `${i + 1}. ${f}\n`;
      });
    }

    if (request.context?.dataTypes) {
      prompt += `\nData types:\n`;
      Object.entries(request.context.dataTypes).forEach(([col, type]) => {
        prompt += `  ${col}: ${type}\n`;
      });
    }

    prompt += `\nGenerate the formula and return as JSON with formula, explanation, dependencies, type, and alternatives.`;

    return prompt;
  }

  /**
   * Parse AI response into structured formula result
   */
  private parseFormulaResponse(content: string): FormulaGenerationResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          formula: parsed.formula || '',
          explanation: parsed.explanation || '',
          cellRange: parsed.cellRange,
          dependencies: parsed.dependencies || [],
          formulaType: parsed.formulaType || 'custom',
          excelVersion: parsed.excelVersion || '365',
          alternatives: parsed.alternatives || []
        };
      }

      // Fallback: extract formula from text
      const formulaMatch = content.match(/=[\w\s\(\)\+\-\*\/\,\:\[\]\{\}\"\'\<\>\=\&\|\!]+/);
      
      return {
        formula: formulaMatch ? formulaMatch[0] : '=A1',
        explanation: content,
        dependencies: [],
        formulaType: 'custom',
        excelVersion: '365',
        alternatives: []
      };
    } catch (error) {
      console.error('Error parsing formula response:', error);
      return {
        formula: '=A1',
        explanation: 'Error generating formula',
        dependencies: [],
        formulaType: 'custom',
        excelVersion: '365',
        alternatives: []
      };
    }
  }

  /**
   * Generate complex nested IF formula
   */
  async generateNestedIF(conditions: Array<{ test: string; value: string }>): Promise<string> {
    let formula = '=';
    
    for (let i = 0; i < conditions.length; i++) {
      if (i > 0) formula += ',';
      formula += `IF(${conditions[i].test},${conditions[i].value}`;
    }
    
    // Add default value and close all IFs
    formula += ',"Default"';
    formula += ')'.repeat(conditions.length);

    return formula;
  }

  /**
   * Generate XLOOKUP formula
   */
  generateXLOOKUP(
    lookupValue: string,
    lookupArray: string,
    returnArray: string,
    ifNotFound?: string,
    matchMode: number = 0,
    searchMode: number = 1
  ): string {
    let formula = `=XLOOKUP(${lookupValue},${lookupArray},${returnArray}`;
    
    if (ifNotFound) {
      formula += `,${ifNotFound}`;
    }
    
    if (matchMode !== 0 || searchMode !== 1) {
      formula += `,${ifNotFound || '""'},${matchMode},${searchMode}`;
    }
    
    formula += ')';
    return formula;
  }

  /**
   * Generate INDEX-MATCH formula (legacy alternative)
   */
  generateIndexMatch(
    returnRange: string,
    lookupValue: string,
    lookupRange: string,
    columnOffset: number = 0
  ): string {
    if (columnOffset === 0) {
      return `=INDEX(${returnRange},MATCH(${lookupValue},${lookupRange},0))`;
    } else {
      return `=INDEX(${returnRange},MATCH(${lookupValue},${lookupRange},0),${columnOffset})`;
    }
  }

  /**
   * Generate SUMIFS with multiple criteria
   */
  generateSUMIFS(
    sumRange: string,
    criteria: Array<{ range: string; criterion: string }>
  ): string {
    let formula = `=SUMIFS(${sumRange}`;
    
    criteria.forEach(c => {
      formula += `,${c.range},${c.criterion}`;
    });
    
    formula += ')';
    return formula;
  }

  /**
   * Generate dynamic array formula (Excel 365)
   */
  generateDynamicArray(
    operation: 'FILTER' | 'SORT' | 'UNIQUE' | 'SEQUENCE' | 'SORTBY',
    params: any[]
  ): string {
    return `=${operation}(${params.join(',')})`;
  }
}

export const aiFormulaGenerator = new AIFormulaGenerator();
