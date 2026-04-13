/**
 * Requirement Clarification Service
 * 
 * Analyzes user queries to identify missing context, ambiguities, and nuances
 * that a professional CPA/CA advisor would clarify before providing advice.
 * 
 * CRITICAL: CA GPT ALWAYS asks clarifying questions before providing advice.
 * This is the "inquiry-first" behavior that ensures professional standards.
 * 
 * This makes CA GPT behave like an expert advisor who asks thoughtful questions
 * rather than jumping to generic answers like typical LLMs.
 */

// ============================================================================
// CONFIGURATION-DRIVEN QUERY PATTERNS
// Add new patterns here to extend query detection without modifying logic
// ============================================================================

interface QueryPatternConfig {
  keywords: string[];
  requiredContext: Array<{
    contextKey: keyof ClarificationContext | string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    reason: string;
    question: string;
  }>;
}

/**
 * QUERY_PATTERNS: Configuration for detecting query types and their required context
 * - Each key is a query category
 * - keywords: Terms that indicate this type of query
 * - requiredContext: What context is needed and how important it is
 */
const QUERY_PATTERNS: Record<string, QueryPatternConfig> = {
  // Technology/AI queries - need industry and regulatory context
  technology: {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deploy', 'software', 'saas', 'cloud', 'data', 'automation', 'api', 'platform', 'tech', 'digital'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Technology regulations vary dramatically by country (GDPR, CCPA, AI Act, etc.)',
        question: 'Which jurisdiction/country will this technology operate in?'
      },
      {
        contextKey: 'industrySpecific',
        importance: 'high',
        reason: 'Industry-specific regulations apply (healthcare, finance, etc.)',
        question: 'What industry or sector will use this technology?'
      },
      {
        contextKey: 'businessType',
        importance: 'medium',
        reason: 'Company size and type affects compliance requirements',
        question: 'What type of organization is this for? (startup, enterprise, government, etc.)'
      }
    ]
  },
  
  // Advisory/consulting queries - need scope and jurisdiction
  advisory: {
    keywords: ['advise', 'advice', 'recommend', 'suggest', 'should i', 'best practice', 'strategy', 'plan', 'approach', 'how to', 'what is the best'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Professional advice must be jurisdiction-specific to be accurate',
        question: 'Which jurisdiction/country does this apply to?'
      },
      {
        contextKey: 'entityType',
        importance: 'high',
        reason: 'Advice differs based on individual vs. business vs. government entity',
        question: 'Who is this for? (individual, company, organization type)'
      }
    ]
  },
  
  // Open-ended research queries - need full context
  openEnded: {
    keywords: ['tell me about', 'explain', 'what are', 'how does', 'research', 'analyze', 'investigate', 'study', 'understand'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'high',
        reason: 'Context helps narrow down relevant regulations and standards',
        question: 'Which jurisdiction or region is most relevant to your question?'
      },
      {
        contextKey: 'purpose',
        importance: 'medium',
        reason: 'Understanding your goal helps provide targeted information',
        question: 'What will you use this information for?'
      }
    ]
  },
  
  // Tax queries - existing patterns enhanced
  tax: {
    keywords: ['tax', 'irs', 'hmrc', 'cra', 'ato', 'income tax', 'vat', 'gst', 'sales tax', 'withholding'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Tax rules vary significantly by country, state, and province',
        question: 'Which tax jurisdiction are you asking about? (e.g., US Federal, California, UK, Canada, Australia)'
      },
      {
        contextKey: 'taxYear',
        importance: 'high',
        reason: 'Tax laws change annually and vary by fiscal year',
        question: 'Which tax year are you planning for? (e.g., 2024, 2025)'
      },
      {
        contextKey: 'entityType',
        importance: 'high',
        reason: 'Tax treatment differs dramatically between entity types',
        question: 'What type of taxpayer? (Individual, Corporation, Partnership, Trust, etc.)'
      }
    ]
  },
  
  // Personal tax - requires filing status
  personalTax: {
    keywords: ['my tax', 'personal tax', 'individual tax', 'my return', 'i owe', 'my refund', 'filing status'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Personal tax rules are jurisdiction-specific',
        question: 'Which jurisdiction/country are you filing taxes in?'
      },
      {
        contextKey: 'filingStatus',
        importance: 'high',
        reason: 'Filing status affects deductions, credits, and tax brackets',
        question: 'What is your filing status? (Single, Married, Head of Household, etc.)'
      },
      {
        contextKey: 'taxYear',
        importance: 'high',
        reason: 'Tax rules change yearly',
        question: 'Which tax year is this for?'
      }
    ]
  },
  
  // Business queries
  business: {
    keywords: ['business', 'company', 'corporation', 'llc', 'partnership', 'startup', 'enterprise', 'entity'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Business regulations and tax treatment vary by jurisdiction',
        question: 'In which jurisdiction/country is the business registered or operating?'
      },
      {
        contextKey: 'entityType',
        importance: 'critical',
        reason: 'Tax and compliance requirements differ dramatically between entity types',
        question: 'What type of business entity? (Sole Proprietorship, LLC, S-Corp, C-Corp, Partnership, LLP, etc.)'
      },
      {
        contextKey: 'industrySpecific',
        importance: 'medium',
        reason: 'Industry-specific regulations may apply',
        question: 'What industry is the business in?'
      }
    ]
  },
  
  // Audit queries
  audit: {
    keywords: ['audit', 'examination', 'review', 'inspection', 'compliance check', 'irs audit', 'tax audit'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Audit procedures and taxpayer rights vary by jurisdiction',
        question: 'Which tax authority or jurisdiction is conducting the audit?'
      },
      {
        contextKey: 'entityType',
        importance: 'high',
        reason: 'Audit procedures differ for individuals vs. businesses',
        question: 'Is this an audit of an individual or a business entity?'
      },
      {
        contextKey: 'taxYear',
        importance: 'high',
        reason: 'Relevant rules depend on the period under audit',
        question: 'Which tax year(s) are being audited?'
      }
    ]
  },
  
  // Financial reporting
  financialReporting: {
    keywords: ['financial statement', 'balance sheet', 'income statement', 'cash flow', 'gaap', 'ifrs', 'accounting standard', 'reporting'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'high',
        reason: 'Accounting standards (GAAP vs IFRS) vary by jurisdiction',
        question: 'Which jurisdiction/country\'s accounting standards apply?'
      },
      {
        contextKey: 'accountingMethod',
        importance: 'high',
        reason: 'Cash vs accrual accounting significantly impacts reporting',
        question: 'Which accounting method is used? (Cash basis or Accrual basis)'
      },
      {
        contextKey: 'entityType',
        importance: 'medium',
        reason: 'Reporting requirements vary by entity type and size',
        question: 'What type and size of entity is this for?'
      }
    ]
  },
  
  // Compliance/deadlines
  compliance: {
    keywords: ['deadline', 'due date', 'filing', 'requirement', 'compliance', 'report', 'disclosure', 'form', 'submission'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Filing deadlines and requirements are jurisdiction-specific',
        question: 'Which jurisdiction\'s compliance requirements apply?'
      },
      {
        contextKey: 'entityType',
        importance: 'high',
        reason: 'Compliance requirements differ by entity type',
        question: 'What type of entity? (Individual, Corporation, Partnership, etc.)'
      },
      {
        contextKey: 'taxYear',
        importance: 'high',
        reason: 'Deadlines are specific to tax periods',
        question: 'Which tax year or filing period?'
      }
    ]
  },
  
  // Deduction queries
  deduction: {
    keywords: ['deduct', 'deduction', 'write off', 'expense', 'claim', 'depreciate', 'amortize'],
    requiredContext: [
      {
        contextKey: 'jurisdiction',
        importance: 'critical',
        reason: 'Deduction eligibility and limits vary by jurisdiction',
        question: 'Which tax jurisdiction? Deduction rules vary significantly by country and state.'
      },
      {
        contextKey: 'entityType',
        importance: 'high',
        reason: 'Personal vs. business deduction rules differ significantly',
        question: 'Is this a personal or business deduction?'
      },
      {
        contextKey: 'taxYear',
        importance: 'medium',
        reason: 'Deduction limits change yearly',
        question: 'Which tax year does this apply to?'
      }
    ]
  }
};

