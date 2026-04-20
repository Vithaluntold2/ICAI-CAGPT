import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, Download } from "lucide-react";
import { normalizeMath } from "@/lib/mathNormalizer";

interface DocumentPayload {
  title?: string;
  content: string;
  mode?: string;
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "");
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <pre className="relative group rounded-md overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
        onClick={copy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <code className={className}>{children}</code>
    </pre>
  );
}

const markdownComponents = {
  table: ({ children }: any) => <Table>{children}</Table>,
  thead: ({ children }: any) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }: any) => <TableBody>{children}</TableBody>,
  tr: ({ children }: any) => <TableRow>{children}</TableRow>,
  th: ({ children }: any) => <TableHead>{children}</TableHead>,
  td: ({ children }: any) => <TableCell>{children}</TableCell>,
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children, ...rest }: any) => {
    if (!className?.startsWith("language-")) {
      return <code className="px-1 py-0.5 rounded bg-muted" {...rest}>{children}</code>;
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
} as any;

/**
 * Document artifact — long-form markdown (typically Deliverable Composer
 * output). Two modes:
 *   - embedded (inside ArtifactCard): no own chrome, fills the card.
 *   - standalone (chat inline): provides its own bordered card with a
 *     compact title row so it reads as a document in the transcript.
 */
export function DocumentArtifact({
  payload,
  embedded = false,
}: {
  payload: DocumentPayload;
  embedded?: boolean;
}) {
  const [copiedAll, setCopiedAll] = useState(false);
  const title = payload?.title || "Document";
  const content = payload?.content || "";

  const copyAll = async () => {
    await navigator.clipboard.writeText(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9_-]+/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-background shadow-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={copyAll}
        data-testid="document-artifact-copy"
      >
        {copiedAll ? (
          <><Check className="h-3 w-3 mr-1 text-green-500" />Copied</>
        ) : (
          <><Copy className="h-3 w-3 mr-1" />Copy</>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={downloadMarkdown}
        data-testid="document-artifact-download"
      >
        <Download className="h-3 w-3 mr-1" />
        .md
      </Button>
    </div>
  );

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
      components={markdownComponents}
    >
      {normalizeMath(content)}
    </ReactMarkdown>
  );

  // Embedded: ArtifactCard already provides the title + border + background,
  // so we skip our own duplicate header and card chrome. Just a scrollable
  // content area with the floating action cluster.
  if (embedded) {
    return (
      <div className="relative h-full w-full overflow-auto">
        {actions}
        <div className="p-5 prose prose-sm max-w-none dark:prose-invert">
          {markdown}
        </div>
      </div>
    );
  }

  // Standalone: inline chat rendering needs its own card chrome. Compact
  // title row + scrollable body. `h-full max-h-[720px]` lets content push
  // height up to the cap, then `flex-1 overflow-auto` scrolls the overflow.
  return (
    <div className="bg-card border rounded-lg flex flex-col h-full max-h-[720px] relative">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 pr-32">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-semibold text-sm truncate">{title}</span>
        {payload?.mode && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
            {payload.mode}
          </span>
        )}
      </div>
      {actions}
      <div className="flex-1 overflow-auto p-5">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {markdown}
        </div>
      </div>
    </div>
  );
}
