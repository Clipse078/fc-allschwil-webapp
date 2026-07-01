import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import NewsArticleList from "@/components/admin/news/NewsArticleList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import { buttonVariants } from "@/components/ui";

export default async function NewsAdminPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Website"
        title="News"
        description="Newsartikel erstellen, prüfen, planen und veröffentlichen."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "News" },
        ]}
        headerActions={
          <Link href="/dashboard/website/news/new" className={buttonVariants({ variant: "primary" })}>
            <Plus className="h-4 w-4" />
            Neue News erstellen
          </Link>
        }
      >
        <NewsArticleList />
      </ListPagePattern>
    </PageShell>
  );
}
