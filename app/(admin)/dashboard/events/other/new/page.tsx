import Link from "next/link";
import { PageHeader, PageShell } from "@/components/shared/page";
import OtherEventCreateForm from "@/components/admin/events/OtherEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewOtherEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Events"
        title="Weiteres Event erstellen"
        description="Manuelle Erfassung von weiteren Vereinsanlässen wie Party, Trip, Lager, Sponsor Apéro oder Generalversammlung."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard/events" },
          { label: "Weiteres Event erstellen" },
        ]}
        actions={
          <Link href="/dashboard/events?type=OTHER" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <OtherEventCreateForm />
    </PageShell>
  );
}
