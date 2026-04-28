import { describe, it, expect } from "vitest";
import { buildSynthesizerPrompt } from "./agentSynthesizer";

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
