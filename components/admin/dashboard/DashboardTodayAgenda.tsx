import { CalendarClock, CheckCircle2, Clock } from "lucide-react";

type AgendaItem = {
  time: string;
  title: string;
  type: "training" | "match" | "meeting" | "other";
  location?: string;
};

const TYPE_COLORS: Record<AgendaItem["type"], string> = {
  training: "bg-blue-100 text-blue-700",
  match:    "bg-red-100 text-red-700",
  meeting:  "bg-amber-100 text-amber-700",
  other:    "bg-slate-100 text-slate-600",
};

const TYPE_LABELS: Record<AgendaItem["type"], string> = {
  training: "Training",
  match:    "Match",
  meeting:  "Meeting",
  other:    "Event",
};

type DashboardTodayAgendaProps = {
  items: AgendaItem[];
  date: string;
};

export default function DashboardTodayAgenda({
  items,
  date,
}: DashboardTodayAgendaProps) {
  return (
    <div className="sce-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[var(--blue)]" />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Heute &mdash; <span className="text-[var(--text-2)] font-normal">{date}</span>
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-[var(--text-2)]">Keine Events heute.</p>
          <p className="text-xs text-[var(--muted)]">Freier Tag – geniesse ihn.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
                <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                <span className="text-xs font-mono text-[var(--text-2)]">{item.time}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {item.title}
                </p>
                {item.location && (
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {item.location}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${TYPE_COLORS[item.type]}`}
              >
                {TYPE_LABELS[item.type]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
