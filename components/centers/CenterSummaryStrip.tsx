import Link from "next/link";
import { cn } from "@/lib/cn";

export type CenterSummaryMetric = {
  key: string;
  label: string;
  value: number;
  /** Semantic color tone. */
  tone?: "default" | "amber" | "emerald" | "muted";
  /** When provided, metric is rendered as a link (e.g. to apply a filter). */
  href?: string;
  /** Whether this metric's filter is currently active. */
  active?: boolean;
  "data-testid"?: string;
};

type CenterSummaryStripProps = {
  metrics: CenterSummaryMetric[];
  className?: string;
};

const TONE_CLASSES: Record<NonNullable<CenterSummaryMetric["tone"]>, string> = {
  default: "text-[var(--blue)]",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  muted: "text-[var(--text-2)]",
};

/**
 * CenterSummaryStrip
 *
 * A compact horizontal KPI summary bar shared by Centers-family pages.
 * Replaces the tall 4-column KPI card grid with a single-line strip that
 * consumes far less vertical space — MATCHCENTER-UX-03 §6.
 *
 * Metrics with `href` are rendered as links enabling actionable filtering
 * (e.g. clicking "Offen" filters to open matches).
 */
export function CenterSummaryStrip({ metrics, className }: CenterSummaryStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3",
        className,
      )}
      role="region"
      aria-label="Zusammenfassung"
    >
      {metrics.map((metric, idx) => {
        const toneClass = TONE_CLASSES[metric.tone ?? "default"];
        const content = (
          <>
            <span
              className={cn(
                "text-lg font-bold leading-none tabular-nums",
                toneClass,
                metric.active && "underline underline-offset-2",
              )}
            >
              {metric.value}
            </span>
            <span
              className={cn(
                "ml-1.5 text-xs font-medium",
                metric.active ? "text-[var(--foreground)]" : "text-[var(--text-2)]",
              )}
            >
              {metric.label}
            </span>
          </>
        );

        const sharedClass = cn(
          "inline-flex items-baseline rounded-md px-1 py-0.5 transition",
          metric.href && "hover:bg-[var(--surface-2)] cursor-pointer",
          metric.active && "bg-[var(--surface-2)]",
        );

        return (
          <div key={metric.key} className="flex items-center gap-3">
            {idx > 0 && (
              <span className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />
            )}
            {metric.href ? (
              <Link
                href={metric.href}
                className={sharedClass}
                data-testid={metric["data-testid"]}
                aria-current={metric.active ? "true" : undefined}
              >
                {content}
              </Link>
            ) : (
              <span className={sharedClass} data-testid={metric["data-testid"]}>
                {content}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
