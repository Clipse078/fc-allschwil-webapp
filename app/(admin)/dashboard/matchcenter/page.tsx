import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, RefreshCw, Volleyball } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import {
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MatchcenterOverview from "@/components/admin/matchcenter/MatchcenterOverview";

export default async function MatchcenterPage() {
  await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();

  if (!tenantContext) {
    notFound();
  }

  const tenantId = tenantContext.id;

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

  const matches = await listMatchcenterMatches(
    matchcenterDatabase,
    {
      tenantId,
    },
  );

  const synchronizedCount = matches.filter(
    (match) =>
      match.synchronization.eventLastSyncedAt !== null ||
      match.synchronization.mappingLastSyncedAt !== null,
  ).length;

  const unresolvedCount = matches.filter(
    (match) =>
      match.home.resolution === "UNRESOLVED" ||
      match.away.resolution === "UNRESOLVED",
  ).length;

  const incompleteCount = matches.filter(
    (match) =>
      !match.location?.trim() ||
      !match.operational.pitchCode?.trim() ||
      !match.operational.homeDressingRoomCode?.trim() ||
      !match.operational.awayDressingRoomCode?.trim(),
  ).length;

  return (
    <div className="max-w-[1400px] space-y-8">
      <AdminSectionHeader
        eyebrow="Spielbetrieb"
        title="Matchcenter"
        description="Zentrale Übersicht aller synchronisierten und manuell erfassten Matches."
        actions={
          <Link
            href="/dashboard/events/matches/new"
            className="fca-button-primary"
          >
            <Plus className="h-4 w-4" />
            Match erstellen
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Matches</p>
          <p
            className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {matches.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Im aktuellen Zeitraum
          </p>
        </div>

        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Synchronisiert</p>
          <p
            className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {synchronizedCount}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Externe oder aktualisierte Daten
          </p>
        </div>

        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Nicht zugeordnet</p>
          <p
            className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-amber-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {unresolvedCount}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Mindestens ein Team offen
          </p>
        </div>

        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Operativ offen</p>
          <p
            className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-rose-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {incompleteCount}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Spielort, Feld oder Garderobe
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
            <RefreshCw className="h-4 w-4 text-[var(--muted)]" />
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Datenquelle
            </p>
            <p className="text-xs text-[var(--muted)]">
              ClubCorner/SFV-Synchronisation und manuell erfasste Matches.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
          <Volleyball className="h-3.5 w-3.5" />
          {tenantContext.name}
        </span>
      </div>

      <MatchcenterOverview
        matches={matches}
        timezone={tenantContext.timezone ?? "Europe/Zurich"}
        locale={tenantContext.locale ?? "de-CH"}
      />
    </div>
  );
}