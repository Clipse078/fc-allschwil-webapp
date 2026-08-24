/**
 * lib/infoboard/queries.ts
 *
 * Database query layer for the Infoboard V2 module.
 *
 * Design constraints:
 *   - All queries are scoped by tenantId (tenant isolation).
 *   - No auth logic; callers are responsible for permission checks.
 *   - No slug mutation — slugs are set at creation and never changed.
 *   - Delete is permanent (no soft-delete / archive requirement).
 *   - Duplicate creates a new identity with a new slug; runtime state is
 *     not copied.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  InboardRow,
  InfoboardListItem,
  CreateInfoboardInput,
  UpdateInfoboardInput,
} from "./types";
import { generateInfoboardSlug, ensureUniqueSlug } from "./slug";

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * Returns all Infoboards for a tenant, ordered by sortOrder then createdAt.
 */
export async function listInfoboards(
  tenantId: string,
): Promise<InfoboardListItem[]> {
  return prisma.infoboard.findMany({
    where: { tenantId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      slug: true,
      status: true,
      templateType: true,
      displayTheme: true,
      headerSubtitleEnabled: true,
      announcementEnabled: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      anlageplanJson: true,
      anlageplanBackgroundUrl: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  }) as unknown as Promise<InfoboardListItem[]>;
}

// ── Get one ───────────────────────────────────────────────────────────────────

/**
 * Returns a single Infoboard by id, scoped to the tenant.
 * Returns null if not found or tenant mismatch.
 */
export async function getInfoboard(
  id: string,
  tenantId: string,
): Promise<InboardRow | null> {
  return prisma.infoboard.findFirst({
    where: { id, tenantId },
  }) as unknown as Promise<InboardRow | null>;
}

/**
 * Returns a single Infoboard by slug, scoped to the tenant.
 * Returns null if not found or tenant mismatch.
 */
export async function getInfoboardBySlug(
  slug: string,
  tenantId: string,
): Promise<InboardRow | null> {
  return prisma.infoboard.findFirst({
    where: { slug, tenantId },
  }) as unknown as Promise<InboardRow | null>;
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a new Infoboard for the tenant.
 *
 * The slug is validated to be unique for this tenant. If the provided
 * slug is already taken, a counter suffix is appended.
 */
export async function createInfoboard(
  input: CreateInfoboardInput,
): Promise<InboardRow> {
  const existing = await listInfoboards(input.tenantId);
  const existingSlugs = new Set(existing.map((b) => b.slug));
  const uniqueSlug = ensureUniqueSlug(input.slug, existingSlugs);

  const nextSortOrder =
    input.sortOrder ??
    (existing.length > 0
      ? Math.max(...existing.map((b) => b.sortOrder)) + 1
      : 0);

  return prisma.infoboard.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug: uniqueSlug,
      templateType: input.templateType ?? "TAGESUEBERSICHT",
      sortOrder: nextSortOrder,
    },
  }) as unknown as Promise<InboardRow>;
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Updates fields on an existing Infoboard.
 *
 * Only the fields present in `input` are updated.
 * The slug field is intentionally excluded — slugs never change.
 */
