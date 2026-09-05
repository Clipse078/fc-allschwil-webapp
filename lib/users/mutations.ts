import crypto from "crypto";
import type { OrgUnitScopeMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { logAction } from "@/lib/audit/log-action";
import { hashResetToken } from "@/lib/auth/password-reset";
import { INVITATION_RESEND_COOLDOWN_MS } from "@/lib/security/abuse-policy";
import { hashPassword } from "@/lib/auth/password";
import { setTenantUserRoles } from "@/lib/roles/mutations";
import { assignScopedRoleToUser } from "@/lib/roles/scoped-mutations";

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
  | "NO_ACTIVE_INVITATION"
  | "INVITATION_RESEND_COOLDOWN";

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

// ── Remove tenant membership (permanent) ─────────────────────────────────────

export type RemoveMembershipErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "SELF_REMOVAL"
  | "LAST_CLUB_ADMIN";

export class RemoveMembershipDomainError extends Error {
  constructor(public readonly code: RemoveMembershipErrorCode) {
    super(code);
    this.name = "RemoveMembershipDomainError";
  }
}

/**
 * USER-ADMIN-REMOVE: Permanently remove a User's TenantMembership and all
 * their scoped UserRole rows for the given tenant.
 *
 * Invariants enforced:
 *   1. Self-removal: an actor may never remove their own membership.
 *   2. Last Club Admin: the tenant's last effective Club Admin cannot be removed.
 *   3. Scoped removal only: only rows for THIS tenant are touched.
 *      Other tenant memberships, global User, sessions, and auth data are untouched.
 *
 * What is removed:
 *   - TenantMembership row for (tenantId, userId)
 *   - All UserRole rows where tenantId = this tenant and userId = target
 *     (scoped role assignments within this tenant)
 *
 * What is preserved:
 *   - Global User record
 *   - Other tenant memberships
 *   - Non-scoped/platform UserRole rows (those have tenantId = null)
 *   - Person records (Person.userId link survives — Person is NOT deleted)
 *   - Sessions and authentication tokens
 *
 * @param tenantId    - Must come from `session.user.activeTenantId`.
 * @param userId      - Target user's ID.
 * @param actorUserId - Calling user's effective ID (for self-check + audit).
 */
export async function removeTenantMembership(
  tenantId: string,
  userId: string,
  actorUserId: string | null,
): Promise<void> {
  // Safety 1: self-removal guard
  if (actorUserId != null && actorUserId === userId) {
    throw new RemoveMembershipDomainError("SELF_REMOVAL");
  }

  const existing = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true },
  });
  if (!existing) {
    throw new RemoveMembershipDomainError("MEMBERSHIP_NOT_FOUND");
  }

  // Safety 2: last Club Admin guard
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
        throw new RemoveMembershipDomainError("LAST_CLUB_ADMIN");
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Remove all scoped UserRole rows for this user in this tenant.
    await tx.userRole.deleteMany({ where: { userId, tenantId } });

    // Remove the TenantMembership row.
    await tx.tenantMembership.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });
  });

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "TenantMembership",
    entityId: existing.id,
    action: "MEMBERSHIP_REMOVED",
    beforeJson: { tenantId, targetUserId: userId },
    metadataJson: {
      globalUserPreserved: true,
      scopedRolesRemoved: true,
      otherTenantMembershipsUnaffected: true,
    },
  });
}

// ── Invitation: invite existing Person ───────────────────────────────────────

export type InvitePersonResult = {
  userId: string;
  /** Present only when an invitation token was issued. */
  rawToken?: string;
};

export type OnboardScopedRoleInput = {
  roleId: string;
  orgUnitId: string;
  scopeMode?: OrgUnitScopeMode;
};

export type OnboardPersonOptions = {
  /** When false, creates access without issuing an invitation token or email. */
  sendInvitation?: boolean;
  roleIds?: string[];
  scopedRoles?: OnboardScopedRoleInput[];
};

