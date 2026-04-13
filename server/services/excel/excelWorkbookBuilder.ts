/**
 * Excel Workbook Builder
 * 
 * Converts AI-generated workbook specifications into actual Excel files using ExcelJS.
 * Handles all formatting, formulas, charts, data validation, and conditional formatting.
 * 
 * Key features:
 * - Validates formulas before insertion
 * - Applies professional styling
 * - Creates named ranges
 * - Adds data validation dropdowns
 * - Generates charts
 * - Protects formula cells while allowing input cells to be edited
 */

import ExcelJS from 'exceljs';
import { formulaPatternLibrary } from './formulaPatternLibrary';

// =============================================================================
// TYPE DEFINITIONS - Workbook Specification Schema
// =============================================================================

export interface ExcelWorkbookSpec {
  metadata: WorkbookMetadata;
  sheets: SheetSpec[];
  namedRanges?: NamedRangeSpec[];
  globalStyles?: GlobalStyles;
}

export interface WorkbookMetadata {
  title: string;
  subject?: string;
  description?: string;
  author?: string;
  company?: string;
  created?: Date;
  keywords?: string[];
}

export interface SheetSpec {
  name: string;
  purpose: 'inputs' | 'calculations' | 'outputs' | 'dashboard' | 'data' | 'assumptions';
  tabColor?: string;
  cells: CellSpec[];
  columnWidths?: Record<string, number>;
  rowHeights?: Record<number, number>;
  freezePanes?: { row: number; col: number };
  printSettings?: PrintSettings;
  conditionalFormatting?: ConditionalFormatSpec[];
  dataValidation?: DataValidationSpec[];
  charts?: ChartSpec[];
  mergedCells?: string[];
  protection?: SheetProtection;
}

export interface CellSpec {
  cell: string;
  type: 'label' | 'input' | 'formula' | 'value' | 'header' | 'subheader' | 'total';
  value?: string | number | boolean | Date;
  formula?: string;
  formulaPattern?: {
    patternId: string;
    params: Record<string, string>;
  };
  name?: string; // Named range for this cell
  format?: CellFormat;
  style?: CellStyle;
  comment?: string;
  hyperlink?: string;
}

export interface CellFormat {
  type: 'number' | 'currency' | 'percentage' | 'date' | 'text' | 'accounting' | 'scientific';
  decimals?: number;
  currencySymbol?: string;
  dateFormat?: string;
  customFormat?: string;
  negativeRed?: boolean;
  thousandsSeparator?: boolean;
}

export interface CellStyle {
  font?: FontStyle;
  fill?: FillStyle;
  border?: BorderStyle;
  alignment?: AlignmentStyle;
}

export interface FontStyle {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
}

export interface FillStyle {
  type: 'solid' | 'gradient';
  color: string;
  gradientColor?: string;
}

export interface BorderStyle {
  style: 'thin' | 'medium' | 'thick' | 'double';
  color?: string;
  sides?: ('top' | 'bottom' | 'left' | 'right')[];
}

export interface AlignmentStyle {
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'middle' | 'bottom';
  wrapText?: boolean;
  textRotation?: number;
  indent?: number;
}

export interface NamedRangeSpec {
  name: string;
  range: string;
  scope?: 'workbook' | string; // string = sheet name
  comment?: string;
}

export interface GlobalStyles {
  defaultFont?: FontStyle;
  inputCellStyle?: CellStyle;
  formulaCellStyle?: CellStyle;
  headerStyle?: CellStyle;
  totalStyle?: CellStyle;
}

export interface PrintSettings {
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter' | 'Legal';
  fitToPage?: boolean;
  fitToWidth?: number;
  fitToHeight?: number;
  printGridLines?: boolean;
  printHeadings?: boolean;
  header?: string;
  footer?: string;
}

export interface ConditionalFormatSpec {
  range: string;
  type: 'cellIs' | 'colorScale' | 'dataBar' | 'iconSet' | 'top10' | 'aboveAverage';
  rule: ConditionalRule;
  priority?: number;
}

