/**
 * Excel Workbook Spec Validator
 * 
 * Comprehensive validation for AI-generated Excel specifications.
 * Catches malformed JSON, missing fields, invalid references, and logical errors
 * BEFORE attempting to build the workbook.
 */

import { 
  ExcelWorkbookSpec, 
  SheetSpec, 
  CellSpec, 
  NamedRangeSpec,
  DataValidationSpec,
  ConditionalFormatSpec 
} from './excelWorkbookBuilder';
import { formulaPatternLibrary } from './formulaPatternLibrary';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixes: AppliedFix[];
  stats: ValidationStats;
}

export interface ValidationError {
  code: string;
  message: string;
  path: string;
  severity: 'critical' | 'error';
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

export interface AppliedFix {
  code: string;
  description: string;
  path: string;
  before: any;
  after: any;
}

export interface ValidationStats {
  sheetsValidated: number;
  cellsValidated: number;
  formulasValidated: number;
  namedRangesValidated: number;
  errorsFound: number;
  warningsFound: number;
  fixesApplied: number;
}

export interface ValidatorOptions {
  autoFix?: boolean;           // Attempt to fix issues automatically
  strictMode?: boolean;        // Fail on warnings too
  maxErrors?: number;          // Stop after N errors
  validateFormulas?: boolean;  // Deep formula validation
  validateReferences?: boolean; // Check cell references exist
}

// =============================================================================
// VALIDATOR CLASS
// =============================================================================

export class ExcelSpecValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private fixes: AppliedFix[] = [];
  private options: ValidatorOptions;
  private cellRegistry: Map<string, CellSpec> = new Map(); // sheet!cell -> spec
  private namedRangeRegistry: Map<string, string> = new Map(); // name -> range
  private sheetNames: Set<string> = new Set();

  constructor(options: ValidatorOptions = {}) {
    this.options = {
      autoFix: true,
      strictMode: false,
      maxErrors: 50,
      validateFormulas: true,
      validateReferences: true,
      ...options
    };
  }

  /**
   * Main validation entry point
   */
  validate(spec: any): ValidationResult {
    this.reset();
    
    // Phase 1: Structure validation
    if (!this.validateStructure(spec)) {
      return this.buildResult(false);
    }

    // Phase 2: Build registries
    this.buildRegistries(spec as ExcelWorkbookSpec);

    // Phase 3: Deep validation
    this.validateSheets(spec as ExcelWorkbookSpec);
    this.validateNamedRanges(spec as ExcelWorkbookSpec);
    this.validateFormulas(spec as ExcelWorkbookSpec);
    this.validateReferences(spec as ExcelWorkbookSpec);
    this.validateDataValidation(spec as ExcelWorkbookSpec);
    this.validateConditionalFormatting(spec as ExcelWorkbookSpec);

    // Phase 4: Logical validation
    this.validateLogicalConsistency(spec as ExcelWorkbookSpec);

    const hasCriticalErrors = this.errors.some(e => e.severity === 'critical');
    const hasErrors = this.errors.length > 0;
    
    return this.buildResult(!hasCriticalErrors && (!this.options.strictMode || !hasErrors));
  }

  /**
   * Validate and auto-fix, returning corrected spec
   */
  validateAndFix(spec: any): { result: ValidationResult; spec: ExcelWorkbookSpec | null } {
    const oldAutoFix = this.options.autoFix;
    this.options.autoFix = true;
    
    const result = this.validate(spec);
    
    this.options.autoFix = oldAutoFix;
    
    return {
      result,
      spec: result.valid ? spec as ExcelWorkbookSpec : null
    };
  }

  // ===========================================================================
  // STRUCTURE VALIDATION
  // ===========================================================================

