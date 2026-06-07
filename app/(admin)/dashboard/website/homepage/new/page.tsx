import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import HomepageBlockForm from "@/components/admin/homepage-blocks/HomepageBlockForm";
import { resolveTenantBranding } from "@/lib/tenant-runtime/branding";

export default async function NewHomepageBlockPage() {
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
        title="Neuer Hero-Block"
        description="Hero-Block erstellen und konfigurieren. Der Block wird als Entwurf gespeichert."
      />

      <HomepageBlockForm
        requiresReview={ctx.approvedDataOnly}
        tenantPrimaryColor={branding.primaryColor}
        tenantSecondaryColor={branding.secondaryColor}
      />
    </div>
  );
}
