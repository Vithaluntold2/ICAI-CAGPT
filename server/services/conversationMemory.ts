/**
 * Conversation Memory Service
 *
 * Three-layer memory so long conversations don't forget early facts:
 *   1. Raw in-memory turn store (volatile, fast) — per-turn summaries with topic tags.
 *   2. DB-backed rolling summary (conversation_summaries table) — LLM-compressed
 *      view of all turns older than the raw window. Regenerated every ~10 turns.
 *   3. Accumulated facts glossary (names/amounts/dates/orgs) — persisted alongside
 *      the summary, injected every turn so the LLM always has the conversation's
 *      proper nouns and numbers even if the summary paraphrases them away.
 *
 * Hydration: if the in-memory store is empty but the conversation has messages in
 * the DB (e.g. after a server restart), the service lazily replays those messages
 * into memory on first access.
 */

import { db } from '../db';
import { messages as messagesTable, conversationSummaries } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';
import { aiProviderRegistry } from './aiProviders/registry';
import { AIProviderName } from './aiProviders/types';

interface MemoryEntry {
  turnIndex: number;
  userMessage: string;
  assistantMessage: string;
  topics: string[];
  summary: string;
  timestamp: number;
}

interface Glossary {
  names: Set<string>;
  amounts: Set<string>;
  dates: Set<string>;
  orgs: Set<string>;
}

interface ConversationStore {
  entries: MemoryEntry[];
  runningContext: string; // concat of last 5 turn summaries (short-window recency)
  persistedSummary?: string;    // LLM summary of turns 0..persistedSummaryCoveredTo
  persistedSummaryCoveredTo?: number; // turn index (0-based, inclusive)
  glossary: Glossary;
  hydrated: boolean;     // set true once we've replayed DB messages for this conv
  summarizingInFlight: boolean;
}

// In-memory store keyed by conversationId
const memoryStore = new Map<string, ConversationStore>();

// Thresholds for when to run the LLM summary job.
//   - Don't summarise until the conversation has at least this many turns.
//   - After summarising, wait this many fresh turns before regenerating.
const SUMMARY_MIN_TURNS = 15;
const SUMMARY_REGEN_EVERY_N = 10;
// Always keep this many most-recent turns OUTSIDE the summary, in raw form.
const RAW_TAIL_TURNS = 10;

