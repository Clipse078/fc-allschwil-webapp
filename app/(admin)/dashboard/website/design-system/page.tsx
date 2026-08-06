import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getResolvedDesignSystem, getRawDesignSystem } from "@/lib/website/design-system-queries";
import DesignSystemManager from "@/components/admin/design-system/DesignSystemManager";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";
import { CMS_ROUTES } from "@/lib/cms/routes";
import Link from "next/link";
import { ExternalLink, Palette } from "lucide-react";

export default async function DesignSystemPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const [resolved, raw] = await Promise.all([
    getResolvedDesignSystem(tenantId),
    getRawDesignSystem(tenantId),
  ]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Design System" },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Website Management"
          title="Design System Manager"
          description="Definiere das globale visuelle Design der Website. Templates und Sektionen erben diese Tokens automatisch."
          className="mb-0"
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              CMS V4
            </span>
          }
        />
        <div className="flex items-center gap-2">
          <Link
            href="/api/public/fc-allschwil/website/design-system"
            target="_blank"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Public API
          </Link>
        </div>
      </div>

      {/* Architecture callout */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(var(--tenant-primary-rgb, 11,74,162), 0.1)", color: "var(--tenant-primary)" }}
          >
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Design System Architektur
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)] leading-relaxed">
              Club Design System → Template → Sektion → Öffentliche Website.
              Tokens werden global definiert und von Templates automatisch geerbt.
              Lokale Überschreibungen bleiben weiterhin möglich.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono"
                style={{ background: "rgba(11,74,162,0.08)", color: "var(--tenant-primary)" }}
              >
                GET /api/public/fc-allschwil/website/design-system
              </span>
              <span>— öffentliche Token-API</span>
            </div>
          </div>
        </div>
      </div>

      <DesignSystemManager
        initialDesignSystem={resolved}
        hasCustomConfig={raw !== null}
      />
    </PageShell>
  );
}
