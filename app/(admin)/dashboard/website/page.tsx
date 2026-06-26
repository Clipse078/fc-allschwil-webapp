import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Newspaper,
  FileText,
  ImageIcon,
  LayoutTemplate,
  Send,
  Globe,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  PenLine,
  Plus,
  Blocks,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getCmsOverviewStats } from "@/lib/cms/overview-stats";
import { CMS_SECTIONS } from "@/lib/cms/sections";
import { CMS_ROUTES } from "@/lib/cms/routes";
import { BLOCK_REGISTRY } from "@/lib/homepage/block-registry";
import { CmsSectionCard } from "@/components/admin/cms/CmsSectionCard";
import { CmsStatCard } from "@/components/admin/cms/CmsStatCard";
import { CmsLegend } from "@/components/admin/cms/CmsLegend";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";

export default async function WebsiteCmsOverviewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const stats = await getCmsOverviewStats(tenantId);

  const permKeys: string[] = session.user?.permissionKeys ?? [];
  const canManageNews = permKeys.includes(PERMISSIONS.NEWS_MANAGE);
  const canManageWebsite = permKeys.includes(PERMISSIONS.WEBSITE_MANAGE);

  // Build the set of feature keys accessible to this user
  const accessibleFeatureKeys = new Set<string>();
  if (canManageNews || canManageWebsite) {
    accessibleFeatureKeys.add("news");
    accessibleFeatureKeys.add("media");
    accessibleFeatureKeys.add("publishing_queue");
    accessibleFeatureKeys.add("drafts");
    accessibleFeatureKeys.add("scheduled");
    accessibleFeatureKeys.add("review_workflow");
    accessibleFeatureKeys.add("four_eyes");
  }
  if (canManageWebsite) {
    accessibleFeatureKeys.add("pages");
    accessibleFeatureKeys.add("homepage_builder");
    accessibleFeatureKeys.add("navigation");
    accessibleFeatureKeys.add("blocks");
    accessibleFeatureKeys.add("redirects");
    accessibleFeatureKeys.add("approval_workflow");
    accessibleFeatureKeys.add("permissions");
    accessibleFeatureKeys.add("website_settings");
    accessibleFeatureKeys.add("seo");
    accessibleFeatureKeys.add("seo_global");
  }

  const hasUrgentItems = stats.publishing.pendingReview > 0;

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Übersicht" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website Management"
          title="CMS Übersicht"
          description="Redaktionelle Kontrolle für den Webauftritt. Inhalte erstellen, prüfen, planen und veröffentlichen."
          className="mb-0"
        />
        <PageActions>
          {canManageNews && (
            <Link href={CMS_ROUTES.newsNew} className="fca-button-secondary">
              <Newspaper className="h-4 w-4" />
              Neue News
            </Link>
          )}
          {canManageWebsite && (
            <Link href={CMS_ROUTES.pagesNew} className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neue Seite
            </Link>
          )}
        </PageActions>
      </div>

      {/* ── Status alerts ─────────────────────────────────────────────────────── */}
      {hasUrgentItems && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {stats.publishing.pendingReview}{" "}
              {stats.publishing.pendingReview === 1
                ? "Inhalt wartet"
                : "Inhalte warten"}{" "}
              auf Freigabe
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Im Publishing-Cockpit prüfen und freigeben.{" "}
              <Link
                href={CMS_ROUTES.publishing}
                className="font-semibold underline underline-offset-2"
              >
                Jetzt öffnen →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Website enabled indicator ─────────────────────────────────────────── */}
      {canManageWebsite && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border px-5 py-3 ${
            stats.websiteEnabled
              ? "border-emerald-200 bg-emerald-50"
              : "border-[var(--border)] bg-[var(--surface-2)]"
          }`}
        >
          {stats.websiteEnabled ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Globe className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          )}
          <p className="text-xs text-[var(--text-2)]">
            <span className="font-semibold">
              {stats.websiteEnabled
                ? "Website API ist aktiv"
                : "Website API ist deaktiviert"}
            </span>
            {stats.websiteEnabled
              ? " — Veröffentlichte Inhalte sind öffentlich abrufbar."
              : " — Kontaktiere den Plattform-Administrator."}
          </p>
          {stats.approvedDataOnly && (
            <>
              <span className="text-[var(--border)] mx-1">·</span>
              <span className="text-xs text-amber-700 font-medium">
                Vier-Augen-Prinzip aktiv
              </span>
            </>
          )}
        </div>
      )}

      {/* ── KPI Stats ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {canManageNews && (
          <>
            <CmsStatCard
              label="News total"
              value={stats.news.total}
              subLabel={`${stats.news.published} veröffentlicht`}
              href={CMS_ROUTES.news}
              icon={<Newspaper className="h-5 w-5" />}
              iconBg="rgba(59,130,246,0.10)"
              iconColor="#3B82F6"
            />
            <CmsStatCard
              label="News in Prüfung"
              value={stats.news.inReview}
              subLabel="Warten auf Freigabe"
              href={CMS_ROUTES.publishing}
              icon={<AlertCircle className="h-5 w-5" />}
              iconBg={stats.news.inReview > 0 ? "rgba(245,158,11,0.10)" : "rgba(16,185,129,0.10)"}
              iconColor={stats.news.inReview > 0 ? "#F59E0B" : "#10B981"}
              alert={stats.news.inReview > 0}
            />
          </>
        )}
        {canManageWebsite && (
          <>
            <CmsStatCard
              label="Seiten total"
              value={stats.pages.total}
              subLabel={`${stats.pages.published} veröffentlicht`}
              href={CMS_ROUTES.pages}
              icon={<FileText className="h-5 w-5" />}
              iconBg="rgba(139,92,246,0.10)"
              iconColor="#8B5CF6"
            />
            <CmsStatCard
              label="Seiten Entwürfe"
              value={stats.pages.draft}
              subLabel="In Bearbeitung"
              href={CMS_ROUTES.publishing}
              icon={<PenLine className="h-5 w-5" />}
              iconBg="rgba(107,114,128,0.10)"
              iconColor="#6B7280"
            />
          </>
        )}
        {(canManageNews || canManageWebsite) && (
          <>
            <CmsStatCard
              label="Geplante Inhalte"
              value={stats.publishing.scheduledTotal}
              subLabel="Terminiert"
              href={CMS_ROUTES.publishing}
              icon={<Clock className="h-5 w-5" />}
              iconBg="rgba(245,158,11,0.10)"
              iconColor="#F59E0B"
            />
            <CmsStatCard
              label="Medien"
              value={stats.media.total}
              subLabel="Assets in der Mediathek"
              href={CMS_ROUTES.media}
              icon={<ImageIcon className="h-5 w-5" />}
              iconBg="rgba(16,185,129,0.10)"
              iconColor="#10B981"
            />
          </>
        )}
      </div>

      {/* ── Quick Navigation ──────────────────────────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Schnellzugriff
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            Direkt zu den wichtigsten CMS-Bereichen navigieren.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">
          {[
            canManageNews && {
              href: CMS_ROUTES.news,
              icon: <Newspaper className="h-5 w-5" />,
              label: "News",
              sub: `${stats.news.total} Artikel`,
              color: "#3B82F6",
              bg: "rgba(59,130,246,0.08)",
            },
            canManageWebsite && {
              href: CMS_ROUTES.pages,
              icon: <FileText className="h-5 w-5" />,
              label: "Seiten",
              sub: `${stats.pages.total} Seiten`,
              color: "#8B5CF6",
              bg: "rgba(139,92,246,0.08)",
            },
            canManageWebsite && {
              href: CMS_ROUTES.homepage,
              icon: <LayoutTemplate className="h-5 w-5" />,
              label: "Homepage",
              sub: "Sektionen verwalten",
              color: "#8B5CF6",
              bg: "rgba(139,92,246,0.06)",
            },
            canManageWebsite && {
              href: CMS_ROUTES.blocks,
              icon: <Blocks className="h-5 w-5" />,
              label: "Block-Bibliothek",
              sub: `${BLOCK_REGISTRY.length} Block-Typen`,
              color: "#0EA5E9",
              bg: "rgba(14,165,233,0.08)",
            },
            (canManageNews || canManageWebsite) && {
              href: CMS_ROUTES.media,
              icon: <ImageIcon className="h-5 w-5" />,
              label: "Mediathek",
              sub: `${stats.media.total} Assets`,
              color: "#10B981",
              bg: "rgba(16,185,129,0.08)",
            },
            (canManageNews || canManageWebsite) && {
              href: CMS_ROUTES.publishing,
              icon: <Send className="h-5 w-5" />,
              label: "Publishing",
              sub:
                stats.publishing.pendingReview > 0
                  ? `${stats.publishing.pendingReview} ausstehend`
                  : "Aktuell",
              color: "#FF6A00",
              bg: "rgba(255,106,0,0.08)",
            },
            canManageWebsite && {
              href: CMS_ROUTES.settings,
              icon: <Settings className="h-5 w-5" />,
              label: "Einstellungen",
              sub: stats.approvedDataOnly ? "4-Augen aktiv" : "Standard",
              color: "#6B7280",
              bg: "rgba(107,114,128,0.08)",
            },
            {
              href: CMS_ROUTES.overview,
              icon: <Globe className="h-5 w-5" />,
              label: "Übersicht",
              sub: "CMS Hub",
              color: "#111827",
              bg: "rgba(17,24,39,0.05)",
            },
          ]
            .filter(Boolean)
            .map((item) => {
              if (!item) return null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col items-start gap-2.5 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: item.bg, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)] leading-tight">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.sub}</p>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>

      {/* ── CMS Architecture Sections ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-[var(--foreground)]">
          CMS Architektur
        </h2>
        <p className="text-sm text-[var(--text-2)]">
          Vollständige Übersicht aller CMS-Funktionsbereiche und deren Verfügbarkeit.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {CMS_SECTIONS.map((section) => (
          <CmsSectionCard
            key={section.key}
            section={section}
            accessibleFeatureKeys={accessibleFeatureKeys}
          />
        ))}
      </div>

      {/* ── Status Legend ─────────────────────────────────────────────────────── */}
      <CmsLegend />
    </PageShell>
  );
}
