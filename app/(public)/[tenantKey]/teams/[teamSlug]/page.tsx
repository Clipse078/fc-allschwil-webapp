import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTeamDetail, CATEGORY_LABELS, type PublicTrainer, type PublicPlayer } from "@/lib/website/team-queries";
import { getPublicEvents } from "@/lib/events/public-event-feed";

type TeamDetailPageProps = {
  params: Promise<{ tenantKey: string; teamSlug: string }>;
};

export async function generateMetadata({
  params,
}: TeamDetailPageProps): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await getPublicTeamDetail(teamSlug);
  if (!team) return { title: "Team nicht gefunden", robots: { index: false, follow: false } };
  return {
    title: team.displayName ?? team.name,
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

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrainerCard({ trainer }: { trainer: PublicTrainer }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-[var(--font-display)] text-sm font-bold uppercase text-neutral-500">
        {trainer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {trainer.name}
        </p>
        {trainer.roleLabel && (
          <p className="truncate text-xs text-neutral-500">{trainer.roleLabel}</p>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: PublicPlayer }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-4 py-2.5 shadow-sm">
      <span className="w-7 shrink-0 text-right text-sm font-mono font-semibold text-neutral-400">
        {player.shirtNumber ?? "–"}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
        {player.name}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        {player.isCaptain && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            C
          </span>
        )}
        {player.isViceCaptain && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            VC
          </span>
        )}
        {player.positionLabel && (
          <span className="text-xs text-neutral-400">{player.positionLabel}</span>
        )}
      </div>
    </div>
  );
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { tenantKey, teamSlug } = await params;

  const [team, upcomingEvents] = await Promise.all([
    getPublicTeamDetail(teamSlug),
    getPublicEvents({
      surface: "team-page",
      teamSlug,
      dateFrom: new Date().toISOString().split("T")[0],
      limit: 6,
    }),
  ]);

  if (!team) notFound();

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const headline = team.displayName ?? team.name;
  const subtitle = [team.genderGroup, team.ageGroup].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-8">
        <Link
          href={`/${tenantKey}/teams`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Alle Teams
        </Link>
      </nav>

      <header className="mb-10">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {categoryLabel}
        </span>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
          {headline}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base text-neutral-500">{subtitle}</p>
        )}
      </header>

      <div className="space-y-10">
        {team.showTrainers && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
              Trainerstab
            </h2>
            {team.trainers.length === 0 ? (
              <p className="text-sm text-neutral-400">Noch keine Trainerangaben hinterlegt.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {team.trainers.map((trainer) => (
                  <TrainerCard key={trainer.id} trainer={trainer} />
                ))}
              </div>
            )}
          </section>
        )}

        {team.showPlayers && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
              Spieler
            </h2>
            {team.players.length === 0 ? (
              <p className="text-sm text-neutral-400">Noch keine Spielerangaben hinterlegt.</p>
            ) : (
              <div className="space-y-1.5">
                {team.players.map((player) => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Nächste Spiele &amp; Trainings
          </h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-neutral-400">Keine bevorstehenden Termine.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const badgeCls = TYPE_BADGE[event.type] ?? TYPE_BADGE.OTHER;
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex w-28 shrink-0 flex-col">
                      <span className="text-xs font-medium text-neutral-500">
                        {formatDateTime(event.startAt)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeCls}`}>
                          {TYPE_LABELS[event.type] ?? event.type}
                        </span>
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
                        <p className="mt-0.5 text-xs text-neutral-400">{event.location}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {!team.showTrainers && !team.showPlayers && upcomingEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
            <p className="text-sm text-neutral-400">
              Weitere Teaminfos folgen in Kürze.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
