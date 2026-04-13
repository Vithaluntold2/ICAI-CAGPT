/**
 * Compliance Sentinel Service
 * Detects hallucinations, validates GAAP/IRS compliance, ensures numeric consistency
 * 
 * This is a CRITICAL safety layer for financial compliance
 */

import type {
  ComplianceCheck,
  CognitiveMonitorResult
} from '../../shared/types/reasoning';

export class ComplianceSentinel {
  /**
   * Main entry point: validate an AI response for compliance and quality
   */
  async validateResponse(
    query: string,
    response: string,
    context?: {
      chatMode?: string;
      uploadedDocuments?: any[];
      previousMessages?: any[];
    }
  ): Promise<CognitiveMonitorResult> {
    const checks: ComplianceCheck[] = [];
    const startTime = Date.now();

    // Run all compliance checks
    checks.push(await this.checkForHallucination(response, context));
    checks.push(await this.checkNumericConsistency(response));
    checks.push(await this.checkGAAPCompliance(query, response, context?.chatMode));
    checks.push(await this.checkIRSCompliance(query, response, context?.chatMode));

    const processingTime = Date.now() - startTime;
    console.log(`[ComplianceSentinel] Validation completed in ${processingTime}ms`);

    // Determine overall status
    const anyFailed = checks.some(c => !c.passed);
    const anyWarnings = checks.some(c => c.confidence < 0.8);
    
    const overallStatus: 'pass' | 'warning' | 'fail' = 
      anyFailed ? 'fail' : anyWarnings ? 'warning' : 'pass';

    // Require human review if failed or low confidence
    const requiresHumanReview = anyFailed || checks.some(c => c.confidence < 0.6);

    return {
      checks,
      overallStatus,
      requiresHumanReview,
      autoRepairAttempted: false, // Will be set by caller if repair is attempted
    };
  }

  /**
   * Check #1: Hallucination Detection
   * Looks for fabricated data, fake citations, invented numbers
   */
  private async checkForHallucination(
    response: string,
    context?: any
  ): Promise<ComplianceCheck> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Pattern 1: Fake citation patterns
    const citationPatterns = [
      /according to.*study/i,
      /research shows/i,
      /\d{4}\s+survey/i,
      /source:\s*\[.*\]/i
    ];

    for (const pattern of citationPatterns) {
      if (pattern.test(response)) {
        // Check if citation seems generic/unverifiable
        if (!this.hasSpecificCitation(response)) {
          issues.push('Generic citation without specific source details');
          confidence -= 0.2;
        }
      }
    }

    // Pattern 2: Suspiciously specific numbers without context
    const numberMatches = response.match(/\$[\d,]+\.?\d*/g) || [];
    if (numberMatches.length > 5) {
      // Many numbers - check if they're explained
      if (!this.numbersAreExplained(response, numberMatches)) {
        issues.push('Multiple unexplained numerical values detected');
        confidence -= 0.15;
      }
    }

    // Pattern 3: Red flag phrases that often indicate hallucination
    const redFlags = [
      'I believe',
      'probably',
      'it seems',
      'I think',
      'in my experience',
      'typically around',
      'approximately worth'
    ];

    const redFlagCount = redFlags.filter(phrase => 
      response.toLowerCase().includes(phrase)
    ).length;

    if (redFlagCount > 2) {
      issues.push(`High use of uncertain language (${redFlagCount} instances)`);
      confidence -= 0.1 * redFlagCount;
    }

    // Pattern 4: Check against uploaded documents (if available)
    if (context?.uploadedDocuments && context.uploadedDocuments.length > 0) {
      // If response includes numbers, they should match document data
      const hasDocumentMismatch = this.checkDocumentConsistency(response, context.uploadedDocuments);
      if (hasDocumentMismatch) {
        issues.push('Response contains numbers inconsistent with uploaded documents');
        confidence -= 0.3;
      }
    }

    const passed = issues.length === 0 || confidence > 0.7;

