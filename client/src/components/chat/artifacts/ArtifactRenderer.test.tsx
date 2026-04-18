// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ArtifactRenderer } from "./ArtifactRenderer";

function makeArtifact(kind: string, extra: Record<string, any> = {}): any {
  return {
    id: "a1",
    kind,
    title: "t",
    summary: "s",
    payload: {},
    canvasX: 0,
    canvasY: 0,
    width: 600,
    height: 400,
    sequence: 1,
    conversationId: "c1",
    messageId: "m1",
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

describe("ArtifactRenderer", () => {
  it("falls back for unknown kinds", () => {
    render(<ArtifactRenderer artifact={makeArtifact("unknown")} />);
    expect(screen.getByText(/Unsupported artifact kind: unknown/)).toBeInTheDocument();
  });
});
