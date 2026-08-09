import Link from "next/link";
import { Plus, Users } from "lucide-react";
import TeamsOverviewGrid from "@/components/admin/teams/TeamsOverviewGrid";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { notFound } from "next/navigation";
import { getAvailableTeamSeasons, getTeamsListData } from "@/lib/teams/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

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

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }

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

  const teams = await getTeamsListData(tenant.id, selectedSeasonKey);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Teams"
        title="Teams"
        description="Alle Teams des Vereins nach Kategorie — mit Saison, Wettbewerb und Sichtbarkeit auf einen Blick."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams" },
        ]}
        headerActions={
          <>
            <a
              href="#season-context"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              Saison wechseln
            </a>
            <Link href="/dashboard/teams/register" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neues Team
            </Link>
          </>
        }
        stats={
          <div id="season-context">
            <SeasonContextSelector
              title="Aktive Saison"
              description="Teams werden innerhalb der gewählten Saison nach Kategorie geführt."
              seasons={availableSeasons}
              selectedSeasonKey={selectedSeasonKey}
              basePath="/dashboard/teams"
            />
          </div>
        }
        isEmpty={teams.length === 0}
        emptyIcon={<Users className="h-10 w-10" />}
        emptyHeading="Keine Teams vorhanden"
        emptyDescription={
          selectedSeason?.name
            ? `Für die Saison „${selectedSeason.name}" sind noch keine Teams erfasst.`
            : "Noch keine Teams im System erfasst."
        }
        emptyAction={
          <Link href="/dashboard/teams/register" className="fca-button-primary">
            Erstes Team registrieren
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
