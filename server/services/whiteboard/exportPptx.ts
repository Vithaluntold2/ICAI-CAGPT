import pptxgen from "pptxgenjs";
import type { WhiteboardArtifact } from "../../../shared/schema";

export async function buildBoardPptxBuffer(
  artifacts: WhiteboardArtifact[],
  renderedImages: Record<string, string>
): Promise<Buffer> {
  const pptx = new pptxgen();
  for (const a of artifacts) {
    const slide = pptx.addSlide();
    slide.addText(a.title, { x: 0.3, y: 0.3, fontSize: 22, bold: true });
    slide.addText(`${a.kind} · ${a.summary}`, { x: 0.3, y: 0.85, fontSize: 12, color: "666666" });
    const img = renderedImages[a.id];
    if (img) slide.addImage({ data: img, x: 0.3, y: 1.3, w: 9.4, h: 5.2 });
  }
  const arr = await pptx.write({ outputType: "arraybuffer" });
  return Buffer.from(arr as ArrayBuffer);
}
