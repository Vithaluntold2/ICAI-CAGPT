import { useEffect, useRef } from "react";

let mermaidInitialized = false;

async function ensureMermaid() {
  const m = (await import("mermaid")).default;
  if (!mermaidInitialized) {
    m.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
    mermaidInitialized = true;
  }
  return m;
}

export function FlowchartArtifact({ payload }: { payload: { source: string } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await ensureMermaid();
        const id = `mm-${Math.random().toString(36).slice(2)}`;
        const { svg } = await m.render(id, payload.source);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e: any) {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre style="color:red">Mermaid error: ${e.message}</pre>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload.source]);

  return <div ref={ref} className="bg-card border rounded-lg p-4 overflow-auto" />;
}
