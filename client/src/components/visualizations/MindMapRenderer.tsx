/**
 * MindMapRenderer — Mind Elixir powered mindmap.
 *
 * Replaces the prior @xyflow/react implementation, which required manual
 * theming, dark-mode MutationObserver hacks, and per-node luminance math just
 * to stay legible. Mind Elixir ships `THEME` / `DARK_THEME` palettes, native
 * `exportPng` / `exportSvg`, and its own layout engine — so all of that goes
 * away and we keep a lot less surface to maintain.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import MindElixir, {
  type MindElixirInstance,
  type MindElixirData,
  type NodeObj,
} from "mind-elixir";
import "mind-elixir/style";
import type { MindMapData, MindMapNode, MindMapEdge } from "@/../../shared/types/mindmap";

export interface MindMapRendererHandle {
  /** Capture the current mindmap as a PNG blob. Returns null if the instance
   *  isn't mounted yet. Used by the artifact wrapper's download menu. */
  exportPng: () => Promise<Blob | null>;
  /** Capture the current mindmap as an SVG blob. */
  exportSvg: () => Promise<Blob | null>;
}

interface MindMapRendererProps {
  data: MindMapData;
  /** When true, suppresses the internal title/subtitle header. Set by
   *  wrappers that already render the title, to avoid duplication. */
  embedded?: boolean;
  /** Preview mode: disables mind-elixir's own wheel/drag capture and
   *  adds a click-overlay that fires `onOpenFullscreen`. Used in the
   *  whiteboard card to avoid nested pan/zoom with the outer
   *  react-zoom-pan-pinch. */
  preview?: boolean;
  onOpenFullscreen?: () => void;
}

/**
 * Convert the server's flat `{nodes, edges}` payload into the nested
 * `{nodeData: {topic, children[]}}` shape Mind Elixir expects.
 *
 * Root selection:
 *   1. The first node with `type: 'root'` wins.
 *   2. Otherwise, pick a node with no incoming edge (a natural tree root).
 *   3. Fall back to the first node if neither applies.
 *
 * Orphans (nodes unreachable from root) are attached under root so nothing
 * silently disappears from a malformed payload.
 */

/**
 * Normalize a topic / note string for Mind Elixir.
 *
 * The LLM occasionally emits HTML-style line breaks (`<br/>`, `<br>`,
 * `<BR />`) directly inside labels. Mind Elixir treats `topic` as plain text,
 * so those render literally. `me-tpc` uses `white-space: pre-wrap`, so
 * replacing the tags with `\n` yields real line breaks. Also collapses
 * `\r\n` / `\r` for consistency and trims trailing whitespace.
 */
function normalizeTopic(s: string | null | undefined): string {
  // The AI payload is not statically typed — in practice we sometimes get a
  // node with `label: null`, `label: undefined`, or a numeric id used as the
  // label. Coerce defensively so we never throw "undefined.replace" during
  // render and blow up the whole chat tree through the ErrorBoundary.
  if (s === null || s === undefined) return "";
  const str = typeof s === "string" ? s : String(s);
  return str
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function toMindElixirData(data: MindMapData): MindElixirData {
  const nodes: MindMapNode[] = Array.isArray(data.nodes) ? data.nodes : [];
  const edges: MindMapEdge[] = Array.isArray(data.edges) ? data.edges : [];

  if (nodes.length === 0) {
    return {
      nodeData: {
        id: "empty",
        topic: normalizeTopic(data.title || "Empty mindmap"),
      },
    };
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const childrenById = new Map<string, string[]>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    const list = childrenById.get(edge.source) ?? [];
    list.push(edge.target);
    childrenById.set(edge.source, list);
    hasIncoming.add(edge.target);
  }

  const rootNode =
    nodes.find((n) => n.type === "root") ??
    nodes.find((n) => !hasIncoming.has(n.id)) ??
    nodes[0];

  const visited = new Set<string>();
  const build = (id: string): NodeObj | null => {
    if (visited.has(id)) return null; // break cycles
    visited.add(id);
    const n = nodeById.get(id);
    if (!n) return null;

    const childIds = childrenById.get(id) ?? [];
    const children = childIds
      .map(build)
      .filter((c): c is NodeObj => c !== null);

    const tags =
      n.metadata?.tags && n.metadata.tags.length > 0
        ? [...n.metadata.tags]
        : undefined;

    const topic = normalizeTopic(n.label) || `(node ${n.id ?? "?"})`;

    return {
      id: n.id,
      topic,
      note: n.description ? normalizeTopic(n.description) : undefined,
      icons: n.icon ? [n.icon] : undefined,
      tags,
      children: children.length > 0 ? children : undefined,
    };
  };

  const rootData = build(rootNode.id);
  if (!rootData) {
    // Unreachable in practice — `build` only returns null on cycle revisit,
    // and `rootNode.id` hasn't been visited yet. Kept for type narrowing.
    return {
      nodeData: {
        id: rootNode.id,
        topic: normalizeTopic(rootNode.label) || "(root)",
      },
    };
  }

  // Attach any nodes the BFS didn't reach (missing/malformed edges) so the
  // user still sees them instead of a silent drop.
  const orphans: NodeObj[] = [];
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      const orphan = build(n.id);
      if (orphan) orphans.push(orphan);
    }
  }
  if (orphans.length > 0) {
    rootData.children = [...(rootData.children ?? []), ...orphans];
  }

  return { nodeData: rootData };
}

