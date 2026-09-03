import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { listClubEvents } from "@/lib/events/club-events-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import VeranstaltungenOverview, {
  normalizeVeranstaltungenTab,
} from "@/components/admin/veranstaltungen/VeranstaltungenOverview";

type SearchParams = Promise<{
  updated?: string;
  submitted?: string;
  tab?: string;
}>;

type VeranstaltungenPageProps = {
  searchParams?: SearchParams;
};

export default async function VeranstaltungenPage({
  searchParams,
}: VeranstaltungenPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) {
    notFound();
  }

  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  const canDelete = hasPermission(session, PERMISSIONS.EVENTS_DELETE);
  const params = (await searchParams) ?? {};
  const showUpdated = params.updated === "1";
  const showSubmitted = params.submitted === "1";
  const tab = normalizeVeranstaltungenTab(params.tab);

  const events = await listClubEvents(tenantContext.id);

  return (
    <ToastProvider>
      <div className="max-w-[1200px] space-y-8">
        <AdminSectionHeader
          eyebrow="Planung"
          title="Veranstaltungen"
          description="Tenant-verwaltete Vereinsanlässe wie Generalversammlung, Trainersitzung, Sponsorenanlass und weitere Vereinsevents."
          actions={
            canManage ? (
              <Link
                href="/dashboard/veranstaltungen/new"
                className="fca-button-primary"
              >
                <Plus className="h-4 w-4" />
                Veranstaltung erstellen
              </Link>
            ) : null
          }
        />

        {showUpdated ? (
          <div className="fca-status-box fca-status-box-success">
            Veranstaltung wurde erfolgreich gespeichert.
          </div>
        ) : null}

        {showSubmitted ? (
          <div className="fca-status-box fca-status-box-success">
            Veranstaltung wurde erfolgreich erstellt.
          </div>
        ) : null}

        <VeranstaltungenOverview
          events={events}
          tab={tab}
          canManage={canManage}
          canDelete={canDelete}
        />
      </div>
    </ToastProvider>
  );
}
