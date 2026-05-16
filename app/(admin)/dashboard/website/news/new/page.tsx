import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import NewsArticleFormCard from "@/components/admin/news/NewsArticleFormCard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { createNewsArticleAction } from "../actions";

type NewArticlePageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "error" }> = {
  "missing-fields": { text: "Titel und Slug sind Pflichtfelder.", tone: "error" },
  "slug-exists": {
    text: "Ein Artikel mit diesem Slug und dieser Sprache existiert bereits. Wähle einen anderen Slug.",
    tone: "error",
  },
};

export default async function NewArticlePage({ searchParams }: NewArticlePageProps) {
  await requirePermission(PERMISSIONS.NEWS_MANAGE);

  const params = (await searchParams) ?? {};
  const statusEntry = params.status ? (STATUS_MESSAGES[params.status] ?? null) : null;
  const site = await getDefaultSite();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · News"
        title="Neuer Artikel"
        description="Erstelle einen neuen Artikel. Er ist standardmässig als Entwurf gespeichert und erst nach Publikation öffentlich sichtbar."
        actions={
          <Link href="/dashboard/website/news" className="fca-button-secondary">
            Zurück
          </Link>
        }
      />

      {statusEntry && (
        <AdminSurfaceCard className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{statusEntry.text}</p>
        </AdminSurfaceCard>
      )}

      {site ? (
        <NewsArticleFormCard
          mode="create"
          action={createNewsArticleAction}
          defaultLocale={site.locale}
        />
      ) : (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Kein aktiver Website-Eintrag gefunden. Bitte zuerst eine{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">WebsiteSite</code>{" "}
            anlegen.
          </p>
        </AdminSurfaceCard>
      )}
    </div>
  );
}
