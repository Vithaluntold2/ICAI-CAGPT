                                                                                        /**
 * Intelligent Query Triage System
 * Classifies accounting queries by domain and complexity to route to optimal models and providers
 */

import { AIProviderName } from './aiProviders';

export interface QueryClassification {
  domain: 'tax' | 'audit' | 'financial_reporting' | 'compliance' | 'general_accounting' | 'advisory';
  subDomain?: string;
  jurisdiction?: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiresCalculation: boolean;
  requiresResearch: boolean;
  requiresDocumentAnalysis: boolean;
  requiresRealTimeData: boolean;
  requiresDeepReasoning: boolean;
  isCasualMessage: boolean;  // Greetings, thanks, simple acknowledgments
  keywords: string[];
  confidence: number;
}

export interface RoutingDecision {
  primaryModel: string;
  preferredProvider: AIProviderName;
  fallbackProviders: AIProviderName[];
  fallbackModels: string[];
  solversNeeded: string[];
  estimatedTokens: number;
  reasoning: string;
}

export interface QueryContext {
  hasDocument?: boolean;
  documentType?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class QueryTriageService {
  /**
   * Classifies a user query into accounting domain and complexity
   */
  classifyQuery(query: string, context?: QueryContext): QueryClassification {
    const lowerQuery = query.toLowerCase();
    
    // Domain classification
    const domain = this.detectDomain(lowerQuery);
    const subDomain = this.detectSubDomain(lowerQuery, domain);
    const jurisdiction = this.detectJurisdiction(lowerQuery, context?.conversationHistory);
    const complexity = this.assessComplexity(lowerQuery);
    const requiresCalculation = this.needsCalculation(lowerQuery);
    const requiresResearch = this.needsResearch(lowerQuery);
    // If context indicates document attachment, automatically require document analysis
    const requiresDocumentAnalysis = context?.hasDocument || this.needsDocumentAnalysis(lowerQuery);
    const requiresRealTimeData = this.needsRealTimeData(lowerQuery);
    const requiresDeepReasoning = this.needsDeepReasoning(lowerQuery, complexity);
    const isCasualMessage = this.isCasualOrGreeting(lowerQuery);
    const keywords = this.extractKeywords(lowerQuery);
    
    return {
      domain,
      subDomain,
      jurisdiction,
      complexity: isCasualMessage ? 'simple' : complexity, // Force simple for casual
      requiresCalculation,
      requiresResearch: isCasualMessage ? false : requiresResearch, // No research for greetings
      requiresDocumentAnalysis,
      requiresRealTimeData,
      requiresDeepReasoning: isCasualMessage ? false : requiresDeepReasoning,
      isCasualMessage,
      keywords,
      confidence: this.calculateConfidence(lowerQuery, domain)
    };
  }

  /**
   * Routes query to optimal model and provider based on classification
   * NOTE: Currently only using Azure OpenAI - other providers disabled pending API key setup
   */
  routeQuery(classification: QueryClassification, userTier: string, hasAttachment: boolean = false): RoutingDecision {
    let primaryModel = 'gpt-4o-mini';
    // Use Azure OpenAI as the primary provider - other providers disabled for now
    let preferredProvider: AIProviderName = AIProviderName.AZURE_OPENAI;
    // Only use OpenAI as fallback (no Gemini/Claude/Perplexity until API keys configured)
    const fallbackProviders: AIProviderName[] = [];
    const fallbackModels: string[] = [];
    const solversNeeded: string[] = [];
    
    // Provider selection - Azure OpenAI only mode (other providers disabled)
    // When other provider API keys are configured, this logic can be re-enabled
    if (classification.requiresDocumentAnalysis && hasAttachment) {
      // Azure Document Intelligence for document parsing (only when attachment exists)
      preferredProvider = AIProviderName.AZURE_DOCUMENT_INTELLIGENCE;
      fallbackProviders.push(AIProviderName.AZURE_OPENAI);
      solversNeeded.push('document-parser');
    } else if (classification.requiresRealTimeData || classification.requiresResearch) {
      // Use Azure OpenAI for research (Perplexity disabled)
      preferredProvider = AIProviderName.AZURE_OPENAI;
      primaryModel = 'gpt-4o'; // Use full GPT-4o for research tasks
      if (classification.requiresResearch) {
        solversNeeded.push('tax-case-law-search');
      }
    } else if (classification.requiresDeepReasoning || classification.complexity === 'expert') {
      // Use Azure OpenAI GPT-4o for deep reasoning (Claude disabled)
      preferredProvider = AIProviderName.AZURE_OPENAI;
      primaryModel = 'gpt-4o'; // Full GPT-4o for complex queries
      fallbackModels.push('gpt-4o-mini');
    } else if (classification.complexity === 'simple' || classification.complexity === 'moderate') {
      // Azure OpenAI for cost-effective queries
      preferredProvider = AIProviderName.AZURE_OPENAI;
      primaryModel = 'gpt-4o-mini';
      fallbackModels.push('gpt-4o');
    } else {
      // Default: Azure OpenAI for general queries
      preferredProvider = AIProviderName.AZURE_OPENAI;
      primaryModel = 'gpt-4o-mini';
    }
    
    // Domain-specific model selection (overrides for enterprise tier)
    if (classification.domain === 'tax') {
      primaryModel = userTier === 'enterprise' ? 'luca-tax-expert' : primaryModel;
      
      if (classification.subDomain?.includes('international')) {
        solversNeeded.push('multi-jurisdiction-tax');
      }
      if (classification.requiresCalculation) {
        solversNeeded.push('tax-calculator');
      }
    } else if (classification.domain === 'audit') {
      primaryModel = userTier === 'enterprise' ? 'luca-audit-expert' : primaryModel;
      solversNeeded.push('risk-assessment');
      if (classification.requiresCalculation) {
        solversNeeded.push('materiality-calculator');
      }
    } else if (classification.domain === 'financial_reporting') {
      if (classification.subDomain?.includes('gaap') || classification.subDomain?.includes('ifrs')) {
        solversNeeded.push('standards-lookup');
      }
      if (classification.requiresCalculation) {
        solversNeeded.push('financial-metrics');
      }
    } else if (classification.domain === 'compliance') {
      solversNeeded.push('regulatory-check');
      if (classification.jurisdiction) {
        solversNeeded.push('jurisdiction-rules');
      }
    }
    
    // Always add financial calculator for any calculation needs
    if (classification.requiresCalculation && !solversNeeded.includes('tax-calculator')) {
      solversNeeded.push('financial-calculator');
    }
    
    // Ensure Azure OpenAI is always the fallback
    if (preferredProvider !== AIProviderName.AZURE_OPENAI && !fallbackProviders.includes(AIProviderName.AZURE_OPENAI)) {
      fallbackProviders.push(AIProviderName.AZURE_OPENAI);
    }
    // Note: Gemini, Claude, Perplexity removed from fallback chain - add back when API keys configured
    
    const estimatedTokens = this.estimateTokenUsage(classification, primaryModel);
    const reasoning = this.buildRoutingReason(classification, primaryModel, preferredProvider, solversNeeded);
    
    return {
      primaryModel,
      preferredProvider,
      fallbackProviders,
      fallbackModels,
      solversNeeded,
      estimatedTokens,
      reasoning
    };
  }

  private detectDomain(query: string): QueryClassification['domain'] {
    const taxKeywords = ['tax', 'deduction', 'credit', 'irs', 'cra', 'hmrc', 'vat', 'gst', 'income tax', 'corporate tax', 'withholding'];
    const auditKeywords = ['audit', 'assurance', 'verification', 'material', 'risk assessment', 'internal control'];
    const reportingKeywords = ['gaap', 'ifrs', 'financial statement', 'balance sheet', 'income statement', 'cash flow'];
    const complianceKeywords = ['compliance', 'regulation', 'sox', 'sec', 'filing', 'disclosure'];
    
    if (taxKeywords.some(kw => query.includes(kw))) return 'tax';
    if (auditKeywords.some(kw => query.includes(kw))) return 'audit';
    if (reportingKeywords.some(kw => query.includes(kw))) return 'financial_reporting';
    if (complianceKeywords.some(kw => query.includes(kw))) return 'compliance';
    
    return 'general_accounting';
  }

  private detectSubDomain(query: string, domain: string): string | undefined {
    if (domain === 'tax') {
      if (query.includes('international') || query.includes('transfer pricing') || query.includes('treaty')) {
        return 'international_tax';
      }
      if (query.includes('corporate') || query.includes('c-corp') || query.includes('s-corp')) {
        return 'corporate_tax';
      }
      if (query.includes('individual') || query.includes('personal')) {
        return 'individual_tax';
      }
      if (query.includes('sales tax') || query.includes('vat') || query.includes('gst')) {
        return 'indirect_tax';
      }
    }
    
    if (domain === 'financial_reporting') {
      if (query.includes('gaap')) return 'us_gaap';
      if (query.includes('ifrs')) return 'ifrs';
    }
    
    return undefined;
  }

  private detectJurisdiction(query: string, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): string[] {
    // Each keyword is compiled to a WORD-BOUNDARY regex so that short tokens
    // like 'us', 'uk', 'eu', 'hk', 'ato' don't match inside words like
    // "business", "trust", "use", "european", "indicator", "Plato".
    // Anchors (Section 139, ITR-1, GSTR, Form 1040, HMRC, SPICe+ etc.) make
    // jurisdiction detection robust against false positives from common English
    // words that happen to contain the 2-letter country code as a substring.
    const jurisdictionMap: Record<string, string[]> = {
      // India FIRST so robust anchors beat loose US substrings on later turns.
      'india': [
        'india', 'indian',
        'income[- ]?tax act', 'it act',
        'cbdt', 'cbic',
        'itr[- ]?[1-7]?', 'itr\\s*form',
        'gstr[- ]?[0-9a-z]+', 'gstin',
        'tds', 'tcs',
        'section\\s*(10|80[a-z]*|139|194[a-z]*|234[abc]|44a[a-z]*|87a|54[a-z]*|115bac)',
        'assessment\\s*year', 'ay\\s*20\\d{2}[- ]?2?\\d?',
        'fy\\s*20\\d{2}[- ]?2?\\d?',
        'rupees?', '₹',
        'aadhaar', 'pan\\s*card',
        'spice\\+', 'roc', 'mca',
        'din(?:\\s*number)?', 'dsc',
        'evc', 'form\\s*26as', 'ais', 'tis'
      ],
      'us': [
        'united states', 'u\\.s\\.a?', 'usa',
        'irs', 'internal revenue service',
        'form\\s*1040', 'w-?2', '1099-[a-z]+', '401\\s*\\(?k\\)?',
        'delaware', 'california', 'new york',
        'federal\\s*tax', 'fica', 'ssn'
      ],
      'canada': ['canada', 'canadian', 'cra', 'cpp', 'rrsp', 't4\\s*slip'],
      'uk': ['united kingdom', 'britain', 'british', 'hmrc', 'paye', 'vat\\s*uk', 'self\\s*assessment', 'sa100'],
      'eu': ['european union', 'eu\\s*directive', 'europe\\s*vat'],
      'australia': ['australia', 'australian', 'ato', 'mygov', 'mytax', 'abn', 'paygw?', 'stp'],
      'china': ['china', 'chinese', 'prc\\s*tax'],
      'singapore': ['singapore', 'iras\\s*singapore'],
      'hong_kong': ['hong\\s*kong', 'hksar', 'ird\\s*hk']
    };

    // Build compiled patterns ONCE (word-boundary where applicable).
    // \b doesn't work around non-ASCII like ₹, so we allow either word-boundary
    // OR surrounding whitespace/punctuation.
    const compiled: Array<[string, RegExp[]]> = Object.entries(jurisdictionMap).map(([j, kws]) => [
      j,
      kws.map(kw => new RegExp(`(?:^|\\W)(?:${kw})(?:$|\\W)`, 'i')),
    ]);

    const scanText = (text: string): string | null => {
      for (const [jurisdiction, patterns] of compiled) {
        if (patterns.some(re => re.test(text))) return jurisdiction;
      }
      return null;
    };

    // 1) Current query
    const fromQuery = scanText(query);
    if (fromQuery) return [fromQuery];

    // 2) Conversation history, most recent first. Assistant messages matter
    //    just as much as user messages — an assistant Turn 1 full of
    //    India-specific anchors is strong signal the conversation is Indian.
    if (conversationHistory && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        const found = scanText(msg.content || '');
        if (found) {
          console.log(`[QueryTriage] Jurisdiction '${found}' inferred from conversation history (turn ${i}, role ${msg.role})`);
          return [found];
        }
      }
    }

    // 3) No signal — return empty; prompt builder handles the missing case.
    return [];
  }

