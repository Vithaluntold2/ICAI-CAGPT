import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildBoardXlsxBuffer } from "./exportXlsx";

describe("buildBoardXlsxBuffer", () => {
  it("produces a non-empty workbook for a chart artifact", async () => {
    const buf = await buildBoardXlsxBuffer([
      { id: "a1", kind: "chart", title: "Revenue",
        payload: { data: [{ q: "Q1", v: 100 }, { q: "Q2", v: 150 }] } } as any,
    ]);
    expect(buf.byteLength).toBeGreaterThan(0);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Revenue");
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).values).toContain("q");
    expect(ws!.getRow(1).values).toContain("v");
  });

  it("emits a Skipped sheet when only non-tabular artifacts are present", async () => {
    const buf = await buildBoardXlsxBuffer([
      { id: "a1", kind: "workflow", title: "Process", payload: { nodes: [], edges: [] } } as any,
      { id: "a2", kind: "mindmap", title: "Ideas", payload: { nodes: [] } } as any,
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet("Skipped");
    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBeGreaterThanOrEqual(3); // header + 2 skipped
  });

  it("handles empty artifact array", async () => {
    const buf = await buildBoardXlsxBuffer([]);
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
