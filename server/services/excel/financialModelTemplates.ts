/**
 * Financial Model Templates
 * Pre-built professional financial model templates with formulas
 * DCF, LBO, 3-Statement, Merger Model, Budget, Sensitivity Analysis
 */

import ExcelJS from 'exceljs';
import { aiFormulaGenerator } from './aiFormulaGenerator';

export interface ModelTemplate {
  name: string;
  description: string;
  category: 'valuation' | 'budgeting' | 'forecasting' | 'analysis' | 'reporting';
  sheets: SheetTemplate[];
  namedRanges: NamedRange[];
  instructions: string;
}

export interface SheetTemplate {
  name: string;
  structure: CellDefinition[][];
  formulas: FormulaCell[];
  formatting: SheetFormatting;
}

export interface CellDefinition {
  value?: any;
  formula?: string;
  style?: CellStyle;
  dataValidation?: any;
}

export interface FormulaCell {
  cell: string;
  formula: string;
  description: string;
}

export interface NamedRange {
  name: string;
  range: string;
  scope: 'workbook' | string; // workbook or sheet name
}

export interface SheetFormatting {
  columnWidths?: number[];
  rowHeights?: number[];
  frozenPanes?: { row: number; column: number };
  conditionalFormatting?: any[];
}

export interface CellStyle {
  font?: { bold?: boolean; color?: string; size?: number };
  fill?: { pattern: string; fgColor: string };
  border?: any;
  numberFormat?: string;
  alignment?: { horizontal?: string; vertical?: string };
}

export class FinancialModelTemplates {
  /**
   * Generate complete DCF model workbook
   */
  async generateDCFModel(params: {
    companyName: string;
    forecastYears: number;
    wacc?: number;
    terminalGrowth?: number;
  }): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    
    // Assumptions sheet
    const assumptionsSheet = workbook.addWorksheet('Assumptions', {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });
    
    this.buildAssumptionsSheet(assumptionsSheet, params);
    
    // Forecasts sheet
    const forecastSheet = workbook.addWorksheet('Forecasts', {
      properties: { tabColor: { argb: 'FF70AD47' } }
    });
    
    this.buildForecastSheet(forecastSheet, params);
    
    // DCF Calculation sheet
    const dcfSheet = workbook.addWorksheet('DCF Valuation', {
      properties: { tabColor: { argb: 'FFFFC000' } }
    });
    
    await this.buildDCFSheet(dcfSheet, params);
    
    // Sensitivity Analysis sheet
    const sensitivitySheet = workbook.addWorksheet('Sensitivity', {
      properties: { tabColor: { argb: 'FFF4B183' } }
    });
    
    this.buildSensitivitySheet(sensitivitySheet);
    
    // Charts sheet
    const chartsSheet = workbook.addWorksheet('Charts', {
      properties: { tabColor: { argb: 'FF8FAADC' } }
    });
    