/**
 * NUANCE_PATTERNS: Professional considerations by topic area
 * These are insights that a CPA/advisor would naturally consider
 */
const NUANCE_PATTERNS: Record<string, string[]> = {
  homeOffice: [
    'Exclusive and regular use requirement for home office deduction',
    'Simplified vs actual expense method options',
    'Home office deduction may have different rules by jurisdiction'
  ],
  depreciation: [
    'Different depreciation methods available (straight-line, accelerated, etc.)',
    'Special immediate expensing options may exist (Section 179, bonus depreciation in US)',
    'Depreciation recapture implications on future sale'
  ],
  stockEquity: [
    'Holding period affects capital gains treatment',
    'Wash sale or similar rules may apply if selling at a loss',
    'Different treatment for employee stock options vs. regular shares'
  ],
  retirement: [
    'Contribution limits vary by age and plan type',
    'Income thresholds may limit deductibility or eligibility',
    'Early withdrawal penalties and exceptions vary by jurisdiction'
  ],
  realEstate: [
    'Passive activity loss limitations may apply',
    'Special rules for real estate professionals',
    'Like-kind exchange requirements and timing rules'
  ],
  international: [
    'Foreign account reporting requirements may apply',
    'Foreign tax credit vs deduction options',
    'Tax treaty provisions may override general rules'
  ],
  estimatedTax: [
    'Safe harbor rules to avoid underpayment penalties',
    'Annualized income methods may reduce required payments',
    'State/provincial estimated taxes may have different rules'
  ]
};

