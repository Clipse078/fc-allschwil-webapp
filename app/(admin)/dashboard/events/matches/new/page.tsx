import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MatchEventCreateForm from "@/components/admin/events/MatchEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewMatchEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events"
        title="Match erstellen"
        description="Manuelle Erfassung eines Matches pro Team. Dieser Flow speist später Homepage, Spielplan, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        actions={
          <Link href="/dashboard/events?type=MATCH" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <MatchEventCreateForm />
    </div>
  );
}