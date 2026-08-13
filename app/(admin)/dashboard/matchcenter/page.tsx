import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import {
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import {
  formatMonthLabel,
  MATCHCENTER_DEFAULT_TIMEZONE,
  resolveMatchcenterMonthWindow,
} from "@/lib/matchcenter/month-range";
import {
  normalizeMatchcenterActionFilter,
  normalizeMatchcenterTab,
  normalizeMatchcenterWochenplanFilter,
} from "@/lib/matchcenter/view-model";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MatchcenterOverview from "@/components/admin/matchcenter/MatchcenterOverview";
import { ToastProvider } from "@/components/ui/ToastProvider";

type MatchcenterPageProps = {
  searchParams?: Promise<{
    tab?: string;
    month?: string;
    filter?: string;
    wochenplan?: string;
  }>;
};

export default async function MatchcenterPage({
  searchParams,
}: MatchcenterPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();

  if (!tenantContext) {
    notFound();
  }

  const tenantId = tenantContext.id;
  const timezone = tenantContext.timezone ?? MATCHCENTER_DEFAULT_TIMEZONE;
  const locale = tenantContext.locale ?? "de-CH";

  const params = (await searchParams) ?? {};
  const tab = normalizeMatchcenterTab(params.tab);
  const actionFilter = normalizeMatchcenterActionFilter(params.filter);
  const wochenplanFilter = normalizeMatchcenterWochenplanFilter(params.wochenplan);
  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  const resolvedMonth = resolveMatchcenterMonthWindow({
    monthParam: params.month,
    timeZone: timezone,
  });

  // Current month param for the "Heute" navigation shortcut.
  // Computed separately from the selected month so navigating to a past/future
  // month still shows the correct "go back to today" target.
  const currentMonthWindow = resolveMatchcenterMonthWindow({ timeZone: timezone });
  const currentMonthParam = currentMonthWindow.param;

  /*
   * Prisma's generic delegate return type cannot structurally satisfy the
   * deliberately narrow MatchcenterQueryDatabase test contract, although the
   * runtime query and included relations match it exactly.
   *
   * Keep the adaptation local to this server-page boundary rather than
   * weakening the tested query-service contract.
   */
  const matchcenterDatabase =
    prisma as unknown as MatchcenterQueryDatabase;

  // Month-scoped server-side query (MATCHCENTER-UX-01 §13): avoids loading
  // the full season — only the selected month's window is fetched, for
  // both Spielplanung and Resultate (they share one month filter).
  const matches = await listMatchcenterMatches(
    matchcenterDatabase,
    {
      tenantId,
      from: resolvedMonth.from,
      to: resolvedMonth.to,
    },
  );

  const monthWindow = {
    param: resolvedMonth.param,
    label: formatMonthLabel(resolvedMonth, locale, timezone),
    previousParam: resolvedMonth.previousParam,
    nextParam: resolvedMonth.nextParam,
  };

  return (
    <ToastProvider>
      <div className="max-w-[1400px] space-y-8">
        <AdminSectionHeader
          eyebrow="Spielbetrieb"
          title="Matchcenter"
          description="Zentrale Spielplanung und operative Matchvorbereitung."
          actions={
            <Link
              href="/dashboard/matchcenter/new"
              className="fca-button-primary"
            >
              <Plus className="h-4 w-4" />
              Match erstellen
            </Link>
          }
        />

        <MatchcenterOverview
          matches={matches}
          tab={tab}
          actionFilter={actionFilter}
          wochenplanFilter={wochenplanFilter}
          monthWindow={monthWindow}
          timezone={timezone}
          locale={locale}
          canManage={canManage}
          currentMonthParam={currentMonthParam}
          tenantLogoUrl={tenantContext.logoUrl}
        />
      </div>
    </ToastProvider>
  );
}