/** Assign tenant-wide and scoped roles after person/user onboarding. */
export async function applyOnboardRoleAssignments(
  tenantId: string,
  userId: string,
  actorUserId: string,
  options?: Pick<OnboardPersonOptions, "roleIds" | "scopedRoles">,
): Promise<void> {
  const roleIds = options?.roleIds ?? [];
  const scopedRoles = options?.scopedRoles ?? [];

  if (roleIds.length > 0) {
    await setTenantUserRoles({ tenantId, userId, roleIds, actorUserId });
  }

  for (const scoped of scopedRoles) {
    await assignScopedRoleToUser({
      tenantId,
      userId,
      roleId: scoped.roleId,
      orgUnitId: scoped.orgUnitId,
      scopeMode: scoped.scopeMode ?? "THIS_ORG_UNIT",
      actorUserId,
    });
  }
}

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
  options?: OnboardPersonOptions,
): Promise<InvitePersonResult> {
  const sendInvitation = options?.sendInvitation ?? true;
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
      const result = await _ensureMembershipAndResendInvitation(
        tenantId,
        existingUser.id,
        personId,
        actorUserId,
        sendInvitation,
      );
      await applyOnboardRoleAssignments(tenantId, existingUser.id, actorUserId, options);
      return result;
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
      const result = await _ensureMembershipAndResendInvitation(
        tenantId,
        emailConflict.id,
        personId,
        actorUserId,
        sendInvitation,
      );
      await applyOnboardRoleAssignments(tenantId, emailConflict.id, actorUserId, options);
      return result;
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

  // 6. Create TenantMembership (inactive until the invitation is accepted).
  //    Access becomes usable only when the user sets their password and the
  //    acceptance flow calls activatePendingInvitationMemberships().
  await prisma.tenantMembership.create({
    data: {
      tenantId,
      userId: newUser.id,
      isActive: false,
    },
  });

  // 7. Create invitation token when requested.
  let rawToken: string | undefined;
  if (sendInvitation) {
    rawToken = await _createInvitationToken(newUser.id, tenantId);
  }

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: newUser.id,
    action: sendInvitation ? "INVITATION_SENT" : "ACCESS_CREATED_WITHOUT_INVITATION",
    afterJson: { tenantId, personId, email },
    metadataJson: { tenantId },
  });

  await applyOnboardRoleAssignments(tenantId, newUser.id, actorUserId, options);

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
  options?: OnboardPersonOptions,
): Promise<InvitePersonResult & { personId: string }> {
  const sendInvitation = options?.sendInvitation ?? true;
  const { firstName, lastName, email } = personData;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check whether a global User already exists for this email.
  //    Multi-tenant invariant: an existing global User must be reused, not
  //    duplicated. Same-tenant cross-person conflicts are still rejected.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      person: { select: { id: true, tenantId: true } },
    },
  });

  if (existingUser) {
    // Hard conflict: existing User is already linked to a different Person in
    // THIS tenant. Two Persons in the same tenant cannot share a User.
    if (existingUser.person && existingUser.person.tenantId === tenantId) {
      throw new InvitationDomainError(
        "USER_ALREADY_LINKED_OTHER_PERSON",
        `User ${normalizedEmail} is already linked to another Person in this tenant.`,
      );
    }

    // Multi-tenant / unlinked case: create a new Person for this tenant and
    // link it to the existing global User. Preserves all other memberships.
    const person = await prisma.person.create({
      data: { tenantId, firstName, lastName, email: normalizedEmail, userId: existingUser.id },
      select: { id: true },
    });

    const result = await _ensureMembershipAndResendInvitation(
      tenantId,
      existingUser.id,
      person.id,
      actorUserId,
      sendInvitation,
    );

    await applyOnboardRoleAssignments(tenantId, existingUser.id, actorUserId, options);

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: existingUser.id,
      action: sendInvitation ? "INVITATION_SENT" : "ACCESS_CREATED_WITHOUT_INVITATION",
      afterJson: { tenantId, personId: person.id, email: normalizedEmail, existingUser: true },
      metadataJson: { tenantId },
    });

    return { userId: existingUser.id, personId: person.id, rawToken: result.rawToken };
  }

  // 2. No existing User — create Person and a new User.
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

  // 5. Create TenantMembership (inactive until accepted).
  await prisma.tenantMembership.create({
    data: { tenantId, userId: newUser.id, isActive: false },
  });

  // 6. Create invitation token when requested.
  let rawToken: string | undefined;
  if (sendInvitation) {
    rawToken = await _createInvitationToken(newUser.id, tenantId);
  }

  await applyOnboardRoleAssignments(tenantId, newUser.id, actorUserId, options);

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: newUser.id,
    action: sendInvitation ? "INVITATION_SENT" : "ACCESS_CREATED_WITHOUT_INVITATION",
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

  const recentInvitation = await prisma.passwordResetToken.findFirst({
    where: { userId, isInvitation: true, invitationTenantId: tenantId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (
    recentInvitation &&
    Date.now() - recentInvitation.createdAt.getTime() < INVITATION_RESEND_COOLDOWN_MS
  ) {
    throw new InvitationDomainError("INVITATION_RESEND_COOLDOWN");
  }

  const rawToken = await _createInvitationToken(userId, tenantId);

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

  // Delete only the invitation token for this specific tenant — never touch
  // tokens issued for other tenants or normal password-reset tokens.
  const deleted = await prisma.passwordResetToken.deleteMany({
    where: { userId, isInvitation: true, invitationTenantId: tenantId, usedAt: null },
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

// ── Invitation acceptance: activate exact tenant membership ──────────────────

/**
 * Activate exactly the TenantMembership for `userId` in `tenantId`.
 *
 * Called by both acceptance paths after the invitation token is consumed:
 *   - New User: POST /api/auth/reset-password (password setup)
 *   - Existing User: POST /api/auth/invitation/accept
 *
 * Uses the `invitationTenantId` stored on the token to target the exact
 * membership row — no timestamp heuristics, no collateral activation.
 *
 * Multi-tenant safety:
 *   - Only the membership for `tenantId` is updated; other tenants unaffected.
 *   - If the membership is already active (e.g. admin activated it manually),
 *     updateMany is a no-op (idempotent).
 */
export async function activateInvitationMembership(
  userId: string,
  tenantId: string,
): Promise<void> {
  await prisma.tenantMembership.updateMany({
    where: { userId, tenantId, isActive: false },
    data: { isActive: true },
  });
}

/**
 * Create a fresh invitation token for `userId` issued on behalf of `tenantId`.
 *
 * Stores `invitationTenantId` on the token so that both acceptance paths can
 * activate exactly the right TenantMembership without timestamp heuristics.
 *
 * All prior invitation tokens for this user are invalidated first (single
 * active invitation invariant — one user, one outstanding invite token).
 */
async function _createInvitationToken(userId: string, tenantId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

  // Invalidate prior invitation tokens for this user+tenant only.
  // Tokens for other tenants are deliberately left untouched so a simultaneous
  // invitation to Tenant C is never cancelled when issuing one to Tenant B.
  await prisma.passwordResetToken.deleteMany({
    where: { userId, isInvitation: true, invitationTenantId: tenantId },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt, isInvitation: true, invitationTenantId: tenantId },
  });

  return rawToken;
}

/** Ensure membership exists and create a fresh invitation token (resend path). */
async function _ensureMembershipAndResendInvitation(
  tenantId: string,
  userId: string,
  personId: string,
  actorUserId: string,
  sendInvitation = true,
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
      where: { userId, isInvitation: true, invitationTenantId: tenantId, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!hasActiveInvite) {
      // User is active and has no pending invitation — already onboarded.
      throw new InvitationDomainError(
        "ALREADY_HAS_ACTIVE_MEMBERSHIP",
        "User is already an active member of this tenant.",
      );
    }
    if (!sendInvitation) {
      return { userId };
    }
    // Has a pending invitation — resend it.
    const rawToken = await _createInvitationToken(userId, tenantId);
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
    // Inactive until the user accepts the invitation. Access is NOT granted
    // merely because the invitation was issued — this is critical for
    // existing global Users who already have a working password.
    await prisma.tenantMembership.create({
      data: { tenantId, userId, isActive: false },
    });
  }

  if (!sendInvitation) {
    return { userId };
  }

  const rawToken = await _createInvitationToken(userId, tenantId);

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
