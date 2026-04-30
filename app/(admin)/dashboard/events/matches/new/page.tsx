import Link from "next/link";
import { PageHeader, PageShell } from "@/components/shared/page";
import MatchEventCreateForm from "@/components/admin/events/MatchEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewMatchEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Events"
        title="Match erstellen"
        description="Manuelle Erfassung eines Matches pro Team. Dieser Flow speist später Homepage, Spielplan, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard/events" },
          { label: "Match erstellen" },
        ]}
        actions={
          <Link href="/dashboard/events?type=MATCH" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <MatchEventCreateForm />
    </PageShell>
  );
}