function emptyGlossary(): Glossary {
  return { names: new Set(), amounts: new Set(), dates: new Set(), orgs: new Set() };
}

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
   * Ensure the in-memory store for this conversation is populated from the DB.
   * Safe to call multiple times — does nothing after the first successful run.
   * This is what makes the memory survive server restarts: before any read or
   * write, we replay the stored messages back into RAM.
   */
  async hydrateIfEmpty(conversationId: string): Promise<void> {
    if (!conversationId) return;
    const existing = memoryStore.get(conversationId);
    if (existing?.hydrated) return;

    const store: ConversationStore = existing ?? {
      entries: [],
      runningContext: '',
      glossary: emptyGlossary(),
      hydrated: false,
      summarizingInFlight: false,
    };

    try {
      // Load messages (oldest first) and pair into turns
      const rows = await db
        .select({
          role: messagesTable.role,
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(asc(messagesTable.createdAt));

      // Only rebuild if the DB has more turns than what's already in memory
      const pairedTurns: Array<{ user: string; assistant: string; ts: number }> = [];
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i];
        const b = rows[i + 1];
        if (a.role === 'user' && b.role === 'assistant') {
          pairedTurns.push({
            user: a.content,
            assistant: b.content,
            ts: new Date(b.createdAt).getTime(),
          });
          i++; // skip the assistant row we just consumed
        }
      }

      if (pairedTurns.length > store.entries.length) {
        // Replay turns that aren't in memory yet, preserving turnIndex order
        store.entries = pairedTurns.map((t, idx) => ({
          turnIndex: idx,
          userMessage: t.user,
          assistantMessage: t.assistant,
          topics: extractTopics(t.user + ' ' + t.assistant),
          summary: summarizeTurn(t.user, t.assistant),
          timestamp: t.ts,
        }));
        store.runningContext = store.entries.slice(-5).map(e => e.summary).join('\n\n');

        // Rebuild the glossary from every turn
        store.glossary = emptyGlossary();
        for (const t of pairedTurns) {
          this.accumulateFacts(store.glossary, t.user, t.assistant);
        }
      }

      // Load persisted LLM summary if we have one
      const [persisted] = await db
        .select()
        .from(conversationSummaries)
        .where(eq(conversationSummaries.conversationId, conversationId))
        .limit(1);
      if (persisted) {
        store.persistedSummary = persisted.summaryText;
        store.persistedSummaryCoveredTo = persisted.coveredUpToTurn;
        if (persisted.glossary && typeof persisted.glossary === 'object') {
          const g = persisted.glossary as Partial<Record<keyof Glossary, string[]>>;
          store.glossary.names = new Set([...store.glossary.names, ...(g.names ?? [])]);
          store.glossary.amounts = new Set([...store.glossary.amounts, ...(g.amounts ?? [])]);
          store.glossary.dates = new Set([...store.glossary.dates, ...(g.dates ?? [])]);
          store.glossary.orgs = new Set([...store.glossary.orgs, ...(g.orgs ?? [])]);
        }
      }

      store.hydrated = true;
      memoryStore.set(conversationId, store);
      console.log(`[ConversationMemory] Hydrated ${conversationId}: ${store.entries.length} turns from DB${persisted ? ', persisted summary loaded' : ''}`);
    } catch (err) {
      console.error('[ConversationMemory] Hydration failed (non-fatal):', err);
      // Still mark hydrated so we don't retry every request — fall back to empty memory
      store.hydrated = true;
      memoryStore.set(conversationId, store);
    }
  }

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
      store = {
        entries: [],
        runningContext: '',
        glossary: emptyGlossary(),
        hydrated: false,
        summarizingInFlight: false,
      };
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

    // Accumulate facts from this turn
    this.accumulateFacts(store.glossary, userMessage, assistantMessage);

    console.log(`[ConversationMemory] Stored turn ${entry.turnIndex} - Topics: ${entry.topics.join(', ')}, Total turns: ${store.entries.length}, Glossary: ${store.glossary.names.size}n/${store.glossary.amounts.size}$/${store.glossary.dates.size}d/${store.glossary.orgs.size}o`);

    // Trigger async summary regeneration if threshold crossed
    this.maybeRegenerateSummary(conversationId).catch(err =>
      console.error('[ConversationMemory] Summary regen failed:', err)
    );
  }

  /**
   * Build the formatted facts-glossary block to inject into LLM context.
   * Empty string if nothing to show.
   */
  buildGlossaryBlock(conversationId: string): string {
    const store = memoryStore.get(conversationId);
    if (!store) return '';
    const g = store.glossary;
    const parts: string[] = [];
    if (g.names.size)   parts.push(`Names / People: ${Array.from(g.names).slice(0, 30).join(', ')}`);
    if (g.orgs.size)    parts.push(`Organisations: ${Array.from(g.orgs).slice(0, 30).join(', ')}`);
    if (g.amounts.size) parts.push(`Amounts: ${Array.from(g.amounts).slice(0, 30).join(', ')}`);
    if (g.dates.size)   parts.push(`Dates: ${Array.from(g.dates).slice(0, 30).join(', ')}`);
    if (parts.length === 0) return '';
    return `[Known Facts From This Conversation — cite exactly if referenced]\n${parts.join('\n')}`;
  }

  /**
   * Return the persisted LLM rolling summary for this conversation, if any.
   * This covers turns 0..coveredUpToTurn; the orchestrator injects it alongside
   * the raw tail of recent turns so the LLM sees the whole conversation's arc.
   */
  getPersistedSummary(conversationId: string): string {
    const store = memoryStore.get(conversationId);
    return store?.persistedSummary ?? '';
  }

  /**
   * If the conversation is long enough and we haven't summarised recently,
   * call the LLM to compress turns 0..(totalTurns - RAW_TAIL_TURNS) into a
   * compact paragraph. Writes result + glossary to conversation_summaries.
   * Fire-and-forget — the user's current turn is already answered.
   */
  private async maybeRegenerateSummary(conversationId: string): Promise<void> {
    const store = memoryStore.get(conversationId);
    if (!store || store.summarizingInFlight) return;

    const total = store.entries.length;
    if (total < SUMMARY_MIN_TURNS) return;

    const alreadyCovered = store.persistedSummaryCoveredTo ?? -1;
    const coverageTarget = total - RAW_TAIL_TURNS; // turns 0..coverageTarget-1 should be summarised
    if (coverageTarget - 1 - alreadyCovered < SUMMARY_REGEN_EVERY_N) return;

    store.summarizingInFlight = true;
    try {
      const toSummarise = store.entries.slice(0, coverageTarget);
      const prior = store.persistedSummary ?? '';

      const transcript = toSummarise
        .map(e => `Turn ${e.turnIndex + 1} — User: ${e.userMessage}\nAssistant: ${e.assistantMessage}`)
        .join('\n\n');

      const prompt = `You are compressing an ongoing chat conversation so the assistant can recall early context even after many turns.

Produce a factual third-person summary of the conversation below. Rules:
- Preserve every concrete fact: names, organisations, numbers, dates, jurisdictions, decisions made, documents referenced.
- Preserve the user's intent/goal if stated.
- Preserve any AI recommendations or conclusions that later turns may reference.
- Do NOT invent anything; if a detail isn't present, omit it.
- 300-500 words, plain prose, no headings, no bullets.

${prior ? `PREVIOUS SUMMARY (extend / refine, don't discard):\n${prior}\n\n` : ''}CONVERSATION TO SUMMARISE (turns 1..${coverageTarget}):
${transcript}

Write the updated summary:`;

      const provider = aiProviderRegistry.getProvider(AIProviderName.AZURE_OPENAI);
      const response = await provider.generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 800,
      });

      const summary = (response.content || '').trim();
      if (!summary) {
        console.warn('[ConversationMemory] Empty summary from LLM, skipping persist');
        return;
      }

      store.persistedSummary = summary;
      store.persistedSummaryCoveredTo = coverageTarget - 1;

      const glossaryJson = {
        names:   Array.from(store.glossary.names),
        amounts: Array.from(store.glossary.amounts),
        dates:   Array.from(store.glossary.dates),
        orgs:    Array.from(store.glossary.orgs),
      };

      // Upsert into conversation_summaries
      await db
        .insert(conversationSummaries)
        .values({
          conversationId,
          summaryText: summary,
          coveredUpToTurn: coverageTarget - 1,
          glossary: glossaryJson,
        })
        .onConflictDoUpdate({
          target: conversationSummaries.conversationId,
          set: {
            summaryText: summary,
            coveredUpToTurn: coverageTarget - 1,
            glossary: glossaryJson,
            updatedAt: new Date(),
          },
        });

      console.log(`[ConversationMemory] Regenerated summary for ${conversationId}: ${summary.length} chars, covers turns 1..${coverageTarget}`);
    } finally {
      store.summarizingInFlight = false;
    }
  }

  /**
   * Extract entities from a user+assistant pair into the glossary.
   * Regex-based so it's cheap enough to run on every turn.
   */
  private accumulateFacts(glossary: Glossary, userMsg: string, assistantMsg: string): void {
    const text = `${userMsg}\n${assistantMsg}`;

    // Amounts: currency markers or grouped digits with optional decimals
    const amountRe = /(?:Rs\.?|₹|\$|USD|INR|EUR|GBP)\s?[\d,]+(?:\.\d+)?|\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b/g;
    for (const m of text.match(amountRe) ?? []) {
      glossary.amounts.add(m.trim());
    }

    // Dates: ISO, DD-MM-YYYY, DD/MM/YYYY, "Month YYYY", "DD Month YYYY"
    const dateRe = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/g;
    for (const m of text.match(dateRe) ?? []) {
      glossary.dates.add(m.trim());
    }

    // Organisations: sequences of capitalised words ending in corporate markers
    const orgRe = /\b(?:[A-Z][a-zA-Z&]+\s+){0,4}(?:Inc|LLC|LLP|Ltd|Limited|Pvt|Corp|Corporation|Group|Holdings|Industries|Technologies|Solutions|Associates|Company)\.?\b/g;
    for (const m of text.match(orgRe) ?? []) {
      glossary.orgs.add(m.trim());
    }

    // Names: consecutive Title-cased words NOT already tagged as orgs
    const nameRe = /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g;
    const commonWords = new Set(['United States', 'New York', 'San Francisco', 'Los Angeles', 'New Delhi', 'Data Science', 'Machine Learning', 'Azure OpenAI', 'Document Intelligence']);
    for (const m of text.match(nameRe) ?? []) {
      const t = m.trim();
      if (commonWords.has(t)) continue;
      if ([...glossary.orgs].some(o => o.includes(t) || t.includes(o))) continue;
      glossary.names.add(t);
    }

    // Cap set sizes to avoid unbounded growth on extreme conversations
    const cap = (s: Set<string>, n: number) => {
      if (s.size > n) {
        const kept = Array.from(s).slice(-n);
        s.clear();
        kept.forEach(v => s.add(v));
      }
    };
    cap(glossary.names, 60);
    cap(glossary.amounts, 60);
    cap(glossary.dates, 60);
    cap(glossary.orgs, 60);
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
