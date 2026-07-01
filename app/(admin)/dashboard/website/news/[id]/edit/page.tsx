import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getNewsArticleAdminById } from "@/lib/news/admin-queries";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewsArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  const { id } = await params;
  const article = await getNewsArticleAdminById(ctx.id, id);
  if (!article) notFound();

  return <NewsArticleForm article={article} requiresReview={ctx.approvedDataOnly} />;
}
