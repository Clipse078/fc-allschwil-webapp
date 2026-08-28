import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";
import { SectionCard } from "@/components/ui/page";

type Props = {
  entries: TeamTrainingScheduleEntry[];
  trainingCenterHref?: string | null;
};

export default function TeamTrainingSummary({
  entries,
  trainingCenterHref = "/dashboard/training",
}: Props) {
  return (
    <SectionCard
      title="Training"
      description="Wöchentliche Trainingszeiten."
      headerActions={
        trainingCenterHref ? (
          <Link
            href={trainingCenterHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--blue)] hover:underline"
          >
            TrainingCenter
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]" data-testid="team-training-empty">
          Keine Trainingszeiten für die aktuelle Saison hinterlegt.
        </p>
      ) : (
        <div className="space-y-2" data-testid="team-training-summary">
          {entries.map((entry) => (
            <div
              key={`${entry.seriesId}-${entry.weekday}`}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {entry.weekdayLabel}
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-2)]">
                  {entry.startsAt}–{entry.endsAt}
                  {entry.locationLabel ? (
                    <span className="text-[var(--foreground)]"> · {entry.locationLabel}</span>
                  ) : null}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
