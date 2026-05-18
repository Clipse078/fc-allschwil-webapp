/**
 * KPIs page — currently at /vereinsleitung/kpis.
 *
 * TODO(decoupling — KPI Module):
 * KPIs/Targets must become a standalone reusable module at /kpis.
 * See lib/platform/constants.ts → KPI_ROUTE_BASE for the full architectural
 * design notes (data model, canonical routes, ownership model, governance roadmap).
 *
 * Current state: 100% static mock data — no Prisma model exists.
 *
 * Migration steps (future KPI Module sprint):
 *   1. Design + migrate KpiMetric + KpiDataPoint models
 *   2. Create /app/api/kpis/ CRUD routes
 *   3. Create canonical app/(admin)/kpis/ pages
 *   4. Add KPIS_VIEW + KPIS_MANAGE permissions + seed
 *   5. Add 307 redirect: /vereinsleitung/kpis → /targets
 *   6. Add nav item: href /targets with TARGETS_VIEW/MANAGE permissionKeys guard
 *
 * Module name decision: canonical route = /targets (not /kpis)
 *   A Target is broader than a KPI. KPI metrics are the measurements inside a Target.
 *   Data model: Target → TargetMetric → TargetDataPoint (now in schema.prisma).
 *
 * Blocker: KpiMetric data model design required before any route/API work.
 */
import VereinsleitungKpisPage from "@/components/admin/vereinsleitung/VereinsleitungKpisPage";

export default function VereinsleitungKpisRoutePage() {
  return <VereinsleitungKpisPage />;
}
