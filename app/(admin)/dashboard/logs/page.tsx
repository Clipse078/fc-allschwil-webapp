import AuditLogsTable from "@/components/admin/logs/AuditLogsTable";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function LogsPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin Log"
        title="Audit Logs"
        description="Übersicht der letzten protokollierten Änderungen im System."
      />

      <AuditLogsTable />
    </div>
  );
}
