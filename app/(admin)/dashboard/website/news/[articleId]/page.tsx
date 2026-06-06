import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getNewsArticleById } from "@/lib/news/admin-queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

type Props = {
  params: Promise<{ articleId: string }>;
};

export default async function EditNewsArticlePage({ params }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const { articleId } = await params;
  const article = await getNewsArticleById(articleId, tenantId);
  if (!article) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website · News"
        title={article.title}
        description={`Zuletzt geändert: ${new Intl.DateTimeFormat("de-CH", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(article.updatedAt))}`}
      />
      <NewsArticleForm mode="edit" article={article} />
    </div>
  );
}
