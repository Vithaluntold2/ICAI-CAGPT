import type { Node } from '@antv/x6';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from './types';

/**
 * Start node — gradient capsule (navy → cyan). Filled to the node's cell
 * bounds (180×48) by @antv/x6-react-shape. X6 handles positioning and ports.
 */
export function StartNode({ node }: { node: Node }) {
  const data = (node.getData() ?? {}) as WorkflowNodeData;
  return (
    <div
      className={cn(
        'relative w-full h-full px-4 flex items-center justify-center',
        'rounded-full text-white text-center',
        'font-display font-semibold text-[13px] leading-[1.25]',
        // aurora-* tailwind tokens are not registered in tailwind.config,
        // so `from-aurora-navy` etc. emit nothing and the capsule went
        // white in light mode. Paint the gradient via the CSS variable
        // we already define in index.css.
        'shadow-[0_0_24px_rgba(8,145,178,0.25)]',
        'transition-shadow duration-200 hover:shadow-[0_0_32px_rgba(8,145,178,0.45)]',
      )}
      style={{ backgroundImage: 'var(--gradient-aurora)' }}
      title={data.tooltip}
    >
      <span className="line-clamp-2 break-words">{data.label}</span>
    </div>
  );
}
