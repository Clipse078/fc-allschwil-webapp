import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import { HomepageBuilderWorkspace } from "@/components/admin/homepage-builder";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

export default async function HomepageBuilderPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Homepage Builder" },
        ]}
      />

      <div className="mb-6">
        <PageHeader
          eyebrow="Website"
          title="Homepage Builder"
          description="Visueller Block-Editor für Homepage-Sektionen. Aktivierte und veröffentlichte Sektionen erscheinen in der öffentlichen API."
        />
      </div>

      <HomepageBuilderWorkspace />
    </PageShell>
  );
}
