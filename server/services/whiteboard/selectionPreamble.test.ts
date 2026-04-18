import { describe, it, expect } from "vitest";
import { buildSelectionPreamble } from "./selectionPreamble";

describe("buildSelectionPreamble", () => {
  it("returns empty when no selection", () => {
    expect(buildSelectionPreamble(undefined)).toBe("");
    expect(buildSelectionPreamble({})).toBe("");
  });

  it("formats single artifact selection", () => {
    expect(buildSelectionPreamble({ artifactIds: ["art_1"] }))
      .toContain("[User has selected artifact art_1.]");
  });

  it("formats multi-artifact selection", () => {
    expect(buildSelectionPreamble({ artifactIds: ["art_1", "art_2", "art_3"] }))
      .toContain("[User has selected artifacts art_1, art_2, art_3.]");
  });

  it("includes highlighted text when present", () => {
    const out = buildSelectionPreamble({ artifactIds: ["art_1"], highlightedText: "cash flow row 3" });
    expect(out).toContain("art_1");
    expect(out).toContain('[Highlighted excerpt: "cash flow row 3"]');
  });

  it("returns non-empty when only highlightedText present", () => {
    const out = buildSelectionPreamble({ highlightedText: "x" });
    expect(out).toContain('[Highlighted excerpt: "x"]');
  });
});
