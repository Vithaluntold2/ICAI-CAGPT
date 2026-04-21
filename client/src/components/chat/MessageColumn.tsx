// client/src/components/chat/MessageColumn.tsx
import type { ReactNode } from 'react';

interface MessageColumnProps {
  children: ReactNode;
}

export function MessageColumn({ children }: MessageColumnProps) {
  // `min-h-0` is load-bearing. In a flex column the default min-height of a
  // flex child is `auto` (content-sized), which defeats `overflow-y-auto` —
  // tall content pushes the column past its parent's bounds and the scroll
  // escapes up to <body>, producing an outer page scrollbar that drags the
  // whole UI (composer included) out of the viewport. `min-h-0` lets the
  // flex algorithm shrink this column to the available space so the inner
  // overflow-y-auto actually becomes the scroll surface.
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-7 pb-[180px] flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
