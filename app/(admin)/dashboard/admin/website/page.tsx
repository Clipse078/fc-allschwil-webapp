import Link from "next/link";
import { notFound } from "next/navigation";
import { Newspaper, Settings, Globe, ExternalLink } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getNewsPostsForAdmin } from "@/lib/website/news-queries";

export default async function WebsiteOverviewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);
  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const posts = await getNewsPostsForAdmin(tenantId).catch(() => []);
  const published = posts.filter((p) => p.isPublished).length;
  const drafts = posts.filter((p) => !p.isPublished).length;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Website-Verwaltung"
        description="Vereins-News, Website-Inhalte und öffentliche Feeds verwalten. Alle Änderungen wirken sich sofort auf die öffentliche Website aus."
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminSurfaceCard className="p-5">
          <p className="fca-eyebrow">Artikel gesamt</p>
          <p className="mt-2 text-3xl font-bold text-[var(--blue)]">{posts.length}</p>
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">
            {published} publiziert · {drafts} Entwurf{drafts !== 1 ? "e" : ""}
          </p>
        </AdminSurfaceCard>

        <AdminSurfaceCard className="p-5">
          <p className="fca-eyebrow">Publizierte News</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{published}</p>
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">
            Aktuell auf der Website sichtbar
          </p>
        </AdminSurfaceCard>

        <AdminSurfaceCard className="p-5">
          <p className="fca-eyebrow">Entwürfe</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{drafts}</p>
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">
            Noch nicht öffentlich
          </p>
        </AdminSurfaceCard>
      </div>

      {/* Module tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/dashboard/admin/website/news"
          className="fca-card group flex flex-col gap-4 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--blue-light)]">
            <Newspaper className="h-5 w-5 text-[var(--blue)]" />
          </div>
          <div>
            <h3 className="fca-subheading">Vereins-News</h3>
            <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
              Artikel erstellen, bearbeiten und publizieren. Erscheinen auf der
              öffentlichen Website unter /news.
            </p>
          </div>
          <span className="mt-auto text-[0.72rem] font-semibold text-[var(--blue)] group-hover:underline">
            {posts.length} Artikel verwalten →
          </span>
        </Link>

        <div className="fca-card flex flex-col gap-4 p-6 opacity-60">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Settings className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h3 className="fca-subheading">Website-Einstellungen</h3>
            <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
              Navigation, Kontaktdaten, Social-Media-Links und weitere
              Website-Konfiguration. (Folgt in nächstem Release)
            </p>
          </div>
          <span className="mt-auto text-[0.72rem] font-semibold text-slate-400">
            Demnächst verfügbar
          </span>
        </div>

        <div className="fca-card flex flex-col gap-4 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Globe className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <h3 className="fca-subheading">Öffentliche Feeds</h3>
            <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
              Public-API-Endpunkte für die Website: Events, Wochenplan, News.
            </p>
          </div>
          <div className="mt-auto space-y-1">
            {[
              { label: "/api/public/events", href: "/api/public/events" },
              { label: "/api/public/wochenplan", href: "/api/public/wochenplan" },
              { label: "/api/public/website/news", href: "/api/public/website/news" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[0.72rem] font-mono text-[var(--blue)] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
