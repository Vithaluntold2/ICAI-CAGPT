/**
 * Per-agent POV synthesizer.
 *
 * After every roundtable turn, one synthesizer job per panel agent rewrites
 * that agent's POV doc. The synthesizer reads:
 *   - the agent's prior POV doc
 *   - all turns since `last_synthesized_turn_id`
 *   - the panel roster (other agents + chair)
 * and outputs structured JSON matching the doc schema. Token-budget enforcement
 * triggers recursive compaction on the oldest QA entries (Task 7).
 */

export interface SynthesizerTurn {
  turnId: string;
  speaker: string;       // agent name or "Chair"
  content: string;
}

export interface RosterDescription {
  name: string;
  description: string;
}

export function buildSynthesizerPrompt(args: {
  agentName: string;
  priorPov: Record<string, any>;
  newTurns: SynthesizerTurn[];
  rosterDescriptions: RosterDescription[];
  tokenBudget: number;
}): string {
  const { agentName, priorPov, newTurns, rosterDescriptions, tokenBudget } = args;

  const turnsBlock = newTurns
    .map((t) => `[${t.turnId} | ${t.speaker}]\n${t.content}`)
    .join("\n\n---\n\n");

  const rosterBlock = rosterDescriptions
    .map((r) => `  • ${r.name}: ${r.description}`)
    .join("\n");

  return [
    `You are a synthesis assistant maintaining ${agentName}'s perspective on a roundtable.`,
    "",
    "CURRENT POV (compact JSON):",
    JSON.stringify(priorPov),
    "",
    "NEW TURNS SINCE LAST SYNTHESIS:",
    turnsBlock || "(no new turns)",
    "",
    "ROSTER (other panelists + chair):",
    rosterBlock,
    "  • Chair: the human user moderating the panel",
    "",
    "Your job: produce an UPDATED POV as JSON matching this schema:",
    "  { selfPosition: { stance, conclusions }, othersSummary: { [name]: summary },",
    "    outgoingQa: [{ to, question, answer, turnId }],",
    "    incomingQa: [{ from, question, answer, turnId }],",
    "    chairQa: [{ direction: 'to'|'from', text, answer, turnId }],",
    "    openThreads: [{ description, awaitingFrom, turnId }],",
    "    glossary: { [term]: definition } }",
    "",
    "Rules:",
    "- Preserve all named entities (people, companies, amounts, dates, regulations) in glossary.",
    "- For outgoingQa/incomingQa/chairQa: APPEND new Q&As with their turnId; do not rewrite history.",
    "- Update openThreads: close resolved ones, add new pending ones.",
    "- Compress othersSummary aggressively but preserve quantitative claims and citations.",
    `- Keep total POV under ${tokenBudget} tokens.`,
    "- Output ONLY valid JSON, no prose, no markdown fences.",
  ].join("\n");
}

import { aiProviderRegistry } from "../aiProviders/registry";
import { AIProviderName } from "../aiProviders/types";
import * as povStore from "./agentPovStore";

const DEFAULT_TOKEN_BUDGET = 1800;

const SYNTHESIZER_PROVIDER_ORDER: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI,
  AIProviderName.OPENAI,
  AIProviderName.CLAUDE,
  AIProviderName.GEMINI,
];

const SYNTHESIZER_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: "gpt-4o-mini",
  [AIProviderName.OPENAI]: "gpt-4o-mini",
  [AIProviderName.CLAUDE]: "claude-3-5-haiku-20241022",
  [AIProviderName.GEMINI]: "gemini-1.5-flash",
};

export interface SynthesizeArgs {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
  tokenBudget?: number;
  _testHooks?: {
    loadRoster?: (panelId: string, excludeAgentId: string) => Promise<RosterDescription[]>;
    loadTurnsAfter?: (threadId: string, afterTurnId: string | null) => Promise<SynthesizerTurn[]>;
  };
}

