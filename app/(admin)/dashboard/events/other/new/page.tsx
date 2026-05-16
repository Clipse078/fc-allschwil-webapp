import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OtherEventCreateForm from "@/components/admin/events/OtherEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewOtherEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events"
        title="Weiteres Event erstellen"
        description="Manuelle Erfassung von weiteren Vereinsanlässen wie Party, Trip, Lager, Sponsor Apéro oder Generalversammlung."
        actions={
          <Link href="/dashboard/events?type=OTHER" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <OtherEventCreateForm />
    </div>
  );
}