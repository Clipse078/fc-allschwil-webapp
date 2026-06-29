import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import WebsiteSettingsFormV2 from "@/components/admin/website/WebsiteSettingsFormV2";
import { getOrCreateWebsiteConfig } from "@/lib/website-config/queries";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

export default async function WebsiteSettingsPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  // CMS V4.2: lazily create WebsiteConfig if it doesn't exist yet
  const websiteConfig = await getOrCreateWebsiteConfig(tenantId);

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
        description="Website-Konfiguration: Allgemein, SEO, Social, Analytics, PWA, Cookie, Weiterleitungen."
      />
      {/* CMS V4.2: 8-tab settings form */}
      <WebsiteSettingsFormV2
        config={websiteConfig}
        approvedDataOnly={ctx.approvedDataOnly}
      />
    </PageShell>
  );
}