  private assessComplexity(query: string): QueryClassification['complexity'] {
    let complexityScore = 0;
    
    // Length indicates complexity
    if (query.length > 200) complexityScore += 2;
    else if (query.length > 100) complexityScore += 1;
    
    // Multiple questions
    if ((query.match(/\?/g) || []).length > 1) complexityScore += 1;
    
    // Technical terms
    const technicalTerms = ['consolidation', 'derivative', 'hedge', 'impairment', 'amortization', 
      'depreciation', 'transfer pricing', 'treaty', 'apportionment'];
    if (technicalTerms.some(term => query.includes(term))) complexityScore += 2;
    
    // Multiple jurisdictions
    if ((query.match(/and|&/g) || []).length > 1) complexityScore += 1;
    
    if (complexityScore >= 5) return 'expert';
    if (complexityScore >= 3) return 'complex';
    if (complexityScore >= 1) return 'moderate';
    return 'simple';
  }

  private needsCalculation(query: string): boolean {
    const calcKeywords = ['calculate', 'compute', 'how much', 'what is the', 'rate', 'amount', 
      'total', 'sum', 'npv', 'irr', 'depreciation', 'amortization', 'payment'];
    return calcKeywords.some(kw => query.includes(kw));
  }

  private needsResearch(query: string): boolean {
    const researchKeywords = [
      // Legal & Regulatory Research
      'case law', 'precedent', 'ruling', 'regulation', 'standard', 'guidance', 'interpretation',
      
      // General Research Patterns
      'research', 'find out', 'look up', 'search for', 'tell me about', 'information on',
      'details about', 'data on', 'statistics', 'trends', 'analysis', 'study', 'report',
      
      // Comparative Research
      'comparison', 'compare', 'difference between', 'versus', 'vs', 'contrast',
      'how does', 'which is better', 'advantages of', 'disadvantages of',
      
      // Market & Industry Research
      'market', 'industry', 'sector', 'competitors', 'competitive', 'benchmark',
      'best practices', 'industry standard', 'market trends', 'market data',
      
      // Current Events & News
      'news', 'updates', 'recent developments', 'what happened', 'announcement',
      'press release', 'breaking', 'new regulations', 'changes in',
      
      // Historical & Trend Analysis
      'history of', 'historical', 'evolution', 'over time', 'trend', 'patterns',
      'how has', 'track record', 'performance over',
      
      // Expert Opinion & Advisory
      'expert opinion', 'what do experts', 'according to', 'sources say',
      'professional view', 'industry experts', 'thought leaders',
      
      // Specific Accounting Research
      'accounting treatment', 'irs position', 'gaap guidance', 'ifrs guidance',
      'fasb', 'iasb', 'sec guidance', 'revenue recognition', 'lease accounting'
    ];
    return researchKeywords.some(kw => query.includes(kw));
  }

