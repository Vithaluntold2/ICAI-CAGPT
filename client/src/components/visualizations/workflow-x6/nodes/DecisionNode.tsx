import type { Node } from '@antv/x6';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Decision node — amber rotated-square diamond inside a 180×180 container.
 * The outer bounding box stays rectangular so x6's routing anchors are clean;
 * the visual diamond is a rotated absolute-positioned sibling behind an
 * upright centered label.
 */
export function DecisionNode({ node }: { node: Node }) {
  const data = (node.getData() ?? {}) as WorkflowNodeData;
  const { label, contentClipped } = data;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      title={data.tooltip}
    >
      {/* Rotated amber square behind the label */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-6 rounded-xl',
          'bg-gradient-to-br from-amber-500 to-amber-700',
          'shadow-[0_0_24px_rgba(245,158,11,0.3)]',
          'rotate-45',
          'transition-shadow duration-200',
          data.matchesSearch &&
            'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]',
        )}
      />

      {/* Info affordance */}
      <div
        className="absolute top-2 right-2 pointer-events-none z-20"
        aria-hidden
      >
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
        <span className="line-clamp-4 break-words">{label}</span>
      </div>
    </div>
  );
}
