import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import EventImportUploader from "@/components/admin/events/EventImportUploader";
import EventImportRunsTable from "@/components/admin/events/EventImportRunsTable";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function EventImportPage() {
  await requireAnyPermission([
    PERMISSIONS.EVENTS_IMPORT,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events Import"
        title="Import von Events"
        description="CSV / Excel Upload für Matches, Turniere und Trainings. Grundlage für ClubCorner Integration."
      />

      <EventImportUploader />

      <EventImportRunsTable />
    </div>
  );
}