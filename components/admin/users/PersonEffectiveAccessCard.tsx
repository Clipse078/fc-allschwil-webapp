import { getEffectiveAccessSummaryForUser } from "@/lib/roles/effective-access-summary";
import EffectiveAccessSummary from "@/components/admin/users/EffectiveAccessSummary";

type Props = {
  tenantId: string;
  userId: string;
};

export default async function PersonEffectiveAccessCard({ tenantId, userId }: Props) {
  const groups = await getEffectiveAccessSummaryForUser(tenantId, userId);

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Effektiver Zugriff
        </p>
      </div>
      <div className="sce-detail-section-body">
        <EffectiveAccessSummary
          groups={groups}
          emptyMessage="Keine Berechtigungen aus den zugewiesenen Rollen."
          compact
        />
      </div>
    </div>
  );
}
