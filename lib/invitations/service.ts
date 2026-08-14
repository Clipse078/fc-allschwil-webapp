/**
 * INVITE-01 — Invitation Service
 *
 * Implements the secure invitation lifecycle for the MVP invitation feature:
 *
 *   1. createInvitation   — generates a token, stores its hash, sends email.
 *      Supports targeting an existing Person or creating a new Person inline.
 *      At most one PENDING invitation per Person (prior PENDING is revoked).
 *   2. resendInvitation   — invalidates the old token, issues a fresh one,
 *      re-sends the email. Only PENDING invitations can be resent.
 *   3. revokeInvitation   — marks as REVOKED. Never deletes the Person.
 *   4. acceptInvitation   — validates token, finds or creates global User,
 *      creates TenantMembership, links Person↔User. Idempotent for repeat
 *      clicks on the same token (returns success if already accepted).
 *
 * Authorization:
 *   All mutations (except accept) require PERMISSIONS.USERS_INVITE at the
 *   API-route layer. The service layer does NOT re-check permissions — it
 *   trusts the route layer. Accept is a public-facing endpoint (no session).
 *
 * Safety invariants:
 *   - Raw token is NEVER stored. Only SHA-256 hash is persisted.
 *   - Revoking an invitation NEVER deletes or modifies the Person.
 *   - Accepting an invitation NEVER creates a duplicate Person.
 *   - If a User with the invitation email already exists globally, that User
 *     is reused — never duplicated.
 *   - TenantMembership and Person.userId are only set once on acceptance;
 *     subsequent calls to accept (already-accepted token) are idempotent.
 *   - PersonAssignment (organisational data) is never touched.
 *   - Passwords, UserRoles, existing memberships are never modified.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendMail } from "@/lib/email/mailer";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { logAction } from "@/lib/audit/log-action";

const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours
const INVITE_EXPIRY_HOURS = 72;
const AUDIT_MODULE = "invitations";

function hashInviteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(INVITE_TOKEN_BYTES).toString("hex");
  return { rawToken, tokenHash: hashInviteToken(rawToken) };
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class InvitationNotFoundError extends Error {
  constructor() { super("Einladung nicht gefunden."); this.name = "InvitationNotFoundError"; }
}
export class InvitationAlreadyAcceptedError extends Error {
  constructor() { super("Einladung wurde bereits angenommen."); this.name = "InvitationAlreadyAcceptedError"; }
}
export class InvitationAlreadyRevokedError extends Error {
  constructor() { super("Einladung wurde bereits widerrufen."); this.name = "InvitationAlreadyRevokedError"; }
}
export class InvitationExpiredError extends Error {
  constructor() { super("Einladung ist abgelaufen."); this.name = "InvitationExpiredError"; }
}
export class PersonAlreadyHasUserError extends Error {
  constructor() { super("Diese Person hat bereits ein verknüpftes Benutzerkonto."); this.name = "PersonAlreadyHasUserError"; }
}
export class InvitationPersonNotFoundError extends Error {
  constructor() { super("Person nicht gefunden."); this.name = "InvitationPersonNotFoundError"; }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateInvitationInput = {
  tenantId: string;
  actorUserId: string;
  email: string;
  /** Target an existing Person in this tenant. Mutually exclusive with newPerson. */
  existingPersonId?: string;
  /** Create a new Person and invite them. Mutually exclusive with existingPersonId. */
  newPerson?: {
    firstName: string;
    lastName: string;
  };
  appBaseUrl?: string;
};

export type CreateInvitationResult = {
  invitationId: string;
  personId: string;
};

export type ResendInvitationInput = {
  invitationId: string;
  tenantId: string;
  actorUserId: string;
  appBaseUrl?: string;
};

export type RevokeInvitationInput = {
  invitationId: string;
  tenantId: string;
  actorUserId: string;
};

export type AcceptInvitationInput = {
  rawToken: string;
  /** Required for new-account path. Ignored if a global User already exists. */
  firstName?: string;
  lastName?: string;
  password?: string;
};

