import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Step node — crisp card on `--card` with a `--border-strong` outline and
 * a soft drop-shadow for elevation. Renders title + optional description
 * + optional substeps preview (first 3). The info chip top-right signals
 * "more content available" when content is clipped.
 */
export function StepNode({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const { label, description, substeps, compact, contentClipped } = data;
  const maxSubsteps = 3;

  return (
    <div
      className={cn(
        'relative bg-card border border-border-strong rounded-md',
        'px-3.5 py-2.5 min-w-[200px]',
        compact ? 'max-w-[220px]' : 'max-w-[260px]',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),_0_4px_12px_rgba(15,23,42,0.06)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)]',
        'transition-all duration-200 hover:border-aurora-teal-soft/60',
        selected && 'ring-2 ring-aurora-teal-soft ring-offset-2 ring-offset-background',
        data.matchesSearch && 'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]',
        data.highlighted && 'animate-pulse',
      )}
      title={data.tooltip}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-foreground/20 !border-none"
      />

      {/* Info-chip affordance — visible when content is clipped; a plain
          icon otherwise so the "clickable for details" signal is always
          present. */}
      <div className="absolute top-1.5 right-1.5 pointer-events-none z-10" aria-hidden>
        {contentClipped ? (
          <div className="flex items-center gap-1 rounded-full bg-aurora-teal/15 border border-aurora-teal/30 px-1.5 py-[1px] text-[9px] font-semibold text-aurora-teal-soft font-mono">
            <Info className="h-2.5 w-2.5" />
            <span className="leading-none">MORE</span>
          </div>
        ) : (
          <Info className="h-3 w-3 text-muted-foreground/60" />
        )}
      </div>

      <div
        className={cn(
          'font-display font-semibold text-foreground pr-10',
          compact ? 'text-[12px] leading-[1.3]' : 'text-[13px] leading-[1.3]'
        )}
      >
        <span
          className={cn(
            'line-clamp-3 overflow-wrap-anywhere break-words',
            compact && 'line-clamp-2'
          )}
        >
          {label}
        </span>
      </div>

      {description && !compact && (
        <div className="mt-1 text-[11px] leading-[1.4] text-muted-foreground line-clamp-2 overflow-wrap-anywhere break-words">
          {description}
        </div>
      )}

      {substeps && substeps.length > 0 && !compact && (
        <ul className="mt-2 pt-2 border-t border-border/60 space-y-0.5">
          {substeps.slice(0, maxSubsteps).map((s, i) => (
            <li
              key={i}
              className="text-[10.5px] leading-[1.35] text-muted-foreground flex items-start gap-1.5"
            >
              <span className="text-aurora-teal-soft mt-[3px] flex-shrink-0">•</span>
              <span className="line-clamp-1 overflow-wrap-anywhere break-words">{s}</span>
            </li>
          ))}
          {substeps.length > maxSubsteps && (
            <li className="text-[10px] italic text-muted-foreground/70 pt-0.5">
              +{substeps.length - maxSubsteps} more…
            </li>
          )}
        </ul>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-foreground/20 !border-none"
      />
    </div>
  );
}
