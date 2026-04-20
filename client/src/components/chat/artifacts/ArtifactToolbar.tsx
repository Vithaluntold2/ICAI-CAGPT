import type { ReactNode } from "react";

/**
 * Consistent top-right pill toolbar used by every artifact wrapper. Solid
 * background so icons are visible against any card content, single border +
 * shadow so it reads as a grouped control cluster. The children are just
 * buttons / dropdown triggers styled with `h-7 w-7 p-0`.
 *
 * Position is absolute so it floats over the content without stealing space.
 * The parent must be `relative`.
 */
export function ArtifactToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-background shadow-sm">
      {children}
    </div>
  );
}
