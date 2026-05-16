import type { Metadata } from "next";
import Link from "next/link";
import {
  getPublicTeamList,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type PublicTeamListItem,
} from "@/lib/website/team-queries";

type TeamsPageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Teams",
    robots: { index: true, follow: true },
  };
}

const CATEGORY_ACCENT: Record<string, { bg: string; text: string; ring: string }> = {
  AKTIVE: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  FRAUEN: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
  JUNIOREN: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  KINDERFUSSBALL: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  SENIOREN: { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200" },
  TRAININGSGRUPPE: { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200" },
};

function TeamCard({
  team,
  tenantKey,
}: {
  team: PublicTeamListItem;
  tenantKey: string;
}) {
  const accent = CATEGORY_ACCENT[team.category] ?? CATEGORY_ACCENT.AKTIVE;
  const displayLabel = team.displayName ?? team.name;
  const subtitle = [team.genderGroup, team.ageGroup].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/${tenantKey}/teams/${team.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-px"
    >
      <div
        className={`flex h-32 items-center justify-center ${accent.bg}`}
      >
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-white ring-2 ${accent.ring} shadow-sm`}
        >
          <span className={`font-[var(--font-display)] text-lg font-bold uppercase tracking-tight ${accent.text}`}>
            {(team.ageGroup ?? team.name).slice(0, 3)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span
          className={`self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${accent.bg} ${accent.text}`}
        >
          {CATEGORY_LABELS[team.category] ?? team.category}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-neutral-900 group-hover:text-blue-700 transition-colors">
          {displayLabel}
        </h3>
        {subtitle && (
          <p className="text-xs text-neutral-500">{subtitle}</p>
        )}
        {team.trainerCount > 0 && (
          <p className="text-xs text-neutral-400">
            {team.trainerCount} {team.trainerCount === 1 ? "Trainer" : "Trainer"}
          </p>
        )}
        <span className="mt-auto text-xs font-medium text-blue-600 group-hover:underline">
          Team ansehen →
        </span>
      </div>
    </Link>
  );
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { tenantKey } = await params;
  const teams = await getPublicTeamList();

  const grouped = new Map<string, PublicTeamListItem[]>();
  for (const team of teams) {
    const key = team.category;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(team);
  }

  const sortedGroups = CATEGORY_ORDER.filter((k) => grouped.has(k))
    .map((k) => [k, grouped.get(k)!] as [string, PublicTeamListItem[]])
    .concat(
      Array.from(grouped.entries()).filter(
        ([k]) => !CATEGORY_ORDER.includes(k)
      )
    );

  const hasMultipleGroups = sortedGroups.length > 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Vereinsteams
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Unsere Teams
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
          Entdecke unsere Teams und ihre Aktivitäten.
        </p>
      </header>

      {teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-20 text-center">
          <p className="text-sm font-medium text-neutral-400">
            Noch keine Teams öffentlich sichtbar.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {sortedGroups.map(([category, categoryTeams]) => (
            <section key={category}>
              {hasMultipleGroups && (
                <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryTeams.map((team) => (
                  <TeamCard key={team.id} team={team} tenantKey={tenantKey} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
