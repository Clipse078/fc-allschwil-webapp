import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getTenantEmailSenderSettings } from "@/lib/communication/email-sender-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import EmailSenderSettingsForm from "@/components/admin/communications/EmailSenderSettingsForm";

export const dynamic = "force-dynamic";

export default async function CommunicationsSettingsPage() {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const settings = await getTenantEmailSenderSettings(tenant.id);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Kommunikation"
        description="Tenant-weite Einstellungen für die Kommunikation Ihres Vereins."
      />
      <EmailSenderSettingsForm initialSettings={settings} />
    </div>
  );
}
