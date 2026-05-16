import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Info,
  LayoutTemplate,
  Lightbulb,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATE_CATALOG, PAGE_TYPE_LABELS } from "@/lib/website/template-catalog";
import { getCreatePageFeedback } from "@/lib/website/create-page-helpers";
import CreatePageForm from "@/components/admin/website/CreatePageForm";
import ArchivePageButton from "@/components/admin/website/ArchivePageButton";
import PresetPreviewCard from "@/components/admin/website/PresetPreviewCard";
import { getWebsitePresetByKey } from "@/lib/website/website-preset-catalog";
import { getInfoboardPresetByKey, INFOBOARD_MODE_LABELS } from "@/lib/infoboard/infoboard-preset-catalog";
import type { WebsitePageStatus } from "@prisma/client";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    created?: string;
    slug?: string;
  }>;
};

async function getSiteWithPages() {
  return prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: {
      id: true,
      name: true,
      locale: true,
      isActive: true,
      settingsJson: true,
      pages: {
        orderBy: [{ sortOrder: "asc" }, { pageType: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          pageType: true,
          status: true,
          isVisible: true,
          publishedAt: true,
          updatedAt: true,
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true, createdAt: true, blocksJson: true },
          },
        },
      },
    },
  });
}

const STATUS_STYLES: Record<WebsitePageStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-600",
};

const STATUS_LABELS: Record<WebsitePageStatus, string> = {
  DRAFT: "Entwurf",
  REVIEW: "In Prüfung",
  PUBLISHED: "Publiziert",
  ARCHIVED: "Archiviert",
};

