"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { websitePublishRequiresReview } from "@/lib/website/governance";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function requireAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!(session.user.permissionKeys ?? []).includes(PERMISSIONS.WEBSITE_MANAGE)) {
    redirect("/dashboard/website?status=forbidden");
  }

  return session;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; error: string };

export async function saveBlockVersion(formData: FormData): Promise<SaveResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const pageId = String(formData.get("pageId") ?? "").trim();
  const blocksRaw = String(formData.get("blocksJson") ?? "").trim();
  const changeNote = String(formData.get("changeNote") ?? "").trim() || null;

  if (!pageId || !blocksRaw) return { ok: false, error: "Fehlende Pflichtfelder." };

  let blocksJson: unknown;
  try {
    blocksJson = JSON.parse(blocksRaw);
  } catch {
    return { ok: false, error: "Ungültiges Block-Format." };
  }

  if (!Array.isArray(blocksJson)) {
    return { ok: false, error: "Ungültiges Block-Format." };
  }

  // Verify page belongs to this tenant
  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status === "ARCHIVED") {
    return { ok: false, error: "Archivierte Seiten können nicht bearbeitet werden." };
  }

  // Next version number
  const maxVer = await prisma.websitePageVersion.aggregate({
    where: { pageId },
    _max: { version: true },
  });
  const nextVersion = (maxVer._max.version ?? 0) + 1;

  await prisma.websitePageVersion.create({
    data: {
      pageId,
      version: nextVersion,
      blocksJson: blocksJson as Prisma.InputJsonValue,
      changeNote,
      createdByUserId: actorUserId,
    },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");

  return { ok: true, version: nextVersion };
}

// ── Publish ──────────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; snapshotId: string }
  | { ok: false; requiresReview: true; error: string }
  | { ok: false; requiresReview: false; error: string };

export async function publishPage(formData: FormData): Promise<PublishResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const pageId = String(formData.get("pageId") ?? "").trim();
  if (!pageId) return { ok: false, requiresReview: false, error: "Keine Seiten-ID." };

  // Load page with site
  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: {
      id: true,
      slug: true,
      title: true,
      pageType: true,
      locale: true,
      status: true,
      templateKey: true,
      metaTitle: true,
      metaDescription: true,
      site: { select: { id: true, tenantKey: true } },
    },
  });

  if (!page) return { ok: false, requiresReview: false, error: "Seite nicht gefunden." };
  if (page.status === "ARCHIVED") {
    return { ok: false, requiresReview: false, error: "Archivierte Seiten können nicht publiziert werden." };
  }

  // Load latest version
  const latestVersion = await prisma.websitePageVersion.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, blocksJson: true },
  });

  if (!latestVersion) {
    return { ok: false, requiresReview: false, error: "Keine Version vorhanden. Speichere zuerst eine Entwurfsversion." };
  }

  // ── Governance check ──────────────────────────────────────────────────────
  const userRoles = await prisma.userRole.findMany({
    where: { userId: session.user.id ?? "" },
    select: { roleId: true },
  });

  let requiresReview: boolean | null = null;
  for (const { roleId } of userRoles) {
    const check = await websitePublishRequiresReview(roleId);
    if (check === false) { requiresReview = false; break; } // explicit direct manage
    if (check === true) requiresReview = true;
  }
  // null = no rules configured → allow direct publish

  if (requiresReview === true) {
    await prisma.websitePage.update({
      where: { id: pageId },
      data: { status: "REVIEW", reviewRequestedAt: new Date() },
    });
    revalidatePath(`/dashboard/website/pages/${pageId}`);
    revalidatePath("/dashboard/website");
    return {
      ok: false,
      requiresReview: true,
      error: "Dieser Verein erfordert eine Prüfung vor der Publikation. Seite wurde zur Prüfung eingereicht.",
    };
  }

  // ── Direct publish ────────────────────────────────────────────────────────
  const now = new Date();

  const snapshot = await prisma.$transaction(async (tx) => {
    const newSnapshot = await tx.websitePublishSnapshot.create({
      data: {
        siteId: page.site.id,
        pageId: page.id,
        tenantKey: page.site.tenantKey,
        slug: page.slug,
        locale: page.locale,
        pageType: page.pageType,
        title: page.title,
        blocksJson: latestVersion.blocksJson as Prisma.InputJsonValue,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        versionRef: latestVersion.version,
        publishedByUserId: actorUserId,
        publishedAt: now,
      },
      select: { id: true },
    });

    await tx.websitePage.update({
      where: { id: pageId },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedByUserId: actorUserId,
      },
    });

    return newSnapshot;
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  revalidatePath("/api/public/website/pages");
  revalidatePath("/api/public/website/page");

  return { ok: true, snapshotId: snapshot.id };
}

