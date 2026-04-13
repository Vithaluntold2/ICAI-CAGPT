#!/usr/bin/env node
/**
 * Mindmap System Test Suite
 * Tests all components of the mindmap visualization system
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`),
};

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response.json();
}

async function testHealthCheck() {
  log.section('Health Check');
  try {
    const result = await request('/api/test-mindmap/health');
    log.success(`System status: ${result.status}`);
    log.info(`Modes configured: ${result.modes.filter(m => m.hasConfig).length}/10`);
    
    result.modes.forEach(mode => {
      if (mode.hasConfig) {
        log.success(`  ${mode.mode}: ${mode.triggerCount} triggers`);
      } else {
        log.error(`  ${mode.mode}: No configuration`);
      }
    });
    return true;
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testTriggerDetection() {
  log.section('Trigger Detection Tests');
  
  const tests = [
    { mode: 'deep-research', query: 'Explain the FIFO inventory method', expect: true },
    { mode: 'deep-research', query: 'What is the tax rate?', expect: false },
    { mode: 'calculation', query: 'Calculate NPV step by step', expect: true },
    { mode: 'audit-plan', query: 'Create audit plan structure', expect: true },
    { mode: 'workflow', query: 'Explain the workflow process', expect: true },
    { mode: 'standard', query: 'Hello', expect: false },
  ];
  
  let passed = 0;
  for (const test of tests) {
    try {
      const result = await request('/api/test-mindmap/trigger', {
        method: 'POST',
        body: JSON.stringify(test),
      });
      
      if (result.shouldTrigger === test.expect) {
        log.success(`${test.mode}: "${test.query.substring(0, 30)}..." → ${result.shouldTrigger}`);
        passed++;
      } else {
        log.error(`${test.mode}: Expected ${test.expect}, got ${result.shouldTrigger}`);
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
    }
  }
  
  log.info(`Passed: ${passed}/${tests.length}`);
  return passed === tests.length;
}

async function testExtraction() {
  log.section('JSON Extraction Tests');
  
  const sampleResponses = [
    {
      name: 'Valid mindmap in code block',
      response: `Here's the analysis:\n\n\`\`\`json\n{\n  "type": "mindmap",\n  "title": "Test",\n  "nodes": [{"id": "root", "label": "Test", "type": "root"}],\n  "edges": []\n}\n\`\`\`\n\nThat's the structure.`,
      expect: true,
    },
    {
      name: 'Mindmap without type field',
      response: `\`\`\`json\n{\n  "title": "Test",\n  "nodes": [{"id": "root", "label": "Test"}],\n  "edges": []\n}\n\`\`\``,
      expect: true, // Should work with Strategy 2
    },
    {
      name: 'No mindmap data',
      response: 'This is just a regular text response without any JSON.',
      expect: false,
    },
    {
      name: 'Invalid JSON',
      response: '\`\`\`json\n{broken json\n\`\`\`',
      expect: false,
    },
  ];
  
  let passed = 0;
  for (const test of sampleResponses) {
    try {
      const result = await request('/api/test-mindmap/extract', {
        method: 'POST',
        body: JSON.stringify({ response: test.response }),
      });
      
      if (result.success === test.expect) {
        log.success(`${test.name}: ${result.success ? 'Extracted' : 'No extraction'}`);
        if (result.mindmap) {
          log.info(`  → ${result.mindmap.nodes.length} nodes, ${result.mindmap.edges.length} edges`);
        }
        passed++;
      } else {
        log.error(`${test.name}: Expected ${test.expect}, got ${result.success}`);
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
    }
  }
  
  log.info(`Passed: ${passed}/${sampleResponses.length}`);
  return passed === sampleResponses.length;
}

async function testValidation() {
  log.section('Validation Tests');
  
  const tests = [
    {
      name: 'Valid mindmap',
      mindmap: {
        type: 'mindmap',
        title: 'Test',
        nodes: [
          { id: 'root', label: 'Root', type: 'root' },
          { id: 'n1', label: 'Node 1', type: 'primary' },
        ],
        edges: [{ id: 'e1', source: 'root', target: 'n1' }],
      },
      expect: true,
    },
    {
      name: 'Missing root node',
      mindmap: {
        type: 'mindmap',
        title: 'Test',
        nodes: [{ id: 'n1', label: 'Node 1', type: 'primary' }],
        edges: [],
      },
      expect: false,
    },
    {
      name: 'Duplicate IDs',
      mindmap: {
        type: 'mindmap',
        title: 'Test',
        nodes: [
          { id: 'root', label: 'Root', type: 'root' },
          { id: 'root', label: 'Duplicate', type: 'primary' },
        ],
        edges: [],
      },
      expect: false,
    },
    {
      name: 'Dangling edge',
      mindmap: {
        type: 'mindmap',
        title: 'Test',
        nodes: [{ id: 'root', label: 'Root', type: 'root' }],
        edges: [{ id: 'e1', source: 'root', target: 'nonexistent' }],
      },
      expect: false,
    },
  ];
  
  let passed = 0;
  for (const test of tests) {
    try {
      const result = await request('/api/test-mindmap/validate', {
        method: 'POST',
        body: JSON.stringify({ mindmap: test.mindmap }),
      });
      
      if (result.valid === test.expect) {
        log.success(`${test.name}: ${result.valid ? 'Valid' : 'Invalid'}`);
        if (!result.valid) {
          log.info(`  Errors: ${result.errors.join(', ')}`);
        }
        passed++;
      } else {
        log.error(`${test.name}: Expected ${test.expect}, got ${result.valid}`);
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
    }
  }
  
  log.info(`Passed: ${passed}/${tests.length}`);
  return passed === tests.length;
}

async function testExampleGeneration() {
  log.section('Example Generation Tests');
  
  const modes = ['deep-research', 'calculation', 'audit-plan', 'workflow'];
  let passed = 0;
  
  for (const mode of modes) {
    try {
      const result = await request(`/api/test-mindmap/example/${mode}`);
      
      if (result.mindmap && result.mindmap.nodes.length > 0) {
        log.success(`${mode}: Generated ${result.stats.nodeCount} nodes`);
        passed++;
      } else {
        log.error(`${mode}: Failed to generate example`);
      }
    } catch (error) {
      log.error(`${mode}: ${error.message}`);
    }
  }
  
  log.info(`Passed: ${passed}/${modes.length}`);
  return passed === modes.length;
}

async function testPromptGeneration() {
  log.section('Prompt Generation Tests');
  
  const tests = [
    { mode: 'deep-research', query: 'Explain GAAP vs IFRS' },
    { mode: 'calculation', query: 'Calculate compound interest' },
  ];
  
  let passed = 0;
  for (const test of tests) {
    try {
      const result = await request('/api/test-mindmap/prompt', {
        method: 'POST',
        body: JSON.stringify(test),
      });
      
      if (result.prompt && result.promptLength > 500) {
        log.success(`${test.mode}: Generated ${result.promptLength} chars`);
        passed++;
      } else {
        log.error(`${test.mode}: Prompt too short or missing`);
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
    }
  }
  
  log.info(`Passed: ${passed}/${tests.length}`);
  return passed === tests.length;
}

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   Mindmap System Test Suite          ║');
  console.log('╚═══════════════════════════════════════╝\n');
  log.info(`Testing against: ${BASE_URL}`);
  
  const results = [];
  
  results.push({ name: 'Health Check', passed: await testHealthCheck() });
  results.push({ name: 'Trigger Detection', passed: await testTriggerDetection() });
  results.push({ name: 'JSON Extraction', passed: await testExtraction() });
  results.push({ name: 'Validation', passed: await testValidation() });
  results.push({ name: 'Example Generation', passed: await testExampleGeneration() });
  results.push({ name: 'Prompt Generation', passed: await testPromptGeneration() });
  
  log.section('Test Summary');
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach(result => {
    if (result.passed) {
      log.success(result.name);
    } else {
      log.error(result.name);
    }
  });
  
  console.log('');
  if (totalPassed === totalTests) {
    log.success(`All tests passed! (${totalPassed}/${totalTests})`);
    process.exit(0);
  } else {
    log.error(`Some tests failed (${totalPassed}/${totalTests})`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
