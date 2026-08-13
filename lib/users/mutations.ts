import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { logAction } from "@/lib/audit/log-action";

// ── Error types ───────────────────────────────────────────────────────────────

export type MembershipToggleErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "SELF_DEACTIVATION"
  | "LAST_CLUB_ADMIN";

export class MembershipDomainError extends Error {
  constructor(public readonly code: MembershipToggleErrorCode) {
    super(code);
    this.name = "MembershipDomainError";
  }
}

// ── setTenantMembershipActive ─────────────────────────────────────────────────

/**
 * USER-ADMIN-02B — Toggle the `isActive` flag of a single TenantMembership.
 *
 * Invariants enforced:
 *   1. Self-lockout: an actor may never deactivate their own active
 *      tenant membership.
 *   2. Last Club Admin: the tenant's last effective Club Admin (holding the
 *      canonical `club_admin__<tenantKey>` TENANT role with an active
 *      membership) may not be deactivated. Uses `getTenantClubAdminRoleKey`
 *      — the canonical per-tenant key builder — never heuristic matching.
 *   3. Scoped update: only `TenantMembership.isActive` is touched; User,
 *      roles, other memberships, sessions, and tokens are never modified.
 *
 * @param tenantId   - Must come from `session.user.activeTenantId`.
 * @param userId     - Target user's ID.
 * @param isActive   - Desired new state.
 * @param actorUserId - Calling user's effective ID (for audit log + self-check).
 */
export async function setTenantMembershipActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
  actorUserId: string | null,
): Promise<void> {
  // Safety 1: self-lockout
  if (!isActive && actorUserId != null && actorUserId === userId) {
    throw new MembershipDomainError("SELF_DEACTIVATION");
  }

  // Fetch the membership to confirm it belongs to this tenant
  const existing = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    throw new MembershipDomainError("MEMBERSHIP_NOT_FOUND");
  }

  // Safety 2: last Club Admin guard (deactivation only)
  if (!isActive) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { key: true },
    });

    if (tenant) {
      const clubAdminRoleKey = getTenantClubAdminRoleKey(tenant.key);

      const targetIsClubAdmin =
        (await prisma.userRole.count({
          where: { userId, tenantId, role: { key: clubAdminRoleKey } },
        })) > 0;

      if (targetIsClubAdmin) {
        // Count other active Club Admins in this tenant (excluding target)
        const otherActiveClubAdmins = await prisma.userRole.count({
          where: {
            tenantId,
            userId: { not: userId },
            role: { key: clubAdminRoleKey },
            user: {
              tenantMemberships: {
                some: { tenantId, isActive: true },
              },
            },
          },
        });

        if (otherActiveClubAdmins === 0) {
          throw new MembershipDomainError("LAST_CLUB_ADMIN");
        }
      }
    }
  }

  const before = { isActive: existing.isActive };

  await prisma.tenantMembership.update({
    where: { tenantId_userId: { tenantId, userId } },
    data: { isActive },
  });

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "TenantMembership",
    entityId: existing.id,
    action: isActive ? "MEMBERSHIP_ACTIVATED" : "MEMBERSHIP_DEACTIVATED",
    beforeJson: before,
    afterJson: { isActive },
    metadataJson: { tenantId, targetUserId: userId },
  });
}
