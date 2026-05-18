import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import TargetCreateForm from "@/components/admin/targets/TargetCreateForm";

export default async function NewTargetPage() {
  await requirePermission(PERMISSIONS.TARGETS_MANAGE);
  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <TargetCreateForm />
      </SectionCard>
    </PageShell>
  );
}
