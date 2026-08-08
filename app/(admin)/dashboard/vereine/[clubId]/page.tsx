import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, MapPin, Merge, Pencil, Plus, Users } from "lucide-react";

import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { getExternalClubById } from "@/lib/club-directory/query-service";
import { resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { LogoUploadCard } from "@/components/admin/club-directory/LogoUploadCard";
import { ProviderLinkPanel } from "@/components/admin/club-directory/ProviderLinkPanel";
import {
  ClubDirectoryArchiveButton,
  ClubDirectoryRestoreButton,
} from "@/components/admin/club-directory/ArchiveRestoreControls";
import { Badge, Card } from "@/components/ui";
import { PageShell, SectionCard } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { PropertyGrid } from "@/components/ui/PropertyGrid";

type Props = { params: Promise<{ clubId: string }> };

export default async function ClubDetailPage({ params }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const canManage = hasPermission(session, PERMISSIONS.ORG_MANAGE);

  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const { clubId } = await params;
  const club = await getExternalClubById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: clubId,
  });

  if (!club) notFound();

  const isArchived = club.archivedAt !== null;

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Organisation · Vereine"
        title={club.name}
        description={club.shortName ?? undefined}
        headerBadge={
          <div className="flex items-center gap-2">
            <Badge variant={club.hasProviderMapping ? "info" : "outline"}>
              {club.hasProviderMapping ? "Anbieter-verknüpft" : "Manuell erfasst"}
            </Badge>
            {isArchived ? <Badge variant="default">Archiviert</Badge> : <Badge variant="success">Aktiv</Badge>}
          </div>
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Vereine", href: "/dashboard/vereine" },
          { label: club.name },
        ]}
        headerActions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/vereine"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
            {canManage && !isArchived ? (
              <Link
                href={`/dashboard/vereine/${club.id}/merge`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <Merge className="h-3.5 w-3.5" />
                Duplikate zusammenführen
              </Link>
            ) : null}
            {canManage ? (
              <Link
                href={`/dashboard/vereine/${club.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Link>
            ) : null}
          </div>
        }
        summary={
          <Card variant="section" noPadding>
            <div className="flex flex-wrap items-center gap-5 px-5 py-4">
              <ClubLogo logoUrl={club.logoUrl} name={club.name} size="lg" />
              <PropertyGrid
                items={[
                  { label: "Teams", value: `${club.teamCount}`, icon: <Users className="h-3.5 w-3.5" /> },
                  {
                    label: "Website",
                    value: club.website,
                    href: club.website ?? undefined,
                    icon: <Globe className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Ort",
                    value: club.location,
                    icon: <MapPin className="h-3.5 w-3.5" />,
                  },
                ]}
                columns={3}
                className="flex-1"
              />
            </div>
          </Card>
        }
        sidebar={
          <>
            {canManage ? (
              <SectionCard title="Logo">
                <LogoUploadCard resource="club" id={club.id} name={club.name} logoUrl={club.logoUrl} />
              </SectionCard>
            ) : null}
            {canManage ? (
              <SectionCard title="Provider-Info" description="Anbieter-Identität (z.B. SFV)">
                <ProviderLinkPanel
                  resource="club"
                  id={club.id}
                  mappings={club.providerMappings.map((m) => ({
                    id: m.id,
                    provider: m.provider,
                    providerClubId: m.providerClubId,
                    providerClubName: m.providerClubName,
                    providerIsActive: m.providerIsActive,
                    lastSyncedAt: m.lastSyncedAt ? m.lastSyncedAt.toISOString() : null,
                  }))}
                />
              </SectionCard>
            ) : null}
            {canManage ? (
              <SectionCard title="Status">
                {isArchived ? (
                  <ClubDirectoryRestoreButton resource="club" id={club.id} name={club.name} />
                ) : (
                  <ClubDirectoryArchiveButton resource="club" id={club.id} name={club.name} />
                )}
              </SectionCard>
            ) : null}
          </>
        }
      >
        <SectionCard
          title="Teams"
          description="Externe Teams dieses Vereins."
          headerActions={
            canManage && !isArchived ? (
              <Link
                href={`/dashboard/vereine/${club.id}/teams/new`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--sce-primary-hover)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Team erfassen
              </Link>
            ) : undefined
          }
          noPadding
        >
          {club.teams.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
              Noch keine Teams für diesen Verein erfasst.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {club.teams.map((team) => {
                const effectiveLogoUrl = resolveExternalTeamLogoUrl(team, club);
                return (
                  <Link
                    key={team.id}
                    href={`/dashboard/vereine/teams/${team.id}/edit`}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-2)]"
                  >
                    <ClubLogo logoUrl={effectiveLogoUrl} name={team.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--foreground)]">{team.name}</span>
                        {team.categoryLabel ? (
                          <Badge variant="outline" size="sm">
                            {team.categoryLabel}
                          </Badge>
                        ) : null}
                        <Badge variant={team.providerMappings.length > 0 ? "info" : "outline"} size="sm">
                          {team.providerMappings.length > 0 ? "Anbieter-verknüpft" : "Manuell"}
                        </Badge>
                        {team.archivedAt ? (
                          <Badge variant="default" size="sm">
                            Archiviert
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>
      </DetailPagePattern>
    </PageShell>
  );
}
