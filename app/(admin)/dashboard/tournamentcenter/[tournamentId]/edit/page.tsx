import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getTournament } from "@/lib/tournaments/tournament-service";
import { TournamentNotFoundError } from "@/lib/tournaments/errors";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import TournamentEditForm from "@/components/admin/tournamentcenter/TournamentEditForm";

type Props = { params: Promise<{ tournamentId: string }> };

export default async function TournamentEditPage({ params }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  const { tournamentId } = await params;

  let tournament;
  try {
    tournament = await getTournament(tenantContext.id, tournamentId);
  } catch (err) {
    if (err instanceof TournamentNotFoundError) notFound();
    throw err;
  }

  return (
    <ToastProvider>
      <div className="max-w-[900px] space-y-6">
        <Link
          href="/dashboard/tournamentcenter"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum TournamentCenter
        </Link>

        <AdminSectionHeader
          eyebrow="TournamentCenter · Turnier bearbeiten"
          title={tournament.title}
          description="Änderungen gelten für dieses Turnier. Sichtbarkeits-Einstellungen wirken sich direkt auf Website, Wochenplan, Teamseite und Infoboard aus."
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <TournamentEditForm tournament={tournament} canManage={canManage} />
        </div>
      </div>
    </ToastProvider>
  );
}
