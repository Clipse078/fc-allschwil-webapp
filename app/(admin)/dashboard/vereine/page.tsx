import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { listExternalClubs } from "@/lib/club-directory/query-service";
import type { ClubDirectoryListItem } from "@/components/admin/club-directory/ClubDirectorySearchableList";
import ClubDirectorySearchableList from "@/components/admin/club-directory/ClubDirectorySearchableList";
import { ListPagePattern } from "@/components/ui/patterns";
import { PageShell } from "@/components/ui/page";

type PageProps = { searchParams: Promise<{ view?: string }> };

function toListItem(
  club: Awaited<ReturnType<typeof listExternalClubs>>[number],
): ClubDirectoryListItem {
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    alternativeName: club.alternativeName,
    logoUrl: club.logoUrl,
    source: club.source,
    archivedAt: club.archivedAt ? club.archivedAt.toISOString() : null,
    teamCount: club.teamCount,
    hasProviderMapping: club.hasProviderMapping,
  };
}

export default async function VereinePage({ searchParams }: PageProps) {
  await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const { view } = await searchParams;
  const showArchived = view === "archived";

  const database = createClubDirectoryQueryDatabase(prisma);
  const allClubs = await listExternalClubs(database, {
    tenantId: tenant.id,
    limit: 200,
    includeArchived: true,
  });
  const clubs = allClubs.filter((c) => c.archivedAt === null);
  const archivedClubs = allClubs.filter((c) => c.archivedAt !== null);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Organisation"
        title="Vereine"
        description="Kanonisches Verzeichnis externer Vereine und ihrer Teams — wiederverwendbar für Matchcenter, TournamentCenter, Infoboard und Website."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Vereine" }]}
        headerActions={
          <Link href="/dashboard/vereine/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neuer Verein
          </Link>
        }
      >
        <ClubDirectorySearchableList
          clubs={clubs.map(toListItem)}
          archivedClubs={archivedClubs.map(toListItem)}
          showArchived={showArchived}
        />
      </ListPagePattern>
    </PageShell>
  );
}
