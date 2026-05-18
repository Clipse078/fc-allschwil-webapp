import AuditLogsTable from "@/components/admin/logs/AuditLogsTable";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";

export default async function LogsPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <AuditLogsTable />
      </SectionCard>
    </PageShell>
  );
}