  private validateStructure(spec: any): boolean {
    // Check it's an object
    if (!spec || typeof spec !== 'object') {
      this.addError('INVALID_ROOT', 'Specification must be an object', '', 'critical');
      return false;
    }

    // Check required top-level fields
    if (!spec.metadata) {
      if (this.options.autoFix) {
        spec.metadata = { title: 'Generated Workbook', author: 'ICAI CAGPT' };
        this.addFix('MISSING_METADATA', 'Added default metadata', 'metadata', undefined, spec.metadata);
      } else {
        this.addError('MISSING_METADATA', 'Missing metadata object', 'metadata', 'error');
      }
    }

    if (!spec.sheets || !Array.isArray(spec.sheets)) {
      this.addError('MISSING_SHEETS', 'Sheets array is required', 'sheets', 'critical');
      return false;
    }

    if (spec.sheets.length === 0) {
      this.addError('EMPTY_SHEETS', 'At least one sheet is required', 'sheets', 'critical');
      return false;
    }

    // Validate metadata structure
    if (spec.metadata) {
      if (!spec.metadata.title) {
        if (this.options.autoFix) {
          spec.metadata.title = 'Generated Workbook';
          this.addFix('MISSING_TITLE', 'Added default title', 'metadata.title', undefined, spec.metadata.title);
        } else {
          this.addWarning('MISSING_TITLE', 'Workbook title is recommended', 'metadata.title');
        }
      }
    }

    // Validate global styles if present
    if (spec.globalStyles && typeof spec.globalStyles !== 'object') {
      this.addError('INVALID_STYLES', 'globalStyles must be an object', 'globalStyles', 'error');
    }

    return true;
  }

  // ===========================================================================
  // REGISTRY BUILDING
  // ===========================================================================

  private buildRegistries(spec: ExcelWorkbookSpec): void {
    // Build sheet name registry
    for (const sheet of spec.sheets) {
      if (sheet.name) {
        this.sheetNames.add(sheet.name);
      }

      // Build cell registry
      if (sheet.cells) {
        for (const cell of sheet.cells) {
          const key = `${sheet.name}!${cell.cell}`;
          this.cellRegistry.set(key, cell);
          // Also store without sheet name for same-sheet refs
          this.cellRegistry.set(cell.cell, cell);
        }
      }
    }

    // Build named range registry
    if (spec.namedRanges) {
      for (const nr of spec.namedRanges) {
        this.namedRangeRegistry.set(nr.name, nr.range);
      }
    }
  }

  // ===========================================================================
  // SHEET VALIDATION
  // ===========================================================================

