/**
 * Unit tests for the Roundtable Boardroom runtime helpers.
 *
 * Targets pure module-private logic surfaced through `__testInternals`:
 *   - computeCostMicros: per-provider × per-tier pricing math
 *   - chunkContentForStreaming: simulated-stream tokenisation
 *   - parseProposeResponse: relevance-loop JSON parser robustness
 *   - pickNextSpeaker: floor-allocation precedence
 *   - AGENT_TOOLS: structural validity of the tool schemas the agent
 *     uses to ask questions, open side-threads, or cede the floor
 *
 * No DB or provider calls — these tests stay fully offline so they run
 * cleanly in CI even without API keys.
 */

import { describe, expect, it } from 'vitest';
import { __testInternals } from '../../server/services/roundtable/roundtableRuntime';
import { AIProviderName } from '../../server/services/aiProviders/types';

const {
  computeCostMicros,
  chunkContentForStreaming,
  parseProposeResponse,
  pickNextSpeaker,
  AGENT_TOOLS,
  MAX_AGENT_TOOL_ITERATIONS,
  MAX_SIDE_THREADS_PER_TURN,
  STRONG_PRICE_USDC_PER_1K,
  MINI_PRICE_USDC_PER_1K,
} = __testInternals;

// --------------------------------------------------------------------------
// computeCostMicros
// --------------------------------------------------------------------------

describe('roundtableRuntime · computeCostMicros', () => {
  it('returns 0 when provider is null', () => {
    expect(computeCostMicros(null, 'strong', 1000, 500)).toBe(0);
  });

  it('returns 0 when provider has no pricing entry', () => {
    expect(computeCostMicros(AIProviderName.PERPLEXITY, 'strong', 1000, 500)).toBe(0);
  });

  it('charges Azure strong at 0.25 in / 1.0 out per 1k tokens (cents → micros)', () => {
    // 1000 in × 0.25c + 500 out × 1.0c/1000 = 0.25 + 0.50 = 0.75c → 75 micros
    const cost = computeCostMicros(AIProviderName.AZURE_OPENAI, 'strong', 1000, 500);
    expect(cost).toBe(75);
  });

  it('mini tier is materially cheaper than strong tier for the same token budget', () => {
    const tokensIn = 4000;
    const tokensOut = 2000;
    const strong = computeCostMicros(AIProviderName.OPENAI, 'strong', tokensIn, tokensOut);
    const mini = computeCostMicros(AIProviderName.OPENAI, 'mini', tokensIn, tokensOut);
    expect(strong).toBeGreaterThan(0);
    expect(mini).toBeGreaterThan(0);
    expect(mini).toBeLessThan(strong / 5); // mini is at least 5x cheaper
  });

  it('rounds to the nearest micro and never returns a negative value', () => {
    const cost = computeCostMicros(AIProviderName.GEMINI, 'mini', 1, 1);
    expect(cost).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(cost)).toBe(true);
  });

  it('exposes pricing tables for the four supported providers', () => {
    for (const p of [
      AIProviderName.AZURE_OPENAI,
      AIProviderName.OPENAI,
      AIProviderName.CLAUDE,
      AIProviderName.GEMINI,
    ]) {
      expect(STRONG_PRICE_USDC_PER_1K[p]).toBeTruthy();
      expect(MINI_PRICE_USDC_PER_1K[p]).toBeTruthy();
      expect(STRONG_PRICE_USDC_PER_1K[p]!.in).toBeGreaterThan(0);
      expect(STRONG_PRICE_USDC_PER_1K[p]!.out).toBeGreaterThan(0);
    }
  });
});

// --------------------------------------------------------------------------
// chunkContentForStreaming
// --------------------------------------------------------------------------

