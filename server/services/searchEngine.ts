/**
 * CA GPT Search — AI-Powered Search Engine for Accounting, Tax & Finance
 *
 * Not a search engine that returns links. A research assistant that
 * thinks like 10,000 CPAs — researches, cross-references standards,
 * identifies risks, cites authoritative sources, and delivers
 * professional-grade analysis.
 *
 * Provider chain:
 *   1. Perplexity Sonar (primary — real-time web search with citations)
 *   2. Azure OpenAI (fallback — knowledge-cutoff answers, no web search)
 */

import { aiProviderRegistry } from './aiProviders/registry';
import { providerHealthMonitor } from './aiProviders/healthMonitor';
import {
  AIProviderName,
  CompletionRequest,
  CompletionResponse,
} from './aiProviders/types';
import { db } from '../db';
import { searchHistory } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchCitation {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  favicon: string;
}

export type SearchDomain =
  | 'tax'
  | 'audit'
  | 'gaap_ifrs'
  | 'compliance'
  | 'advisory'
  | 'general';

export interface SearchRequest {
  query: string;
  domain?: SearchDomain;
  jurisdiction?: string;
  userId: string;
}

export interface SearchResult {
  answer: string;
  citations: SearchCitation[];
  relatedQuestions: string[];
  domain: SearchDomain;
  jurisdiction: string | null;
  modelUsed: string;
  providerUsed: string;
  tokensUsed: number;
  processingTimeMs: number;
  searchId: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  domain: string;
  answer: string;
  citations: SearchCitation[];
  pinned: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Domain → System prompt mapping
// ---------------------------------------------------------------------------

const DOMAIN_SYSTEM_PROMPTS: Record<SearchDomain, string> = {
  tax: `You are CA GPT, a senior tax professional with deep expertise in direct and indirect taxation across multiple jurisdictions.
When searching, prioritise:
- Official government tax authority publications (IRS, CBDT, HMRC, ATO)
- Tax code sections and statutory text
- Recent circulars, notifications, and amendments
- Judicial precedents from tax tribunals and courts (ITAT, Tax Court)
- Professional body guidance (AICPA, ICAI, CIOT)
Always cite the specific section, rule, or circular number. Flag any recent amendments that may change the answer.`,

  audit: `You are CA GPT, a senior audit professional with expertise in assurance standards worldwide.
When searching, prioritise:
- Standards on Auditing (ISA, SA, PCAOB AS)
- Quality control standards (ISQM, SQCS)
- Professional body pronouncements (IAASB, AICPA, ICAI, PCAOB)
- Regulatory guidance (SEC, SEBI, FRC)
- Audit methodology and procedure guidelines
Always cite the specific standard number and paragraph. Distinguish between mandatory requirements ("shall") and application guidance.`,

  gaap_ifrs: `You are CA GPT, a senior financial reporting expert with deep knowledge of accounting standards.
When searching, prioritise:
- IFRS Standards and IAS (IASB)
- US GAAP ASC Topics (FASB)
- Indian Accounting Standards (Ind AS)
- Interpretation guidance (IFRIC, SIC, EITF)
- Basis for Conclusions and Implementation Guidance
Always cite the specific standard, paragraph, and effective date. Note any differences between IFRS and local GAAP when relevant.`,

  compliance: `You are CA GPT, a regulatory compliance expert for financial services and corporate governance.
When searching, prioritise:
- Securities regulations (SEC, SEBI, FCA)
- Companies Act / Corporate law provisions
- Anti-money laundering regulations (FATF, FinCEN)
- Data protection and privacy (GDPR, DPDPA)
- Industry-specific compliance requirements
Always cite the specific regulation, section, and effective date. Flag any upcoming compliance deadlines.`,

  advisory: `You are CA GPT, a senior financial advisory professional with expertise in business strategy and corporate finance.
When searching, prioritise:
- M&A and corporate restructuring guidance
- Valuation standards and methodologies (IVS, ASA)
- Due diligence frameworks
- Industry reports and market analysis
- Professional advisory standards
Always provide actionable, practical advice grounded in authoritative sources.`,

  general: `You are CA GPT, an expert research assistant for accounting, tax, and finance professionals.
When searching, look for the most authoritative and recent sources available.
Prioritise official publications, standards, regulations, and peer-reviewed content over blogs or opinion pieces.
Always cite your sources with URLs. If the answer involves numbers, rates, or thresholds, verify them against the latest official publications.`,
};

// ---------------------------------------------------------------------------
// Follow-up prompt
// ---------------------------------------------------------------------------

const FOLLOW_UP_INSTRUCTION = `

After your main answer, generate exactly 3 related follow-up questions that a professional might ask next. Format them on separate lines prefixed with "RELATED_Q:" like:
RELATED_Q: What are the exceptions to this rule?
RELATED_Q: How does this interact with Section XYZ?
RELATED_Q: What are the filing deadlines for this?`;

// ---------------------------------------------------------------------------
// Citation instructions
// ---------------------------------------------------------------------------

const CITATION_INSTRUCTION = `

CRITICAL FORMATTING RULES:
1. Cite every factual claim with numbered references like [1], [2], [3] inline in your text.
2. At the end, list all sources under a "Sources:" heading with format:
   [1] Title — URL
   [2] Title — URL
3. Prefer primary/authoritative sources (government sites, standard setters, official publications).
4. If you are uncertain, say so explicitly — never fabricate citations.
5. Write in clear, professional prose suitable for a senior accountant or tax professional.
6. Include specific section numbers, paragraph references, or circular numbers where applicable.`;

// ---------------------------------------------------------------------------
// SSE event emitter callback type
// ---------------------------------------------------------------------------

export type SearchSSEEmitter = (event: SearchSSEEvent) => void;

export type SearchSSEEvent =
  | { type: 'plan'; title: string; steps: { id: number; label: string }[] }
  | { type: 'step-start'; stepId: number }
  | { type: 'step-progress'; stepId: number; detail: string }
  | { type: 'step-complete'; stepId: number }
  | { type: 'chunk'; content: string }
  | { type: 'citations'; citations: SearchCitation[] }
  | { type: 'related'; questions: string[] }
  | { type: 'end'; searchId: string; domain: SearchDomain; jurisdiction: string | null; modelUsed: string; providerUsed: string; tokensUsed: number; processingTimeMs: number }
  | { type: 'error'; error: string };

// ---------------------------------------------------------------------------
// Research plan step generators
// ---------------------------------------------------------------------------

function generateResearchPlan(query: string, domain: SearchDomain, jurisdiction: string | null): { title: string; steps: { id: number; label: string }[] } {
  const jurisdictionLabel = jurisdiction ? ` (${jurisdiction.toUpperCase()})` : '';

  const domainPlans: Record<SearchDomain, { title: string; steps: string[] }> = {
    tax: {
      title: `Tax research${jurisdictionLabel}`,
      steps: [
        'Identify applicable tax provisions and statutes',
        'Search for relevant circulars, notifications, and amendments',
        'Review judicial precedents and tribunal rulings',
        'Cross-check rates, thresholds, and deadlines',
        'Compile authoritative sources and citations',
      ],
    },
    audit: {
      title: `Audit standards research${jurisdictionLabel}`,
      steps: [
        'Identify applicable auditing standards and requirements',
        'Review implementation guidance and application material',
        'Search for regulatory pronouncements and updates',
        'Check for relevant quality control considerations',
        'Compile authoritative references and citations',
      ],
    },
    gaap_ifrs: {
      title: `Accounting standards research${jurisdictionLabel}`,
      steps: [
        'Identify applicable accounting standards and paragraphs',
        'Review recognition, measurement, and disclosure requirements',
        'Search for implementation guidance and basis for conclusions',
        'Compare across standard frameworks if relevant',
        'Compile authoritative references and citations',
      ],
    },
    compliance: {
      title: `Regulatory compliance research${jurisdictionLabel}`,
      steps: [
        'Identify applicable regulations and statutory requirements',
        'Review filing obligations and compliance deadlines',
        'Search for recent regulatory updates and amendments',
        'Check for penalties and enforcement guidance',
        'Compile authoritative references and citations',
      ],
    },
    advisory: {
      title: `Financial advisory research${jurisdictionLabel}`,
      steps: [
        'Identify relevant valuation or advisory frameworks',
        'Review industry standards and best practices',
        'Search for comparable precedents and market data',
        'Assess risk factors and considerations',
        'Compile authoritative references and citations',
      ],
    },
    general: {
      title: `Professional research${jurisdictionLabel}`,
      steps: [
        'Classify query domain and identify key topics',
        'Search authoritative sources for relevant guidance',
        'Review recent updates and amendments',
        'Cross-reference multiple sources for accuracy',
        'Compile authoritative references and citations',
      ],
    },
  };

  const plan = domainPlans[domain];
  return {
    title: plan.title,
    steps: plan.steps.map((label, i) => ({ id: i + 1, label })),
  };
}

// ---------------------------------------------------------------------------
// Core search engine
// ---------------------------------------------------------------------------

class SearchEngine {
  /**
   * Execute a search query and return an AI-synthesized answer with citations.
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();

    // 1. Classify the query domain if not specified
    const domain = request.domain || this.detectDomain(request.query);
    const jurisdiction = request.jurisdiction || this.detectJurisdiction(request.query);

    // 2. Build domain-aware system prompt
    const systemPrompt = this.buildSearchPrompt(domain, jurisdiction);

    // 3. Execute search via provider chain
    const { response, provider, model } = await this.executeSearch(
      request.query,
      systemPrompt,
    );

    // 4. Parse the response
    const answer = this.extractAnswer(response.content);
    const citations = this.extractCitations(response);
    const relatedQuestions = this.extractRelatedQuestions(response.content);

    const processingTimeMs = Date.now() - startTime;

    // 5. Save to history
    const searchId = await this.saveToHistory({
      userId: request.userId,
      query: request.query,
      domain,
      jurisdiction,
      answer,
      citations,
      relatedQuestions,
      modelUsed: model,
      providerUsed: provider,
      tokensUsed: response.tokensUsed.total,
      processingTimeMs,
    });

    return {
      answer,
      citations,
      relatedQuestions,
      domain,
      jurisdiction,
      modelUsed: model,
      providerUsed: provider,
      tokensUsed: response.tokensUsed.total,
      processingTimeMs,
      searchId,
    };
  }

  /**
   * Stream a search query via SSE, emitting research plan steps as todo items.
   * Each step transitions: not-started → in-progress → completed.
   */
  async searchStream(request: SearchRequest, emit: SearchSSEEmitter): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Classify the query domain
      const domain = request.domain || this.detectDomain(request.query);
      const jurisdiction = request.jurisdiction || this.detectJurisdiction(request.query);

