/**
 * Excel Generation Test Suite
 * 
 * Runtime tests for the AI-driven Excel model generation system.
 * Run with: npx ts-node server/services/excel/excelTests.ts
 */

import { formulaPatternLibrary } from './formulaPatternLibrary';
import { ExcelWorkbookBuilder, ExcelWorkbookSpec } from './excelWorkbookBuilder';
import { excelSpecValidator, SafeJSONParser } from './excelSpecValidator';
import { FormulaBuilder, formulaSanitizer, commonFormulas } from './fallbackFormulaGenerator';
import { excelModelPromptBuilder } from './excelModelPromptBuilder';

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  const start = Date.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          results.push({ name, passed: true, duration: Date.now() - start });
          console.log(`✅ ${name}`);
        })
        .catch((e: Error) => {
          results.push({ name, passed: false, error: e.message, duration: Date.now() - start });
          console.log(`❌ ${name}: ${e.message}`);
        });
    } else {
      results.push({ name, passed: true, duration: Date.now() - start });
      console.log(`✅ ${name}`);
    }
  } catch (e: any) {
    results.push({ name, passed: false, error: e.message, duration: Date.now() - start });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// =============================================================================
// FORMULA PATTERN LIBRARY TESTS
// =============================================================================

console.log('\n📊 FORMULA PATTERN LIBRARY TESTS\n');

test('NPV formula builds correctly', () => {
  const formula = formulaPatternLibrary.buildFormula('npv', {
    rate: 'B2',
    cashFlowRange: 'C5:C10',
    initialInvestment: 'C4'
  });
  assertEqual(formula, '=NPV(B2,C5:C10)+C4', 'NPV formula');
});

test('IRR formula builds correctly', () => {
  const formula = formulaPatternLibrary.buildFormula('irr', {
    cashFlowRange: 'B4:B10'
  });
  // Should include default guess
  assert(formula.includes('IRR(B4:B10'), 'IRR formula should contain range');
});

test('PMT formula builds correctly', () => {
  const formula = formulaPatternLibrary.buildFormula('pmt', {
    rate: 'B2/12',
    nper: 'B3*12',
    pv: 'B4'
  });
  assert(formula.includes('PMT'), 'PMT formula should contain PMT function');
  assert(formula.includes('B2/12'), 'PMT should contain rate');
});

test('WACC formula builds correctly', () => {
  const formula = formulaPatternLibrary.buildFormula('wacc', {
    equityWeight: 'B5',
    debtWeight: 'B6',
    costOfEquity: 'B7',
    costOfDebt: 'B8',
    taxRate: 'B9'
  });
  assert(formula.includes('(1-B9)'), 'WACC should include tax shield');
});

test('Missing required parameter throws error', () => {
  try {
    formulaPatternLibrary.buildFormula('npv', {
      rate: 'B2'
      // Missing cashFlowRange and initialInvestment
    });
    throw new Error('Should have thrown');
  } catch (e: any) {
    assert(e.message.includes('Missing required parameter'), 'Should throw for missing param');
  }
});

test('Pattern validation works', () => {
  const result = formulaPatternLibrary.validateFormula('npv', {
    rate: 'B2',
    cashFlowRange: 'C5:C10',
    initialInvestment: 'C4'
  });
  assert(result.valid, 'Valid params should pass validation');
});

test('Get by category returns correct patterns', () => {
  const financial = formulaPatternLibrary.getByCategory('financial');
  assert(financial.length > 10, 'Should have many financial patterns');
  assert(financial.every(p => p.category === 'financial'), 'All should be financial');
});

test('All patterns have required fields', () => {
  const allIds = formulaPatternLibrary.getAllPatternIds();
  for (const id of allIds) {
    const pattern = formulaPatternLibrary.getPattern(id);
    assert(pattern !== undefined, `Pattern ${id} should exist`);
    assert(pattern!.template.length > 0, `Pattern ${id} should have template`);
    assert(pattern!.parameters.length > 0 || pattern!.template.includes('='), 
      `Pattern ${id} should have params or be simple formula`);
  }
});

// =============================================================================
// FORMULA BUILDER TESTS
// =============================================================================

console.log('\n🔧 FORMULA BUILDER TESTS\n');

test('FormulaBuilder creates simple formula', () => {
  const result = new FormulaBuilder()
    .ref('A1')
    .op('+')
    .ref('B1')
    .build();
  
  assert(result.success, 'Should succeed');
  assert(result.formula?.startsWith('=') === true, 'Should start with =');
  assert(result.formula?.includes('A1+B1') === true, 'Should contain refs');
});

test('FormulaBuilder creates function formula', () => {
  const result = new FormulaBuilder()
    .fn('SUM', 'A1:A10')
    .build();
  
  assert(result.success, 'Should succeed');
  assertEqual(result.formula, '=SUM(A1:A10)', 'SUM formula');
});

test('FormulaBuilder wraps risky formulas with IFERROR', () => {
  const result = new FormulaBuilder()
    .ref('A1')
    .op('/')
    .ref('B1')
    .build();
  
  assert(result.success, 'Should succeed');
  assert(result.safetyWrapped === true, 'Division should be safety wrapped');
  assert(result.formula?.includes('IFERROR') === true, 'Should include IFERROR');
});

test('FormulaBuilder rejects disallowed functions', () => {
  const result = new FormulaBuilder()
    .fn('MALICIOUS_FUNC', 'A1')
    .build();
  
  // Should have warning about disallowed function
  assert(result.warnings?.some(w => w.includes('not in the allowed list')) === true, 
    'Should warn about disallowed function');
});

test('FormulaBuilder validates cell references', () => {
  const builder = new FormulaBuilder()
    .ref('INVALID!!REF')
    .build();
  
  assert(builder.warnings?.some(w => w.includes('Invalid cell')) === true, 
    'Should warn about invalid ref');
});

test('FormulaBuilder handles parentheses', () => {
  const result = new FormulaBuilder()
    .open()
    .ref('A1')
    .op('+')
    .ref('B1')
    .close()
    .op('*')
    .ref('C1')
    .build();
  
  assert(result.success, 'Should succeed');
  assert(result.formula?.includes('(A1+B1)*C1') === true, 'Should have correct structure');
});

test('FormulaBuilder detects unbalanced parentheses', () => {
  const result = new FormulaBuilder()
    .open()
    .ref('A1')
    .build();
  
  assert(!result.success, 'Should fail for unbalanced parens');
});

// =============================================================================
// FORMULA SANITIZER TESTS
// =============================================================================

console.log('\n🛡️ FORMULA SANITIZER TESTS\n');

test('Sanitizer accepts valid formulas', () => {
  const result = formulaSanitizer.sanitize('=SUM(A1:A10)');
  assert(result.success, 'Should accept valid formula');
  assertEqual(result.formula, '=SUM(A1:A10)', 'Should preserve formula');
});

test('Sanitizer adds = prefix if missing', () => {
  const result = formulaSanitizer.sanitize('SUM(A1:A10)');
  assert(result.success, 'Should succeed');
  assert(result.formula?.startsWith('=') === true, 'Should add = prefix');
});

test('Sanitizer removes markdown code fences', () => {
  const result = formulaSanitizer.sanitize('```=SUM(A1:A10)```');
  assert(result.success, 'Should succeed');
  assert(!result.formula?.includes('```'), 'Should remove fences');
});

test('Sanitizer rejects dangerous functions', () => {
  const result = formulaSanitizer.sanitize('=CALL("kernel32","system","hello")');
  assert(!result.success, 'Should reject CALL');
});

test('Sanitizer rejects file protocol', () => {
  const result = formulaSanitizer.sanitize('=file://malicious/path');
  assert(!result.success, 'Should reject file protocol');
});

test('Sanitizer fixes unbalanced parentheses when possible', () => {
  const result = formulaSanitizer.sanitize('=SUM(A1:A10');
  assert(result.success, 'Should succeed with fix');
  assert(result.warnings?.some(w => w.includes('parentheses')) === true, 'Should warn about fix');
});

test('Common formula helpers work', () => {
  const ratio = commonFormulas.ratio('A1', 'B1');
  assert(ratio.includes('IFERROR'), 'ratio should use IFERROR');
  
  const yoy = commonFormulas.yoyGrowth('C5', 'B5');
  assert(yoy.includes('IFERROR'), 'yoy should use IFERROR');
  assert(yoy.includes('-1'), 'yoy should subtract 1');
});

// =============================================================================
// SPEC VALIDATOR TESTS
// =============================================================================

console.log('\n✅ SPEC VALIDATOR TESTS\n');

test('Validator accepts valid spec', () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test Workbook', author: 'Test' },
    sheets: [{
      name: 'Sheet1',
      purpose: 'calculations',
      cells: [
        { cell: 'A1', type: 'header', value: 'Header' },
        { cell: 'A2', type: 'input', value: 100 },
        { cell: 'A3', type: 'formula', formula: '=A2*2' }
      ]
    }],
    globalStyles: {
      defaultFont: { name: 'Calibri', size: 11 }
    }
  };
  
  const result = excelSpecValidator.validate(spec);
  assert(result.valid, 'Valid spec should pass');
});

