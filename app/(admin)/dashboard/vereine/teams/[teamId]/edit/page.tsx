import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { getExternalTeamById } from "@/lib/club-directory/query-service";
import { resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";
import TeamForm from "@/components/admin/club-directory/TeamForm";
import { LogoUploadCard } from "@/components/admin/club-directory/LogoUploadCard";
import { MoveTeamCard } from "@/components/admin/club-directory/MoveTeamCard";
import { ProviderLinkPanel } from "@/components/admin/club-directory/ProviderLinkPanel";
import {
  ClubDirectoryArchiveButton,
  ClubDirectoryRestoreButton,
} from "@/components/admin/club-directory/ArchiveRestoreControls";
import { PageShell, SectionCard } from "@/components/ui/page";
import { FormPagePattern } from "@/components/ui/patterns";

type Props = { params: Promise<{ teamId: string }> };

export default async function EditExternalTeamPage({ params }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);
  const canManage = hasPermission(session, PERMISSIONS.ORG_MANAGE);

  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const { teamId } = await params;
  const team = await getExternalTeamById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: teamId,
  });
  if (!team) notFound();

  const isArchived = team.archivedAt !== null;
  const effectiveLogoUrl = resolveExternalTeamLogoUrl(team, team.externalClub);

  return (
    <PageShell fullWidth>
      <FormPagePattern
        eyebrow="Organisation · Vereine"
        title={`${team.name} bearbeiten`}
        description={`Team von ${team.externalClub.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Vereine", href: "/dashboard/vereine" },
          { label: team.externalClub.name, href: `/dashboard/vereine/${team.externalClub.id}` },
          { label: team.name },
        ]}
      >
        <TeamForm
          mode="edit"
          clubId={team.externalClubId}
          teamId={team.id}
          defaultValues={{
            name: team.name,
            shortName: team.shortName ?? "",
            alternativeName: team.alternativeName ?? "",
            categoryLabel: team.categoryLabel ?? "",
          }}
        />

        {canManage ? (
          <div className="mt-8 space-y-6">
            <SectionCard title="Logo" description="Überschreibt das Vereinslogo für dieses Team, sofern gesetzt.">
              <LogoUploadCard resource="team" id={team.id} name={team.name} logoUrl={effectiveLogoUrl} />
            </SectionCard>

            <SectionCard title="Provider-Info" description="Anbieter-Identität (z.B. SFV)">
              <ProviderLinkPanel
                resource="team"
                id={team.id}
                mappings={team.providerMappings.map((m) => ({
                  id: m.id,
                  provider: m.provider,
                  providerTeamId: m.providerTeamId,
                  providerSeasonId: m.providerSeasonId,
                  providerTeamName: m.providerTeamName,
                  providerIsActive: m.providerIsActive,
                  lastSyncedAt: m.lastSyncedAt ? m.lastSyncedAt.toISOString() : null,
                }))}
              />
            </SectionCard>

            {!isArchived ? (
              <SectionCard
                title="Verein wechseln"
                description="Team einem anderen kanonischen Verein zuordnen."
              >
                <MoveTeamCard teamId={team.id} teamName={team.name} currentClubId={team.externalClubId} />
              </SectionCard>
            ) : null}

            <SectionCard title="Status">
              {isArchived ? (
                <ClubDirectoryRestoreButton resource="team" id={team.id} name={team.name} />
              ) : (
                <ClubDirectoryArchiveButton
                  resource="team"
                  id={team.id}
                  name={team.name}
                  redirectTo={`/dashboard/vereine/${team.externalClubId}`}
                />
              )}
            </SectionCard>
          </div>
        ) : null}
      </FormPagePattern>
    </PageShell>
  );
}
