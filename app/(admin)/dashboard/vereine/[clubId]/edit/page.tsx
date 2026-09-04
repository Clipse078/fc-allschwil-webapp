import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { getExternalClubById } from "@/lib/club-directory/query-service";
import ClubForm from "@/components/admin/club-directory/ClubForm";
import { PageShell } from "@/components/ui/page";
import { FormPagePattern } from "@/components/ui/patterns";

type Props = { params: Promise<{ clubId: string }> };

export default async function EditClubPage({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const { clubId } = await params;
  const club = await getExternalClubById(createClubDirectoryQueryDatabase(prisma), {
    tenantId: tenant.id,
    id: clubId,
  });
  if (!club) notFound();

  return (
    <PageShell fullWidth>
      <FormPagePattern
        eyebrow="Organisation · Vereine"
        title={`${club.name} bearbeiten`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Vereine", href: "/dashboard/vereine" },
          { label: club.name, href: `/dashboard/vereine/${club.id}` },
          { label: "Bearbeiten" },
        ]}
      >
        <ClubForm
          mode="edit"
          clubId={club.id}
          defaultValues={{
            name: club.name,
            shortName: club.shortName ?? "",
            alternativeName: club.alternativeName ?? "",
            website: club.website ?? "",
            location: club.location ?? "",
            notes: club.notes ?? "",
            logoContrastMode: club.logoContrastMode,
          }}
        />
      </FormPagePattern>
    </PageShell>
  );
}