    return workbook;
  }

  /**
   * Build assumptions sheet for DCF model
   */
  private buildAssumptionsSheet(sheet: ExcelJS.Worksheet, params: any) {
    // Header
    sheet.getCell('A1').value = `${params.companyName} - DCF Model Assumptions`;
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF4472C4' } };
    sheet.mergeCells('A1:C1');
    
    // Key assumptions
    let row = 3;
    
    const assumptions = [
      { label: 'Forecast Period (years)', value: params.forecastYears, format: '0' },
      { label: 'WACC (%)', value: (params.wacc || 0.10) * 100, format: '0.00' },
      { label: 'Terminal Growth Rate (%)', value: (params.terminalGrowth || 0.025) * 100, format: '0.00' },
      { label: '', value: '', format: '' }, // Spacer
      { label: 'Revenue Growth Assumptions:', value: '', format: '', bold: true },
      { label: 'Year 1 Growth (%)', value: 10, format: '0.00' },
      { label: 'Year 2 Growth (%)', value: 8, format: '0.00' },
      { label: 'Year 3 Growth (%)', value: 6, format: '0.00' },
      { label: 'Year 4 Growth (%)', value: 5, format: '0.00' },
      { label: 'Year 5 Growth (%)', value: 4, format: '0.00' },
      { label: '', value: '', format: '' },
      { label: 'Operating Margin Assumptions:', value: '', format: '', bold: true },
      { label: 'EBITDA Margin (%)', value: 25, format: '0.00' },
      { label: 'D&A as % of Revenue', value: 5, format: '0.00' },
      { label: 'Tax Rate (%)', value: 21, format: '0.00' },
      { label: '', value: '', format: '' },
      { label: 'Working Capital Assumptions:', value: '', format: '', bold: true },
      { label: 'NWC as % of Revenue', value: 10, format: '0.00' },
      { label: 'CapEx as % of Revenue', value: 4, format: '0.00' }
    ];
    
    assumptions.forEach(item => {
      sheet.getCell(`A${row}`).value = item.label;
      if (item.bold) {
        sheet.getCell(`A${row}`).font = { bold: true };
      }
      
      if (item.value !== '') {
        sheet.getCell(`B${row}`).value = item.value;
        if (item.format) {
          sheet.getCell(`B${row}`).numFmt = item.format;
        }
        
        // Name key ranges using sheet reference
        if (item.label.includes('WACC')) {
          sheet.getCell(`B${row}`).name = 'WACC';
        } else if (item.label.includes('Terminal Growth')) {
          sheet.getCell(`B${row}`).name = 'Terminal_Growth';
        }
      }
      
      row++;
    });
    
    // Column widths
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 15;
    
    // Freeze panes
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
  }

  /**
   * Build forecast sheet
   */
  private buildForecastSheet(sheet: ExcelJS.Worksheet, params: any) {
    const years = params.forecastYears;
    
    // Headers
    sheet.getCell('A1').value = 'Item';
    sheet.getCell('A1').font = { bold: true };
    
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y); // B, C, D, etc.
      sheet.getCell(`${col}1`).value = `Year ${y}`;
      sheet.getCell(`${col}1`).font = { bold: true };
      sheet.getCell(`${col}1`).alignment = { horizontal: 'center' };
    }
    
    // Financial statement rows
    let row = 2;
    
    // Revenue
    sheet.getCell(`A${row}`).value = 'Revenue';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = 100000; // Base year revenue
    
    for (let y = 2; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      const prevCol = String.fromCharCode(64 + y);
      // Link to growth rate from Assumptions
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${prevCol}${row}*(1+Assumptions!B${5+y}/100)` 
      };
    }
    row++;
    
    // EBITDA
    sheet.getCell(`A${row}`).value = 'EBITDA';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-1}*Assumptions!$B$15/100` 
      };
    }
    row++;
    
    // D&A
    sheet.getCell(`A${row}`).value = 'Depreciation & Amortization';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-2}*Assumptions!$B$16/100` 
      };
    }
    row++;
    
    // EBIT
    sheet.getCell(`A${row}`).value = 'EBIT';
    sheet.getCell(`A${row}`).font = { bold: true };
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-2}-${col}${row-1}` 
      };
    }
    row++;
    
    // Tax
    sheet.getCell(`A${row}`).value = 'Tax';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-1}*Assumptions!$B$17/100` 
      };
    }
    row++;
    
    // NOPAT
    sheet.getCell(`A${row}`).value = 'NOPAT';
    sheet.getCell(`A${row}`).font = { bold: true };
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-2}-${col}${row-1}` 
      };
    }
    row++;
    
    // Add back D&A
    sheet.getCell(`A${row}`).value = 'Add: Depreciation & Amortization';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-4}` 
      };
    }
    row++;
    
    // CapEx
    sheet.getCell(`A${row}`).value = 'Less: CapEx';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-7}*Assumptions!$B$21/100` 
      };
    }
    row++;
    
    // Change in NWC
    sheet.getCell(`A${row}`).value = 'Less: Change in NWC';
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      if (y === 1) {
        sheet.getCell(`${col}${row}`).value = { 
          formula: `${col}${row-8}*Assumptions!$B$20/100` 
        };
      } else {
        const prevCol = String.fromCharCode(64 + y);
        sheet.getCell(`${col}${row}`).value = { 
          formula: `(${col}${row-8}-${prevCol}${row-8})*Assumptions!$B$20/100` 
        };
      }
    }
    row++;
    
    // Free Cash Flow
    sheet.getCell(`A${row}`).value = 'Free Cash Flow';
    sheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF0066CC' } };
    sheet.getCell(`A${row}`).fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: 'FFE6F0FF' } 
    };
    
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`${col}${row}`).value = { 
        formula: `${col}${row-3}+${col}${row-2}-${col}${row-1}-${col}${row}` 
      };
      sheet.getCell(`${col}${row}`).font = { bold: true };
      sheet.getCell(`${col}${row}`).fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFE6F0FF' } 
      };
      sheet.getCell(`${col}${row}`).numFmt = '$#,##0';
    }
    
    // Define FCF range name
    const fcfRange = `B${row}:${String.fromCharCode(65 + years)}${row}`;
    sheet.getCell(`B${row}`).name = 'FCF_Forecast';
    
    // Format all numbers
    for (let r = 2; r <= row; r++) {
      for (let y = 1; y <= years; y++) {
        const col = String.fromCharCode(65 + y);
        if (!sheet.getCell(`${col}${r}`).numFmt) {
          sheet.getCell(`${col}${r}`).numFmt = '$#,##0';
        }
      }
    }
    
    // Column widths
    sheet.getColumn(1).width = 30;
    for (let y = 1; y <= years; y++) {
      sheet.getColumn(y + 1).width = 15;
    }
  }

  /**
   * Build DCF valuation sheet
   */
  private async buildDCFSheet(sheet: ExcelJS.Worksheet, params: any) {
    const years = params.forecastYears;
    
    // Title
    sheet.getCell('A1').value = 'DCF Valuation';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
    sheet.mergeCells('A1:C1');
    
    let row = 3;
    
    // Present value of forecast FCFs
    sheet.getCell(`A${row}`).value = 'Present Value of Forecast Period FCF';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    for (let y = 1; y <= years; y++) {
      const col = String.fromCharCode(65 + y);
      sheet.getCell(`A${row}`).value = `Year ${y} FCF`;
      sheet.getCell(`B${row}`).value = { formula: `Forecasts!${col}${11}` }; // FCF row
      sheet.getCell(`B${row}`).numFmt = '$#,##0';
      
      sheet.getCell(`C${row}`).value = { formula: `B${row}/((1+WACC)^${y})` };
      sheet.getCell(`C${row}`).numFmt = '$#,##0';
      
      row++;
    }
    
    sheet.getCell(`A${row}`).value = 'Sum of PV (Forecast Period)';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = { formula: `SUM(C${row-years}:C${row-1})` };
    sheet.getCell(`C${row}`).numFmt = '$#,##0';
    sheet.getCell(`C${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).name = 'EV_Forecast_Period';
    row += 2;
    
    // Terminal value
    sheet.getCell(`A${row}`).value = 'Terminal Value Calculation';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    sheet.getCell(`A${row}`).value = 'Terminal Year FCF';
    const lastFCFCol = String.fromCharCode(65 + years);
    sheet.getCell(`B${row}`).value = { formula: `Forecasts!${lastFCFCol}${11}*(1+Terminal_Growth)` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    row++;
    
    sheet.getCell(`A${row}`).value = 'Terminal Value';
    sheet.getCell(`B${row}`).value = { formula: `B${row-1}/(WACC-Terminal_Growth)` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    row++;
    
    sheet.getCell(`A${row}`).value = 'PV of Terminal Value';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = { formula: `B${row-1}/((1+WACC)^${years})` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    sheet.getCell(`B${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).name = 'EV_Terminal';
    row += 2;
    
    // Enterprise Value
    sheet.getCell(`A${row}`).value = 'Enterprise Value';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: 'FF0066CC' } };
    sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
    sheet.getCell(`B${row}`).value = { formula: `EV_Forecast_Period+EV_Terminal` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    sheet.getCell(`B${row}`).font = { bold: true, size: 14 };
    sheet.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
    sheet.getCell(`B${row}`).name = 'Enterprise_Value';
    row += 2;
    
    // Bridge to equity value
    sheet.getCell(`A${row}`).value = 'Bridge to Equity Value';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    sheet.getCell(`A${row}`).value = 'Add: Cash';
    sheet.getCell(`B${row}`).value = 10000; // Placeholder
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    sheet.getCell(`B${row}`).name = 'Cash';
    row++;
    
    sheet.getCell(`A${row}`).value = 'Less: Debt';
    sheet.getCell(`B${row}`).value = 50000; // Placeholder
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    sheet.getCell(`B${row}`).name = 'Debt';
    row++;
    
    sheet.getCell(`A${row}`).value = 'Equity Value';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: 'FF0066CC' } };
    sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
    sheet.getCell(`B${row}`).value = { formula: `Enterprise_Value+Cash-Debt` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0';
    sheet.getCell(`B${row}`).font = { bold: true, size: 14 };
    sheet.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
    sheet.getCell(`B${row}`).name = 'Equity_Value';
    row += 2;
    
    // Per share value
    sheet.getCell(`A${row}`).value = 'Shares Outstanding';
    sheet.getCell(`B${row}`).value = 1000; // Placeholder
    sheet.getCell(`B${row}`).numFmt = '#,##0';
    sheet.getCell(`B${row}`).name = 'Shares_Outstanding';
    row++;
    
    sheet.getCell(`A${row}`).value = 'Value Per Share';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    sheet.getCell(`B${row}`).value = { formula: `Equity_Value/Shares_Outstanding` };
    sheet.getCell(`B${row}`).numFmt = '$#,##0.00';
    sheet.getCell(`B${row}`).font = { bold: true, size: 14 };
    sheet.getCell(`B${row}`).name = 'Value_Per_Share';
    
    // Column widths
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 18;
  }

  /**
   * Build sensitivity analysis sheet
   */
  private buildSensitivitySheet(sheet: ExcelJS.Worksheet) {
    // Header
    sheet.getCell('A1').value = 'Sensitivity Analysis';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    
    sheet.getCell('A2').value = 'Use VBA macro "RunDCFSensitivity" to populate this sheet';
    sheet.getCell('A2').font = { italic: true };
    
    // Placeholder table structure
    sheet.getCell('A4').value = 'WACC \\ Terminal Growth';
    sheet.getCell('A4').font = { bold: true };
  }

  /**
   * Generate 3-Statement Model
   */
  async generate3StatementModel(params: { companyName: string; years: number }): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    
    // Income Statement
    const isSheet = workbook.addWorksheet('Income Statement', {
      properties: { tabColor: { argb: 'FF70AD47' } }
    });
    
    // Balance Sheet
    const bsSheet = workbook.addWorksheet('Balance Sheet', {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });
    
    // Cash Flow Statement
    const cfSheet = workbook.addWorksheet('Cash Flow', {
      properties: { tabColor: { argb: 'FFFFC000' } }
    });
    
    return workbook;
  }

  /**
   * Generate Budget Template
   */
  async generateBudgetTemplate(params: {
    businessName: string;
    fiscalYear: number;
    departments?: string[];
  }): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    
    const budgetSheet = workbook.addWorksheet('Annual Budget');
    
    // Header
    budgetSheet.getCell('A1').value = `${params.businessName} - ${params.fiscalYear} Budget`;
    budgetSheet.getCell('A1').font = { bold: true, size: 16 };
    budgetSheet.mergeCells('A1:M1');
    
    // Month headers
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((month, i) => {
      budgetSheet.getCell(1, i + 2).value = month;
      budgetSheet.getCell(1, i + 2).font = { bold: true };
      budgetSheet.getCell(1, i + 2).alignment = { horizontal: 'center' };
    });
    budgetSheet.getCell(1, 14).value = 'Total';
    budgetSheet.getCell(1, 14).font = { bold: true };
    
    return workbook;
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): ModelTemplate[] {
    return [
      {
        name: 'DCF Valuation Model',
        description: 'Complete discounted cash flow model with sensitivity analysis',
        category: 'valuation',
        sheets: [],
        namedRanges: [],
        instructions: 'Fill in assumptions, review forecasts, analyze valuation'
      },
      {
        name: 'LBO Model',
        description: 'Leveraged buyout model with returns calculation',
        category: 'valuation',
        sheets: [],
        namedRanges: [],
        instructions: 'Input entry assumptions, financing structure, and exit scenario'
      },
      {
        name: '3-Statement Model',
        description: 'Integrated Income Statement, Balance Sheet, and Cash Flow',
        category: 'forecasting',
        sheets: [],
        namedRanges: [],
        instructions: 'Build historical financials, then forecast future periods'
      },
      {
        name: 'Annual Budget',
        description: 'Monthly budget with departmental breakdown',
        category: 'budgeting',
        sheets: [],
        namedRanges: [],
        instructions: 'Enter monthly revenue and expense budgets by department'
      },
      {
        name: 'Sensitivity Analysis',
        description: 'Multi-variable sensitivity tables with visualization',
        category: 'analysis',
        sheets: [],
        namedRanges: [],
        instructions: 'Define input variables and output cell for analysis'
      },
      {
        name: 'Merger Model',
        description: 'M&A accretion/dilution analysis',
        category: 'valuation',
        sheets: [],
        namedRanges: [],
        instructions: 'Input acquirer and target financials, deal structure'
      }
    ];
  }
}

export const financialModelTemplates = new FinancialModelTemplates();
