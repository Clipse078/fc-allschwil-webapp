import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getNewsArticleAdminById } from "@/lib/news/admin-queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/website/news"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Alle Artikel
      </Link>

      <AdminSectionHeader
        eyebrow="Website · News"
        title={article.title}
        description={`Slug: ${article.slug}`}
      />

      <NewsArticleForm article={article} requiresReview={ctx.approvedDataOnly} />
    </div>
  );
}
