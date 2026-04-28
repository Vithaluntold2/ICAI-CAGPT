import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ db: { select: vi.fn() } }));
vi.mock("./agentPovStore", () => ({
  getOrInit: vi.fn(),
  upsert: vi.fn(),
  StaleVersionError: class extends Error {},
}));
vi.mock("../aiProviders/registry", () => ({
  aiProviderRegistry: { getProvider: vi.fn() },
}));

import { buildSynthesizerPrompt, synthesizeAgentPOV } from "./agentSynthesizer";
import * as povStore from "./agentPovStore";
import { aiProviderRegistry } from "../aiProviders/registry";
import { db } from "../../db";

describe("buildSynthesizerPrompt", () => {
  it("includes agent name, prior POV JSON, new turns, roster, and token budget", () => {
    const result = buildSynthesizerPrompt({
      agentName: "Auditor",
      priorPov: { selfPosition: { stance: "init" }, othersSummary: {} },
      newTurns: [
        { speaker: "Compliance Bot", content: "We need to disclose under Reg 30.", turnId: "t1" },
      ],
      rosterDescriptions: [
        { name: "Compliance Bot", description: "SEBI/disclosure specialist" },
        { name: "Devil's Advocate", description: "Adversarial challenger" },
      ],
      tokenBudget: 1800,
    });
    expect(result).toContain("Auditor");
    expect(result).toContain('"stance":"init"');
    expect(result).toContain("Compliance Bot");
    expect(result).toContain("Reg 30");
    expect(result).toContain("Devil's Advocate");
    expect(result).toContain("1800");
    expect(result).toContain("ONLY valid JSON");
  });
});

describe("synthesizeAgentPOV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads prior POV, fetches new turns, calls model, upserts result", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0, lastUpdatedAt: new Date(),
    });

    const newPov = {
      selfPosition: { stance: "Trigger met" },
      othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [],
      glossary: { "Plant 3": "Pune facility" },
    };
    (aiProviderRegistry.getProvider as any).mockReturnValue({
      generateCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify(newPov),
        finishReason: "stop",
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "gpt-4o-mini",
        provider: "azure-openai",
      }),
    });
    (povStore.upsert as any).mockResolvedValue({ ...newPov, version: 2, threadId: "t", agentId: "a" });

    const result = await synthesizeAgentPOV({
      threadId: "t",
      agentId: "a",
      agentName: "Auditor",
      panelId: "p",
      tokenBudget: 1800,
      _testHooks: {
        loadRoster: async () => [
          { name: "Compliance Bot", description: "compliance specialist" },
        ],
        loadTurnsAfter: async () => [
          { turnId: "turn1", speaker: "Compliance Bot", content: "Disclose under Reg 30" },
        ],
      },
    });
    expect(result.version).toBe(2);
    expect(povStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "t", agentId: "a", expectedVersion: 1 }),
    );
  });
});
