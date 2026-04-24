import { getWochenplanBoardData } from "@/lib/wochenplan/queries";
import type { WochenplanBoardDayKey, WochenplanBoardEvent } from "@/lib/wochenplan/types";
import LiveClock from "@/components/infoboard/LiveClock";
import InfoboardRotator from "@/components/infoboard/InfoboardRotator";

export const dynamic = "force-dynamic";
export const revalidate = 30;

function getTodayKey(): WochenplanBoardDayKey {
  const day = new Date().getDay();
  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  if (day === 6) return "SATURDAY";
  return "SUNDAY";
}

function formatTime(value: Date | string | null) {
  if (!value) return "offen";
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(value));
}

function formatToday() {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date());
}

function getEventTypeLabel(type: string) {
  if (type === "MATCH") return "Match";
  if (type === "TOURNAMENT") return "Turnier";
  if (type === "TRAINING") return "Training";
  return "Event";
}

function getGroupKey(event: WochenplanBoardEvent) {
  return [
    event.slotKey,
    event.eventType,
    event.pitchRowKey,
    event.fieldLabel ?? "FULL",
    event.competitionLabel ?? event.title,
  ].join("|");
}

function groupEvents(events: WochenplanBoardEvent[]) {
  const groups = new Map<string, WochenplanBoardEvent[]>();

  for (const event of events) {
    const key = getGroupKey(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.values()).sort((a, b) => {
    return new Date(a[0].startAt).getTime() - new Date(b[0].startAt).getTime();
  });
}

function pitchLabel(event: WochenplanBoardEvent) {
  const base =
    event.pitchRowKey === "KUNSTRASEN_2"
      ? "Kunstrasen 2"
      : event.pitchRowKey === "KUNSTRASEN_3"
        ? "Kunstrasen 3"
        : "Stadion";

  return event.fieldLabel ? `${base} · Feld ${event.fieldLabel}` : base;
}

function roomCodes(events: WochenplanBoardEvent[]) {
  return Array.from(
    new Set(
      events.flatMap((event) =>
        [
          event.allocation.homeDressingRoomCode,
          event.allocation.awayDressingRoomCode,
        ].filter(Boolean),
      ),
    ),
  ) as string[];
}

function participantLabels(events: WochenplanBoardEvent[]) {
  return Array.from(
    new Set(
      events.map((event) => event.teamName ?? event.opponentName ?? event.title).filter(Boolean),
    ),
  ) as string[];
}

function isNow(event: WochenplanBoardEvent) {
  const now = new Date().getTime();
  const start = new Date(event.startAt).getTime();
  const end = event.endAt ? new Date(event.endAt).getTime() : start + 60 * 60 * 1000;
  return now >= start && now <= end;
}

export default async function PublicInfoboardPage() {
  const { events } = await getWochenplanBoardData({ weekOffset: 0 });
  const todayKey = getTodayKey();
  const todayEvents = events.filter(
    (event) => event.boardDayKey === todayKey && event.allocation.publishedToInfoboard,
  );
  const groups = groupEvents(todayEvents);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#06152f] px-8 py-6 text-white">
      <meta httpEquiv="refresh" content="30" />

      <div className="flex h-full w-full flex-col gap-4">
        <header className="flex items-center justify-between rounded-[32px] border border-white/10 bg-white/10 px-10 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-red-200">
              FC Allschwil Infoboard
            </p>
            <h1 className="mt-2 text-5xl font-black uppercase tracking-tight">
              Tagesplan heute
            </h1>
          </div>

          <div className="text-right">
            <p className="text-3xl font-black capitalize">{formatToday()}</p>
            <LiveClock />
            <p className="mt-1 text-sm font-semibold text-white/65">
              Aktualisierung alle 30 Sekunden
            </p>
          </div>
        </header>

        {groups.length > 0 ? (
          <section className="grid flex-1 grid-cols-2 gap-4 2xl:grid-cols-3">
            {groups.map((group) => {
              const main = group[0];
              const nowActive = isNow(main);
              const participants = participantLabels(group);
              const rooms = roomCodes(group);
              const isShared = participants.length > 1;

              return (
                <article
                  key={getGroupKey(main)}
                  className={`rounded-[32px] border ${nowActive ? "border-red-400 ring-4 ring-red-300/40 scale-[1.02]" : "border-white/10 opacity-90"} bg-white p-8 text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.28)] transition-all`}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-red-600">
                        {nowActive ? "LIVE" : getEventTypeLabel(main.eventType)}
                        {isShared ? " · mehrere Teams" : ""}
                      </p>
                      <h2 className="mt-3 text-4xl font-black uppercase tracking-tight text-[#0b4aa2]">
                        {main.competitionLabel ?? main.title}
                      </h2>
                    </div>

                    <div className="rounded-3xl bg-slate-100 px-5 py-4 text-right">
                      <p className="text-4xl font-black">{formatTime(main.startAt)}</p>
                      <p className="text-xl font-bold text-slate-500">
                        bis {formatTime(main.endAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full bg-blue-50 px-5 py-3 text-xl font-black text-[#0b4aa2]">
                      {pitchLabel(main)}
                    </span>

                    {rooms.map((room) => (
                      <span
                        key={room}
                        className="rounded-full bg-emerald-50 px-5 py-3 text-xl font-black text-emerald-700"
                      >
                        Garderobe {room}
                      </span>
                    ))}
                  </div>

                  <div className="mt-8">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                      Teilnehmer
                    </p>

                    <div className="mt-4">
                      {participants.length === 2 ? (
                        <div className="flex items-center gap-4 text-3xl font-black text-slate-900">
                          <span>{participants[0]}</span>
                          <span className="text-red-600">vs</span>
                          <span>{participants[1]}</span>
                        </div>
                      ) : participants.length <= 4 ? (
                        <div className="flex flex-wrap gap-3">
                          {participants.map((participant) => (
                            <span
                              key={participant}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-black text-slate-800"
                            >
                              {participant}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {participants.slice(0, 8).map((participant) => (
                            <span
                              key={participant}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-lg font-bold text-slate-800"
                            >
                              {participant}
                            </span>
                          ))}
                          {participants.length > 8 ? (
                            <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-lg font-bold text-slate-500">
                              +{participants.length - 8} weitere
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  {main.opponentName || main.organizerName ? (
                    <p className="mt-6 text-xl font-semibold text-slate-600">
                      {main.opponentName ? `Gegner: ${main.opponentName}` : null}
                      {main.opponentName && main.organizerName ? " · " : null}
                      {main.organizerName ? `Organisator: ${main.organizerName}` : null}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex flex-1 items-center justify-center rounded-[32px] bg-white text-center text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                Heute
              </p>
              <h2 className="mt-4 text-6xl font-black uppercase text-[#0b4aa2]">
                Keine Einträge geplant
              </h2>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}



