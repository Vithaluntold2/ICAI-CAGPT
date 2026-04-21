import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MindMapRenderer, {
  type MindMapRendererHandle,
} from "../../visualizations/MindMapRenderer";

interface MindmapFullscreenModalProps {
  payload: any;
  onClose: () => void;
}

/**
 * Full-viewport fullscreen for mindmap artifacts.
 *
 * A dedicated modal mounts a fresh `MindMapRenderer` inside a portal
 * under `<body>`. The inline/preview instance in the card stays mounted
 * at its original location and untouched — mind-elixir's internal
 * canvas refs don't get yanked mid-instance. Close unmounts only the
 * fresh instance.
 */
export function MindmapFullscreenModal({
  payload,
  onClose,
}: MindmapFullscreenModalProps) {
  const rendererRef = useRef<MindMapRendererHandle>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleExport = useCallback(
    async (format: "png" | "svg" | "json") => {
      const baseName = ((payload?.title as string) || "mindmap").replace(
        /[^a-z0-9_-]+/gi,
        "_",
      );

      const triggerDownload = (blob: Blob, ext: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.${ext}`;
        // Anchor must be in the document for Chromium to honour the
        // programmatic click on a blob: URL — earlier detached click()
        // was the reason downloads were dropping silently.
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };

      try {
        if (format === "json") {
          triggerDownload(
            new Blob([JSON.stringify(payload, null, 2)], {
              type: "application/json",
            }),
            "json",
          );
          return;
        }

        const blob =
          format === "png"
            ? await rendererRef.current?.exportPng()
            : await rendererRef.current?.exportSvg();

        if (!blob) {
          throw new Error("Capture returned no image data.");
        }
        triggerDownload(blob, format);
      } catch (err) {
        console.error("[MindmapFullscreenModal] export failed", err);
        // Surface failure so the user knows the click was received.
        window.alert(
          `Mindmap export failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [payload],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 h-12 px-5 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur">
        <div className="font-display font-semibold text-[13px] truncate text-foreground">
          {payload?.title ?? "Mindmap"}
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Download…"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("png")}>
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("svg")}>
                SVG image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                JSON source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={onClose}
            title="Close (Esc)"
            data-testid="mindmap-fullscreen-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        {/* Fresh instance, fully interactive. */}
        <MindMapRenderer ref={rendererRef} data={payload} embedded />
      </div>
    </div>,
    document.body,
  );
}
