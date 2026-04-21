import type { Node } from '@antv/x6';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * End node — emerald gradient capsule. Same geometry as StartNode, different
 * palette to signal a terminal state.
 */
export function EndNode({ node }: { node: Node }) {
  const data = (node.getData() ?? {}) as WorkflowNodeData;
  return (
    <div
      className={cn(
        'relative w-full h-full px-4 flex items-center justify-center',
        'rounded-full text-white text-center',
        'font-display font-semibold text-[13px] leading-[1.25]',
        'bg-gradient-to-br from-emerald-800 via-emerald-600 to-emerald-500',
        'shadow-[0_0_24px_rgba(16,185,129,0.25)]',
        'transition-shadow duration-200 hover:shadow-[0_0_32px_rgba(16,185,129,0.45)]',
        data.matchesSearch &&
          'outline outline-[3px] outline-aurora-teal-soft outline-offset-[3px]',
      )}
      title={data.tooltip}
    >
      <span className="line-clamp-2 break-words">{data.label}</span>
    </div>
  );
}