export interface ClarificationContext {
  jurisdiction?: string;
  taxYear?: string;
  businessType?: string;
  filingStatus?: string;
  industrySpecific?: string;
  accountingMethod?: string;
  entityType?: string;
  stateProvince?: string;
}

export interface MissingContext {
  category: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  suggestedQuestion: string;
}

export interface ClarificationAnalysis {
  needsClarification: boolean;
  confidence: 'low' | 'medium' | 'high';
  missingContext: MissingContext[];
  ambiguities: string[];
  detectedNuances: string[];
  conversationContext: ClarificationContext;
  recommendedApproach: 'clarify' | 'answer' | 'partial_answer_then_clarify';
}

class RequirementClarificationService {
  /**
   * Main analysis entry point
   * Determines if query needs clarification before answering
   */
  analyzeQuery(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): ClarificationAnalysis {
    const lowerQuery = query.toLowerCase();
    
    // Extract any context already provided in conversation
    const conversationContext = this.extractConversationContext(
      query,
      conversationHistory
    );
    
    // Detect missing critical context
    const missingContext = this.detectMissingContext(
      lowerQuery,
      conversationContext
    );
    
    // Check for broad topic-only queries (e.g., "Fixed Assets accounting", "depreciation")
    const broadTopicAnalysis = this.detectBroadTopicQuery(lowerQuery);
    if (broadTopicAnalysis.isBroadTopic) {
      // Add missing context for broad topics
      missingContext.push(...broadTopicAnalysis.missingContext);
    }
    
    // Identify ambiguities
    const ambiguities = this.detectAmbiguities(lowerQuery);
    
    // Detect accounting nuances
    const detectedNuances = this.detectNuances(lowerQuery);
    
    // Determine if we should ask questions or provide answer
    const { needsClarification, confidence, recommendedApproach } = 
      this.determineApproach(missingContext, ambiguities, lowerQuery);
    
    return {
      needsClarification,
      confidence,
      missingContext,
      ambiguities,
      detectedNuances,
      conversationContext,
      recommendedApproach
    };
  }
  