test('Validator catches missing sheets', () => {
  const spec = {
    metadata: { title: 'Test' },
    sheets: []
  };
  
  const result = excelSpecValidator.validate(spec);
  assert(!result.valid, 'Should fail for empty sheets');
  assert(result.errors.some(e => e.code === 'EMPTY_SHEETS'), 'Should have EMPTY_SHEETS error');
});

test('Validator catches duplicate sheet names', () => {
  const spec = {
    metadata: { title: 'Test' },
    sheets: [
      { name: 'Sheet1', cells: [{ cell: 'A1', value: 1 }] },
      { name: 'Sheet1', cells: [{ cell: 'A1', value: 2 }] }
    ]
  };
  
  const result = excelSpecValidator.validate(spec);
  // With autofix, it should fix the duplicate
  assert(result.fixes.some(f => f.code === 'DUPLICATE_SHEET'), 'Should fix duplicate sheets');
});

test('Validator catches unbalanced parentheses in formulas', () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test', author: 'Test' },
    sheets: [{
      name: 'Sheet1',
      purpose: 'calculations',
      cells: [
        { cell: 'A1', type: 'formula', formula: '=SUM(A2:A10' }
      ]
    }],
    globalStyles: { defaultFont: { name: 'Calibri', size: 11 } }
  };
  
  const result = excelSpecValidator.validate(spec);
  assert(result.errors.some(e => e.code === 'UNBALANCED_PARENS'), 'Should catch unbalanced parens');
});

