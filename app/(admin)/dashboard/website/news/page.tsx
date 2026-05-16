import Link from "next/link";
import { ArrowLeft, Lightbulb, Newspaper } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { createNewsArticle, publishNewsArticle, archiveNewsArticle } from "./actions";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

const STATUS_STYLES = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-600",
};
const STATUS_LABELS = { DRAFT: "Entwurf", REVIEW: "In Prüfung", PUBLISHED: "Publiziert", ARCHIVED: "Archiviert" };

async function getNewsData() {
  const site = await prisma.websiteSite.findUnique({ where: { tenantKey: SITE_TENANT_KEY }, select: { id: true } });
  if (!site) return [];
  return prisma.newsArticle.findMany({
    where: { siteId: site.id },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, slug: true, locale: true, status: true, publishedAt: true, excerpt: true },
  });
}

export default async function NewsAdminPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  const articles = await getNewsData();
  const publishedCount = articles.filter((a) => a.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/dashboard/website" className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50">
          <ArrowLeft className="h-3.5 w-3.5" />Website
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">News</h1>
          <p className="mt-0.5 text-xs text-slate-400">{articles.length} Beiträge · {publishedCount} publiziert</p>
        </div>
      </div>

      {publishedCount === 0 && (
        <div className="flex items-start gap-3 rounded-[18px] border border-amber-100 bg-amber-50/70 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[12px] text-amber-800">
            Publiziere News damit deine Homepage lebendig wirkt und Mitglieder auf dem Laufenden bleiben.
          </p>
        </div>
      )}

      {/* Create form */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[1rem] font-semibold text-slate-900">Neuer Beitrag</h2>
        <form action={createNewsArticle} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-slate-500">Titel</label>
            <input name="title" required placeholder="z. B. Saisonstart 2025/26" className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2]" />
          </div>
          <div className="w-32">
            <label className="text-[11px] font-semibold text-slate-500">Sprache</label>
            <select name="locale" className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]">
              <option value="de">DE</option>
              <option value="fr">FR</option>
              <option value="it">IT</option>
              <option value="en">EN</option>
            </select>
          </div>
          <button type="submit" className="rounded-full bg-[#0b4aa2] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#08357a]">
            Erstellen
          </button>
        </form>
      </section>

      {/* Article list */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Newspaper className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Noch keine Beiträge. Erstelle deinen ersten News-Artikel.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">/{a.slug} · {a.locale.toUpperCase()}</p>
                  <Link href={`/dashboard/website/news/${a.id}`} className="text-[11px] font-semibold text-[#0b4aa2] hover:underline">Bearbeiten →</Link>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[a.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.DRAFT}`}>
                    {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status}
                  </span>
                  {a.status === "DRAFT" && (
                    <form action={publishNewsArticle}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                        Publizieren
                      </button>
                    </form>
                  )}
                  {a.status !== "ARCHIVED" && (
                    <form action={archiveNewsArticle}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-[11px] text-slate-400 hover:text-slate-600">Archivieren</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
