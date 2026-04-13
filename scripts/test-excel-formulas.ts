/**
 * Test script to verify Excel formula generation works correctly
 * Run with: npx ts-node scripts/test-excel-formulas.ts
 */
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testExcelFormulas() {
  console.log('Testing Excel formula generation...\n');
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ICAI CAGPT Test';
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet('Formula Test', {
    properties: { tabColor: { argb: 'FF1E40AF' } }
  });
  
  // Set column widths
  sheet.columns = [
    { header: 'Description', key: 'description', width: 25 },
    { header: 'Value', key: 'value', width: 15 },
    { header: 'Calculated', key: 'calculated', width: 15 }
  ];
  
  // Add header row
  sheet.getRow(1).font = { bold: true, size: 12 };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  // Add data rows with values
  sheet.getCell('A2').value = 'Revenue';
  sheet.getCell('B2').value = 100000;
  sheet.getCell('B2').numFmt = '$#,##0.00';
  
  sheet.getCell('A3').value = 'Expenses';
  sheet.getCell('B3').value = 60000;
  sheet.getCell('B3').numFmt = '$#,##0.00';
  
  sheet.getCell('A4').value = 'Tax Rate';
  sheet.getCell('B4').value = 0.21;
  sheet.getCell('B4').numFmt = '0.00%';
  
  // Add formula cells - this is the key test
  sheet.getCell('A5').value = 'Net Income';
  sheet.getCell('B5').value = { formula: 'B2-B3' };
  sheet.getCell('B5').numFmt = '$#,##0.00';
  sheet.getCell('B5').font = { bold: true };
  
  sheet.getCell('A6').value = 'Tax Amount';
  sheet.getCell('B6').value = { formula: 'B5*B4' };
  sheet.getCell('B6').numFmt = '$#,##0.00';
  
  sheet.getCell('A7').value = 'After-Tax Income';
  sheet.getCell('B7').value = { formula: 'B5-B6' };
  sheet.getCell('B7').numFmt = '$#,##0.00';
  sheet.getCell('B7').font = { bold: true };
  sheet.getCell('B7').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB3B' }
  };
  
  // Add a SUM formula
  sheet.getCell('A9').value = 'Total (SUM test)';
  sheet.getCell('B9').value = { formula: 'SUM(B2:B3)' };
  sheet.getCell('B9').numFmt = '$#,##0.00';
  
  // Add IF formula
  sheet.getCell('A10').value = 'Profit Check';
  sheet.getCell('B10').value = { formula: 'IF(B5>0,"Profit","Loss")' };
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'test-formulas.xlsx');
  
  // Method 1: Write directly to file
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✓ Excel file written to: ${outputPath}`);
  
  // Method 2: Also test writeBuffer (same method used in production)
  const buffer = await workbook.xlsx.writeBuffer();
  const bufferPath = path.join(__dirname, '..', 'test-formulas-buffer.xlsx');
  fs.writeFileSync(bufferPath, Buffer.from(buffer));
  console.log(`✓ Excel file from buffer written to: ${bufferPath}`);
  
  // Now read back and verify formulas
  console.log('\nVerifying formulas in generated file...');
  const readWorkbook = new ExcelJS.Workbook();
  await readWorkbook.xlsx.readFile(outputPath);
  
  const readSheet = readWorkbook.getWorksheet('Formula Test');
  if (!readSheet) {
    console.error('✗ Could not find worksheet');
    return;
  }
  
  // Check formulas
  const cellB5 = readSheet.getCell('B5');
  const cellB6 = readSheet.getCell('B6');
  const cellB7 = readSheet.getCell('B7');
  const cellB9 = readSheet.getCell('B9');
  const cellB10 = readSheet.getCell('B10');
  
  console.log('\nCell B5 (Net Income):');
  console.log('  Value type:', typeof cellB5.value);
  console.log('  Value:', JSON.stringify(cellB5.value));
  console.log('  Formula:', cellB5.formula);
  
  console.log('\nCell B6 (Tax Amount):');
  console.log('  Value type:', typeof cellB6.value);
  console.log('  Value:', JSON.stringify(cellB6.value));
  console.log('  Formula:', cellB6.formula);
  
  console.log('\nCell B7 (After-Tax):');
  console.log('  Value type:', typeof cellB7.value);
  console.log('  Value:', JSON.stringify(cellB7.value));
  console.log('  Formula:', cellB7.formula);
  
  console.log('\nCell B9 (SUM):');
  console.log('  Value type:', typeof cellB9.value);
  console.log('  Value:', JSON.stringify(cellB9.value));
  console.log('  Formula:', cellB9.formula);
  
  console.log('\nCell B10 (IF):');
  console.log('  Value type:', typeof cellB10.value);
  console.log('  Value:', JSON.stringify(cellB10.value));
  console.log('  Formula:', cellB10.formula);
  
  // Summary
  const formulaCount = [cellB5, cellB6, cellB7, cellB9, cellB10]
    .filter(cell => cell.formula)
    .length;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Formula test complete: ${formulaCount}/5 formulas detected`);
  console.log(`${'='.repeat(50)}`);
  
  if (formulaCount === 5) {
    console.log('\n✓ All formulas are correctly stored in the Excel file.');
    console.log('\nIMPORTANT: When opening in Excel/LibreOffice, formulas should work.');
    console.log('If formulas show as values, it may be an Excel recalculation setting issue.');
  } else {
    console.log('\n✗ Some formulas are missing. There may be an issue with formula storage.');
  }
  
  console.log('\nTest files created:');
  console.log(`  1. ${outputPath}`);
  console.log(`  2. ${bufferPath}`);
  console.log('\nPlease open these files in Microsoft Excel or LibreOffice Calc to verify formulas.');
}

testExcelFormulas().catch(console.error);
