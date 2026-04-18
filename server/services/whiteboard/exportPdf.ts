import PDFDocument from "pdfkit";
import type { WhiteboardArtifact } from "../../../shared/schema";

export function buildBoardPdfBuffer(
  artifacts: WhiteboardArtifact[],
  renderedImages: Record<string, string>
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let first = true;
    for (const a of artifacts) {
      if (first) first = false;
      else doc.addPage();
      doc.fontSize(20).fillColor("black").text(a.title).moveDown(0.3);
      doc.fontSize(11).fillColor("#666").text(`${a.kind} · ${a.summary}`).moveDown();
      const img = renderedImages[a.id];
      if (img) {
        const b64 = img.replace(/^data:image\/\w+;base64,/, "");
        try {
          doc.image(Buffer.from(b64, "base64"), { fit: [515, 650], align: "center", valign: "center" });
        } catch {
          doc.fillColor("red").text("[image render failed]");
        }
      }
    }
    doc.end();
  });
}
