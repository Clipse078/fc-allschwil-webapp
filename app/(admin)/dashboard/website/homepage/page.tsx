import { LayoutTemplate } from "lucide-react";
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
          description="Sektionen konfigurieren, aktivieren und veröffentlichen. Klicke eine Sektion an, um sie im Inspector zu bearbeiten."
          className="mb-0"
        />
        <div className="flex gap-2">
          <Link href={CMS_ROUTES.overview} className="fca-button-secondary text-xs">
            ← CMS Übersicht
          </Link>
        </div>
      </div>

      {/* Two-pane builder — fills remaining viewport height */}
      <div style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
        <HomepageBuilderClient />
      </div>
    </PageShell>
  );
}
