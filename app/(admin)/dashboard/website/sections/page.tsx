import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteSections } from "@/lib/website/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteSectionsPanel from "@/components/admin/website/WebsiteSectionsPanel";

export default async function WebsiteSectionsPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const canManage = hasPermission(session, PERMISSIONS.WEBSITE_MANAGE);

  let sections: Awaited<ReturnType<typeof getWebsiteSections>> = [];
  try {
    sections = await getWebsiteSections(tenantId);
  } catch {
    sections = [];
  }

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Sektionen"
        description="Publikationsstatus der einzelnen Website-Sektionen verwalten. Jede Sektion durchläuft den Freigabe-Workflow: Entwurf → In Prüfung → Freigegeben → Publiziert."
      />
      <WebsiteSectionsPanel
        initialSections={sections}
        canManage={canManage}
      />
    </div>
  );
}
