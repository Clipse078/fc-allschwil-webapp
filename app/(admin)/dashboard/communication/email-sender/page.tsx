import { notFound } from "next/navigation";
import EmailSenderSettingsForm from "@/components/admin/communications/EmailSenderSettingsForm";
import { Badge } from "@/components/ui/Badge";
import { PageBreadcrumbs, PageHeader, PageShell } from "@/components/ui/page";
import { getTenantEmailSenderSettings } from "@/lib/communication/email-sender-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

export const dynamic = "force-dynamic";

export default async function EmailSenderPage() {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const tenant = await getActiveTenant();
  if (!tenant) notFound();

  const settings = await getTenantEmailSenderSettings(tenant.id);

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Kommunikation", href: "/dashboard/communication" },
          { label: "E-Mail-Absender" },
        ]}
      />
      <PageHeader
        eyebrow="Kommunikation"
        title="E-Mail-Absender"
        description="Wie erscheinen E-Mails, die Ihr Verein über SportClubEvo versendet?"
        badge={<Badge variant="success">Verfügbar</Badge>}
      />
      <EmailSenderSettingsForm initialSettings={settings} />
    </PageShell>
  );
}
