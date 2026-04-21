// client/src/components/chat/InlineArtifactCard.tsx
import { Copy, Download, Maximize2 } from 'lucide-react';
import type { WhiteboardArtifact } from '../../../../shared/schema';
import { ArtifactRenderer } from './artifacts/ArtifactRenderer';
import { KindPill } from './KindPill';

interface InlineArtifactCardProps {
  artifact: WhiteboardArtifact;
  conversationId?: string;
  onOpenInWhiteboard?: (artifactId: string) => void;
}

export function InlineArtifactCard({
  artifact,
  conversationId,
  onOpenInWhiteboard,
}: InlineArtifactCardProps) {
  const title = (artifact.payload as any)?.title ?? artifact.kind;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(artifact.payload, null, 2));
    } catch {
      // silently fail; clipboard may be blocked
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(artifact.payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.kind}-${artifact.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 bg-card border border-border rounded-md overflow-hidden">
      <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-[12px]">
        <div className="flex items-center gap-2 text-foreground font-display font-semibold">
          <KindPill kind={artifact.kind} />
          <span>{title}</span>
        </div>
        <div className="flex gap-0.5 text-muted-foreground">
          <ActionButton title="Copy JSON" onClick={handleCopy}>
            <Copy className="w-[13px] h-[13px]" strokeWidth={1.75} />
          </ActionButton>
          <ActionButton title="Download JSON" onClick={handleDownload}>
            <Download className="w-[13px] h-[13px]" strokeWidth={1.75} />
          </ActionButton>
          {onOpenInWhiteboard && (
            <ActionButton
              title="View in whiteboard"
              onClick={() => onOpenInWhiteboard(artifact.id)}
            >
              <Maximize2 className="w-[13px] h-[13px]" strokeWidth={1.75} />
            </ActionButton>
          )}
        </div>
      </header>
      <div className="p-4">
        <ArtifactRenderer
          artifact={artifact}
          conversationId={conversationId}
          embedded
        />
      </div>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-6 h-6 rounded flex items-center justify-center hover:bg-foreground/5 hover:text-aurora-teal-soft transition-colors"
    >
      {children}
    </button>
  );
}
