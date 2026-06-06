import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewNewsArticlePage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  return <NewsArticleForm mode="create" />;
}
