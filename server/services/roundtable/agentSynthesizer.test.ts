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

  it("passes the actual newPov fields through to upsert (not just metadata)", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0, lastUpdatedAt: new Date(),
    });
    const newPov = {
      selfPosition: { stance: "Trigger met" },
      othersSummary: { Compliance: "raised Reg 30 timing" },
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [],
      glossary: { "Plant 3": "Pune facility" },
    };
    (aiProviderRegistry.getProvider as any).mockReturnValue({
      generateCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify(newPov),
        finishReason: "stop",
        tokensUsed: { input: 0, output: 0, total: 0 },
        model: "x", provider: "x",
      }),
    });
    (povStore.upsert as any).mockResolvedValue({ ...newPov, version: 2 });

    await synthesizeAgentPOV({
      threadId: "t", agentId: "a", agentName: "Auditor", panelId: "p",
      _testHooks: {
        loadRoster: async () => [],
        loadTurnsAfter: async () => [
          { turnId: "t1", speaker: "Compliance", content: "Reg 30" },
        ],
      },
    });

    expect(povStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({
          selfPosition: { stance: "Trigger met" },
          othersSummary: { Compliance: "raised Reg 30 timing" },
          glossary: { "Plant 3": "Pune facility" },
          lastSynthesizedTurnId: "t1",
        }),
      }),
    );
  });

  it("short-circuits when there are no new turns: no LLM call, no upsert", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 5,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: "tx", tokenCount: 100, lastUpdatedAt: new Date(),
    });
    const generateCompletion = vi.fn();
    (aiProviderRegistry.getProvider as any).mockReturnValue({ generateCompletion });

    const result = await synthesizeAgentPOV({
      threadId: "t", agentId: "a", agentName: "Auditor", panelId: "p",
      _testHooks: {
        loadRoster: async () => [],
        loadTurnsAfter: async () => [],
      },
    });

    expect(result).toEqual({ version: 5, tokenCount: 100 });
    expect(generateCompletion).not.toHaveBeenCalled();
    expect(povStore.upsert).not.toHaveBeenCalled();
  });

  it("falls through provider order on failure (Azure throws → OpenAI succeeds)", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0, lastUpdatedAt: new Date(),
    });
    const newPov = {
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
    };
    const azureProvider = {
      generateCompletion: vi.fn().mockRejectedValue(new Error("azure timed out")),
    };
    const openaiProvider = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify(newPov),
        finishReason: "stop",
        tokensUsed: { input: 0, output: 0, total: 0 },
        model: "gpt-4o-mini", provider: "openai",
      }),
    };
    let providerCallCount = 0;
    (aiProviderRegistry.getProvider as any).mockImplementation(() => {
      providerCallCount++;
      return providerCallCount === 1 ? azureProvider : openaiProvider;
    });
    (povStore.upsert as any).mockResolvedValue({ ...newPov, version: 2 });

    const result = await synthesizeAgentPOV({
      threadId: "t", agentId: "a", agentName: "Auditor", panelId: "p",
      _testHooks: {
        loadRoster: async () => [],
        loadTurnsAfter: async () => [
          { turnId: "t1", speaker: "X", content: "stuff" },
        ],
      },
    });

    expect(result.version).toBe(2);
    expect(azureProvider.generateCompletion).toHaveBeenCalledTimes(1);
    expect(openaiProvider.generateCompletion).toHaveBeenCalledTimes(1);
  });
});
