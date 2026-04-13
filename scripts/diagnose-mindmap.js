#!/usr/bin/env node
/**
 * Mindmap Diagnostic Tool
 * Tests all components of the mindmap system to identify issues
 */

import http from 'http';

const API_BASE = process.env.API_URL || 'http://localhost:5000';
const TEST_CASES = [
  {
    name: 'Deep Research - FIFO Method',
    mode: 'deep-research',
    query: 'Explain the FIFO inventory method structure'
  },
  {
    name: 'Calculation - NPV Steps',
    mode: 'calculation',
    query: 'Show me the steps to calculate NPV'
  },
  {
    name: 'Workflow - Month End Close',
    mode: 'workflow',
    query: 'Explain the month-end close process'
  },
  {
    name: 'Audit Plan - Risk Assessment',
    mode: 'audit-plan',
    query: 'Create an audit plan framework'
  }
];

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runDiagnostics() {
  console.log('🔍 Starting Mindmap System Diagnostics...\n');
  console.log(`Testing against: ${API_BASE}\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];

  // Test 1: Health Check
  console.log('📋 Test 1: System Health Check');
  try {
    const result = await makeRequest('GET', '/api/test-mindmap/health');
    totalTests++;
    if (result.status === 200 && result.data.status === 'healthy') {
      console.log('✅ PASS: System is healthy');
      console.log(`   - ${result.data.modes.length} modes configured`);
      passedTests++;
    } else {
      console.log('❌ FAIL: System health check failed');
      failedTests.push({ test: 'Health Check', error: 'Unhealthy status' });
    }
  } catch (error) {
    totalTests++;
    console.log('❌ FAIL: Cannot reach API endpoint');
    console.log(`   Error: ${error.message}`);
    failedTests.push({ test: 'Health Check', error: error.message });
  }
  console.log('');

  // Test 2: Trigger Detection
  console.log('📋 Test 2: Trigger Detection');
  for (const testCase of TEST_CASES.slice(0, 2)) {
    try {
      const result = await makeRequest('POST', '/api/test-mindmap/trigger', {
        query: testCase.query,
        mode: testCase.mode
      });
      totalTests++;
      
      if (result.status === 200 && result.data.shouldTrigger) {
        console.log(`✅ PASS: ${testCase.name}`);
        console.log(`   - Triggers: ${result.data.modeConfig?.automaticTriggers?.join(', ')}`);
        passedTests++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        console.log(`   - Should trigger: ${result.data.shouldTrigger}`);
        failedTests.push({ test: `Trigger: ${testCase.name}`, error: 'Not triggering' });
      }
    } catch (error) {
      totalTests++;
      console.log(`❌ FAIL: ${testCase.name} - ${error.message}`);
      failedTests.push({ test: `Trigger: ${testCase.name}`, error: error.message });
    }
  }
  console.log('');

  // Test 3: Example Generation
  console.log('📋 Test 3: Example Generation');
  try {
    const result = await makeRequest('GET', '/api/test-mindmap/example/deep-research');
    totalTests++;
    
    if (result.status === 200 && result.data.mindmap) {
      console.log('✅ PASS: Example mindmap generated');
      console.log(`   - Nodes: ${result.data.stats.nodeCount}`);
      console.log(`   - Edges: ${result.data.stats.edgeCount}`);
      console.log(`   - Layout: ${result.data.stats.layout}`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Example generation failed');
      failedTests.push({ test: 'Example Generation', error: 'No mindmap returned' });
    }
  } catch (error) {
    totalTests++;
    console.log(`❌ FAIL: ${error.message}`);
    failedTests.push({ test: 'Example Generation', error: error.message });
  }
  console.log('');

  // Test 4: Validation
  console.log('📋 Test 4: Validation System');
  const testMindmap = {
    type: 'mindmap',
    title: 'Test Mindmap',
    nodes: [
      { id: '1', label: 'Root', type: 'root' },
      { id: '2', label: 'Child', type: 'primary' }
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' }
    ],
    layout: 'radial'
  };
  
  try {
    const result = await makeRequest('POST', '/api/test-mindmap/validate', {
      mindmap: testMindmap
    });
    totalTests++;
    
    if (result.status === 200 && result.data.valid) {
      console.log('✅ PASS: Validation working correctly');
      console.log(`   - Valid structure detected`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Validation rejected valid mindmap');
      console.log(`   Errors: ${JSON.stringify(result.data.errors)}`);
      failedTests.push({ test: 'Validation', error: 'False negative' });
    }
  } catch (error) {
    totalTests++;
    console.log(`❌ FAIL: ${error.message}`);
    failedTests.push({ test: 'Validation', error: error.message });
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests.length}`);
  console.log('');

  if (failedTests.length > 0) {
    console.log('❌ FAILED TESTS:');
    failedTests.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
    console.log('');
  }

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - System is operational!');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Try a real query in the UI');
    console.log('   2. Check browser console for frontend errors');
    console.log('   3. Verify ReactFlow components are rendering');
  } else {
    console.log('⚠️  SYSTEM ISSUES DETECTED');
    console.log('');
    console.log('💡 Troubleshooting Steps:');
    console.log('   1. Verify server is running on port 5000');
    console.log('   2. Check server logs for errors');
    console.log('   3. Ensure all dependencies are installed');
    console.log('   4. Verify database migrations are up to date');
  }
  console.log('');
}

// Run diagnostics
runDiagnostics().catch(console.error);
