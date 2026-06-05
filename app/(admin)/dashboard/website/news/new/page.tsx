import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewNewsArticlePage() {
  await requirePermission(PERMISSIONS.NEWS_MANAGE);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/website/news"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
        <AdminSectionHeader
          eyebrow="Website · News"
          title="Neuer Artikel"
          description="Erstelle einen neuen Artikel. Er wird als Entwurf gespeichert und erst nach dem Veröffentlichen auf der Website angezeigt."
        />
      </div>

      <NewsArticleForm mode="create" />
    </div>
  );
}