  /**
   * Detect if query is a broad topic without specific question
   * e.g., "Fixed Assets accounting", "depreciation", "revenue recognition"
   */
  private detectBroadTopicQuery(query: string): { 
    isBroadTopic: boolean; 
    missingContext: MissingContext[] 
  } {
    const accountingTopics = [
      'fixed asset', 'fixed assets', 'property plant equipment', 'ppe',
      'depreciation', 'amortization', 'impairment',
      'revenue recognition', 'revenue', 'lease', 'leases', 'leasing',
      'inventory', 'cost of goods', 'cogs',
      'accounts receivable', 'accounts payable', 'accrual',
      'consolidation', 'equity method', 'business combination',
      'fair value', 'financial instruments', 'derivatives',
      'income tax', 'deferred tax', 'contingencies', 'provisions',
      'share-based compensation', 'stock compensation', 'pensions',
      'segment reporting', 'related party', 'earnings per share',
      'statement of cash flows', 'cash flow statement',
      'balance sheet', 'income statement', 'comprehensive income',
      'audit', 'internal control', 'sox', 'materiality'
    ];
    
    // Check if query contains a topic
    const hasTopic = accountingTopics.some(topic => query.includes(topic));
    if (!hasTopic) {
      return { isBroadTopic: false, missingContext: [] };
    }
    
    // Check if query lacks specificity (no question words, very short, just topic + "accounting")
    const hasQuestionIndicators = /\?|how|what|when|why|where|which|should|can i|do i|is it|are there/i.test(query);
    const hasActionIndicators = /calculate|prepare|record|journal|entry|treat|recognize|measure|disclose|report/i.test(query);
    const wordCount = query.trim().split(/\s+/).length;
    
    // If it's just a topic mention (1-4 words, no question/action), it's a broad topic query
    if (!hasQuestionIndicators && !hasActionIndicators && wordCount <= 5) {
      return {
        isBroadTopic: true,
        missingContext: [
          {
            category: 'scope',
            importance: 'critical',
            reason: 'Query is a broad topic without specific question or direction',
            suggestedQuestion: 'What specific aspect of this topic would you like help with? (e.g., initial recognition, measurement, disclosure, journal entries, common issues)'
          },
          {
            category: 'framework',
            importance: 'high',
            reason: 'Accounting treatment varies by framework',
            suggestedQuestion: 'Which accounting framework applies? (US GAAP, IFRS, or a specific country\'s standards)'
          },
          {
            category: 'context',
            importance: 'high',
            reason: 'Context determines the appropriate level of detail',
            suggestedQuestion: 'What is the context? (exam study, preparing financials, audit work, handling a specific transaction)'
          }
        ]
      };
    }
    
    return { isBroadTopic: false, missingContext: [] };
  }
  
  /**
   * Extract context from previous conversation turns
   */
  private extractConversationContext(
    currentQuery: string,
    history: Array<{ role: string; content: string }>
  ): ClarificationContext {
    const context: ClarificationContext = {};
    const fullText = [
      ...history.map(h => h.content),
      currentQuery
    ].join(' ').toLowerCase();
    
    // Extract jurisdiction
    context.jurisdiction = this.extractJurisdiction(fullText);
    
    // Extract tax year
    context.taxYear = this.extractTaxYear(fullText);
    
    // Extract business type
    context.businessType = this.extractBusinessType(fullText);
    
    // Extract filing status
    context.filingStatus = this.extractFilingStatus(fullText);
    
    // Extract entity type
    context.entityType = this.extractEntityType(fullText);
    
    // Extract accounting method
    context.accountingMethod = this.extractAccountingMethod(fullText);
    
    return context;
  }
  
  /**
   * Detect missing critical context based on query type
   * CONFIGURATION-DRIVEN: Uses QUERY_PATTERNS for extensibility
   */
  private detectMissingContext(
    query: string,
    context: ClarificationContext
  ): MissingContext[] {
    const missing: MissingContext[] = [];
    const addedCategories = new Set<string>(); // Prevent duplicates
    
    // Iterate through all configured query patterns
    for (const [patternName, patternConfig] of Object.entries(QUERY_PATTERNS)) {
      // Check if query matches this pattern's keywords
      if (this.matchesPattern(query, patternConfig.keywords)) {
        // Check each required context for this pattern
        for (const required of patternConfig.requiredContext) {
          const contextKey = required.contextKey as keyof ClarificationContext;
          
          // Only add if context is missing AND we haven't already added this category
          if (!this.contextAlreadyProvided(context, contextKey) && !addedCategories.has(required.contextKey)) {
            missing.push({
              category: required.contextKey,
              importance: required.importance,
              reason: required.reason,
              suggestedQuestion: required.question
            });
            addedCategories.add(required.contextKey);
          }
        }
      }
    }
    
    // If no patterns matched but query seems substantive, require basic jurisdiction context
    if (missing.length === 0 && this.isSubstantiveQuery(query)) {
      if (!context.jurisdiction) {
        missing.push({
          category: 'jurisdiction',
          importance: 'high',
          reason: 'Professional advice requires understanding of applicable jurisdiction',
          suggestedQuestion: 'Which jurisdiction or country does this apply to?'
        });
      }
    }
    
    return missing;
  }
  
