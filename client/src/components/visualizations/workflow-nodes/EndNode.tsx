import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * End node — emerald gradient capsule. Shares the capsule geometry with
 * StartNode but uses a different colour to signal "terminal state".
 */
export function EndNode({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  return (
    <div
      className={cn(
        'relative px-5 py-2.5 min-w-[160px] max-w-[240px]',
        'rounded-full text-white text-center',
        'font-display font-semibold text-[13px] leading-[1.25]',
        'bg-gradient-to-br from-emerald-800 via-emerald-600 to-emerald-500',
        'shadow-[0_0_24px_rgba(16,185,129,0.25)]',
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
