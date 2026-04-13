import 'dotenv/config';
import { aiOrchestrator } from '../server/services/aiOrchestrator';
import { vbaGenerator } from '../server/services/excel/vbaGenerator';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('🚀 Starting Excel Capability Demonstration\n');
  console.log('--------------------------------------------------');
  console.log('Target: Demonstrate Formula Injection & VBA Generation');
  console.log('--------------------------------------------------');

  // 1. Full Orchestrator Scenarios (Workbook Logic)
  const workbookScenarios = [
    {
      name: "Complex NPV & IRR Calculation",
      description: "Tests basic financial formulas (NPV, IRR) and cell referencing.",
      query: "Calculate the NPV of a capital project with initial investment ,000, and cash flows of ,000 for years 1-3 and ,000 for years 4-5 at 8% discount rate. Also calculate IRR and payback period."
    },
    {
      name: "Loan Amortization Schedule",
      description: "Tests row expansion and payment formulas (PMT, IPMT, PPMT).",
      query: "Create a loan amortization schedule for a ,200,000 commercial loan at 5.5% annual interest rate for 30 years. Calculate monthly payment and total interest."
    },
    {
      name: "Advanced Search (XLOOKUP)",
      description: "Tests advanced lookup formulas capabilities.",
      query: "Create a product inventory sheet. Use XLOOKUP to find the price of 'Widget A' from a price list and calculate total value based on stock quantity."
    }
  ];

  for (const scenario of workbookScenarios) {
    console.log(`\n🧪 Testing Scenario: ${scenario.name}`);
    console.log(`   Query: "${scenario.query}"`);

    try {
      const startTime = Date.now();
      const result = await aiOrchestrator.processQuery(
        scenario.query,
        [], // Empty history
        'enterprise', // Tier
        'test-user-id',
        { chatMode: 'calculation' }
      );
      const duration = Date.now() - startTime;

      console.log(`   ✅ Response Received in ${duration}ms`);
      
      if (result.excelWorkbook) {
        console.log(`   📗 Excel Workbook Generated: ${result.excelWorkbook.filename}`);
        console.log(`      Summary: ${result.excelWorkbook.summary}`);
        // Save the file for evidence
        const outputPath = path.join(process.cwd(), `demo_output_${scenario.name.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
        fs.writeFileSync(outputPath, result.excelWorkbook.buffer);
        console.log(`      💾 Saved to: ${outputPath}`);
      } else {
        console.log(`   ⚠️  No Excel Workbook generated.`);
      }

      if (result.calculationResults) {
        console.log(`   📊 structured data present.`);
      }
    } catch (error) {
      console.error(`   ❌ Error in scenario ${scenario.name}:`, error);
    }
  }

  // 2. Direct VBA Generator Test
  console.log(`\n--------------------------------------------------`);
  console.log(`🧪 Testing Scenario: VBA Macro Generation`);
  console.log(`--------------------------------------------------`);
  
  const vbaScenarios = [
    {
      type: 'dcf',
      prompt: 'Generate a VBA macro to calculate Discounted Cash Flow.'
    },
    {
      type: 'userform',
      prompt: 'Create a UserForm for data entry of employee expenses.'
    }
  ];

  for (const vbaTest of vbaScenarios) {
    console.log(`\n   📝 Generating VBA for: ${vbaTest.type}`);
    try {
      const startTime = Date.now();
      let code = "";
      
      if (vbaTest.type === 'dcf') {
        const macros = await vbaGenerator.generateFinancialModelMacros('dcf');
        code = macros[0]?.code || "";
      } else {
        const result = await vbaGenerator.generateMacro({
            prompt: vbaTest.prompt,
            macroType: 'userform',
            complexity: 'moderate'
        });
        code = result.code;
      }
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ VBA Generated in ${duration}ms`);
      console.log(`   📜 Code Preview (First 5 lines):`);
      console.log(code.split('\n').slice(0, 5).map(l => `      ${l}`).join('\n'));
      console.log(`      ... (${code.split('\n').length} lines total)`);
      
    } catch (error) {
         console.error(`   ❌ Error generating VBA:`, error);
    }
  }

  console.log('\n🚀 Excel Capability Demonstration Complete');
}

runTest().catch(console.error);
