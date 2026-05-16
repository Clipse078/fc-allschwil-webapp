import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Globe,
  Info,
  LayoutTemplate,
  Lightbulb,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  TEMPLATE_CATALOG,
  PAGE_TYPE_LABELS,
} from "@/lib/website/template-catalog";
import type { WebsitePageStatus } from "@prisma/client";

// Derive the site key from environment — never hardcoded.
const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function getSiteWithPages() {
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: {
      id: true,
      name: true,
      locale: true,
      isActive: true,
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
        },
      },
    },
  });

  return site;
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

export default async function WebsitePage() {
  await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const site = await getSiteWithPages();
  const publishedCount = site?.pages.filter((p) => p.status === "PUBLISHED").length ?? 0;
  const draftCount = site?.pages.filter((p) => p.status === "DRAFT").length ?? 0;
  const reviewCount = site?.pages.filter((p) => p.status === "REVIEW").length ?? 0;

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
            Site: {site.name} · Sprache: {site.locale.toUpperCase()}
          </p>
        )}
      </section>

      {/* Governance note */}
      <div className="flex items-start gap-3 rounded-[20px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4aa2]" />
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-[#0b4aa2]">Prüf-Workflow:</span>{" "}
          Standardmässig können berechtigte Benutzer direkt publizieren. Der
          Vier-Augen-Prüf-Workflow kann später in den{" "}
          <span className="font-semibold">Admin-Einstellungen</span> pro Rolle und
          Seitentyp aktiviert werden.
        </p>
      </div>

      {!site ? (
        /* No site configured */
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <Globe className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Noch keine Website konfiguriert
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Richte deine Website ein um Seiten zu erstellen, Inhalte zu verwalten und
            zu publizieren.
          </p>
          <p className="mt-4 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Website-Konfiguration wird in einer kommenden Version über Admin-Einstellungen
            eingerichtet. Tenant-Key:{" "}
            <span className="font-mono font-semibold">{SITE_TENANT_KEY}</span>
          </p>
        </section>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Publiziert", count: publishedCount, style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "Entwürfe", count: draftCount, style: "border-slate-200 bg-slate-50 text-slate-600" },
              { label: "In Prüfung", count: reviewCount, style: "border-amber-200 bg-amber-50 text-amber-700" },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-[20px] border p-4 ${s.style}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                  {s.label}
                </p>
                <p className="mt-1 text-[2rem] font-bold leading-none">{s.count}</p>
              </div>
            ))}
          </div>

          {/* Pages list */}
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[1.05rem] font-semibold text-slate-900">
                Seiten
              </h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {site.pages.length} Seiten
              </span>
            </div>

            {site.pages.length === 0 ? (
              <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-5 text-center">
                <FileText className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  Noch keine Seiten erstellt. Wähle eine Vorlage aus dem Katalog.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {site.pages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between gap-4 rounded-[16px] border border-slate-200/80 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {page.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        /{page.slug} · {PAGE_TYPE_LABELS[page.pageType]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {page.publishedAt && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[page.status]}`}
                      >
                        {STATUS_LABELS[page.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Smart suggestions */}
          {publishedCount === 0 && (
            <div className="flex items-start gap-3 rounded-[20px] border border-amber-100 bg-amber-50/70 px-5 py-4">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Noch keine Seite publiziert.</span>{" "}
                Erstelle zuerst eine Homepage aus dem Vorlagenkatalog, fülle die
                Blöcke aus und publiziere den Snapshot.
              </p>
            </div>
          )}
        </>
      )}

      {/* Template catalog */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Seitenvorlagen
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Block-basierte Vorlagen · Alle Sportarten · Tenant-konfigurierbar
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATE_CATALOG.map((tpl) => (
            <div
              key={tpl.key}
              className="rounded-[18px] border border-slate-200/80 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {tpl.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {tpl.description}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.suggestedBlocks.slice(0, 4).map((b) => (
                  <span
                    key={b.type}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    {b.type}
                  </span>
                ))}
                {tpl.suggestedBlocks.length > 4 && (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-400">
                    +{tpl.suggestedBlocks.length - 4}
                  </span>
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Seite-Erstellung wird in der nächsten Version freigeschaltet.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Public API hint */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Öffentliche API
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Nur publizierte Snapshots werden ausgespielt. Entwürfe und Review-Versionen
          bleiben privat.
        </p>
        <div className="mt-3 space-y-2">
          {[
            { label: "Alle publizierten Seiten", path: `/api/public/website/pages?tenantKey=${SITE_TENANT_KEY}` },
            { label: "Einzelne Seite (Slug + Locale)", path: `/api/public/website/page?tenantKey=${SITE_TENANT_KEY}&slug=home&locale=de` },
          ].map((ep) => (
            <div
              key={ep.path}
              className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-2.5"
            >
              <p className="text-[11px] font-semibold text-slate-600">{ep.label}</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">{ep.path}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
