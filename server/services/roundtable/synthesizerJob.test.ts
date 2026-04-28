import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./agentSynthesizer", () => ({
  synthesizeAgentPOV: vi.fn(),
}));

import { synthesizeAgentPOV } from "./agentSynthesizer";
import { processSynthesizerJob } from "./synthesizerJob";

describe("processSynthesizerJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls synthesizeAgentPOV with job data and returns success on resolution", async () => {
    (synthesizeAgentPOV as any).mockResolvedValue({ version: 2, tokenCount: 500 });
    const result = await processSynthesizerJob({
      data: { threadId: "t", agentId: "a", agentName: "X", panelId: "p" },
    } as any);
    expect(synthesizeAgentPOV).toHaveBeenCalledWith({
      threadId: "t", agentId: "a", agentName: "X", panelId: "p",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
    expect(result.tokenCount).toBe(500);
  });

  it("rethrows errors so Bull retries per queue config", async () => {
    (synthesizeAgentPOV as any).mockRejectedValue(new Error("model timed out"));
    await expect(
      processSynthesizerJob({
        data: { threadId: "t", agentId: "a", agentName: "X", panelId: "p" },
        attemptsMade: 0,
      } as any),
    ).rejects.toThrow("model timed out");
  });
});
