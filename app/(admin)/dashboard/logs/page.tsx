import AuditLogsTable from "@/components/admin/logs/AuditLogsTable";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function LogsPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-red-600">
          Admin Log
        </p>

        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Audit Logs
        </h2>

        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Übersicht der letzten protokollierten Aenderungen im System.
        </p>
      </div>

      <AuditLogsTable />
    </div>
  );
}