import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import NewsArticleEditForm from "@/components/admin/website/NewsArticleEditForm";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

type Props = { params: Promise<{ articleId: string }> };

const STATUS_LABELS: Record<string, string> = { DRAFT: "Entwurf", REVIEW: "In Prüfung", PUBLISHED: "Publiziert", ARCHIVED: "Archiviert" };
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-600",
};

export default async function NewsArticleEditPage({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  const { articleId } = await params;

  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, site: { tenantKey: SITE_TENANT_KEY } },
    select: {
      id: true, title: true, slug: true, excerpt: true, listingText: true,
      body: true, coverImageUrl: true, locale: true, status: true, publishedAt: true,
    },
  });

  if (!article) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/dashboard/website/news" className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50">
          <ArrowLeft className="h-3.5 w-3.5" />
          News
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{article.title}</h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[article.status] ?? ""}`}>
            {STATUS_LABELS[article.status] ?? article.status}
          </span>
        </div>
      </div>

      <NewsArticleEditForm article={article} />
    </div>
  );
}
