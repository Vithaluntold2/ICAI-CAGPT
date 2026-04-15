/**
 * Conversation Memory Service
 * 
 * Vectorizes conversation turns into compact summaries with topic tags.
 * On each new query, retrieves only relevant past context via keyword matching,
 * eliminating context window limits for long conversations.
 */

interface MemoryEntry {
  turnIndex: number;
  userMessage: string;
  assistantMessage: string;
  topics: string[];
  summary: string;
  timestamp: number;
}

interface ConversationStore {
  entries: MemoryEntry[];
  runningContext: string; // Rolling summary of entire conversation
}

// In-memory store keyed by conversationId
const memoryStore = new Map<string, ConversationStore>();

// Domain keywords for topic extraction
const DOMAIN_TOPICS: Record<string, string[]> = {
  'tax': ['tax', 'taxation', 'income tax', 'gst', 'vat', 'excise', 'customs', 'tds', 'tcs', 'advance tax', 'return filing', 'assessment', 'deduction', 'exemption', 'section 80', 'capital gains', 'cess', 'surcharge'],
  'audit': ['audit', 'auditing', 'internal audit', 'statutory audit', 'caro', 'sa ', 'standards on auditing', 'audit report', 'qualification', 'emphasis of matter', 'going concern', 'materiality'],
  'accounting': ['accounting', 'journal', 'ledger', 'trial balance', 'depreciation', 'amortization', 'provision', 'accrual', 'prepaid', 'outstanding', 'ind as', 'ifrs', 'gaap', 'as '],
  'company-law': ['company', 'incorporation', 'moa', 'aoa', 'director', 'shareholders', 'agm', 'egm', 'resolution', 'companies act', 'mca', 'roc', 'annual return', 'board meeting', 'llp', 'private limited', 'public limited', 'section 2'],
  'financial-reporting': ['financial statement', 'balance sheet', 'profit and loss', 'cash flow', 'notes to accounts', 'schedule iii', 'disclosure', 'reporting', 'consolidated', 'standalone'],
  'compliance': ['compliance', 'filing', 'due date', 'penalty', 'notice', 'demand', 'assessment', 'appeal', 'tribunal', 'settlement'],
  'costing': ['cost', 'costing', 'marginal', 'absorption', 'standard costing', 'variance', 'budget', 'overhead', 'allocation', 'apportionment'],
  'corporate-finance': ['valuation', 'merger', 'acquisition', 'demerger', 'amalgamation', 'npv', 'irr', 'payback', 'wacc', 'cost of capital', 'dividend', 'share capital', 'debenture'],
  'banking': ['bank', 'loan', 'interest', 'emi', 'npa', 'nbfc', 'rbi', 'credit', 'working capital', 'term loan'],
  'payroll': ['salary', 'wages', 'pf', 'esi', 'gratuity', 'bonus', 'leave encashment', 'payroll', 'ctc', 'take home'],
};

/**
 * Extract topic tags from text using domain keyword matching
 */
function extractTopics(text: string): string[] {
  const lowerText = text.toLowerCase();
  const matched: string[] = [];

  for (const [topic, keywords] of Object.entries(DOMAIN_TOPICS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw)) {
        matched.push(topic);
        break;
      }
    }
  }

  return matched.length > 0 ? matched : ['general'];
}

/**
 * Create a compact summary of a conversation turn
 */
function summarizeTurn(userMsg: string, assistantMsg: string): string {
  // Take first 200 chars of user message (increased for better context)
  const userPart = userMsg.length > 200 ? userMsg.substring(0, 200) + '...' : userMsg;
  // Take first 400 chars of assistant response (captures more of the key answer)
  const assistantPart = assistantMsg.length > 400 ? assistantMsg.substring(0, 400) + '...' : assistantMsg;
  return `User asked: ${userPart}\nResponse: ${assistantPart}`;
}

/**
 * Score relevance of a memory entry to a query
 */
function scoreRelevance(entry: MemoryEntry, queryTopics: string[], queryTerms: string[]): number {
  let score = 0;

  // Topic overlap (high weight)
  const topicOverlap = entry.topics.filter(t => queryTopics.includes(t)).length;
  score += topicOverlap * 3;

  // Keyword overlap in summary
  const entrySummaryLower = entry.summary.toLowerCase();
  for (const term of queryTerms) {
    if (entrySummaryLower.includes(term)) {
      score += 1;
    }
  }

  // Recency bonus (more recent = slightly more relevant)
  score += Math.max(0, 1 - (Date.now() - entry.timestamp) / (60 * 60 * 1000)); // Bonus decays over 1 hour

  return score;
}