export default async function WebsiteDashboardPage({ searchParams }: PageProps) {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE, PERMISSIONS.EVENTS_MANAGE]);

  const params = (await searchParams) ?? {};
  const feedback = getCreatePageFeedback(params.status, params.created, params.slug);

  const site = await getSiteWithPages();
  const pages = site?.pages ?? [];
  const locale = site?.locale ?? "de";

  type SiteSettings = {
    websitePresetKey?: string | null;
    infoboardPresetKey?: string | null;
    infoboardMode?: string | null;
  };
  const sj = (site?.settingsJson ?? {}) as SiteSettings;
  const activeWebsitePreset = sj.websitePresetKey ? getWebsitePresetByKey(sj.websitePresetKey) : null;
  const activeInfoboardPreset = sj.infoboardPresetKey ? getInfoboardPresetByKey(sj.infoboardPresetKey) : null;

  const publishedCount = pages.filter((p) => p.status === "PUBLISHED").length;
  const draftCount = pages.filter((p) => p.status === "DRAFT").length;
  const reviewCount = pages.filter((p) => p.status === "REVIEW").length;

  const justCreated = feedback?.kind === "success"
    ? pages.find((p) => p.id === feedback.pageId)
    : null;

  return (
    <div className="space-y-7">
      {/* Header */}
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Website Builder</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Website Verwaltung
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Block-basierter Website-Builder. Erstelle Seiten aus Vorlagen, verwalte
          Entwürfe und publiziere Snapshots für den öffentlichen Website-Feed.
        </p>
        {site && (
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Site: {site.name} · Sprache: {locale.toUpperCase()}
          </p>
        )}
      </section>

      {/* Feedback */}
      {feedback?.kind === "success" && (
        <div className="flex items-center gap-2 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">
            Seite{justCreated ? ` «${justCreated.title}»` : ""} erfolgreich als
            Entwurf erstellt.
          </p>
        </div>
      )}
      {feedback?.kind === "forbidden" && (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Keine Berechtigung für Website-Verwaltung.
        </div>
      )}

      {/* Active presets */}
      {(activeWebsitePreset || activeInfoboardPreset) && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[1.05rem] font-semibold text-slate-900">
                Aktive Presets
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Presets sind ein Ausgangspunkt. Redakteure können Seiten und Blöcke jederzeit anpassen.
              </p>
            </div>
            <Link
              href="/dashboard/website/settings"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Einstellungen
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {activeWebsitePreset && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Website Preset
                </p>
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0">
                    <PresetPreviewCard preset={activeWebsitePreset} compact />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {activeWebsitePreset.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {activeWebsitePreset.visualTone}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {activeWebsitePreset.audienceClubType}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeInfoboardPreset && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Infoboard Preset
                </p>
                <div className="rounded-[14px] border border-slate-200/80 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {activeInfoboardPreset.name}
                    </p>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {INFOBOARD_MODE_LABELS[activeInfoboardPreset.mode]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {activeInfoboardPreset.bestUseCase}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recommended pages checklist */}
      {activeWebsitePreset && site && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          {(() => {
            const existing = new Set(pages.map((p) => p.pageType as string));
            const recommended = activeWebsitePreset.recommendedPages;
            const created = recommended.filter((r) => existing.has(r));
            const missing = recommended.filter((r) => !existing.has(r));
            const pct = Math.round((created.length / recommended.length) * 100);
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[1.05rem] font-semibold text-slate-900">
                      Empfohlene Seiten
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {created.length} von {recommended.length} empfohlenen Seiten für «{activeWebsitePreset.name}» erstellt
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    pct === 100 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : pct >= 60 ? "border-[#0b4aa2]/20 bg-[#0b4aa2]/5 text-[#0b4aa2]"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}>
                    {pct}%
                  </span>
                </div>

                <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-[#0b4aa2]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {missing.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Noch nicht erstellt:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missing.map((pt) => (
                        <span
                          key={pt}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500"
                        >
                          {PAGE_TYPE_LABELS[pt as keyof typeof PAGE_TYPE_LABELS] ?? pt}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Erstelle diese Seiten zuerst um das Preset vollständig zu nutzen.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* No preset selected hint */}
      {site && !activeWebsitePreset && (
        <div className="flex items-start justify-between gap-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p className="text-[12px] text-slate-500">
              Kein Website-Preset aktiv. Wähle ein Preset in den{" "}
              <Link href="/dashboard/website/settings" className="font-semibold text-[#0b4aa2] underline">
                Einstellungen
              </Link>{" "}
              um Struktur und visuellen Rhythmus festzulegen.
            </p>
          </div>
        </div>
      )}

      {/* Governance note */}
      <div className="flex items-start gap-3 rounded-[20px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4aa2]" />
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-[#0b4aa2]">Prüf-Workflow:</span>{" "}
          Berechtigte Benutzer können direkt publizieren. Der Vier-Augen-Workflow
          kann später in den{" "}
          <span className="font-semibold">Admin-Einstellungen</span> pro Rolle und
          Seitentyp aktiviert werden.
        </p>
      </div>

      {/* Stats (only if site + pages exist) */}
      {site && pages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Publiziert", count: publishedCount, style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
            { label: "Entwürfe", count: draftCount, style: "border-slate-200 bg-slate-50 text-slate-600" },
            { label: "In Prüfung", count: reviewCount, style: "border-amber-200 bg-amber-50 text-amber-700" },
          ].map((s) => (
            <div key={s.label} className={`rounded-[20px] border p-4 ${s.style}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                {s.label}
              </p>
              <p className="mt-1 text-[2rem] font-bold leading-none">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        {/* Left: Create form */}
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-[#0b4aa2]" />
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Neue Seite erstellen
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Vorlage wählen · Entwurf speichern · Später publizieren
          </p>
          <div className="mt-5">
            <CreatePageForm
              templates={TEMPLATE_CATALOG}
              defaultLocale={locale}
              hasDuplicateError={feedback?.kind === "duplicate"}
              duplicateSlug={feedback?.kind === "duplicate" ? feedback.slug : undefined}
            />
          </div>
        </section>

        {/* Right: Pages list */}
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">Seiten</h3>
            {pages.length > 0 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {pages.length}
              </span>
            )}
          </div>

          {pages.length === 0 ? (
            <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-5 text-center">
              <FileText className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                Noch keine Seiten. Erstelle deine erste Seite mit einer Vorlage.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {pages.map((page) => {
                const latestVer = page.versions[0] ?? null;
                const blockCount = Array.isArray(latestVer?.blocksJson)
                  ? (latestVer.blocksJson as unknown[]).length
                  : null;
                return (
                  <div
                    key={page.id}
                    className={`rounded-[16px] border px-4 py-3 transition ${
                      justCreated?.id === page.id
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200/80 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/dashboard/website/pages/${page.id}`}
                        className="group min-w-0 flex-1"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-[#0b4aa2]">
                          {page.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          /{page.slug} · {PAGE_TYPE_LABELS[page.pageType]}
                          {blockCount !== null ? ` · ${blockCount} Blöcke` : ""}
                          {latestVer ? ` · v${latestVer.version}` : ""}
                        </p>
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        {page.publishedAt && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[page.status]}`}
                        >
                          {STATUS_LABELS[page.status]}
                        </span>
                        {page.status !== "ARCHIVED" && (
                          <ArchivePageButton
                            pageId={page.id}
                            isPublished={page.publishedAt !== null}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {publishedCount === 0 && pages.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-amber-100 bg-amber-50/70 px-3 py-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[11px] text-amber-800">
                Noch keine Seite publiziert. Publiziere einen Snapshot damit externe
                Websites die Seite abrufen können.
              </p>
            </div>
          )}

          {/* API hint */}
          <div className="mt-4 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Öffentliche API
            </p>
            <p className="font-mono text-[11px] text-slate-400">
              /api/public/website/pages?tenantKey={SITE_TENANT_KEY}
            </p>
          </div>
        </section>
      </div>

      {/* SmartSuggestions */}
      <div className="space-y-2">
        {/* Review inbox */}
        {reviewCount > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-[18px] border border-amber-200 bg-amber-50/80 px-4 py-3">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">
                  {reviewCount} {reviewCount === 1 ? "Seite wartet" : "Seiten warten"} auf Prüfung.
                </span>
              </p>
            </div>
            <Link
              href="/dashboard/website/review"
              className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              Zur Prüfungs-Inbox
            </Link>
          </div>
        )}

        {/* Unpublished pages */}
        {site && pages.length > 0 && publishedCount === 0 && (
          <div className="flex items-start gap-3 rounded-[18px] border border-amber-100 bg-amber-50/70 px-4 py-3">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-[12px] text-amber-800">
              <span className="font-semibold">Noch keine Seite publiziert.</span>{" "}
              Öffne eine Seite und klicke auf «Publizieren» um den ersten
              öffentlichen Snapshot zu erstellen.
            </p>
          </div>
        )}

        {/* Public API ready */}
        {publishedCount > 0 && (
          <div className="flex items-start gap-3 rounded-[18px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <p className="text-[12px] text-emerald-800">
              <span className="font-semibold">Öffentliche API aktiv.</span>{" "}
              Externe Websites können Seiten unter{" "}
              <span className="font-mono">
                /api/public/website/pages?tenantKey={SITE_TENANT_KEY}
              </span>{" "}
              abrufen.
            </p>
          </div>
        )}

        {/* Templates unused */}
        {site && pages.length < 3 && TEMPLATE_CATALOG.length > pages.length && (
          <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p className="text-[12px] text-slate-500">
              {TEMPLATE_CATALOG.length - pages.length} Seitenvorlagen noch nicht
              genutzt. Erstelle weitere Seiten für einen vollständigen Webauftritt.
            </p>
          </div>
        )}

        {/* Review workflow */}
        <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="text-[12px] text-slate-500">
            <span className="font-semibold">Prüf-Workflow:</span>{" "}
            Vier-Augen-Kontrolle kann später in den Admin-Einstellungen pro Rolle
            und Seitentyp aktiviert werden.
          </p>
        </div>
      </div>
    </div>
  );
}
