/**
 * Normalises `<artifact id="…" />` (XML-style self-closing) into
 * `<artifact id="…"></artifact>` (explicit close) so the HTML5 parser
 * behind rehype-raw treats them as zero-content elements instead of
 * opening tags that swallow the rest of the document.
 *
 * Background: `<artifact>` is a custom element (not in the HTML5 void
 * element list), so `/>` self-closing syntax is silently dropped by the
 * parser. Without a matching `</artifact>`, the element is auto-closed
 * at end-of-document and everything after the tag becomes its children
 * — which means `rehypeArtifactPlaceholder` sees a different shape than
 * it expects and the placeholder renders as raw text.
 *
 * We fixed the server to emit explicit close tags (extractPipeline.ts)
 * but legacy messages already stored in the DB still have the self-
 * closing form. Running this at render time unblocks both new and old.
 *
 * Conservative: only rewrites empty self-closing tags (no inner
 * content). An `<artifact>...</artifact>` wrapping text is left alone.
 */
export function normalizeArtifactPlaceholders(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(
    /<artifact\s+id="([^"]+)"\s*\/>/g,
    (_m, id) => `<artifact id="${id}"></artifact>`,
  );
}
