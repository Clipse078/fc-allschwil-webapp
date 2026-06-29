import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getWebsiteConfig, listWebsiteRedirects } from "@/lib/website-config/admin-queries";
import WebsiteConfigForm from "@/components/admin/website/WebsiteConfigForm";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  SectionCard,
} from "@/components/ui/page";

export default async function WebsiteSettingsPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  const [config, redirects] = await Promise.all([
    getWebsiteConfig(tenantId),
    listWebsiteRedirects(tenantId),
  ]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Konfiguration" },
        ]}
      />
      <PageHeader
        eyebrow="Website"
        title="Website-Konfiguration"
        description="SEO, Analytics, Social Media, PWA, Cookie-Banner, Weiterleitungen und Workflow-Einstellungen."
      />
      <SectionCard className="overflow-hidden p-0">
        <WebsiteConfigForm
          approvedDataOnly={ctx.approvedDataOnly}
          config={config}
          redirects={redirects}
        />
      </SectionCard>
    </PageShell>
  );
}
