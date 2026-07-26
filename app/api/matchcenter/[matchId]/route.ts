/**
 * PATCH /api/matchcenter/[matchId]
 *
 * Updates locally managed operational fields of a match event.
 *
 * SFV-owned fields (homeAway, competitionLabel, title, location derived
 * from provider, externalMatchId, etc.) are NEVER updated here.
 *
 * Locally managed fields updated:
 *   - teamId          (internal FC Allschwil team assignment)
 *   - pitchCode       (Spielfeld)
 *   - homeDressingRoomCode
 *   - awayDressingRoomCode
 *   - websiteVisible
 *   - infoboardVisible
 *
 * Permission: EVENTS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ matchId: string }> };

type PatchBody = {
  teamId?: string | null;
  pitchCode?: string | null;
  homeDressingRoomCode?: string | null;
  awayDressingRoomCode?: string | null;
  websiteVisible?: boolean;
  infoboardVisible?: boolean;
};

const ALLOWED_STRING_KEYS = [
  "teamId",
  "pitchCode",
  "homeDressingRoomCode",
  "awayDressingRoomCode",
] as const;

const ALLOWED_BOOLEAN_KEYS = [
  "websiteVisible",
  "infoboardVisible",
] as const;

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required." },
      { status: 403 },
    );
  }

  const { matchId } = await params;
  if (!matchId?.trim()) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Confirm the event exists and belongs to this tenant
  const event = await prisma.event.findFirst({
    where: { id: matchId, tenantId, type: "MATCH" },
    select: { id: true },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Match nicht gefunden." },
      { status: 404 },
    );
  }

  // Build the data object from allowed locally-managed fields only
  const data: Record<string, string | boolean | null> = {};

  for (const key of ALLOWED_STRING_KEYS) {
    if (key in body) {
      const value = body[key];
      if (value === null || value === undefined) {
        data[key] = null;
      } else if (typeof value === "string") {
        data[key] = value.trim() || null;
      } else {
        return NextResponse.json(
          { error: `${key} muss ein String oder null sein.` },
          { status: 400 },
        );
      }
    }
  }

  for (const key of ALLOWED_BOOLEAN_KEYS) {
    if (key in body) {
      const value = body[key];
      if (typeof value !== "boolean") {
        return NextResponse.json(
          { error: `${key} muss ein Boolean sein.` },
          { status: 400 },
        );
      }
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren." },
      { status: 400 },
    );
  }

  // Validate teamId belongs to the same tenant if provided
  if ("teamId" in data && data.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId as string, tenantId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Team nicht gefunden oder nicht zugreifbar." },
        { status: 404 },
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id: matchId },
    data,
    select: {
      id: true,
      teamId: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
      websiteVisible: true,
      infoboardVisible: true,
    },
  });

  // Invalidate the admin Matchcenter pages so the next visit reflects the saved state.
  revalidatePath("/dashboard/matchcenter");
  revalidatePath(`/dashboard/matchcenter/${matchId}`);

  return NextResponse.json(updated);
}
