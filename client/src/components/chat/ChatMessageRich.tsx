import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { rehypeArtifactPlaceholder } from "./rehypeArtifactPlaceholder";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { ArtifactRenderer } from "./artifacts/ArtifactRenderer";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";

// NOTE: highlight.js theme CSS (e.g. `highlight.js/styles/github-dark.css`)
// must be imported once at the app entry point (main.tsx) — rehype-highlight
// only emits `hljs-*` class names, the colors come from the theme stylesheet.
// Importing it here pulls the CSS into every test file that mounts this
// component, and the wildcard `./styles/*` export doesn't play nicely with
// Vite's test resolver when a nested hljs version is present.

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

export function ChatMessageRich({
  content,
  conversationId,
}: {
  content: string;
  conversationId?: string;
}) {
  const { data } = useConversationArtifacts(conversationId);

  return (
    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeArtifactPlaceholder, rehypeKatex, rehypeHighlight]}
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
          "artifact-placeholder": ({ id }: any) => {
            const artifact = data?.byId[id];
            if (!artifact) {
              return <div className="text-xs text-muted-foreground italic">[artifact {id} loading…]</div>;
            }
            return (
              <div className="my-4">
                <ArtifactRenderer artifact={artifact} conversationId={conversationId} />
              </div>
            );
          },
        } as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