      // 2. Emit research plan
      const plan = generateResearchPlan(request.query, domain, jurisdiction);
      emit({ type: 'plan', title: plan.title, steps: plan.steps });
      await sleep(200);

      // Step 1: Identify provisions / classify domain
      emit({ type: 'step-start', stepId: 1 });
      emit({ type: 'step-progress', stepId: 1, detail: `Detected domain: ${domain}${jurisdiction ? `, jurisdiction: ${jurisdiction}` : ''}` });
      const systemPrompt = this.buildSearchPrompt(domain, jurisdiction);
      await sleep(400);
      emit({ type: 'step-complete', stepId: 1 });

      // Step 2: Search sources (the actual AI call)
      emit({ type: 'step-start', stepId: 2 });
      emit({ type: 'step-progress', stepId: 2, detail: 'Searching authoritative databases and publications...' });

      const { response, provider, model } = await this.executeSearch(
        request.query,
        systemPrompt,
      );

      emit({ type: 'step-complete', stepId: 2 });

      // Step 3: Review and cross-reference
      emit({ type: 'step-start', stepId: 3 });
      emit({ type: 'step-progress', stepId: 3, detail: 'Reviewing results and cross-referencing sources...' });
      const answer = this.extractAnswer(response.content);
      await sleep(300);
      emit({ type: 'step-complete', stepId: 3 });

