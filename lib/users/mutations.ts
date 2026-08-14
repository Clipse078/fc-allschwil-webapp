import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { logAction } from "@/lib/audit/log-action";
import { hashResetToken } from "@/lib/auth/password-reset";
import { hashPassword } from "@/lib/auth/password";

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

export type InvitationErrorCode =
  | "PERSON_NOT_FOUND"
  | "PERSON_CROSS_TENANT"
  | "PERSON_ALREADY_LINKED_OTHER_USER"
  | "USER_ALREADY_LINKED_OTHER_PERSON"
  | "EMAIL_TAKEN_BY_OTHER_USER"
  | "ALREADY_HAS_ACTIVE_MEMBERSHIP"
  | "USER_NOT_FOUND"
  | "NO_ACTIVE_INVITATION";

export class InvitationDomainError extends Error {
  constructor(public readonly code: InvitationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "InvitationDomainError";
  }
}

// ── Invitation constants ──────────────────────────────────────────────────────

/** Invitation tokens are valid for 72 hours (vs 60 min for password reset). */
export const INVITATION_EXPIRY_MS = 72 * 60 * 60 * 1000;
export const INVITATION_EXPIRY_HOURS = 72;

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

// ── Invitation: invite existing Person ───────────────────────────────────────

export type InvitePersonResult = {
  userId: string;
  rawToken: string;
};

/**
 * USER-ADMIN-02 — Invite an existing Person in the tenant to create a user account.
 *
 * Identity conflict checks:
 *   1. Person must exist in the given tenant (cross-tenant isolation).
 *   2. Person must not already be linked to another User.
 *   3. The Person's email must not be taken by a User already linked to a
 *      different Person in this tenant.
 *   4. If Person already has an active TenantMembership, no new membership is
 *      created but a fresh invitation token is returned (resend path).
 *
 * Creates:
 *   - A new User (if none linked) with a random initial password (never usable).
 *   - A TenantMembership for that User in this tenant.
 *   - A PasswordResetToken with isInvitation=true (72 h expiry).
 *   - Writes Person.userId to link the person.
 *
 * @param tenantId    - Must come from `session.user.activeTenantId`.
 * @param personId    - Person to invite.
 * @param actorUserId - Calling user's effective ID.
 * @returns { userId, rawToken } — rawToken is the raw invitation token; caller
 *   embeds it in the invitation URL. Never log or store rawToken.
 */
export async function invitePersonToTenant(
  tenantId: string,
  personId: string,
  actorUserId: string,
): Promise<InvitePersonResult> {
  // 1. Load the Person — must belong to this tenant.
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
      userId: true,
    },
  });

  if (!person) throw new InvitationDomainError("PERSON_NOT_FOUND");
  if (person.tenantId !== tenantId) throw new InvitationDomainError("PERSON_CROSS_TENANT");

  // 2. If Person already has a linked userId, verify it's consistent.
  if (person.userId) {
    // Person is already linked — verify no cross-person conflict, then resend.
    const existingUser = await prisma.user.findUnique({
      where: { id: person.userId },
      select: { id: true, isActive: true },
    });
    if (!existingUser) {
      // userId set but user deleted — clear the stale link and proceed.
      await prisma.person.update({ where: { id: personId }, data: { userId: null } });
    } else {
      // Already linked; check membership state and resend invitation.
      return _ensureMembershipAndResendInvitation(tenantId, existingUser.id, personId, actorUserId);
    }
  }

  // 3. Email conflict resolution — multi-tenant aware.
  //    Rule: a Person may be linked to an existing global User even if that User
  //    already belongs to another tenant. Only a same-tenant cross-person link
  //    is a hard conflict.
  if (person.email) {
    const normalizedEmail = person.email.toLowerCase().trim();
    const emailConflict = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        person: { select: { id: true, tenantId: true } },
      },
    });
    if (emailConflict) {
      // Hard conflict: same-tenant Person → different User. Never silently relink.
      if (
        emailConflict.person &&
        emailConflict.person.tenantId === tenantId &&
        emailConflict.person.id !== personId
      ) {
        throw new InvitationDomainError("USER_ALREADY_LINKED_OTHER_PERSON");
      }

      // Multi-tenant case: email User exists (from another tenant or unlinked
      // globally). Link this Person → existing User and create a new membership
      // + invitation token for this tenant. This is the canonical
      // "existing global User → invitation into another tenant" path.
      //
      // Reject only when the existing User is already linked to a DIFFERENT
      // Person in THE SAME TENANT (handled above).
      await prisma.person.update({
        where: { id: personId },
        data: { userId: emailConflict.id },
      });
      return _ensureMembershipAndResendInvitation(
        tenantId,
        emailConflict.id,
        personId,
        actorUserId,
      );
    }
  }

  // 4. Create the User with an unusable random password.
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(randomPassword);
  const email = (person.email ?? `invite+${personId}@noreply.internal`).toLowerCase().trim();

  const newUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: person.firstName,
      lastName: person.lastName,
      isActive: true,
    },
    select: { id: true },
  });

  // 5. Link Person → User.
  await prisma.person.update({
    where: { id: personId },
    data: { userId: newUser.id },
  });

  // 6. Create TenantMembership (active — access granted when they first log in).
  await prisma.tenantMembership.create({
    data: {
      tenantId,
      userId: newUser.id,
      isActive: true,
    },
  });

  // 7. Create invitation token.
  const rawToken = await _createInvitationToken(newUser.id);

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: newUser.id,
    action: "INVITATION_SENT",
    afterJson: { tenantId, personId, email },
    metadataJson: { tenantId },
  });

  return { userId: newUser.id, rawToken };
}

