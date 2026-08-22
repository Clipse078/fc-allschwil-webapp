import { notFound } from "next/navigation";
import EmailSenderSettingsForm from "@/components/admin/communications/EmailSenderSettingsForm";
import { Badge } from "@/components/ui/Badge";
import { PageBreadcrumbs, PageHeader, PageShell } from "@/components/ui/page";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { getTenantEmailSenderSettings } from "@/lib/communication/email-sender-service";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { TENANT_ADMINISTRATION_PERMISSIONS } from "@/lib/permissions/tenant-administration";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

export const dynamic = "force-dynamic";

export default async function EmailSenderPage() {
  await requireAnyPermission(TENANT_ADMINISTRATION_PERMISSIONS);
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
      <ToastProvider>
        <EmailSenderSettingsForm initialSettings={settings} />
      </ToastProvider>
    </PageShell>
  );
}
