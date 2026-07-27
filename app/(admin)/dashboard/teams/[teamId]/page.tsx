import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Globe, Monitor, Shield, Trophy, Users } from "lucide-react";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
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

  const tenant = await getTenantFromSession(session.user?.tenantId);
  const [team, availableSeasons, availableOrgUnits] = await Promise.all([
    getTeamDetailData(teamId),
    getSeasonOptionsData(),
    getOrgUnits(tenant?.id),
  ]);

  if (!team) {
    notFound();
  }

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const activeSeason =
    team.teamSeasons.find((ts) => ts.season.isActive) ??
    team.teamSeasons[0] ??
    null;

  const displayTitle = activeSeason?.displayName ?? team.name;

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Teams"
        title={displayTitle}
        description={displayTitle !== team.name ? team.name : undefined}
        headerBadge={
          <Badge variant={team.isActive ? "success" : "default"}>
            {team.isActive ? "Aktiv" : "Inaktiv"}
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
            {activeSeason ? (
              <SectionCard title="Saison">
                <PropertyGrid
                  items={[
                    { label: "Anzeigename", value: activeSeason.displayName },
                    { label: "Saison", value: activeSeason.season.name },
                  ]}
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
                    ...(activeSeason.competitions[0]
                      ? [
                          {
                            label: "Wettkampf",
                            value:
                              activeSeason.competitions[0].competition
                                .shortName ??
                              activeSeason.competitions[0].competition
                                .officialName,
                            icon: <Trophy className="h-3.5 w-3.5" />,
                          },
                          {
                            label: "Anbieter",
                            value:
                              activeSeason.competitions[0].competition
                                .provider === "MANUAL"
                                ? "Manuell"
                                : activeSeason.competitions[0].competition
                                    .provider,
                          },
                        ]
                      : activeSeason.participationType === "COMPETITION"
                        ? [
                            {
                              label: "Wettkampf",
                              value: "Kein Wettkampf zugeordnet",
                              icon: <Trophy className="h-3.5 w-3.5" />,
                              emptyText: "Kein Wettkampf zugeordnet",
                            },
                          ]
                        : []),
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
          availableSeasons={availableSeasons}
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