export async function updateInfoboard(
  id: string,
  tenantId: string,
  input: UpdateInfoboardInput,
): Promise<InboardRow | null> {
  const existing = await getInfoboard(id, tenantId);
  if (!existing) return null;

  return prisma.infoboard.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.templateType !== undefined && {
        templateType: input.templateType,
      }),
      ...(input.displayTheme !== undefined && {
        displayTheme: input.displayTheme,
      }),
      ...(input.headerSubtitleEnabled !== undefined && {
        headerSubtitleEnabled: input.headerSubtitleEnabled,
      }),
      ...(input.headerSubtitleText !== undefined && {
        headerSubtitleText: input.headerSubtitleText,
      }),
      ...(input.headerShowTime !== undefined && {
        headerShowTime: input.headerShowTime,
      }),
      ...(input.headerShowDate !== undefined && {
        headerShowDate: input.headerShowDate,
      }),
      ...(input.headerShowWeather !== undefined && {
        headerShowWeather: input.headerShowWeather,
      }),
      ...(input.announcementEnabled !== undefined && {
        announcementEnabled: input.announcementEnabled,
      }),
      ...(input.announcementText !== undefined && {
        announcementText: input.announcementText,
      }),
      ...(input.announcementBgColor !== undefined && {
        announcementBgColor: input.announcementBgColor,
      }),
      ...(input.announcementTextColor !== undefined && {
        announcementTextColor: input.announcementTextColor,
      }),
      ...(input.layoutJson !== undefined && {
        layoutJson: input.layoutJson,
      }),
      ...(input.anlageplanBackgroundUrl !== undefined && {
        anlageplanBackgroundUrl: input.anlageplanBackgroundUrl,
      }),
      ...(input.anlageplanJson !== undefined && {
        anlageplanJson: input.anlageplanJson,
      }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.screen1TrainingShowLogos !== undefined && {
        screen1TrainingShowLogos: input.screen1TrainingShowLogos,
      }),
      ...(input.screen1TrainingLogoSize !== undefined && {
        screen1TrainingLogoSize: input.screen1TrainingLogoSize,
      }),
      ...(input.screen1MatchShowLogos !== undefined && {
        screen1MatchShowLogos: input.screen1MatchShowLogos,
      }),
      ...(input.screen1MatchLogoSize !== undefined && {
        screen1MatchLogoSize: input.screen1MatchLogoSize,
      }),
      ...(input.screen1TournamentShowLogos !== undefined && {
        screen1TournamentShowLogos: input.screen1TournamentShowLogos,
      }),
      ...(input.screen1TournamentLogoSize !== undefined && {
        screen1TournamentLogoSize: input.screen1TournamentLogoSize,
      }),
    },
  }) as unknown as Promise<InboardRow>;
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

/**
 * Duplicates an Infoboard's configuration into a new Infoboard.
 *
 * The new Infoboard gets:
 *   - a new cuid id
 *   - name: "Kopie von <original name>"
 *   - slug: derived from the new name, guaranteed unique
 *   - status: DRAFT (not immediately active)
 *   - all configuration fields from the original
 *
 * Runtime identity (device state, connection history, etc.) is NOT copied.
 */
export async function duplicateInfoboard(
  id: string,
  tenantId: string,
): Promise<InboardRow | null> {
  const source = await getInfoboard(id, tenantId);
  if (!source) return null;

  const newName = `Kopie von ${source.name}`;
  const baseSlug = generateInfoboardSlug(newName);

  const existing = await listInfoboards(tenantId);
  const existingSlugs = new Set(existing.map((b) => b.slug));
  const newSlug = ensureUniqueSlug(baseSlug, existingSlugs);

  const nextSortOrder =
    existing.length > 0
      ? Math.max(...existing.map((b) => b.sortOrder)) + 1
      : 0;

  return prisma.infoboard.create({
    data: {
      tenantId,
      name: newName,
      slug: newSlug,
      status: "DRAFT",
      templateType: source.templateType,
      displayTheme: source.displayTheme,
      headerSubtitleEnabled: source.headerSubtitleEnabled,
      headerSubtitleText: source.headerSubtitleText,
      headerShowTime: source.headerShowTime,
      headerShowDate: source.headerShowDate,
      headerShowWeather: source.headerShowWeather,
      announcementEnabled: source.announcementEnabled,
      announcementText: source.announcementText,
      announcementBgColor: source.announcementBgColor,
      announcementTextColor: source.announcementTextColor,
      layoutJson: source.layoutJson,
      sortOrder: nextSortOrder,
    },
  }) as unknown as Promise<InboardRow>;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently deletes an Infoboard.
 *
 * Returns true if deleted, false if not found or tenant mismatch.
 * Does not affect planning, training, or event data.
 */
export async function deleteInfoboard(
  id: string,
  tenantId: string,
): Promise<boolean> {
  const existing = await getInfoboard(id, tenantId);
  if (!existing) return false;

  await prisma.infoboard.delete({ where: { id } });
  return true;
}

// ── Count ─────────────────────────────────────────────────────────────────────

export async function countInfoboards(
  tenantId: string,
): Promise<{ total: number; active: number; draft: number; disabled: number }> {
  const [total, active, draft, disabled] = await Promise.all([
    prisma.infoboard.count({ where: { tenantId } }),
    prisma.infoboard.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.infoboard.count({ where: { tenantId, status: "DRAFT" } }),
    prisma.infoboard.count({ where: { tenantId, status: "DISABLED" } }),
  ]);
  return { total, active, draft, disabled };
}
