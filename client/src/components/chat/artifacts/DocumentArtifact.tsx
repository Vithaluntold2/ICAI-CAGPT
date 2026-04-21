import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, FileDown, Loader2 } from "lucide-react";
import { normalizeMath } from "@/lib/mathNormalizer";
import { useToast } from "@/hooks/use-toast";

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();
  const title = payload?.title || "Document";
  const content = payload?.content || "";
  const safeName = title.replace(/[^a-z0-9_-]+/gi, "_");

  // Produce a real *vector* PDF — text stays text, not a screenshot.
  //
  // Pipeline: rendered markdown HTML → html-to-pdfmake (converts to pdfmake's
  // doc-definition tree) → pdfmake (emits actual PDF text/vector commands).
  // Output is selectable, copy-pasteable, sharp at any zoom — the "written
  // then saved" quality the user wanted. html2pdf.js was replaced because
  // it rasterises every page via html2canvas, which produces the blurry
  // screenshot look.
  const downloadPDF = async () => {
    if (!contentRef.current || downloading) return;
    setDownloading(true);

    try {
      const [{ default: htmlToPdfmake }, pdfmakeMod, vfsMod] = await Promise.all([
        import("html-to-pdfmake"),
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/vfs_fonts"),
      ]);

      // pdfmake needs its virtual font table wired up. Shape differs
      // across versions — cover both.
      const pdfmake: any = (pdfmakeMod as any).default ?? pdfmakeMod;
      const vfs: any = (vfsMod as any).default ?? vfsMod;
      pdfmake.vfs = vfs.pdfMake?.vfs ?? vfs.vfs ?? vfs;

      const html = contentRef.current.innerHTML;
      const body = htmlToPdfmake(html, {
        // Default font sizes in px; pdfmake converts. These match an
        // A4 business-document look.
        defaultStyles: {
          h1: { fontSize: 18, bold: true, marginTop: 14, marginBottom: 6 },
          h2: { fontSize: 15, bold: true, marginTop: 12, marginBottom: 5 },
          h3: { fontSize: 13, bold: true, marginTop: 10, marginBottom: 4 },
          p: { marginBottom: 6, lineHeight: 1.35 },
          ul: { marginBottom: 6 },
          ol: { marginBottom: 6 },
          li: { marginBottom: 2 },
          table: { marginTop: 6, marginBottom: 6 },
          th: { bold: true, fillColor: "#f4f4f4" },
          code: { font: "Courier", fontSize: 10 },
          pre: { font: "Courier", fontSize: 10, background: "#f6f8fa" },
          blockquote: { italics: true, color: "#374151", marginLeft: 8 },
          a: { color: "#1a56db", decoration: "underline" },
        },
      });

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [48, 56, 48, 56] as [number, number, number, number],
        info: {
          title,
          creator: "CA-GPT",
        },
        content: [
          { text: title, fontSize: 20, bold: true, marginBottom: 4 },
          {
            text: [
              payload?.mode ? { text: `${payload.mode} · `, color: "#666" } : "",
              { text: `Generated ${new Date().toLocaleDateString()}`, color: "#666" },
            ],
            fontSize: 9,
            marginBottom: 14,
          },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: "#ddd" }], marginBottom: 10 },
          body,
        ],
        defaultStyle: {
          fontSize: 11,
          lineHeight: 1.35,
          color: "#111",
        },
      };

      pdfmake.createPdf(docDefinition).download(`${safeName}.pdf`);
    } catch (err: any) {
      toast({
        title: "PDF export failed",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
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
            onClick={downloadPDF}
            disabled={downloading}
            data-testid="document-artifact-download-pdf"
            title="Download as PDF"
          >
            {downloading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />PDF</>
            ) : (
              <><FileDown className="h-3 w-3 mr-1" />PDF</>
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        <div ref={contentRef} className="prose prose-sm max-w-none dark:prose-invert">
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
