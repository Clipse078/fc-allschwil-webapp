"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";
import { createSeason, deleteSeason, updateSeasonDetails } from "@/lib/seasons/mutations";
import { SeasonDomainError } from "@/lib/seasons/errors";

async function requireSeasonManagePermission() {
  const access = await requireApiTenantPermissionContext([
    PERMISSIONS.SEASONS_MANAGE,
  ]);
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    redirect("/dashboard/seasons?status=forbidden");
  }
  return access.context;
}

/**
 * ADMIN-DELETE-SEASON-01 — gate for permanent Season deletion. Requires
 * seasons.delete (deliberately separate from seasons.manage — see
 * PERMISSIONS.SEASONS_DELETE doc comment in lib/permissions/permissions.ts).
 */
async function requireSeasonDeletePermission() {
  const access = await requireApiTenantPermissionContext([
    PERMISSIONS.SEASONS_DELETE,
  ]);
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    redirect("/dashboard/seasons?status=forbidden");
  }
  return access.context;
}

function revalidateSeasonSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/seasons");
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/training/new");
}

/**
 * SEASON-01 — creates an arbitrary Season by explicit start year (e.g.
 * `2026` creates "2026/2027"). Never blocked by an earlier or later Season
 * already existing — only an exact duplicate is rejected. See
 * lib/seasons/mutations.ts#createSeason().
 */
export async function createSeasonAction(formData: FormData) {
  const context = await requireSeasonManagePermission();

  const rawStartYear = formData.get("startYear");
  const startYear = typeof rawStartYear === "string" ? Number(rawStartYear.trim()) : NaN;

  if (!Number.isInteger(startYear)) {
    redirect("/dashboard/seasons?status=create-invalid");
  }

  try {
    await createSeason({ startYear }, context.actorUserId);
  } catch (error) {
    if (error instanceof SeasonDomainError && error.code === "DUPLICATE_SEASON") {
      redirect("/dashboard/seasons?status=create-exists");
    }
    redirect("/dashboard/seasons?status=create-invalid");
  }

  revalidateSeasonSurfaces();
  redirect("/dashboard/seasons?status=create-success");
}

/**
 * SEASON-01 — updates label/dates only ("Bearbeiten"). Never touches `key`
 * or `isActive`. Activation is a separate, explicit action
 * (ActivateSeasonButton → POST /api/seasons/[seasonId]/activate).
 */
export async function updateSeasonDetailsAction(formData: FormData) {
  const context = await requireSeasonManagePermission();

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();

  if (!seasonId) {
    redirect("/dashboard/seasons?status=update-missing-id");
  }

  const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
  const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
    redirect("/dashboard/seasons?status=update-invalid");
  }

  try {
    await updateSeasonDetails(
      seasonId,
      { name: name || undefined, startDate, endDate },
      context.actorUserId,
    );
  } catch (error) {
    if (error instanceof SeasonDomainError && error.code === "SEASON_NOT_FOUND") {
      redirect("/dashboard/seasons?status=update-not-found");
    }
    redirect("/dashboard/seasons?status=update-invalid");
  }

  revalidateSeasonSurfaces();
  redirect("/dashboard/seasons?status=update-success");
}

/**
 * ADMIN-DELETE-SEASON-01-C1 — permanently deletes a Season regardless of
 * dependency counts. TeamSeason links are removed; Events and TrainingPlans
 * survive with seasonId → null (SetNull FK). SetNull relations
 * (EventImportRun/OrgUnitMembership) remain unchanged. Requires seasons.delete —
 * deliberately separate from seasons.manage.
 */
export async function deleteSeasonAction(formData: FormData) {
  const context = await requireSeasonDeletePermission();

  const seasonIdValue = formData.get("seasonId");
  const seasonId = typeof seasonIdValue === "string" ? seasonIdValue.trim() : "";

  if (!seasonId) {
    redirect("/dashboard/seasons?status=delete-missing-id");
  }

  try {
    await deleteSeason(seasonId, context.actorUserId);
  } catch (error) {
    if (error instanceof SeasonDomainError && error.code === "SEASON_NOT_FOUND") {
      redirect("/dashboard/seasons?status=delete-not-found");
    }
    redirect("/dashboard/seasons?status=delete-error");
  }

  revalidateSeasonSurfaces();
  redirect("/dashboard/seasons?status=delete-success");
}
