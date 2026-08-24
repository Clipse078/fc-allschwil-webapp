import { NextRequest, NextResponse } from "next/server";
import { Prisma, TeamCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  TeamDeletionBlockedError,
  TeamNotFoundError,
  deleteTeamSafely,
} from "@/lib/teams/team-lifecycle-service";

type Context = {
  params: Promise<{ teamId: string }>;
};

const INFOBOARD_DISPLAY_NAME_MAX_LENGTH = 120;

const ALLOWED_CATEGORIES = [
  "KINDERFUSSBALL",
  "JUNIOREN",
  "AKTIVE",
  "FRAUEN",
  "SENIOREN",
  "TRAININGSGRUPPE",
];

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { teamId } = await context.params;

  // Tenant isolation: never resolve a Team belonging to another tenant.
  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId: tenant.id },
    include: {
      teamSeasons: {
        include: {
          season: true,
        },
        orderBy: {
          season: {
            startDate: "desc",
          },
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(team);
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([PERMISSIONS.TEAMS_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId } = await context.params;
    const body = await request.json();

    // Tenant isolation: never read or mutate a Team belonging to another tenant.
    const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
    }

    const existing = await prisma.team.findFirst({
      where: { id: teamId, tenantId: tenant.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }

    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();

    // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
    // undefined = not present in body (keep existing), null/"" = clear, string = set.
    // Never derived from string parsing of `name`.
    const shortNameRaw = body.shortName;
    const shortName: string | null | undefined =
      shortNameRaw === undefined
        ? undefined
        : shortNameRaw === null || shortNameRaw === ""
          ? null
          : String(shortNameRaw).trim() || null;

    const alternativeNameRaw = body.alternativeName;
    const alternativeName: string | null | undefined =
      alternativeNameRaw === undefined
        ? undefined
        : alternativeNameRaw === null || alternativeNameRaw === ""
          ? null
          : String(alternativeNameRaw).trim() || null;

    const infoboardDisplayNameRaw = body.infoboardDisplayName;
    const infoboardDisplayName: string | null | undefined =
      infoboardDisplayNameRaw === undefined
        ? undefined
        : infoboardDisplayNameRaw === null || infoboardDisplayNameRaw === ""
          ? null
          : String(infoboardDisplayNameRaw).trim() || null;
    const genderGroup =
      body.genderGroup === null || body.genderGroup === undefined
        ? null
        : String(body.genderGroup).trim() || null;
    const ageGroup =
      body.ageGroup === null || body.ageGroup === undefined
        ? null
        : String(body.ageGroup).trim() || null;
    const sortOrder = Number(body.sortOrder ?? 0);

    // orgUnitId: undefined = not in body (keep existing), null = clear, string = set
    const orgUnitIdRaw = body.orgUnitId;
    const orgUnitId: string | null | undefined =
      orgUnitIdRaw === undefined
        ? undefined
        : orgUnitIdRaw === null || orgUnitIdRaw === ""
          ? null
          : String(orgUnitIdRaw).trim() || null;

    if (!name) {
      return NextResponse.json(
        { error: "Teamname ist erforderlich." },
        { status: 400 }
      );
    }

    if (!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])) {
      return NextResponse.json(
        { error: "Ungueltige Kategorie." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json(
        { error: "Sortierung muss eine Zahl sein." },
        { status: 400 }
      );
    }

    if (
      infoboardDisplayName !== undefined &&
      infoboardDisplayName !== null &&
      infoboardDisplayName.length > INFOBOARD_DISPLAY_NAME_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Infoboard-Anzeigename darf maximal ${INFOBOARD_DISPLAY_NAME_MAX_LENGTH} Zeichen lang sein.`,
        },
        { status: 400 },
      );
    }

    // Validate orgUnitId against active tenant if explicitly set to a non-null value.
    if (orgUnitId !== undefined && orgUnitId !== null) {
      const orgUnit = await prisma.orgUnit.findUnique({
        where: { id: orgUnitId },
        select: { id: true, tenantId: true },
      });

      if (!orgUnit) {
        return NextResponse.json(
          { error: "Organisationseinheit nicht gefunden." },
          { status: 404 }
        );
      }

      if (tenant && orgUnit.tenantId !== tenant.id) {
        return NextResponse.json(
          { error: "Die gewählte Organisationseinheit gehört nicht zum aktiven Mandanten." },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        name,
        category: category as TeamCategory,
        genderGroup,
        ageGroup,
        sortOrder,
        // isActive (archive state) is deliberately NOT force-defaulted to
        // false when omitted — archive/restore now have dedicated actions
        // (POST /api/teams/[teamId]/archive|restore) to prevent a plain
        // settings save from silently un-archiving/archiving a Team.
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
        websiteVisible: Boolean(body.websiteVisible),
        infoboardVisible: Boolean(body.infoboardVisible),
        ...(orgUnitId !== undefined ? { orgUnitId } : {}),
        ...(shortName !== undefined ? { shortName } : {}),
        ...(alternativeName !== undefined ? { alternativeName } : {}),
        ...(infoboardDisplayName !== undefined ? { infoboardDisplayName } : {}),
      },
      include: {
        teamSeasons: {
          include: {
            season: true,
          },
          orderBy: {
            season: {
              startDate: "desc",
            },
          },
        },
      },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "Team",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: existing,
      afterJson: {
        id: updated.id,
        name: updated.name,
        shortName: updated.shortName,
        alternativeName: updated.alternativeName,
        infoboardDisplayName: updated.infoboardDisplayName,
        slug: updated.slug,
        category: updated.category,
        genderGroup: updated.genderGroup,
        ageGroup: updated.ageGroup,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        websiteVisible: updated.websiteVisible,
        infoboardVisible: updated.infoboardVisible,
        orgUnitId: updated.orgUnitId,
      },
    });

    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/teams/" + updated.id);

    return NextResponse.json({
      message: "Team erfolgreich aktualisiert.",
      team: updated,
    });
  } catch (error) {
    console.error("Update team failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Team konnte nicht aktualisiert werden, weil der Datensatz nicht mehr existiert." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Datenbankfehler: " + error.code + "." },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Prisma Validierungsfehler. Wahrscheinlich stimmen Schema, Migration und generierter Client aktuell nicht ueberein." },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Team konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}

/**
 * DELETE — permanent hard delete. Requires PERMISSIONS.TEAMS_DELETE
 * (ADMIN-DELETE-01B) — deliberately NOT TEAMS_MANAGE, which authorizes
 * create/edit/archive but must never imply permanent deletion on its own.
 *
 * Authorization model:
 *   1. The target Team (and therefore its owning tenant) is resolved
 *      strictly server-side from `teamId` — a client-supplied tenantId is
 *      never read or trusted for this decision.
 *   2. `EffectivePermissionResolver.hasTenantDeletionAuthority()` decides
 *      whether the caller may delete within that exact tenant. This grants
 *      access via either of its two independent paths: a tenant-scoped
 *      teams.delete grant (Club Admin or a delegated user, in their own
 *      tenant), or the SCE Super Admin's platform-held teams.delete grant
 *      resolved against this tenant once it is confirmed to be a real,
 *      operationally ACTIVE tenant. See
 *      lib/permissions/services/effective-permission-resolver.ts for the
 *      full contract.
 *
 * Refuses to delete when meaningful dependencies/history exist (roster,
 * training, matches, tournaments, provider mappings, multi-season history,
 * organisation assignments) — recommends archiving instead. Never
 * cascade-deletes sporting history just to remove a Team record. This
 * safety logic (lib/teams/team-lifecycle-service.ts) is unchanged by
 * ADMIN-DELETE-01B.
 */
export async function DELETE(_request: NextRequest, context: Context) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await context.params;

  // Resolve the target Team and its tenant strictly server-side — never
  // trust a client-supplied tenantId for a permanent-deletion decision.
  // Team.tenantId is nullable in the schema (SetNull on Tenant deletion); a
  // Team with no owning tenant can never be authorized for deletion here.
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, tenantId: true },
  });

  if (!team || !team.tenantId) {
    return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
  }

  const teamTenantId = team.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.TEAMS_DELETE,
    tenantId: teamTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const deleted = await deleteTeamSafely(teamTenantId, teamId);

    await logAction({
      actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
      moduleKey: "teams",
      entityType: "Team",
      entityId: teamId,
      action: "DELETE",
      beforeJson: deleted,
    });

    revalidatePath("/dashboard/teams");

    return NextResponse.json({ message: "Team wurde endgültig gelöscht." });
  } catch (error) {
    if (error instanceof TeamNotFoundError) {
      return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
    }

    if (error instanceof TeamDeletionBlockedError) {
      return NextResponse.json(
        {
          error: error.message,
          blockers: error.blockers,
        },
        { status: 409 }
      );
    }

    console.error("Delete team failed:", error);
    return NextResponse.json(
      { error: "Team konnte nicht gelöscht werden." },
      { status: 500 }
    );
  }
}

