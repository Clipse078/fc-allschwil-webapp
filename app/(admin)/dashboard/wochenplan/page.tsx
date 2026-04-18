import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function WochenplanPage() {
  await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);

  return (
    <div className="space-y-8">
      <section>
        <p className="fca-eyebrow">Wochenplan</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="fca-heading">Feld-/Garderobenplanung</h1>

          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">
            Kalenderwoche 16
          </span>
        </div>
      </section>

      <WochenplanBoard />
    </div>
  );
}