      // Step 4: Extract and verify citations
      emit({ type: 'step-start', stepId: 4 });
      emit({ type: 'step-progress', stepId: 4, detail: 'Extracting and verifying citation references...' });
      const citations = this.extractCitations(response);
      const relatedQuestions = this.extractRelatedQuestions(response.content);
      await sleep(300);
      emit({ type: 'step-complete', stepId: 4 });

      // Step 5: Compile final answer
      emit({ type: 'step-start', stepId: 5 });
      emit({ type: 'step-progress', stepId: 5, detail: 'Compiling final analysis with references...' });

      // Stream the answer in chunks to simulate progressive rendering
      const chunkSize = 80; // characters per chunk
      for (let i = 0; i < answer.length; i += chunkSize) {
        emit({ type: 'chunk', content: answer.slice(i, i + chunkSize) });
        await sleep(15); // ~60 chars/sec feel
      }

      // Emit citations and related questions
      if (citations.length > 0) {
        emit({ type: 'citations', citations });
      }
      if (relatedQuestions.length > 0) {
        emit({ type: 'related', questions: relatedQuestions });
      }

      emit({ type: 'step-complete', stepId: 5 });

      const processingTimeMs = Date.now() - startTime;

      // Save to history (non-blocking)
      const searchId = await this.saveToHistory({
        userId: request.userId,
        query: request.query,
        domain,
        jurisdiction,
        answer,
        citations,
        relatedQuestions,
        modelUsed: model,
        providerUsed: provider,
        tokensUsed: response.tokensUsed.total,
        processingTimeMs,
      });