test('Validator catches formula cells without formulas', () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test', author: 'Test' },
    sheets: [{
      name: 'Sheet1',
      purpose: 'calculations',
      cells: [
        { cell: 'A1', type: 'formula' } // No formula!
      ]
    }],
    globalStyles: { defaultFont: { name: 'Calibri', size: 11 } }
  };
  
  const result = excelSpecValidator.validate(spec);
  assert(result.errors.some(e => e.code === 'FORMULA_CELL_NO_FORMULA'), 'Should catch missing formula');
});

test('Validator auto-fixes missing metadata', () => {
  const spec = {
    sheets: [{
      name: 'Sheet1',
      cells: [{ cell: 'A1', value: 1 }]
    }]
  };
  
  const { result, spec: fixed } = excelSpecValidator.validateAndFix(spec);
  assert(result.fixes.some(f => f.code === 'MISSING_METADATA'), 'Should fix missing metadata');
  assert(fixed?.metadata !== undefined, 'Should have metadata');
});

// =============================================================================
// SAFE JSON PARSER TESTS
// =============================================================================

console.log('\n📝 SAFE JSON PARSER TESTS\n');

test('SafeJSONParser parses valid JSON', () => {
  const result = SafeJSONParser.parse('{"key": "value"}');
  assert(result.success, 'Should parse valid JSON');
  assertEqual(result.data.key, 'value', 'Should have correct value');
});

test('SafeJSONParser extracts JSON from markdown', () => {
  const result = SafeJSONParser.parse('```json\n{"key": "value"}\n```');
  assert(result.success, 'Should parse markdown JSON');
  assert(result.recovered === true, 'Should be marked as recovered');
});

test('SafeJSONParser fixes trailing commas', () => {
  const result = SafeJSONParser.parse('{"key": "value",}');
  assert(result.success, 'Should fix trailing comma');
  assert(result.recovered === true, 'Should be marked as recovered');
});

test('SafeJSONParser extracts JSON from surrounding text', () => {
  const result = SafeJSONParser.parse('Here is the JSON: {"key": "value"} - end');
  assert(result.success, 'Should extract embedded JSON');
});

test('SafeJSONParser reports errors for invalid JSON', () => {
  const result = SafeJSONParser.parse('not json at all');
  assert(!result.success, 'Should fail for non-JSON');
  assert(result.error !== undefined, 'Should have error message');
});

// =============================================================================
// PROMPT BUILDER TESTS
// =============================================================================

console.log('\n📝 PROMPT BUILDER TESTS\n');

test('Model type detection works for DCF', () => {
  const type = excelModelPromptBuilder.detectModelType('Build me a DCF valuation model for Apple');
  assertEqual(type, 'dcf', 'Should detect DCF');
});

test('Model type detection works for LBO', () => {
  const type = excelModelPromptBuilder.detectModelType('Create a leveraged buyout model');
  assertEqual(type, 'lbo', 'Should detect LBO');
});

