import { describe, it, expect } from "vitest";
import { buildBoardPdfBuffer } from "./exportPdf";

describe("buildBoardPdfBuffer", () => {
  it("produces a non-empty PDF buffer with a title page for one artifact", async () => {
    const buf = await buildBoardPdfBuffer(
      [{ id: "a1", kind: "chart", title: "Revenue", summary: "Q1-Q4", payload: {} } as any],
      {}
    );
    expect(buf.byteLength).toBeGreaterThan(100);
    // PDF header magic
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});