export async function synthesizeAgentPOV(
  args: SynthesizeArgs,
): Promise<{ version: number; tokenCount: number }> {
  const tokenBudget = args.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  const prior = await povStore.getOrInit(args.threadId, args.agentId);
  const expectedVersion = prior.version;

  const roster = await (args._testHooks?.loadRoster ?? loadRoster)(args.panelId, args.agentId);
  const newTurns = await (args._testHooks?.loadTurnsAfter ?? loadTurnsAfter)(
    args.threadId,
    prior.lastSynthesizedTurnId,
  );

  if (newTurns.length === 0) {
    return { version: prior.version, tokenCount: prior.tokenCount };
  }

  const userPrompt = buildSynthesizerPrompt({
    agentName: args.agentName,
    priorPov: priorPovAsCompact(prior),
    newTurns,
    rosterDescriptions: roster,
    tokenBudget,
  });

  const completion = await callSynthesizerLLM(userPrompt);
  const newPov = JSON.parse(completion.content);

  const lastTurnId = newTurns[newTurns.length - 1].turnId;
  const tokenCount = approxTokenCount(JSON.stringify(newPov));

  const updated = await povStore.upsert({
    threadId: args.threadId,
    agentId: args.agentId,
    expectedVersion,
    patch: {
      selfPosition: newPov.selfPosition ?? {},
      othersSummary: newPov.othersSummary ?? {},
      outgoingQa: newPov.outgoingQa ?? [],
      incomingQa: newPov.incomingQa ?? [],
      chairQa: newPov.chairQa ?? [],
      openThreads: newPov.openThreads ?? [],
      glossary: newPov.glossary ?? {},
      lastSynthesizedTurnId: lastTurnId,
      tokenCount,
    },
  });

  return { version: updated.version, tokenCount };
}

function priorPovAsCompact(doc: any): Record<string, any> {
  return {
    selfPosition: doc.selfPosition,
    othersSummary: doc.othersSummary,
    outgoingQa: doc.outgoingQa,
    incomingQa: doc.incomingQa,
    chairQa: doc.chairQa,
    openThreads: doc.openThreads,
    glossary: doc.glossary,
  };
}

function approxTokenCount(text: string): number {
  // 4 chars/token rough estimate; sufficient for budget enforcement.
  return Math.ceil(text.length / 4);
}

async function callSynthesizerLLM(userPrompt: string): Promise<{ content: string }> {
  const errors: string[] = [];
  for (const providerName of SYNTHESIZER_PROVIDER_ORDER) {
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;
      const model = SYNTHESIZER_MODELS[providerName] ?? "gpt-4o-mini";
      const res = await provider.generateCompletion({
        model,
        messages: [
          {
            role: "system",
            content: "You are a JSON-only synthesis assistant. Output a single JSON object.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 2400,
        responseFormat: "json",
      });
      return { content: res.content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${providerName}: ${msg}`);
    }
  }
  throw new Error(`Synthesizer: all providers failed: ${errors.join(" | ")}`);
}

// Default loaders — overridden in tests via _testHooks.
async function loadRoster(panelId: string, excludeAgentId: string): Promise<RosterDescription[]> {
  const { db } = await import("../../db");
  const { roundtablePanelAgents } = await import("@shared/schema");
  const { and, eq, ne } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(roundtablePanelAgents)
    .where(and(eq(roundtablePanelAgents.panelId, panelId), ne(roundtablePanelAgents.id, excludeAgentId)));
  return rows.map((a: any) => ({
    name: a.name,
    description: a.createdFromTemplate ?? "panel specialist",
  }));
}

async function loadTurnsAfter(
  threadId: string,
  afterTurnId: string | null,
): Promise<SynthesizerTurn[]> {
  const { db } = await import("../../db");
  const { roundtableTurns, roundtablePanelAgents } = await import("@shared/schema");
  const { eq, asc, inArray } = await import("drizzle-orm");

  const allTurns = await db
    .select({
      id: roundtableTurns.id,
      content: roundtableTurns.content,
      speakerKind: roundtableTurns.speakerKind,
      agentId: roundtableTurns.agentId,
      position: roundtableTurns.position,
    })
    .from(roundtableTurns)
    .where(eq(roundtableTurns.threadId, threadId))
    .orderBy(asc(roundtableTurns.position));

  let cutoffPosition = -1;
  if (afterTurnId) {
    const cutoff = allTurns.find((t: any) => t.id === afterTurnId);
    if (cutoff) cutoffPosition = cutoff.position;
  }
  const newTurns = allTurns.filter((t: any) => t.position > cutoffPosition && t.content?.trim());

  // Resolve all distinct speaker agent IDs in one query.
  const agentIds = Array.from(new Set(newTurns.map((t: any) => t.agentId).filter(Boolean) as string[]));
  const agentRows = agentIds.length > 0
    ? await db.select().from(roundtablePanelAgents).where(inArray(roundtablePanelAgents.id, agentIds))
    : [];
  const agentNameById = new Map<string, string>();
  for (const row of agentRows as any[]) agentNameById.set(row.id, row.name);

  return newTurns.map((t: any) => ({
    turnId: t.id,
    speaker: t.speakerKind === "user"
      ? "Chair"
      : agentNameById.get(t.agentId) ?? "Agent",
    content: t.content,
  }));
}
