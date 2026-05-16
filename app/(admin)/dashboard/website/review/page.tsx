import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Info } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { PAGE_TYPE_LABELS } from "@/lib/website/template-catalog";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function getReviewPages() {
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: { id: true, name: true },
  });

  if (!site) return { site: null, pages: [] };

  const pages = await prisma.websitePage.findMany({
    where: { siteId: site.id, status: "REVIEW" },
    orderBy: { reviewRequestedAt: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      locale: true,
      pageType: true,
      reviewRequestedAt: true,
      reviewNotes: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, createdAt: true, changeNote: true },
      },
    },
  });

  return { site, pages };
}

function formatDate(d: Date | null) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function elapsed(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  return `vor ${Math.floor(hrs / 24)} Tagen`;
}

export default async function WebsiteReviewPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const { site, pages } = await getReviewPages();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/website"
          className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Website
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Prüfungs-Inbox</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Seiten die auf Freigabe warten{site ? ` · ${site.name}` : ""}
          </p>
        </div>
      </div>

      {/* Governance note */}
      <div className="flex items-start gap-3 rounded-[18px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
        <p className="text-[12px] text-slate-600">
          <span className="font-semibold text-[#0b4aa2]">Vier-Augen-Prinzip.</span>{" "}
          Zur Prüfung eingereichte Seiten werden hier gelistet. Freigabe publiziert
          den Snapshot. Ablehnung setzt die Seite zurück in Entwurf.
        </p>
      </div>

      {!site ? (
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
          Keine Website konfiguriert.
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 text-base font-semibold text-slate-900">
            Keine ausstehenden Prüfungen
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Alle Seiten sind freigegeben oder befinden sich noch im Entwurf.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700">
              {pages.length} {pages.length === 1 ? "Seite" : "Seiten"} warten
            </span>
          </div>

          <div className="space-y-3">
            {pages.map((page) => {
              const latestVersion = page.versions[0] ?? null;
              return (
                <Link
                  key={page.id}
                  href={`/dashboard/website/pages/${page.id}`}
                  className="group block rounded-[24px] border border-amber-100 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900 group-hover:text-[#0b4aa2]">
                          {page.title}
                        </p>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          In Prüfung
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          {PAGE_TYPE_LABELS[page.pageType]}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                          {page.locale.toUpperCase()}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-400">/{page.slug}</p>

                      {page.reviewNotes && (
                        <div className="mt-3 rounded-[10px] border border-amber-100 bg-amber-50/60 px-3 py-2">
                          <p className="text-[11px] italic text-amber-800">
                            „{page.reviewNotes}"
                          </p>
                        </div>
                      )}

                      {latestVersion && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Version {latestVersion.version}
                          {latestVersion.changeNote
                            ? ` · ${latestVersion.changeNote}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {page.reviewRequestedAt && (
                        <>
                          <div className="flex items-center gap-1 text-[11px] text-amber-600">
                            <Clock className="h-3 w-3" />
                            {elapsed(page.reviewRequestedAt)}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {formatDate(page.reviewRequestedAt)}
                          </p>
                        </>
                      )}
                      <span className="mt-1 rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2] opacity-0 transition-opacity group-hover:opacity-100">
                        Prüfen →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