// ── Restore from snapshot ────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true; version: number }
  | { ok: false; error: string };

export async function restoreFromSnapshot(formData: FormData): Promise<RestoreResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const snapshotId = String(formData.get("snapshotId") ?? "").trim();
  if (!snapshotId) return { ok: false, error: "Keine Snapshot-ID." };

  // Load snapshot, verify it belongs to this tenant's site
  const snapshot = await prisma.websitePublishSnapshot.findFirst({
    where: { id: snapshotId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, pageId: true, blocksJson: true, versionRef: true },
  });

  if (!snapshot) return { ok: false, error: "Snapshot nicht gefunden." };

  const page = await prisma.websitePage.findFirst({
    where: { id: snapshot.pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };

  const maxVer = await prisma.websitePageVersion.aggregate({
    where: { pageId: page.id },
    _max: { version: true },
  });
  const nextVersion = (maxVer._max.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.websitePageVersion.create({
      data: {
        pageId: page.id,
        version: nextVersion,
        blocksJson: snapshot.blocksJson as Prisma.InputJsonValue,
        changeNote: `Wiederhergestellt aus Snapshot (Ref v${snapshot.versionRef ?? "?"})`,
        createdByUserId: actorUserId,
      },
    }),
    prisma.websitePage.update({
      where: { id: page.id },
      data: { status: "DRAFT" },
    }),
  ]);

  revalidatePath(`/dashboard/website/pages/${page.id}`);
  revalidatePath("/dashboard/website");

  return { ok: true, version: nextVersion };
}

// ── Submit for review ────────────────────────────────────────────────────────

export type ReviewResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitForReview(formData: FormData): Promise<ReviewResult> {
  const session = await requireAccess();
  const pageId = String(formData.get("pageId") ?? "").trim();
  const note = String(formData.get("reviewNote") ?? "").trim() || null;

  if (!pageId) return { ok: false, error: "Keine Seiten-ID." };

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status !== "DRAFT") {
    return { ok: false, error: "Nur Entwürfe können zur Prüfung eingereicht werden." };
  }

  const latestVersion = await prisma.websitePageVersion.findFirst({
    where: { pageId: page.id },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  if (!latestVersion) {
    return { ok: false, error: "Speichere zuerst eine Entwurfsversion." };
  }

  await prisma.websitePage.update({
    where: { id: page.id },
    data: {
      status: "REVIEW",
      reviewRequestedAt: new Date(),
      reviewNotes: note,
      reviewedByUserId: null,
      reviewedAt: null,
    },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  return { ok: true };
}

// ── Approve and publish ──────────────────────────────────────────────────────

export async function approveAndPublish(formData: FormData): Promise<PublishResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;
  const pageId = String(formData.get("pageId") ?? "").trim();

  if (!pageId) return { ok: false, requiresReview: false, error: "Keine Seiten-ID." };

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: {
      id: true, slug: true, title: true, pageType: true, locale: true,
      status: true, templateKey: true, metaTitle: true, metaDescription: true,
      site: { select: { id: true, tenantKey: true } },
    },
  });

  if (!page) return { ok: false, requiresReview: false, error: "Seite nicht gefunden." };
  if (page.status !== "REVIEW") {
    return { ok: false, requiresReview: false, error: "Nur Seiten in Prüfung können freigegeben werden." };
  }

  const latestVersion = await prisma.websitePageVersion.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, blocksJson: true },
  });

  if (!latestVersion) {
    return { ok: false, requiresReview: false, error: "Keine Version vorhanden." };
  }

  const now = new Date();
  const snapshot = await prisma.$transaction(async (tx) => {
    const newSnapshot = await tx.websitePublishSnapshot.create({
      data: {
        siteId: page.site.id,
        pageId: page.id,
        tenantKey: page.site.tenantKey,
        slug: page.slug,
        locale: page.locale,
        pageType: page.pageType,
        title: page.title,
        blocksJson: latestVersion.blocksJson as Prisma.InputJsonValue,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        versionRef: latestVersion.version,
        publishedByUserId: actorUserId,
        publishedAt: now,
      },
      select: { id: true },
    });

    await tx.websitePage.update({
      where: { id: pageId },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedByUserId: actorUserId,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
      },
    });

    return newSnapshot;
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  revalidatePath("/api/public/website/pages");
  revalidatePath("/api/public/website/page");

  return { ok: true, snapshotId: snapshot.id };
}

