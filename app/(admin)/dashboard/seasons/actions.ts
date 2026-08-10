"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createSeason, deleteSeason, updateSeasonDetails } from "@/lib/seasons/mutations";
import { SeasonDomainError } from "@/lib/seasons/errors";

async function requireSeasonManagePermission() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const permissionKeys = session.user.permissionKeys ?? [];

  if (!permissionKeys.includes(PERMISSIONS.SEASONS_MANAGE)) {
    redirect("/dashboard/seasons?status=forbidden");
  }

  return session;
}

function actorUserIdFromSession(session: Session | null): string | null {
  return session?.user?.effectiveUserId ?? session?.user?.id ?? null;
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
  const session = await requireSeasonManagePermission();

  const rawStartYear = formData.get("startYear");
  const startYear = typeof rawStartYear === "string" ? Number(rawStartYear.trim()) : NaN;

  if (!Number.isInteger(startYear)) {
    redirect("/dashboard/seasons?status=create-invalid");
  }

  try {
    await createSeason({ startYear }, actorUserIdFromSession(session));
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
  const session = await requireSeasonManagePermission();

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
      actorUserIdFromSession(session),
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
 * SEASON-01 — deletes an unused Season. Blocked whenever the Season is
 * referenced anywhere (TeamSeason/Event/EventImportRun/TrainingPlan/
 * OrgUnitMembership) — never restricted by lifecycle status alone, so a
 * past or future Season with zero dependents can be deleted just as
 * easily as a "planning" one. See lib/seasons/mutations.ts#deleteSeason().
 */
export async function deleteSeasonAction(formData: FormData) {
  const session = await requireSeasonManagePermission();

  const seasonIdValue = formData.get("seasonId");
  const seasonId = typeof seasonIdValue === "string" ? seasonIdValue.trim() : "";

  if (!seasonId) {
    redirect("/dashboard/seasons?status=delete-missing-id");
  }

  try {
    await deleteSeason(seasonId, actorUserIdFromSession(session));
  } catch (error) {
    if (error instanceof SeasonDomainError) {
      if (error.code === "SEASON_NOT_FOUND") {
        redirect("/dashboard/seasons?status=delete-not-found");
      }
      if (error.code === "HAS_DEPENDENCIES") {
        redirect("/dashboard/seasons?status=delete-has-dependencies");
      }
    }
    redirect("/dashboard/seasons?status=delete-not-found");
  }

  revalidateSeasonSurfaces();
  redirect("/dashboard/seasons?status=delete-success");
}
