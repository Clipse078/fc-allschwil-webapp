import TeamsTable from "@/components/admin/teams/TeamsTable";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAvailableTeamSeasons, getTeamsListData } from "@/lib/teams/queries";

const TEAM_GROUPS = [
  {
    title: "Kinderfussball",
    description: "G-, F- und E-Teams",
    teams: ["G", "F2a", "F2b", "F3", "E1", "E2", "E3", "E4"],
    accent: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    title: "Junioren",
    description: "D-, C-, B- und A-Teams",
    teams: ["D9 D1", "D9 D2", "D9 D3", "D7 D1", "D7 D2", "C1", "C2", "B1", "B2", "A"],
    accent: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    title: "Frauen",
    description: "Frauen-Teams",
    teams: ["Frauen 1", "Frauen 2", "FF-17", "FF-14"],
    accent: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    title: "Aktive",
    description: "Aktive Mannschaften",
    teams: ["1. Mannschaft", "2. Mannschaft"],
    accent: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    title: "Senioren",
    description: "Senioren-Teams",
    teams: ["30+", "40+", "50+"],
    accent: "bg-slate-100 border-slate-200 text-slate-700",
  },
  {
    title: "Trainingsgruppe",
    description: "Saisonabhängige Trainingsgruppe",
    teams: ["Trainingsgruppe"],
    accent: "bg-slate-100 border-slate-200 text-slate-700",
  },
];

type TeamsPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const availableSeasons = await getAvailableTeamSeasons();

  const fallbackSeason =
    availableSeasons.find((season) => season.isActive)?.key ??
    availableSeasons[0]?.key ??
    "";

  const selectedSeasonKey =
    params.season && availableSeasons.some((season) => season.key === params.season)
      ? params.season
      : fallbackSeason;

  const selectedSeason =
    availableSeasons.find((season) => season.key === selectedSeasonKey) ?? null;

  const teams = await getTeamsListData(selectedSeasonKey);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Teams"
        title="Teams pro Saison"
        description="Saisongeführte Teamverwaltung. Die gewählte Saison ist führend; darunter werden die Teamkategorien dynamisch aufgebaut."
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Teams werden innerhalb der gewählten Saison nach Kategorie geführt."
        seasons={availableSeasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/teams"
      />

      <section className="grid gap-5 xl:grid-cols-3">
        {TEAM_GROUPS.map((group) => (
          <article
            key={group.title}
            className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {group.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500">{group.description}</p>
              </div>

              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${group.accent}`}>
                {group.teams.length} Teams
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {group.teams.map((team) => (
                <span
                  key={team}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {team}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-6">
        <AdminSectionHeader
          eyebrow="Detaildaten"
          title={`Teamdaten ${selectedSeason?.name ?? ""}`.trim()}
          description="Bestehende Teamdaten bleiben erhalten und werden nun im saisongeführten Kontext dargestellt."
        />

        <TeamsTable initialTeams={teams} />
      </section>
    </div>
  );
}
