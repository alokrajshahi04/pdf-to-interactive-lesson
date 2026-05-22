import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Non-interactive status chip (e.g. "3 courses left").
 * Deliberately distinct from Button: shorter, square-ish, no hover/active,
 * default cursor — so it never reads as clickable.
 */
export function Chip({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-surface-subtle border border-border text-neutral-500 text-xs tabular-nums cursor-default select-none",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
