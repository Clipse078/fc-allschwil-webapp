/**
 * Vereinsleitung overview page.
 *
 * TODO(decoupling — Organisation Builder):
 * "Vereinsleitung" is one specific division type. The system must not force it.
 * Target architecture:
 *   - Clubs create their own org units / divisions (e.g. Vorstand, Trainer-Rat, etc.)
 *   - Each org unit gets its own dashboard with meetings, initiatives, goals, KPIs
 *   - This page becomes a generic OrgUnit dashboard, e.g. /org-units/[slug]
 *   - Route /vereinsleitung is kept as a backwards-compatible alias pointing to
 *     whichever org unit has the type VEREINSLEITUNG in the Organisation Builder
 *
 * Blocker: Organisation Builder module not yet built.
 */
import VereinsleitungDashboard from "@/components/admin/vereinsleitung/VereinsleitungDashboard";

export default function Page() {
  return <VereinsleitungDashboard />;
}
