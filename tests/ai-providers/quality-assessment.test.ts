/**
 * AI Provider Quality and Capability Assessment Tests
 * Comprehensive testing of AI response quality, accuracy, and domain expertise
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIOrchestrator } from '../../server/services/aiOrchestrator';
import { financialSolverService } from '../../server/services/financialSolvers';
import { visualizationGenerator } from '../../server/services/visualizationGenerator';
import { CitationService } from '../../server/services/citationService';

describe('AI Quality and Capability Assessment', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    orchestrator = new AIOrchestrator();
  });

  describe('Domain Expertise Validation', () => {
    const expertiseTests = [
      {
        domain: 'tax',
        query: 'Explain Section 179 deduction limits for 2024 and how they interact with bonus depreciation',
        expectedKeywords: ['section 179', 'bonus depreciation', '2024', 'limits', 'equipment'],
        complexityLevel: 'expert'
      },
      {
        domain: 'audit',
        query: 'Describe the audit procedures for testing accounts receivable confirmations under AS 2310',
        expectedKeywords: ['as 2310', 'confirmations', 'accounts receivable', 'audit procedures'],
        complexityLevel: 'expert'
      },
      {
        domain: 'financial_reporting',
        query: 'How does ASC 842 lease accounting affect balance sheet presentation for operating leases?',
        expectedKeywords: ['asc 842', 'lease accounting', 'operating leases', 'balance sheet'],
        complexityLevel: 'expert'
      },
      {
        domain: 'compliance',
        query: 'What are the SOX 404 internal control testing requirements for accelerated filers?',
        expectedKeywords: ['sox 404', 'internal control', 'accelerated filers', 'testing'],
        complexityLevel: 'expert'
      }
    ];

    expertiseTests.forEach(({ domain, query, expectedKeywords, complexityLevel }) => {
      it(`should demonstrate expert knowledge in ${domain}`, async () => {
        const result = await orchestrator.processQuery(query, [], 'enterprise');

        // Check domain classification
        expect(result.classification.domain).toBe(domain);
        expect(result.classification.complexity).toBe(complexityLevel);

        // Verify response contains domain-specific keywords
        const response = result.response.toLowerCase();
        expectedKeywords.forEach(keyword => {
          expect(response).toContain(keyword.toLowerCase());
        });

        // Response should be substantial (expert-level detail)
        expect(result.response.length).toBeGreaterThan(500);
        expect(result.tokensUsed).toBeGreaterThan(100);
      });
    });

    it('should provide jurisdiction-specific advice', async () => {
      const jurisdictionTests = [
        {
          query: 'Compare corporate tax rates between US, Canada, and UK for 2024',
          expectedJurisdictions: ['us', 'canada', 'uk'],
          expectedTerms: ['corporate tax rate', 'federal', 'provincial', 'hmrc']
        },
        {
          query: 'Explain GST/HST requirements for Canadian businesses',
          expectedJurisdictions: ['canada'],
          expectedTerms: ['gst', 'hst', 'cra', 'registration threshold']
        }
      ];

      for (const { query, expectedJurisdictions, expectedTerms } of jurisdictionTests) {
        const result = await orchestrator.processQuery(query, [], 'professional');
        
        expectedJurisdictions.forEach(jurisdiction => {
          expect(result.classification.jurisdiction).toContain(jurisdiction);
        });

        const response = result.response.toLowerCase();
        expectedTerms.forEach(term => {
          expect(response).toContain(term.toLowerCase());
        });
      }
    });
  });

  describe('Calculation Accuracy and Integration', () => {
    it('should perform accurate tax calculations', async () => {
      const query = 'Calculate corporate tax liability for a C-corp with $500,000 revenue, $300,000 expenses, in Delaware';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.calculationResults).toBeTruthy();
      expect(result.calculationResults.taxCalculation).toBeDefined();
      
      const taxCalc = result.calculationResults.taxCalculation;
      expect(taxCalc.taxableIncome).toBe(200000); // 500k - 300k
      expect(taxCalc.federalTax).toBeGreaterThan(0);
      expect(taxCalc.stateTax).toBeGreaterThan(0);
      
      // Response should explain the calculation
      expect(result.response).toContain('$200,000');
      expect(result.response).toContain('taxable income');
    });

    it('should calculate depreciation schedules accurately', async () => {
      const query = 'Generate a 5-year MACRS depreciation schedule for $100,000 office equipment';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.calculationResults?.depreciation).toBeDefined();
      
      const depreciation = result.calculationResults.depreciation;
      expect(depreciation.schedule).toHaveLength(5);
      
      // Verify MACRS percentages are correct
      const year1Percentage = depreciation.schedule[0].percentage;
      expect(year1Percentage).toBe(0.20); // 20% for 5-year MACRS
    });

    it('should perform NPV/IRR calculations correctly', async () => {
      const query = 'Calculate NPV and IRR for project with initial investment $100,000 and annual cash flows $30,000 for 5 years, using 10% discount rate';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.calculationResults).toBeTruthy();
      expect(result.calculationResults.npv).toBeDefined();
      expect(result.calculationResults.irr).toBeDefined();

      // NPV should be positive
      expect(result.calculationResults.npv).toBeGreaterThan(0);
      
      // IRR should be greater than discount rate
      expect(result.calculationResults.irr).toBeGreaterThan(0.10);
    });

    it('should integrate calculations with explanatory content', async () => {
      const query = 'Calculate loan amortization for $200,000 at 5% for 30 years';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.calculationResults?.amortization).toBeDefined();
      
      // Should explain both calculation and implications
      expect(result.response).toContain('monthly payment');
      expect(result.response).toContain('principal');
      expect(result.response).toContain('interest');
      
      // Should provide actionable insights
      expect(result.response.length).toBeGreaterThan(300);
    });
  });

  describe('Response Quality Metrics', () => {
    it('should provide comprehensive responses for complex queries', async () => {
      const complexQuery = `Analyze the tax implications of a corporate restructuring where:
        - Parent company (Delaware C-corp) spins off subsidiary to shareholders
        - Subsidiary has $5M in assets, $2M in liabilities
        - Parent has 1000 shareholders
        - Transaction qualifies under Section 355`;

      const result = await orchestrator.processQuery(complexQuery, [], 'enterprise');

      // Comprehensive response indicators
      expect(result.response.length).toBeGreaterThan(1000);
      expect(result.tokensUsed).toBeGreaterThan(200);
      
      // Should address multiple aspects
      expect(result.response.toLowerCase()).toContain('section 355');
      expect(result.response.toLowerCase()).toContain('spin-off');
      expect(result.response.toLowerCase()).toContain('shareholders');
      expect(result.response.toLowerCase()).toContain('tax-free');
      
      // Should show expert-level analysis
      expect(result.classification.complexity).toBe('expert');
      expect(result.classification.requiresDeepReasoning).toBe(true);
    });

    it('should maintain consistency across similar queries', async () => {
      const baseQuery = 'What is the standard deduction for 2024?';
      const variations = [
        'What is the 2024 standard deduction amount?',
        'How much is the standard deduction in 2024?',
        'Standard deduction limits for tax year 2024'
      ];

      const results = await Promise.all(
        variations.map(query => orchestrator.processQuery(query, [], 'professional'))
      );

      // All responses should mention the same amount
      const amounts = results.map(r => {
        const match = r.response.match(/\$[\d,]+/);
        return match ? match[0] : null;
      });

      // Should have consistent amounts
      const uniqueAmounts = [...new Set(amounts.filter(a => a))];
      expect(uniqueAmounts.length).toBeLessThanOrEqual(2); // Allow for single/married filing differences
    });

    it('should provide accurate citations and references', async () => {
      const query = 'Explain the requirements for claiming the R&D tax credit under Section 41';
      
      const result = await orchestrator.processQuery(query, [], 'enterprise');

      // Should extract citations
      const citations = CitationService.extractCitations(result.response);
      expect(citations.length).toBeGreaterThan(0);
      
      // Should reference tax code
      expect(result.response.toLowerCase()).toContain('section 41');
      expect(result.response.toLowerCase()).toContain('r&d');
      expect(result.response.toLowerCase()).toContain('research');
    });

    it('should handle ambiguous queries professionally', async () => {
      const ambiguousQuery = 'How much tax do I owe?';
      
      const result = await orchestrator.processQuery(ambiguousQuery, [], 'professional');

      // Should ask for clarification or provide general framework
      const response = result.response.toLowerCase();
      expect(
        response.includes('depends') ||
        response.includes('need to know') ||
        response.includes('information') ||
        response.includes('factors')
      ).toBe(true);
      
      // Should be helpful despite ambiguity
      expect(result.response.length).toBeGreaterThan(200);
    });
  });

  describe('Visualization and Output Quality', () => {
    it('should generate appropriate visualizations for financial data', async () => {
      const query = 'Create a depreciation schedule visualization for $50,000 equipment over 5 years';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.metadata.hasVisualization).toBe(true);
      expect(result.metadata.visualization).toBeDefined();
      
      const viz = result.metadata.visualization!;
      expect(viz.type).toMatch(/(line|bar|table)/);
      expect(viz.data).toBeDefined();
    });

    it('should determine appropriate output pane usage', async () => {
      const outputPaneQueries = [
        'Generate a tax compliance checklist',
        'Create a workflow for audit planning', 
        'Prepare a comparison table of depreciation methods'
      ];

      for (const query of outputPaneQueries) {
        const result = await orchestrator.processQuery(query, [], 'professional');
        expect(result.metadata.showInOutputPane).toBe(true);
      }

      const chatOnlyQueries = [
        'What is depreciation?',
        'Quick question about taxes',
        'Hello'
      ];

      for (const query of chatOnlyQueries) {
        const result = await orchestrator.processQuery(query, [], 'professional');
        expect(result.metadata.showInOutputPane).toBe(false);
      }
    });

    it('should format structured content properly', async () => {
      const query = 'Create a detailed audit planning checklist for a manufacturing company';
      
      const result = await orchestrator.processQuery(query, [], 'professional');

      expect(result.metadata.showInOutputPane).toBe(true);
      
      // Should contain structured elements
      expect(result.response).toMatch(/\d+\./); // Numbered items
      expect(result.response).toContain('\n'); // Line breaks
      expect(result.response.length).toBeGreaterThan(500);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid financial data gracefully', async () => {
      const invalidQuery = 'Calculate tax for -$50,000 revenue and $100,000 expenses';
      
      const result = await orchestrator.processQuery(invalidQuery, [], 'professional');

      // Should handle gracefully, not crash
      expect(result.response).toBeTruthy();
      expect(result.response.toLowerCase()).toMatch(/(invalid|negative|error|cannot|clarify)/);
    });

    it('should handle extremely complex nested questions', async () => {
      const complexQuery = `If a company has three subsidiaries, each in different countries 
        (US, Canada, UK), and the parent company wants to restructure to minimize global tax 
        liability while maintaining operational efficiency, considering transfer pricing rules, 
        treaty benefits, and local compliance requirements, what would be the recommended 
        corporate structure and what are the tax implications of the transition?`;

      const result = await orchestrator.processQuery(complexQuery, [], 'enterprise');

      expect(result.response).toBeTruthy();
      expect(result.response.length).toBeGreaterThan(800);
      expect(result.classification.complexity).toBe('expert');
      expect(result.classification.requiresDeepReasoning).toBe(true);
    });

    it('should maintain context in multi-turn conversations', async () => {
      const conversation = [
        { role: 'user' as const, content: 'I have a Delaware LLC taxed as S-Corp' },
        { role: 'assistant' as const, content: 'For your Delaware LLC elected as S-Corp...' },
        { role: 'user' as const, content: 'What are the payroll tax requirements?' },
        { role: 'assistant' as const, content: 'For S-Corp payroll taxes in Delaware...' }
      ];

      const result = await orchestrator.processQuery(
        'What about quarterly estimated payments?',
        conversation,
        'professional'
      );

      // Should reference S-Corp context
      expect(result.response.toLowerCase()).toMatch(/(s-corp|s corp|shareholder|reasonable compensation)/);
    });

    it('should validate and sanitize user inputs', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>What is depreciation?',
        'DROP TABLE users; What are tax brackets?',
        '../../../../../../etc/passwd How do I file taxes?'
      ];

      for (const input of maliciousInputs) {
        const result = await orchestrator.processQuery(input, [], 'professional');
        
        // Should sanitize and respond normally
        expect(result.response).toBeTruthy();
        expect(result.response).not.toContain('<script>');
        expect(result.response).not.toContain('DROP TABLE');
        expect(result.response).not.toContain('../');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet response time requirements', async () => {
      const queries = [
        'What is the corporate tax rate?', // Simple
        'Calculate depreciation for $100k equipment', // Medium
        'Analyze international transfer pricing compliance' // Complex
      ];

      for (const query of queries) {
        const startTime = performance.now();
        const result = await orchestrator.processQuery(query, [], 'professional');
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        
        // Performance requirements
        expect(responseTime).toBeLessThan(30000); // 30 seconds max
        expect(result.response).toBeTruthy();
        expect(result.tokensUsed).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent load efficiently', async () => {
      const concurrentQueries = Array(5).fill(0).map((_, i) => 
        orchestrator.processQuery(
          `Calculate tax for scenario ${i} with $${100000 + i * 10000} revenue`,
          [],
          'professional'
        )
      );

      const startTime = performance.now();
      const results = await Promise.allSettled(concurrentQueries);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / results.length;

      // All should complete
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      
      // Should maintain reasonable performance
      expect(averageTime).toBeLessThan(15000); // 15 seconds average
    });

    it('should optimize token usage effectively', async () => {
      const query = 'Explain the basics of corporate taxation';
      
      const result = await orchestrator.processQuery(query, [], 'free');

      // Should provide value while being efficient
      expect(result.response.length).toBeGreaterThan(200);
      expect(result.tokensUsed).toBeLessThan(1000); // Reasonable token usage
      
      // Token efficiency ratio
      const efficiency = result.response.length / result.tokensUsed;
      expect(efficiency).toBeGreaterThan(1); // At least 1 char per token
    });
  });
});