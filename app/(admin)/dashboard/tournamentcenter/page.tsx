import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { listTournaments } from "@/lib/tournaments/tournament-service";
import { normalizeTournamentActionFilter, normalizeTournamentTab } from "@/lib/tournaments/view-model";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TournamentCenterOverview from "@/components/admin/tournamentcenter/TournamentCenterOverview";

type TournamentCenterPageProps = {
  searchParams?: Promise<{
    tab?: string;
    filter?: string;
  }>;
};

export default async function TournamentCenterPage({ searchParams }: TournamentCenterPageProps) {
  await requireAnyPermission([PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) {
    notFound();
  }

  const timezone = tenantContext.timezone ?? "Europe/Zurich";
  const locale = tenantContext.locale ?? "de-CH";

  const params = (await searchParams) ?? {};
  const tab = normalizeTournamentTab(params.tab);
  const actionFilter = normalizeTournamentActionFilter(params.filter);

  const tournaments = await listTournaments(tenantContext.id);

  return (
    <div className="max-w-[1400px] space-y-8">
      <AdminSectionHeader
        eyebrow="Planung"
        title="TournamentCenter"
        description="Zentrale Übersicht und Verwaltung tenant-verwalteter Turniere."
        actions={
          <Link href="/dashboard/tournamentcenter/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Turnier erstellen
          </Link>
        }
      />

      <TournamentCenterOverview
        tournaments={tournaments}
        tab={tab}
        actionFilter={actionFilter}
        timezone={timezone}
        locale={locale}
      />
    </div>
  );
}
