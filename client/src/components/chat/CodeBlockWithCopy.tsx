import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A fenced code block with a small hover-revealed copy button in the corner.
 * Used inside the chat's markdown renderer for any `language-*` block that
 * ISN'T a diagram (those are handled separately — mermaid → FlowchartArtifact,
 * mindmap → MindmapArtifact). Syntax highlighting comes from rehype-highlight
 * (wraps tokens in <span class="hljs-*">), themed by highlight.js/styles/github-dark.css
 * which is imported once in main.tsx.
 */
export function CodeBlockWithCopy({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied — silently ignore, the block is selectable
    }
  };

  return (
    <pre
      className={cn(
        "relative group rounded-md overflow-hidden my-3 not-prose",
        // override hljs theme's default padding to something tighter
        "[&>code]:p-3 [&>code]:block [&>code]:text-[13px] [&>code]:leading-snug",
      )}
    >
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn(
          "absolute right-2 top-2 z-10 h-7 w-7 rounded inline-flex items-center justify-center",
          "text-white/70 hover:text-white hover:bg-white/10",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <code className={className}>{children}</code>
    </pre>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as any).props?.children);
  }
  return "";
}