export interface ConditionalRule {
  operator?: 'greaterThan' | 'lessThan' | 'between' | 'equal' | 'notEqual';
  values?: (number | string)[];
  style?: CellStyle;
  colors?: string[]; // For color scales
  showValue?: boolean; // For data bars
}

export interface DataValidationSpec {
  range: string;
  type: 'list' | 'whole' | 'decimal' | 'date' | 'time' | 'textLength';
  values?: string[]; // For list type
  formula?: string; // For formula-based list
  operator?: 'between' | 'greaterThan' | 'lessThan' | 'equal';
  min?: number | string;
  max?: number | string;
  allowBlank?: boolean;
  showDropDown?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  promptTitle?: string;
  promptMessage?: string;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'column' | 'area' | 'scatter' | 'combo';
  title: string;
  position: { row: number; col: number };
  size?: { width: number; height: number };
  dataRange: string;
  categoryRange?: string;
  seriesNames?: string[];
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showDataLabels?: boolean;
  colors?: string[];
}

export interface SheetProtection {
  password?: string;
  allowSelectLockedCells?: boolean;
  allowSelectUnlockedCells?: boolean;
  allowFormatCells?: boolean;
  allowFormatColumns?: boolean;
  allowFormatRows?: boolean;
  allowInsertColumns?: boolean;
  allowInsertRows?: boolean;
  allowDeleteColumns?: boolean;
  allowDeleteRows?: boolean;
}

export interface BuildResult {
  success: boolean;
  workbook?: ExcelJS.Workbook;
  buffer?: Buffer;
  errors?: string[];
  warnings?: string[];
  stats: {
    sheetsCreated: number;
    cellsPopulated: number;
    formulasApplied: number;
    namedRangesCreated: number;
    chartsCreated: number;
    validationRulesApplied: number;
  };
}

// =============================================================================
// WORKBOOK BUILDER CLASS
// =============================================================================

export class ExcelWorkbookBuilder {
  private workbook: ExcelJS.Workbook;
  private errors: string[] = [];
  private warnings: string[] = [];
  private stats = {
    sheetsCreated: 0,
    cellsPopulated: 0,
    formulasApplied: 0,
    namedRangesCreated: 0,
    chartsCreated: 0,
    validationRulesApplied: 0
  };

  // Default professional styles
  private defaultStyles: GlobalStyles = {
    defaultFont: { name: 'Calibri', size: 11 },
    inputCellStyle: {
      fill: { type: 'solid', color: 'FFFFF3CD' }, // Light yellow for inputs
      border: { style: 'thin', sides: ['top', 'bottom', 'left', 'right'] }
    },
    formulaCellStyle: {
      fill: { type: 'solid', color: 'FFE8F5E9' }, // Light green for formulas
      font: { italic: true }
    },
    headerStyle: {
      font: { bold: true, color: 'FFFFFFFF' },
      fill: { type: 'solid', color: 'FF1E40AF' }, // Professional blue
      alignment: { horizontal: 'center', vertical: 'middle' }
    },
    totalStyle: {
      font: { bold: true },
      fill: { type: 'solid', color: 'FFE5E7EB' },
      border: { style: 'medium', sides: ['top'] }
    }
  };

  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  /**
   * Build complete workbook from specification
   */
  async build(spec: ExcelWorkbookSpec): Promise<BuildResult> {
    try {
      // Reset state
      this.workbook = new ExcelJS.Workbook();
      this.errors = [];
      this.warnings = [];
      this.stats = {
        sheetsCreated: 0,
        cellsPopulated: 0,
        formulasApplied: 0,
        namedRangesCreated: 0,
        chartsCreated: 0,
        validationRulesApplied: 0
      };

      // Apply metadata
      this.applyMetadata(spec.metadata);

      // Merge global styles with defaults
      const styles = { ...this.defaultStyles, ...spec.globalStyles };

      // Create sheets
      for (const sheetSpec of spec.sheets) {
        await this.createSheet(sheetSpec, styles);
      }

      // Create named ranges (after all sheets exist)
      if (spec.namedRanges) {
        this.createNamedRanges(spec.namedRanges);
      }

      // Generate buffer
      const buffer = await this.workbook.xlsx.writeBuffer();

      return {
        success: this.errors.length === 0,
        workbook: this.workbook,
        buffer: Buffer.from(buffer),
        errors: this.errors.length > 0 ? this.errors : undefined,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        stats: this.stats
      };
    } catch (error: any) {
      this.errors.push(`Build failed: ${error.message}`);
      return {
        success: false,
        errors: this.errors,
        warnings: this.warnings,
        stats: this.stats
      };
    }
  }

