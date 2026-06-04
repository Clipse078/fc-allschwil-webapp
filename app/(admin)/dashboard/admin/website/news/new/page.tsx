import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteNewsForm from "@/components/admin/website/WebsiteNewsForm";

export default async function NewWebsiteNewsPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);
  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereins-News"
        title="Neuer Artikel"
        description="Artikel verfassen und optional sofort publizieren."
      />
      <WebsiteNewsForm tenantId={tenantId} />
    </div>
  );
}
