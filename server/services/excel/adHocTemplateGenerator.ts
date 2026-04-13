/**
 * Ad-Hoc Excel Template Generator
 * AI-powered generation of custom Excel templates from any business scenario
 * Uses Claude/GPT-4 to understand requirements and build appropriate structure
 */

import ExcelJS from 'exceljs';
import { aiProviderRegistry } from '../aiProviders/registry';
import { aiFormulaGenerator } from './aiFormulaGenerator';

export interface AdHocTemplateRequest {
  description: string;
  industry?: string;
  purpose?: string;
  dataFields?: string[];
  calculationNeeds?: string[];
  numberOfRows?: number;
  reportingFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

export interface TemplateStructure {
  sheets: SheetSpec[];
  relationships: SheetRelationship[];
  automations: string[];
  instructions: string;
}

export interface SheetSpec {
  name: string;
  purpose: string;
  sections: SectionSpec[];
  conditionalFormatting?: ConditionalFormatRule[];
  dataValidation?: DataValidationRule[];
  charts?: ChartSpec[];
}

export interface SectionSpec {
  startRow: number;
  startCol: number;
  title: string;
  type: 'input' | 'calculation' | 'output' | 'data' | 'summary';
  headers?: string[];
  dataTypes?: string[];
  formulas?: FormulaSpec[];
  styling?: CellStyling;
}

export interface FormulaSpec {
  cell: string;
  formula: string;
  explanation: string;
  dependencies?: string[];
}

export interface ConditionalFormatRule {
  range: string;
  condition: string;
  format: any;
}

export interface DataValidationRule {
  range: string;
  type: 'list' | 'number' | 'date' | 'text';
  criteria: any;
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'column';
  title: string;
  dataRange: string;
  position: { row: number; col: number };
}

export interface SheetRelationship {
  sourceSheet: string;
  targetSheet: string;
  linkType: 'formula' | 'reference' | 'pivot';
  description: string;
}

export interface CellStyling {
  headerStyle?: {
    font?: { bold?: boolean; size?: number; color?: string };
    fill?: { pattern: string; fgColor: string };
    border?: any;
  };
  dataStyle?: {
    numberFormat?: string;
    alignment?: { horizontal?: string; vertical?: string };
  };
}

export class AdHocTemplateGenerator {
  /**
   * Generate custom Excel template from natural language description
   */
  async generateTemplate(request: AdHocTemplateRequest): Promise<ExcelJS.Workbook> {
    console.log('[AdHocTemplateGenerator] Analyzing request:', request.description);
    
    // Step 1: Use AI to understand requirements and design structure
    const structure = await this.analyzeAndDesignStructure(request);
    
    // Step 2: Build the workbook based on AI-designed structure
    const workbook = await this.buildWorkbook(structure, request);
    
    console.log('[AdHocTemplateGenerator] Template generated with', workbook.worksheets.length, 'sheets');
    
    return workbook;
  }

  /**
   * Use AI to analyze requirements and design optimal Excel structure
   */
  private async analyzeAndDesignStructure(request: AdHocTemplateRequest): Promise<TemplateStructure> {
    const systemPrompt = `You are an Excel template design expert. Analyze business requirements and design optimal Excel workbook structures.

Your task is to:
1. Understand the business scenario and purpose
2. Identify required data inputs and calculations
3. Design sheet structure with appropriate sections
4. Recommend formulas and relationships between sheets
5. Suggest data validation and conditional formatting
6. Plan any charts or visualizations

Return JSON with this structure:
{
  "sheets": [
    {
      "name": "Sheet name",
      "purpose": "What this sheet does",
      "sections": [
        {
          "startRow": 1,
          "startCol": 1,
          "title": "Section title",
          "type": "input|calculation|output|data|summary",
          "headers": ["Column1", "Column2"],
          "dataTypes": ["text", "number", "currency", "date", "percent"],
          "formulas": [
            {
              "cell": "C2",
              "formula": "=A2*B2",
              "explanation": "Multiply quantity by price"
            }
          ],
          "styling": {
            "headerStyle": {
              "font": {"bold": true, "size": 12, "color": "FFFFFF"},
              "fill": {"pattern": "solid", "fgColor": "4472C4"}
            }
          }
        }
      ],
      "conditionalFormatting": [
        {
          "range": "D2:D100",
          "condition": ">1000",
          "format": {"fill": {"fgColor": "C6EFCE"}}
        }
      ],
      "dataValidation": [
        {
          "range": "E2:E100",
          "type": "list",
          "criteria": {"values": ["Yes", "No"]}
        }
      ],
      "charts": [
        {
          "type": "line",
          "title": "Trend",
          "dataRange": "A1:B10",
          "position": {"row": 1, "col": 8}
        }
      ]
    }
  ],
  "relationships": [
    {
      "sourceSheet": "Data",
      "targetSheet": "Summary",
      "linkType": "formula",
      "description": "Summary totals reference Data sheet"
    }
  ],
  "automations": [
    "Auto-calculate totals when data changes",
    "Conditional formatting highlights values >threshold"
  ],
  "instructions": "Step-by-step user instructions"
}

Design for:
- Professional appearance
- Clear data flow
- Appropriate formulas
- User-friendly input areas
- Summary/dashboard views where appropriate
- Data validation to prevent errors
- Conditional formatting for insights`;

    const userPrompt = this.buildDesignPrompt(request);

    const provider = aiProviderRegistry.getProvider('claude' as any) || aiProviderRegistry.getProvider('openai' as any);
    
    if (!provider) {
      throw new Error('No AI provider available for template design');
    }

    const response = await provider.generateCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 4000
    });

