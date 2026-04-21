// client/src/components/chat/UserTurn.tsx
interface UserTurnProps {
  children: React.ReactNode;
  timestamp?: string;
}

export function UserTurn({ children, timestamp }: UserTurnProps) {
  return (
    <div className="self-end max-w-[78%] group relative">
      <div className="px-4 py-3 rounded-lg bg-aurora-teal/10 border border-aurora-teal/25 text-[14px] leading-[1.5] text-foreground">
        {children}
      </div>
      {timestamp && (
        <div className="absolute -top-5 right-0 font-mono text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {timestamp}
        </div>
      )}
    </div>
  );
}