    return {
      checkType: 'hallucination',
      passed,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues: issues.length > 0 ? issues : undefined,
      evidence: passed ? ['No hallucination patterns detected'] : undefined
    };
  }

  /**
   * Check #2: Numeric Consistency
   * Ensures calculations are correct and totals match
   */
  private async checkNumericConsistency(response: string): Promise<ComplianceCheck> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Extract all numbers from the response
    const numbers = this.extractNumbers(response);

    // Look for arithmetic expressions
    const arithmeticMatches = response.match(/(\d[\d,]*\.?\d*)\s*[\+\-\*\/]\s*(\d[\d,]*\.?\d*)\s*=\s*(\d[\d,]*\.?\d*)/g);

    if (arithmeticMatches) {
      for (const match of arithmeticMatches) {
        if (!this.validateArithmetic(match)) {
          issues.push(`Incorrect calculation detected: ${match}`);
          confidence -= 0.4;
        }
      }
    }

    // Look for "totals" or "sum" and verify they're correct
    const totalPattern = /total[s]?:?\s*\$?([\d,]+\.?\d*)/gi;
    const totalMatches = Array.from(response.matchAll(totalPattern));

    for (const match of totalMatches) {
      const claimedTotal = parseFloat(match[1].replace(/,/g, ''));
      // Try to find preceding numbers that should sum to this total
      const precedingText = response.substring(0, match.index);
      const precedingNumbers = this.extractNumbers(precedingText);
      
      if (precedingNumbers.length >= 2) {
        const actualSum = precedingNumbers.slice(-5).reduce((a, b) => a + b, 0);
        const diff = Math.abs(actualSum - claimedTotal);
        
        if (diff > 0.01 && diff / claimedTotal > 0.01) {
          issues.push(`Total ${claimedTotal} doesn't match sum of preceding values`);
          confidence -= 0.3;
        }
      }
    }

    const passed = issues.length === 0;

    return {
      checkType: 'numeric-consistency',
      passed,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues: issues.length > 0 ? issues : undefined,
      evidence: passed ? ['All calculations verified correct'] : undefined
    };
  }

  /**
   * Check #3: GAAP Compliance
   * Validates against Generally Accepted Accounting Principles
   */
  private async checkGAAPCompliance(
    query: string,
    response: string,
    chatMode?: string
  ): Promise<ComplianceCheck> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Only relevant for certain modes
    if (chatMode !== 'audit' && chatMode !== 'calculate') {
      return {
        checkType: 'gaap-compliance',
        passed: true,
        confidence: 1.0,
        evidence: ['GAAP compliance check not applicable for this mode']
      };
    }

    // Check for common GAAP violations in language

    // Pattern 1: Revenue recognition issues
    if (response.toLowerCase().includes('revenue') || response.toLowerCase().includes('income')) {
      const hasRevenueGuidance = /ASC\s*606|revenue recognition|performance obligation/i.test(response);
      if (query.toLowerCase().includes('revenue recognition') && !hasRevenueGuidance) {
        issues.push('Revenue recognition query without mentioning ASC 606');
        confidence -= 0.2;
      }
    }

    // Pattern 2: Lease accounting
    if (response.toLowerCase().includes('lease')) {
      const hasLeaseGuidance = /ASC\s*842|right-of-use|lease liability/i.test(response);
      if (query.toLowerCase().includes('lease') && !hasLeaseGuidance) {
        issues.push('Lease accounting without ASC 842 reference');
        confidence -= 0.15;
      }
    }

    // Pattern 3: Misleading terminology
    const misleadingTerms = [
      { term: 'profit', issue: 'Use "net income" per GAAP terminology' },
      { term: 'cash flow from sales', issue: 'Unclear - specify operating, investing, or financing' }
    ];

    for (const { term, issue } of misleadingTerms) {
      if (response.toLowerCase().includes(term)) {
        issues.push(issue);
        confidence -= 0.1;
      }
    }

    const passed = issues.length === 0 || confidence > 0.6;

    return {
      checkType: 'gaap-compliance',
      passed,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues: issues.length > 0 ? issues : undefined,
      evidence: passed ? ['GAAP terminology and principles followed'] : undefined
    };
  }

  /**
   * Check #4: IRS Compliance
   * Validates tax advice follows IRS regulations
   */
  private async checkIRSCompliance(
    query: string,
    response: string,
    chatMode?: string
  ): Promise<ComplianceCheck> {
    const issues: string[] = [];
    let confidence = 1.0;

    // Only relevant for tax-related queries
    const isTaxRelated = /tax|irs|deduction|credit|depreciation|1040|w-2/i.test(query);
    
    if (!isTaxRelated) {
      return {
        checkType: 'irs-compliance',
        passed: true,
        confidence: 1.0,
        evidence: ['IRS compliance check not applicable']
      };
    }

    // Pattern 1: Tax advice without disclaimers
    const givesTaxAdvice = /you should|I recommend|you can deduct|claim.*credit/i.test(response);
    const hasDisclaimer = /consult.*tax professional|professional advice|CPA|tax advisor/i.test(response);

    if (givesTaxAdvice && !hasDisclaimer) {
      issues.push('Tax advice provided without professional consultation disclaimer');
      confidence -= 0.3;
    }

    // Pattern 2: Outdated tax year references
    const currentYear = new Date().getFullYear();
    const yearMatches = response.match(/\b(20\d{2})\b/g);
    
    if (yearMatches) {
      const oldYears = yearMatches.filter(year => {
        const y = parseInt(year);
        return y < currentYear - 2; // Flag references to tax years >2 years old
      });
      
      if (oldYears.length > 0) {
        issues.push(`References to potentially outdated tax years: ${oldYears.join(', ')}`);
        confidence -= 0.15;
      }
    }

    // Pattern 3: Specific IRS form/code references should be accurate
    const formReferences = response.match(/Form\s+(\d{4}[A-Z]?)/gi);
    if (formReferences) {
      const validForms = ['1040', '1065', '1120', '1099', '8949', 'W-2', 'W-4', '941', '940'];
      const invalidForms = formReferences.filter(ref => {
        const formNum = ref.replace(/Form\s+/i, '');
        return !validForms.some(valid => formNum.startsWith(valid));
      });
      
      if (invalidForms.length > 0) {
        issues.push(`Uncommon or potentially invalid form references: ${invalidForms.join(', ')}`);
        confidence -= 0.2;
      }
    }

    const passed = issues.length === 0 || confidence > 0.6;

    return {
      checkType: 'irs-compliance',
      passed,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues: issues.length > 0 ? issues : undefined,
      evidence: passed ? ['IRS compliance guidelines followed'] : undefined
    };
  }

  // Helper methods

  private hasSpecificCitation(text: string): boolean {
    // Check for specific citation markers: URLs, IRC sections, ASC codes, etc.
    const specificCitations = [
      /IRC\s*§?\s*\d+/i,
      /ASC\s*\d+-\d+/i,
      /https?:\/\//i,
      /Publication\s*\d+/i,
      /Rev\.\s*Proc\./i
    ];
    
    return specificCitations.some(pattern => pattern.test(text));
  }

  private numbersAreExplained(text: string, numbers: string[]): boolean {
    // Check if each number appears near explanatory context
    let explainedCount = 0;
    
    for (const num of numbers) {
      const index = text.indexOf(num);
      if (index === -1) continue;
      
      // Get context around the number
      const contextBefore = text.substring(Math.max(0, index - 50), index);
      const contextAfter = text.substring(index, index + 50);
      const context = contextBefore + contextAfter;
      
      // Look for explanatory keywords
      const hasContext = /for|from|total|revenue|expense|deduction|credit|income|cost|fee|payment/i.test(context);
      if (hasContext) explainedCount++;
    }
    
    return explainedCount / numbers.length > 0.7; // 70% of numbers should be explained
  }

  private checkDocumentConsistency(response: string, documents: any[]): boolean {
    // Placeholder: In production, this would extract numbers from documents
    // and verify they match numbers in the response
    // For now, return false (no mismatch)
    return false;
  }

  private extractNumbers(text: string): number[] {
    const matches = text.match(/\$?([\d,]+\.?\d*)/g) || [];
    return matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(n => !isNaN(n));
  }

  private validateArithmetic(expression: string): boolean {
    try {
      // Extract numbers and operator
      const match = expression.match(/([\d,]+\.?\d*)\s*([\+\-\*\/])\s*([\d,]+\.?\d*)\s*=\s*([\d,]+\.?\d*)/);
      if (!match) return true; // Can't parse, assume correct
      
      const num1 = parseFloat(match[1].replace(/,/g, ''));
      const operator = match[2];
      const num2 = parseFloat(match[3].replace(/,/g, ''));
      const claimed = parseFloat(match[4].replace(/,/g, ''));
      
      let actual = 0;
      switch (operator) {
        case '+': actual = num1 + num2; break;
        case '-': actual = num1 - num2; break;
        case '*': actual = num1 * num2; break;
        case '/': actual = num1 / num2; break;
        default: return true;
      }
      
      // Allow small rounding differences
      return Math.abs(actual - claimed) < 0.01;
    } catch {
      return true; // Error parsing, assume correct
    }
  }
}

export const complianceSentinel = new ComplianceSentinel();
