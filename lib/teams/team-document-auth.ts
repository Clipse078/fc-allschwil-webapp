/**
 * TEAM-COCKPIT-PREMIUM-01J-C — Team Document authorization.
 *
 * Private Team Documents are scoped to the particular team. Tenant-wide
 * teams.view / teams.manage alone do NOT grant access.
 *
 * Access paths:
 *   A. Authenticated user is allocated to the target team (current season).
 *   B. Authenticated user is Club Admin for the active tenant.
 *   C. Authenticated user is an SCE platform Superadmin.
 *
 * Management (upload/rename/delete):
 *   - Club Admin and SCE Superadmin: full manage access.
 *   - Active TrainerTeamMember on the team's current season: manage access.
 *   - Active PlayerSquadMember: view/download only.
 */

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";

const SUPER_ADMIN_ROLE_KEY = "super_admin";

/** Active player statuses — mirrors PlayerSquadStatus semantics in capacity.ts */
const ACTIVE_PLAYER_STATUSES = ["ACTIVE", "INJURED", "ABSENT"] as const;

export type TeamDocumentAccess = {
  userId: string;
  tenantId: string;
  tenantKey: string;
  teamId: string;
  canViewDocuments: boolean;
  canManageDocuments: boolean;
};

export type ResolveTeamDocumentAccessInput = {
  userId: string;
  tenantId: string;
  tenantKey: string;
  teamId: string;
};

export type TeamDocumentAllocation = {
  isAllocated: boolean;
  isPlayer: boolean;
  isTrainer: boolean;
};

export async function isPlatformSuperAdmin(userId: string): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: {
      userId,
      role: { key: SUPER_ADMIN_ROLE_KEY, scope: "PLATFORM" },
    },
  });
  return count > 0;
}

export async function isTenantClubAdmin(
  userId: string,
  tenantId: string,
  tenantKey: string,
): Promise<boolean> {
  const clubAdminRoleKey = getTenantClubAdminRoleKey(tenantKey);
  const count = await prisma.userRole.count({
    where: {
      userId,
      tenantId,
      role: { key: clubAdminRoleKey },
      user: {
        tenantMemberships: {
          some: { tenantId, isActive: true },
        },
      },
    },
  });
  return count > 0;
}

export async function resolvePersonIdForUser(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const person = await prisma.person.findFirst({
    where: { userId, tenantId },
    select: { id: true },
  });
  return person?.id ?? null;
}

/**
 * Resolves whether a Person is currently allocated to a Team via the team's
 * canonical current-season roster (PlayerSquadMember / TrainerTeamMember).
 */
export async function resolvePersonCurrentTeamAllocation(
  personId: string,
  teamId: string,
): Promise<TeamDocumentAllocation> {
  const currentTeamSeason = await prisma.teamSeason.findFirst({
    where: {
      teamId,
      ...currentTeamSeasonWhere(),
    },
    select: { id: true },
  });

  if (!currentTeamSeason) {
    return { isAllocated: false, isPlayer: false, isTrainer: false };
  }

  const [playerMembership, trainerMembership] = await Promise.all([
    prisma.playerSquadMember.findFirst({
      where: {
        teamSeasonId: currentTeamSeason.id,
        personId,
        status: { in: [...ACTIVE_PLAYER_STATUSES] },
      },
      select: { id: true },
    }),
    prisma.trainerTeamMember.findFirst({
      where: {
        teamSeasonId: currentTeamSeason.id,
        personId,
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  ]);

  const isPlayer = Boolean(playerMembership);
  const isTrainer = Boolean(trainerMembership);

  return {
    isAllocated: isPlayer || isTrainer,
    isPlayer,
    isTrainer,
  };
}

/**
 * Authoritative Team Document access resolver.
 *
 * Returns null when the team does not exist in the tenant or when the viewer
 * lacks view access (fail-closed, non-enumerable).
 */
export async function resolveTeamDocumentAccess(
  input: ResolveTeamDocumentAccessInput,
): Promise<TeamDocumentAccess | null> {
  const team = await prisma.team.findFirst({
    where: { id: input.teamId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!team) return null;

  const [isSuperAdmin, isClubAdmin, personId] = await Promise.all([
    isPlatformSuperAdmin(input.userId),
    isTenantClubAdmin(input.userId, input.tenantId, input.tenantKey),
    resolvePersonIdForUser(input.userId, input.tenantId),
  ]);

  const allocation = personId
    ? await resolvePersonCurrentTeamAllocation(personId, input.teamId)
    : { isAllocated: false, isPlayer: false, isTrainer: false };

  const canViewDocuments =
    isSuperAdmin || isClubAdmin || allocation.isAllocated;
  const canManageDocuments =
    isSuperAdmin || isClubAdmin || allocation.isTrainer;

  if (!canViewDocuments) return null;

  return {
    userId: input.userId,
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    teamId: input.teamId,
    canViewDocuments,
    canManageDocuments,
  };
}

/**
 * Server Component / page guard for Team Documents.
 * Uses notFound() for denied access (non-enumerable).
 */
export async function requireTeamDocumentAccess(
  teamId: string,
): Promise<TeamDocumentAccess> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }

  const access = await resolveTeamDocumentAccess({
    userId: session.user.id,
    tenantId: tenant.id,
    tenantKey: tenant.key,
    teamId,
  });

  if (!access) {
    notFound();
  }

  return access;
}

type ApiTeamDocumentAccessResult =
  | {
      ok: true;
      access: TeamDocumentAccess;
      session: Session;
    }
  | {
      ok: false;
      status: 401 | 403 | 404;
      error: string;
      session: Session | null;
    };

/**
 * API route guard for Team Documents.
 * Returns 404 for missing team or denied view access (non-enumerable).
 */
export async function requireApiTeamDocumentAccess(
  teamId: string,
  options?: { requireManage?: boolean },
): Promise<ApiTeamDocumentAccessResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    };
  }

  const tenantId = session.user.activeTenantId;
  if (!tenantId) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, key: true },
  });
  if (!tenant) {
    return {
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session,
    };
  }

  const access = await resolveTeamDocumentAccess({
    userId: session.user.id,
    tenantId: tenant.id,
    tenantKey: tenant.key,
    teamId,
  });

  if (!access) {
    return {
      ok: false,
      status: 404,
      error: "Team nicht gefunden.",
      session,
    };
  }

  if (options?.requireManage && !access.canManageDocuments) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  return {
    ok: true,
    access,
    session,
  };
}