/**
 * Extract significant terms from a query for matching
 */
function extractQueryTerms(query: string): string[] {
  const stopWords = new Set(['i', 'me', 'my', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'shall', 'would', 'should', 'can', 'could', 'may', 'might', 'must', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them', 'we', 'you', 'your', 'hi', 'hello', 'please', 'help', 'tell', 'explain', 'want', 'know']);
  return query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

export class ConversationMemoryService {

  /**
   * Store a completed conversation turn
   */
  storeTurn(
    conversationId: string,
    userMessage: string,
    assistantMessage: string
  ): void {
    if (!conversationId || !userMessage || !assistantMessage) return;

    let store = memoryStore.get(conversationId);
    if (!store) {
      store = { entries: [], runningContext: '' };
      memoryStore.set(conversationId, store);
    }

    const entry: MemoryEntry = {
      turnIndex: store.entries.length,
      userMessage,
      assistantMessage,
      topics: extractTopics(userMessage + ' ' + assistantMessage),
      summary: summarizeTurn(userMessage, assistantMessage),
      timestamp: Date.now(),
    };

    store.entries.push(entry);

    // Update rolling context (keep last 5 summaries as running context for better continuity)
    const recentEntries = store.entries.slice(-5);
    store.runningContext = recentEntries.map(e => e.summary).join('\n\n');
    
    console.log(`[ConversationMemory] Stored turn ${entry.turnIndex} for conversation - Topics: ${entry.topics.join(', ')}, Total turns: ${store.entries.length}`);
  }

  /**
   * Retrieve relevant conversation memory for a new query.
   * Returns a compact text block with only the relevant past context.
   */
  retrieveRelevantMemory(
    conversationId: string,
    query: string,
    maxEntries: number = 5
  ): string {
    const store = memoryStore.get(conversationId);
    if (!store || store.entries.length === 0) return '';

    const queryTopics = extractTopics(query);
    const queryTerms = extractQueryTerms(query);

    // Score and rank all entries
    const scored = store.entries.map(entry => ({
      entry,
      score: scoreRelevance(entry, queryTopics, queryTerms),
    }));

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top entries with score > 0
    const relevant = scored
      .filter(s => s.score > 0)
      .slice(0, maxEntries);

    if (relevant.length === 0) {
      // No topical match — return last 3-4 turns as recent context
      const recent = store.entries.slice(-4);
      if (recent.length === 0) return '';
      console.log(`[ConversationMemory] No topical match for query - returning ${recent.length} recent turns as fallback`);
      return '**Recent conversation context:**\n' +
        recent.map(e => e.summary).join('\n\n');
    }

    // Sort selected entries by turn order for coherent reading
    relevant.sort((a, b) => a.entry.turnIndex - b.entry.turnIndex);

    const memoryText = relevant.map(r => r.entry.summary).join('\n\n');
    console.log(`[ConversationMemory] Retrieved ${relevant.length} relevant entries out of ${store.entries.length} total turns`);
    return `**Relevant conversation history (${relevant.length} of ${store.entries.length} exchanges):**\n${memoryText}`;
  }

  /**
   * Get the full recent history (last N turns) for short conversations.
   * Use this when conversation is short enough to fit in context.
   */
  getRecentHistory(
    conversationId: string,
    maxTurns: number = 4
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const store = memoryStore.get(conversationId);
    if (!store) return [];

    const recent = store.entries.slice(-maxTurns);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const entry of recent) {
      messages.push({ role: 'user', content: entry.userMessage });
      messages.push({ role: 'assistant', content: entry.assistantMessage });
    }
    return messages;
  }

  /**
   * Check if conversation is long enough to benefit from memory retrieval
   */
  shouldUseMemory(conversationId: string): boolean {
    const store = memoryStore.get(conversationId);
    // Use memory retrieval when conversation has more than 6 turns
    return !!store && store.entries.length > 6;
  }

  /**
   * Clean up memory for a conversation
   */
  clearConversation(conversationId: string): void {
    memoryStore.delete(conversationId);
  }

  /**
   * Get memory stats
   */
  getStats(): { conversations: number; totalEntries: number } {
    let totalEntries = 0;
    for (const store of memoryStore.values()) {
      totalEntries += store.entries.length;
    }
    return { conversations: memoryStore.size, totalEntries };
  }
}

export const conversationMemory = new ConversationMemoryService();
