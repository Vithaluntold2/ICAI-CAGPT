import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
 *   - square-bracket labels with unquoted `(`, `)`, `,`, `:`, `#` etc. get wrapped in double quotes
 *   - same for `(...)`, `{...}`, `((...))`, `{{...}}` node shapes
 *   - leading/trailing whitespace
 */
const SPECIAL_IN_LABEL = /[(),:;#"]/;

function quoteIfNeeded(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return content;
  if (!SPECIAL_IN_LABEL.test(content)) return content;
  return `"${content.replace(/"/g, '\\"')}"`;
}

function normalizeMermaidSource(src: string): string {
  let out = src.replace(/\\n/g, "<br/>");

  // Node shape: IDENTIFIER[...]
  out = out.replace(/(\b\w+)\[([^\]]+)\]/g, (_m, id, content) => `${id}[${quoteIfNeeded(content)}]`);
  // Circle: IDENTIFIER((...))
  out = out.replace(/(\b\w+)\(\(([^)]+)\)\)/g, (_m, id, content) => `${id}((${quoteIfNeeded(content)}))`);
  // Rounded: IDENTIFIER(...)
  out = out.replace(/(\b\w+)\(([^)]+)\)/g, (_m, id, content) => `${id}(${quoteIfNeeded(content)})`);
  // Hexagon: IDENTIFIER{{...}}
  out = out.replace(/(\b\w+)\{\{([^}]+)\}\}/g, (_m, id, content) => `${id}{{${quoteIfNeeded(content)}}}`);
  // Diamond: IDENTIFIER{...}
  out = out.replace(/(\b\w+)\{([^}]+)\}/g, (_m, id, content) => `${id}{${quoteIfNeeded(content)}}`);

  return out.trim();
}

export function FlowchartArtifact({ payload }: { payload: { source: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExport = useCallback(async (format: "png" | "svg") => {
    // Mermaid renders a real <svg> element into `ref.current`. For SVG we can
    // download the markup directly; for PNG we hand the SVG to html-to-image
    // which rasterises it via a data-URL → canvas pipeline.
    const svgEl = ref.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svgEl) return;

    if (format === "svg") {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowchart-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(svgEl as unknown as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // Works around html-to-image@1.11.x crash on `font.trim()` during
        // @font-face embedding when the computed font shorthand is undefined.
        skipFonts: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `flowchart-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error("[FlowchartArtifact] PNG export failed:", err);
    }
  }, []);

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
    <div className="relative w-full h-full overflow-auto">
      {status === "rendering" && (
        <div className="p-3 text-xs text-muted-foreground italic">Rendering…</div>
      )}
      {status === "ok" && (
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 bg-background/90 backdrop-blur shadow-sm"
                title="Download…"
                data-testid="flowchart-download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("png")}>
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("svg")}>
                SVG image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div ref={ref} className="flex justify-center items-start p-2" />
    </div>
  );
}