  private needsDocumentAnalysis(query: string): boolean {
    const docKeywords = ['analyze', 'review', 'document', 'statement', 'receipt', 'invoice', 
      'contract', 'extract', 'parse'];
    return docKeywords.some(kw => query.includes(kw));
  }

  private needsRealTimeData(query: string): boolean {
    const realtimeKeywords = [
      // Time-sensitive queries
      'current', 'latest', 'recent', 'today', 'now', 'real-time', 'live',
      'current rate', 'latest ruling', 'recent changes', 'up to date', 'updated',
      
      // Date-specific
      '2024', '2025', 'this year', 'this month', 'this week', 'right now',
      
      // Market data
      'stock price', 'exchange rate', 'currency', 'forex', 'market cap',
      'trading', 'index', 'commodity price',
      
      // News & Updates
      'breaking', 'just announced', 'new law', 'new regulation', 'recent announcement',
      'upcoming', 'scheduled', 'deadline',
      
      // Status & Availability
      'is available', 'currently', 'as of', 'status of', 'still valid'
    ];
    return realtimeKeywords.some(kw => query.includes(kw));
  }

  private needsDeepReasoning(query: string, complexity: QueryClassification['complexity']): boolean {
    // Expert complexity always needs deep reasoning
    if (complexity === 'expert' || complexity === 'complex') return true;
    
    // Multi-step problems need deep reasoning
    const reasoningKeywords = ['explain why', 'compare', 'evaluate', 'analyze the impact', 
      'what would happen if', 'should i', 'best approach', 'recommend', 'strategy'];
    return reasoningKeywords.some(kw => query.includes(kw));
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'is', 'are', 'was', 'were', 'what', 'how', 'can', 'could', 'should']);
    
    return query
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Detects casual messages like greetings, thanks, simple acknowledgments
   * These should get short, friendly responses - NOT comprehensive research reports
   */
  private isCasualOrGreeting(query: string): boolean {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Very short messages are likely casual
    if (trimmedQuery.length < 15) {
      // Greetings
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 
        'howdy', 'greetings', 'sup', 'yo', 'hola', 'namaste', 'hii', 'hiii', 'heya'];
      if (greetings.some(g => trimmedQuery === g || trimmedQuery.startsWith(g + ' ') || trimmedQuery.startsWith(g + '!'))) {
        return true;
      }
      
      // Thanks
      const thanks = ['thanks', 'thank you', 'thx', 'ty', 'appreciated', 'great', 'awesome', 
        'perfect', 'got it', 'ok', 'okay', 'sure', 'yes', 'no', 'cool', 'nice'];
      if (thanks.some(t => trimmedQuery === t || trimmedQuery.startsWith(t + ' ') || trimmedQuery.startsWith(t + '!'))) {
        return true;
      }
      
      // Farewells
      const farewells = ['bye', 'goodbye', 'see you', 'later', 'take care', 'cya'];
      if (farewells.some(f => trimmedQuery === f || trimmedQuery.startsWith(f + ' '))) {
        return true;
      }
    }
    
    // Simple acknowledgment patterns
    const casualPatterns = [
      /^(hi|hello|hey)\s*(there|luca)?[!.\s]*$/i,
      /^(thanks|thank you|thx|ty)\s*(so much|very much|a lot)?[!.\s]*$/i,
      /^(got it|understood|makes sense|i see|i understand)[!.\s]*$/i,
      /^(ok|okay|alright|sure|yes|no|yep|nope)[!.\s]*$/i,
      /^(good|great|awesome|perfect|nice|cool|excellent)[!.\s]*$/i,
      /^how are you[?!.\s]*$/i,
      /^what's up[?!.\s]*$/i,
      /^(bye|goodbye|see you|take care)[!.\s]*$/i
    ];
    
    return casualPatterns.some(pattern => pattern.test(trimmedQuery));
  }

  private calculateConfidence(query: string, domain: string): number {
    // Simple confidence based on keyword matches
    if (query.length < 10) return 0.4;
    if (domain === 'general_accounting') return 0.6;
    return 0.85;
  }

  private estimateTokenUsage(classification: QueryClassification, model: string): number {
    let baseTokens = 500;
    
    if (classification.complexity === 'expert') baseTokens = 2000;
    else if (classification.complexity === 'complex') baseTokens = 1200;
    else if (classification.complexity === 'moderate') baseTokens = 800;
    
    if (classification.requiresResearch) baseTokens += 500;
    if (classification.requiresDocumentAnalysis) baseTokens += 300;
    
    return baseTokens;
  }

  private buildRoutingReason(
    classification: QueryClassification, 
    model: string,
    provider: AIProviderName,
    solvers: string[]
  ): string {
    let reason = `Classified as ${classification.domain} query with ${classification.complexity} complexity. `;
    reason += `Using ${provider} provider with ${model} model for optimal domain expertise. `;
    
    if (solvers.length > 0) {
      reason += `Engaging ${solvers.join(', ')} for enhanced accuracy.`;
    }
    
    return reason;
  }
}

export const queryTriageService = new QueryTriageService();