    return this.parseStructureResponse(response.content);
  }

  /**
   * Build design prompt from request
   */
  private buildDesignPrompt(request: AdHocTemplateRequest): string {
    let prompt = `Design an Excel template for:\n\n`;
    prompt += `Description: ${request.description}\n\n`;

    if (request.industry) {
      prompt += `Industry: ${request.industry}\n`;
    }

    if (request.purpose) {
      prompt += `Purpose: ${request.purpose}\n`;
    }

    if (request.dataFields && request.dataFields.length > 0) {
      prompt += `\nRequired data fields:\n`;
      request.dataFields.forEach(field => prompt += `- ${field}\n`);
    }

    if (request.calculationNeeds && request.calculationNeeds.length > 0) {
      prompt += `\nCalculations needed:\n`;
      request.calculationNeeds.forEach(calc => prompt += `- ${calc}\n`);
    }

    if (request.reportingFrequency) {
      prompt += `\nReporting frequency: ${request.reportingFrequency}\n`;
    }

    if (request.numberOfRows) {
      prompt += `Expected number of data rows: ~${request.numberOfRows}\n`;
    }

    prompt += `\nDesign a professional, user-friendly Excel template with appropriate sheets, formulas, formatting, and data validation.`;

    return prompt;
  }

  /**
   * Parse AI response into template structure
   */
  private parseStructureResponse(content: string): TemplateStructure {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback structure
      return this.createFallbackStructure();
    } catch (error) {
      console.error('Error parsing template structure:', error);
      return this.createFallbackStructure();
    }
  }

  /**
   * Create fallback structure if AI parsing fails
   */
  private createFallbackStructure(): TemplateStructure {
    return {
      sheets: [
        {
          name: 'Data Entry',
          purpose: 'Input data',
          sections: [
            {
              startRow: 1,
              startCol: 1,
              title: 'Data',
              type: 'input',
              headers: ['Item', 'Value', 'Notes'],
              dataTypes: ['text', 'number', 'text'],
              formulas: []
            }
          ]
        },
        {
          name: 'Summary',
          purpose: 'Summary calculations',
          sections: [
            {
              startRow: 1,
              startCol: 1,
              title: 'Summary',
              type: 'calculation',
              headers: ['Metric', 'Value'],
              formulas: [
                {
                  cell: 'B2',
                  formula: '=SUM(\'Data Entry\'!B:B)',
                  explanation: 'Total of all values'
                }
              ]
            }
          ]
        }
      ],
      relationships: [
        {
          sourceSheet: 'Data Entry',
          targetSheet: 'Summary',
          linkType: 'formula',
          description: 'Summary references Data Entry'
        }
      ],
      automations: ['Auto-calculate totals'],
      instructions: 'Enter data in Data Entry sheet, view summary in Summary sheet'
    };
  }

  /**
   * Build Excel workbook from AI-designed structure
   */
  private async buildWorkbook(structure: TemplateStructure, request: AdHocTemplateRequest): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'ICAI CAGPT';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Build each sheet
    for (const sheetSpec of structure.sheets) {
      const sheet = workbook.addWorksheet(sheetSpec.name, {
        properties: { tabColor: { argb: this.getTabColor(sheetSpec.purpose) } }
      });

      await this.buildSheet(sheet, sheetSpec, workbook);
    }

    // Add instructions sheet
    this.addInstructionsSheet(workbook, structure, request);

    return workbook;
  }

  /**
   * Build individual sheet based on specification
   */
  private async buildSheet(
    sheet: ExcelJS.Worksheet,
    spec: SheetSpec,
    workbook: ExcelJS.Workbook
  ): Promise<void> {
    // Build each section
    for (const section of spec.sections) {
      await this.buildSection(sheet, section, workbook);
    }

    // Apply conditional formatting
    if (spec.conditionalFormatting) {
      this.applyConditionalFormatting(sheet, spec.conditionalFormatting);
    }

    // Apply data validation
    if (spec.dataValidation) {
      this.applyDataValidation(sheet, spec.dataValidation);
    }

    // Auto-fit columns
    sheet.columns.forEach((column, idx) => {
      let maxLength = 10;
      if (column && column.values) {
        column.values.forEach((value: any) => {
          if (value) {
            const length = value.toString().length;
            if (length > maxLength) maxLength = length;
          }
        });
      }
      column.width = Math.min(maxLength + 2, 50);
    });

    // Freeze panes (freeze first row by default)
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  /**
   * Build section within a sheet
   */
  private async buildSection(
    sheet: ExcelJS.Worksheet,
    section: SectionSpec,
    workbook: ExcelJS.Workbook
  ): Promise<void> {
    let row = section.startRow;
    const col = section.startCol;

    // Section title if not the first row
    if (row > 1) {
      const titleCell = sheet.getCell(row, col);
      titleCell.value = section.title;
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF4472C4' } };
      row++;
    }

    // Headers
    if (section.headers && section.headers.length > 0) {
      section.headers.forEach((header, idx) => {
        const cell = sheet.getCell(row, col + idx);
        cell.value = header;
        
        // Apply header styling
        if (section.styling?.headerStyle) {
          if (section.styling.headerStyle.font) {
            cell.font = section.styling.headerStyle.font as any;
          }
          if (section.styling.headerStyle.fill) {
            cell.fill = {
              type: 'pattern',
              pattern: section.styling.headerStyle.fill.pattern as any,
              fgColor: { argb: section.styling.headerStyle.fill.fgColor }
            };
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          // Default header styling
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
      row++;
    }

    // Apply formulas
    if (section.formulas && section.formulas.length > 0) {
      for (const formulaSpec of section.formulas) {
        const cell = sheet.getCell(formulaSpec.cell);
        cell.value = { formula: formulaSpec.formula };
        
        // Apply data styling
        if (section.styling?.dataStyle?.numberFormat) {
          cell.numFmt = section.styling.dataStyle.numberFormat;
        } else if (section.dataTypes) {
          // Auto-detect number format from data type
          const colIdx = this.getCellColumn(formulaSpec.cell) - col;
          if (colIdx >= 0 && colIdx < section.dataTypes.length) {
            cell.numFmt = this.getNumberFormat(section.dataTypes[colIdx]);
          }
        }
      }
    }

    // Add sample data rows if input type
    if (section.type === 'input' && section.headers) {
      const numSampleRows = 5;
      for (let i = 0; i < numSampleRows; i++) {
        section.headers.forEach((_, idx) => {
          const cell = sheet.getCell(row + i, col + idx);
          
          // Set number format based on data type
          if (section.dataTypes && idx < section.dataTypes.length) {
            cell.numFmt = this.getNumberFormat(section.dataTypes[idx]);
          }
          
          // Add data validation if specified
          if (section.styling?.dataStyle?.numberFormat) {
            cell.numFmt = section.styling.dataStyle.numberFormat;
          }
        });
      }
    }
  }

  /**
   * Apply conditional formatting rules
   */
  private applyConditionalFormatting(
    sheet: ExcelJS.Worksheet,
    rules: ConditionalFormatRule[]
  ): void {
    rules.forEach(rule => {
      try {
        sheet.addConditionalFormatting({
          ref: rule.range,
          rules: [
            {
              type: 'cellIs',
              operator: 'greaterThan' as any,
              formulae: [rule.condition],
              style: rule.format,
              priority: 1
            }
          ]
        });
      } catch (error) {
        console.error('Error applying conditional formatting:', error);
      }
    });
  }

  /**
   * Apply data validation rules
   */
  private applyDataValidation(
    sheet: ExcelJS.Worksheet,
    rules: DataValidationRule[]
  ): void {
    rules.forEach(rule => {
      try {
        const range = sheet.getCell(rule.range);
        
        if (rule.type === 'list') {
          range.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${rule.criteria.values.join(',')}"`]
          };
        }
      } catch (error) {
        console.error('Error applying data validation:', error);
      }
    });
  }

  /**
   * Add instructions sheet
   */
  private addInstructionsSheet(
    workbook: ExcelJS.Workbook,
    structure: TemplateStructure,
    request: AdHocTemplateRequest
  ): void {
    const sheet = workbook.addWorksheet('Instructions', {
      properties: { tabColor: { argb: 'FFF4B183' } }
    });

    let row = 1;

    // Title
    sheet.getCell(row, 1).value = 'Template Instructions';
    sheet.getCell(row, 1).font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
    row += 2;

    // Description
    sheet.getCell(row, 1).value = 'Description:';
    sheet.getCell(row, 1).font = { bold: true };
    row++;
    sheet.getCell(row, 1).value = request.description;
    row += 2;

    // Sheet guide
    sheet.getCell(row, 1).value = 'Sheet Guide:';
    sheet.getCell(row, 1).font = { bold: true };
    row++;
    
    structure.sheets.forEach(sheetSpec => {
      sheet.getCell(row, 1).value = `• ${sheetSpec.name}:`;
      sheet.getCell(row, 1).font = { bold: true };
      sheet.getCell(row, 2).value = sheetSpec.purpose;
      row++;
    });
    row++;

    // Usage instructions
    if (structure.instructions) {
      sheet.getCell(row, 1).value = 'How to Use:';
      sheet.getCell(row, 1).font = { bold: true };
      row++;
      sheet.getCell(row, 1).value = structure.instructions;
      sheet.getCell(row, 1).alignment = { wrapText: true };
      row += 2;
    }

    // Automations
    if (structure.automations && structure.automations.length > 0) {
      sheet.getCell(row, 1).value = 'Automated Features:';
      sheet.getCell(row, 1).font = { bold: true };
      row++;
      
      structure.automations.forEach(automation => {
        sheet.getCell(row, 1).value = `✓ ${automation}`;
        row++;
      });
    }

    // Column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 60;
  }

  /**
   * Helper: Get tab color based on sheet purpose
   */
  private getTabColor(purpose: string): string {
    const purposeLower = purpose.toLowerCase();
    
    if (purposeLower.includes('input') || purposeLower.includes('data entry')) {
      return 'FF70AD47'; // Green
    } else if (purposeLower.includes('calculation')) {
      return 'FF4472C4'; // Blue
    } else if (purposeLower.includes('summary') || purposeLower.includes('dashboard')) {
      return 'FFFFC000'; // Yellow
    } else if (purposeLower.includes('output') || purposeLower.includes('report')) {
      return 'FFF4B183'; // Orange
    }
    
    return 'FF8FAADC'; // Light blue default
  }

  /**
   * Helper: Get number format based on data type
   */
  private getNumberFormat(dataType: string): string {
    const typeLower = dataType.toLowerCase();
    
    if (typeLower.includes('currency') || typeLower.includes('dollar')) {
      return '$#,##0.00';
    } else if (typeLower.includes('percent')) {
      return '0.00%';
    } else if (typeLower.includes('number') || typeLower.includes('integer')) {
      return '#,##0';
    } else if (typeLower.includes('decimal')) {
      return '#,##0.00';
    } else if (typeLower.includes('date')) {
      return 'mm/dd/yyyy';
    }
    
    return '@'; // Text
  }

  /**
   * Helper: Extract column number from cell reference
   */
  private getCellColumn(cellRef: string): number {
    const match = cellRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 1;
    
    const letters = match[1];
    let col = 0;
    
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    
    return col;
  }
}

export const adHocTemplateGenerator = new AdHocTemplateGenerator();
