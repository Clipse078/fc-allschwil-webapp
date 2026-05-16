import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { PAGE_TYPE_LABELS } from "@/lib/website/template-catalog";
import { BLOCK_CATALOG } from "@/lib/website/block-catalog";
import BlockEditor from "@/components/admin/website/BlockEditor";
import PublishButton from "@/components/admin/website/PublishButton";
import RestoreSnapshotButton from "@/components/admin/website/RestoreSnapshotButton";
import ArchivePageButton from "@/components/admin/website/ArchivePageButton";
import {
  ReviewApprovalPanel,
  SubmitForReviewButton,
} from "@/components/admin/website/ReviewActionsPanel";
import { auth } from "@/auth";
import { websitePublishRequiresReview } from "@/lib/website/governance";
import type { WebsitePageStatus } from "@prisma/client";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

type Props = { params: Promise<{ pageId: string }> };

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

type BlockShape = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
};

function parseBlocks(raw: unknown): BlockShape[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is BlockShape =>
        b !== null &&
        typeof b === "object" &&
        typeof (b as BlockShape).type === "string",
    )
    .map((b, i) => ({
      id: (b as BlockShape).id ?? `block-${i + 1}`,
      type: (b as BlockShape).type,
      props:
        typeof (b as BlockShape).props === "object" && (b as BlockShape).props !== null
          ? (b as BlockShape).props
          : {},
      sortOrder: typeof (b as BlockShape).sortOrder === "number" ? (b as BlockShape).sortOrder : i + 1,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export default async function PageEditRoute({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const { pageId } = await params;

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: {
      id: true,
      title: true,
      slug: true,
      pageType: true,
      locale: true,
      status: true,
      isVisible: true,
      templateKey: true,
      publishedAt: true,
      site: { select: { name: true, tenantKey: true } },
    },
  });

  if (!page) notFound();

  const latestVersion = await prisma.websitePageVersion.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, blocksJson: true, changeNote: true, createdAt: true },
  });

  // Detect newer draft changes after last publish
  const hasNewerDraft =
    page.publishedAt !== null &&
    latestVersion !== null &&
    latestVersion.createdAt > page.publishedAt;

  // Snapshot history
  const snapshots = await prisma.websitePublishSnapshot.findMany({
    where: { pageId },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: { id: true, versionRef: true, publishedAt: true, publishedByUserId: true },
  });

  const publisherIds = [...new Set(snapshots.map((s) => s.publishedByUserId).filter(Boolean))] as string[];
  const publishers =
    publisherIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: publisherIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const publisherMap = new Map(publishers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  // Governance: check if current user's roles require review
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  });
  let requiresReview: boolean | null = null;
  for (const { roleId } of userRoles) {
    const check = await websitePublishRequiresReview(roleId);
    if (check === false) { requiresReview = false; break; }
    if (check === true) requiresReview = true;
  }

  const blocks = parseBlocks(latestVersion?.blocksJson ?? []);
  const version = latestVersion?.version ?? 0;

  // Build label map for block types
  const blockLabels = Object.fromEntries(
    BLOCK_CATALOG.map((b) => [b.type, b.label]),
  );

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link
          href="/dashboard/website"
          className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Website
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{page.title}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[page.status]}`}
            >
              {STATUS_LABELS[page.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            /{page.slug} · {PAGE_TYPE_LABELS[page.pageType]} ·{" "}
            {page.locale.toUpperCase()} · Version {version}
          </p>
        </div>
        {page.status !== "ARCHIVED" && (
          <ArchivePageButton
            pageId={page.id}
            isPublished={page.status === "PUBLISHED"}
          />
        )}
      </div>

      {/* Guidance */}
      <div className="flex items-start gap-3 rounded-[18px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
        <p className="text-[12px] text-slate-600">
          <span className="font-semibold text-[#0b4aa2]">Inhalte sicher bearbeiten.</span>{" "}
          Jede Speicherung erstellt eine neue Version. Die Publikation erfolgt
          separat und schreibt den öffentlichen Snapshot.
        </p>
      </div>

      {/* Newer draft warning */}
      {hasNewerDraft && (
        <div className="flex items-start gap-2.5 rounded-[16px] border border-amber-100 bg-amber-50/70 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[12px] text-amber-800">
            Diese Seite enthält neuere Entwurfsänderungen, die noch nicht
            publiziert sind. Publiziere erneut um den Snapshot zu aktualisieren.
          </p>
        </div>
      )}

      {/* Workflow panel */}
      {page.status !== "ARCHIVED" && (
        <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
          <div className="mb-1 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1rem] font-semibold text-slate-900">
                {page.status === "REVIEW" ? "Prüfung" : "Publizieren"}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Review ist optional und per Verein konfigurierbar. Wenn aktiviert,
                prüfen Reviewer vor der Publikation.
              </p>
            </div>
          </div>

          {!latestVersion ? (
            <div className="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
              Noch keine Version gespeichert.{" "}
              <span className="font-semibold">Bearbeite die Blöcke</span> und
              speichere eine Entwurfsversion.
            </div>
          ) : page.status === "REVIEW" ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-[12px] border border-amber-100 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
                Diese Seite wartet auf Prüfung und Freigabe.
              </div>
              <ReviewApprovalPanel pageId={page.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {requiresReview === true ? (
                <>
                  <p className="text-[12px] text-slate-500">
                    Dieser Verein erfordert eine Prüfung vor der Publikation.
                  </p>
                  <SubmitForReviewButton pageId={page.id} />
                </>
              ) : (
                <>
                  <PublishButton
                    pageId={page.id}
                    isAlreadyPublished={page.status === "PUBLISHED"}
                  />
                  <details className="group">
                    <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                      Optional: Zur Prüfung einreichen
                    </summary>
                    <div className="mt-2">
                      <SubmitForReviewButton pageId={page.id} />
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {page.status === "ARCHIVED" && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Diese Seite ist archiviert und kann nicht bearbeitet werden.
        </div>
      )}

      {/* Block editor */}
      {page.status !== "ARCHIVED" && (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[1.05rem] font-semibold text-slate-900">
              Blöcke bearbeiten
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              {blocks.length} Blöcke
            </span>
          </div>

          <BlockEditor
            pageId={page.id}
            initialBlocks={blocks}
            blockLabels={blockLabels}
            currentVersion={version}
          />
        </div>
      )}

      {/* Version info */}
      {latestVersion && (
        <div className="rounded-[16px] border border-slate-200/80 bg-slate-50 px-4 py-3">
          <p className="text-[11px] text-slate-400">
            Letzte Version: <span className="font-semibold text-slate-600">v{latestVersion.version}</span>
            {latestVersion.changeNote ? ` · ${latestVersion.changeNote}` : ""}
            {" · "}
            {new Intl.DateTimeFormat("de-CH", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(latestVersion.createdAt)}
          </p>
        </div>
      )}

      {/* Snapshot history */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.05rem] font-semibold text-slate-900">
            Snapshot-Historie
          </h2>
          {snapshots.length > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              {snapshots.length}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">
            Publizierte Snapshots sind sichere Prüfpunkte. Entwurfsversionen bleiben
            jederzeit editierbar.
          </p>
        </div>

        {snapshots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Noch keine Snapshots publiziert. Drücke «Publizieren» um den ersten
            öffentlichen Checkpoint zu erstellen.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {snapshots.map((snap, i) => (
                <div
                key={snap.id}
                className="rounded-[14px] border border-slate-200/80 bg-slate-50 px-4 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Aktuell live
                      </span>
                    )}
                    {snap.versionRef !== null && (
                      <span className="text-[11px] text-slate-500">v{snap.versionRef}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-600">
                        {new Intl.DateTimeFormat("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(snap.publishedAt)}
                      </p>
                      {snap.publishedByUserId && publisherMap.has(snap.publishedByUserId) && (
                        <p className="text-[10px] text-slate-400">
                          {publisherMap.get(snap.publishedByUserId)}
                        </p>
                      )}
                    </div>
                    <RestoreSnapshotButton snapshotId={snap.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
