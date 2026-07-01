import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export type DashboardSmartNudgesProps = {
  className?: string;
};

const PLACEHOLDER_SUGGESTIONS = [
  {
    key: "engagement",
    title: "Team-Engagement analysieren",
    body: "Erkenne Muster in Training & Spielbeteiligung.",
  },
  {
    key: "publishing",
    title: "News-Reichweite optimieren",
    body: "Finde den besten Zeitpunkt für Veröffentlichungen.",
  },
  {
    key: "registrations",
    title: "Anmeldetrends erkennen",
    body: "Verfolge saisonale Registrierungsmuster.",
  },
];

/**
 * DashboardSmartNudges
 *
 * Visual placeholder for the "Smart Suggestions" roadmap feature.
 * No AI, no recommendation engine, no new APIs.
 * Will connect to the Smart System Nudging roadmap item in a future slice.
 *
 * Usage:
 *   <DashboardSmartNudges />
 */
export function DashboardSmartNudges({ className }: DashboardSmartNudgesProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        "shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)]"
          style={{
            background: "var(--sce-primary-light)",
            color: "var(--sce-primary)",
          }}
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <h2 className="flex-1 text-sm font-semibold text-[var(--foreground)]">
          Smart Suggestions
        </h2>
        <Badge variant="outline" size="sm">
          Coming Soon
        </Badge>
      </div>

      {/* Placeholder cards */}
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {PLACEHOLDER_SUGGESTIONS.map((card) => (
          <div
            key={card.key}
            className={cn(
              "rounded-lg border border-dashed border-[var(--border)]",
              "bg-[var(--surface-2)] px-4 py-3",
            )}
          >
            <div className="mb-1.5 flex items-start gap-2">
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
              <p className="text-[0.8125rem] font-medium text-[var(--text-2)]">
                {card.title}
              </p>
            </div>
            <p className="text-xs leading-relaxed text-[var(--muted)]">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
