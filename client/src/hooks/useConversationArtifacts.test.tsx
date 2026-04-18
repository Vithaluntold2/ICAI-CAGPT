// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConversationArtifacts } from "./useConversationArtifacts";
import React from "react";

describe("useConversationArtifacts", () => {
  it("fetches and returns artifacts for a conversation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        artifacts: [{
          id: "art_1", kind: "chart", title: "t", summary: "s", payload: {},
          canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1,
          conversationId: "c1", messageId: "m1", createdAt: new Date().toISOString(),
        }],
      }),
    }) as any;

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useConversationArtifacts("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.artifacts).toHaveLength(1);
    expect(result.current.data?.byId["art_1"].kind).toBe("chart");
  });

  it("is disabled when conversationId is undefined", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useConversationArtifacts(undefined), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });
});
