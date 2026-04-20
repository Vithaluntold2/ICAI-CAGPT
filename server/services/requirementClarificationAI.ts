/**
 * AI-Driven Requirement Clarification Service
 * 
 * Uses chain-of-thought reasoning to analyze queries and determine
 * if clarification is needed - NO HARDCODED PATTERNS.
 * 
 * The AI considers:
 * - Query specificity and completeness
 * - Missing context for professional advice
 * - Domain-specific requirements
 * - Conversation history for context
 */

import { aiProviderRegistry, AIProviderName } from './aiProviders';
import { conversationMemory } from './conversationMemory';

/**
 * Deterministic extraction of facts already in the conversation. Used to build
 * a "DO NOT ASK ABOUT" list for the clarifier so gpt-4o-mini never emits a
 * redundant clarification request for jurisdiction / tax IDs / entity types
 * the user has already provided. Regex-only — cheap and reliable; the richer
 * context from memory (glossary + rolling summary) is layered on top.
 */
interface KnownFacts {
  jurisdiction: string | null;  // canonical country/framework if detected
  hasGstin: boolean;
  hasPan: boolean;
  hasTin: boolean;
  entityType: string | null;
}

function extractKnownFactsFromHistory(
  history: Array<{ role: string; content: string }>,
): KnownFacts {
  const text = history.map(h => h.content).join('\n');

  const jurisdictionMatchers: Array<[string, RegExp]> = [
    ['India',          /(?:^|\W)(?:india|indian)(?:\W|$)/i],
    ['United States',  /(?:^|\W)(?:united\s+states|u\.?s\.?a\.?|usa|american)(?:\W|$)/i],
    ['United Kingdom', /(?:^|\W)(?:united\s+kingdom|u\.?k\.?|britain|british)(?:\W|$)/i],
    ['Canada',         /(?:^|\W)(?:canada|canadian)(?:\W|$)/i],
    ['Australia',      /(?:^|\W)(?:australia|australian)(?:\W|$)/i],
    ['Singapore',      /(?:^|\W)singapore(?:\W|$)/i],
    ['Hong Kong',      /(?:^|\W)hong\s*kong(?:\W|$)/i],
    ['UAE',            /(?:^|\W)(?:u\.?a\.?e\.?|united\s+arab\s+emirates|dubai|abu\s*dhabi)(?:\W|$)/i],
    ['Germany',        /(?:^|\W)(?:germany|german)(?:\W|$)/i],
    ['France',         /(?:^|\W)(?:france|french)(?:\W|$)/i],
    ['IFRS',           /(?:^|\W)ifrs(?:\W|$)/i],
    ['US GAAP',        /(?:^|\W)us\s*gaap(?:\W|$)/i],
  ];
  let jurisdiction: string | null = null;
  for (const [canon, re] of jurisdictionMatchers) {
    if (re.test(text)) { jurisdiction = canon; break; }
  }

  const hasGstin = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/i.test(text);
  const hasPan   = /\b[A-Z]{5}\d{4}[A-Z]\b/.test(text);
  const hasTin   = /\b(?:ein|tin|itin|tax\s*id(?:entification)?\s*(?:number|no)?)\s*[:\-]?\s*[A-Z0-9\-]{6,}/i.test(text);

  const entityMatch = text.match(
    /\b(pvt\.?\s*ltd\.?|private\s+limited|public\s+limited|llp|llc|sole\s*proprietor(?:ship)?|partnership|s-?corp|c-?corp|corporation|sole\s*trader|hindu\s*undivided\s*family|huf)\b/i
  );
  const entityType = entityMatch ? entityMatch[1] : null;

  return { jurisdiction, hasGstin, hasPan, hasTin, entityType };
}

