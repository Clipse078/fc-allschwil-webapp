import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import InitiativeCreateForm from "@/components/admin/initiatives/InitiativeCreateForm";

export default async function NewInitiativePage() {
  await requirePermission(PERMISSIONS.INITIATIVES_MANAGE);

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <InitiativeCreateForm />
      </SectionCard>
    </PageShell>
  );
}