describe('roundtableRuntime · chunkContentForStreaming', () => {
  it('emits at least one chunk for non-empty content', () => {
    const chunks = chunkContentForStreaming('hello world from the boardroom');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toBe('hello world from the boardroom');
  });

  it('returns empty array for empty content', () => {
    expect(chunkContentForStreaming('')).toEqual([]);
  });

  it('preserves the original content exactly when joined', () => {
    const text = 'The Tax Advisor argues that Section 115BAA forfeits MAT credit. '
      + 'The Compliance Expert agrees but flags Form 10-IC timing. '
      + 'Consensus: comparative computation needed.';
    const chunks = chunkContentForStreaming(text);
    expect(chunks.join('')).toBe(text);
  });

  it('groups roughly 5 words per chunk (to drive the SSE cadence)', () => {
    const words = Array.from({ length: 25 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkContentForStreaming(words);
    // 25 words at ~5 per chunk => 5 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks.length).toBeLessThanOrEqual(7);
  });
});

// --------------------------------------------------------------------------
// parseProposeResponse
// --------------------------------------------------------------------------

const fakeAgent = (id: string, name: string) => ({
  id,
  name,
  systemPrompt: '',
  panelId: 'p',
  position: 0,
  model: 'mini',
  useBaseKnowledge: true,
  // remaining columns the parser doesn't touch:
  avatar: null,
  color: null,
  capabilities: [],
  templateId: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}) as any;

describe('roundtableRuntime · parseProposeResponse', () => {
  it('parses well-formed JSON', () => {
    const raw = '{"wantsToSpeak": true, "urgency": 7, "relevance": 8, "draftHeadline": "MAT credit risk"}';
    const r = parseProposeResponse(raw, fakeAgent('a1', 'Tax Advisor'));
    expect(r.wantsToSpeak).toBe(true);
    expect(r.urgency).toBe(7);
    expect(r.relevance).toBe(8);
    expect(r.draftHeadline).toBe('MAT credit risk');
  });

  it('extracts JSON when wrapped in prose', () => {
    const raw = 'Sure, here is my answer: {"wantsToSpeak":false,"urgency":0,"relevance":2,"draftHeadline":""} thanks';
    const r = parseProposeResponse(raw, fakeAgent('a1', 'Tax Advisor'));
    expect(r.wantsToSpeak).toBe(false);
    expect(r.urgency).toBe(0);
  });

  it('falls back to safe defaults on garbage input', () => {
    const r = parseProposeResponse('lol no JSON here', fakeAgent('a1', 'Tax Advisor'));
    expect(r.wantsToSpeak).toBe(false);
    expect(r.urgency).toBe(0);
    expect(r.relevance).toBe(0);
    expect(r.draftHeadline).toBe('');
  });

  it('clamps urgency and relevance into [0, 10]', () => {
    const raw = '{"wantsToSpeak": true, "urgency": 99, "relevance": -5, "draftHeadline":"x"}';
    const r = parseProposeResponse(raw, fakeAgent('a1', 'Tax Advisor'));
    expect(r.urgency).toBe(10);
    expect(r.relevance).toBe(0);
  });

  it('accepts snake_case keys (model variation)', () => {
    const raw = '{"wants_to_speak": true, "urgency": 5, "relevance": 5, "draft_headline":"snake"}';
    const r = parseProposeResponse(raw, fakeAgent('a1', 'Tax Advisor'));
    expect(r.wantsToSpeak).toBe(true);
    expect(r.draftHeadline).toBe('snake');
  });

  it('truncates a runaway draftHeadline to 200 chars', () => {
    const long = 'x'.repeat(5000);
    const raw = `{"wantsToSpeak": true, "urgency": 1, "relevance": 1, "draftHeadline":"${long}"}`;
    const r = parseProposeResponse(raw, fakeAgent('a1', 'Tax Advisor'));
    expect(r.draftHeadline.length).toBeLessThanOrEqual(200);
  });
});

// --------------------------------------------------------------------------
// pickNextSpeaker
// --------------------------------------------------------------------------

describe('roundtableRuntime · pickNextSpeaker', () => {
  const mk = (overrides: Partial<{ wantsToSpeak: boolean; urgency: number; relevance: number; agentId: string; agentName: string; draftHeadline: string }>) => ({
    wantsToSpeak: true,
    urgency: 5,
    relevance: 5,
    agentId: 'a1',
    agentName: 'A1',
    draftHeadline: '',
    ...overrides,
  });

  it('returns null when no agent wants the floor', async () => {
    const winner = await pickNextSpeaker([
      mk({ wantsToSpeak: false, agentId: 'a1' }),
      mk({ wantsToSpeak: false, agentId: 'a2' }),
    ]);
    expect(winner).toBeNull();
  });

  it('returns null when nobody clears the urgency+relevance >= 6 bar', async () => {
    const winner = await pickNextSpeaker([
      mk({ urgency: 1, relevance: 1, agentId: 'a1' }),
      mk({ urgency: 2, relevance: 2, agentId: 'a2' }),
    ]);
    expect(winner).toBeNull();
  });

  it('picks the candidate with the highest urgency+relevance score', async () => {
    const winner = await pickNextSpeaker([
      mk({ urgency: 4, relevance: 4, agentId: 'a1', agentName: 'low' }),
      mk({ urgency: 9, relevance: 9, agentId: 'a2', agentName: 'high' }),
      mk({ urgency: 5, relevance: 5, agentId: 'a3', agentName: 'mid' }),
    ]);
    expect(winner?.agentId).toBe('a2');
  });
});

// --------------------------------------------------------------------------
// AGENT_TOOLS schema validity
// --------------------------------------------------------------------------

describe('roundtableRuntime · AGENT_TOOLS', () => {
  it('exposes exactly the three boardroom tools', () => {
    const names = AGENT_TOOLS.map((t: any) => t.function.name).sort();
    expect(names).toEqual(['ask_panelist', 'cede_floor', 'start_side_thread']);
  });

  it.each(['ask_panelist', 'start_side_thread'])(
    '%s requires to_agent_name and question with no extra props',
    (toolName) => {
      const tool = AGENT_TOOLS.find((t: any) => t.function.name === toolName) as any;
      expect(tool).toBeTruthy();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.required).toEqual(
        expect.arrayContaining(['to_agent_name', 'question']),
      );
      expect(tool.function.parameters.additionalProperties).toBe(false);
      expect(tool.function.parameters.properties.to_agent_name.type).toBe('string');
      expect(tool.function.parameters.properties.question.type).toBe('string');
    },
  );

  it('cede_floor accepts an optional reason and no required fields', () => {
    const tool = AGENT_TOOLS.find((t: any) => t.function.name === 'cede_floor') as any;
    expect(tool).toBeTruthy();
    expect(tool.function.parameters.required ?? []).toEqual([]);
    expect(tool.function.parameters.properties.reason.type).toBe('string');
  });

  it('every tool description names the behavior (helps the model pick correctly)', () => {
    for (const t of AGENT_TOOLS as any[]) {
      expect(typeof t.function.description).toBe('string');
      expect(t.function.description.length).toBeGreaterThan(20);
    }
  });

  it('caps tool-loop iterations and side-threads to safe small values', () => {
    expect(MAX_AGENT_TOOL_ITERATIONS).toBeGreaterThanOrEqual(2);
    expect(MAX_AGENT_TOOL_ITERATIONS).toBeLessThanOrEqual(5);
    expect(MAX_SIDE_THREADS_PER_TURN).toBe(1);
  });
});