export type AcceptInvitationResult = {
  userId: string;
  personId: string;
  tenantId: string;
  alreadyAccepted: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getTenantName(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name ?? "SportClubEvo";
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates an invitation targeting a Person.
 *
 * - If existingPersonId is given: validates the Person belongs to tenantId,
 *   that they don't already have a User, and revokes any prior PENDING invitation.
 * - If newPerson is given: creates the Person first (same tenant), then invites.
 * - Sends the invitation email via Resend.
 */
export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const { tenantId, actorUserId, email, existingPersonId, newPerson, appBaseUrl } = input;

  let personId: string;
  let personName: string;

  if (existingPersonId) {
    const person = await prisma.person.findFirst({
      where: { id: existingPersonId, tenantId },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });
    if (!person) throw new InvitationPersonNotFoundError();
    if (person.userId) throw new PersonAlreadyHasUserError();

    personId = person.id;
    personName = `${person.firstName} ${person.lastName}`;

    // Revoke any prior PENDING invitation for this person (at most one at a time).
    await prisma.invitation.updateMany({
      where: { tenantId, personId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } else if (newPerson) {
    const created = await prisma.person.create({
      data: {
        tenantId,
        firstName: newPerson.firstName,
        lastName: newPerson.lastName,
        email,
      },
      select: { id: true },
    });
    personId = created.id;
    personName = `${newPerson.firstName} ${newPerson.lastName}`;
  } else {
    throw new Error("existingPersonId or newPerson must be provided.");
  }

  const { rawToken, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const invitation = await prisma.invitation.create({
    data: { tenantId, personId, email, tokenHash, expiresAt },
    select: { id: true },
  });

  const tenantName = await getTenantName(tenantId);
  const inviteUrl = buildInviteUrl(rawToken, appBaseUrl);

  await sendMail({
    to: email,
    ...buildInvitationEmail({
      inviteUrl,
      recipientEmail: email,
      recipientName: personName,
      tenantName,
      expiryHours: INVITE_EXPIRY_HOURS,
      appBaseUrl,
    }),
  });

  await logAction({
    actorUserId,
    moduleKey: AUDIT_MODULE,
    entityType: "Invitation",
    entityId: invitation.id,
    action: "CREATE",
    afterJson: { tenantId, personId, email },
  });

  return { invitationId: invitation.id, personId };
}

/**
 * Resends a PENDING invitation with a fresh token.
 * Revokes the old token and creates a new one atomically.
 */
export async function resendInvitation(
  input: ResendInvitationInput,
): Promise<void> {
  const { invitationId, tenantId, actorUserId, appBaseUrl } = input;

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId },
    select: {
      id: true,
      email: true,
      personId: true,
      acceptedAt: true,
      revokedAt: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });
  if (!invitation) throw new InvitationNotFoundError();
  if (invitation.acceptedAt) throw new InvitationAlreadyAcceptedError();
  if (invitation.revokedAt) throw new InvitationAlreadyRevokedError();

  const { rawToken, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  // Atomically update to fresh token
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { tokenHash, expiresAt },
  });

  const tenantName = await getTenantName(tenantId);
  const personName = `${invitation.person.firstName} ${invitation.person.lastName}`;
  const inviteUrl = buildInviteUrl(rawToken, appBaseUrl);

  await sendMail({
    to: invitation.email,
    ...buildInvitationEmail({
      inviteUrl,
      recipientEmail: invitation.email,
      recipientName: personName,
      tenantName,
      expiryHours: INVITE_EXPIRY_HOURS,
      appBaseUrl,
    }),
  });

  await logAction({
    actorUserId,
    moduleKey: AUDIT_MODULE,
    entityType: "Invitation",
    entityId: invitationId,
    action: "RESEND",
    afterJson: { tenantId, personId: invitation.personId, email: invitation.email },
  });
}

/**
 * Revokes a PENDING invitation. Never deletes or modifies the Person.
 */
export async function revokeInvitation(
  input: RevokeInvitationInput,
): Promise<void> {
  const { invitationId, tenantId, actorUserId } = input;

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId },
    select: { id: true, personId: true, acceptedAt: true, revokedAt: true, email: true },
  });
  if (!invitation) throw new InvitationNotFoundError();
  if (invitation.acceptedAt) throw new InvitationAlreadyAcceptedError();
  if (invitation.revokedAt) throw new InvitationAlreadyRevokedError();

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });

  await logAction({
    actorUserId,
    moduleKey: AUDIT_MODULE,
    entityType: "Invitation",
    entityId: invitationId,
    action: "REVOKE",
    afterJson: { tenantId, personId: invitation.personId, email: invitation.email },
  });
}

