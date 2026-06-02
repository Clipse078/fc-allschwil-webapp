import Link from "next/link";
import { Plus } from "lucide-react";
import TeamsOverviewGrid from "@/components/admin/teams/TeamsOverviewGrid";
import TeamsCategorySummary from "@/components/admin/teams/TeamsCategorySummary";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAvailableTeamSeasons, getTeamsListData } from "@/lib/teams/queries";

const CATEGORY_DISPLAY: Record<string, { label: string; accentClass: string; dotClass: string }> = {
  KINDERFUSSBALL: {
    label: "Kinderfussball",
    accentClass: "bg-amber-50 border-amber-200",
    dotClass: "bg-amber-400",
  },
  JUNIOREN: {
    label: "Junioren",
    accentClass: "bg-blue-50 border-blue-200",
    dotClass: "bg-blue-500",
  },
  FRAUEN: {
    label: "Frauen",
    accentClass: "bg-rose-50 border-rose-200",
    dotClass: "bg-rose-500",
  },
  AKTIVE: {
    label: "Aktive",
    accentClass: "bg-orange-50 border-orange-200",
    dotClass: "bg-orange-500",
  },
  SENIOREN: {
    label: "Senioren",
    accentClass: "bg-slate-100 border-slate-200",
    dotClass: "bg-slate-500",
  },
  TRAININGSGRUPPE: {
    label: "Trainingsgruppe",
    accentClass: "bg-purple-50 border-purple-200",
    dotClass: "bg-purple-500",
  },
};

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

  // Build category stats from real team data
  const categoryMap = new Map<string, number>();
  for (const team of teams) {
    categoryMap.set(team.category, (categoryMap.get(team.category) ?? 0) + 1);
  }

  const categoryStats = Array.from(categoryMap.entries()).map(([key, count]) => ({
    label: CATEGORY_DISPLAY[key]?.label ?? key,
    count,
    accentClass: CATEGORY_DISPLAY[key]?.accentClass ?? "bg-slate-100 border-slate-200",
    dotClass: CATEGORY_DISPLAY[key]?.dotClass ?? "bg-slate-400",
  }));

  const activeTeams = teams.filter((t) => t.isActive).length;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Teams"
        title="Teams pro Saison"
        description="Saisongeführte Teamverwaltung. Die gewählte Saison ist führend; darunter werden alle Teams nach Kategorie gelistet."
        actions={
          <Link href="/dashboard/teams/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neues Team
          </Link>
        }
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Teams werden innerhalb der gewählten Saison nach Kategorie geführt."
        seasons={availableSeasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/teams"
      />

      {/* Category summary */}
      {teams.length > 0 ? (
        <TeamsCategorySummary
          categories={categoryStats}
          totalTeams={teams.length}
          activeTeams={activeTeams}
        />
      ) : null}

      {/* Teams grouped by category */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="fca-eyebrow">Teamdaten</p>
            <h2 className="fca-heading mt-1">
              {selectedSeason?.name ? `Teams ${selectedSeason.name}` : "Alle Teams"}
            </h2>
          </div>
        </div>

        <TeamsOverviewGrid
          teams={teams}
          selectedSeasonName={selectedSeason?.name}
        />
      </section>
    </div>
  );
}
