import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import StatusBadge from "@/components/shared/ui/StatusBadge";

export default async function WochenplanPage() {
  await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);

  return (
    <PageShell>
      <section>
        <p className="fca-eyebrow">Wochenplan</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="fca-heading">Feld-/Garderobenplanung</h1>
          <StatusBadge label="Kalenderwoche 16" tone="danger" />
        </div>
      </section>

      <WochenplanBoard />
    </PageShell>
  );
}
