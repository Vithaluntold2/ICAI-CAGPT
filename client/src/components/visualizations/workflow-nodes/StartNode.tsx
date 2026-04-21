import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Start node — gradient capsule (navy → cyan).
 *
 * Rendered via React Flow's `nodeTypes` API so we have full JSX control
 * (no wrapper div / inline style fighting). Width is fixed so dagre can
 * lay out around it; height auto-sizes to the label.
 */
export function StartNode({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  return (
    <div
      className={cn(
        'relative px-5 py-2.5 min-w-[160px] max-w-[240px]',
        'rounded-full text-white text-center',
        'font-display font-semibold text-[13px] leading-[1.25]',
        'bg-gradient-to-br from-aurora-navy via-aurora-cyan to-aurora-teal',
        'shadow-[0_0_24px_rgba(8,145,178,0.25)]',
        'transition-shadow duration-200',
        selected && 'ring-2 ring-aurora-teal-soft ring-offset-2 ring-offset-background',
        data.matchesSearch && 'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]',
        data.highlighted && 'animate-pulse',
      )}
      title={data.tooltip}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-none"
      />
      <span className="line-clamp-2 overflow-wrap-anywhere break-words">
        {data.label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-none"
      />
    </div>
  );
}
