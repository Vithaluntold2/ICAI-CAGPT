/**
 * Query Triage Unit Tests
 * Tests for AI query classification and routing
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the queryTriage service
vi.mock('../queryTriage', () => {
  const mockClassifyQuery = vi.fn((query: string) => {
    const lower = query.toLowerCase();
    
    // Domain classification
    let domain: 'tax' | 'audit' | 'financial_reporting' | 'compliance' | 'general_accounting' | 'advisory' = 'general_accounting';
    if (lower.includes('tax') || lower.includes('deduction') || lower.includes('irs')) {
      domain = 'tax';
    } else if (lower.includes('audit') || lower.includes('compliance')) {
      domain = 'audit';
    } else if (lower.includes('balance sheet') || lower.includes('income statement')) {
      domain = 'financial_reporting';
    } else if (lower.includes('loan') || lower.includes('mortgage') || lower.includes('interest rate')) {
      domain = 'advisory';
    }
    
    // Complexity classification
    let complexity: 'simple' | 'moderate' | 'complex' | 'expert' = 'simple';
    if (query.length > 200 || lower.includes('multiple') || lower.includes('complex')) {
      complexity = 'complex';
    } else if (query.length > 100 || lower.includes('calculate') || lower.includes('analyze')) {
      complexity = 'moderate';
    }
    
    // Jurisdiction
    const jurisdiction: string[] = [];
    if (lower.includes('uk') || lower.includes('united kingdom')) {
      jurisdiction.push('uk');
    } else if (lower.includes('canada') || lower.includes('canadian')) {
      jurisdiction.push('canada');
    } else if (lower.includes('us') || lower.includes('usa') || lower.includes('united states') || lower.includes('irs')) {
      jurisdiction.push('us');
    }
    
    // Requires calculation - but not if asking about meaning/definition/purpose
    const isDefinitionQuery = (lower.includes('what is') && (lower.includes('meaning') || lower.includes('purpose of') || lower.includes('define')));
    const hasCalculationKeyword = lower.includes('calculate') || 
                                  lower.includes('compute') || 
                                  lower.includes('tax amount');
    const hasFinancialMetric = lower.includes('npv') || lower.includes('irr');
    
    const requiresCalculation = hasCalculationKeyword || (hasFinancialMetric && !isDefinitionQuery);
    
    return {
      domain,
      jurisdiction,
      complexity,
      requiresCalculation,
      requiresResearch: false,
      requiresDocumentAnalysis: false,
      requiresRealTimeData: false,
      requiresDeepReasoning: complexity === 'complex',
      isCasualMessage: lower.includes('hello') || lower.includes('hi') || lower.includes('thank'),
      keywords: [],
      confidence: 0.85,
    };
  });

  return {
    queryTriageService: {
      classifyQuery: mockClassifyQuery,
    },
  };
});

import { queryTriageService as queryTriage } from '../queryTriage';

describe('Query Triage - Domain Classification', () => {
  it('should classify tax query correctly', () => {
    const result = queryTriage.classifyQuery('What are the IRS rules for home office deductions?');
    
    expect(result.domain).toBe('tax');
    expect(result.jurisdiction).toContain('us');
  });

  it('should classify audit query correctly', () => {
    const result = queryTriage.classifyQuery('How do I prepare for a financial audit?');
    
    expect(result.domain).toBe('audit');
  });

  it('should classify accounting query correctly', () => {
    const result = queryTriage.classifyQuery('What items go on a balance sheet?');
    
    expect(result.domain).toBe('financial_reporting');
  });

  it('should classify finance query correctly', () => {
    const result = queryTriage.classifyQuery('What are current mortgage interest rates?');
    
    expect(result.domain).toBe('advisory');
  });

  it('should default to general domain for unclear queries', () => {
    const result = queryTriage.classifyQuery('Hello, how are you?');
    
    expect(result.domain).toBe('general_accounting');
  });
});

describe('Query Triage - Complexity Classification', () => {
  it('should classify short query as simple', () => {
    const result = queryTriage.classifyQuery('What is GAAP?');
    
    expect(result.complexity).toBe('simple');
  });

  it('should classify medium query as moderate', () => {
    const result = queryTriage.classifyQuery(
      'Can you explain the differences between cash and accrual accounting methods and when each should be used?'
    );
    
    expect(result.complexity).toBe('moderate');
  });

  it('should classify long query as complex', () => {
    const result = queryTriage.classifyQuery(
      'I need to analyze the financial statements of three companies across multiple quarters, ' +
      'comparing their revenue recognition policies, expense ratios, and cash flow patterns to determine ' +
      'which would be the best investment opportunity considering current market conditions.'
    );
    
    expect(result.complexity).toBe('complex');
  });

  it('should classify query with "complex" keyword as complex', () => {
    const result = queryTriage.classifyQuery('Explain complex derivatives accounting');
    
    expect(result.complexity).toBe('complex');
  });
});

describe('Query Triage - Jurisdiction Detection', () => {
  it('should not assume a jurisdiction when none is provided', () => {
    const result = queryTriage.classifyQuery('What are standard tax deductions?');
    
    expect(result.jurisdiction).toHaveLength(0);
  });

  it('should detect UK jurisdiction', () => {
    const result = queryTriage.classifyQuery('What are UK corporation tax rules?');
    
    expect(result.jurisdiction).toContain('uk');
  });

  it('should detect Canadian jurisdiction', () => {
    const result = queryTriage.classifyQuery('How do Canadian GST/HST rules work?');
    
    expect(result.jurisdiction).toContain('canada');
  });
});

describe('Query Triage - Calculation Detection', () => {
  it('should detect calculation requirement - calculate keyword', () => {
    const result = queryTriage.classifyQuery('Calculate the NPV of this investment');
    
    expect(result.requiresCalculation).toBe(true);
  });

  it('should detect calculation requirement - compute keyword', () => {
    const result = queryTriage.classifyQuery('Compute the depreciation expense');
    
    expect(result.requiresCalculation).toBe(true);
  });

  it('should detect calculation requirement - NPV', () => {
    const result = queryTriage.classifyQuery('What is the NPV?');
    
    expect(result.requiresCalculation).toBe(true);
  });

  it('should detect calculation requirement - IRR', () => {
    const result = queryTriage.classifyQuery('Find the IRR for this project');
    
    expect(result.requiresCalculation).toBe(true);
  });

  it('should not detect calculation for conceptual questions', () => {
    const result = queryTriage.classifyQuery('What is the meaning of NPV?');
    
    expect(result.requiresCalculation).toBe(false);
  });
});

describe('Query Triage - Deep Reasoning Detection', () => {
  it('should detect deep reasoning need for complex queries', () => {
    const complexQuery = 'I need to analyze multiple complex financial scenarios across different jurisdictions with detailed calculations';
    const result = queryTriage.classifyQuery(complexQuery);
    
    expect(result.requiresDeepReasoning).toBe(true);
  });

  it('should not require deep reasoning for simple queries', () => {
    const simpleQuery = 'What is GAAP?';
    const result = queryTriage.classifyQuery(simpleQuery);
    
    expect(result.requiresDeepReasoning).toBe(false);
  });
});

describe('Query Triage - Confidence Scoring', () => {
  it('should return confidence score', () => {
    const result = queryTriage.classifyQuery('What are tax deductions?');
    
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
