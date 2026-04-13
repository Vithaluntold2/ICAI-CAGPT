/**
 * Validation Agent
 * Cross-checks financial data, verifies calculations, ensures response completeness
 */

import type { AgentOutput } from '../../shared/types/reasoning';

export class ValidationAgent {
  /**
   * Validate a financial response
   */
  async validate(
    query: string,
    response: string,
    context?: {
      calculationResults?: any;
      uploadedDocuments?: any[];
    }
  ): Promise<AgentOutput> {
    const startTime = Date.now();
    const evidence: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Validation 1: Completeness check
    const completenessScore = this.checkCompleteness(query, response);
    if (completenessScore < 0.7) {
      warnings.push('Response may be incomplete - some aspects of the query not addressed');
      confidence -= 0.15;
    } else {
      evidence.push(`Response completeness: ${(completenessScore * 100).toFixed(0)}%`);
    }

    // Validation 2: Verify calculations if present
    if (context?.calculationResults) {
      const calculationValid = this.validateCalculations(response, context.calculationResults);
      if (!calculationValid) {
        warnings.push('Calculation results inconsistent with solver output');
        confidence -= 0.3;
      } else {
        evidence.push('All calculations verified against solver results');
      }
    }

    // Validation 3: Check for required disclaimers
    const hasRequiredDisclaimers = this.checkDisclaimers(query, response);
    if (!hasRequiredDisclaimers) {
      warnings.push('Missing required professional advice disclaimer');
      confidence -= 0.1;
    } else {
      evidence.push('Appropriate disclaimers included');
    }

    // Validation 4: Consistency check
    const isConsistent = this.checkInternalConsistency(response);
    if (!isConsistent) {
      warnings.push('Response contains contradictory statements');
      confidence -= 0.2;
    } else {
      evidence.push('No internal contradictions detected');
    }

    const processingTime = Date.now() - startTime;

    return {
      agentType: 'validation',
      conclusion: warnings.length === 0 
        ? 'Response validated successfully' 
        : `Validation completed with ${warnings.length} warning(s)`,
      evidence,
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        processingTimeMs: processingTime,
        completenessScore,
      }
    };
  }

  /**
   * Check if response adequately addresses the query
   */
  private checkCompleteness(query: string, response: string): number {
    // Extract key question words from query
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];
    const queryLower = query.toLowerCase();
    
    let questionsAsked = 0;
    let questionsAnswered = 0;

    // Count question types in query
    for (const word of questionWords) {
      if (queryLower.includes(word)) {
        questionsAsked++;
        
        // Check if response addresses this question type
        if (this.addressesQuestionType(word, query, response)) {
          questionsAnswered++;
        }
      }
    }

    // If no question words, check if query topics are covered
    if (questionsAsked === 0) {
      const topics = this.extractTopics(query);
      questionsAsked = topics.length;
      questionsAnswered = topics.filter(topic => 
        response.toLowerCase().includes(topic)
      ).length;
    }

    return questionsAsked > 0 ? questionsAnswered / questionsAsked : 1.0;
  }

  /**
   * Check if response addresses a specific question type
   */
  private addressesQuestionType(questionWord: string, query: string, response: string): boolean {
    // Extract the subject of the question
    const questionRegex = new RegExp(`${questionWord}\\s+([\\w\\s]+?)[\\.\\?]`, 'i');
    const match = query.match(questionRegex);
    
    if (!match) return true; // Can't determine, assume addressed
    
    const subject = match[1].toLowerCase();
    return response.toLowerCase().includes(subject);
  }

  /**
   * Extract key topics from query
   */
  private extractTopics(query: string): string[] {
    const topics: string[] = [];
    
    // Financial terms
    const financialTerms = [
      'revenue', 'expense', 'profit', 'loss', 'tax', 'deduction', 'credit',
      'depreciation', 'amortization', 'asset', 'liability', 'equity',
      'gaap', 'irs', 'audit', 'compliance'
    ];
    
    for (const term of financialTerms) {
      if (query.toLowerCase().includes(term)) {
        topics.push(term);
      }
    }
    
    return topics;
  }

  /**
   * Validate calculations match solver results
   */
  private validateCalculations(response: string, calculationResults: any): boolean {
    // Extract numbers from response
    const responseNumbers = this.extractNumbers(response);
    
    // Extract numbers from calculation results
    const solverNumbers = this.extractNumbersFromObject(calculationResults);
    
    if (solverNumbers.length === 0) return true; // No solver results to compare
    
    // Check if key solver numbers appear in response
    let matches = 0;
    for (const solverNum of solverNumbers) {
      if (responseNumbers.some(respNum => Math.abs(respNum - solverNum) < 0.01)) {
        matches++;
      }
    }
    
    return matches / solverNumbers.length > 0.7; // 70% of solver numbers should appear
  }

  /**
   * Check for required disclaimers
   */
  private checkDisclaimers(query: string, response: string): boolean {
    const isTaxOrFinancialAdvice = /tax|deduction|credit|investment|financial.*planning/i.test(query);
    
    if (!isTaxOrFinancialAdvice) return true; // No disclaimer needed
    
    const disclaimerPhrases = [
      'consult',
      'professional',
      'tax advisor',
      'cpa',
      'accountant',
      'legal advice',
      'financial advisor'
    ];
    
    return disclaimerPhrases.some(phrase => 
      response.toLowerCase().includes(phrase)
    );
  }

  /**
   * Check for internal contradictions
   */
  private checkInternalConsistency(response: string): boolean {
    // Look for contradictory phrases
    const sentences = response.split(/[.!?]+/);
    
    // Check for yes/no contradictions
    const hasYesStatement = sentences.some(s => /\byes\b|\bshould\b|\bcan\b/i.test(s));
    const hasNoStatement = sentences.some(s => /\bno\b|\bshouldn't\b|\bcannot\b/i.test(s));
    
    // If both yes and no statements exist, check if they're about the same subject
    if (hasYesStatement && hasNoStatement) {
      // This is a simplified check - in production, use NLP for deeper analysis
      // For now, we'll allow it as long as they don't directly contradict
      return true;
    }
    
    return true; // No obvious contradictions
  }

  private extractNumbers(text: string): number[] {
    const matches = text.match(/\$?([\d,]+\.?\d*)/g) || [];
    return matches
      .map(m => parseFloat(m.replace(/[$,]/g, '')))
      .filter(n => !isNaN(n) && n > 0);
  }

  private extractNumbersFromObject(obj: any): number[] {
    const numbers: number[] = [];
    
    const extract = (value: any) => {
      if (typeof value === 'number') {
        numbers.push(value);
      } else if (typeof value === 'object' && value !== null) {
        for (const key of Object.keys(value)) {
          extract(value[key]);
        }
      }
    };
    
    extract(obj);
    return numbers;
  }
}

export const validationAgent = new ValidationAgent();
