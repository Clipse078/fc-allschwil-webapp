import { getCurrentTenantContext } from "@/lib/tenants/context";
import TenantLogo from "@/components/admin/branding/TenantLogo";

type Props = {
  tenantSlug: string;
};

/**
 * Legacy tenant identity strip for cockpit sub-pages that still need an
 * explicit in-content club header. Registration workspace list pages omit
 * this banner because sidebar + breadcrumbs already establish context.
 */
export default async function CockpitTenantBanner({ tenantSlug }: Props) {
  const ctx = await getCurrentTenantContext(tenantSlug);

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <TenantLogo
        logoUrl={ctx?.logoUrl}
        size={28}
        alt={ctx?.name ? `${ctx.name} logo` : "Club logo"}
      />
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Cockpit
        </p>
        <p
          className="text-[0.85rem] font-bold leading-tight tracking-tight"
          style={{ color: "var(--tenant-primary)" }}
        >
          {ctx?.name ?? tenantSlug}
        </p>
      </div>
    </div>
  );
}
