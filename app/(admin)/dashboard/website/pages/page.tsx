import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import WebsitePageList from "@/components/admin/pages/WebsitePageList";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";
import { buttonVariants } from "@/components/ui";

export default async function WebsitePagesAdminPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Seiten" },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Seiten"
          description="Statische Website-Seiten erstellen, bearbeiten und veröffentlichen. Veröffentlichte Seiten sind über die öffentliche API abrufbar."
          className="mb-0"
        />
        <PageActions>
          <Link href="/dashboard/website/pages/new" className={buttonVariants({ variant: "primary" })}>
            <Plus className="h-4 w-4" />
            Neue Seite
          </Link>
        </PageActions>
      </div>
      <WebsitePageList />
    </PageShell>
  );
}
