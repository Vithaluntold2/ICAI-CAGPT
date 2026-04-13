/**
 * Enhanced Code Block with Copy Functionality
 * 
 * Professional code display with:
 * - Syntax highlighting
 * - Copy to clipboard
 * - Language indicator
 * - Line numbers
 * - Smooth animations
 */

import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { toast } from '@/lib/toast';
import { Button } from './button';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
  highlightLines = [],
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="group relative my-4 rounded-lg border border-border overflow-hidden bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="w-4 h-4" />
          {filename ? (
            <span className="font-medium">{filename}</span>
          ) : (
            <span className="uppercase">{language}</span>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={theme === 'dark' ? oneDark : oneLight}
        showLineNumbers={showLineNumbers}
        wrapLines={highlightLines.length > 0}
        lineProps={(lineNumber) => {
          const isHighlighted = highlightLines.includes(lineNumber);
          return {
            style: {
              backgroundColor: isHighlighted
                ? 'rgba(255, 255, 0, 0.1)'
                : undefined,
              display: 'block',
              width: '100%',
            },
          };
        }}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-mono)',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Inline Code Component
 */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-sm border border-border">
      {children}
    </code>
  );
}

/**
 * Multi-file Code Display (Tabs)
 */
interface CodeFile {
  filename: string;
  code: string;
  language: string;
}

export function MultiFileCodeBlock({ files }: { files: CodeFile[] }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="my-4 rounded-lg border border-border overflow-hidden">
      {/* File tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b border-border overflow-x-auto">
        {files.map((file, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${
                activeTab === index
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }
            `}
          >
            {file.filename}
          </button>
        ))}
      </div>

      {/* Active file */}
      <CodeBlock
        code={files[activeTab].code}
        language={files[activeTab].language}
        showLineNumbers={true}
      />
    </div>
  );
}

/**
 * Example Usage:
 * 
 * // Simple code block
 * <CodeBlock
 *   code={`const hello = "world";\nconsole.log(hello);`}
 *   language="javascript"
 * />
 * 
 * // With filename
 * <CodeBlock
 *   code={tsCode}
 *   language="typescript"
 *   filename="server/index.ts"
 *   highlightLines={[5, 6, 7]}
 * />
 * 
 * // Inline code
 * <p>Use the <InlineCode>npm install</InlineCode> command</p>
 * 
 * // Multiple files
 * <MultiFileCodeBlock
 *   files={[
 *     { filename: 'index.ts', code: '...', language: 'typescript' },
 *     { filename: 'styles.css', code: '...', language: 'css' },
 *   ]}
 * />
 */
