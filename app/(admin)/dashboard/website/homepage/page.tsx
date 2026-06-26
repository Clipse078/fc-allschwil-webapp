import { LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import HomepageSectionList from "@/components/admin/homepage/HomepageSectionList";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

export default async function HomepageBuilderPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Homepage Builder" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Homepage Builder"
          description="Konfigurierbare Sektionen für die Homepage verwalten. Aktivierte Sektionen werden über die öffentliche API bereitgestellt."
          className="mb-0"
        />
      </div>

      {/* Architecture note */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(139,92,246,0.10)", color: "#8B5CF6" }}
          >
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Homepage Builder Foundation
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Diese Foundation stellt das Datenmodell, die Admin-Verwaltung und die
              öffentliche API für konfigurierbare Homepage-Sektionen bereit.
              Sektionen sind typisiert (Hero, News-Teaser, Events, Teams, Wochenplan,
              CTA, Sponsoren) und können aktiviert, deaktiviert und umsortiert werden.
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Öffentliche API:{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px]">
                GET /api/public/[tenant]/website/homepage
              </code>
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Deferred:{" "}
              <span className="text-amber-600">
                Visueller Editor · Drag-and-Drop · Rich-Config-Editor ·
                Sponsor-Modell · Vorschau-Workflow
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Section links */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={CMS_ROUTES.overview}
          className="fca-button-secondary text-xs"
        >
          ← CMS Übersicht
        </Link>
      </div>

      <HomepageSectionList />
    </PageShell>
  );
}
