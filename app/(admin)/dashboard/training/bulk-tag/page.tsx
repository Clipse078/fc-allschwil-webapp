import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { TRAINING_FOCUS_LABELS } from "@/lib/training/labels";
import { tagTrainingFocus } from "@/app/(admin)/dashboard/training/bulk-tag/actions";

type PageProps = {
  searchParams?: Promise<{ seasonId?: string; teamId?: string }>;
};

async function getFilterData() {
  const [seasons, teams] = await Promise.all([
    prisma.season.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { seasons, teams };
}

async function getUntaggedTrainings(seasonId: string | null, teamId: string | null) {
  if (!seasonId) return [];

  return prisma.event.findMany({
    where: {
      seasonId,
      type: "TRAINING",
      trainingFocus: null,
      ...(teamId ? { teamId } : {}),
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      startAt: true,
      team: { select: { name: true } },
    },
  });
}

const FOCUS_OPTIONS = Object.entries(TRAINING_FOCUS_LABELS) as [
  keyof typeof TRAINING_FOCUS_LABELS,
  string,
][];

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export default async function BulkTagPage({ searchParams }: PageProps) {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  const params = (await searchParams) ?? {};
  const { seasons, teams } = await getFilterData();

  const activeSeason = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
  const seasonId = params.seasonId ?? activeSeason?.id ?? null;
  const teamId = params.teamId || null;

  const untagged = await getUntaggedTrainings(seasonId, teamId);

  const selectedSeason = seasons.find((s) => s.id === seasonId) ?? null;

  function buildHref(patch: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if ((patch.seasonId ?? seasonId) != null) p.set("seasonId", patch.seasonId ?? seasonId!);
    if ((patch.teamId ?? teamId) != null) p.set("teamId", patch.teamId ?? teamId!);
    return `/dashboard/training/bulk-tag?${p.toString()}`;
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Training</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Schwerpunkt-Tags
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Trainings ohne Schwerpunkt tragen nicht zu Strategie-KPIs bei. Hier kannst du bestehende Trainings nachträglich taggen.
        </p>
      </section>

      {/* Filters */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {seasons.map((s) => (
            <a
              key={s.id}
              href={buildHref({ seasonId: s.id, teamId: "" })}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                seasonId === s.id
                  ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {s.name}
              {s.isActive ? " (aktiv)" : ""}
            </a>
          ))}
        </div>
        {teams.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={buildHref({ teamId: "" })}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                !teamId
                  ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Alle Teams
            </a>
            {teams.map((t) => (
              <a
                key={t.id}
                href={buildHref({ teamId: t.id })}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  teamId === t.id
                    ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {t.name}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Count summary */}
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600">
          {untagged.length} Training{untagged.length !== 1 ? "s" : ""} ohne Schwerpunkt
          {selectedSeason ? ` · ${selectedSeason.name}` : ""}
        </span>
        {untagged.length === 0 && seasonId && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
            Alle Trainings haben einen Schwerpunkt ✓
          </span>
        )}
      </div>

      {/* List */}
      {!seasonId ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 text-center text-sm text-slate-400">
          Saison wählen um Trainings anzuzeigen.
        </div>
      ) : untagged.length === 0 ? null : (
        <div className="space-y-2">
          {untagged.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDate(ev.startAt)}
                  {ev.team ? ` · ${ev.team.name}` : ""}
                </p>
              </div>

              <form action={tagTrainingFocus} className="flex items-center gap-2">
                <input type="hidden" name="eventId" value={ev.id} />
                <select
                  name="trainingFocus"
                  required
                  className="h-9 rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
                >
                  <option value="">Schwerpunkt wählen …</option>
                  {FOCUS_OPTIONS.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-full bg-[#0b4aa2] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#08357a]"
                >
                  Speichern
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