function buildDoNotAskBlock(facts: KnownFacts): string {
  const lines: string[] = [];
  if (facts.jurisdiction) {
    lines.push(`- Jurisdiction / country: already provided (${facts.jurisdiction}). Do NOT ask which country, which jurisdiction, or which framework.`);
  }
  if (facts.hasGstin) lines.push(`- GSTIN: already provided in history. Do NOT ask for it.`);
  if (facts.hasPan)   lines.push(`- PAN: already provided in history. Do NOT ask for it.`);
  if (facts.hasTin)   lines.push(`- Tax ID (EIN/TIN/ITIN): already provided in history. Do NOT ask for it.`);
  if (facts.entityType) {
    lines.push(`- Entity type: already provided (${facts.entityType}). Do NOT ask about business structure / legal form.`);
  }
  if (lines.length === 0) return '';
  return `\nALREADY PROVIDED — DO NOT ASK AGAIN:\n${lines.join('\n')}\n`;
}

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

const CLARIFICATION_SYSTEM_PROMPT = `You are a professional CPA/CA advisor analyzing a user's query to determine if you need more information before providing advice.

Your task is to determine:
1. Is this query specific enough to answer accurately?
2. What critical context is missing that would change the advice?
3. Should you ask clarifying questions first, or can you answer directly?

IMPORTANT PRINCIPLES:
- Professional advice REQUIRES jurisdiction/country context - tax laws, accounting standards vary globally
- Vague topic queries (e.g., "depreciation", "fixed assets") need scope clarification 
- Specific questions with clear context can be answered directly
- Casual messages (greetings, thanks) need no clarification
- When a document is attached, assume context is in the document

OUTPUT FORMAT (JSON only, no markdown):
{
  "needsClarification": boolean,
  "confidence": "low" | "medium" | "high",
  "recommendedApproach": "clarify" | "answer" | "partial_answer_then_clarify",
  "reasoning": "Your chain-of-thought analysis...",
  "missingContext": [
    {
      "category": "jurisdiction|scope|entity_type|time_period|purpose|specifics",
      "importance": "critical|high|medium|low",
      "reason": "Why this matters for accurate advice",
      "suggestedQuestion": "The question to ask the user"
    }
  ],
  "detectedContext": {
    "jurisdiction": "extracted jurisdiction or null",
    "entityType": "extracted entity type or null",
    "taxYear": "extracted year or null",
    "otherContext": "any other relevant context detected"
  },
  "ambiguities": ["List of ambiguous terms or concepts that need clarification"],
  "nuances": ["Professional considerations the user may not be aware of"]
}

EXAMPLES:

Query: "Fixed assets accounting"
Response: {
  "needsClarification": true,
  "confidence": "low",
  "recommendedApproach": "clarify",
  "reasoning": "This is a broad topic query with no specific question. The user could be asking about initial recognition, depreciation methods, impairment testing, revaluations, disposal, or disclosure requirements. Additionally, treatment varies between US GAAP, IFRS, and local standards.",
  "missingContext": [
    {"category": "scope", "importance": "critical", "reason": "No specific aspect identified", "suggestedQuestion": "What specific aspect of fixed assets would you like help with? (e.g., initial recognition, depreciation, impairment, disposal, journal entries)"},
    {"category": "jurisdiction", "importance": "critical", "reason": "Accounting treatment varies between US GAAP, IFRS, and local standards", "suggestedQuestion": "Which accounting framework applies? (US GAAP, IFRS, or a specific country's standards)"},
    {"category": "purpose", "importance": "high", "reason": "Determines appropriate level of detail", "suggestedQuestion": "What's the context? (preparing financials, exam study, handling a transaction, audit work)"}
  ],
  "detectedContext": {},
  "ambiguities": ["Fixed assets is a broad topic covering many sub-areas"],
  "nuances": ["Component depreciation may be required under IFRS", "Impairment testing requirements differ between frameworks"]
}

Query: "How do I calculate depreciation for a building purchased for $500,000 in California using straight-line method over 39 years for tax purposes?"
Response: {
  "needsClarification": false,
  "confidence": "high",
  "recommendedApproach": "answer",
  "reasoning": "Query is highly specific with asset type, cost, jurisdiction, method, useful life, and purpose (tax) all clearly stated. Can provide direct answer.",
  "missingContext": [],
  "detectedContext": {"jurisdiction": "California, US", "entityType": "likely business (commercial property)", "taxYear": "current"},
  "ambiguities": [],
  "nuances": ["MACRS may be required for US tax depreciation", "Residential vs non-residential classification matters"]
}

Query: "Hi"
Response: {
  "needsClarification": false,
  "confidence": "high",
  "recommendedApproach": "answer",
  "reasoning": "This is a casual greeting. Respond warmly and offer assistance.",
  "missingContext": [],
  "detectedContext": {},
  "ambiguities": [],
  "nuances": []
}`;