// ── Reject review ────────────────────────────────────────────────────────────

export async function rejectReview(formData: FormData): Promise<ReviewResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;
  const pageId = String(formData.get("pageId") ?? "").trim();
  const note = String(formData.get("rejectNote") ?? "").trim() || null;

  if (!pageId) return { ok: false, error: "Keine Seiten-ID." };

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status !== "REVIEW") {
    return { ok: false, error: "Nur Seiten in Prüfung können abgelehnt werden." };
  }

  await prisma.websitePage.update({
    where: { id: page.id },
    data: {
      status: "DRAFT",
      reviewedAt: new Date(),
      reviewedByUserId: actorUserId,
      reviewNotes: note,
    },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  return { ok: true };
}

// ── Unarchive page ────────────────────────────────────────────────────────────

export async function unarchivePage(formData: FormData): Promise<ReviewResult> {
  await requireAccess();

  const pageId = String(formData.get("pageId") ?? "").trim();
  if (!pageId) return { ok: false, error: "Keine Seiten-ID." };

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status !== "ARCHIVED") return { ok: true };

  await prisma.websitePage.update({
    where: { id: page.id },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  return { ok: true };
}

// ── Create locale variant ────────────────────────────────────────────────────

export async function createLocaleVariant(formData: FormData): Promise<void> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const sourcePageId = String(formData.get("sourcePageId") ?? "").trim();
  const targetLocale = String(formData.get("targetLocale") ?? "").trim();

  if (!sourcePageId || !targetLocale) return;

  const sourcePage = await prisma.websitePage.findFirst({
    where: { id: sourcePageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: {
      id: true, siteId: true, slug: true, title: true, locale: true,
      pageType: true, templateKey: true, sortOrder: true,
    },
  });

  if (!sourcePage) return;

  // Duplicate guard
  const existing = await prisma.websitePage.findUnique({
    where: { siteId_slug_locale: { siteId: sourcePage.siteId, slug: sourcePage.slug, locale: targetLocale } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/dashboard/website/pages/${existing.id}`);
  }

  const latestVersion = await prisma.websitePageVersion.findFirst({
    where: { pageId: sourcePageId },
    orderBy: { version: "desc" },
    select: { blocksJson: true },
  });

  const newPage = await prisma.$transaction(async (tx) => {
    const page = await tx.websitePage.create({
      data: {
        siteId: sourcePage.siteId,
        slug: sourcePage.slug,
        title: sourcePage.title,
        pageType: sourcePage.pageType,
        templateKey: sourcePage.templateKey,
        locale: targetLocale,
        status: "DRAFT",
        sortOrder: sourcePage.sortOrder,
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });

    if (latestVersion) {
      await tx.websitePageVersion.create({
        data: {
          pageId: page.id,
          version: 1,
          blocksJson: latestVersion.blocksJson as Prisma.InputJsonValue,
          changeNote: `Sprachversion aus «${sourcePage.locale ?? ""}» kopiert`,
          createdByUserId: actorUserId,
        },
      });
    }

    return page;
  });

  revalidatePath("/dashboard/website");
  redirect(`/dashboard/website/pages/${newPage.id}`);
}

// ── Archive page ─────────────────────────────────────────────────────────────

export async function archivePage(formData: FormData): Promise<ReviewResult> {
  await requireAccess();

  const pageId = String(formData.get("pageId") ?? "").trim();
  if (!pageId) return { ok: false, error: "Keine Seiten-ID." };

  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status === "ARCHIVED") return { ok: true };

  await prisma.websitePage.update({
    where: { id: page.id },
    data: { status: "ARCHIVED" },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");
  return { ok: true };
}
