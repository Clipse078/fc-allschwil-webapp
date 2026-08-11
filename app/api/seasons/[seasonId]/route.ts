/**
 * /api/seasons/[seasonId] — SEASON-01 edit + dependency-checked delete.
 *
 * PATCH  → update name / startDate / endDate ("Bearbeiten"). Never touches
 *          `key` or `isActive` — activation stays exclusively at
 *          POST /api/seasons/[seasonId]/activate.
 * DELETE → deletes the Season only when nothing references it
 *          (TeamSeason/Event/EventImportRun/TrainingPlan/OrgUnitMembership
 *          all zero). Otherwise returns 409 with the exact blocking
 *          counts — Team/Event history is never silently destroyed.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { deleteSeason, updateSeasonDetails } from "@/lib/seasons/mutations";
import { toSeasonApiErrorResponse } from "@/lib/seasons/errors";

type Context = {
  params: Promise<{ seasonId: string }>;
};

function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.SEASONS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { seasonId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const actorUserId = access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  const name = typeof body.name === "string" ? body.name : undefined;
  const startDate = parseOptionalDate(body.startDate);
  const endDate = parseOptionalDate(body.endDate);

  try {
    const updated = await updateSeasonDetails(seasonId, { name, startDate, endDate }, actorUserId);

    revalidatePath("/dashboard/seasons");
    revalidatePath("/dashboard/teams");

    return NextResponse.json({ message: 'Saison "' + updated.name + '" wurde aktualisiert.', season: updated });
  } catch (error) {
    const { status, body: errorBody } = toSeasonApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}

export async function DELETE(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.SEASONS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { seasonId } = await context.params;
  const actorUserId = access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  try {
    const deleted = await deleteSeason(seasonId, actorUserId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/seasons");
    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/events");

    return NextResponse.json({ message: 'Saison "' + deleted.name + '" wurde gelöscht.' });
  } catch (error) {
    const { status, body: errorBody } = toSeasonApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
