import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import HomepagePreview from "@/components/admin/homepage-blocks/HomepagePreview";
import { resolveTenantBranding } from "@/lib/tenant-runtime/branding";

/**
 * /dashboard/website/homepage/preview
 *
 * Permission-protected preview page for Homepage Blocks.
 * Renders all non-ARCHIVED blocks — including DRAFT and IN_REVIEW —
 * so admins can verify layout and styling before publishing.
 *
 * Security: This route is only accessible to authenticated users with
 * WEBSITE_MANAGE permission. Unpublished content is NEVER exposed publicly.
 */
export default async function HomepagePreviewPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  const branding = resolveTenantBranding(ctx);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/website/homepage"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Alle Blöcke
      </Link>

      <AdminSectionHeader
        eyebrow="Website · Homepage"
        title="Vorschau"
        description="Vorschau aller Homepage-Blöcke inkl. Entwürfen — vor der Veröffentlichung."
      />

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-blue-200 bg-blue-50 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-blue-800">Geschützte Vorschau</p>
          <p className="mt-0.5 text-xs text-blue-700">
            Diese Seite ist ausschliesslich für authentifizierte Nutzer mit Website-Verwaltungs-Berechtigung
            zugänglich. Unveröffentlichte Inhalte werden nie öffentlich exponiert.
          </p>
        </div>
      </div>

      <HomepagePreview
        tenantPrimaryColor={branding.primaryColor}
        tenantSecondaryColor={branding.secondaryColor}
      />
    </div>
  );
}
