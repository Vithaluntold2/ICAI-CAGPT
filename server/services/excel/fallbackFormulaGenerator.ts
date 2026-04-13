/**
 * Fallback Formula Generator
 * 
 * When the pattern library doesn't cover a user's needs, this module provides
 * a safe way to construct Excel formulas with validation guards.
 * 
 * Key principles:
 * 1. Never let AI output raw formulas - always validate/sanitize
 * 2. Use a whitelist of allowed functions
 * 3. Validate cell references before including
 * 4. Wrap risky operations in IFERROR
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FormulaComponent {
  type: 'function' | 'operator' | 'reference' | 'number' | 'text' | 'named' | 'parenthesis';
  value: string;
  validated?: boolean;
}

export interface FormulaConstructionResult {
  success: boolean;
  formula?: string;
  error?: string;
  warnings?: string[];
  safetyWrapped?: boolean;
}

export interface CustomFormulaRequest {
  description: string;
  components: FormulaComponent[];
  errorHandling?: 'iferror-zero' | 'iferror-blank' | 'iferror-na' | 'none';
  absoluteRefs?: string[]; // Which refs should be absolute ($A$1)
}

// =============================================================================
// ALLOWED FUNCTIONS (WHITELIST)
// =============================================================================

const ALLOWED_FUNCTIONS: Set<string> = new Set([
  // Math & Trig
  'ABS', 'CEILING', 'FLOOR', 'INT', 'LN', 'LOG', 'LOG10', 'MOD', 'POWER', 'ROUND', 
  'ROUNDDOWN', 'ROUNDUP', 'SIGN', 'SQRT', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT',
  'PRODUCT', 'TRUNC', 'EXP', 'PI', 'RAND', 'RANDBETWEEN',
  
  // Statistical
  'AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK',
  'COUNTIF', 'COUNTIFS', 'MAX', 'MAXA', 'MAXIFS', 'MIN', 'MINA', 'MINIFS', 'MEDIAN',
  'MODE', 'STDEV', 'STDEVP', 'VAR', 'VARP', 'LARGE', 'SMALL', 'PERCENTILE', 'QUARTILE',
  'RANK', 'CORREL', 'COVARIANCE', 'FORECAST', 'TREND', 'LINEST', 'GROWTH',
  
  // Financial
  'NPV', 'XNPV', 'IRR', 'XIRR', 'MIRR', 'PMT', 'PPMT', 'IPMT', 'PV', 'FV', 'NPER',
  'RATE', 'DB', 'DDB', 'SLN', 'SYD', 'VDB', 'PRICE', 'YIELD', 'DISC', 'INTRATE',
  'TBILLEQ', 'TBILLPRICE', 'TBILLYIELD', 'EFFECT', 'NOMINAL', 'CUMIPMT', 'CUMPRINC',
  
  // Lookup & Reference
  'VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'LOOKUP', 'INDEX', 'MATCH', 'OFFSET', 'INDIRECT',
  'ADDRESS', 'ROW', 'ROWS', 'COLUMN', 'COLUMNS', 'CHOOSE', 'TRANSPOSE', 'HYPERLINK',
  
  // Logical
  'IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR', 'SWITCH', 'TRUE', 'FALSE', 'IFERROR',
  'IFNA', 'ISERROR', 'ISNA', 'ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL', 'ISNONTEXT',
  
  // Text
  'CONCATENATE', 'CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'FIND', 'SEARCH',
  'SUBSTITUTE', 'REPLACE', 'TRIM', 'CLEAN', 'UPPER', 'LOWER', 'PROPER', 'TEXT', 'VALUE',
  'CHAR', 'CODE', 'EXACT', 'REPT', 'T', 'DOLLAR', 'FIXED',
  
  // Date & Time
  'DATE', 'DATEVALUE', 'DAY', 'DAYS', 'EDATE', 'EOMONTH', 'HOUR', 'MINUTE', 'MONTH',
  'NETWORKDAYS', 'NOW', 'SECOND', 'TIME', 'TIMEVALUE', 'TODAY', 'WEEKDAY', 'WEEKNUM',
  'WORKDAY', 'YEAR', 'YEARFRAC', 'DATEDIF',
  
  // Array (365+)
  'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'SEQUENCE', 'RANDARRAY', 'LAMBDA', 'LET',
  'MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY',
  
  // Information
  'ERROR.TYPE', 'INFO', 'N', 'NA', 'TYPE', 'CELL', 'SHEET', 'SHEETS'
]);

const ALLOWED_OPERATORS: Set<string> = new Set([
  '+', '-', '*', '/', '^', '&', '=', '<>', '<', '>', '<=', '>=', '%'
]);

// =============================================================================
// FORMULA BUILDER CLASS
// =============================================================================

export class FormulaBuilder {
  private components: FormulaComponent[] = [];
  private warnings: string[] = [];
  private errorHandling: 'iferror-zero' | 'iferror-blank' | 'iferror-na' | 'none' = 'iferror-zero';

  constructor(errorHandling?: 'iferror-zero' | 'iferror-blank' | 'iferror-na' | 'none') {
    if (errorHandling) {
      this.errorHandling = errorHandling;
    }
  }

  /**
   * Add a function call
   */
  fn(name: string, ...args: (string | FormulaBuilder)[]): FormulaBuilder {
    const upperName = name.toUpperCase();
    
    if (!ALLOWED_FUNCTIONS.has(upperName)) {
      this.warnings.push(`Function "${name}" is not in the allowed list - skipped`);
      return this;
    }

    const argStrings = args.map(arg => {
      if (arg instanceof FormulaBuilder) {
        const built = arg.buildInternal();
        return built.success ? built.formula! : '0';
      }
      return arg;
    });

    this.components.push({
      type: 'function',
      value: `${upperName}(${argStrings.join(',')})`,
      validated: true
    });

    return this;
  }

  /**
   * Add a cell reference
   */
  ref(cellRef: string, absolute: boolean = false): FormulaBuilder {
    const validated = this.validateCellRef(cellRef);
    
    if (!validated) {
      this.warnings.push(`Invalid cell reference: ${cellRef}`);
      return this;
    }

    const finalRef = absolute ? this.makeAbsolute(cellRef) : cellRef;
    this.components.push({
      type: 'reference',
      value: finalRef,
      validated: true
    });

    return this;
  }

  /**
   * Add a range reference
   */
  range(rangeRef: string, absolute: boolean = false): FormulaBuilder {
    const validated = this.validateRangeRef(rangeRef);
    
    if (!validated) {
      this.warnings.push(`Invalid range reference: ${rangeRef}`);
      return this;
    }

    const finalRef = absolute ? this.makeAbsolute(rangeRef) : rangeRef;
    this.components.push({
      type: 'reference',
      value: finalRef,
      validated: true
    });

    return this;
  }

  /**
   * Add a named range reference
   */
  named(name: string): FormulaBuilder {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      this.warnings.push(`Invalid named range: ${name}`);
      return this;
    }

    this.components.push({
      type: 'named',
      value: name,
      validated: true
    });

    return this;
  }

  /**
   * Add a number
   */
  num(value: number): FormulaBuilder {
    this.components.push({
      type: 'number',
      value: value.toString(),
      validated: true
    });

    return this;
  }

  /**
   * Add a text string
   */
  text(value: string): FormulaBuilder {
    // Escape quotes
    const escaped = value.replace(/"/g, '""');
    this.components.push({
      type: 'text',
      value: `"${escaped}"`,
      validated: true
    });

    return this;
  }

  /**
   * Add an operator
   */
  op(operator: string): FormulaBuilder {
    if (!ALLOWED_OPERATORS.has(operator)) {
      this.warnings.push(`Invalid operator: ${operator}`);
      return this;
    }

    this.components.push({
      type: 'operator',
      value: operator,
      validated: true
    });

    return this;
  }

  /**
   * Add opening parenthesis
   */
  open(): FormulaBuilder {
    this.components.push({
      type: 'parenthesis',
      value: '(',
      validated: true
    });
    return this;
  }

  /**
   * Add closing parenthesis
   */
  close(): FormulaBuilder {
    this.components.push({
      type: 'parenthesis',
      value: ')',
      validated: true
    });
    return this;
  }

  /**
   * Build the final formula
   */
  build(): FormulaConstructionResult {
    const internal = this.buildInternal();
    
    if (!internal.success) {
      // Include warnings even on failure
      return {
        ...internal,
        warnings: this.warnings.length > 0 ? this.warnings : undefined
      };
    }

    // Apply error handling wrapper
    let formula = internal.formula!;
    let safetyWrapped = false;

    if (this.errorHandling !== 'none' && this.needsErrorHandling(formula)) {
      formula = this.wrapWithErrorHandling(formula);
      safetyWrapped = true;
    }

    // Ensure starts with =
    if (!formula.startsWith('=')) {
      formula = '=' + formula;
    }

    return {
      success: true,
      formula,
      warnings: this.warnings.length > 0 ? this.warnings : undefined,
      safetyWrapped
    };
  }

  /**
   * Internal build without error handling
   */
  private buildInternal(): FormulaConstructionResult {
    if (this.components.length === 0) {
      return { success: false, error: 'No formula components provided' };
    }

    // Check all components are validated
    const invalidComponents = this.components.filter(c => !c.validated);
    if (invalidComponents.length > 0) {
      return { 
        success: false, 
        error: `Invalid components: ${invalidComponents.map(c => c.value).join(', ')}` 
      };
    }

    // Validate parenthesis balance
    let parenCount = 0;
    for (const comp of this.components) {
      if (comp.value === '(') parenCount++;
      if (comp.value === ')') parenCount--;
      if (parenCount < 0) {
        return { success: false, error: 'Unbalanced parentheses' };
      }
    }
    if (parenCount !== 0) {
      return { success: false, error: 'Unbalanced parentheses' };
    }

    const formula = this.components.map(c => c.value).join('');
    return { success: true, formula };
  }

  // ===========================================================================
  // VALIDATION HELPERS
  // ===========================================================================

  private validateCellRef(ref: string): boolean {
    // Matches: A1, $A$1, Sheet1!A1, 'Sheet Name'!$A$1
    return /^('?[\w\s]+'?!)?\$?[A-Z]+\$?\d+$/i.test(ref);
  }

  private validateRangeRef(ref: string): boolean {
    // Matches: A1:B10, $A$1:$B$10, Sheet1!A:A, 'Sheet Name'!A1:Z100
    return /^('?[\w\s]+'?!)?\$?[A-Z]+\$?\d*:\$?[A-Z]+\$?\d*$/i.test(ref);
  }

  private makeAbsolute(ref: string): string {
    // Convert A1 to $A$1, A1:B10 to $A$1:$B$10
    return ref.replace(/([A-Z]+)(\d+)/gi, (match, col, row) => {
      const absCol = col.startsWith('$') ? col : '$' + col;
      const absRow = row.startsWith('$') ? row : '$' + row;
      return absCol + absRow;
    });
  }

  private needsErrorHandling(formula: string): boolean {
    // Division could cause #DIV/0!
    if (formula.includes('/')) return true;
    
    // Lookup functions could cause #N/A
    const lookupFunctions = ['VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'MATCH', 'INDEX'];
    if (lookupFunctions.some(fn => formula.toUpperCase().includes(fn))) return true;

    // Complex financial functions
    const financialFunctions = ['IRR', 'XIRR', 'RATE'];
    if (financialFunctions.some(fn => formula.toUpperCase().includes(fn))) return true;

    return false;
  }

  private wrapWithErrorHandling(formula: string): string {
    const inner = formula.startsWith('=') ? formula.substring(1) : formula;
    
    switch (this.errorHandling) {
      case 'iferror-zero':
        return `IFERROR(${inner},0)`;
      case 'iferror-blank':
        return `IFERROR(${inner},"")`;
      case 'iferror-na':
        return `IFERROR(${inner},NA())`;
      default:
        return inner;
    }
  }

  /**
   * Reset the builder
   */
  reset(): FormulaBuilder {
    this.components = [];
    this.warnings = [];
    return this;
  }
}

// =============================================================================
// AI FORMULA SANITIZER
// =============================================================================

export class FormulaSanitizer {
  private warnings: string[] = [];

  /**
   * Sanitize a formula string from AI output
   * Returns cleaned formula or null if unsafe
   */
  sanitize(formula: string): { success: boolean; formula?: string; warnings?: string[]; error?: string } {
    this.warnings = [];

    if (!formula || typeof formula !== 'string') {
      return { success: false, error: 'Invalid formula input' };
    }

    let cleaned = formula.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/^```[\s\S]*?```$/gm, '').trim();
    cleaned = cleaned.replace(/`/g, '');

    // Ensure starts with =
    if (!cleaned.startsWith('=')) {
      cleaned = '=' + cleaned;
    }

    // Remove any line breaks
    cleaned = cleaned.replace(/[\r\n]+/g, '');

    // Validate all functions are allowed
    const functions = this.extractFunctions(cleaned);
    for (const fn of functions) {
      if (!ALLOWED_FUNCTIONS.has(fn.toUpperCase())) {
        return { success: false, error: `Disallowed function: ${fn}` };
      }
    }

    // Validate no dangerous patterns
    if (this.hasDangerousPatterns(cleaned)) {
      return { success: false, error: 'Formula contains potentially dangerous patterns' };
    }

    // Validate parenthesis balance
    let parenCount = 0;
    for (const char of cleaned) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { success: false, error: 'Unbalanced parentheses' };
      }
    }
    if (parenCount !== 0) {
      // Try to fix
      if (parenCount > 0) {
        cleaned += ')'.repeat(parenCount);
        this.warnings.push(`Added ${parenCount} closing parentheses`);
      } else {
        return { success: false, error: 'Unbalanced parentheses (too many closing)' };
      }
    }

    return {
      success: true,
      formula: cleaned,
      warnings: this.warnings.length > 0 ? this.warnings : undefined
    };
  }

  /**
   * Extract function names from formula
   */
  private extractFunctions(formula: string): string[] {
    const matches = formula.match(/[A-Z_][A-Z0-9_]*(?=\()/gi);
    return matches || [];
  }

  /**
   * Check for dangerous patterns that shouldn't be in formulas
   */
  private hasDangerousPatterns(formula: string): boolean {
    const dangerous = [
      /CALL\s*\(/i,           // External calls
      /REGISTER\s*\(/i,       // Register functions
      /\bDDE\b/i,             // DDE links
      /\bRTD\b/i,             // RTD links (could be ok but risky)
      /\\\\[^)]+/,            // UNC paths
      /file:/i,               // File protocol
      /http[s]?:/i,           // Web links in formulas (except WEBSERVICE which isn't in whitelist)
      /javascript:/i,         // Obviously bad
      /<script/i,             // XSS attempt
    ];

    return dangerous.some(pattern => pattern.test(formula));
  }
}

// =============================================================================
// COMMON FORMULA GENERATORS
// =============================================================================

export const commonFormulas = {
  /**
   * Simple ratio calculation with error handling
   */
  ratio(numerator: string, denominator: string): string {
    return new FormulaBuilder()
      .fn('IFERROR', `${numerator}/${denominator}`, '0')
      .build().formula!;
  },

  /**
   * Sum of range
   */
  sum(range: string): string {
    return new FormulaBuilder()
      .fn('SUM', range)
      .build().formula!;
  },

  /**
   * Sum with single condition
   */
  sumIf(criteriaRange: string, criteria: string, sumRange: string): string {
    return new FormulaBuilder()
      .fn('SUMIF', criteriaRange, `"${criteria}"`, sumRange)
      .build().formula!;
  },

  /**
   * Average of range
   */
  average(range: string): string {
    return new FormulaBuilder()
      .fn('AVERAGE', range)
      .build().formula!;
  },

  /**
   * Count non-empty cells
   */
  countA(range: string): string {
    return new FormulaBuilder()
      .fn('COUNTA', range)
      .build().formula!;
  },

  /**
   * Safe division
   */
  safeDivide(numerator: string, denominator: string, ifZero: string = '0'): string {
    return `=IFERROR(${numerator}/${denominator},${ifZero})`;
  },

  /**
   * Percentage calculation
   */
  percentage(part: string, whole: string): string {
    return `=IFERROR(${part}/${whole},0)`;
  },

  /**
   * Year-over-year growth
   */
  yoyGrowth(current: string, prior: string): string {
    return `=IFERROR((${current}/${prior})-1,0)`;
  },

  /**
   * Running total
   */
  runningTotal(startCell: string, currentCell: string): string {
    const absStart = startCell.replace(/([A-Z]+)(\d+)/i, '$$$1$$$2');
    return `=SUM(${absStart}:${currentCell})`;
  },

  /**
   * Variance calculation
   */
  variance(actual: string, budget: string): string {
    return `=${actual}-${budget}`;
  },

  /**
   * Variance percentage
   */
  variancePercent(actual: string, budget: string): string {
    return `=IFERROR((${actual}-${budget})/${budget},0)`;
  },

  /**
   * If-then-else
   */
  ifThenElse(condition: string, ifTrue: string, ifFalse: string): string {
    return `=IF(${condition},${ifTrue},${ifFalse})`;
  },

  /**
   * XLOOKUP (365+)
   */
  xlookup(lookupValue: string, lookupArray: string, returnArray: string, ifNotFound: string = '""'): string {
    return `=XLOOKUP(${lookupValue},${lookupArray},${returnArray},${ifNotFound})`;
  },

  /**
   * INDEX-MATCH (backwards compatible)
   */
  indexMatch(returnRange: string, lookupRange: string, lookupValue: string): string {
    return `=IFERROR(INDEX(${returnRange},MATCH(${lookupValue},${lookupRange},0)),"")`;
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

export const formulaSanitizer = new FormulaSanitizer();
