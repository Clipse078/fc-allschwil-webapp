import AuditLogsTable from "@/components/admin/logs/AuditLogsTable";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PageHeader, PageShell } from "@/components/shared/page";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function LogsPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  return (
    <PageShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin Log"
          title="Audit Logs"
          description="Übersicht der letzten protokollierten Änderungen im System."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Logs" },
          ]}
        />

        <AuditLogsTable />
      </div>
    </PageShell>
  );
}
