import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import NewsArticleFormCard from "@/components/admin/news/NewsArticleFormCard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite, getNewsArticleDetailData } from "@/lib/news/queries";
import {
  updateNewsArticleAction,
  publishNewsArticleAction,
  archiveNewsArticleAction,
  deleteNewsArticleAction,
} from "../actions";

type ArticleDetailPageProps = {
  params: Promise<{ articleId: string }>;
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "error" }> = {
  created: { text: "Artikel erfolgreich erstellt.", tone: "success" },
  saved: { text: "Änderungen gespeichert.", tone: "success" },
  published: { text: "Artikel veröffentlicht. Er ist jetzt öffentlich sichtbar.", tone: "success" },
  archived: { text: "Artikel wurde auf Entwurf zurückgesetzt und ist nicht mehr öffentlich.", tone: "warning" },
  "missing-fields": { text: "Titel ist ein Pflichtfeld.", tone: "error" },
  "slug-exists": {
    text: "Ein Artikel mit diesem Slug und dieser Sprache existiert bereits.",
    tone: "error",
  },
};

function formatDate(date: Date | null): string {
  if (!date) return "–";
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: ArticleDetailPageProps) {
  await requirePermission(PERMISSIONS.NEWS_MANAGE);

  const { articleId } = await params;
  const { status } = (await searchParams) ?? {};
  const statusEntry = status ? (STATUS_MESSAGES[status] ?? null) : null;

  const site = await getDefaultSite();
  if (!site) notFound();

  const article = await getNewsArticleDetailData(articleId, site.id);
  if (!article) notFound();

  const isPublished = article.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · News"
        title={article.title}
        description={`/${article.slug} · ${article.locale}`}
        actions={
          <Link href="/dashboard/website/news" className="fca-button-secondary">
            Zurück
          </Link>
        }
      />

      <AdminSurfaceCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusPill
              label={isPublished ? "Publiziert" : "Entwurf"}
              tone={isPublished ? "success" : "muted"}
            />
            {isPublished && article.publishedAt && (
              <span className="text-sm text-slate-500">
                Publiziert am {formatDate(article.publishedAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isPublished && (
              <Link
                href={`/${site.tenantKey}/news/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fca-button-secondary"
              >
                Vorschau →
              </Link>
            )}

            {isPublished ? (
              <form action={archiveNewsArticleAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button type="submit" className="fca-button-secondary">
                  Archivieren
                </button>
              </form>
            ) : (
              <form action={publishNewsArticleAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button type="submit" className="fca-button-primary">
                  Veröffentlichen
                </button>
              </form>
            )}

            <form action={deleteNewsArticleAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Löschen
              </button>
            </form>
          </div>
        </div>
      </AdminSurfaceCard>

      {statusEntry && (
        <AdminSurfaceCard
          className={
            statusEntry.tone === "success"
              ? "border-green-200 bg-green-50 p-4"
              : statusEntry.tone === "error"
                ? "border-red-200 bg-red-50 p-4"
                : "border-amber-200 bg-amber-50 p-4"
          }
        >
          <p
            className={`text-sm font-medium ${
              statusEntry.tone === "success"
                ? "text-green-800"
                : statusEntry.tone === "error"
                  ? "text-red-800"
                  : "text-amber-800"
            }`}
          >
            {statusEntry.text}
          </p>
        </AdminSurfaceCard>
      )}

      {!article.listingText && (
        <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm text-blue-800">
            <strong>Tipp:</strong> Der Listing-Text wird für kompakte Karten, Infoboards
            und zukünftige App-Benachrichtigungen verwendet. Füge ihn hinzu, damit der
            Artikel überall optimal dargestellt wird.
          </p>
        </AdminSurfaceCard>
      )}

      <NewsArticleFormCard
        mode="edit"
        action={updateNewsArticleAction}
        article={article}
        defaultLocale={site.locale}
      />
    </div>
  );
}
