import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import WorkflowRendererX6 from './WorkflowRendererX6';

interface WorkflowFullscreenModalProps {
  nodes: any;
  edges: any;
  title?: string;
  layout?: string;
  onClose: () => void;
}

/**
 * Full-viewport fullscreen for workflow artifacts.
 *
 * The inline/preview WorkflowRendererX6 instance stays mounted at its
 * original DOM location — we do NOT portal-move it. Instead, this modal
 * mounts a completely fresh WorkflowRendererX6 instance inside a portal,
 * with its own x6 Graph. Close → modal unmounts, fresh graph disposes,
 * inline view is untouched.
 *
 * This sidesteps the x6-portal bug where moving the container DOM mid
 * instance left the graph disoriented (blank fullscreen, broken inline
 * on return). Two instances of x6 running at the same time use a
 * little extra memory, but each is small and the fullscreen one is
 * torn down on close.
 */
export function WorkflowFullscreenModal({
  nodes,
  edges,
  title,
  layout,
  onClose,
}: WorkflowFullscreenModalProps) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 h-12 px-5 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur">
        <div className="font-display font-semibold text-[13px] truncate text-foreground">
          {title ?? 'Workflow'}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fullscreen (Esc)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
          data-testid="workflow-fullscreen-close"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="flex-1 min-h-0">
        {/* Fresh instance. No onOpenFullscreen — we're already fullscreen. */}
        <WorkflowRendererX6
          nodes={nodes}
          edges={edges}
          title={title}
          layout={layout}
          embedded
        />
      </div>
    </div>,
    document.body,
  );
}
