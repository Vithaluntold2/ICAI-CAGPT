import { describe, it, expect } from "vitest";
import { formatManifest, trimToTokenBudget, estimateTokens } from "./manifest";

describe("manifest", () => {
  it("formatManifest returns empty string when no artifacts", () => {
    expect(formatManifest([])).toBe("");
  });

  it("formatManifest includes one line per artifact", () => {
    const out = formatManifest([
      { id: "a1", kind: "chart", title: "Revenue", summary: "quarterly revenue" } as any,
      { id: "a2", kind: "workflow", title: "Close", summary: "9-step close" } as any,
    ]);
    expect(out).toContain("# Whiteboard (current conversation, 2 artifacts)");
    expect(out).toContain('- a1 · chart · "Revenue" — quarterly revenue');
    expect(out).toContain('- a2 · workflow · "Close" — 9-step close');
    expect(out).toContain("read_whiteboard(artifact_id)");
  });

  it("trimToTokenBudget keeps newest and reports omitted count", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, kind: "chart", title: `t${i}`, summary: "s".repeat(60) } as any));
    const trimmed = trimToTokenBudget(many, 200);
    expect(trimmed.kept.length).toBeLessThan(50);
    expect(trimmed.kept[trimmed.kept.length - 1].id).toBe("a49");
    expect(trimmed.omitted).toBeGreaterThan(0);
  });

  it("estimateTokens is monotonically non-decreasing in length", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hello")).toBeGreaterThan(0);
    expect(estimateTokens("hello world hello world")).toBeGreaterThan(estimateTokens("hello"));
  });
});
