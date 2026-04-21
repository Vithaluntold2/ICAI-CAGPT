import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Decision node — amber rotated-square diamond.
 *
 * Two-div trick: the outer container stays rectangular (so React Flow's
 * layout engine sees a clean bounding box and handles anchor correctly).
 * An absolute-positioned inner div holds the rotated gradient square.
 * The label div stays UPRIGHT on top of the rotation, and the React Flow
 * handles attach to the rectangular edges (not the diamond corners) —
 * edges route in from top, out from bottom, which is the standard
 * flow-diagram convention even for diamonds.
 */
export function DecisionNode({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const { label, contentClipped } = data;

  return (
    <div
      className={cn(
        'relative w-[180px] h-[180px] flex items-center justify-center',
        data.highlighted && 'animate-pulse'
      )}
      title={data.tooltip}
    >
      {/* Rotated amber gradient square behind the label */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-6 rounded-xl',
          'bg-gradient-to-br from-amber-500 to-amber-700',
          'shadow-[0_0_24px_rgba(245,158,11,0.3)]',
          'rotate-45',
          'transition-shadow duration-200',
          selected && 'ring-2 ring-aurora-teal-soft ring-offset-2 ring-offset-background',
          data.matchesSearch && 'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]'
        )}
      />

      {/* Info affordance in the top corner, visible above the diamond */}
      <div className="absolute top-2 right-2 pointer-events-none z-20" aria-hidden>
        {contentClipped ? (
          <div className="flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-sm px-1.5 py-[1px] text-[9px] font-semibold text-white font-mono">
            <Info className="h-2.5 w-2.5" />
            <span className="leading-none">MORE</span>
          </div>
        ) : (
          <Info className="h-3 w-3 text-white/80" />
        )}
      </div>

      {/* Upright label on top of the rotated shape */}
      <div className="relative z-10 text-white font-display font-bold text-[12.5px] text-center px-8 leading-[1.2]">
        <span className="line-clamp-4 overflow-wrap-anywhere break-words">
          {label}
        </span>
      </div>

      {/* Handles — on the rectangular container edges so edge routing is
          clean. React Flow doesn't know about the rotated visual. */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-amber-500 !border-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-amber-500 !border-none"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-1.5 !h-1.5 !bg-amber-500 !border-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-1.5 !h-1.5 !bg-amber-500 !border-none"
      />
    </div>
  );
}
