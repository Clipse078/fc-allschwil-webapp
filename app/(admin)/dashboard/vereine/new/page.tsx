import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import ClubForm from "@/components/admin/club-directory/ClubForm";
import { PageShell } from "@/components/ui/page";
import { FormPagePattern } from "@/components/ui/patterns";

export default async function NewClubPage() {
  await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);

  return (
    <PageShell fullWidth>
      <FormPagePattern
        eyebrow="Organisation · Vereine"
        title="Neuer Verein"
        description="Manuell erfasster Verein — kann später mit einer Anbieter-Identität (z.B. SFV) verknüpft werden."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Vereine", href: "/dashboard/vereine" },
          { label: "Neuer Verein" },
        ]}
      >
        <ClubForm mode="create" />
      </FormPagePattern>
    </PageShell>
  );
}