      // Final end event
      emit({
        type: 'end',
        searchId,
        domain,
        jurisdiction,
        modelUsed: model,
        providerUsed: provider,
        tokensUsed: response.tokensUsed.total,
        processingTimeMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      emit({ type: 'error', error: message });
    }
  }

  /**
   * Get search history for a user
   */
  async getHistory(userId: string, limit = 30): Promise<SearchHistoryItem[]> {
    const rows = await db
      .select({
        id: searchHistory.id,
        query: searchHistory.query,
        domain: searchHistory.domain,
        answer: searchHistory.answer,
        citations: searchHistory.citations,
        pinned: searchHistory.pinned,
        createdAt: searchHistory.createdAt,
      })
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      citations: (r.citations as SearchCitation[]) || [],
    }));
  }

  /**
   * Pin/unpin a search result
   */
  async togglePin(searchId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ pinned: searchHistory.pinned })
      .from(searchHistory)
      .where(and(eq(searchHistory.id, searchId), eq(searchHistory.userId, userId)));

    if (!row) return false;

    const newPinned = !row.pinned;
    await db
      .update(searchHistory)
      .set({ pinned: newPinned })
      .where(eq(searchHistory.id, searchId));
    return newPinned;
  }

  /**
   * Delete a search history entry
   */
  async deleteHistory(searchId: string, userId: string): Promise<void> {
    await db
      .delete(searchHistory)
      .where(and(eq(searchHistory.id, searchId), eq(searchHistory.userId, userId)));
  }

  /**
   * Get trending/suggested searches for the domain
   */
  getSuggestions(domain?: SearchDomain): string[] {
    const suggestions: Record<SearchDomain, string[]> = {
      tax: [
        'What is the due date for ITR filing for AY 2025-26?',
        'Section 44AD presumptive taxation turnover limit',
        'New vs old tax regime comparison for individuals',
        'TDS rate chart for FY 2025-26',
        'GST input tax credit eligibility conditions',
      ],
      audit: [
        'Key audit matters reporting requirements under SA 701',
        'Going concern assessment procedures SA 570',
        'CARO 2020 reporting requirements for companies',
        'Audit documentation standards SA 230',
        'Related party transaction audit procedures',
      ],
      gaap_ifrs: [
        'IFRS 16 lease classification criteria',
        'Revenue recognition five-step model IFRS 15',
        'Expected credit loss model under Ind AS 109',
        'Goodwill impairment testing IAS 36',
        'Difference between Ind AS and IFRS',
      ],
      compliance: [
        'Annual compliance checklist for private limited company India',
        'SEBI LODR compliance requirements',
        'Companies Act 2013 board meeting requirements',
        'Anti-money laundering compliance obligations for CAs',
        'GDPR compliance requirements for accounting firms',
      ],
      advisory: [
        'Business valuation methods for unlisted companies',
        'Due diligence checklist for mergers and acquisitions',
        'Working capital management best practices',
        'Startup funding stages and financial structuring',
        'Transfer pricing documentation requirements',
      ],
      general: [
        'Latest CBDT circulars and notifications',
        'Upcoming tax and compliance deadlines',
        'Recent changes in accounting standards',
        'Professional ethics guidelines for chartered accountants',
        'Digital signature certificate requirements for filing',
      ],
    };

    if (domain && domain !== 'general') {
      return [...suggestions[domain], ...suggestions.general.slice(0, 2)];
    }
    // Mix from all domains
    return Object.values(suggestions).flatMap((s) => s.slice(0, 2));
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Detect the domain from the query text using keyword matching
   */
  private detectDomain(query: string): SearchDomain {
    const lower = query.toLowerCase();

    const domainKeywords: Record<SearchDomain, string[]> = {
      tax: [
        'tax', 'itr', 'tds', 'tcs', 'gst', 'income tax', 'capital gains',
        'deduction', '80c', '80d', 'section 44', 'presumptive', 'advance tax',
        'withholding', 'cbdt', 'tax return', 'assessment', 'tax slab',
        'hra', 'exemption', 'tax planning', 'tax audit', 'form 26as',
        'tax credit', 'double taxation', 'dtaa', 'transfer pricing',
      ],
      audit: [
        'audit', 'auditor', 'assurance', 'sa 200', 'sa 500', 'sa 700',
        'caro', 'pcaob', 'internal control', 'audit opinion', 'audit risk',
        'materiality', 'sampling', 'going concern', 'audit evidence',
        'audit report', 'qualification', 'emphasis of matter',
      ],
      gaap_ifrs: [
        'ifrs', 'ind as', 'gaap', 'accounting standard', 'ias',
        'revenue recognition', 'lease', 'impairment', 'fair value',
        'financial instrument', 'consolidation', 'goodwill', 'intangible',
        'inventory', 'provision', 'contingent', 'segment reporting',
        'earnings per share', 'fasb', 'asc', 'iasb',
      ],
      compliance: [
        'compliance', 'regulation', 'sebi', 'rbi', 'mca', 'roc',
        'companies act', 'fema', 'annual return', 'board meeting',
        'agm', 'director', 'csr', 'aml', 'kyc', 'lodr', 'insider trading',
        'related party', 'corporate governance',
      ],
      advisory: [
        'valuation', 'merger', 'acquisition', 'due diligence',
        'restructuring', 'funding', 'startup', 'ipo', 'private equity',
        'venture capital', 'working capital', 'cash flow forecast',
        'business plan', 'financial model',
      ],
      general: [], // fallback
    };

    let bestDomain: SearchDomain = 'general';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (domain === 'general') continue;
      const score = keywords.filter((kw) => lower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain as SearchDomain;
      }
    }

    return bestDomain;
  }

  /**
   * Detect jurisdiction from query text
   */
  private detectJurisdiction(query: string): string | null {
    const lower = query.toLowerCase();

    const jurisdictionKeywords: Record<string, string[]> = {
      india: [
        'india', 'indian', 'icai', 'cbdt', 'gst', 'sebi', 'rbi', 'mca',
        'income tax act', 'companies act 2013', 'ind as', 'itat', 'nclat',
        'itr', 'pan', 'aadhaar', 'tds', 'tcs', 'section 80', 'section 44',
        'crore', 'lakh', 'rupee', 'inr', 'fy 202', 'ay 202',
      ],
      us: [
        'irs', 'us gaap', 'fasb', 'sec', 'aicpa', 'pcaob', 'asc',
        'form 1040', 'form 10-k', 'sarbanes-oxley', 'sox', '401k',
        'us tax', 'federal tax', 'state tax',
      ],
      uk: [
        'hmrc', 'uk gaap', 'frs 102', 'frc', 'companies house',
        'corporation tax', 'vat', 'ciot', 'icaew', 'icas',
      ],
      uae: [
        'uae', 'dubai', 'corporate tax uae', 'fta', 'free zone',
        'abu dhabi', 'vat uae', 'economic substance',
      ],
      singapore: [
        'iras', 'acra', 'singapore', 'sfrs', 'isca', 'gst singapore',
      ],
      australia: [
        'ato', 'aasb', 'asic', 'australia', 'australian', 'caanz', 'cpa australia',
      ],
    };

    let bestJurisdiction: string | null = null;
    let bestScore = 0;

    for (const [jurisdiction, keywords] of Object.entries(jurisdictionKeywords)) {
      const score = keywords.filter((kw) => lower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestJurisdiction = jurisdiction;
      }
    }

    return bestScore >= 1 ? bestJurisdiction : null;
  }

  /**
   * Build the full system prompt for the search query
   */
  private buildSearchPrompt(domain: SearchDomain, jurisdiction: string | null): string {
    let prompt = DOMAIN_SYSTEM_PROMPTS[domain];

    if (jurisdiction) {
      prompt += `\n\nThe user is asking about ${jurisdiction.toUpperCase()} jurisdiction. Focus your search and analysis on ${jurisdiction.toUpperCase()}-specific laws, regulations, and standards.`;
    }

    prompt += CITATION_INSTRUCTION;
    prompt += FOLLOW_UP_INSTRUCTION;

    return prompt;
  }

  /**
   * Execute the search via the provider chain:
   * 1. Perplexity Sonar (primary — real-time web search)
   * 2. Azure OpenAI (fallback — no web search, knowledge cutoff)
   */
  private async executeSearch(
    query: string,
    systemPrompt: string,
  ): Promise<{ response: CompletionResponse; provider: string; model: string }> {
    const completionRequest: CompletionRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3, // Low temperature for factual accuracy
      maxTokens: 4000,
    };

    // Try Perplexity first (real-time web search)
    if (aiProviderRegistry.hasProvider(AIProviderName.PERPLEXITY)) {
      try {
        const perplexity = aiProviderRegistry.getProvider(AIProviderName.PERPLEXITY);
        const response = await perplexity.generateCompletion({
          ...completionRequest,
          model: 'llama-3.1-sonar-large-128k-online',
        });

        providerHealthMonitor.recordSuccess(AIProviderName.PERPLEXITY);
        return {
          response,
          provider: AIProviderName.PERPLEXITY,
          model: response.model || 'sonar-large-online',
        };
      } catch (error) {
        providerHealthMonitor.recordFailure(
          AIProviderName.PERPLEXITY,
          error instanceof Error ? error : new Error(String(error)),
        );
        console.warn('[CA GPT Search] Perplexity unavailable, falling back to Azure OpenAI');
      }
    }

    // Fallback: Azure OpenAI (no web search, but reliable)
    if (aiProviderRegistry.hasProvider(AIProviderName.AZURE_OPENAI)) {
      try {
        const azure = aiProviderRegistry.getProvider(AIProviderName.AZURE_OPENAI);
        const response = await azure.generateCompletion({
          ...completionRequest,
          messages: [
            {
              role: 'system',
              content: systemPrompt + '\n\nNote: You do not have access to real-time web search. Provide your best answer based on your training data and clearly state the knowledge cutoff date.',
            },
            { role: 'user', content: query },
          ],
        });

        providerHealthMonitor.recordSuccess(AIProviderName.AZURE_OPENAI);
        return {
          response,
          provider: AIProviderName.AZURE_OPENAI,
          model: response.model || 'gpt-4o',
        };
      } catch (error) {
        providerHealthMonitor.recordFailure(
          AIProviderName.AZURE_OPENAI,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    // Last resort: OpenAI direct
    if (aiProviderRegistry.hasProvider(AIProviderName.OPENAI)) {
      try {
        const openai = aiProviderRegistry.getProvider(AIProviderName.OPENAI);
        const response = await openai.generateCompletion(completionRequest);

        providerHealthMonitor.recordSuccess(AIProviderName.OPENAI);
        return {
          response,
          provider: AIProviderName.OPENAI,
          model: response.model || 'gpt-4o',
        };
      } catch (error) {
        providerHealthMonitor.recordFailure(
          AIProviderName.OPENAI,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    throw new Error('No AI provider available for search. Configure PERPLEXITY_API_KEY or AZURE_OPENAI_API_KEY.');
  }

  /**
   * Extract the main answer, stripping out related questions section
   */
  private extractAnswer(content: string): string {
    // Remove RELATED_Q lines from the main answer
    const lines = content.split('\n');
    const answerLines = lines.filter((l) => !l.trim().startsWith('RELATED_Q:'));
    return answerLines.join('\n').trim();
  }

  /**
   * Extract structured citations from the response.
   * Handles both Perplexity's native citations and text-based [n] references.
   */
  private extractCitations(response: CompletionResponse): SearchCitation[] {
    const citations: SearchCitation[] = [];

    // 1. Perplexity native citations (returned as metadata)
    if (response.metadata?.citations && Array.isArray(response.metadata.citations)) {
      for (const url of response.metadata.citations) {
        if (typeof url === 'string' && url.startsWith('http')) {
          citations.push({
            title: this.extractTitleFromUrl(url),
            url,
            snippet: '',
            domain: this.extractDomainFromUrl(url),
            favicon: `https://www.google.com/s2/favicons?domain=${this.extractDomainFromUrl(url)}&sz=32`,
          });
        }
      }
    }

    // 2. Parse text-based citations: [1] Title — URL or [1] Title - URL
    const sourcePattern = /\[(\d+)\]\s*(.+?)\s*[—–-]\s*(https?:\/\/\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = sourcePattern.exec(response.content)) !== null) {
      const url = match[3].replace(/[)\].,;]+$/, ''); // strip trailing punctuation
      const title = match[2].trim();
      const domain = this.extractDomainFromUrl(url);

      // Avoid duplicates (Perplexity may provide both native + text citations)
      if (!citations.some((c) => c.url === url)) {
        citations.push({
          title,
          url,
          snippet: '',
          domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        });
      }
    }

    // 3. Fallback: parse bare URLs from the text
    if (citations.length === 0) {
      const urlPattern = /https?:\/\/[^\s)\]]+/g;
      let urlMatch: RegExpExecArray | null;
      const seenUrls = new Set<string>();
      while ((urlMatch = urlPattern.exec(response.content)) !== null) {
        const url = urlMatch[0].replace(/[)\].,;]+$/, '');
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          const domain = this.extractDomainFromUrl(url);
          citations.push({
            title: this.extractTitleFromUrl(url),
            url,
            snippet: '',
            domain,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          });
        }
      }
    }

    return citations;
  }

  /**
   * Extract related follow-up questions from the response
   */
  private extractRelatedQuestions(content: string): string[] {
    const questions: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('RELATED_Q:')) {
        const q = trimmed.replace('RELATED_Q:', '').trim();
        if (q) questions.push(q);
      }
    }

    // If the model didn't follow the format, generate generic ones
    if (questions.length === 0) {
      return []; // The UI will handle showing suggested searches instead
    }

    return questions.slice(0, 3);
  }

  /**
   * Extract a readable title from a URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname
        .split('/')
        .filter(Boolean)
        .map((p) => p.replace(/[-_]/g, ' '));

      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1]
          .replace(/\.\w+$/, '') // remove file extension
          .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
        return last || parsed.hostname;
      }
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Extract domain from a URL
   */
  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Save search result to history
   */
  private async saveToHistory(data: {
    userId: string;
    query: string;
    domain: SearchDomain;
    jurisdiction: string | null;
    answer: string;
    citations: SearchCitation[];
    relatedQuestions: string[];
    modelUsed: string;
    providerUsed: string;
    tokensUsed: number;
    processingTimeMs: number;
  }): Promise<string> {
    try {
      const [row] = await db
        .insert(searchHistory)
        .values({
          userId: data.userId,
          query: data.query,
          domain: data.domain,
          jurisdiction: data.jurisdiction,
          answer: data.answer,
          citations: data.citations,
          relatedQuestions: data.relatedQuestions,
          modelUsed: data.modelUsed,
          providerUsed: data.providerUsed,
          tokensUsed: data.tokensUsed,
          processingTimeMs: data.processingTimeMs,
        })
        .returning({ id: searchHistory.id });

      return row.id;
    } catch (error) {
      console.error('[CA GPT Search] Failed to save search history:', error);
      return 'unsaved';
    }
  }
}

// Export singleton
export const searchEngine = new SearchEngine();
