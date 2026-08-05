import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import WebsiteSettingsForm from "@/components/admin/website/WebsiteSettingsForm";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  SectionCard,
} from "@/components/ui/page";

export default async function WebsiteSettingsPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const ctx = await getActiveTenant();
  if (!ctx) notFound();

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Einstellungen" },
        ]}
      />
      <PageHeader
        eyebrow="Website"
        title="Einstellungen"
        description="Website-Veröffentlichung und Vier-Augen-Prinzip konfigurieren."
      />
      <SectionCard>
        <WebsiteSettingsForm
          defaultValues={{ approvedDataOnly: ctx.approvedDataOnly }}
        />
      </SectionCard>
    </PageShell>
  );
}
