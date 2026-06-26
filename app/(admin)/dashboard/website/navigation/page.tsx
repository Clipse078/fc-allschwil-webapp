import { Menu } from "lucide-react";
import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import NavigationManager from "@/components/admin/navigation/NavigationManager";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

export default async function NavigationManagementPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Navigation" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Navigation"
          description="Menüstruktur verwalten: Header-Navigation, Footer-Navigation, Links, Sortierung und Sichtbarkeit."
          className="mb-0"
        />
      </div>

      {/* Architecture note */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(14,165,233,0.10)", color: "#0EA5E9" }}
          >
            <Menu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Navigation Management Foundation
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Navigationselemente für Header und Footer verwalten. Aktive und
              sichtbare Elemente werden über die öffentliche API bereitgestellt.
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Öffentliche API:{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px]">
                GET /api/public/[tenant]/website/navigation
              </code>
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Deferred:{" "}
              <span className="text-amber-600">
                Drag-and-Drop · Visueller Menü-Editor · Mega-Menü · Rollenbasierte Sichtbarkeit · SEO
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={CMS_ROUTES.overview}
          className="fca-button-secondary text-xs"
        >
          ← CMS Übersicht
        </Link>
      </div>

      <NavigationManager />
    </PageShell>
  );
}
