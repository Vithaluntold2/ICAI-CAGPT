// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatMessageRich } from "./ChatMessageRich";
import React from "react";

function wrap(ui: React.ReactNode) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ artifacts: [] }) }) as any;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ChatMessageRich", () => {
  it("renders a GFM table", () => {
    wrap(<ChatMessageRich content={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders strong/emphasis markdown", () => {
    wrap(<ChatMessageRich content="hello **world**" />);
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("shows placeholder text when artifact is not yet loaded", () => {
    wrap(<ChatMessageRich content={'text <artifact id="art_x"></artifact>'} conversationId="c" />);
    expect(screen.getByText(/artifact art_x loading/i)).toBeInTheDocument();
  });
});