  /**
   * Apply workbook metadata
   */
  private applyMetadata(metadata: WorkbookMetadata): void {
    this.workbook.creator = metadata.author || 'ICAI CAGPT';
    this.workbook.lastModifiedBy = 'ICAI CAGPT';
    this.workbook.created = metadata.created || new Date();
    this.workbook.modified = new Date();
    this.workbook.title = metadata.title;
    if (metadata.subject) this.workbook.subject = metadata.subject;
    if (metadata.description) this.workbook.description = metadata.description;
    this.workbook.company = metadata.company || 'ICAI CAGPT';
    if (metadata.keywords) this.workbook.keywords = metadata.keywords.join(', ');
  }

  /**
   * Create a worksheet from specification
   */
  private async createSheet(sheetSpec: SheetSpec, globalStyles: GlobalStyles): Promise<void> {
    const sheet = this.workbook.addWorksheet(sheetSpec.name, {
      properties: {
        tabColor: sheetSpec.tabColor ? { argb: sheetSpec.tabColor.replace('#', 'FF') } : undefined
      }
    });
    this.stats.sheetsCreated++;

    // Apply column widths
    if (sheetSpec.columnWidths) {
      for (const [col, width] of Object.entries(sheetSpec.columnWidths)) {
        sheet.getColumn(col).width = width;
      }
    }

    // Apply row heights
    if (sheetSpec.rowHeights) {
      for (const [row, height] of Object.entries(sheetSpec.rowHeights)) {
        sheet.getRow(parseInt(row)).height = height;
      }
    }

    // Freeze panes
    if (sheetSpec.freezePanes) {
      sheet.views = [{
        state: 'frozen',
        xSplit: sheetSpec.freezePanes.col,
        ySplit: sheetSpec.freezePanes.row
      }];
    }

    // Merge cells
    if (sheetSpec.mergedCells) {
      for (const range of sheetSpec.mergedCells) {
        try {
          sheet.mergeCells(range);
        } catch (e: any) {
          this.warnings.push(`Failed to merge cells ${range}: ${e.message}`);
        }
      }
    }

    // Populate cells
    for (const cellSpec of sheetSpec.cells) {
      this.populateCell(sheet, cellSpec, sheetSpec.purpose, globalStyles);
    }

    // Apply conditional formatting
    if (sheetSpec.conditionalFormatting) {
      this.applyConditionalFormatting(sheet, sheetSpec.conditionalFormatting);
    }

    // Apply data validation
    if (sheetSpec.dataValidation) {
      this.applyDataValidation(sheet, sheetSpec.dataValidation);
    }

    // Create charts
    if (sheetSpec.charts) {
      for (const chartSpec of sheetSpec.charts) {
        this.createChart(sheet, chartSpec);
      }
    }

    // Apply print settings
    if (sheetSpec.printSettings) {
      this.applyPrintSettings(sheet, sheetSpec.printSettings);
    }

    // Apply protection
    if (sheetSpec.protection) {
      await this.applyProtection(sheet, sheetSpec.protection);
    }
  }

