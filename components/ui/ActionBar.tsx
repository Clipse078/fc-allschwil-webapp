import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ActionBarAlign = "left" | "right" | "between";

export type ActionBarProps = HTMLAttributes<HTMLDivElement> & {
  /** Stick the bar to the bottom of the viewport. */
  sticky?: boolean;
  /** Horizontal alignment of children. @default "right" */
  align?: ActionBarAlign;
  children: ReactNode;
};

const alignClass: Record<ActionBarAlign, string> = {
  left:    "justify-start",
  right:   "justify-end",
  between: "justify-between",
};

/**
 * ActionBar
 *
 * A horizontal bar for primary form or page actions.
 * Optionally sticks to the bottom of the viewport so the user can always
 * reach Save/Cancel without scrolling.
 *
 * Usage:
 *   <ActionBar sticky>
 *     <Button variant="secondary">Abbrechen</Button>
 *     <Button>Speichern</Button>
 *   </ActionBar>
 *
 *   <ActionBar align="between">
 *     <Button variant="danger">Löschen</Button>
 *     <Button>Speichern</Button>
 *   </ActionBar>
 */
export function ActionBar({
  sticky = false,
  align = "right",
  className,
  children,
  ...props
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-5 py-3",
        "border-t border-[var(--border)] bg-[var(--surface)]",
        alignClass[align],
        sticky && [
          "sticky bottom-0 z-10",
          "shadow-[0_-1px_4px_rgba(17,24,39,0.06)]",
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
