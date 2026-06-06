import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getAdminNewsArticleById } from "@/lib/news/admin-queries";
import { notFound } from "next/navigation";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditNewsArticlePage({ params }: Props) {
  const { id } = await params;
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  const tenant = await getTenantFromSession(session.user.tenantId);
  if (!tenant) notFound();

  const article = await getAdminNewsArticleById(id, tenant.id);
  if (!article) notFound();

  return <NewsArticleForm mode="edit" article={article} />;
}
