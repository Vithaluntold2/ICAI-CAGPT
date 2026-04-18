import { describe, it, expect } from "vitest";
import { extractFlowcharts } from "./flowchart";

describe("extractFlowcharts", () => {
  it("returns empty array when no mermaid blocks", () => {
    expect(extractFlowcharts("plain text no code")).toEqual([]);
  });

  it("extracts a single mermaid flowchart block", () => {
    const content = "Here:\n```mermaid\nflowchart TD\n  A-->B\n```\nEnd.";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(1);
    expect(res[0].source).toContain("flowchart TD");
    expect(res[0].rawMatch).toContain("```mermaid");
    expect(res[0].title).toBe("Flowchart");
  });

  it("extracts multiple mermaid blocks in order", () => {
    const content = "```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\ngraph TD\nC-->D\n```";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(2);
    expect(res[0].source).toContain("A-->B");
    expect(res[1].source).toContain("C-->D");
  });

  it("ignores non-mermaid code fences", () => {
    const content = "```ts\nconst x = 1;\n```\n```mermaid\nflowchart TD\nX-->Y\n```";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(1);
    expect(res[0].source).toContain("X-->Y");
  });
});
