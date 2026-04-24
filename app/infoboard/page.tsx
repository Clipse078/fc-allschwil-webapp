import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 30;

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(value);
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

function getTypeLabel(type: string) {
  if (type === "TRAINING") return "Training";
  if (type === "TOURNAMENT") return "Turnier";
  if (type === "MATCH") return "Match";
  return "Event";
}

export default async function PublicInfoboardPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const events = await prisma.event.findMany({
    where: {
      infoboardVisible: true,
      startAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    orderBy: [{ startAt: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      endAt: true,
      location: true,
      competitionLabel: true,
      opponentName: true,
      organizerName: true,
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const groups = new Map<string, typeof events>();

  for (const event of events) {
    const key = [
      event.type,
      event.competitionLabel ?? event.title,
      event.startAt.toISOString(),
      event.endAt?.toISOString() ?? "",
      event.location ?? "",
    ].join("|");

    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const groupedEvents = Array.from(groups.values());

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#06152f] p-6 text-white">
      <meta httpEquiv="refresh" content="30" />

      <div className="flex h-full w-full flex-col gap-6">
        <header className="flex items-center justify-between rounded-[32px] border border-white/10 bg-white/10 px-10 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
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
            <p className="mt-1 text-sm font-semibold text-white/65">
              Aktualisierung alle 30 Sekunden
            </p>
          </div>
        </header>

        {groupedEvents.length > 0 ? (
          <section className="grid flex-1 grid-cols-2 gap-6 2xl:grid-cols-3">
            {groupedEvents.map((group) => {
              const main = group[0];
              const participants = Array.from(
                new Set(
                  group.map((event) => event.team?.name ?? event.opponentName ?? event.title),
                ),
              ).filter(Boolean);

              return (
                <article
                  key={main.id}
                  className="rounded-[32px] bg-white p-8 text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.28)]"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-red-600">
                        {getTypeLabel(main.type)}
                        {participants.length > 1 ? " · mehrere Teams" : ""}
                      </p>
                      <h2 className="mt-3 text-4xl font-black uppercase tracking-tight text-[#0b4aa2]">
                        {main.competitionLabel ?? main.title}
                      </h2>
                    </div>

                    <div className="rounded-3xl bg-slate-100 px-5 py-4 text-right">
                      <p className="text-4xl font-black">{formatTime(main.startAt)}</p>
                      <p className="text-xl font-bold text-slate-500">
                        bis {main.endAt ? formatTime(main.endAt) : "offen"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {main.location ? (
                      <span className="rounded-full bg-blue-50 px-5 py-3 text-xl font-black text-[#0b4aa2]">
                        {main.location}
                      </span>
                    ) : null}

                    {main.organizerName ? (
                      <span className="rounded-full bg-emerald-50 px-5 py-3 text-xl font-black text-emerald-700">
                        {main.organizerName}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-8">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                      Teilnehmer
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {participants.slice(0, 8).map((participant) => (
                        <span
                          key={participant}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-black text-slate-800"
                        >
                          {participant}
                        </span>
                      ))}

                      {participants.length > 8 ? (
                        <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-xl font-black text-slate-500">
                          +{participants.length - 8} weitere
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex flex-1 items-center justify-center rounded-[32px] bg-white text-center text-slate-900">
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
