import Link from "next/link";
import { cn } from "@/lib/cn";
import type { TrainingSessionRowViewModel } from "@/lib/training/view-model";
import type { TrainingActionFilter } from "@/lib/training/view-model";
import type { TrainingMonthWindow } from "@/lib/training/date-range";

const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MAX_VISIBLE_PER_DAY = 3;

type Props = {
  monthWindow: TrainingMonthWindow;
  rowsByDate: Map<string, TrainingSessionRowViewModel[]>;
  actionFilter: TrainingActionFilter;
  basePath?: string;
  timezone?: string;
};

function dayHref(basePath: string, date: string, actionFilter: TrainingActionFilter): string {
  const search = new URLSearchParams();
  search.set("tab", "kalender");
  search.set("view", "day");
  search.set("day", date);
  search.set("filter", actionFilter.toLowerCase());
  return `${basePath}?${search.toString()}`;
}

function chipTone(status: "READY" | "OPEN" | "NOT_APPLICABLE"): string {
  if (status === "OPEN") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "NOT_APPLICABLE") return "border-slate-200 bg-slate-100 text-slate-400 line-through";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatTime(startAt: string, timezone: string): string {
  return new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(
    new Date(startAt),
  );
}

export default function TrainingMonthCalendar({
  monthWindow,
  rowsByDate,
  actionFilter,
  basePath = "/dashboard/training",
  timezone = "Europe/Zurich",
}: Props) {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]" data-testid="training-month-calendar">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-[0.68rem] font-semibold uppercase text-[var(--muted)]">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthWindow.weeks.flat().map((cell) => {
          const rows = rowsByDate.get(cell.date) ?? [];
          const visible = rows.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = rows.length - visible.length;
          const dayNumber = Number(cell.date.slice(-2));
          const isToday = cell.date === todayKey;

          return (
            <Link
              key={cell.date}
              href={dayHref(basePath, cell.date, actionFilter)}
              className={cn(
                "flex min-h-[6.5rem] flex-col gap-1 border-b border-r border-[var(--border)] p-1.5 transition hover:bg-[var(--surface-2)]",
                !cell.inMonth && "bg-[var(--surface-2)]/50",
              )}
              data-testid={`training-month-day-${cell.date}`}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-semibold",
                  isToday ? "bg-[var(--sce-primary)] text-white" : cell.inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                )}
              >
                {dayNumber}
              </span>

              <div className="flex flex-col gap-1">
                {visible.map((row) => (
                  <span
                    key={row.session.id}
                    className={cn(
                      "truncate rounded border px-1 py-0.5 text-[0.62rem] font-medium",
                      chipTone(row.assessment.status),
                    )}
                    title={`${row.session.teamName} · ${formatTime(row.session.startAt, timezone)}`}
                  >
                    {formatTime(row.session.startAt, timezone)} {row.session.teamName}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[0.62rem] font-medium text-[var(--muted)]">+{overflow} mehr</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
