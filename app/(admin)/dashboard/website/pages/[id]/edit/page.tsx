import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getWebsitePageAdminById } from "@/lib/pages/admin-queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsitePageForm from "@/components/admin/pages/WebsitePageForm";

export default async function WebsitePageEditPage({
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/website/pages"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Alle Seiten
      </Link>

      <AdminSectionHeader
        eyebrow="Website · Seiten"
        title={page.title}
        description={`Slug: ${page.slug}`}
      />

      <WebsitePageForm page={page} requiresReview={ctx.approvedDataOnly} />
    </div>
  );
}
