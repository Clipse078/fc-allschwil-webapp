import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import NewsArticleList from "@/components/admin/news/NewsArticleList";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";

export default async function NewsAdminPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "News" },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="News"
          description="Newsartikel erstellen, prüfen, planen und veröffentlichen."
          className="mb-0"
        />
        <PageActions>
          <Link href="/dashboard/website/news/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue News erstellen
          </Link>
        </PageActions>
      </div>
      <NewsArticleList />
    </PageShell>
  );
}
