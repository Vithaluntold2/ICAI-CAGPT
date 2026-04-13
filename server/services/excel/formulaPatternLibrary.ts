/**
 * Formula Pattern Library
 * 
 * Validated, tested Excel formula patterns that the AI selects and customizes.
 * This ensures formula correctness - the LLM only needs to choose patterns and provide parameters.
 * 
 * Categories:
 * - Financial: NPV, IRR, XIRR, PMT, PV, FV, RATE, WACC, DCF, etc.
 * - Statistical: AVERAGE, STDEV, LINEST, FORECAST, CORREL, etc.
 * - Lookup: XLOOKUP, INDEX-MATCH, VLOOKUP, HLOOKUP, etc.
 * - Logical: IF, IFS, SWITCH, AND, OR, etc.
 * - Aggregation: SUM, SUMIF, SUMIFS, COUNTIF, AVERAGEIF, etc.
 * - Date/Time: EDATE, EOMONTH, NETWORKDAYS, YEARFRAC, etc.
 * - Array: FILTER, SORT, UNIQUE, SEQUENCE, etc.
 * - Text: TEXTJOIN, CONCAT, LEFT, RIGHT, MID, etc.
 */

export interface FormulaPattern {
  id: string;
  name: string;
  category: FormulaCategory;
  description: string;
  template: string;
  parameters: ParameterDefinition[];
  excelVersion: '2016' | '2019' | '2021' | '365';
  example: {
    params: Record<string, string>;
    result: string;
  };
  validation?: (params: Record<string, string>) => ValidationResult;
  alternatives?: string[]; // IDs of alternative patterns for older Excel versions
}

export interface ParameterDefinition {
  name: string;
  type: 'cell' | 'range' | 'number' | 'text' | 'boolean' | 'namedRange';
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export type FormulaCategory = 
  | 'financial'
  | 'statistical'
  | 'lookup'
  | 'logical'
  | 'aggregation'
  | 'date'
  | 'array'
  | 'text'
  | 'math'
  | 'accounting';

/**
 * Master Formula Pattern Library
 */
export const formulaPatterns: Record<string, FormulaPattern> = {
  // =============================================================================
  // FINANCIAL FORMULAS
  // =============================================================================
  
  npv: {
    id: 'npv',
    name: 'Net Present Value',
    category: 'financial',
    description: 'Calculate NPV of a series of cash flows at a given discount rate',
    template: '=NPV({rate},{cashFlowRange})+{initialInvestment}',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Discount rate per period', required: true },
      { name: 'cashFlowRange', type: 'range', description: 'Range of cash flows (periods 1-n)', required: true },
      { name: 'initialInvestment', type: 'cell', description: 'Initial investment (usually negative)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2', cashFlowRange: 'C5:C10', initialInvestment: 'C4' },
      result: '=NPV(B2,C5:C10)+C4'
    }
  },

  irr: {
    id: 'irr',
    name: 'Internal Rate of Return',
    category: 'financial',
    description: 'Calculate IRR for a series of cash flows',
    template: '=IRR({cashFlowRange},{guess})',
    parameters: [
      { name: 'cashFlowRange', type: 'range', description: 'Range including initial investment and all cash flows', required: true },
      { name: 'guess', type: 'number', description: 'Initial guess for IRR', required: false, defaultValue: '0.1' }
    ],
    excelVersion: '2016',
    example: {
      params: { cashFlowRange: 'B4:B10', guess: '0.1' },
      result: '=IRR(B4:B10,0.1)'
    }
  },

  xirr: {
    id: 'xirr',
    name: 'Extended IRR (Irregular Dates)',
    category: 'financial',
    description: 'Calculate IRR for cash flows with irregular timing',
    template: '=XIRR({cashFlowRange},{dateRange},{guess})',
    parameters: [
      { name: 'cashFlowRange', type: 'range', description: 'Range of cash flow values', required: true },
      { name: 'dateRange', type: 'range', description: 'Range of corresponding dates', required: true },
      { name: 'guess', type: 'number', description: 'Initial guess', required: false, defaultValue: '0.1' }
    ],
    excelVersion: '2016',
    example: {
      params: { cashFlowRange: 'B4:B10', dateRange: 'A4:A10', guess: '0.1' },
      result: '=XIRR(B4:B10,A4:A10,0.1)'
    }
  },

