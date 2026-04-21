import type { Node } from '@antv/x6';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Step node — card on --card with --border-strong outline and soft shadow.
 * Title + optional description + optional substeps preview (first 3).
 */
export function StepNode({ node }: { node: Node }) {
  const data = (node.getData() ?? {}) as WorkflowNodeData;
  const { label, description, substeps, compact, contentClipped } = data;
  const maxSubsteps = 3;

  return (
    <div
      className={cn(
        'relative w-full h-full bg-card border border-border-strong rounded-md',
        'px-3.5 py-2.5',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),_0_4px_12px_rgba(15,23,42,0.06)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),_0_4px_12px_rgba(0,0,0,0.4)]',
        'transition-all duration-200 hover:border-aurora-teal-soft/60',
        data.matchesSearch &&
          'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]',
      )}
      title={data.tooltip}
    >
      {/* Info-chip affordance */}
      <div
        className="absolute top-1.5 right-1.5 pointer-events-none z-10"
        aria-hidden
      >
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
          compact ? 'text-[12px] leading-[1.3]' : 'text-[13px] leading-[1.3]',
        )}
      >
        <span
          className={cn(
            'line-clamp-3 break-words',
            compact && 'line-clamp-2',
          )}
        >
          {label}
        </span>
      </div>

      {description && !compact && (
        <div className="mt-1 text-[11px] leading-[1.4] text-muted-foreground line-clamp-2 break-words">
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
              <span className="text-aurora-teal-soft mt-[3px] flex-shrink-0">
                •
              </span>
              <span className="line-clamp-1 break-words">{s}</span>
            </li>
          ))}
          {substeps.length > maxSubsteps && (
            <li className="text-[10px] italic text-muted-foreground/70 pt-0.5">
              +{substeps.length - maxSubsteps} more…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
