import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewsArticleNewPage() {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const ctx = await getActiveTenant();
  if (!ctx) notFound();

  return <NewsArticleForm requiresReview={ctx.approvedDataOnly} />;
}
