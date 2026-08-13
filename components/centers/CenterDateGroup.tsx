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
 * CenterDateGroup
 *
 * A matchday / calendar-day group separator header for Centers-family pages.
 * Renders a date label, a hairline rule, and a match count.
 *
 * MATCHCENTER-UX-03 §3 — makes the page feel like a matchday operations
 * workspace rather than an undifferentiated database list.
 */
export function CenterDateGroup({
  label,
  count,
  countNoun = "Spiele",
  className,
}: CenterDateGroupProps) {
  return (
    <div
      className={cn("flex items-center gap-4 pb-1 pt-5 first:pt-0", className)}
      role="heading"
      aria-level={3}
    >
      <span className="shrink-0 text-[0.65rem] font-bold tracking-[0.12em] text-[var(--muted)] uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1 border-t border-[var(--border)]" aria-hidden="true" />
      <span className="shrink-0 text-[0.65rem] font-semibold tabular-nums text-[var(--muted)]">
        {count} {countNoun}
      </span>
    </div>
  );
}
