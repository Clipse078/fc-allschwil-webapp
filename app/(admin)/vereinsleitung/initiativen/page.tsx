/**
 * Initiatives list page — currently under /vereinsleitung/initiativen.
 *
 * TODO(decoupling — Initiatives Module):
 * Initiatives must become a standalone reusable module, not a child of Vereinsleitung.
 * Target route: /initiatives (with optional ?orgUnit=... filter for context)
 * Note: the URL uses the German "initiativen" — the canonical English route will
 * use "initiatives" for consistency with the platform's English-first API/route layer.
 * Migration steps:
 *   1. Create app/(admin)/initiatives/page.tsx using the future InitiativesList component
 *   2. Replace static mock data with real Prisma queries (Initiative model not yet in schema)
 *   3. Add orgUnitId / targetGroup as query param or route context
 *   4. Add Next.js redirect: /vereinsleitung/initiativen → /initiatives (with orgUnit param)
 *   5. Deprecate this route file once redirect is live
 *
 * Blocker: Initiative data model not yet in Prisma schema. Route migration pending.
 */
import VereinsleitungInitiativenList from "@/components/admin/vereinsleitung/VereinsleitungInitiativenList";

export default function VereinsleitungInitiativenPage() {
  return <VereinsleitungInitiativenList />;
}
