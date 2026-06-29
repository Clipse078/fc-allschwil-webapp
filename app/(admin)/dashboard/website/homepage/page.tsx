import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import HomepageBuilderClient from "@/components/admin/homepage/HomepageBuilderClient";
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

      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <PageHeader
          eyebrow="Website"
          title="Homepage Builder"
          description="Visueller Builder mit Live-Vorschau. Änderungen werden sofort im Canvas angezeigt."
          className="mb-0"
        />
        <Link
          href={CMS_ROUTES.overview}
          className="fca-button-secondary text-xs"
        >
          ← CMS Übersicht
        </Link>
      </div>

      <HomepageBuilderClient />
    </PageShell>
  );
}
