import { describe, it, expect } from "vitest";
import { buildArtifactsForMessage } from "./extractPipeline";

describe("buildArtifactsForMessage", () => {
  it("returns unchanged content and no artifacts when input has none", () => {
    const res = buildArtifactsForMessage({
      content: "just text",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => "art_fixed",
    });
    expect(res.updatedContent).toBe("just text");
    expect(res.artifacts).toEqual([]);
  });

  it("inserts chart artifact and placeholder from precomputed visualization", () => {
    let counter = 0;
    const res = buildArtifactsForMessage({
      content: "Chart is above.",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {
        visualization: { type: "bar", title: "Q3 Revenue", data: [{ q: "Q3", v: 100 }] },
      },
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => `art_${++counter}`,
    });
    expect(res.artifacts).toHaveLength(1);
    expect(res.artifacts[0].kind).toBe("chart");
    expect(res.artifacts[0].title).toBe("Q3 Revenue");
    expect(res.updatedContent).toContain('<artifact id="art_1" />');
  });

  it("extracts mermaid block, replaces it with placeholder", () => {
    const content = "Flow:\n```mermaid\nflowchart TD\nA-->B\n```\nDone.";
    const res = buildArtifactsForMessage({
      content,
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => "art_f",
    });
    expect(res.artifacts).toHaveLength(1);
    expect(res.artifacts[0].kind).toBe("flowchart");
    expect(res.updatedContent).not.toContain("```mermaid");
    expect(res.updatedContent).toContain('<artifact id="art_f" />');
  });

  it("assigns auto-layout positions to artifacts", () => {
    let counter = 0;
    const res = buildArtifactsForMessage({
      content: "```mermaid\nflowchart TD\nA-->B\n```\n```mermaid\ngraph TD\nC-->D\n```",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => `art_${++counter}`,
    });
    expect(res.artifacts[0].canvasX).toBe(0);
    expect(res.artifacts[0].canvasY).toBe(0);
    expect(res.artifacts[1].canvasX).toBeGreaterThan(0);
  });
});
