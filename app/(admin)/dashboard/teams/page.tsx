import Link from "next/link";
import { Plus, Users } from "lucide-react";
import TeamsOverviewGrid from "@/components/admin/teams/TeamsOverviewGrid";
import TeamsCategorySummary from "@/components/admin/teams/TeamsCategorySummary";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAvailableTeamSeasons, getTeamsListData } from "@/lib/teams/queries";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

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
  type TeamRow = (typeof teams)[number];

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const activeTeams = teams.filter((t: TeamRow) => t.isActive).length;
  const teamsInSeason = teams.filter((t: TeamRow) => t.activeSeason !== null).length;
  const websiteVisible = teams.filter((t: TeamRow) => t.websiteVisible).length;
  const infoboardVisible = teams.filter((t: TeamRow) => t.infoboardVisible).length;

  // ── Category breakdown ──────────────────────────────────────────────────────
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

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Teams"
        title="Teams"
        description={
          selectedSeason
            ? `Saisongeführte Teamverwaltung · ${selectedSeason.name}`
            : "Saisongeführte Teamverwaltung"
        }
        headerBadge={
          teams.length > 0 ? (
            <span className="sce-count-badge" aria-label={`${teams.length} Teams`}>
              {teams.length}
            </span>
          ) : undefined
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams" },
        ]}
        headerActions={
          <Link href="/dashboard/teams/new" className="fca-button-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Neues Team
          </Link>
        }
        stats={
          <div className="space-y-4">
            {/* Season selector — primary context */}
            <SeasonContextSelector
              title="Aktive Saison"
              description="Teams werden innerhalb der gewählten Saison nach Kategorie geführt."
              seasons={availableSeasons}
              selectedSeasonKey={selectedSeasonKey}
              basePath="/dashboard/teams"
            />

            {/* Operational summary — only when teams exist */}
            {teams.length > 0 && (
              <TeamsCategorySummary
                categories={categoryStats}
                totalTeams={teams.length}
                activeTeams={activeTeams}
                teamsInSeason={teamsInSeason}
                websiteVisible={websiteVisible}
                infoboardVisible={infoboardVisible}
              />
            )}
          </div>
        }
        isEmpty={teams.length === 0}
        emptyIcon={<Users className="h-10 w-10" aria-hidden="true" />}
        emptyHeading="Keine Teams vorhanden"
        emptyDescription={
          selectedSeason?.name
            ? `Für die Saison „${selectedSeason.name}" sind noch keine Teams erfasst.`
            : "Noch keine Teams im System erfasst."
        }
        emptyAction={
          <Link href="/dashboard/teams/new" className="fca-button-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Erstes Team anlegen
          </Link>
        }
      >
        <TeamsOverviewGrid
          teams={teams}
          selectedSeasonName={selectedSeason?.name}
        />
      </ListPagePattern>
    </PageShell>
  );
}