/**
 * Invite a NEW Person + User at the same time.
 *
 * Creates Person, links it to a new User, creates TenantMembership, and issues
 * an invitation token — all in a single operation.
 *
 * Identity conflict checks:
 *   - email must not be taken by an existing User.
 *
 * @param tenantId    - Must come from `session.user.activeTenantId`.
 * @param personData  - Minimal Person data (firstName, lastName, email required).
 * @param actorUserId - Calling user's effective ID.
 */
export async function createPersonAndInvite(
  tenantId: string,
  personData: { firstName: string; lastName: string; email: string },
  actorUserId: string,
): Promise<InvitePersonResult & { personId: string }> {
  const { firstName, lastName, email } = personData;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check email uniqueness globally.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    throw new InvitationDomainError(
      "EMAIL_TAKEN_BY_OTHER_USER",
      `A user with email ${normalizedEmail} already exists.`,
    );
  }

  // 2. Create Person.
  const person = await prisma.person.create({
    data: { tenantId, firstName, lastName, email: normalizedEmail },
    select: { id: true },
  });

  // 3. Create User.
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(randomPassword);

  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      isActive: true,
    },
    select: { id: true },
  });

  // 4. Link Person → User.
  await prisma.person.update({
    where: { id: person.id },
    data: { userId: newUser.id },
  });

  // 5. Create TenantMembership.
  await prisma.tenantMembership.create({
    data: { tenantId, userId: newUser.id, isActive: true },
  });

  // 6. Create invitation token.
  const rawToken = await _createInvitationToken(newUser.id);

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: newUser.id,
    action: "INVITATION_SENT",
    afterJson: { tenantId, personId: person.id, email: normalizedEmail, newPerson: true },
    metadataJson: { tenantId },
  });

  return { userId: newUser.id, personId: person.id, rawToken };
}

// ── Invitation: resend ────────────────────────────────────────────────────────

/**
 * Resend an invitation to a user who already has a TenantMembership.
 *
 * Deletes any existing invitation tokens and creates a fresh one.
 * Only allowed when the user has never logged in (lastLoginAt = null).
 *
 * @param tenantId    - Must come from `session.user.activeTenantId`.
 * @param userId      - Target user.
 * @param actorUserId - Calling user's effective ID.
 */
export async function resendTenantInvitation(
  tenantId: string,
  userId: string,
  actorUserId: string,
): Promise<string> {
  // Verify membership exists in this tenant.
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) throw new InvitationDomainError("USER_NOT_FOUND");

  const rawToken = await _createInvitationToken(userId);

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: userId,
    action: "INVITATION_RESENT",
    metadataJson: { tenantId },
  });

  return rawToken;
}

// ── Invitation: revoke ────────────────────────────────────────────────────────

/**
 * Revoke all active invitation tokens for a user in the given tenant.
 *
 * Does NOT delete the User, Person, or TenantMembership.
 * After revocation the user can no longer use the invitation link.
 * If they have never logged in, their access remains deactivated until
 * a new invitation is sent or the admin sets a password directly.
 *
 * @param tenantId    - Must come from `session.user.activeTenantId`.
 * @param userId      - Target user.
 * @param actorUserId - Calling user's effective ID.
 */
export async function revokeTenantInvitation(
  tenantId: string,
  userId: string,
  actorUserId: string,
): Promise<void> {
  // Verify membership exists in this tenant (tenant isolation).
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) throw new InvitationDomainError("USER_NOT_FOUND");

  const deleted = await prisma.passwordResetToken.deleteMany({
    where: { userId, isInvitation: true, usedAt: null },
  });

  if (deleted.count === 0) throw new InvitationDomainError("NO_ACTIVE_INVITATION");

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: userId,
    action: "INVITATION_REVOKED",
    metadataJson: { tenantId, deletedCount: deleted.count },
  });
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Create a fresh invitation token, deleting all prior invitation tokens for the user. */
async function _createInvitationToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

  // Invalidate all prior invitation tokens (not reset tokens — those are separate).
  await prisma.passwordResetToken.deleteMany({
    where: { userId, isInvitation: true },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt, isInvitation: true },
  });

  return rawToken;
}

/** Ensure membership exists and create a fresh invitation token (resend path). */
async function _ensureMembershipAndResendInvitation(
  tenantId: string,
  userId: string,
  personId: string,
  actorUserId: string,
): Promise<InvitePersonResult> {
  // Check if membership exists.
  const existing = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });

  if (existing?.isActive) {
    // Already an active member — no invitation needed.
    // Check if there's already a pending invitation token; if so, resend.
    // If they're fully active (have logged in), reject to avoid confusion.
    const hasActiveInvite = await prisma.passwordResetToken.findFirst({
      where: { userId, isInvitation: true, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!hasActiveInvite) {
      // User is active and has no pending invitation — already onboarded.
      throw new InvitationDomainError(
        "ALREADY_HAS_ACTIVE_MEMBERSHIP",
        "User is already an active member of this tenant.",
      );
    }
    // Has a pending invitation — resend it.
    const rawToken = await _createInvitationToken(userId);
    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: userId,
      action: "INVITATION_RESENT",
      metadataJson: { tenantId, personId },
    });
    return { userId, rawToken };
  }

  if (!existing) {
    await prisma.tenantMembership.create({
      data: { tenantId, userId, isActive: true },
    });
  }

  const rawToken = await _createInvitationToken(userId);

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: userId,
    action: "INVITATION_RESENT",
    metadataJson: { tenantId, personId },
  });

  return { userId, rawToken };
}
