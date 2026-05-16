import type { Metadata } from "next";
import { getPublicEvents } from "@/lib/events/public-event-feed";

type EventsPageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Termine",
    robots: { index: true, follow: true },
  };
}

const TYPE_LABELS: Record<string, string> = {
  MATCH: "Spiel",
  TOURNAMENT: "Turnier",
  TRAINING: "Training",
  OTHER: "Anlass",
  VACATION_PERIOD: "Ferienperiode",
};

const TYPE_BADGE: Record<string, string> = {
  MATCH: "bg-blue-100 text-blue-700",
  TOURNAMENT: "bg-orange-100 text-orange-700",
  TRAINING: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-neutral-100 text-neutral-600",
  VACATION_PERIOD: "bg-amber-100 text-amber-700",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default async function EventsPage({ params }: EventsPageProps) {
  await params;

  const now = new Date();
  const dateFrom = now.toISOString().split("T")[0];

  const events = await getPublicEvents({
    surface: "all",
    dateFrom,
    limit: 60,
  });

  const grouped = new Map<
    string,
    { dateLabel: string; events: typeof events }
  >();

  for (const event of events) {
    const key = toDateKey(event.startAt);
    if (!grouped.has(key)) {
      grouped.set(key, {
        dateLabel: formatDateLong(event.startAt),
        events: [],
      });
    }
    grouped.get(key)!.events.push(event);
  }

  const days = Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Vereinskalender
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Termine
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
          Bleibe über kommende Vereinsaktivitäten auf dem Laufenden.
        </p>
      </header>

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-20 text-center">
          <p className="text-sm font-medium text-neutral-400">
            Keine bevorstehenden Termine.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map(([dateKey, day]) => (
            <section key={dateKey}>
              <h2 className="mb-3 text-sm font-semibold text-neutral-500">
                {day.dateLabel}
              </h2>
              <div className="space-y-3">
                {day.events.map((event) => {
                  const badgeCls =
                    TYPE_BADGE[event.type] ?? TYPE_BADGE.OTHER;
                  return (
                    <article
                      key={event.id}
                      className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-neutral-50 py-2 text-center">
                        <span className="text-xs font-medium text-neutral-500">
                          {formatTime(event.startAt)}
                        </span>
                        {event.endAt && (
                          <span className="mt-0.5 text-[10px] text-neutral-400">
                            {formatTime(event.endAt)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeCls}`}
                          >
                            {TYPE_LABELS[event.type] ?? event.type}
                          </span>
                          {event.team && (
                            <span className="text-xs text-neutral-500">
                              {event.team.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-neutral-900">
                          {event.title}
                        </p>
                        {event.opponentName && (
                          <p className="mt-0.5 text-xs text-neutral-500">
                            vs. {event.opponentName}
                            {event.homeAway === "home" ? " (Heim)" : event.homeAway === "away" ? " (Auswärts)" : ""}
                          </p>
                        )}
                        {event.location && (
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {event.location}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
