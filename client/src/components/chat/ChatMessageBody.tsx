// client/src/components/chat/ChatMessageBody.tsx
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { rehypeArtifactPlaceholder } from '@/components/chat/rehypeArtifactPlaceholder';
import { normalizeMath } from '@/lib/mathNormalizer';
import { normalizeArtifactPlaceholders } from '@/lib/normalizeArtifactPlaceholders';
import { FlowchartArtifact } from '@/components/chat/artifacts/FlowchartArtifact';
import { MindmapArtifact } from '@/components/chat/artifacts/MindmapArtifact';
import { CodeBlockWithCopy } from '@/components/chat/CodeBlockWithCopy';
import { InlineArtifactCard } from './InlineArtifactCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WhiteboardArtifact } from '../../../../shared/schema';

function extractCodeText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractCodeText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractCodeText((node as any).props?.children);
  }
  return '';
}

const MindmapCodeBlock = React.memo(function MindmapCodeBlock({
  raw,
  isStreaming,
}: {
  raw: string;
  isStreaming: boolean;
}) {
  const parseResult = useMemo(() => {
    try {
      return { ok: true as const, payload: JSON.parse(raw) };
    } catch (err: any) {
      return { ok: false as const, error: err?.message ?? 'parse error' };
    }
  }, [raw]);

  if (parseResult.ok) {
    return (
      <div className="my-4 not-prose">
        <MindmapArtifact payload={parseResult.payload} />
      </div>
    );
  }
  if (isStreaming) {
    return (
      <div className="my-4 not-prose text-xs text-muted-foreground italic flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        Generating mindmap…
      </div>
    );
  }
  return (
    <details className="my-4 not-prose text-xs border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
      <summary className="font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
        Mindmap couldn't be parsed — {parseResult.error}
      </summary>
      <pre className="mt-2 p-2 bg-muted rounded whitespace-pre-wrap break-all">{raw}</pre>
    </details>
  );
});

const FlowchartCodeBlock = React.memo(function FlowchartCodeBlock({
  source,
}: {
  source: string;
}) {
  const payload = useMemo(() => ({ source }), [source]);
  return (
    <div className="my-4 not-prose">
      <FlowchartArtifact payload={payload} />
    </div>
  );
});

interface ChatMessageBodyProps {
  content: string;
  artifactsById?: Record<string, WhiteboardArtifact>;
  conversationId?: string;
  isStreaming?: boolean;
  onOpenInWhiteboard?: (artifactId: string) => void;
}

export function ChatMessageBody({
  content,
  artifactsById,
  conversationId,
  isStreaming = false,
  onOpenInWhiteboard,
}: ChatMessageBodyProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeArtifactPlaceholder,
          rehypeKatex,
          [rehypeHighlight, { ignoreMissing: true, detect: false }],
        ]}
        components={
          {
            code: ({ className, children, inline, ...props }: any) => {
              if (inline || typeof className !== 'string') {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
              if (/language-mermaid/.test(className)) {
                return <FlowchartCodeBlock source={extractCodeText(children)} />;
              }
              if (/language-mindmap/.test(className)) {
                return (
                  <MindmapCodeBlock
                    raw={extractCodeText(children)}
                    isStreaming={isStreaming}
                  />
                );
              }
              return (
                <CodeBlockWithCopy className={className}>{children}</CodeBlockWithCopy>
              );
            },
            pre: ({ children }: any) => <>{children}</>,
            'artifact-placeholder': ({ id }: any) => {
              const artifact = artifactsById?.[id];
              if (!artifact) {
                return (
                  <div className="text-xs text-muted-foreground italic my-2">
                    [artifact {id} loading…]
                  </div>
                );
              }
              return (
                <InlineArtifactCard
                  artifact={artifact}
                  conversationId={conversationId}
                  onOpenInWhiteboard={onOpenInWhiteboard}
                />
              );
            },
            table: ({ children, ...props }: any) => (
              <div className="my-4 w-full overflow-auto">
                <Table {...props}>{children}</Table>
              </div>
            ),
            thead: ({ children, ...props }: any) => (
              <TableHeader {...props}>{children}</TableHeader>
            ),
            tbody: ({ children, ...props }: any) => (
              <TableBody {...props}>{children}</TableBody>
            ),
            tr: ({ children, ...props }: any) => (
              <TableRow {...props}>{children}</TableRow>
            ),
            th: ({ children, ...props }: any) => (
              <TableHead {...props}>{children}</TableHead>
            ),
            td: ({ children, ...props }: any) => (
              <TableCell {...props}>{children}</TableCell>
            ),
          } as any
        }
      >
        {normalizeMath(normalizeArtifactPlaceholders(content))}
      </ReactMarkdown>
    </div>
  );
}
