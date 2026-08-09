import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Globe, Monitor, Shield, Trophy, Users } from "lucide-react";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import TeamLifecycleCard from "@/components/admin/teams/TeamLifecycleCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { getOrgUnits } from "@/lib/org/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { PageShell } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge, Card } from "@/components/ui";
import { SectionCard } from "@/components/ui/page";
import { PropertyGrid } from "@/components/ui/PropertyGrid";
import { TimelinePlaceholder } from "@/components/ui/TimelinePlaceholder";

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

const PARTICIPATION_TYPE_LABELS: Record<string, string> = {
  COMPETITION: "Wettkampfteam",
  TRAINING: "Trainingsgruppe",
  DEVELOPMENT: "Entwicklungsteam",
  RECREATIONAL: "Freizeitteam",
  OTHER: "Sonstiges",
};

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  const { teamId } = await params;

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }
  const tenantId = tenant.id;

  const [team, availableOrgUnits] = await Promise.all([
    getTeamDetailData(tenantId, teamId),
    getOrgUnits(tenantId),
  ]);

  if (!team) {
    notFound();
  }

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const activeSeason =
    team.teamSeasons.find((ts) => ts.season.isActive) ??
    team.teamSeasons[0] ??
    null;

  // TEAM-IDENTITY-01: canonical long-name fallback (lib/teams/team-naming.ts),
  // already resolved by getTeamDetailData. Team.name is the primary Team
  // identity — never substituted by a seasonal displayName/provider name.
  const displayTitle = team.displayName ?? team.name;

  // TEAMCENTER-UX-01B (C, I): one-line supporting metadata under the primary
  // header — shortName · category · Liga/Wettbewerb. Never repeats the Team
  // identity itself (that is the page title above).
  const competitionLabel = team.competition?.shortName ?? team.competition?.name ?? null;
  const metaLine = [
    team.shortName && team.shortName !== displayTitle ? team.shortName : null,
    categoryLabel,
    competitionLabel ?? "Kein Wettbewerb",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Teams"
        title={displayTitle}
        description={metaLine}
        headerBadge={
          <Badge variant={team.isActive ? "success" : "outline"}>
            {team.isActive ? "Aktiv" : "Archiviert"}
          </Badge>
        }
        breadcrumbs={[
          { label: "Teams", href: "/dashboard/teams" },
          { label: displayTitle },
        ]}
        headerActions={
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Teams
          </Link>
        }
        summary={
          <Card variant="section" noPadding>
            <div className="px-5 py-4">
              <PropertyGrid
                items={[
                  { label: "Kategorie", value: categoryLabel },
                  {
                    label: "Aktive Saison",
                    value: activeSeason?.season.name,
                    icon: <Calendar className="h-3.5 w-3.5" />,
                    emptyText: "Keine aktive Saison",
                  },
                  {
                    label: "Saisoneinträge",
                    value: `${team.teamSeasons.length}`,
                    icon: <Shield className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Organisationseinheit",
                    value: team.orgUnit?.name,
                    href: team.orgUnit
                      ? `/dashboard/org-units/${team.orgUnit.id}`
                      : undefined,
                    icon: <Building2 className="h-3.5 w-3.5" />,
                    emptyText: "Keine Einheit verknüpft",
                  },
                  {
                    label: "Website",
                    value: team.websiteVisible ? "Sichtbar" : "Versteckt",
                    icon: <Globe className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Infoboard",
                    value: team.infoboardVisible ? "Sichtbar" : "Versteckt",
                    icon: <Monitor className="h-3.5 w-3.5" />,
                  },
                ]}
                columns={3}
              />
            </div>
          </Card>
        }
        sidebar={
          <>
            <TeamLifecycleCard
              teamId={team.id}
              teamName={displayTitle}
              isActive={team.isActive}
              canManage={canManage}
            />

            {activeSeason ? (
              <SectionCard title="Saison">
                <PropertyGrid
                  items={[{ label: "Saison", value: activeSeason.season.name }]}
                  columns={1}
                />
              </SectionCard>
            ) : null}

            {activeSeason ? (
              <SectionCard title="Teilnahme">
                <PropertyGrid
                  items={[
                    {
                      label: "Teilnahmetyp",
                      value:
                        PARTICIPATION_TYPE_LABELS[
                          activeSeason.participationType
                        ] ?? activeSeason.participationType,
                      icon: <Trophy className="h-3.5 w-3.5" />,
                    },
                  ]}
                  columns={1}
                />
              </SectionCard>
            ) : null}
            <SectionCard title="Kader & Stab">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>
                  {team.teamSeasons.length > 0
                    ? `${team.teamSeasons.length} Saison${team.teamSeasons.length !== 1 ? "en" : ""} mit Kader & Stab`
                    : "Noch kein Kader erfasst."}
                </span>
              </div>
            </SectionCard>
            <TimelinePlaceholder />
          </>
        }
      >
        <TeamDetailCard
          initialTeam={team}
          availableOrgUnits={availableOrgUnits.map((ou) => ({
            id: ou.id,
            name: ou.name,
            key: ou.key,
            type: ou.type,
          }))}
          canManage={canManage}
        />
      </DetailPagePattern>
    </PageShell>
  );
}
