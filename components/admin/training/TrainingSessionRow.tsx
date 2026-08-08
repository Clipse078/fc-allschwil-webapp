import Link from "next/link";
import { AlertTriangle, CheckCircle2, Layers, MapPin, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TrainingSessionRowViewModel } from "@/lib/training/view-model";
import type { TrainingAllocationSummary } from "@/lib/training/operational-state";
import TrainingSessionCancelButton from "./TrainingSessionCancelButton";

type Props = {
  row: TrainingSessionRowViewModel;
  allocationSummary: TrainingAllocationSummary | undefined;
  canManage: boolean;
  locale?: string;
  timezone?: string;
  /** Show the calendar date in the row (Woche view). Day view omits it — the date is already the page context. */
  showDate?: boolean;
};

function formatTimeRange(startAt: string, endAt: string, locale: string, timezone: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  return `${fmt.format(new Date(startAt))}–${fmt.format(new Date(endAt))}`;
}

function formatShortDate(date: string, locale: string, timezone: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: timezone }).format(
    parsed,
  );
}

function StatusBadge({ status }: { status: "READY" | "OPEN" | "NOT_APPLICABLE" }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[0.65rem] font-semibold text-amber-700">
        Offen
      </span>
    );
  }
  if (status === "NOT_APPLICABLE") {
    return (
      <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-100 px-2 text-[0.65rem] font-semibold text-slate-500">
        Abgesagt
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[0.65rem] font-semibold text-emerald-700">
      Bereit
    </span>
  );
}

function AllocationChip({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.68rem] font-medium",
        present
          ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {present ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function TrainingSessionRow({
  row,
  allocationSummary,
  canManage,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  showDate = false,
}: Props) {
  const { session, assessment } = row;
  const isCancelled = session.status !== "SCHEDULED";
  const summary = allocationSummary ?? { hasPitchAllocation: false, hasDressingRoomAllocation: false };

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3"
      data-testid="training-session-row"
      data-status={assessment.status}
    >
      <div className="flex min-w-[7.5rem] shrink-0 flex-col">
        {showDate && (
          <span className="text-[0.68rem] font-medium uppercase text-[var(--muted)]">
            {formatShortDate(session.date, locale, timezone)}
          </span>
        )}
        <span className="text-sm font-semibold text-[var(--foreground)]">
          {formatTimeRange(session.startAt, session.endAt, locale, timezone)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="truncate text-sm font-medium text-[var(--foreground)]">{session.teamName}</span>
        <span className="truncate text-xs text-[var(--muted)]">{session.trainingSeriesTitle}</span>
        <StatusBadge status={assessment.status} />
        {session.isRescheduled && !isCancelled && (
          <span
            className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-[0.65rem] font-semibold text-blue-700"
            data-testid="training-session-rescheduled-badge"
            title={`Serienstandard: ${session.originalDate}`}
          >
            Angepasst
          </span>
        )}
      </div>

      {!isCancelled && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <AllocationChip label="Spielfeld/Halle" present={summary.hasPitchAllocation} />
          <AllocationChip label="Garderobe" present={summary.hasDressingRoomAllocation} />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/dashboard/training/series/${session.trainingSeriesId}/allocations`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
        >
          {assessment.status === "OPEN" ? (
            <MapPin className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <Layers className="h-3.5 w-3.5 text-[var(--blue)]" />
          )}
          Ressourcen
        </Link>
        {canManage && !isCancelled && (
          <Link
            href={`/dashboard/training/sessions/${session.id}/edit`}
            data-testid="training-session-edit-link"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
          >
            <Pencil className="h-3.5 w-3.5 text-[var(--blue)]" />
            Bearbeiten
          </Link>
        )}
        {canManage && <TrainingSessionCancelButton sessionId={session.id} isCancelled={isCancelled} />}
      </div>
    </div>
  );
}