  private validateSheets(spec: ExcelWorkbookSpec): void {
    const sheetNames = new Set<string>();

    for (let i = 0; i < spec.sheets.length; i++) {
      const sheet = spec.sheets[i];
      const path = `sheets[${i}]`;

      // Validate sheet name
      if (!sheet.name) {
        if (this.options.autoFix) {
          sheet.name = `Sheet${i + 1}`;
          this.addFix('MISSING_SHEET_NAME', `Generated sheet name`, `${path}.name`, undefined, sheet.name);
        } else {
          this.addError('MISSING_SHEET_NAME', 'Sheet name is required', `${path}.name`, 'error');
        }
      } else {
        // Check for duplicate names
        if (sheetNames.has(sheet.name)) {
          if (this.options.autoFix) {
            const newName = `${sheet.name}_${i + 1}`;
            this.addFix('DUPLICATE_SHEET', `Renamed duplicate sheet`, `${path}.name`, sheet.name, newName);
            sheet.name = newName;
          } else {
            this.addError('DUPLICATE_SHEET', `Duplicate sheet name: ${sheet.name}`, `${path}.name`, 'error');
          }
        }
        sheetNames.add(sheet.name);

        // Validate sheet name format
        if (sheet.name.length > 31) {
          if (this.options.autoFix) {
            const newName = sheet.name.substring(0, 31);
            this.addFix('SHEET_NAME_TOO_LONG', 'Truncated sheet name to 31 chars', `${path}.name`, sheet.name, newName);
            sheet.name = newName;
          } else {
            this.addError('SHEET_NAME_TOO_LONG', `Sheet name exceeds 31 characters`, `${path}.name`, 'error');
          }
        }

        if (/[\\\/\*\?\[\]:']/.test(sheet.name)) {
          this.addError('INVALID_SHEET_NAME', `Sheet name contains invalid characters`, `${path}.name`, 'error');
        }
      }

      // Validate cells
      if (sheet.cells) {
        this.validateCells(sheet.cells, path, sheet.name);
      } else {
        this.addWarning('EMPTY_SHEET', `Sheet "${sheet.name}" has no cells`, path);
      }
    }
  }

  // ===========================================================================
  // CELL VALIDATION
  // ===========================================================================

  private validateCells(cells: CellSpec[], path: string, sheetName: string): void {
    const cellRefs = new Set<string>();

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const cellPath = `${path}.cells[${i}]`;

      // Validate cell reference
      if (!cell.cell) {
        this.addError('MISSING_CELL_REF', 'Cell reference is required', `${cellPath}.ref`, 'error');
        continue;
      }

      if (!this.isValidCellRef(cell.cell)) {
        this.addError('INVALID_CELL_REF', `Invalid cell reference: ${cell.cell}`, `${cellPath}.ref`, 'error');
        continue;
      }

      // Check for duplicate refs
      if (cellRefs.has(cell.cell)) {
        this.addWarning('DUPLICATE_CELL', `Duplicate cell reference: ${cell.cell}`, cellPath);
      }
      cellRefs.add(cell.cell);

      // Validate cell type
      const validTypes = ['input', 'formula', 'header', 'total', 'label', 'output', 'calculated'];
      if (cell.type && !validTypes.includes(cell.type)) {
        this.addWarning('UNKNOWN_CELL_TYPE', `Unknown cell type: ${cell.type}`, `${cellPath}.type`);
      }

      // Validate cell has value OR formula
      if (cell.value === undefined && !cell.formula && !cell.formulaPattern) {
        this.addWarning('EMPTY_CELL', `Cell ${cell.cell} has no value or formula`, cellPath);
      }

      // Formula cells must have formulas (note: 'formula' is a valid type per CellSpec)
      if (cell.type === 'formula' || cell.type === 'total') {
        if (!cell.formula && !cell.formulaPattern) {
          this.addError('FORMULA_CELL_NO_FORMULA', 
            `Cell ${cell.cell} is type "${cell.type}" but has no formula`, cellPath, 'error');
        }
      }

      // Validate formula patterns
      if (cell.formulaPattern) {
        this.validateFormulaPattern(cell, cellPath);
      }

      // Validate formula syntax
      if (cell.formula) {
        this.validateFormulaSyntax(cell.formula, cellPath, sheetName);
      }
    }
  }

  // ===========================================================================
  // FORMULA VALIDATION
  // ===========================================================================

  private validateFormulaPattern(cell: CellSpec, path: string): void {
    if (!cell.formulaPattern) return;

    const pattern = formulaPatternLibrary.getPattern(cell.formulaPattern.patternId);
    
    if (!pattern) {
      this.addWarning('UNKNOWN_PATTERN', 
        `Unknown formula pattern: ${cell.formulaPattern.patternId}`, `${path}.formulaPattern`);
      return;
    }

    // Check required parameters
    for (const param of pattern.parameters) {
      if (param.required && !cell.formulaPattern.params?.[param.name]) {
        this.addError('MISSING_PATTERN_PARAM',
          `Missing required parameter "${param.name}" for pattern ${cell.formulaPattern.patternId}`,
          `${path}.formulaPattern.parameters`, 'error');
      }
    }
  }

