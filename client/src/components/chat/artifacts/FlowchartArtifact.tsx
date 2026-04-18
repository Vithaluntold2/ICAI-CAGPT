import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;
let mermaidModule: any = null;
let mermaidInitError: string | null = null;

async function ensureMermaid() {
  if (mermaidModule) return mermaidModule;
  try {
    const mod = await import("mermaid");
    const m = (mod as any).default ?? mod;
    if (!mermaidInitialized) {
      m.initialize({
        startOnLoad: false,
        theme: "default",
        // "strict" rejects anything non-trivial; "loose" tolerates more real-world
        // mermaid output (including inline HTML like <br/> in node labels).
        securityLevel: "loose",
        suppressErrorRendering: true,
      });
      mermaidInitialized = true;
    }
    mermaidModule = m;
    return m;
  } catch (err: any) {
    mermaidInitError = err?.message ?? String(err);
    throw err;
  }
}

/**
 * Normalise common mermaid-source mistakes the LLM makes:
 *   - `\n` (literal two-char escape) inside node labels → `<br/>`
 *   - leading/trailing whitespace
 */
function normalizeMermaidSource(src: string): string {
  return src
    .replace(/\\n/g, "<br/>") // literal backslash-n → HTML line break
    .trim();
}

export function FlowchartArtifact({ payload }: { payload: { source: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = payload?.source ?? "";

    if (!source) {
      setStatus("error");
      setErrorMsg("Empty mermaid source");
      return;
    }

    setStatus("rendering");
    setErrorMsg(null);

    (async () => {
      try {
        const m = await ensureMermaid();
        const id = `mm-${Math.random().toString(36).slice(2, 10)}`;
        const normalized = normalizeMermaidSource(source);
        // eslint-disable-next-line no-console
        console.debug("[FlowchartArtifact] rendering mermaid", { id, sourceLength: normalized.length });

        const result = await m.render(id, normalized);
        if (cancelled) return;
        const svg = typeof result === "string" ? result : (result as any).svg;
        if (!svg) throw new Error("mermaid.render returned no svg");
        if (ref.current) ref.current.innerHTML = svg;
        setStatus("ok");
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? String(e);
        // eslint-disable-next-line no-console
        console.error("[FlowchartArtifact] mermaid render failed", { error: msg, source });
        setErrorMsg(msg);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload?.source]);

  if (status === "error") {
    return (
      <div className="w-full h-full overflow-auto p-3 text-xs">
        <div className="font-medium text-red-600 mb-2">Flowchart failed to render</div>
        <div className="text-muted-foreground mb-2 break-words">
          {errorMsg ?? mermaidInitError ?? "unknown error"}
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Show mermaid source</summary>
          <pre className="mt-2 p-2 bg-muted rounded text-[11px] whitespace-pre-wrap break-all">
            {payload?.source ?? "(empty)"}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      {status === "rendering" && (
        <div className="p-3 text-xs text-muted-foreground italic">Rendering…</div>
      )}
      <div ref={ref} className="flex justify-center items-start p-2" />
    </div>
  );
}
