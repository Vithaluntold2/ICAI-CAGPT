// client/src/components/chat/InlineArtifactCard.tsx
import { useRef } from 'react';
import { Copy, Download, Maximize2 } from 'lucide-react';
import type { WhiteboardArtifact } from '../../../../shared/schema';
import { ArtifactRenderer } from './artifacts/ArtifactRenderer';
import { KindPill } from './KindPill';
import { useToast } from '@/hooks/use-toast';

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
  const bodyRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Capture the rendered artifact body as a PNG blob. html-to-image's
  // skipFonts avoids the `font.trim()` crash in v1.11 when the page has
  // external @font-face rules (the same workaround used in workflow /
  // flowchart exports).
  const captureBlob = async (): Promise<Blob | null> => {
    const el = bodyRef.current;
    if (!el) return null;
    const htmlToImage = await import('html-to-image');
    return htmlToImage.toBlob(el, {
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
    });
  };

  const slug = ((title as string) || artifact.kind)
    .toString()
    .replace(/[^a-z0-9_-]+/gi, '_');

  const handleCopy = async () => {
    try {
      const blob = await captureBlob();
      if (!blob) throw new Error('Nothing to copy');
      // ClipboardItem with image/png — supported in modern Chromium /
      // WebKit / Firefox. Falls through to the catch on older browsers.
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      toast({ title: 'Copied as PNG', description: 'Image copied to clipboard.' });
    } catch (err: any) {
      toast({
        title: 'Copy failed',
        description: err?.message ?? 'Clipboard rejected the image.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await captureBlob();
      if (!blob) throw new Error('Capture returned no image data.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-${artifact.id}.png`;
      // Chromium drops `a.click()` on a blob-URL anchor that isn't in
      // the DOM — the download never fires. Attach/detach around the
      // click so the browser actually honours it.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revocation so the browser has time to latch onto the URL
      // before we tear it down.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="my-3 bg-card border border-border rounded-md overflow-hidden">
      <header className="flex items-center justify-between px-3.5 py-2.5 border-b border-border text-[12px]">
        <div className="flex items-center gap-2 text-foreground font-display font-semibold">
          <KindPill kind={artifact.kind} />
          <span>{title}</span>
        </div>
        <div className="flex gap-0.5 text-muted-foreground">
          <ActionButton title="Copy as PNG" onClick={handleCopy}>
            <Copy className="w-[13px] h-[13px]" strokeWidth={1.75} />
          </ActionButton>
          {/* Checklists already render their own Export button in-card; a PNG
              download of a checklist is not a useful artefact, so we hide the
              header download icon for that kind to remove redundancy. */}
          {artifact.kind !== 'checklist' && (
            <ActionButton title="Download PNG" onClick={handleDownload}>
              <Download className="w-[13px] h-[13px]" strokeWidth={1.75} />
            </ActionButton>
          )}
          {onOpenInWhiteboard && (
            <ActionButton
              title="View in output"
              onClick={() => onOpenInWhiteboard(artifact.id)}
            >
              <Maximize2 className="w-[13px] h-[13px]" strokeWidth={1.75} />
            </ActionButton>
          )}
        </div>
      </header>
      <div ref={bodyRef} className="p-4">
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
