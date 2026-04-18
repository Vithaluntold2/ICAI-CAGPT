import { describe, it, expect } from "vitest";
import { buildBoardPptxBuffer } from "./exportPptx";

describe("buildBoardPptxBuffer", () => {
  it("produces a non-empty pptx buffer for one artifact without image", async () => {
    const buf = await buildBoardPptxBuffer(
      [{ id: "a1", kind: "chart", title: "Revenue", summary: "Q1-Q4", payload: {} } as any],
      {}
    );
    expect(buf.byteLength).toBeGreaterThan(100);
  });
});
