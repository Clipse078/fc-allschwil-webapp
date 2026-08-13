import { cn } from "@/lib/cn";

type CenterDateGroupProps = {
  /** Formatted date label, e.g. "SO, 02. AUGUST". */
  label: string;
  /** Number of items in this group. */
  count: number;
  /** Plural noun for the count (e.g. "Spiele", "Trainings"). */
  countNoun?: string;
  className?: string;
};

/**
 * CenterDateGroup — MATCHCENTER-UX-03-C1 §11
 *
 * A matchday / calendar-day group separator header for Centers-family pages.
 * Renders a stronger date label that serves as a structural anchor for the
 * list, with a neutral match-count indicator on the right.
 *
 * Typography deliberately stronger than before — the date must read as a
 * primary structural divider, not a decorative separator.
 */
export function CenterDateGroup({
  label,
  count,
  countNoun = "Spiele",
  className,
}: CenterDateGroupProps) {
  return (
    <div
      className={cn("flex items-center gap-3 pb-2 pt-5 first:pt-0", className)}
      role="heading"
      aria-level={3}
    >
      <span className="shrink-0 text-xs font-bold tracking-[0.08em] text-[var(--foreground)] uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1 border-t border-[var(--border)]" aria-hidden="true" />
      <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[0.6rem] font-semibold tabular-nums text-[var(--text-2)]">
        {count} {countNoun}
      </span>
    </div>
  );
}
