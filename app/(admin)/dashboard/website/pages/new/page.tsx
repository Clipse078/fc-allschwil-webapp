import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsitePageForm from "@/components/admin/pages/WebsitePageForm";

export default async function WebsitePageNewPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const ctx = await getActiveTenant();
  if (!ctx) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website · Seiten"
        title="Neue Seite"
        description="Erstelle eine neue Website-Seite. Sie wird als Entwurf gespeichert bis du sie veröffentlichst."
      />
      <WebsitePageForm requiresReview={ctx.approvedDataOnly} />
    </div>
  );
}
