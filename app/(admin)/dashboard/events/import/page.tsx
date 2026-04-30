import { PageHeader, PageShell } from "@/components/shared/page";
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
    <PageShell>
      <PageHeader
        eyebrow="Events Import"
        title="Import von Events"
        description="CSV / Excel Upload für Matches, Turniere und Trainings. Grundlage für ClubCorner Integration."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard/events" },
          { label: "Import" },
        ]}
      />

      <EventImportUploader />

      <EventImportRunsTable />
    </PageShell>
  );
}
