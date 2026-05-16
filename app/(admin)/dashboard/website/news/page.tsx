import Link from "next/link";
import { Newspaper } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import NewsArticlesTable from "@/components/admin/news/NewsArticlesTable";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite, getNewsAdminListData } from "@/lib/news/queries";

type NewsListingPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "success" | "warning" | "error" }> = {
  created: { text: "Artikel erfolgreich erstellt.", tone: "success" },
  deleted: { text: "Artikel wurde gelöscht.", tone: "success" },
  "no-site": {
    text: 'Kein aktiver Website-Eintrag gefunden. Eine WebsiteSite mit isActive=true muss in der Datenbank existieren.',
    tone: "warning",
  },
};

export default async function NewsListingPage({ searchParams }: NewsListingPageProps) {
  await requirePermission(PERMISSIONS.NEWS_MANAGE);

  const params = (await searchParams) ?? {};
  const statusEntry = params.status ? (STATUS_MESSAGES[params.status] ?? null) : null;

  const site = await getDefaultSite();
  const articles = site ? await getNewsAdminListData(site.id) : [];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · News"
        title="News & Artikel"
        description="Veröffentliche Neuigkeiten, Vereinsberichte und Blogbeiträge für die öffentliche Website."
        actions={
          site ? (
            <Link href="/dashboard/website/news/new" className="fca-button-primary">
              Neuer Artikel
            </Link>
          ) : null
        }
      />

      <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Publiziere News, damit die Website lebendig wirkt.
            </p>
            <p className="text-sm text-slate-600">
              Der Listing-Text wird für kompakte Karten, Infoboards und zukünftige App-Benachrichtigungen verwendet.
            </p>
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

      {!site && (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Kein aktiver Website-Eintrag gefunden. Eine{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">WebsiteSite</code>
            -Zeile mit{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">isActive = true</code>{" "}
            muss in der Datenbank existieren, bevor Artikel erstellt werden können.
          </p>
        </AdminSurfaceCard>
      )}

      <NewsArticlesTable articles={articles} />
    </div>
  );
}
