/**
 * /dashboard/website/pages/[id]/builder
 *
 * Admin Page Builder for a specific website page (CMS V2 Slice 8).
 *
 * Allows tenant admins to compose a page from CMS blocks using the shared
 * block registry. This is a foundation-level builder:
 *   - No visual drag-and-drop
 *   - No live visual preview
 *   - No section-level publishing workflow (sections inherit page publish state)
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: from session
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PenLine, Blocks } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getWebsitePageAdminById } from "@/lib/pages/admin-queries";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";
import WebsitePageStatusBadge from "@/components/admin/pages/WebsitePageStatusBadge";
import PageBuilderClient from "@/components/admin/page-builder/PageBuilderClient";

export default async function PageBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  const { id } = await params;
  const page = await getWebsitePageAdminById(ctx.id, id);
  if (!page) notFound();

  const editHref = `/dashboard/website/pages/${id}/edit`;

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Seiten", href: "/dashboard/website/pages" },
          { label: page.title, href: editHref },
          { label: "Page Builder" },
        ]}
      />

      {/* Page context banner */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <Blocks className="h-5 w-5 text-[var(--text-2)]" />
          </div>
          <div>
            <PageHeader
              eyebrow="Website · Page Builder"
              title={page.title}
              description={`Seiten-Slug: /${page.slug}`}
              className="mb-0"
            />
            <div className="mt-1">
              <WebsitePageStatusBadge status={page.status} />
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-2">
          <Link
            href={editHref}
            className="fca-button-secondary"
          >
            <PenLine className="h-4 w-4" />
            Seite bearbeiten
          </Link>
          <Link
            href="/dashboard/website/pages"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Alle Seiten
          </Link>
        </div>
      </div>

      <PageBuilderClient
        pageId={id}
      />
    </PageShell>
  );
}
