import { auth } from "@/auth";
import { redirect } from "next/navigation";
import VereinsleitungDashboard from "@/components/admin/vereinsleitung/VereinsleitungDashboard";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { getTargets } from "@/lib/targets/queries";
import { getMeetings } from "@/lib/meetings/queries";
import { getInitiatives } from "@/lib/initiatives/queries";
import {
  getPendingApprovals,
  getStaleTargets,
  getTemplateDrafts,
  getOverdueActions,
  type GovernanceOverviewData,
} from "@/lib/dashboard/governance-overview";
import type { KpiItem } from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { getOperativeStrategicCounts } from "@/lib/dashboard/strategic-summary";

async function getOperativeKpis(actor: ActorContext): Promise<KpiItem[]> {
  const { activeTargetCount, plannedMeetingCount, overdueActionCount } =
    await getOperativeStrategicCounts(actor);

  return [
    {
      label: "Aktive Ziele",
      value: activeTargetCount,
      note: "Ziele mit Status Aktiv",
      trend: "neutral",
      href: "/vereinsleitung/targets",
    },
    {
      label: "Geplante Meetings",
      value: plannedMeetingCount,
      note: "Meetings mit Status Geplant",
      trend: "neutral",
      href: "/vereinsleitung/meetings",
    },
    {
      label: "Überfällige Massnahmen",
      value: overdueActionCount,
      delta: overdueActionCount > 0 ? `${overdueActionCount} offen` : null,
      note: "Meeting-Aktionen mit abgelaufenem Datum",
      trend: overdueActionCount > 0 ? "alert" : "neutral",
      href: "/vereinsleitung/meetings",
    },
  ];
}

export default async function VereinsleitungPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);

  const [targets, meetings, initiatives, kpis, governance] = await Promise.all([
    getTargets(actor),
    getMeetings(actor),
    getInitiatives(actor),
    getOperativeKpis(actor),
    Promise.all([
      getPendingApprovals(actor),
      getStaleTargets(actor),
      getTemplateDrafts(actor),
      getOverdueActions(actor),
    ]).then(
      ([pendingApprovals, staleTargets, templateDrafts, overdueActions]): GovernanceOverviewData => ({
        pendingApprovals,
        staleTargets,
        templateDrafts,
        overdueActions,
      }),
    ),
  ]);

  return (
    <VereinsleitungDashboard
      targets={targets.slice(0, 3)}
      meetings={meetings.slice(0, 3)}
      initiatives={initiatives.slice(0, 3)}
      kpis={kpis}
      governance={governance}
    />
  );
}
