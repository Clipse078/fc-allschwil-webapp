import Link from "next/link";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import VeranstaltungCreateForm from "@/components/admin/veranstaltungen/VeranstaltungCreateForm";

export default async function NewVeranstaltungPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="max-w-[900px] space-y-8">
      <AdminSectionHeader
        eyebrow="Veranstaltungen"
        title="Veranstaltung erstellen"
        description="Manuelle Erfassung von Vereinsanlässen wie Generalversammlung, Trainersitzung, Sponsorenanlass, Helfereinsatz oder interne Veranstaltungen."
        actions={
          <Link
            href="/dashboard/veranstaltungen"
            className="fca-button-secondary"
          >
            Zurück zur Übersicht
          </Link>
        }
      />

      <VeranstaltungCreateForm />
    </div>
  );
}