/**
 * Accepts an invitation by raw token.
 *
 * Flow:
 *   1. Validate token (hash lookup, expiry, not accepted/revoked).
 *   2. Find or create global User for the invitation email.
 *      - If User exists: reuse it. Never create a duplicate account.
 *      - If User is new: requires firstName, lastName, password in input.
 *   3. Create TenantMembership if not already present.
 *   4. Link Person.userId → User (per-tenant unique).
 *   5. Mark invitation accepted.
 *
 * Idempotent: if the invitation is already accepted, returns success with
 * alreadyAccepted=true.
 *
 * NEVER:
 *   - Creates a second Person.
 *   - Modifies existing UserRole, passwordHash, or TenantMembership.isActive.
 *   - Fails silently on Person link conflicts (throws).
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const { rawToken } = input;
  if (!rawToken) throw new InvitationNotFoundError();

  const tokenHash = hashInviteToken(rawToken);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tenantId: true,
      personId: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      person: { select: { id: true, userId: true, tenantId: true } },
    },
  });

  if (!invitation) throw new InvitationNotFoundError();
  if (invitation.revokedAt) throw new InvitationAlreadyRevokedError();

  // Idempotent: already accepted → return success
  if (invitation.acceptedAt) {
    // Find the linked user via person
    const person = await prisma.person.findUnique({
      where: { id: invitation.personId },
      select: { userId: true },
    });
    return {
      userId: person?.userId ?? "",
      personId: invitation.personId,
      tenantId: invitation.tenantId,
      alreadyAccepted: true,
    };
  }

  if (invitation.expiresAt < new Date()) throw new InvitationExpiredError();

  // 2. Find or create global User
  let user = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, isActive: true },
  });

  if (!user) {
    // New user path — requires name + password
    const firstName = input.firstName?.trim() || "";
    const lastName = input.lastName?.trim() || "";
    const password = input.password || "";

    if (!firstName || !lastName || !password) {
      throw new Error("Vorname, Nachname und Passwort sind erforderlich.");
    }

    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: {
        email: invitation.email,
        firstName,
        lastName,
        passwordHash,
        isActive: true,
      },
      select: { id: true, isActive: true },
    });
  }

  const userId = user.id;

  // 3. Create TenantMembership if not already present
  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: invitation.tenantId, userId } },
    update: {},
    create: { tenantId: invitation.tenantId, userId, isActive: true },
  });

  // 4. Link Person.userId (per-tenant unique — safe to set here)
  // Only link if the Person doesn't already have a different user.
  // If it has the same user (idempotent repeat), that's fine.
  const currentPerson = invitation.person;
  if (!currentPerson.userId) {
    await prisma.person.update({
      where: { id: invitation.personId },
      data: { userId },
    });
  } else if (currentPerson.userId !== userId) {
    throw new Error("Diese Person ist bereits mit einem anderen Benutzerkonto verknüpft.");
  }

  // 5. Mark accepted
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  await logAction({
    actorUserId: userId,
    moduleKey: AUDIT_MODULE,
    entityType: "Invitation",
    entityId: invitation.id,
    action: "ACCEPT",
    afterJson: { tenantId: invitation.tenantId, personId: invitation.personId, userId },
  });

  return {
    userId,
    personId: invitation.personId,
    tenantId: invitation.tenantId,
    alreadyAccepted: false,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type InvitationListItem = {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  person: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export async function getInvitationsForTenant(
  tenantId: string,
): Promise<InvitationListItem[]> {
  const invitations = await prisma.invitation.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      person: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const now = new Date();
  return invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    status: computeStatus(inv, now),
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
    person: {
      id: inv.person.id,
      firstName: inv.person.firstName,
      lastName: inv.person.lastName,
    },
  }));
}

function computeStatus(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (inv.acceptedAt) return "ACCEPTED";
  if (inv.revokedAt) return "REVOKED";
  if (inv.expiresAt < now) return "EXPIRED";
  return "PENDING";
}

// ── URL helper ────────────────────────────────────────────────────────────────

function buildInviteUrl(rawToken: string, appBaseUrl?: string): string {
  const base = appBaseUrl ?? process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "";
  return `${base}/accept-invitation?token=${rawToken}`;
}
