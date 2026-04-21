// client/src/components/chat/MessageColumn.tsx
import type { ReactNode } from 'react';

interface MessageColumnProps {
  children: ReactNode;
}

export function MessageColumn({ children }: MessageColumnProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-7 pb-[180px] flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