test('Model type detection works for budget', () => {
  const type = excelModelPromptBuilder.detectModelType('I need a budget template for my startup');
  assertEqual(type, 'budget', 'Should detect budget');
});

test('Model type detection works for loan amortization', () => {
  const type = excelModelPromptBuilder.detectModelType('Create a loan amortization schedule');
  assertEqual(type, 'loan-amortization', 'Should detect loan');
});

test('Prompt includes unique context for anti-caching', () => {
  const { userPrompt: prompt1 } = excelModelPromptBuilder.buildSinglePrompt({
    userQuery: 'Create a DCF model'
  });
  
  const { userPrompt: prompt2 } = excelModelPromptBuilder.buildSinglePrompt({
    userQuery: 'Create a DCF model'
  });
  
  assert(prompt1 !== prompt2, 'Same query should produce different prompts (anti-caching)');
});

test('Multi-stage prompts are different', () => {
  const stages = excelModelPromptBuilder.buildPrompts({
    userQuery: 'Create a DCF model'
  });
  
  assert(stages.length >= 3, 'Should have at least 3 stages');
  assert(stages[0].systemPrompt !== stages[1].systemPrompt, 
    'Stage prompts should be different');
  assert(stages[1].systemPrompt !== stages[2].systemPrompt, 
    'Stage prompts should be different');
});

// =============================================================================
// WORKBOOK BUILDER TESTS
// =============================================================================

console.log('\n📗 WORKBOOK BUILDER TESTS\n');

test('WorkbookBuilder creates workbook from simple spec', async () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test', author: 'Test' },
    sheets: [{
      name: 'Data',
      purpose: 'inputs',
      cells: [
        { cell: 'A1', type: 'header', value: 'Amount' },
        { cell: 'A2', type: 'input', value: 100 },
        { cell: 'A3', type: 'input', value: 200 },
        { cell: 'A4', type: 'formula', formula: '=SUM(A2:A3)' }
      ]
    }],
    globalStyles: {
      defaultFont: { name: 'Calibri', size: 11 }
    }
  };
  
  const builder = new ExcelWorkbookBuilder();
  const result = await builder.build(spec);
  
  assert(result.success, 'Should succeed');
  assert(result.buffer !== undefined, 'Should have buffer');
  assert(result.stats.sheetsCreated === 1, 'Should create 1 sheet');
  assert(result.stats.formulasApplied >= 1, 'Should have formulas');
});

test('WorkbookBuilder applies formula patterns', async () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test', author: 'Test' },
    sheets: [{
      name: 'Analysis',
      purpose: 'calculations',
      cells: [
        { cell: 'A1', type: 'header', value: 'Discount Rate' },
        { cell: 'B1', type: 'input', value: 0.1 },
        { cell: 'A2', type: 'header', value: 'Cash Flows' },
        { cell: 'B2', type: 'input', value: -1000 },
        { cell: 'B3', type: 'input', value: 300 },
        { cell: 'B4', type: 'input', value: 400 },
        { cell: 'B5', type: 'input', value: 500 },
        { cell: 'A6', type: 'header', value: 'NPV' },
        { 
          cell: 'B6', 
          type: 'formula',
          formulaPattern: {
            patternId: 'npv',
            params: {
              rate: 'B1',
              cashFlowRange: 'B3:B5',
              initialInvestment: 'B2'
            }
          }
        }
      ]
    }],
    globalStyles: {

      defaultFont: { name: 'Calibri', size: 11 }
    }
  };
  
  const builder = new ExcelWorkbookBuilder();
  const result = await builder.build(spec);
  
  assert(result.success, 'Should succeed');
  assert(result.stats.formulasApplied >= 1, 'Should apply formula pattern');
});

test('WorkbookBuilder creates named ranges', async () => {
  const spec: ExcelWorkbookSpec = {
    metadata: { title: 'Test', author: 'Test' },
    sheets: [{
      name: 'Data',
      purpose: 'inputs',
      cells: [
        { cell: 'A1', type: 'input', value: 0.1, name: 'DiscountRate' }
      ]
    }],
    namedRanges: [
      { name: 'DiscountRate', range: 'Data!A1', scope: 'workbook' }
    ],
    globalStyles: {
      defaultFont: { name: 'Calibri', size: 11 }
    }
  };
  
  const builder = new ExcelWorkbookBuilder();
  const result = await builder.build(spec);
  
  assert(result.success, 'Should succeed');
  assert(result.stats.namedRangesCreated >= 1, 'Should create named range');
});

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function runTests() {
  // Wait a moment for async tests to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
  }
  
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\n⏱️ Total time: ${totalTime}ms`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
