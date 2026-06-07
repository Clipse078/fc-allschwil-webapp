import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteSettingsForm from "@/components/admin/website/WebsiteSettingsForm";

export default async function WebsiteSettingsPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Einstellungen"
        description="Website-Workflow und Veröffentlichungseinstellungen konfigurieren."
      />
      <WebsiteSettingsForm
        defaultValues={{ approvedDataOnly: ctx.approvedDataOnly }}
      />
    </div>
  );
}
