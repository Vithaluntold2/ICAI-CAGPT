import ExcelJS from "exceljs";
import type { WhiteboardArtifact } from "../../../shared/schema";

export async function buildBoardXlsxBuffer(artifacts: WhiteboardArtifact[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const skipped: Array<{ id: string; kind: string; title: string }> = [];

  for (const a of artifacts) {
    if (a.kind === "chart") {
      const rows = ((a.payload as any)?.data ?? []) as Array<Record<string, unknown>>;
      const name = (a.title || a.id).slice(0, 28);
      const ws = wb.addWorksheet(name);
      if (rows.length > 0) {
        const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
        ws.addRow(keys);
        for (const r of rows) ws.addRow(keys.map(k => (r as any)[k] ?? ""));
      }
    } else if (a.kind === "spreadsheet") {
      const sheets = ((a.payload as any)?.sheets ?? []) as Array<{ name: string; rows: unknown[][] }>;
      for (const s of sheets) {
        const name = `${(a.title || a.id).slice(0, 20)}-${String(s.name ?? "s").slice(0, 8)}`;
        const ws = wb.addWorksheet(name);
        for (const row of s.rows ?? []) ws.addRow(row);
      }
    } else {
      skipped.push({ id: a.id, kind: a.kind, title: a.title });
    }
  }

  if (skipped.length > 0) {
    const ws = wb.addWorksheet("Skipped");
    ws.addRow(["id", "kind", "title"]);
    for (const s of skipped) ws.addRow([s.id, s.kind, s.title]);
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
