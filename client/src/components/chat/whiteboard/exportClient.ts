import { toPng } from "html-to-image";

export async function renderArtifactsToImages(): Promise<Record<string, string>> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-artifact-id]"));
  const out: Record<string, string> = {};
  for (const el of cards) {
    const id = el.dataset.artifactId!;
    try {
      // skipFonts avoids the html-to-image@1.11.x `font.trim()` crash on
      // elements with an undefined computed font shorthand (e.g. some SVG
      // descendants inside ReactFlow cards).
      out[id] = await toPng(el, { pixelRatio: 2, skipFonts: true });
    } catch {
      // skip artifacts that can't be captured (e.g. rendering-in-flight)
    }
  }
  return out;
}
