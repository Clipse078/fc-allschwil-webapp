import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { getWochenplanBoardData } from "@/lib/wochenplan/queries";
import type { WochenplanBoardDayKey } from "@/lib/wochenplan/types";

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

function formatToday() {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date());
}

export default async function InfoboardPage() {
  const { events } = await getWochenplanBoardData({ weekOffset: 0 });
  const todayKey = getTodayKey();
  const todayEvents = events.filter((event) => event.boardDayKey === todayKey);

  return (
    <main className="min-h-screen overflow-hidden bg-[#06152f] p-6 text-white">
      <meta httpEquiv="refresh" content="30" />

      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1900px] flex-col gap-6">
        <header className="flex items-center justify-between gap-6 rounded-[32px] border border-white/10 bg-white/10 px-8 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200">
              FC Allschwil Infoboard
            </p>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-tight">
              Tagesplan heute
            </h1>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold capitalize">{formatToday()}</p>
            <p className="mt-1 text-sm font-medium text-white/65">
              Automatische Aktualisierung alle 30 Sekunden
            </p>
          </div>
        </header>

        <section className="flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-white p-5 text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          {todayEvents.length > 0 ? (
            <WochenplanBoard
              initialEvents={todayEvents}
              visibleDayKeys={[todayKey]}
              currentDayKey={todayKey}
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Heute
                </p>
                <h2 className="mt-3 text-4xl font-black uppercase text-[#0b4aa2]">
                  Keine Einträge geplant
                </h2>
                <p className="mt-3 text-lg text-slate-500">
                  Sobald Trainings, Matches oder Turniere im Wochenplan publiziert sind, erscheinen sie hier automatisch.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
