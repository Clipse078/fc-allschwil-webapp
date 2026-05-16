import type { WebsiteTheme } from "@/lib/website/theme-engine";
import type { PublicEventItem } from "@/lib/website/public-queries";

type Props = {
  props: { heading?: string; limit?: number };
  theme: WebsiteTheme;
  events: PublicEventItem[];
};

const TYPE_LABELS: Record<string, string> = {
  TRAINING: "Training",
  MATCH: "Match",
  TOURNAMENT: "Turnier",
  OTHER: "Event",
  VACATION_PERIOD: "Ferien",
};

function fmt(d: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export default function EventsListBlock({ props, theme, events }: Props) {
  const heading = props.heading ?? "Veranstaltungen";

  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>
          {heading}
        </h2>

        {events.length === 0 ? (
          <p className="mt-6 text-sm" style={{ color: theme.textMuted }}>
            Keine kommenden Veranstaltungen.
          </p>
        ) : (
          <div className="mt-6 divide-y" style={{ borderColor: theme.border }}>
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 py-4">
                <div
                  className="w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: theme.primary }}
                >
                  {TYPE_LABELS[ev.type] ?? ev.type}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" style={{ color: theme.text }}>
                    {ev.title}
                    {ev.opponentName ? ` vs. ${ev.opponentName}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: theme.textMuted }}>
                    {fmt(ev.startAt)}
                    {ev.location ? ` · ${ev.location}` : ""}
                    {ev.teamName ? ` · ${ev.teamName}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
