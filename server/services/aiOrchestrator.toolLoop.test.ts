import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeWithToolLoop } from "./aiOrchestrator.toolLoop";
import { toolRegistry } from "./tools/registry";
import type { CompletionResponse } from "./aiProviders/types";

describe("completeWithToolLoop", () => {
  beforeEach(() => {
    // Clean registry between tests (private field access is fine in tests)
    (toolRegistry as any).tools = new Map();
  });

  it("returns response directly when no tool calls", async () => {
    const provider: any = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: "hello",
        finishReason: "stop",
        tokensUsed: { input: 0, output: 0, total: 0 },
        model: "test",
        provider: "test",
      } as CompletionResponse),
    };
    const res = await completeWithToolLoop(
      provider,
      { messages: [] } as any,
      { conversationId: "c1", userId: "u1" }
    );
    expect(res.content).toBe("hello");
    expect(provider.generateCompletion).toHaveBeenCalledTimes(1);
  });

  it("invokes the tool and resubmits when finishReason is tool_calls", async () => {
    toolRegistry.register({
      name: "echo",
      description: "x",
      inputSchema: { type: "object" },
      handler: async ({ msg }: any) => ({ echoed: msg }),
    });

    const provider: any = {
      generateCompletion: vi.fn()
        .mockResolvedValueOnce({
          content: "",
          finishReason: "tool_calls",
          metadata: { toolCalls: [{ id: "c1", name: "echo", input: { msg: "hi" } }] },
          tokensUsed: { input: 0, output: 0, total: 0 },
          model: "t",
          provider: "t",
        } as CompletionResponse)
        .mockResolvedValueOnce({
          content: "done",
          finishReason: "stop",
          tokensUsed: { input: 0, output: 0, total: 0 },
          model: "t",
          provider: "t",
        } as CompletionResponse),
    };

    const res = await completeWithToolLoop(
      provider,
      { messages: [{ role: "user", content: "q" }] } as any,
      { conversationId: "c1", userId: "u1" }
    );
    expect(res.content).toBe("done");
    expect(provider.generateCompletion).toHaveBeenCalledTimes(2);
    const secondCall = provider.generateCompletion.mock.calls[1][0];
    expect(secondCall.messages.length).toBeGreaterThan(1);
    expect(JSON.stringify(secondCall.messages)).toContain("echoed");
  });

  it("caps iterations at 5", async () => {
    toolRegistry.register({
      name: "loop",
      description: "x",
      inputSchema: { type: "object" },
      handler: async () => ({ ok: true }),
    });
    const provider: any = {
      generateCompletion: vi.fn().mockResolvedValue({
        content: "",
        finishReason: "tool_calls",
        metadata: { toolCalls: [{ id: "x", name: "loop", input: {} }] },
        tokensUsed: { input: 0, output: 0, total: 0 },
        model: "t",
        provider: "t",
      } as CompletionResponse),
    };
    await completeWithToolLoop(
      provider,
      { messages: [] } as any,
      { conversationId: "c", userId: "u" }
    );
    expect(provider.generateCompletion).toHaveBeenCalledTimes(5);
  });
});
