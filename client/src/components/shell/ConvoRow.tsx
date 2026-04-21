// client/src/components/shell/ConvoRow.tsx
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2, Link2, Link2Off } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ConvoRowProps {
  title: string;
  selected?: boolean;
  isPinned?: boolean;
  isShared?: boolean;
  onClick?: () => void;
  onRename?: () => void;
  onPin?: () => void;
  /** Create (or re-create) a share link. We treat this as idempotent at the
   *  API level — the server returns the same token if one exists. */
  onShare?: () => void;
  /** Revoke an existing share link. Only shown when `isShared` is true. */
  onUnshare?: () => void;
  onDelete?: () => void;
}

export function ConvoRow({
  title,
  selected,
  isPinned,
  isShared,
  onClick,
  onRename,
  onPin,
  onShare,
  onUnshare,
  onDelete,
}: ConvoRowProps) {
  const hasMenu = !!(onRename || onPin || onShare || onUnshare || onDelete);
  return (
    <div
      className={cn(
        'group relative flex items-center transition-colors',
        selected ? 'bg-aurora-teal/5' : 'hover:bg-foreground/[0.03]'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex-1 text-left pl-9 pr-2 py-1 text-[12px] leading-[1.35] transition-colors min-w-0',
          selected
            ? 'text-foreground'
            : 'text-muted-foreground group-hover:text-foreground'
        )}
      >
        <span className="line-clamp-1 flex items-center gap-1.5">
          {isPinned && <Pin className="w-2.5 h-2.5 shrink-0 opacity-70" />}
          <span className="truncate">{title}</span>
        </span>
      </button>
      {hasMenu && (
        <div
          className={cn(
            'pr-2 opacity-0 group-hover:opacity-100 transition-opacity',
            'data-[open=true]:opacity-100'
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                aria-label="Conversation actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onRename && (
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                </DropdownMenuItem>
              )}
              {onPin && (
                <DropdownMenuItem onClick={onPin}>
                  {isPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 mr-2" /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 mr-2" /> Pin
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {/* Share: create link (or recopy existing) / revoke. Mutually
                  exclusive — both present as a single slot that changes label
                  based on current state. */}
              {(onShare || onUnshare) && (
                <>
                  {isShared && onUnshare ? (
                    <DropdownMenuItem onClick={onUnshare}>
                      <Link2Off className="w-3.5 h-3.5 mr-2" /> Stop sharing
                    </DropdownMenuItem>
                  ) : onShare ? (
                    <DropdownMenuItem onClick={onShare}>
                      <Link2 className="w-3.5 h-3.5 mr-2" />
                      {isShared ? 'Copy share link' : 'Share link'}
                    </DropdownMenuItem>
                  ) : null}
                </>
              )}
              {onDelete && (onRename || onPin || onShare || onUnshare) && (
                <DropdownMenuSeparator />
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
