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

/**
 * Document artifact — renders long-form markdown (typically Deliverable
 * Composer output) inside a scrollable, document-like card so it can be
 * selected, referenced, and read comfortably on the whiteboard.
 */
export function DocumentArtifact({ payload }: { payload: DocumentPayload }) {
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

  return (
    <div className="bg-card border rounded-lg flex flex-col h-full max-h-[780px]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">{title}</span>
          {payload?.mode && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
              {payload.mode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
      </div>
      <div className="flex-1 overflow-auto p-5">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
            components={{
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
            } as any}
          >
            {normalizeMath(content)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