  /**
   * Check if query matches any of the pattern keywords
   */
  private matchesPattern(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => query.includes(keyword.toLowerCase()));
  }
  
  /**
   * Check if context value is already provided
   */
  private contextAlreadyProvided(context: ClarificationContext, key: keyof ClarificationContext | string): boolean {
    if (key in context) {
      return !!context[key as keyof ClarificationContext];
    }
    return false;
  }
  
  /**
   * Check if this is a substantive query requiring professional context
   * (not just a greeting or simple factual question)
   */
  private isSubstantiveQuery(query: string): boolean {
    const substantiveIndicators = [
      'how', 'what', 'should', 'can i', 'is it', 'do i', 'will', 'would', 
      'need', 'want', 'help', 'advise', 'recommend', 'calculate', 'estimate'
    ];
    const trivialIndicators = ['hello', 'hi', 'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay'];
    
    // Not substantive if it's a trivial message
    if (trivialIndicators.some(t => query.includes(t))) {
      return false;
    }
    
    // Substantive if it has action/question indicators
    return substantiveIndicators.some(i => query.includes(i)) || query.includes('?');
  }
  
  /**
   * Detect ambiguities that need clarification
   */
  private detectAmbiguities(query: string): string[] {
    const ambiguities: string[] = [];
    
    // Vague terms
    if (query.includes('recently') || query.includes('soon')) {
      ambiguities.push('Timeframe is vague - specific dates/years matter for tax purposes');
    }
    
    if (query.includes('significant') || query.includes('large') || query.includes('substantial')) {
      ambiguities.push('Amount/threshold matters - specific dollar amounts determine tax treatment');
    }
    
    if (query.includes('my business') && !this.hasEntityTypeIndicators(query)) {
      ambiguities.push('Business structure unclear - tax treatment varies by entity type');
    }
    
    // Only flag personal vs business ambiguity if no clear indicators present
    if (query.includes('deduct') && 
        !query.includes('personal') && 
        !query.includes('business') &&
        !this.hasPersonalTaxIndicators(query) &&
        !this.hasEntityTypeIndicators(query)) {
      ambiguities.push('Personal vs business deduction unclear - rules differ significantly');
    }
    
    if (query.includes('income') && !this.hasIncomeTypeIndicators(query)) {
      ambiguities.push('Type of income unclear - ordinary income, capital gains, passive income have different tax treatments');
    }
    
    return ambiguities;
  }
  
  /**
   * Detect nuances that professional advisors would consider
   * CONFIGURATION-DRIVEN: Uses NUANCE_PATTERNS for extensibility
   */
  private detectNuances(query: string): string[] {
    const nuances: string[] = [];
    
    // Map query terms to nuance pattern keys
    const nuanceKeywords: Record<string, string[]> = {
      homeOffice: ['home office', 'work from home', 'remote work'],
      depreciation: ['depreciat', 'amortiz', 'asset', 'equipment'],
      stockEquity: ['stock', 'equity', 'shares', 'options', 'vesting'],
      retirement: ['401k', 'ira', 'roth', 'pension', 'retirement'],
      realEstate: ['rental', 'real estate', 'property', 'landlord', '1031'],
      international: ['foreign', 'international', 'overseas', 'expat', 'treaty'],
      estimatedTax: ['estimated', 'quarterly', 'prepay', 'underpayment']
    };
    
    // Check each nuance category
    for (const [nuanceKey, keywords] of Object.entries(nuanceKeywords)) {
      if (keywords.some(kw => query.includes(kw))) {
        const patternNuances = NUANCE_PATTERNS[nuanceKey];
        if (patternNuances) {
          nuances.push(...patternNuances);
        }
      }
    }
    
    return nuances;
  }
  
  /**
   * Determine whether to clarify or answer
   * 
   * INQUIRY-FIRST RULE: CA GPT ALWAYS asks clarifying questions when critical 
   * or high-importance context is missing. This is non-negotiable professional behavior.
   * 
   * We don't provide partial answers - we ask first, then answer with full context.
   */
  private determineApproach(
    missingContext: MissingContext[],
    ambiguities: string[],
    query: string
  ): {
    needsClarification: boolean;
    confidence: 'low' | 'medium' | 'high';
    recommendedApproach: 'clarify' | 'answer' | 'partial_answer_then_clarify';
  } {
    const criticalMissing = missingContext.filter(m => m.importance === 'critical');
    const highMissing = missingContext.filter(m => m.importance === 'high');
    
    // INQUIRY-FIRST: ANY critical context missing = MUST clarify first
    if (criticalMissing.length > 0) {
      return {
        needsClarification: true,
        confidence: 'low',
        recommendedApproach: 'clarify' // Pure clarify - no partial answers with assumptions
      };
    }
    
    // High importance context missing = clarify first
    if (highMissing.length > 0) {
      return {
        needsClarification: true,
        confidence: 'medium',
        recommendedApproach: 'clarify' // Ask first, don't assume
      };
    }
    
    // General information query with sufficient context - can answer directly
    if (this.isGeneralInformationQuery(query)) {
      return {
        needsClarification: false,
        confidence: 'high',
        recommendedApproach: 'answer'
      };
    }
    
    // Sufficient context to answer
    return {
      needsClarification: false,
      confidence: 'high',
      recommendedApproach: 'answer'
    };
  }
  
  // Helper methods for query classification
  private isTaxQuery(query: string): boolean {
    return query.includes('tax') || query.includes('deduction') || 
           query.includes('credit') || query.includes('irs') ||
           query.includes('filing') || query.includes('return');
  }
  
  private isPersonalTaxQuery(query: string): boolean {
    return (query.includes('my') || query.includes('personal') || 
            query.includes('individual')) && this.isTaxQuery(query);
  }
  
  private isBusinessQuery(query: string): boolean {
    return query.includes('business') || query.includes('company') ||
           query.includes('corporation') || query.includes('llc') ||
           query.includes('partnership') || query.includes('entity');
  }
  
  private isDeductionQuery(query: string): boolean {
    return query.includes('deduct') || query.includes('write off') ||
           query.includes('expense') || query.includes('claim');
  }
  
  private isComplianceQuery(query: string): boolean {
    return query.includes('deadline') || query.includes('filing') ||
           query.includes('requirement') || query.includes('compliance') ||
           query.includes('report') || query.includes('disclosure');
  }
  
  private isFinancialReportingQuery(query: string): boolean {
    return query.includes('financial statement') || query.includes('balance sheet') ||
           query.includes('income statement') || query.includes('cash flow') ||
           query.includes('gaap') || query.includes('ifrs');
  }
  
  private isGeneralInformationQuery(query: string): boolean {
    const generalIndicators = [
      'what is', 'what are', 'explain', 'define', 'tell me about',
      'how does', 'difference between', 'compare'
    ];
    return generalIndicators.some(indicator => query.includes(indicator));
  }
  
  private hasEntityTypeIndicators(query: string): boolean {
    const indicators = [
      'llc', 's-corp', 's corp', 'c-corp', 'c corp', 'corporation',
      'partnership', 'sole proprietor', 'proprietorship'
    ];
    return indicators.some(indicator => query.includes(indicator));
  }
  
  private hasPersonalTaxIndicators(query: string): boolean {
    const indicators = [
      'single', 'married', 'filing jointly', 'filing separately',
      'head of household', 'qualifying widow', 'individual',
      'personal return', 'my return', 'standard deduction',
      'itemized deduction', 'filer', 'filing status'
    ];
    return indicators.some(indicator => query.includes(indicator));
  }
  
  private hasIncomeTypeIndicators(query: string): boolean {
    const indicators = [
      'salary', 'wage', 'capital gain', 'dividend', 'interest',
      'rental', 'passive', 'active', 'ordinary', 'self-employment'
    ];
    return indicators.some(indicator => query.includes(indicator));
  }
  
  // Context extraction helpers
  private extractJurisdiction(text: string): string | undefined {
    const jurisdictions = [
      'us federal', 'california', 'new york', 'texas', 'florida',
      'canada', 'ontario', 'quebec', 'british columbia',
      'uk', 'united kingdom', 'australia', 'india'
    ];
    
    for (const jurisdiction of jurisdictions) {
      if (text.includes(jurisdiction)) {
        return jurisdiction;
      }
    }
    
    return undefined;
  }
  
  private extractTaxYear(text: string): string | undefined {
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return yearMatch[1];
    }
    
    if (text.includes('this year') || text.includes('current year')) {
      return new Date().getFullYear().toString();
    }
    
    if (text.includes('next year')) {
      return (new Date().getFullYear() + 1).toString();
    }
    
    return undefined;
  }
  
  private extractBusinessType(text: string): string | undefined {
    const types = [
      'retail', 'restaurant', 'consulting', 'technology', 'manufacturing',
      'real estate', 'healthcare', 'construction', 'professional services'
    ];
    
    for (const type of types) {
      if (text.includes(type)) {
        return type;
      }
    }
    
    return undefined;
  }
  
  private extractFilingStatus(text: string): string | undefined {
    const statuses = [
      'single', 'married filing jointly', 'married filing separately',
      'head of household', 'qualifying widow'
    ];
    
    for (const status of statuses) {
      if (text.includes(status)) {
        return status;
      }
    }
    
    return undefined;
  }
  
  private extractEntityType(text: string): string | undefined {
    const entities = [
      's-corp', 's corp', 'c-corp', 'c corp', 'llc',
      'partnership', 'sole proprietorship', 'corporation'
    ];
    
    for (const entity of entities) {
      if (text.includes(entity)) {
        return entity;
      }
    }
    
    return undefined;
  }
  
  private extractAccountingMethod(text: string): string | undefined {
    if (text.includes('cash basis') || text.includes('cash method')) {
      return 'cash';
    }
    
    if (text.includes('accrual basis') || text.includes('accrual method')) {
      return 'accrual';
    }
    
    return undefined;
  }
  
  /**
   * Generate clarifying questions based on analysis
   * BALANCED: Smart questions for critical/high items, skip obvious ambiguities
   */
  generateClarifyingQuestions(analysis: ClarificationAnalysis): string[] {
    const questions: string[] = [];
    
    // Add contextual questions for critical and high importance items
    // But make them intelligent by referencing conversation context
    analysis.missingContext
      .filter(m => m.importance === 'critical' || m.importance === 'high')
      .forEach(m => {
        const contextualQuestion = this.makeQuestionContextual(
          m.suggestedQuestion,
          m.category,
          analysis.conversationContext
        );
        // Only add non-obvious questions
        if (!this.isObviousQuestion(contextualQuestion, analysis.conversationContext)) {
          questions.push(contextualQuestion);
        }
      });
    
    // If no questions were generated but we're likely in a research scenario,
    // add default research context questions
    if (questions.length === 0) {
      // Add essential research questions based on what's missing
      if (!analysis.conversationContext.taxYear) {
        questions.push('Which tax year are you planning for? (e.g., 2024, 2025)');
      }
      if (!analysis.conversationContext.jurisdiction) {
        questions.push('Which jurisdiction/country does this apply to?');
      }
      if (!analysis.conversationContext.entityType && !analysis.conversationContext.businessType) {
        questions.push('What type of entity or business is this for? (e.g., individual, corporation, partnership)');
      }
      if (!analysis.conversationContext.industrySpecific) {
        questions.push('What industry or sector is relevant? (if applicable)');
      }
    }
    
    // Return ALL questions needed to fully delineate the scope
    // No artificial limits - professional inquiry requires complete context
    return questions;
  }
  
  /**
   * Make questions more contextual and intelligent
   */
  private makeQuestionContextual(
    question: string,
    category: string,
    context: ClarificationContext
  ): string {
    // Reference existing context to make questions smarter
    if (context.businessType && category === 'entity_type') {
      return `You mentioned a ${context.businessType} - is this a specific legal entity type like LLC, S-Corp, or C-Corp?`;
    }
    
    if (context.jurisdiction && category === 'jurisdiction') {
      return `I see you're in ${context.jurisdiction} - which specific state/province applies here?`;
    }
    
    // Otherwise return the original question
    return question;
  }
  
  /**
   * Filter out obvious questions that waste user's time
   */
  private isObviousQuestion(question: string, context: ClarificationContext): boolean {
    const lower = question.toLowerCase();
    
    // Skip if we're asking about something already mentioned
    if (lower.includes('jurisdiction') && context.jurisdiction) return true;
    if (lower.includes('tax year') && context.taxYear) return true;
    if (lower.includes('entity type') && context.entityType) return true;
    
    // Skip overly generic questions like "tell me more"
    if (lower.includes('tell me more') || lower.includes('any other')) return true;
    
    return false;
  }
}

// DEPRECATED: Use requirementClarificationAIService from requirementClarificationAI.ts
// This export is kept for backward compatibility only
export const requirementClarificationService = new RequirementClarificationService();

// Re-export from new AI-driven service for easier migration
export { 
  requirementClarificationAIService,
  type ClarificationAnalysis as ClarificationAnalysisAI,
  type ClarificationContext as ClarificationContextAI,
  type MissingContext as MissingContextAI
} from './requirementClarificationAI';