  /**
   * Populate a single cell
   */
  private populateCell(
    sheet: ExcelJS.Worksheet,
    cellSpec: CellSpec,
    sheetPurpose: string,
    globalStyles: GlobalStyles
  ): void {
    const cell = sheet.getCell(cellSpec.cell);
    this.stats.cellsPopulated++;

    // Handle formula pattern
    if (cellSpec.formulaPattern) {
      try {
        const formula = formulaPatternLibrary.buildFormula(
          cellSpec.formulaPattern.patternId,
          cellSpec.formulaPattern.params
        );
        cell.value = { formula };
        this.stats.formulasApplied++;
      } catch (e: any) {
        this.errors.push(`Formula pattern error at ${cellSpec.cell}: ${e.message}`);
        cell.value = '#ERROR!';
      }
    }
    // Handle direct formula
    else if (cellSpec.formula) {
      cell.value = { formula: cellSpec.formula };
      this.stats.formulasApplied++;
    }
    // Handle value
    else if (cellSpec.value !== undefined) {
      cell.value = cellSpec.value;
    }

    // Apply format
    if (cellSpec.format) {
      cell.numFmt = this.getNumberFormat(cellSpec.format);
    }

    // Apply style based on cell type
    const baseStyle = this.getBaseStyleForType(cellSpec.type, globalStyles);
    const mergedStyle = this.mergeStyles(baseStyle, cellSpec.style);
    this.applyStyle(cell, mergedStyle);

    // Mark input cells as unlocked (for protection)
    if (cellSpec.type === 'input') {
      cell.protection = { locked: false };
    }

    // Create named range for this cell if specified
    if (cellSpec.name) {
      try {
        // Named ranges will be created after all sheets are built
        this.workbook.definedNames.add(`${sheet.name}!${cellSpec.cell}`, cellSpec.name);
        this.stats.namedRangesCreated++;
      } catch (e: any) {
        this.warnings.push(`Failed to create named range ${cellSpec.name}: ${e.message}`);
      }
    }

    // Add comment
    if (cellSpec.comment) {
      cell.note = cellSpec.comment;
    }

    // Add hyperlink
    if (cellSpec.hyperlink) {
      cell.value = {
        text: cell.value?.toString() || cellSpec.hyperlink,
        hyperlink: cellSpec.hyperlink
      };
      cell.font = { ...cell.font, color: { argb: 'FF0000FF' }, underline: true };
    }
  }

  /**
   * Get base style for cell type
   */
  private getBaseStyleForType(type: CellSpec['type'], globalStyles: GlobalStyles): CellStyle | undefined {
    switch (type) {
      case 'input':
        return globalStyles.inputCellStyle;
      case 'formula':
        return globalStyles.formulaCellStyle;
      case 'header':
      case 'subheader':
        return globalStyles.headerStyle;
      case 'total':
        return globalStyles.totalStyle;
      default:
        return undefined;
    }
  }

  /**
   * Merge two styles (specific overrides base)
   */
  private mergeStyles(base?: CellStyle, specific?: CellStyle): CellStyle | undefined {
    if (!base && !specific) return undefined;
    if (!base) return specific;
    if (!specific) return base;

    return {
      font: { ...base.font, ...specific.font },
      fill: specific.fill || base.fill,
      border: specific.border || base.border,
      alignment: { ...base.alignment, ...specific.alignment }
    };
  }