  private validateFormulaSyntax(formula: string, path: string, sheetName: string): void {
    if (!formula.startsWith('=')) {
      this.addWarning('FORMULA_NO_EQUALS', 
        `Formula should start with '=': ${formula}`, path, 
        `Add '=' prefix`);
    }

    // Check for common formula errors
    const formulaBody = formula.startsWith('=') ? formula.substring(1) : formula;

    // Unbalanced parentheses
    let parenCount = 0;
    for (const char of formulaBody) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        this.addError('UNBALANCED_PARENS', 
          `Unbalanced parentheses in formula: ${formula}`, path, 'error');
        break;
      }
    }
    if (parenCount !== 0) {
      this.addError('UNBALANCED_PARENS', 
        `Unbalanced parentheses in formula: ${formula}`, path, 'error');
    }

    // Empty function calls
    if (/\(\s*\)/.test(formulaBody) && !/\(\s*\)/.test('RAND()TODAY()NOW()PI()')) {
      this.addWarning('EMPTY_FUNCTION', 
        `Formula may have empty function call: ${formula}`, path);
    }

    // Check for #REF! style errors in the formula itself
    if (/#REF!|#NAME\?|#VALUE!|#DIV\/0!|#NULL!|#N\/A/.test(formula)) {
      this.addError('ERROR_IN_FORMULA', 
        `Formula contains error value: ${formula}`, path, 'error');
    }

    // Check for obviously wrong constructs
    if (/,,|,\)|,\s*,/.test(formula)) {
      this.addWarning('SUSPICIOUS_COMMAS', 
        `Formula has suspicious comma pattern: ${formula}`, path);
    }
  }

  private validateFormulas(spec: ExcelWorkbookSpec): void {
    if (!this.options.validateFormulas) return;

    for (const sheet of spec.sheets) {
      if (!sheet.cells) continue;

      for (const cell of sheet.cells) {
        if (cell.formula) {
          // Extract cell references from formula
          const refs = this.extractCellReferences(cell.formula);
          
          // Check for circular references (simple check)
          if (refs.includes(cell.cell)) {
            this.addError('CIRCULAR_REF', 
              `Circular reference in cell ${cell.cell}: ${cell.formula}`,
              `sheets.${sheet.name}.${cell.cell}`, 'error');
          }
        }
      }
    }
  }

  // ===========================================================================
  // REFERENCE VALIDATION
  // ===========================================================================

  private validateReferences(spec: ExcelWorkbookSpec): void {
    if (!this.options.validateReferences) return;

    for (const sheet of spec.sheets) {
      if (!sheet.cells) continue;

      for (const cell of sheet.cells) {
        if (!cell.formula) continue;

        const refs = this.extractCellReferences(cell.formula);
        const namedRefs = this.extractNamedReferences(cell.formula);

        // Check cell references
        for (const ref of refs) {
          if (ref.includes('!')) {
            // Cross-sheet reference
            const [sheetRef, cellRef] = ref.split('!');
            const cleanSheet = sheetRef.replace(/'/g, '');
            if (!this.sheetNames.has(cleanSheet)) {
              this.addWarning('UNKNOWN_SHEET_REF',
                `Formula references unknown sheet "${cleanSheet}" in cell ${cell.cell}`,
                `sheets.${sheet.name}.${cell.cell}`);
            }
          }
          // We don't validate every cell exists - Excel handles dynamic ranges
        }

        // Check named range references
        for (const name of namedRefs) {
          if (!this.namedRangeRegistry.has(name)) {
            // Could be an Excel function, not a named range
            if (!this.isExcelFunction(name)) {
              this.addWarning('UNKNOWN_NAMED_REF',
                `Formula may reference undefined name "${name}" in cell ${cell.cell}`,
                `sheets.${sheet.name}.${cell.cell}`);
            }
          }
        }
      }
    }
  }

  private validateNamedRanges(spec: ExcelWorkbookSpec): void {
    if (!spec.namedRanges) return;

    const names = new Set<string>();

    for (let i = 0; i < spec.namedRanges.length; i++) {
      const nr = spec.namedRanges[i];
      const path = `namedRanges[${i}]`;

      if (!nr.name) {
        this.addError('MISSING_NR_NAME', 'Named range requires a name', path, 'error');
        continue;
      }

      if (!nr.range) {
        this.addError('MISSING_NR_RANGE', `Named range "${nr.name}" requires a range`, path, 'error');
        continue;
      }

      // Check for duplicates
      if (names.has(nr.name.toUpperCase())) {
        this.addError('DUPLICATE_NR', `Duplicate named range: ${nr.name}`, path, 'error');
      }
      names.add(nr.name.toUpperCase());

      // Validate name format
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nr.name)) {
        this.addError('INVALID_NR_NAME', 
          `Invalid named range name "${nr.name}" - must start with letter/underscore`, path, 'error');
      }

      // Check for reserved names
      if (this.isExcelFunction(nr.name)) {
        this.addWarning('NR_IS_FUNCTION', 
          `Named range "${nr.name}" conflicts with Excel function`, path);
      }
    }
  }

  // ===========================================================================
  // DATA VALIDATION
  // ===========================================================================

  private validateDataValidation(spec: ExcelWorkbookSpec): void {
    for (const sheet of spec.sheets) {
      if (!sheet.dataValidation) continue;

      for (let i = 0; i < sheet.dataValidation.length; i++) {
        const dv = sheet.dataValidation[i];
        const path = `sheets.${sheet.name}.dataValidation[${i}]`;

        if (!dv.range) {
          this.addError('DV_NO_RANGE', 'Data validation requires a range', path, 'error');
          continue;
        }

        if (!dv.type) {
          this.addError('DV_NO_TYPE', 'Data validation requires a type', path, 'error');
          continue;
        }

        const validTypes = ['whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom'];
        if (!validTypes.includes(dv.type)) {
          this.addWarning('DV_UNKNOWN_TYPE', `Unknown data validation type: ${dv.type}`, path);
        }

        if (dv.type === 'list' && !dv.values && !dv.formula) {
          this.addError('DV_LIST_NO_VALUES', 
            'List data validation requires values or formula', path, 'error');
        }
      }
    }
  }

  // ===========================================================================
  // CONDITIONAL FORMATTING
  // ===========================================================================

  private validateConditionalFormatting(spec: ExcelWorkbookSpec): void {
    for (const sheet of spec.sheets) {
      if (!sheet.conditionalFormatting) continue;

      for (let i = 0; i < sheet.conditionalFormatting.length; i++) {
        const cf = sheet.conditionalFormatting[i];
        const path = `sheets.${sheet.name}.conditionalFormatting[${i}]`;

        if (!cf.range) {
          this.addError('CF_NO_RANGE', 'Conditional formatting requires a range', path, 'error');
        }

        if (!cf.type) {
          this.addError('CF_NO_TYPE', 'Conditional formatting requires a type', path, 'error');
        }
      }
    }
  }

  // ===========================================================================
  // LOGICAL CONSISTENCY
  // ===========================================================================

  private validateLogicalConsistency(spec: ExcelWorkbookSpec): void {
    // Check that input cells are not formulas
    for (const sheet of spec.sheets) {
      if (!sheet.cells) continue;

      let hasInputs = false;
      let hasFormulas = false;
      let hasHeaders = false;

      for (const cell of sheet.cells) {
        if (cell.type === 'input') hasInputs = true;
        if (cell.type === 'formula' || cell.formula) hasFormulas = true;
        if (cell.type === 'header') hasHeaders = true;

        // Input cells shouldn't have formulas
        if (cell.type === 'input' && cell.formula) {
          this.addWarning('INPUT_HAS_FORMULA',
            `Input cell ${cell.cell} has a formula - should be editable value`,
            `sheets.${sheet.name}.${cell.cell}`);
        }
      }

      // Warn if model has no inputs (static model)
      if (hasFormulas && !hasInputs) {
        this.addWarning('NO_INPUT_CELLS',
          `Sheet "${sheet.name}" has formulas but no input cells - model may not be interactive`,
          `sheets.${sheet.name}`);
      }

      // Warn if no headers
      if ((hasInputs || hasFormulas) && !hasHeaders) {
        this.addWarning('NO_HEADERS',
          `Sheet "${sheet.name}" has no header cells - may be confusing for users`,
          `sheets.${sheet.name}`);
      }
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private isValidCellRef(ref: string): boolean {
    // Match A1, AB123, $A$1, A$1, $A1, and ranges like A1:B10
    return /^(\$?[A-Z]+\$?\d+)(:\$?[A-Z]+\$?\d+)?$/i.test(ref);
  }

  private extractCellReferences(formula: string): string[] {
    // Extract cell references like A1, $A$1, Sheet1!A1, 'Sheet Name'!A1
    const refs: string[] = [];
    const pattern = /('?[A-Za-z0-9_\s]+'?!)?\$?[A-Z]+\$?\d+(:\$?[A-Z]+\$?\d+)?/gi;
    let match;
    while ((match = pattern.exec(formula)) !== null) {
      refs.push(match[0]);
    }
    return refs;
  }

  private extractNamedReferences(formula: string): string[] {
    // Extract potential named ranges (words that aren't functions or cell refs)
    const names: string[] = [];
    const pattern = /[A-Za-z_][A-Za-z0-9_]*/g;
    let match;
    while ((match = pattern.exec(formula)) !== null) {
      const word = match[0];
      // Skip if it looks like a cell reference
      if (/^[A-Z]+\d+$/i.test(word)) continue;
      // Skip if it's a common function
      if (this.isExcelFunction(word)) continue;
      names.push(word);
    }
    return names;
  }

  private isExcelFunction(name: string): boolean {
    const functions = new Set([
      'ABS', 'ACOS', 'ACOSH', 'ADDRESS', 'AND', 'AREAS', 'ASIN', 'ASINH', 'ATAN', 'ATAN2',
      'ATANH', 'AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS',
      'CEILING', 'CHAR', 'CHOOSE', 'CLEAN', 'CODE', 'COLUMN', 'COLUMNS', 'CONCAT',
      'CONCATENATE', 'COS', 'COSH', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS',
      'DATE', 'DATEVALUE', 'DAY', 'DAYS', 'DCOUNT', 'DGET', 'DSUM',
      'EDATE', 'EOMONTH', 'ERROR', 'EXACT', 'EXP',
      'FALSE', 'FILTER', 'FIND', 'FLOOR', 'FV',
      'HLOOKUP', 'HOUR', 'HYPERLINK',
      'IF', 'IFERROR', 'IFNA', 'IFS', 'INDEX', 'INDIRECT', 'INT', 'IPMT', 'IRR', 'ISBLANK',
      'ISERROR', 'ISLOGICAL', 'ISNA', 'ISNONTEXT', 'ISNUMBER', 'ISTEXT',
      'LARGE', 'LEFT', 'LEN', 'LN', 'LOG', 'LOG10', 'LOOKUP', 'LOWER',
      'MATCH', 'MAX', 'MAXA', 'MAXIFS', 'MEDIAN', 'MID', 'MIN', 'MINA', 'MINIFS', 'MINUTE',
      'MIRR', 'MOD', 'MONTH',
      'N', 'NA', 'NETWORKDAYS', 'NOT', 'NOW', 'NPER', 'NPV',
      'OFFSET', 'OR',
      'PI', 'PMT', 'POWER', 'PPMT', 'PRODUCT', 'PROPER', 'PV',
      'RAND', 'RANDBETWEEN', 'RANK', 'RATE', 'REPLACE', 'REPT', 'RIGHT', 'ROUND',
      'ROUNDDOWN', 'ROUNDUP', 'ROW', 'ROWS',
      'SEARCH', 'SECOND', 'SIGN', 'SIN', 'SINH', 'SLN', 'SMALL', 'SORT', 'SORTBY', 'SQRT',
      'STDEV', 'SUBSTITUTE', 'SUBTOTAL', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SWITCH', 'SYD',
      'TAN', 'TANH', 'TEXT', 'TIME', 'TIMEVALUE', 'TODAY', 'TRANSPOSE', 'TRIM', 'TRUE', 'TRUNC', 'TYPE',
      'UNIQUE', 'UPPER',
      'VALUE', 'VAR', 'VDB', 'VLOOKUP',
      'WEEKDAY', 'WEEKNUM', 'WORKDAY',
      'XIRR', 'XLOOKUP', 'XNPV',
      'YEAR', 'YEARFRAC'
    ]);
    return functions.has(name.toUpperCase());
  }

  // ===========================================================================
  // ERROR/WARNING MANAGEMENT
  // ===========================================================================

  private addError(code: string, message: string, path: string, severity: 'critical' | 'error', suggestion?: string): void {
    if (this.errors.length >= (this.options.maxErrors || 50)) return;
    
    this.errors.push({ code, message, path, severity, suggestion });
  }

  private addWarning(code: string, message: string, path: string, suggestion?: string): void {
    this.warnings.push({ code, message, path, suggestion });
  }

  private addFix(code: string, description: string, path: string, before: any, after: any): void {
    this.fixes.push({ code, description, path, before, after });
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
    this.cellRegistry.clear();
    this.namedRangeRegistry.clear();
    this.sheetNames.clear();
  }

  private buildResult(valid: boolean): ValidationResult {
    return {
      valid,
      errors: this.errors,
      warnings: this.warnings,
      fixes: this.fixes,
      stats: {
        sheetsValidated: this.sheetNames.size,
        cellsValidated: this.cellRegistry.size,
        formulasValidated: Array.from(this.cellRegistry.values()).filter(c => c.formula).length,
        namedRangesValidated: this.namedRangeRegistry.size,
        errorsFound: this.errors.length,
        warningsFound: this.warnings.length,
        fixesApplied: this.fixes.length
      }
    };
  }
}

// =============================================================================
// JSON PARSER WITH ERROR RECOVERY
// =============================================================================

export class SafeJSONParser {
  /**
   * Parse JSON with detailed error reporting and attempted recovery
   */
  static parse(jsonString: string): { success: boolean; data?: any; error?: string; recovered?: boolean } {
    // First, try direct parse
    try {
      const data = JSON.parse(jsonString);
      return { success: true, data };
    } catch (e: any) {
      // Attempt recovery
      const recovered = this.attemptRecovery(jsonString);
      if (recovered.success) {
        return { success: true, data: recovered.data, recovered: true };
      }
      
      return { 
        success: false, 
        error: `JSON parse failed: ${e.message}. ${recovered.suggestion || ''}`
      };
    }
  }

  private static attemptRecovery(jsonString: string): { success: boolean; data?: any; suggestion?: string } {
    let cleaned = jsonString;

    // Remove markdown code fences
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

    // Try to extract JSON from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Fix common issues
    // Trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Single quotes to double quotes (careful with apostrophes)
    // cleaned = cleaned.replace(/'([^']+)':/g, '"$1":');

    // Unquoted keys
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    try {
      const data = JSON.parse(cleaned);
      return { success: true, data };
    } catch (e) {
      // Check for specific issues
      const issues: string[] = [];
      
      if (/,\s*[}\]]/.test(jsonString)) {
        issues.push('trailing commas detected');
      }
      if (/[^"]\b[a-zA-Z]+\s*:/.test(jsonString)) {
        issues.push('unquoted property keys');
      }
      if (/[\x00-\x1F]/.test(jsonString)) {
        issues.push('control characters in string');
      }

      return { 
        success: false, 
        suggestion: issues.length > 0 ? `Possible issues: ${issues.join(', ')}` : undefined
      };
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const excelSpecValidator = new ExcelSpecValidator();
