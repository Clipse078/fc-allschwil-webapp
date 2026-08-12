import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getClubEvent } from "@/lib/events/club-events-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import VeranstaltungEditForm from "@/components/admin/veranstaltungen/VeranstaltungEditForm";

type Props = { params: Promise<{ eventId: string }> };

export default async function VeranstaltungEditPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  const { eventId } = await params;

  const event = await getClubEvent(tenantContext.id, eventId);
  if (!event) notFound();

  return (
    <ToastProvider>
      <div className="max-w-[900px] space-y-6">
        <Link
          href="/dashboard/veranstaltungen"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu Veranstaltungen
        </Link>

        <AdminSectionHeader
          eyebrow="Veranstaltungen · Bearbeiten"
          title={event.title}
          description="Änderungen an dieser Veranstaltung. Sichtbarkeits-Einstellungen wirken sich direkt auf Website, Homepage und Infoboard aus."
        />

        {!canManage && (
          <div className="fca-status-box fca-status-box-warning">
            Du hast nur Lesezugriff. Zum Bearbeiten wird die Berechtigung
            „events.manage" benötigt.
          </div>
        )}

        <VeranstaltungEditForm event={event} />
      </div>
    </ToastProvider>
  );
}