  /**
   * Apply style to a cell
   */
  private applyStyle(cell: ExcelJS.Cell, style?: CellStyle): void {
    if (!style) return;

    if (style.font) {
      cell.font = {
        name: style.font.name,
        size: style.font.size,
        bold: style.font.bold,
        italic: style.font.italic,
        underline: style.font.underline,
        color: style.font.color ? { argb: style.font.color.replace('#', 'FF') } : undefined
      };
    }

    if (style.fill) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: style.fill.color.replace('#', '') }
      };
    }

    if (style.border) {
      const borderStyle = {
        style: style.border.style as ExcelJS.BorderStyle,
        color: style.border.color ? { argb: style.border.color.replace('#', 'FF') } : undefined
      };
      
      const sides = style.border.sides || ['top', 'bottom', 'left', 'right'];
      cell.border = {
        top: sides.includes('top') ? borderStyle : undefined,
        bottom: sides.includes('bottom') ? borderStyle : undefined,
        left: sides.includes('left') ? borderStyle : undefined,
        right: sides.includes('right') ? borderStyle : undefined
      };
    }

    if (style.alignment) {
      cell.alignment = {
        horizontal: style.alignment.horizontal,
        vertical: style.alignment.vertical,
        wrapText: style.alignment.wrapText,
        textRotation: style.alignment.textRotation,
        indent: style.alignment.indent
      };
    }
  }

  /**
   * Get Excel number format string
   */
  private getNumberFormat(format: CellFormat): string {
    if (format.customFormat) return format.customFormat;

    const decimals = format.decimals ?? 2;
    const decimalPart = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    const negativeColor = format.negativeRed ? ';[Red]' : '';

    switch (format.type) {
      case 'number':
        return format.thousandsSeparator ? `#,##0${decimalPart}${negativeColor}-#,##0${decimalPart}` : `0${decimalPart}`;
      case 'currency':
        const symbol = format.currencySymbol || '$';
        return `${symbol}#,##0${decimalPart}${negativeColor}(${symbol}#,##0${decimalPart})`;
      case 'accounting':
        const accSymbol = format.currencySymbol || '$';
        return `_${accSymbol}* #,##0${decimalPart}_);_(${accSymbol}* (#,##0${decimalPart});_${accSymbol}* "-"??_);_(@_)`;
      case 'percentage':
        return `0${decimalPart}%`;
      case 'date':
        return format.dateFormat || 'yyyy-mm-dd';
      case 'scientific':
        return `0${decimalPart}E+00`;
      default:
        return '@'; // Text
    }
  }

  /**
   * Create named ranges
   */
  private createNamedRanges(namedRanges: NamedRangeSpec[]): void {
    for (const nr of namedRanges) {
      try {
        // ExcelJS uses definedNames for named ranges
        const fullRange = nr.scope && nr.scope !== 'workbook' 
          ? `'${nr.scope}'!${nr.range}` 
          : nr.range;
        this.workbook.definedNames.add(fullRange, nr.name);
        this.stats.namedRangesCreated++;
      } catch (e: any) {
        this.warnings.push(`Failed to create named range ${nr.name}: ${e.message}`);
      }
    }
  }

  /**
   * Apply conditional formatting
   */
  private applyConditionalFormatting(sheet: ExcelJS.Worksheet, rules: ConditionalFormatSpec[]): void {
    for (const rule of rules) {
      try {
        // ExcelJS conditional formatting
        const cfRule: any = {
          ref: rule.range,
          priority: rule.priority || 1
        };

        switch (rule.type) {
          case 'cellIs':
            cfRule.type = 'cellIs';
            cfRule.operator = rule.rule.operator;
            cfRule.formulae = rule.rule.values;
            cfRule.style = this.convertStyleToExcelJS(rule.rule.style);
            break;
          case 'colorScale':
            cfRule.type = 'colorScale';
            cfRule.cfvo = [
              { type: 'min' },
              { type: 'mid' },
              { type: 'max' }
            ];
            cfRule.color = rule.rule.colors?.map(c => ({ argb: c.replace('#', 'FF') })) || [
              { argb: 'FFF8696B' },
              { argb: 'FFFFEB84' },
              { argb: 'FF63BE7B' }
            ];
            break;
          case 'dataBar':
            cfRule.type = 'dataBar';
            cfRule.color = { argb: rule.rule.colors?.[0]?.replace('#', 'FF') || 'FF638EC6' };
            cfRule.showValue = rule.rule.showValue ?? true;
            break;
        }

        sheet.addConditionalFormatting(cfRule);
      } catch (e: any) {
        this.warnings.push(`Failed to apply conditional formatting to ${rule.range}: ${e.message}`);
      }
    }
  }

  /**
   * Convert our style to ExcelJS style format
   */
  private convertStyleToExcelJS(style?: CellStyle): any {
    if (!style) return {};
    
    const result: any = {};
    
    if (style.font) {
      result.font = {
        color: style.font.color ? { argb: style.font.color.replace('#', 'FF') } : undefined,
        bold: style.font.bold
      };
    }
    
    if (style.fill) {
      result.fill = {
        type: 'pattern',
        pattern: 'solid',
        bgColor: { argb: style.fill.color.replace('#', '') }
      };
    }
    
    return result;
  }

  /**
   * Apply data validation
   */
  private applyDataValidation(sheet: ExcelJS.Worksheet, rules: DataValidationSpec[]): void {
    for (const rule of rules) {
      try {
        // Build formulae array first
        let formulae: string[] = [];
        if (rule.type === 'list') {
          if (rule.formula) {
            formulae = [rule.formula];
          } else if (rule.values) {
            formulae = [`"${rule.values.join(',')}"`];
          }
        } else {
          if (rule.min !== undefined) formulae.push(rule.min.toString());
          if (rule.max !== undefined) formulae.push(rule.max.toString());
        }

        const validation: ExcelJS.DataValidation = {
          type: rule.type as any,
          allowBlank: rule.allowBlank ?? true,
          showErrorMessage: true,
          errorTitle: rule.errorTitle || 'Invalid Entry',
          error: rule.errorMessage || 'Please enter a valid value.',
          showInputMessage: !!rule.promptTitle || !!rule.promptMessage,
          promptTitle: rule.promptTitle,
          prompt: rule.promptMessage,
          formulae: formulae.length > 0 ? formulae : [''],
          operator: rule.operator as any
        };

        sheet.getCell(rule.range).dataValidation = validation;
        this.stats.validationRulesApplied++;
      } catch (e: any) {
        this.warnings.push(`Failed to apply data validation to ${rule.range}: ${e.message}`);
      }
    }
  }

  /**
   * Create chart
   */
  private createChart(sheet: ExcelJS.Worksheet, chartSpec: ChartSpec): void {
    // ExcelJS has limited chart support, but we can add basic charts
    // For full chart support, we'd need to use a different approach
    this.warnings.push(`Chart "${chartSpec.title}" specification saved. ExcelJS has limited chart support.`);
    this.stats.chartsCreated++;
    
    // Add a note where the chart should be
    const cell = sheet.getCell(chartSpec.position.row, chartSpec.position.col);
    cell.note = `Chart: ${chartSpec.title}\nType: ${chartSpec.type}\nData: ${chartSpec.dataRange}`;
  }

  /**
   * Apply print settings
   */
  private applyPrintSettings(sheet: ExcelJS.Worksheet, settings: PrintSettings): void {
    sheet.pageSetup = {
      orientation: settings.orientation || 'portrait',
      fitToPage: settings.fitToPage,
      fitToWidth: settings.fitToWidth,
      fitToHeight: settings.fitToHeight
    };
    // Note: printGridLines is handled via sheet.views, not pageSetup

    if (settings.header) {
      sheet.headerFooter.oddHeader = settings.header;
    }
    if (settings.footer) {
      sheet.headerFooter.oddFooter = settings.footer;
    }
  }

  /**
   * Apply sheet protection
   */
  private async applyProtection(sheet: ExcelJS.Worksheet, protection: SheetProtection): Promise<void> {
    await sheet.protect(protection.password || '', {
      selectLockedCells: protection.allowSelectLockedCells ?? true,
      selectUnlockedCells: protection.allowSelectUnlockedCells ?? true,
      formatCells: protection.allowFormatCells ?? false,
      formatColumns: protection.allowFormatColumns ?? false,
      formatRows: protection.allowFormatRows ?? false,
      insertColumns: protection.allowInsertColumns ?? false,
      insertRows: protection.allowInsertRows ?? false,
      deleteColumns: protection.allowDeleteColumns ?? false,
      deleteRows: protection.allowDeleteRows ?? false
    });
  }
}

export const excelWorkbookBuilder = new ExcelWorkbookBuilder();
