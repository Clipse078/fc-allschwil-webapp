import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import WebsiteSettingsForm from "@/components/admin/website/WebsiteSettingsForm";
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

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: "/dashboard/website" },
          { label: "Einstellungen" },
        ]}
      />
      <PageHeader
        eyebrow="Website"
        title="Website-Einstellungen"
        description="Website-Veröffentlichung, Publish-Modus und Vier-Augen-Prinzip konfigurieren."
      />
      <SectionCard>
        <WebsiteSettingsForm
          defaultValues={{
            approvedDataOnly: ctx.approvedDataOnly,
            websiteEnabled: ctx.websiteEnabled,
            websiteBaseUrl: ctx.websiteBaseUrl ?? "",
            websitePrimaryLanguage: ctx.websitePrimaryLanguage ?? "",
            websitePublishMode: ctx.websitePublishMode,
            websiteCacheStrategy: ctx.websiteCacheStrategy ?? "",
          }}
        />
      </SectionCard>
    </PageShell>
  );
}
