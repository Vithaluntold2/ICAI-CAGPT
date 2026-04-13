/**
 * Loading Skeleton Components
 * 
 * Beautiful loading states that improve perceived performance
 * Replace spinners with skeleton screens for better UX
 */

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Chat Message Loading Skeleton
 * Shows while AI is thinking
 */
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      {/* Avatar */}
      <Skeleton circle width={40} height={40} />
      
      {/* Message content */}
      <div className="flex-1 space-y-2">
        <Skeleton width={100} height={16} />
        <Skeleton count={3} />
        <Skeleton width="60%" />
      </div>
    </div>
  );
}

/**
 * Conversation List Skeleton
 * Shows in sidebar while loading conversations
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded-lg">
          <Skeleton width={20} height={20} />
          <div className="flex-1 space-y-1">
            <Skeleton width="80%" height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard Card Skeleton
 * For analytics dashboard loading
 */
export function DashboardCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <Skeleton width={150} height={20} />
          <Skeleton circle width={32} height={32} />
        </div>
        <Skeleton width={100} height={32} />
        <Skeleton width="60%" height={16} />
      </div>
    </div>
  );
}

/**
 * Table Loading Skeleton
 * For data tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} width={150} height={20} />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`row-${i}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={`cell-${i}-${j}`} width={150} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart Loading Skeleton
 * For visualization loading states
 */
export function ChartSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Title */}
      <Skeleton width={200} height={24} />
      
      {/* Chart area */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-end gap-2 h-[200px]">
            <Skeleton
              width={60}
              height={Math.random() * 150 + 50}
              style={{ borderRadius: 4 }}
            />
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 justify-center">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={80} height={16} />
        ))}
      </div>
    </div>
  );
}

/**
 * Document Preview Skeleton
 */
export function DocumentSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton width="60%" height={32} />
      <Skeleton count={10} />
      <Skeleton width="80%" />
      <div className="mt-8">
        <Skeleton width="40%" height={24} />
        <Skeleton count={5} className="mt-2" />
      </div>
    </div>
  );
}

/**
 * Profile Card Skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton circle width={80} height={80} />
      <div className="flex-1 space-y-2">
        <Skeleton width={200} height={24} />
        <Skeleton width={150} height={16} />
        <Skeleton width={120} height={16} />
      </div>
    </div>
  );
}

/**
 * Form Skeleton
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width={120} height={16} />
          <Skeleton height={40} />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton width={100} height={40} />
        <Skeleton width={100} height={40} />
      </div>
    </div>
  );
}

/**
 * Skeleton Theme Provider
 * Configure skeleton colors based on your theme
 */
export function SkeletonThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className="[--skeleton-color:hsl(var(--muted))] [--skeleton-highlight-color:hsl(var(--muted-foreground)/0.1)]">
      {children}
    </div>
  );
}

/**
 * Example Usage in Components:
 * 
 * function ChatMessages() {
 *   const { data: messages, isLoading } = useQuery(['messages'], fetchMessages);
 * 
 *   if (isLoading) {
 *     return <ChatMessageSkeleton />;
 *   }
 * 
 *   return messages.map(msg => <ChatMessage key={msg.id} message={msg} />);
 * }
 * 
 * // In App.tsx, wrap with theme provider:
 * <SkeletonThemeProvider>
 *   <YourApp />
 * </SkeletonThemeProvider>
 */
