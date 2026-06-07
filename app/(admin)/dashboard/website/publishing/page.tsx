import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PublishingCenter from "@/components/admin/publishing/PublishingCenter";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";

export default async function PublishingCenterPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Veröffentlichungen" },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Veröffentlichungen"
          description="Inhalte prüfen, freigeben, planen und veröffentlichen."
          className="mb-0"
        />
        <PageActions>
          <Link href="/dashboard/website/news/new" className="fca-button-secondary">
            <Plus className="h-4 w-4" />
            Neue News
          </Link>
          <Link href="/dashboard/website/pages/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue Seite
          </Link>
        </PageActions>
      </div>
      <PublishingCenter />
    </PageShell>
  );
}
