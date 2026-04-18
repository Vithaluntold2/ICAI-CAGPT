import { toPng } from "html-to-image";

export async function renderArtifactsToImages(): Promise<Record<string, string>> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-artifact-id]"));
  const out: Record<string, string> = {};
  for (const el of cards) {
    const id = el.dataset.artifactId!;
    try {
      out[id] = await toPng(el, { pixelRatio: 2 });
    } catch {
      // skip artifacts that can't be captured (e.g. rendering-in-flight)
    }
  }
  return out;
}