  xnpv: {
    id: 'xnpv',
    name: 'Extended NPV (Irregular Dates)',
    category: 'financial',
    description: 'Calculate NPV for cash flows with irregular timing',
    template: '=XNPV({rate},{cashFlowRange},{dateRange})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Annual discount rate', required: true },
      { name: 'cashFlowRange', type: 'range', description: 'Range of cash flow values', required: true },
      { name: 'dateRange', type: 'range', description: 'Range of corresponding dates', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2', cashFlowRange: 'C4:C10', dateRange: 'A4:A10' },
      result: '=XNPV(B2,C4:C10,A4:A10)'
    }
  },

  pmt: {
    id: 'pmt',
    name: 'Payment',
    category: 'financial',
    description: 'Calculate periodic payment for a loan',
    template: '=PMT({rate},{nper},{pv},{fv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'nper', type: 'cell', description: 'Total number of payments', required: true },
      { name: 'pv', type: 'cell', description: 'Present value (loan amount)', required: true },
      { name: 'fv', type: 'number', description: 'Future value (usually 0)', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: '0=end of period, 1=beginning', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2/12', nper: 'B3*12', pv: 'B4', fv: '0', type: '0' },
      result: '=PMT(B2/12,B3*12,B4,0,0)'
    }
  },

  ppmt: {
    id: 'ppmt',
    name: 'Principal Payment',
    category: 'financial',
    description: 'Calculate principal portion of a loan payment',
    template: '=PPMT({rate},{per},{nper},{pv},{fv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'per', type: 'cell', description: 'Period number', required: true },
      { name: 'nper', type: 'cell', description: 'Total number of payments', required: true },
      { name: 'pv', type: 'cell', description: 'Present value', required: true },
      { name: 'fv', type: 'number', description: 'Future value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: '$B$2/12', per: 'A10', nper: '$B$3*12', pv: '$B$4', fv: '0', type: '0' },
      result: '=PPMT($B$2/12,A10,$B$3*12,$B$4,0,0)'
    }
  },

  ipmt: {
    id: 'ipmt',
    name: 'Interest Payment',
    category: 'financial',
    description: 'Calculate interest portion of a loan payment',
    template: '=IPMT({rate},{per},{nper},{pv},{fv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'per', type: 'cell', description: 'Period number', required: true },
      { name: 'nper', type: 'cell', description: 'Total number of payments', required: true },
      { name: 'pv', type: 'cell', description: 'Present value', required: true },
      { name: 'fv', type: 'number', description: 'Future value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: '$B$2/12', per: 'A10', nper: '$B$3*12', pv: '$B$4', fv: '0', type: '0' },
      result: '=IPMT($B$2/12,A10,$B$3*12,$B$4,0,0)'
    }
  },

  pv: {
    id: 'pv',
    name: 'Present Value',
    category: 'financial',
    description: 'Calculate present value of an investment',
    template: '=PV({rate},{nper},{pmt},{fv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'nper', type: 'cell', description: 'Number of periods', required: true },
      { name: 'pmt', type: 'cell', description: 'Payment per period', required: true },
      { name: 'fv', type: 'number', description: 'Future value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2', nper: 'B3', pmt: 'B4', fv: '0', type: '0' },
      result: '=PV(B2,B3,B4,0,0)'
    }
  },

  fv: {
    id: 'fv',
    name: 'Future Value',
    category: 'financial',
    description: 'Calculate future value of an investment',
    template: '=FV({rate},{nper},{pmt},{pv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'nper', type: 'cell', description: 'Number of periods', required: true },
      { name: 'pmt', type: 'cell', description: 'Payment per period', required: true },
      { name: 'pv', type: 'number', description: 'Present value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2', nper: 'B3', pmt: 'B4', pv: '0', type: '0' },
      result: '=FV(B2,B3,B4,0,0)'
    }
  },

  rate: {
    id: 'rate',
    name: 'Interest Rate',
    category: 'financial',
    description: 'Calculate interest rate per period',
    template: '=RATE({nper},{pmt},{pv},{fv},{type},{guess})',
    parameters: [
      { name: 'nper', type: 'cell', description: 'Number of periods', required: true },
      { name: 'pmt', type: 'cell', description: 'Payment per period', required: true },
      { name: 'pv', type: 'cell', description: 'Present value', required: true },
      { name: 'fv', type: 'number', description: 'Future value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' },
      { name: 'guess', type: 'number', description: 'Initial guess', required: false, defaultValue: '0.1' }
    ],
    excelVersion: '2016',
    example: {
      params: { nper: 'B2', pmt: 'B3', pv: 'B4', fv: '0', type: '0', guess: '0.1' },
      result: '=RATE(B2,B3,B4,0,0,0.1)'
    }
  },

  nper: {
    id: 'nper',
    name: 'Number of Periods',
    category: 'financial',
    description: 'Calculate number of periods for an investment',
    template: '=NPER({rate},{pmt},{pv},{fv},{type})',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Interest rate per period', required: true },
      { name: 'pmt', type: 'cell', description: 'Payment per period', required: true },
      { name: 'pv', type: 'cell', description: 'Present value', required: true },
      { name: 'fv', type: 'number', description: 'Future value', required: false, defaultValue: '0' },
      { name: 'type', type: 'number', description: 'Payment timing', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: 'B2', pmt: 'B3', pv: 'B4', fv: '0', type: '0' },
      result: '=NPER(B2,B3,B4,0,0)'
    }
  },

  // WACC calculation (composite formula)
  wacc: {
    id: 'wacc',
    name: 'Weighted Average Cost of Capital',
    category: 'financial',
    description: 'Calculate WACC for valuation',
    template: '=({equityWeight}*{costOfEquity})+({debtWeight}*{costOfDebt}*(1-{taxRate}))',
    parameters: [
      { name: 'equityWeight', type: 'cell', description: 'Equity / Total Capital', required: true },
      { name: 'costOfEquity', type: 'cell', description: 'Cost of equity (Ke)', required: true },
      { name: 'debtWeight', type: 'cell', description: 'Debt / Total Capital', required: true },
      { name: 'costOfDebt', type: 'cell', description: 'Cost of debt (Kd)', required: true },
      { name: 'taxRate', type: 'cell', description: 'Corporate tax rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { equityWeight: 'B5', costOfEquity: 'B6', debtWeight: 'B7', costOfDebt: 'B8', taxRate: 'B9' },
      result: '=(B5*B6)+(B7*B8*(1-B9))'
    }
  },

  // CAPM for Cost of Equity
  capm: {
    id: 'capm',
    name: 'Capital Asset Pricing Model',
    category: 'financial',
    description: 'Calculate cost of equity using CAPM',
    template: '={riskFreeRate}+{beta}*({marketReturn}-{riskFreeRate})',
    parameters: [
      { name: 'riskFreeRate', type: 'cell', description: 'Risk-free rate (e.g., 10Y Treasury)', required: true },
      { name: 'beta', type: 'cell', description: 'Company beta', required: true },
      { name: 'marketReturn', type: 'cell', description: 'Expected market return', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { riskFreeRate: 'B2', beta: 'B3', marketReturn: 'B4' },
      result: '=B2+B3*(B4-B2)'
    }
  },

  // Terminal Value - Gordon Growth
  terminalValueGordon: {
    id: 'terminalValueGordon',
    name: 'Terminal Value (Gordon Growth)',
    category: 'financial',
    description: 'Calculate terminal value using perpetuity growth method',
    template: '={finalCashFlow}*(1+{growthRate})/({discountRate}-{growthRate})',
    parameters: [
      { name: 'finalCashFlow', type: 'cell', description: 'Final year free cash flow', required: true },
      { name: 'growthRate', type: 'cell', description: 'Perpetuity growth rate', required: true },
      { name: 'discountRate', type: 'cell', description: 'WACC or discount rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { finalCashFlow: 'G15', growthRate: 'B5', discountRate: 'B4' },
      result: '=G15*(1+B5)/(B4-B5)'
    }
  },

  // Terminal Value - Exit Multiple
  terminalValueMultiple: {
    id: 'terminalValueMultiple',
    name: 'Terminal Value (Exit Multiple)',
    category: 'financial',
    description: 'Calculate terminal value using exit multiple method',
    template: '={finalEBITDA}*{exitMultiple}',
    parameters: [
      { name: 'finalEBITDA', type: 'cell', description: 'Final year EBITDA', required: true },
      { name: 'exitMultiple', type: 'cell', description: 'Exit EV/EBITDA multiple', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { finalEBITDA: 'G12', exitMultiple: 'B6' },
      result: '=G12*B6'
    }
  },

  // Discount Factor
  discountFactor: {
    id: 'discountFactor',
    name: 'Discount Factor',
    category: 'financial',
    description: 'Calculate discount factor for a period',
    template: '=1/(1+{rate})^{period}',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Discount rate', required: true },
      { name: 'period', type: 'cell', description: 'Period number', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: '$B$4', period: 'C1' },
      result: '=1/(1+$B$4)^C1'
    }
  },

  // Depreciation - Straight Line
  sln: {
    id: 'sln',
    name: 'Straight-Line Depreciation',
    category: 'financial',
    description: 'Calculate straight-line depreciation per period',
    template: '=SLN({cost},{salvage},{life})',
    parameters: [
      { name: 'cost', type: 'cell', description: 'Asset cost', required: true },
      { name: 'salvage', type: 'cell', description: 'Salvage value', required: true },
      { name: 'life', type: 'cell', description: 'Useful life in periods', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { cost: 'B2', salvage: 'B3', life: 'B4' },
      result: '=SLN(B2,B3,B4)'
    }
  },

  // Depreciation - Double Declining Balance
  ddb: {
    id: 'ddb',
    name: 'Double Declining Balance Depreciation',
    category: 'financial',
    description: 'Calculate accelerated depreciation',
    template: '=DDB({cost},{salvage},{life},{period},{factor})',
    parameters: [
      { name: 'cost', type: 'cell', description: 'Asset cost', required: true },
      { name: 'salvage', type: 'cell', description: 'Salvage value', required: true },
      { name: 'life', type: 'cell', description: 'Useful life', required: true },
      { name: 'period', type: 'cell', description: 'Period', required: true },
      { name: 'factor', type: 'number', description: 'Depreciation factor (default 2)', required: false, defaultValue: '2' }
    ],
    excelVersion: '2016',
    example: {
      params: { cost: '$B$2', salvage: '$B$3', life: '$B$4', period: 'A10', factor: '2' },
      result: '=DDB($B$2,$B$3,$B$4,A10,2)'
    }
  },

  // =============================================================================
  // LOOKUP FORMULAS
  // =============================================================================

  xlookup: {
    id: 'xlookup',
    name: 'XLOOKUP',
    category: 'lookup',
    description: 'Modern lookup function (Excel 365)',
    template: '=XLOOKUP({lookupValue},{lookupArray},{returnArray},{ifNotFound},{matchMode},{searchMode})',
    parameters: [
      { name: 'lookupValue', type: 'cell', description: 'Value to find', required: true },
      { name: 'lookupArray', type: 'range', description: 'Range to search in', required: true },
      { name: 'returnArray', type: 'range', description: 'Range to return from', required: true },
      { name: 'ifNotFound', type: 'text', description: 'Value if not found', required: false, defaultValue: '"Not Found"' },
      { name: 'matchMode', type: 'number', description: '0=exact, -1=exact or smaller, 1=exact or larger, 2=wildcard', required: false, defaultValue: '0' },
      { name: 'searchMode', type: 'number', description: '1=first to last, -1=last to first, 2=binary ascending, -2=binary descending', required: false, defaultValue: '1' }
    ],
    excelVersion: '365',
    example: {
      params: { lookupValue: 'A2', lookupArray: 'Products!A:A', returnArray: 'Products!B:B', ifNotFound: '"N/A"', matchMode: '0', searchMode: '1' },
      result: '=XLOOKUP(A2,Products!A:A,Products!B:B,"N/A",0,1)'
    },
    alternatives: ['indexMatch']
  },

  indexMatch: {
    id: 'indexMatch',
    name: 'INDEX-MATCH',
    category: 'lookup',
    description: 'Classic flexible lookup combination',
    template: '=INDEX({returnRange},MATCH({lookupValue},{lookupRange},{matchType}))',
    parameters: [
      { name: 'returnRange', type: 'range', description: 'Range to return from', required: true },
      { name: 'lookupValue', type: 'cell', description: 'Value to find', required: true },
      { name: 'lookupRange', type: 'range', description: 'Range to search in', required: true },
      { name: 'matchType', type: 'number', description: '0=exact, 1=less than, -1=greater than', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { returnRange: 'B2:B100', lookupValue: 'A2', lookupRange: 'A2:A100', matchType: '0' },
      result: '=INDEX(B2:B100,MATCH(A2,A2:A100,0))'
    }
  },

  vlookup: {
    id: 'vlookup',
    name: 'VLOOKUP',
    category: 'lookup',
    description: 'Vertical lookup (legacy)',
    template: '=VLOOKUP({lookupValue},{tableArray},{colIndex},{rangeLookup})',
    parameters: [
      { name: 'lookupValue', type: 'cell', description: 'Value to find', required: true },
      { name: 'tableArray', type: 'range', description: 'Table range', required: true },
      { name: 'colIndex', type: 'number', description: 'Column index to return', required: true },
      { name: 'rangeLookup', type: 'boolean', description: 'FALSE=exact, TRUE=approximate', required: false, defaultValue: 'FALSE' }
    ],
    excelVersion: '2016',
    example: {
      params: { lookupValue: 'A2', tableArray: 'Data!A:D', colIndex: '3', rangeLookup: 'FALSE' },
      result: '=VLOOKUP(A2,Data!A:D,3,FALSE)'
    }
  },

  // =============================================================================
  // AGGREGATION FORMULAS
  // =============================================================================

  sumifs: {
    id: 'sumifs',
    name: 'SUMIFS',
    category: 'aggregation',
    description: 'Sum with multiple criteria',
    template: '=SUMIFS({sumRange},{criteriaRange1},{criteria1},{criteriaRange2},{criteria2})',
    parameters: [
      { name: 'sumRange', type: 'range', description: 'Range to sum', required: true },
      { name: 'criteriaRange1', type: 'range', description: 'First criteria range', required: true },
      { name: 'criteria1', type: 'cell', description: 'First criteria', required: true },
      { name: 'criteriaRange2', type: 'range', description: 'Second criteria range', required: false },
      { name: 'criteria2', type: 'cell', description: 'Second criteria', required: false }
    ],
    excelVersion: '2016',
    example: {
      params: { sumRange: 'D2:D100', criteriaRange1: 'A2:A100', criteria1: '"Sales"', criteriaRange2: 'B2:B100', criteria2: 'E2' },
      result: '=SUMIFS(D2:D100,A2:A100,"Sales",B2:B100,E2)'
    }
  },

  countifs: {
    id: 'countifs',
    name: 'COUNTIFS',
    category: 'aggregation',
    description: 'Count with multiple criteria',
    template: '=COUNTIFS({criteriaRange1},{criteria1},{criteriaRange2},{criteria2})',
    parameters: [
      { name: 'criteriaRange1', type: 'range', description: 'First criteria range', required: true },
      { name: 'criteria1', type: 'cell', description: 'First criteria', required: true },
      { name: 'criteriaRange2', type: 'range', description: 'Second criteria range', required: false },
      { name: 'criteria2', type: 'cell', description: 'Second criteria', required: false }
    ],
    excelVersion: '2016',
    example: {
      params: { criteriaRange1: 'A2:A100', criteria1: '"Active"', criteriaRange2: 'B2:B100', criteria2: '">1000"' },
      result: '=COUNTIFS(A2:A100,"Active",B2:B100,">1000")'
    }
  },

  averageifs: {
    id: 'averageifs',
    name: 'AVERAGEIFS',
    category: 'aggregation',
    description: 'Average with multiple criteria',
    template: '=AVERAGEIFS({avgRange},{criteriaRange1},{criteria1},{criteriaRange2},{criteria2})',
    parameters: [
      { name: 'avgRange', type: 'range', description: 'Range to average', required: true },
      { name: 'criteriaRange1', type: 'range', description: 'First criteria range', required: true },
      { name: 'criteria1', type: 'cell', description: 'First criteria', required: true },
      { name: 'criteriaRange2', type: 'range', description: 'Second criteria range', required: false },
      { name: 'criteria2', type: 'cell', description: 'Second criteria', required: false }
    ],
    excelVersion: '2016',
    example: {
      params: { avgRange: 'D2:D100', criteriaRange1: 'A2:A100', criteria1: '"Q1"', criteriaRange2: '', criteria2: '' },
      result: '=AVERAGEIFS(D2:D100,A2:A100,"Q1")'
    }
  },

  sumproduct: {
    id: 'sumproduct',
    name: 'SUMPRODUCT',
    category: 'aggregation',
    description: 'Multiply arrays and sum the result',
    template: '=SUMPRODUCT({array1},{array2})',
    parameters: [
      { name: 'array1', type: 'range', description: 'First array', required: true },
      { name: 'array2', type: 'range', description: 'Second array', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { array1: 'B2:B10', array2: 'C2:C10' },
      result: '=SUMPRODUCT(B2:B10,C2:C10)'
    }
  },

  // =============================================================================
  // LOGICAL FORMULAS
  // =============================================================================

  ifStatement: {
    id: 'ifStatement',
    name: 'IF',
    category: 'logical',
    description: 'Conditional logic',
    template: '=IF({condition},{valueIfTrue},{valueIfFalse})',
    parameters: [
      { name: 'condition', type: 'text', description: 'Logical test', required: true },
      { name: 'valueIfTrue', type: 'cell', description: 'Value if TRUE', required: true },
      { name: 'valueIfFalse', type: 'cell', description: 'Value if FALSE', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { condition: 'A2>100', valueIfTrue: '"High"', valueIfFalse: '"Low"' },
      result: '=IF(A2>100,"High","Low")'
    }
  },

  ifs: {
    id: 'ifs',
    name: 'IFS',
    category: 'logical',
    description: 'Multiple conditions without nesting',
    template: '=IFS({condition1},{value1},{condition2},{value2},{condition3},{value3})',
    parameters: [
      { name: 'condition1', type: 'text', description: 'First condition', required: true },
      { name: 'value1', type: 'cell', description: 'Value if first condition true', required: true },
      { name: 'condition2', type: 'text', description: 'Second condition', required: false },
      { name: 'value2', type: 'cell', description: 'Value if second condition true', required: false },
      { name: 'condition3', type: 'text', description: 'Third condition', required: false },
      { name: 'value3', type: 'cell', description: 'Value if third condition true', required: false }
    ],
    excelVersion: '2019',
    example: {
      params: { condition1: 'A2>=90', value1: '"A"', condition2: 'A2>=80', value2: '"B"', condition3: 'TRUE', value3: '"C"' },
      result: '=IFS(A2>=90,"A",A2>=80,"B",TRUE,"C")'
    }
  },

  iferror: {
    id: 'iferror',
    name: 'IFERROR',
    category: 'logical',
    description: 'Handle errors gracefully',
    template: '=IFERROR({formula},{valueIfError})',
    parameters: [
      { name: 'formula', type: 'text', description: 'Formula to evaluate', required: true },
      { name: 'valueIfError', type: 'cell', description: 'Value if error', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { formula: 'A2/B2', valueIfError: '0' },
      result: '=IFERROR(A2/B2,0)'
    }
  },

  switch: {
    id: 'switch',
    name: 'SWITCH',
    category: 'logical',
    description: 'Match value against list',
    template: '=SWITCH({expression},{value1},{result1},{value2},{result2},{default})',
    parameters: [
      { name: 'expression', type: 'cell', description: 'Expression to evaluate', required: true },
      { name: 'value1', type: 'text', description: 'First value to match', required: true },
      { name: 'result1', type: 'cell', description: 'Result if first match', required: true },
      { name: 'value2', type: 'text', description: 'Second value to match', required: false },
      { name: 'result2', type: 'cell', description: 'Result if second match', required: false },
      { name: 'default', type: 'cell', description: 'Default value', required: false }
    ],
    excelVersion: '2019',
    example: {
      params: { expression: 'A2', value1: '"Jan"', result1: '1', value2: '"Feb"', result2: '2', default: '0' },
      result: '=SWITCH(A2,"Jan",1,"Feb",2,0)'
    }
  },

  // =============================================================================
  // ARRAY FORMULAS (Excel 365)
  // =============================================================================

  filter: {
    id: 'filter',
    name: 'FILTER',
    category: 'array',
    description: 'Filter array by criteria (Excel 365)',
    template: '=FILTER({array},{include},{ifEmpty})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to filter', required: true },
      { name: 'include', type: 'text', description: 'Boolean array for filtering', required: true },
      { name: 'ifEmpty', type: 'text', description: 'Value if no results', required: false, defaultValue: '"No results"' }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:D100', include: 'B2:B100>1000', ifEmpty: '"No matches"' },
      result: '=FILTER(A2:D100,B2:B100>1000,"No matches")'
    }
  },

  sort: {
    id: 'sort',
    name: 'SORT',
    category: 'array',
    description: 'Sort array (Excel 365)',
    template: '=SORT({array},{sortIndex},{sortOrder},{byCol})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to sort', required: true },
      { name: 'sortIndex', type: 'number', description: 'Column index to sort by', required: false, defaultValue: '1' },
      { name: 'sortOrder', type: 'number', description: '1=ascending, -1=descending', required: false, defaultValue: '1' },
      { name: 'byCol', type: 'boolean', description: 'TRUE=by column', required: false, defaultValue: 'FALSE' }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:D100', sortIndex: '2', sortOrder: '-1', byCol: 'FALSE' },
      result: '=SORT(A2:D100,2,-1,FALSE)'
    }
  },

  unique: {
    id: 'unique',
    name: 'UNIQUE',
    category: 'array',
    description: 'Return unique values (Excel 365)',
    template: '=UNIQUE({array},{byCol},{exactlyOnce})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to extract unique values from', required: true },
      { name: 'byCol', type: 'boolean', description: 'TRUE=compare by column', required: false, defaultValue: 'FALSE' },
      { name: 'exactlyOnce', type: 'boolean', description: 'TRUE=return values that occur only once', required: false, defaultValue: 'FALSE' }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:A100', byCol: 'FALSE', exactlyOnce: 'FALSE' },
      result: '=UNIQUE(A2:A100,FALSE,FALSE)'
    }
  },

  sequence: {
    id: 'sequence',
    name: 'SEQUENCE',
    category: 'array',
    description: 'Generate sequence of numbers (Excel 365)',
    template: '=SEQUENCE({rows},{cols},{start},{step})',
    parameters: [
      { name: 'rows', type: 'number', description: 'Number of rows', required: true },
      { name: 'cols', type: 'number', description: 'Number of columns', required: false, defaultValue: '1' },
      { name: 'start', type: 'number', description: 'Starting value', required: false, defaultValue: '1' },
      { name: 'step', type: 'number', description: 'Increment', required: false, defaultValue: '1' }
    ],
    excelVersion: '365',
    example: {
      params: { rows: '10', cols: '1', start: '1', step: '1' },
      result: '=SEQUENCE(10,1,1,1)'
    }
  },

  // =============================================================================
  // DATE FORMULAS
  // =============================================================================

  edate: {
    id: 'edate',
    name: 'EDATE',
    category: 'date',
    description: 'Add months to a date',
    template: '=EDATE({startDate},{months})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'months', type: 'cell', description: 'Number of months to add', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'A2', months: '3' },
      result: '=EDATE(A2,3)'
    }
  },

  eomonth: {
    id: 'eomonth',
    name: 'EOMONTH',
    category: 'date',
    description: 'Get end of month date',
    template: '=EOMONTH({startDate},{months})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'months', type: 'cell', description: 'Months offset', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'A2', months: '0' },
      result: '=EOMONTH(A2,0)'
    }
  },

  yearfrac: {
    id: 'yearfrac',
    name: 'YEARFRAC',
    category: 'date',
    description: 'Calculate fraction of year between dates',
    template: '=YEARFRAC({startDate},{endDate},{basis})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'endDate', type: 'cell', description: 'End date', required: true },
      { name: 'basis', type: 'number', description: 'Day count basis', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'A2', endDate: 'B2', basis: '0' },
      result: '=YEARFRAC(A2,B2,0)'
    }
  },

  // =============================================================================
  // ACCOUNTING-SPECIFIC FORMULAS
  // =============================================================================

  grossMargin: {
    id: 'grossMargin',
    name: 'Gross Margin',
    category: 'accounting',
    description: 'Calculate gross margin percentage',
    template: '=({revenue}-{cogs})/{revenue}',
    parameters: [
      { name: 'revenue', type: 'cell', description: 'Revenue cell', required: true },
      { name: 'cogs', type: 'cell', description: 'Cost of goods sold cell', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { revenue: 'B5', cogs: 'B6' },
      result: '=(B5-B6)/B5'
    }
  },

  operatingMargin: {
    id: 'operatingMargin',
    name: 'Operating Margin',
    category: 'accounting',
    description: 'Calculate operating margin',
    template: '={operatingIncome}/{revenue}',
    parameters: [
      { name: 'operatingIncome', type: 'cell', description: 'Operating income', required: true },
      { name: 'revenue', type: 'cell', description: 'Revenue', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { operatingIncome: 'B10', revenue: 'B5' },
      result: '=B10/B5'
    }
  },

  ebitda: {
    id: 'ebitda',
    name: 'EBITDA',
    category: 'accounting',
    description: 'Calculate EBITDA',
    template: '={operatingIncome}+{depreciation}+{amortization}',
    parameters: [
      { name: 'operatingIncome', type: 'cell', description: 'Operating income', required: true },
      { name: 'depreciation', type: 'cell', description: 'Depreciation expense', required: true },
      { name: 'amortization', type: 'cell', description: 'Amortization expense', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { operatingIncome: 'B10', depreciation: 'B11', amortization: 'B12' },
      result: '=B10+B11+B12'
    }
  },

  freeCashFlow: {
    id: 'freeCashFlow',
    name: 'Free Cash Flow',
    category: 'accounting',
    description: 'Calculate unlevered free cash flow',
    template: '={ebit}*(1-{taxRate})+{depreciation}-{capex}-{changeInNWC}',
    parameters: [
      { name: 'ebit', type: 'cell', description: 'EBIT', required: true },
      { name: 'taxRate', type: 'cell', description: 'Tax rate', required: true },
      { name: 'depreciation', type: 'cell', description: 'D&A', required: true },
      { name: 'capex', type: 'cell', description: 'Capital expenditures', required: true },
      { name: 'changeInNWC', type: 'cell', description: 'Change in working capital', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { ebit: 'B10', taxRate: '$B$3', depreciation: 'B11', capex: 'B15', changeInNWC: 'B16' },
      result: '=B10*(1-$B$3)+B11-B15-B16'
    }
  },

  debtServiceCoverageRatio: {
    id: 'debtServiceCoverageRatio',
    name: 'Debt Service Coverage Ratio (DSCR)',
    category: 'accounting',
    description: 'Calculate DSCR',
    template: '={noi}/{debtService}',
    parameters: [
      { name: 'noi', type: 'cell', description: 'Net operating income', required: true },
      { name: 'debtService', type: 'cell', description: 'Total debt service', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { noi: 'B20', debtService: 'B25' },
      result: '=B20/B25'
    }
  },

  currentRatio: {
    id: 'currentRatio',
    name: 'Current Ratio',
    category: 'accounting',
    description: 'Calculate current ratio',
    template: '={currentAssets}/{currentLiabilities}',
    parameters: [
      { name: 'currentAssets', type: 'cell', description: 'Current assets', required: true },
      { name: 'currentLiabilities', type: 'cell', description: 'Current liabilities', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { currentAssets: 'B15', currentLiabilities: 'B25' },
      result: '=B15/B25'
    }
  },

  debtToEquity: {
    id: 'debtToEquity',
    name: 'Debt to Equity Ratio',
    category: 'accounting',
    description: 'Calculate D/E ratio',
    template: '={totalDebt}/{totalEquity}',
    parameters: [
      { name: 'totalDebt', type: 'cell', description: 'Total debt', required: true },
      { name: 'totalEquity', type: 'cell', description: 'Total equity', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { totalDebt: 'B30', totalEquity: 'B40' },
      result: '=B30/B40'
    }
  },

  returnOnEquity: {
    id: 'returnOnEquity',
    name: 'Return on Equity (ROE)',
    category: 'accounting',
    description: 'Calculate ROE',
    template: '={netIncome}/{averageEquity}',
    parameters: [
      { name: 'netIncome', type: 'cell', description: 'Net income', required: true },
      { name: 'averageEquity', type: 'cell', description: 'Average shareholders equity', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { netIncome: 'B50', averageEquity: 'B55' },
      result: '=B50/B55'
    }
  },

  returnOnAssets: {
    id: 'returnOnAssets',
    name: 'Return on Assets (ROA)',
    category: 'accounting',
    description: 'Calculate ROA',
    template: '={netIncome}/{averageAssets}',
    parameters: [
      { name: 'netIncome', type: 'cell', description: 'Net income', required: true },
      { name: 'averageAssets', type: 'cell', description: 'Average total assets', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { netIncome: 'B50', averageAssets: 'B10' },
      result: '=B50/B10'
    }
  },

  // =============================================================================
  // ADDITIONAL ACCOUNTING RATIOS
  // =============================================================================

  quickRatio: {
    id: 'quickRatio',
    name: 'Quick Ratio (Acid Test)',
    category: 'accounting',
    description: 'Calculate quick ratio excluding inventory',
    template: '=({currentAssets}-{inventory})/{currentLiabilities}',
    parameters: [
      { name: 'currentAssets', type: 'cell', description: 'Current assets', required: true },
      { name: 'inventory', type: 'cell', description: 'Inventory', required: true },
      { name: 'currentLiabilities', type: 'cell', description: 'Current liabilities', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { currentAssets: 'B15', inventory: 'B18', currentLiabilities: 'B30' },
      result: '=(B15-B18)/B30'
    }
  },

  interestCoverageRatio: {
    id: 'interestCoverageRatio',
    name: 'Interest Coverage Ratio',
    category: 'accounting',
    description: 'Calculate interest coverage (Times Interest Earned)',
    template: '={ebit}/{interestExpense}',
    parameters: [
      { name: 'ebit', type: 'cell', description: 'EBIT', required: true },
      { name: 'interestExpense', type: 'cell', description: 'Interest expense', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { ebit: 'B12', interestExpense: 'B15' },
      result: '=B12/B15'
    }
  },

  assetTurnover: {
    id: 'assetTurnover',
    name: 'Asset Turnover Ratio',
    category: 'accounting',
    description: 'Calculate asset turnover',
    template: '={revenue}/{averageAssets}',
    parameters: [
      { name: 'revenue', type: 'cell', description: 'Net revenue', required: true },
      { name: 'averageAssets', type: 'cell', description: 'Average total assets', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { revenue: 'B5', averageAssets: 'B60' },
      result: '=B5/B60'
    }
  },

  inventoryTurnover: {
    id: 'inventoryTurnover',
    name: 'Inventory Turnover',
    category: 'accounting',
    description: 'Calculate inventory turnover ratio',
    template: '={cogs}/{averageInventory}',
    parameters: [
      { name: 'cogs', type: 'cell', description: 'Cost of goods sold', required: true },
      { name: 'averageInventory', type: 'cell', description: 'Average inventory', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { cogs: 'B8', averageInventory: 'B20' },
      result: '=B8/B20'
    }
  },

  daysInventory: {
    id: 'daysInventory',
    name: 'Days Inventory Outstanding (DIO)',
    category: 'accounting',
    description: 'Calculate days of inventory on hand',
    template: '=({averageInventory}/{cogs})*365',
    parameters: [
      { name: 'averageInventory', type: 'cell', description: 'Average inventory', required: true },
      { name: 'cogs', type: 'cell', description: 'Cost of goods sold (annual)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { averageInventory: 'B20', cogs: 'B8' },
      result: '=(B20/B8)*365'
    }
  },

  daysSalesOutstanding: {
    id: 'daysSalesOutstanding',
    name: 'Days Sales Outstanding (DSO)',
    category: 'accounting',
    description: 'Calculate average collection period',
    template: '=({averageReceivables}/{revenue})*365',
    parameters: [
      { name: 'averageReceivables', type: 'cell', description: 'Average accounts receivable', required: true },
      { name: 'revenue', type: 'cell', description: 'Annual revenue', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { averageReceivables: 'B22', revenue: 'B5' },
      result: '=(B22/B5)*365'
    }
  },

  daysPayable: {
    id: 'daysPayable',
    name: 'Days Payable Outstanding (DPO)',
    category: 'accounting',
    description: 'Calculate days payable outstanding',
    template: '=({averagePayables}/{cogs})*365',
    parameters: [
      { name: 'averagePayables', type: 'cell', description: 'Average accounts payable', required: true },
      { name: 'cogs', type: 'cell', description: 'Cost of goods sold (annual)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { averagePayables: 'B35', cogs: 'B8' },
      result: '=(B35/B8)*365'
    }
  },

  cashConversionCycle: {
    id: 'cashConversionCycle',
    name: 'Cash Conversion Cycle (CCC)',
    category: 'accounting',
    description: 'Calculate CCC = DIO + DSO - DPO',
    template: '={dio}+{dso}-{dpo}',
    parameters: [
      { name: 'dio', type: 'cell', description: 'Days inventory outstanding', required: true },
      { name: 'dso', type: 'cell', description: 'Days sales outstanding', required: true },
      { name: 'dpo', type: 'cell', description: 'Days payable outstanding', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { dio: 'B50', dso: 'B51', dpo: 'B52' },
      result: '=B50+B51-B52'
    }
  },

  workingCapital: {
    id: 'workingCapital',
    name: 'Working Capital',
    category: 'accounting',
    description: 'Calculate net working capital',
    template: '={currentAssets}-{currentLiabilities}',
    parameters: [
      { name: 'currentAssets', type: 'cell', description: 'Current assets', required: true },
      { name: 'currentLiabilities', type: 'cell', description: 'Current liabilities', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { currentAssets: 'B15', currentLiabilities: 'B30' },
      result: '=B15-B30'
    }
  },

  roic: {
    id: 'roic',
    name: 'Return on Invested Capital (ROIC)',
    category: 'accounting',
    description: 'Calculate ROIC = NOPAT / Invested Capital',
    template: '={nopat}/{investedCapital}',
    parameters: [
      { name: 'nopat', type: 'cell', description: 'Net Operating Profit After Tax', required: true },
      { name: 'investedCapital', type: 'cell', description: 'Invested capital (debt + equity)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { nopat: 'B45', investedCapital: 'B60' },
      result: '=B45/B60'
    }
  },

  nopat: {
    id: 'nopat',
    name: 'NOPAT',
    category: 'accounting',
    description: 'Net Operating Profit After Tax',
    template: '={operatingIncome}*(1-{taxRate})',
    parameters: [
      { name: 'operatingIncome', type: 'cell', description: 'Operating income (EBIT)', required: true },
      { name: 'taxRate', type: 'cell', description: 'Effective tax rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { operatingIncome: 'B12', taxRate: '$B$3' },
      result: '=B12*(1-$B$3)'
    }
  },

  earningsPerShare: {
    id: 'earningsPerShare',
    name: 'Earnings Per Share (EPS)',
    category: 'accounting',
    description: 'Calculate basic EPS',
    template: '=({netIncome}-{preferredDividends})/{sharesOutstanding}',
    parameters: [
      { name: 'netIncome', type: 'cell', description: 'Net income', required: true },
      { name: 'preferredDividends', type: 'cell', description: 'Preferred dividends', required: true },
      { name: 'sharesOutstanding', type: 'cell', description: 'Weighted avg shares', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { netIncome: 'B50', preferredDividends: 'B51', sharesOutstanding: 'B55' },
      result: '=(B50-B51)/B55'
    }
  },

  priceToEarnings: {
    id: 'priceToEarnings',
    name: 'Price to Earnings Ratio (P/E)',
    category: 'accounting',
    description: 'Calculate P/E ratio',
    template: '={stockPrice}/{eps}',
    parameters: [
      { name: 'stockPrice', type: 'cell', description: 'Current stock price', required: true },
      { name: 'eps', type: 'cell', description: 'Earnings per share', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { stockPrice: 'B2', eps: 'B56' },
      result: '=B2/B56'
    }
  },

  enterpriseValue: {
    id: 'enterpriseValue',
    name: 'Enterprise Value (EV)',
    category: 'accounting',
    description: 'Calculate enterprise value',
    template: '={marketCap}+{totalDebt}-{cash}+{preferredStock}+{minorityInterest}',
    parameters: [
      { name: 'marketCap', type: 'cell', description: 'Market capitalization', required: true },
      { name: 'totalDebt', type: 'cell', description: 'Total debt', required: true },
      { name: 'cash', type: 'cell', description: 'Cash and equivalents', required: true },
      { name: 'preferredStock', type: 'cell', description: 'Preferred stock', required: false, defaultValue: '0' },
      { name: 'minorityInterest', type: 'cell', description: 'Minority interest', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { marketCap: 'B60', totalDebt: 'B30', cash: 'B14', preferredStock: '0', minorityInterest: '0' },
      result: '=B60+B30-B14+0+0'
    }
  },

  evToEbitda: {
    id: 'evToEbitda',
    name: 'EV/EBITDA Multiple',
    category: 'accounting',
    description: 'Calculate EV to EBITDA ratio',
    template: '={enterpriseValue}/{ebitda}',
    parameters: [
      { name: 'enterpriseValue', type: 'cell', description: 'Enterprise value', required: true },
      { name: 'ebitda', type: 'cell', description: 'EBITDA', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { enterpriseValue: 'B65', ebitda: 'B15' },
      result: '=B65/B15'
    }
  },

  // =============================================================================
  // DCF VALUATION FORMULAS
  // =============================================================================

  midYearDiscountFactor: {
    id: 'midYearDiscountFactor',
    name: 'Mid-Year Discount Factor',
    category: 'financial',
    description: 'Calculate mid-year convention discount factor',
    template: '=1/(1+{rate})^({period}-0.5)',
    parameters: [
      { name: 'rate', type: 'cell', description: 'Discount rate', required: true },
      { name: 'period', type: 'cell', description: 'Period number', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { rate: '$B$5', period: 'C1' },
      result: '=1/(1+$B$5)^(C1-0.5)'
    }
  },

  presentValueCashFlow: {
    id: 'presentValueCashFlow',
    name: 'Present Value of Cash Flow',
    category: 'financial',
    description: 'Calculate PV of a single cash flow',
    template: '={cashFlow}*{discountFactor}',
    parameters: [
      { name: 'cashFlow', type: 'cell', description: 'Cash flow amount', required: true },
      { name: 'discountFactor', type: 'cell', description: 'Discount factor', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { cashFlow: 'B20', discountFactor: 'B21' },
      result: '=B20*B21'
    }
  },

  impliedEquityValue: {
    id: 'impliedEquityValue',
    name: 'Implied Equity Value',
    category: 'financial',
    description: 'Calculate equity value from enterprise value',
    template: '={enterpriseValue}-{netDebt}',
    parameters: [
      { name: 'enterpriseValue', type: 'cell', description: 'Enterprise value', required: true },
      { name: 'netDebt', type: 'cell', description: 'Net debt (total debt - cash)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { enterpriseValue: 'B25', netDebt: 'B30' },
      result: '=B25-B30'
    }
  },

  impliedSharePrice: {
    id: 'impliedSharePrice',
    name: 'Implied Share Price',
    category: 'financial',
    description: 'Calculate implied share price from equity value',
    template: '={equityValue}/{sharesOutstanding}',
    parameters: [
      { name: 'equityValue', type: 'cell', description: 'Equity value', required: true },
      { name: 'sharesOutstanding', type: 'cell', description: 'Shares outstanding', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { equityValue: 'B35', sharesOutstanding: 'B40' },
      result: '=B35/B40'
    }
  },

  // =============================================================================
  // LBO FORMULAS
  // =============================================================================

  leveragedReturns: {
    id: 'leveragedReturns',
    name: 'LBO IRR (Levered Returns)',
    category: 'financial',
    description: 'Calculate IRR for LBO investment',
    template: '=IRR({B{startRow}:B{endRow}})',
    parameters: [
      { name: 'startRow', type: 'number', description: 'Start row of cash flows', required: true },
      { name: 'endRow', type: 'number', description: 'End row of cash flows', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { startRow: '5', endRow: '10' },
      result: '=IRR(B5:B10)'
    }
  },

  moic: {
    id: 'moic',
    name: 'Multiple on Invested Capital (MOIC)',
    category: 'financial',
    description: 'Calculate MOIC for private equity',
    template: '={exitProceeds}/{initialInvestment}',
    parameters: [
      { name: 'exitProceeds', type: 'cell', description: 'Total exit proceeds', required: true },
      { name: 'initialInvestment', type: 'cell', description: 'Initial equity investment', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { exitProceeds: 'B50', initialInvestment: 'B5' },
      result: '=B50/B5'
    }
  },

  debtScheduleInterest: {
    id: 'debtScheduleInterest',
    name: 'Debt Schedule - Interest',
    category: 'financial',
    description: 'Calculate interest expense based on average debt',
    template: '=({beginningBalance}+{endingBalance})/2*{interestRate}',
    parameters: [
      { name: 'beginningBalance', type: 'cell', description: 'Beginning debt balance', required: true },
      { name: 'endingBalance', type: 'cell', description: 'Ending debt balance', required: true },
      { name: 'interestRate', type: 'cell', description: 'Annual interest rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { beginningBalance: 'B10', endingBalance: 'B15', interestRate: '$B$3' },
      result: '=(B10+B15)/2*$B$3'
    }
  },

  debtPaydown: {
    id: 'debtPaydown',
    name: 'Debt Paydown',
    category: 'financial',
    description: 'Calculate mandatory + optional debt paydown',
    template: '=MIN({availableCash},{debtBalance})',
    parameters: [
      { name: 'availableCash', type: 'cell', description: 'Cash available for paydown', required: true },
      { name: 'debtBalance', type: 'cell', description: 'Remaining debt balance', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { availableCash: 'B25', debtBalance: 'B10' },
      result: '=MIN(B25,B10)'
    }
  },

  // =============================================================================
  // TAX FORMULAS
  // =============================================================================

  taxExpense: {
    id: 'taxExpense',
    name: 'Tax Expense',
    category: 'accounting',
    description: 'Calculate income tax expense',
    template: '=MAX(0,{taxableIncome}*{taxRate})',
    parameters: [
      { name: 'taxableIncome', type: 'cell', description: 'Pre-tax income', required: true },
      { name: 'taxRate', type: 'cell', description: 'Tax rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { taxableIncome: 'B45', taxRate: '$B$3' },
      result: '=MAX(0,B45*$B$3)'
    }
  },

  deferredTax: {
    id: 'deferredTax',
    name: 'Deferred Tax Liability',
    category: 'accounting',
    description: 'Calculate deferred tax from timing difference',
    template: '={timingDifference}*{taxRate}',
    parameters: [
      { name: 'timingDifference', type: 'cell', description: 'Book-tax timing difference', required: true },
      { name: 'taxRate', type: 'cell', description: 'Tax rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { timingDifference: 'B30', taxRate: '$B$3' },
      result: '=B30*$B$3'
    }
  },

  effectiveTaxRate: {
    id: 'effectiveTaxRate',
    name: 'Effective Tax Rate',
    category: 'accounting',
    description: 'Calculate effective tax rate',
    template: '=IFERROR({taxExpense}/{preTaxIncome},0)',
    parameters: [
      { name: 'taxExpense', type: 'cell', description: 'Income tax expense', required: true },
      { name: 'preTaxIncome', type: 'cell', description: 'Pre-tax income', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { taxExpense: 'B46', preTaxIncome: 'B45' },
      result: '=IFERROR(B46/B45,0)'
    }
  },

  // =============================================================================
  // GROWTH AND FORECASTING
  // =============================================================================

  yoyGrowth: {
    id: 'yoyGrowth',
    name: 'Year-over-Year Growth',
    category: 'statistical',
    description: 'Calculate YoY growth rate',
    template: '=IFERROR(({currentYear}/{priorYear})-1,0)',
    parameters: [
      { name: 'currentYear', type: 'cell', description: 'Current period value', required: true },
      { name: 'priorYear', type: 'cell', description: 'Prior period value', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { currentYear: 'C5', priorYear: 'B5' },
      result: '=IFERROR((C5/B5)-1,0)'
    }
  },

  cagr: {
    id: 'cagr',
    name: 'CAGR',
    category: 'statistical',
    description: 'Compound Annual Growth Rate',
    template: '=IFERROR(({endValue}/{startValue})^(1/{years})-1,0)',
    parameters: [
      { name: 'endValue', type: 'cell', description: 'Ending value', required: true },
      { name: 'startValue', type: 'cell', description: 'Starting value', required: true },
      { name: 'years', type: 'cell', description: 'Number of years', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { endValue: 'G5', startValue: 'B5', years: '5' },
      result: '=IFERROR((G5/B5)^(1/5)-1,0)'
    }
  },

  forecastLinear: {
    id: 'forecastLinear',
    name: 'Linear Forecast',
    category: 'statistical',
    description: 'Forecast using linear trend',
    template: '=FORECAST({targetX},{knownYs},{knownXs})',
    parameters: [
      { name: 'targetX', type: 'cell', description: 'X value to forecast for', required: true },
      { name: 'knownYs', type: 'range', description: 'Known Y values', required: true },
      { name: 'knownXs', type: 'range', description: 'Known X values', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { targetX: 'G1', knownYs: 'B5:F5', knownXs: 'B1:F1' },
      result: '=FORECAST(G1,B5:F5,B1:F1)'
    }
  },

  forecastGrowth: {
    id: 'forecastGrowth',
    name: 'Growth Rate Forecast',
    category: 'statistical',
    description: 'Forecast next period using growth rate',
    template: '={priorValue}*(1+{growthRate})',
    parameters: [
      { name: 'priorValue', type: 'cell', description: 'Prior period value', required: true },
      { name: 'growthRate', type: 'cell', description: 'Growth rate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { priorValue: 'B5', growthRate: '$B$2' },
      result: '=B5*(1+$B$2)'
    }
  },

  percentOfRevenue: {
    id: 'percentOfRevenue',
    name: 'Percent of Revenue',
    category: 'accounting',
    description: 'Calculate line item as percent of revenue',
    template: '={revenue}*{percentage}',
    parameters: [
      { name: 'revenue', type: 'cell', description: 'Revenue amount', required: true },
      { name: 'percentage', type: 'cell', description: 'Percentage assumption', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { revenue: 'C5', percentage: '$B$10' },
      result: '=C5*$B$10'
    }
  },

  // =============================================================================
  // SENSITIVITY ANALYSIS
  // =============================================================================

  sensitivityTable: {
    id: 'sensitivityTable',
    name: 'Sensitivity Table Reference',
    category: 'financial',
    description: 'Reference for data table sensitivity analysis',
    template: '={targetCell}',
    parameters: [
      { name: 'targetCell', type: 'cell', description: 'Cell to sensitize', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { targetCell: '$B$30' },
      result: '=$B$30'
    }
  },

  scenarioMultiplier: {
    id: 'scenarioMultiplier',
    name: 'Scenario Multiplier',
    category: 'financial',
    description: 'Apply scenario adjustment to base case',
    template: '={baseCase}*{scenarioFactor}',
    parameters: [
      { name: 'baseCase', type: 'cell', description: 'Base case value', required: true },
      { name: 'scenarioFactor', type: 'cell', description: 'Scenario adjustment factor', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { baseCase: 'C10', scenarioFactor: '$B$2' },
      result: '=C10*$B$2'
    }
  },

  // =============================================================================
  // DATE AND TIME
  // =============================================================================

  yearFraction: {
    id: 'yearFraction',
    name: 'Year Fraction',
    category: 'date',
    description: 'Calculate fraction of year between dates',
    template: '=YEARFRAC({startDate},{endDate},{basis})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'endDate', type: 'cell', description: 'End date', required: true },
      { name: 'basis', type: 'number', description: 'Day count basis (0=US 30/360)', required: false, defaultValue: '0' }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'B2', endDate: 'B3', basis: '0' },
      result: '=YEARFRAC(B2,B3,0)'
    }
  },

  monthEnd: {
    id: 'monthEnd',
    name: 'Month End Date',
    category: 'date',
    description: 'Get last day of month N months from start',
    template: '=EOMONTH({startDate},{months})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'months', type: 'number', description: 'Months to add', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'B2', months: '3' },
      result: '=EOMONTH(B2,3)'
    }
  },

  workingDays: {
    id: 'workingDays',
    name: 'Working Days',
    category: 'date',
    description: 'Count working days between dates',
    template: '=NETWORKDAYS({startDate},{endDate})',
    parameters: [
      { name: 'startDate', type: 'cell', description: 'Start date', required: true },
      { name: 'endDate', type: 'cell', description: 'End date', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { startDate: 'B2', endDate: 'B3' },
      result: '=NETWORKDAYS(B2,B3)'
    }
  },

  periodNumber: {
    id: 'periodNumber',
    name: 'Period Number',
    category: 'date',
    description: 'Calculate period number from dates',
    template: '=ROUND(({endDate}-{startDate})/365*{periodsPerYear},0)',
    parameters: [
      { name: 'endDate', type: 'cell', description: 'Period end date', required: true },
      { name: 'startDate', type: 'cell', description: 'Model start date', required: true },
      { name: 'periodsPerYear', type: 'number', description: 'Periods per year (12 for monthly)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { endDate: 'C1', startDate: '$B$1', periodsPerYear: '12' },
      result: '=ROUND((C1-$B$1)/365*12,0)'
    }
  },

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  iferrorZero: {
    id: 'iferrorZero',
    name: 'IFERROR with Zero',
    category: 'logical',
    description: 'Return zero if formula errors',
    template: '=IFERROR({formula},0)',
    parameters: [
      { name: 'formula', type: 'text', description: 'Formula to evaluate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { formula: 'B5/B10' },
      result: '=IFERROR(B5/B10,0)'
    }
  },

  iferrorBlank: {
    id: 'iferrorBlank',
    name: 'IFERROR with Blank',
    category: 'logical',
    description: 'Return blank if formula errors',
    template: '=IFERROR({formula},"")',
    parameters: [
      { name: 'formula', type: 'text', description: 'Formula to evaluate', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { formula: 'B5/B10' },
      result: '=IFERROR(B5/B10,"")'
    }
  },

  ifBlank: {
    id: 'ifBlank',
    name: 'IF Blank Check',
    category: 'logical',
    description: 'Return value if cell is blank, otherwise formula',
    template: '=IF({cell}="",{ifBlank},{ifNotBlank})',
    parameters: [
      { name: 'cell', type: 'cell', description: 'Cell to check', required: true },
      { name: 'ifBlank', type: 'text', description: 'Value if blank', required: true },
      { name: 'ifNotBlank', type: 'text', description: 'Value/formula if not blank', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { cell: 'B5', ifBlank: '0', ifNotBlank: 'B5*C5' },
      result: '=IF(B5="",0,B5*C5)'
    }
  },

  // =============================================================================
  // AGGREGATION WITH CONDITIONS
  // =============================================================================

  sumProduct: {
    id: 'sumProduct',
    name: 'SUMPRODUCT',
    category: 'aggregation',
    description: 'Sum of products of corresponding arrays',
    template: '=SUMPRODUCT({array1},{array2})',
    parameters: [
      { name: 'array1', type: 'range', description: 'First array', required: true },
      { name: 'array2', type: 'range', description: 'Second array', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { array1: 'B5:B10', array2: 'C5:C10' },
      result: '=SUMPRODUCT(B5:B10,C5:C10)'
    }
  },

  conditionalSum: {
    id: 'conditionalSum',
    name: 'Conditional SUMPRODUCT',
    category: 'aggregation',
    description: 'SUMPRODUCT with condition',
    template: '=SUMPRODUCT(({criteriaRange}={criteria})*{sumRange})',
    parameters: [
      { name: 'criteriaRange', type: 'range', description: 'Range to check criteria', required: true },
      { name: 'criteria', type: 'text', description: 'Criteria value', required: true },
      { name: 'sumRange', type: 'range', description: 'Range to sum', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { criteriaRange: 'A5:A20', criteria: '"Category1"', sumRange: 'B5:B20' },
      result: '=SUMPRODUCT((A5:A20="Category1")*B5:B20)'
    }
  },

  runningTotal: {
    id: 'runningTotal',
    name: 'Running Total',
    category: 'aggregation',
    description: 'Calculate cumulative sum',
    template: '=SUM({fixedStart}:{currentCell})',
    parameters: [
      { name: 'fixedStart', type: 'cell', description: 'First cell of range (absolute)', required: true },
      { name: 'currentCell', type: 'cell', description: 'Current cell (relative)', required: true }
    ],
    excelVersion: '2016',
    example: {
      params: { fixedStart: '$B$5', currentCell: 'B5' },
      result: '=SUM($B$5:B5)'
    }
  },

  // =============================================================================
  // ARRAY FORMULAS (365)
  // =============================================================================

  filterArray: {
    id: 'filterArray',
    name: 'FILTER Array',
    category: 'array',
    description: 'Filter array by condition',
    template: '=FILTER({array},{condition},{ifEmpty})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to filter', required: true },
      { name: 'condition', type: 'text', description: 'Boolean array/condition', required: true },
      { name: 'ifEmpty', type: 'text', description: 'Value if no results', required: false, defaultValue: '""' }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:C100', condition: 'B2:B100>0', ifEmpty: '"No data"' },
      result: '=FILTER(A2:C100,B2:B100>0,"No data")'
    }
  },

  sortArray: {
    id: 'sortArray',
    name: 'SORT Array',
    category: 'array',
    description: 'Sort array by column',
    template: '=SORT({array},{sortIndex},{sortOrder})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to sort', required: true },
      { name: 'sortIndex', type: 'number', description: 'Column index to sort by', required: false, defaultValue: '1' },
      { name: 'sortOrder', type: 'number', description: '1=ascending, -1=descending', required: false, defaultValue: '1' }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:C100', sortIndex: '2', sortOrder: '-1' },
      result: '=SORT(A2:C100,2,-1)'
    }
  },

  uniqueValues: {
    id: 'uniqueValues',
    name: 'UNIQUE Values',
    category: 'array',
    description: 'Get unique values from range',
    template: '=UNIQUE({array})',
    parameters: [
      { name: 'array', type: 'range', description: 'Array to get unique values from', required: true }
    ],
    excelVersion: '365',
    example: {
      params: { array: 'A2:A100' },
      result: '=UNIQUE(A2:A100)'
    }
  },

  sequenceGenerator: {
    id: 'sequenceGenerator',
    name: 'SEQUENCE',
    category: 'array',
    description: 'Generate sequence of numbers',
    template: '=SEQUENCE({rows},{cols},{start},{step})',
    parameters: [
      { name: 'rows', type: 'number', description: 'Number of rows', required: true },
      { name: 'cols', type: 'number', description: 'Number of columns', required: false, defaultValue: '1' },
      { name: 'start', type: 'number', description: 'Starting number', required: false, defaultValue: '1' },
      { name: 'step', type: 'number', description: 'Step increment', required: false, defaultValue: '1' }
    ],
    excelVersion: '365',
    example: {
      params: { rows: '10', cols: '1', start: '1', step: '1' },
      result: '=SEQUENCE(10,1,1,1)'
    }
  }
};

/**
 * Formula Pattern Library Class
 */
export class FormulaPatternLibrary {
  private patterns: Record<string, FormulaPattern> = formulaPatterns;

  /**
   * Get all patterns by category
   */
  getByCategory(category: FormulaCategory): FormulaPattern[] {
    return Object.values(this.patterns).filter(p => p.category === category);
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): FormulaPattern | undefined {
    return this.patterns[id];
  }

  /**
   * Build formula from pattern and parameters
   */
  buildFormula(patternId: string, params: Record<string, string>): string {
    const pattern = this.patterns[patternId];
    if (!pattern) {
      throw new Error(`Formula pattern not found: ${patternId}`);
    }

    let formula = pattern.template;

    // Apply default values for missing optional params
    for (const paramDef of pattern.parameters) {
      if (!params[paramDef.name] && !paramDef.required && paramDef.defaultValue) {
        params[paramDef.name] = paramDef.defaultValue;
      }
    }

    // Validate required params
    for (const paramDef of pattern.parameters) {
      if (paramDef.required && !params[paramDef.name]) {
        throw new Error(`Missing required parameter: ${paramDef.name} for formula ${patternId}`);
      }
    }

    // Substitute parameters
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        formula = formula.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
    }

    // Remove any remaining optional placeholders with empty values
    formula = formula.replace(/,\{[^}]+\}/g, '');
    formula = formula.replace(/\{[^}]+\}/g, '');

    // Clean up any double commas or trailing commas
    formula = formula.replace(/,,+/g, ',');
    formula = formula.replace(/,\)/g, ')');

    return formula;
  }

  /**
   * Validate a formula pattern application
   */
  validateFormula(patternId: string, params: Record<string, string>): ValidationResult {
    const pattern = this.patterns[patternId];
    if (!pattern) {
      return { valid: false, error: `Unknown pattern: ${patternId}` };
    }

    const warnings: string[] = [];

    // Check required params
    for (const paramDef of pattern.parameters) {
      if (paramDef.required && !params[paramDef.name]) {
        return { valid: false, error: `Missing required parameter: ${paramDef.name}` };
      }
    }

    // Run custom validation if defined
    if (pattern.validation) {
      return pattern.validation(params);
    }

    // Basic cell reference validation
    for (const [key, value] of Object.entries(params)) {
      if (value && !this.isValidCellReference(value) && !this.isValidRange(value) && !this.isNumericOrText(value)) {
        warnings.push(`Parameter ${key} may have invalid format: ${value}`);
      }
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Get all available pattern IDs for AI reference
   */
  getAllPatternIds(): string[] {
    return Object.keys(this.patterns);
  }

  /**
   * Get pattern summary for AI context
   */
  getPatternSummary(): string {
    let summary = 'Available Excel Formula Patterns:\n\n';

    const categories = Array.from(new Set(Object.values(this.patterns).map(p => p.category)));

    for (const category of categories) {
      summary += `## ${category.toUpperCase()}\n`;
      const categoryPatterns = this.getByCategory(category);
      for (const pattern of categoryPatterns) {
        summary += `- **${pattern.id}**: ${pattern.name} - ${pattern.description}\n`;
        summary += `  Template: \`${pattern.template}\`\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * Helper: Check if string is valid cell reference
   */
  private isValidCellReference(value: string): boolean {
    // Matches: A1, $A$1, Sheet1!A1, 'Sheet Name'!$A$1
    return /^('?[\w\s]+'?!)?(\$?[A-Z]+\$?\d+)$/.test(value);
  }

  /**
   * Helper: Check if string is valid range
   */
  private isValidRange(value: string): boolean {
    // Matches: A1:B10, $A$1:$B$10, Sheet1!A:A, 'Sheet Name'!A1:Z100
    return /^('?[\w\s]+'?!)?(\$?[A-Z]+\$?\d*:\$?[A-Z]+\$?\d*)$/.test(value);
  }

  /**
   * Helper: Check if string is numeric or quoted text
   */
  private isNumericOrText(value: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(value) || /^".*"$/.test(value) || value === 'TRUE' || value === 'FALSE';
  }
}

export const formulaPatternLibrary = new FormulaPatternLibrary();