const MindMapRenderer = forwardRef<MindMapRendererHandle, MindMapRendererProps>(
  function MindMapRenderer(
    { data, embedded = false, preview = false, onOpenFullscreen },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<MindElixirInstance | null>(null);

    const mindData = useMemo(() => toMindElixirData(data), [data]);
    const safeNodes = Array.isArray(data.nodes) ? data.nodes : [];

    // Mount / re-mount on data changes. Mind Elixir also exposes `refresh`,
    // but recreating the instance is simpler and keeps the dark-theme choice
    // consistent with whatever `.dark` state is current.
    useEffect(() => {
      const el = containerRef.current;
      if (!el || safeNodes.length === 0) return;

      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      const instance = new MindElixir({
        el,
        direction: MindElixir.SIDE,
        editable: false,
        contextMenu: false,
        toolBar: false,
        keypress: false,
        allowUndo: false,
        // In preview mode, swallow wheel events so the outer whiteboard's
        // pan/zoom owns the scroll. An absolutely-positioned overlay above
        // the canvas also blocks drag/pointer interactions and routes
        // clicks to `onOpenFullscreen`.
        handleWheel: preview ? () => {} : true,
        theme: isDark ? MindElixir.DARK_THEME : MindElixir.THEME,
      });
      instance.init(mindData);
      instanceRef.current = instance;

      // Auto-fit on mount + whenever the container resizes. Mind Elixir
      // renders at 1.0 scale by default; without this, wide mindmaps bleed
      // past the card's left/right edges. `scaleFit` picks the largest scale
      // that keeps every node inside the visible area. The initial call is
      // deferred one frame so Mind Elixir has time to lay out the tree.
      const fit = () => {
        try {
          instance.scaleFit();
        } catch {
          // Mind Elixir throws if called before the layout has painted;
          // a second rAF retry is almost always enough.
        }
      };
      const raf = requestAnimationFrame(() => {
        fit();
        requestAnimationFrame(fit);
      });

      const resizeObs = new ResizeObserver(() => fit());
      resizeObs.observe(el);

      return () => {
        cancelAnimationFrame(raf);
        resizeObs.disconnect();
        try {
          instance.destroy();
        } catch {
          // Mind Elixir's destroy throws on certain unmount races; the DOM
          // is being torn down anyway, so swallow silently.
        }
        instanceRef.current = null;
      };
    }, [mindData, safeNodes.length]);

    // Live light/dark toggle. Without this, a user flipping the theme while
    // a mindmap is already rendered would see stale colors until they
    // regenerate the artifact.
    useEffect(() => {
      if (typeof document === "undefined") return;
      const sync = () => {
        const instance = instanceRef.current;
        if (!instance) return;
        const isDark = document.documentElement.classList.contains("dark");
        instance.changeTheme(isDark ? MindElixir.DARK_THEME : MindElixir.THEME, true);
      };
      const obs = new MutationObserver(sync);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => obs.disconnect();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        // Mind Elixir ships its own `exportPng` / `exportSvg`, but both
        // route through `modern-screenshot` with font.ready/CORS logic
        // that silently returns `null` when anything is off (the user
        // then sees no download and no error). Capture the container
        // ourselves with html-to-image — same technique the workflow
        // artifact uses — so the export is reliable and the failure
        // mode is an actual thrown error we can surface to the caller.
        exportPng: async () => {
          const el = containerRef.current;
          if (!el) return null;
          try {
            const htmlToImage = await import("html-to-image");
            const isDark =
              typeof document !== "undefined" &&
              document.documentElement.classList.contains("dark");
            const rect = el.getBoundingClientRect();
            return await htmlToImage.toBlob(el, {
              pixelRatio: 2,
              cacheBust: true,
              skipFonts: true,
              width: Math.max(1, Math.round(rect.width)),
              height: Math.max(1, Math.round(rect.height)),
              backgroundColor: isDark ? "#0b1220" : "#ffffff",
            });
          } catch (err) {
            console.error("[MindMapRenderer] exportPng failed:", err);
            return null;
          }
        },
        exportSvg: async () => {
          const el = containerRef.current;
          if (!el) return null;
          try {
            const htmlToImage = await import("html-to-image");
            const isDark =
              typeof document !== "undefined" &&
              document.documentElement.classList.contains("dark");
            const rect = el.getBoundingClientRect();
            const dataUrl = await htmlToImage.toSvg(el, {
              cacheBust: true,
              skipFonts: true,
              width: Math.max(1, Math.round(rect.width)),
              height: Math.max(1, Math.round(rect.height)),
              backgroundColor: isDark ? "#0b1220" : "#ffffff",
            });
            const resp = await fetch(dataUrl);
            return await resp.blob();
          } catch (err) {
            console.error("[MindMapRenderer] exportSvg failed:", err);
            return null;
          }
        },
      }),
      []
    );

    if (safeNodes.length === 0) {
      return (
        <div
          className="w-full rounded-lg border border-border bg-muted/20 p-8 flex flex-col items-center justify-center text-center"
          style={{ minHeight: 240 }}
        >
          <div className="text-3xl mb-2">🧠</div>
          <p className="text-sm font-medium">No mindmap to display</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            The mindmap generation produced no nodes. This can happen if the
            response was empty or malformed — try re-sending the request.
          </p>
        </div>
      );
    }

    const showHeader = !embedded && !!data.title;

    return (
      <div
        className={
          // Embedded (InlineArtifactCard / whiteboard ArtifactCard) — fill
          // the parent's fixed height. Standalone — fall back to a sensible
          // 600 px default since nothing above sets a height for us.
          // Canvas uses the same --card tone as the surrounding chrome so
          // the inner canvas visually continues from the outer frame instead
          // of looking like a punched-in panel.
          "w-full relative border border-border rounded-lg overflow-hidden bg-card " +
          (embedded ? "h-full" : "h-[600px]")
        }
      >
        {showHeader && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">{data.title}</h3>
            {data.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          className={showHeader ? "h-[calc(100%-60px)] mt-[60px]" : "h-full"}
        />
        {/* Preview overlay — blocks drag/click on the mind-elixir canvas
            and routes clicks to onOpenFullscreen. Only rendered in preview
            mode so the interactive chat + fullscreen views keep drag/pan. */}
        {preview && onOpenFullscreen && (
          <button
            type="button"
            onClick={onOpenFullscreen}
            aria-label="Open mindmap in fullscreen"
            className="absolute inset-0 z-20 cursor-zoom-in group"
            data-testid="mindmap-preview-overlay"
          >
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-background/90 backdrop-blur border border-border px-2 py-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Open
            </span>
          </button>
        )}
      </div>
    );
  }
);

export default MindMapRenderer;
