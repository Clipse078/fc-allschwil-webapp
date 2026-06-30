import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import NewsArticleList from "@/components/admin/news/NewsArticleList";
import { AppPage, AppPageHeader } from "@/components/ui/layout";

export default async function NewsAdminPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <AppPage>
      <AppPageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "News" },
        ]}
        eyebrow="Website"
        title="News"
        description="Newsartikel erstellen, prüfen, planen und veröffentlichen."
        actions={
          <Link href="/dashboard/website/news/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue News erstellen
          </Link>
        }
      />
      <NewsArticleList />
    </AppPage>
  );
}
