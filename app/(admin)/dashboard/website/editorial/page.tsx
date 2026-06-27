/**
 * /dashboard/website/editorial
 *
 * Editorial Center — CMS V2 Slice 10.
 *
 * Operational command center for CMS editors.
 * Provides an overview of all editorial activity:
 *   - KPI cards (drafts, in review, scheduled, published, archived)
 *   - Unified review queue (homepage sections + page sections + pages)
 *   - Publishing calendar (upcoming scheduled content)
 *   - Content health checks
 *   - Editorial activity feed (from AuditLog)
 *   - Scheduled publications view
 *   - Draft overview
 *   - Recently changed content
 *
 * This page is NOT a second CMS system. It is an operational view over
 * the existing CMS data built on Slice 9 infrastructure.
 *
 * All business logic, publishing, and workflow actions remain in
 * the dedicated specialized pages (publishing, review, builder).
 */

import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";
import EditorialDashboard from "@/components/admin/editorial/EditorialDashboard";

export default async function EditorialCenterPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Redaktion" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website · CMS V2"
          title="Redaktion"
          description="Operativer Überblick für CMS-Redakteure: Prüfqueue, Veröffentlichungsplan, Entwürfe, Aktivität und inhaltliche Hinweise."
          className="mb-0"
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href={CMS_ROUTES.review}
            className="fca-button-secondary text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Freigabe-Queue
          </Link>
          <Link
            href={CMS_ROUTES.publishing}
            className="fca-button-secondary text-xs"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Veröffentlichungen
          </Link>
        </div>
      </div>

      <EditorialDashboard />
    </PageShell>
  );
}