class RequirementClarificationAIService {
  private cache: Map<string, { analysis: ClarificationAnalysis; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Analyze query using AI chain-of-thought reasoning
   */
  async analyzeQueryAsync(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    conversationId?: string,
  ): Promise<ClarificationAnalysis> {
    // Cache key includes the known-facts fingerprint so a repeat query with
    // new facts (e.g. jurisdiction now known) doesn't hit a stale entry.
    const knownFacts = extractKnownFactsFromHistory(conversationHistory);
    const factFingerprint = [
      knownFacts.jurisdiction ?? '',
      knownFacts.hasGstin ? 'gstin' : '',
      knownFacts.hasPan ? 'pan' : '',
      knownFacts.hasTin ? 'tin' : '',
      knownFacts.entityType ?? '',
    ].filter(Boolean).join('|');
    const cacheKey = this.getCacheKey(query, conversationHistory) + '::' + factFingerprint;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('[ClarificationAI] Using cached analysis');
      return cached.analysis;
    }

    try {
      // Build context from conversation history
      const historyContext = conversationHistory.length > 0
        ? `\nConversation history:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
        : '';

      // Deterministic negative list: facts already in history that gpt-4o-mini
      // must not re-ask. This is the primary guarantee against context
      // re-asks — if the regex finds "India" anywhere in history, the model
      // sees an explicit "DO NOT ASK" instruction upfront.
      const doNotAsk = buildDoNotAskBlock(knownFacts);

      // Richer probabilistic context from the memory service — glossary of
      // accumulated facts (names, organisations, amounts, dates, jurisdictions,
      // tax IDs) plus the LLM-compressed rolling summary of older turns.
      // Works on top of the do-not-ask list: one catches the obvious cases,
      // the other gives the model nuance the regex can't capture.
      let memoryContext = '';
      if (conversationId) {
        try {
          await conversationMemory.hydrateIfEmpty(conversationId);
          const glossary = conversationMemory.buildGlossaryBlock(conversationId);
          const summary = conversationMemory.getPersistedSummary(conversationId);
          const parts: string[] = [];
          if (glossary) parts.push(glossary);
          if (summary)  parts.push(`[Rolling summary of earlier turns]\n${summary}`);
          if (parts.length > 0) {
            memoryContext = `\n\nCONTEXT FROM EARLIER IN THIS CONVERSATION (treat these facts as already established — do not ask about them):\n${parts.join('\n\n')}\n`;
          }
        } catch (err) {
          console.warn('[ClarificationAI] memory hydration failed:', (err as Error).message);
        }
      }

      const userMessage = `Analyze this query and determine if clarification is needed before providing professional advice:

Query: "${query}"
${historyContext}${memoryContext}${doNotAsk}
IMPORTANT:
- If the conversation history OR the "ALREADY PROVIDED" list shows a fact, that fact IS known. Do NOT emit a missingContext item asking for it.
- If the assistant has already asked clarifying questions and the user answered them, set needsClarification=false and recommendedApproach="answer".
- Only flag missingContext for facts that are genuinely absent from history AND memory.

Remember: Output ONLY valid JSON, no markdown formatting.`;

      // Use a fast model for this quick analysis
      const provider = aiProviderRegistry.getProvider(AIProviderName.AZURE_OPENAI);
      if (!provider) {
        console.warn('[ClarificationAI] No provider available, falling back to heuristic');
        return this.fallbackHeuristicAnalysis(query, conversationHistory);
      }

      const response = await provider.generateCompletion({
        model: 'gpt-4o-mini', // Fast and cheap for classification
        messages: [
          { role: 'system', content: CLARIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        maxTokens: 1000
      });

      const analysisResult = this.parseAIResponse(response.content);
      
      // Cache the result
      this.cache.set(cacheKey, { analysis: analysisResult, timestamp: Date.now() });
      
      return analysisResult;

    } catch (error) {
      console.error('[ClarificationAI] Error in AI analysis:', error);
      return this.fallbackHeuristicAnalysis(query, conversationHistory);
    }
  }

  /**
   * Synchronous wrapper for backward compatibility
   * Uses cached results or quick heuristics
   */
  analyzeQuery(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): ClarificationAnalysis {
    // Check cache
    const cacheKey = this.getCacheKey(query, conversationHistory);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.analysis;
    }

    // For sync calls, use quick heuristic analysis
    // The async version will be called by orchestrator for full AI analysis
    return this.quickHeuristicAnalysis(query, conversationHistory);
  }

  /**
   * Quick heuristic for sync calls - checks query structure without hardcoded topics
   */
  private quickHeuristicAnalysis(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): ClarificationAnalysis {
    const lowerQuery = query.toLowerCase().trim();
    const wordCount = lowerQuery.split(/\s+/).length;
    
    // Extract context from conversation
    const conversationContext = this.extractContextFromHistory(conversationHistory);

    // Casual messages - no clarification needed
    if (this.isCasualMessage(lowerQuery)) {
      return this.createAnalysis(false, 'high', 'answer', [], conversationContext);
    }

    // Very short queries (1-4 words) without question words are likely broad topics
    const hasQuestionIndicators = /\?|how|what|when|why|where|which|should|can i|do i|is it|are there|tell me/i.test(lowerQuery);
    const hasActionIndicators = /calculate|prepare|record|journal|entry|treat|recognize|measure|disclose|report|file|submit/i.test(lowerQuery);
    
    if (wordCount <= 4 && !hasQuestionIndicators && !hasActionIndicators) {
      // Short, non-question query - likely needs scope clarification
      return this.createAnalysis(true, 'low', 'clarify', [
        {
          category: 'scope',
          importance: 'critical',
          reason: 'Query is a broad topic without a specific question',
          suggestedQuestion: 'What specific aspect would you like help with?'
        },
        {
          category: 'purpose',
          importance: 'high',
          reason: 'Understanding your goal helps provide targeted guidance',
          suggestedQuestion: 'What are you trying to accomplish? (e.g., exam study, preparing financials, handling a transaction)'
        }
      ], conversationContext);
    }

    // Check for jurisdiction context
    const hasJurisdiction = conversationContext.jurisdiction || 
      /us|usa|uk|canada|australia|india|singapore|uae|eu|europe|gaap|ifrs|irs|hmrc|cra|ato/i.test(lowerQuery);
    
    // Professional advice queries without jurisdiction
    if (!hasJurisdiction && this.isProfessionalAdviceQuery(lowerQuery)) {
      return this.createAnalysis(true, 'medium', 'clarify', [
        {
          category: 'jurisdiction',
          importance: 'critical',
          reason: 'Professional advice must be jurisdiction-specific',
          suggestedQuestion: 'Which jurisdiction/country does this apply to?'
        }
      ], conversationContext);
    }

    // Query seems specific enough
    return this.createAnalysis(false, 'high', 'answer', [], conversationContext);
  }

  /**
   * Fallback heuristic when AI is unavailable
   */
  private fallbackHeuristicAnalysis(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): ClarificationAnalysis {
    return this.quickHeuristicAnalysis(query, conversationHistory);
  }

  /**
   * Parse AI response into ClarificationAnalysis
   */
  private parseAIResponse(content: string): ClarificationAnalysis {
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        needsClarification: parsed.needsClarification ?? false,
        confidence: parsed.confidence ?? 'medium',
        recommendedApproach: parsed.recommendedApproach ?? 'answer',
        missingContext: (parsed.missingContext || []).map((m: any) => ({
          category: m.category || 'unknown',
          importance: m.importance || 'medium',
          reason: m.reason || '',
          suggestedQuestion: m.suggestedQuestion || ''
        })),
        ambiguities: parsed.ambiguities || [],
        detectedNuances: parsed.nuances || [],
        conversationContext: this.mapDetectedContext(parsed.detectedContext || {})
      };
    } catch (error) {
      console.error('[ClarificationAI] Failed to parse AI response:', error);
      return this.createAnalysis(false, 'medium', 'answer', [], {});
    }
  }

  /**
   * Map AI detected context to ClarificationContext
   */
  private mapDetectedContext(detected: any): ClarificationContext {
    return {
      jurisdiction: detected.jurisdiction || undefined,
      entityType: detected.entityType || undefined,
      taxYear: detected.taxYear || undefined,
      businessType: detected.businessType || undefined,
      filingStatus: detected.filingStatus || undefined,
      accountingMethod: detected.accountingMethod || undefined
    };
  }

  /**
   * Extract context from conversation history
   */
  private extractContextFromHistory(
    history: Array<{ role: string; content: string }>
  ): ClarificationContext {
    const context: ClarificationContext = {};
    const fullText = history.map(h => h.content).join(' ').toLowerCase();
    
    // Jurisdiction detection
    if (/\b(us|usa|united states|american)\b/i.test(fullText)) context.jurisdiction = 'US';
    else if (/\b(uk|united kingdom|british)\b/i.test(fullText)) context.jurisdiction = 'UK';
    else if (/\bcanada\b/i.test(fullText)) context.jurisdiction = 'Canada';
    else if (/\baustralia\b/i.test(fullText)) context.jurisdiction = 'Australia';
    else if (/\bindia\b/i.test(fullText)) context.jurisdiction = 'India';
    
    // Tax year detection
    const yearMatch = fullText.match(/\b(20\d{2})\b/);
    if (yearMatch) context.taxYear = yearMatch[1];
    
    // Entity type detection
    if (/\b(llc|s-?corp|c-?corp|corporation|partnership|sole proprietor)\b/i.test(fullText)) {
      const match = fullText.match(/\b(llc|s-?corp|c-?corp|corporation|partnership|sole proprietor)/i);
      if (match) context.entityType = match[1];
    }
    
    return context;
  }

  /**
   * Check if query is a casual message
   */
  private isCasualMessage(query: string): boolean {
    const casualPatterns = [
      /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))[\s!.,]*$/i,
      /^(thanks|thank\s*you|thx|ty|appreciate\s*it)[\s!.,]*$/i,
      /^(ok|okay|sure|got\s*it|understood)[\s!.,]*$/i,
      /^(bye|goodbye|see\s*you|take\s*care)[\s!.,]*$/i
    ];
    return casualPatterns.some(p => p.test(query.trim()));
  }

  /**
   * Check if query requires professional advice
   */
  private isProfessionalAdviceQuery(query: string): boolean {
    const professionalIndicators = [
      'should i', 'can i', 'how to', 'what is the best', 'recommend',
      'advise', 'guidance', 'help me', 'deduct', 'depreciate', 'amortize',
      'capitalize', 'expense', 'recognize', 'disclose', 'report', 'file',
      'audit', 'compliance', 'tax', 'accounting'
    ];
    return professionalIndicators.some(p => query.includes(p));
  }

  /**
   * Create analysis result
   */
  private createAnalysis(
    needsClarification: boolean,
    confidence: 'low' | 'medium' | 'high',
    approach: 'clarify' | 'answer' | 'partial_answer_then_clarify',
    missingContext: MissingContext[],
    conversationContext: ClarificationContext
  ): ClarificationAnalysis {
    return {
      needsClarification,
      confidence,
      recommendedApproach: approach,
      missingContext,
      ambiguities: [],
      detectedNuances: [],
      conversationContext
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, history: Array<{ role: string; content: string }>): string {
    const historyKey = history.slice(-2).map(h => h.content.slice(0, 50)).join('|');
    return `${query.slice(0, 100)}::${historyKey}`;
  }

  /**
   * Generate clarifying questions from analysis
   */
  generateClarifyingQuestions(analysis: ClarificationAnalysis): string[] {
    return analysis.missingContext
      .filter(m => m.importance === 'critical' || m.importance === 'high')
      .map(m => m.suggestedQuestion)
      .filter(q => q && q.length > 0);
  }
}

export const requirementClarificationAIService = new RequirementClarificationAIService();
