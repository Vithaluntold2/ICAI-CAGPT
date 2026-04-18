// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Whiteboard } from "./Whiteboard";
import React from "react";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Whiteboard", () => {
  it("shows empty state when no artifacts", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ artifacts: [] }) }) as any;
    wrap(<Whiteboard conversationId="c1" />);
    expect(await screen.findByTestId("whiteboard-empty")).toBeInTheDocument();
  });
});
