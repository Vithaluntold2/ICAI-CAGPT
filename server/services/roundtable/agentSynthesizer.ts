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
