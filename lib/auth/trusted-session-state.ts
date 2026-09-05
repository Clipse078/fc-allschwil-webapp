import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { JWT } from "next-auth/jwt";
import {
  resolveSessionPermissionKeys,
  resolveTenantMembershipContext,
} from "@/lib/auth/session-context";

export type SessionUserShape = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKeys: string[];
  permissionKeys: string[];
  isImpersonating: boolean;
  actorUserId?: string;
  actorEmail?: string;
  actorName?: string;
  effectiveUserId: string;
  activeTenantId: string | null;
  activeMembershipId: string | null;
  availableTenants: { id: string; key: string; name: string }[];
};

type TrustedSessionUpdateIntent =
  | { kind: "start-impersonation"; actorUserId: string; targetUserId: string }
  | { kind: "stop-impersonation"; actorUserId: string }
  | { kind: "refresh-effective-user"; actorUserId: string };

type PendingIntent = {
  expiresAt: number;
  intent: TrustedSessionUpdateIntent;
};

const TRUSTED_UPDATE_FIELD = "__sceTrustedSessionUpdate";
const INTENT_TTL_MS = 30_000;
const AUTHORIZATION_CONTEXT_VERSION = 1;
const pendingIntents = new Map<string, PendingIntent>();

type ActorSecurityState = {
  isActive: boolean;
  passwordChangedAt: Date | null;
};

/**
 * Resolve the original authentication time without trusting update payloads.
 *
 * New sessions receive `authenticatedAt` at credential sign-in. For a legacy
 * encrypted Auth.js token, its signed `iat` is accepted once and promoted to
 * `authenticatedAt`. Auth.js rewrites `iat` during normal refresh, so it must
 * never replace an already-present dedicated timestamp.
 */
export function resolveOriginalAuthenticationTime(token: JWT): number | null {
  if (token.authenticatedAt !== undefined) {
    return typeof token.authenticatedAt === "number" &&
      Number.isSafeInteger(token.authenticatedAt) &&
      token.authenticatedAt > 0
      ? token.authenticatedAt
      : null;
  }

  return typeof token.iat === "number" &&
    Number.isSafeInteger(token.iat) &&
    token.iat > 0
    ? token.iat * 1000
    : null;
}

export function isActorSessionCurrent(
  actor: ActorSecurityState | null,
  authenticatedAt: number | null,
): boolean {
  if (!actor?.isActive || authenticatedAt === null) return false;
  if (!actor.passwordChangedAt) return true;
  return authenticatedAt >= actor.passwordChangedAt.getTime();
}

async function loadActorSecurityState(
  prisma: PrismaClient,
  actorUserId: string,
): Promise<ActorSecurityState | null> {
  return prisma.user.findUnique({
    where: { id: actorUserId },
    select: { isActive: true, passwordChangedAt: true },
  });
}

async function isCurrentEffectiveUserEligible(
  prisma: PrismaClient,
  effectiveUserId: string,
  tenantId: string,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: effectiveUserId,
      isActive: true,
      tenantMemberships: {
        some: {
          tenantId,
          isActive: true,
          tenant: { status: "ACTIVE" },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(user);
}

function removeExpiredIntents(now = Date.now()) {
  for (const [capability, pending] of pendingIntents) {
    if (pending.expiresAt <= now) pendingIntents.delete(capability);
  }
}

/**
 * Creates a one-use, process-local capability for the immediately nested
 * Auth.js unstable_update() call. Only the random capability crosses the
 * Auth.js JSON boundary; its authorization-bearing intent remains server-side.
 */
export function issueTrustedSessionUpdateIntent(intent: TrustedSessionUpdateIntent): string {
  removeExpiredIntents();
  const capability = randomBytes(32).toString("base64url");
  pendingIntents.set(capability, {
    expiresAt: Date.now() + INTENT_TTL_MS,
    intent,
  });
  return capability;
}

export function revokeTrustedSessionUpdateIntent(capability: string) {
  pendingIntents.delete(capability);
}

function consumeTrustedSessionUpdateIntent(
  capability: unknown,
  canonicalActorUserId: string,
): TrustedSessionUpdateIntent | null {
  if (typeof capability !== "string") return null;

  const pending = pendingIntents.get(capability);
  pendingIntents.delete(capability);

  if (
    !pending ||
    pending.expiresAt <= Date.now() ||
    pending.intent.actorUserId !== canonicalActorUserId
  ) {
    return null;
  }

  return pending.intent;
}

export function trustedUpdatePayload(capability: string): Record<string, string> {
  return { [TRUSTED_UPDATE_FIELD]: capability };
}

function trustedCapabilityFromSession(session: unknown): unknown {
  if (!session || typeof session !== "object") return undefined;
  return (session as Record<string, unknown>)[TRUSTED_UPDATE_FIELD];
}

export async function loadLiveSessionUser(
  prisma: PrismaClient,
  userId: string,
): Promise<SessionUserShape | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      userRoles: {
        select: { role: { select: { key: true } } },
      },
    },
  });

  if (!user?.isActive) return null;

  const tenantContext = await resolveTenantMembershipContext(prisma, user.id);
  const permissionKeys = await resolveSessionPermissionKeys(
    prisma,
    user.id,
    tenantContext.activeTenantId,
  );

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleKeys: Array.from(new Set(user.userRoles.map((userRole) => userRole.role.key))),
    permissionKeys,
    isImpersonating: false,
    effectiveUserId: user.id,
    activeTenantId: tenantContext.activeTenantId,
    activeMembershipId: tenantContext.activeMembershipId,
    availableTenants: tenantContext.availableTenants,
  };
}

function normalizeLoginUser(value: Partial<SessionUserShape>): SessionUserShape {
  const id = String(value.id ?? "");
  return {
    id,
    email: String(value.email ?? ""),
    firstName: String(value.firstName ?? ""),
    lastName: String(value.lastName ?? ""),
    roleKeys: Array.isArray(value.roleKeys) ? value.roleKeys.map(String) : [],
    permissionKeys: Array.isArray(value.permissionKeys)
      ? value.permissionKeys.map(String)
      : [],
    isImpersonating: false,
    effectiveUserId: id,
    activeTenantId: typeof value.activeTenantId === "string" ? value.activeTenantId : null,
    activeMembershipId:
      typeof value.activeMembershipId === "string" ? value.activeMembershipId : null,
    availableTenants: Array.isArray(value.availableTenants)
      ? value.availableTenants
      : [],
  };
}

function applyEffectiveUserState(
  token: JWT,
  state: SessionUserShape,
  isImpersonating: boolean,
) {
  token.id = state.id;
  token.email = state.email;
  token.firstName = state.firstName;
  token.lastName = state.lastName;
  token.roleKeys = state.roleKeys;
  token.permissionKeys = state.permissionKeys;
  token.isImpersonating = isImpersonating;
  token.effectiveUserId = state.id;
  token.activeTenantId = state.activeTenantId;
  token.activeMembershipId = state.activeMembershipId;
  token.availableTenants = state.availableTenants;
}

type JwtUpdateInput = {
  token: JWT;
  user?: unknown;
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
};

export async function applyTrustedJwtState(
  { token, user, trigger, session }: JwtUpdateInput,
  prisma: PrismaClient,
): Promise<JWT | null> {
  if (user) {
    const loginUser = normalizeLoginUser(user as Partial<SessionUserShape>);
    const canonicalActorUserId =
      typeof token.sub === "string" && token.sub ? token.sub : loginUser.id;

    if (!canonicalActorUserId) return null;

    token.sub = canonicalActorUserId;
    token.actorUserId = canonicalActorUserId;
    token.authenticatedAt = Date.now();
    token.actorEmail = loginUser.email;
    token.actorName =
      `${loginUser.firstName} ${loginUser.lastName}`.trim() || loginUser.email;
    applyEffectiveUserState(token, loginUser, false);
    token.authorizationContextVersion = AUTHORIZATION_CONTEXT_VERSION;
    return token;
  }

  const canonicalActorUserId =
    typeof token.sub === "string" && token.sub ? token.sub : null;

  if (!canonicalActorUserId) return null;

  // The signed JWT subject is the canonical actor. Never accept actor identity
  // from update data, and repair the redundant display field on every callback.
  token.actorUserId = canonicalActorUserId;

  const authenticatedAt = resolveOriginalAuthenticationTime(token);
  const actorSecurityState = await loadActorSecurityState(
    prisma,
    canonicalActorUserId,
  );
  if (
    authenticatedAt === null ||
    !isActorSessionCurrent(actorSecurityState, authenticatedAt)
  ) {
    return null;
  }

  // Migration compatibility for encrypted tokens issued before this field
  // existed. This is derived only from the signed token, never update data.
  if (token.authenticatedAt === undefined) {
    token.authenticatedAt = authenticatedAt;
  }

  // Tokens issued before this trust boundary existed may contain client-forged
  // authorization fields. Rebuild them as the canonical actor before use.
  if (
    token.authorizationContextVersion !== AUTHORIZATION_CONTEXT_VERSION
  ) {
    const actor = await loadLiveSessionUser(prisma, canonicalActorUserId);
    if (!actor) {
      token.id = "";
      token.effectiveUserId = "";
      token.roleKeys = [];
      token.permissionKeys = [];
      token.isImpersonating = false;
      token.activeTenantId = null;
      token.activeMembershipId = null;
      token.availableTenants = [];
      return token;
    }
    token.actorEmail = actor.email;
    token.actorName = `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
    applyEffectiveUserState(token, actor, false);
    token.authorizationContextVersion = AUTHORIZATION_CONTEXT_VERSION;
  }

  if (token.isImpersonating) {
    const effectiveUserId =
      typeof token.effectiveUserId === "string" ? token.effectiveUserId : "";
    const activeTenantId =
      typeof token.activeTenantId === "string" ? token.activeTenantId : "";
    if (
      !effectiveUserId ||
      !activeTenantId ||
      !(await isCurrentEffectiveUserEligible(
        prisma,
        effectiveUserId,
        activeTenantId,
      ))
    ) {
      return null;
    }
  }

  if (trigger !== "update" || !canonicalActorUserId) return token;

  const intent = consumeTrustedSessionUpdateIntent(
    trustedCapabilityFromSession(session),
    canonicalActorUserId,
  );

  // Generic client update() calls have no server-issued one-use capability.
  // Their entire payload is ignored, including presentation fields.
  if (!intent) return token;

  if (intent.kind === "start-impersonation") {
    if (token.isImpersonating) return token;
    const target = await loadLiveSessionUser(prisma, intent.targetUserId);
    if (
      !target?.activeTenantId ||
      !target.activeMembershipId ||
      !(await isCurrentEffectiveUserEligible(
        prisma,
        target.id,
        target.activeTenantId,
      ))
    ) {
      return token;
    }
    applyEffectiveUserState(token, target, true);
    return token;
  }

  if (intent.kind === "stop-impersonation") {
    if (!token.isImpersonating) return token;
    const actor = await loadLiveSessionUser(prisma, canonicalActorUserId);
    if (!actor) return token;
    token.actorEmail = actor.email;
    token.actorName = `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
    applyEffectiveUserState(token, actor, false);
    return token;
  }

  const effectiveUserId =
    typeof token.effectiveUserId === "string" && token.effectiveUserId
      ? token.effectiveUserId
      : typeof token.id === "string"
        ? token.id
        : "";
  const effectiveUser = await loadLiveSessionUser(prisma, effectiveUserId);
  if (!effectiveUser) return token;

  if (effectiveUser.id === canonicalActorUserId) {
    token.actorEmail = effectiveUser.email;
    token.actorName =
      `${effectiveUser.firstName} ${effectiveUser.lastName}`.trim() ||
      effectiveUser.email;
  }
  applyEffectiveUserState(token, effectiveUser, Boolean(token.isImpersonating));
  return token;
}

export function applyTokenToSessionUser<T extends { user?: unknown }>(
  session: T,
  token: JWT,
): T {
  if (!session.user || typeof session.user !== "object") return session;
  const sessionUser = session.user as Record<string, unknown>;

  sessionUser.id = String(token.id ?? "");
  sessionUser.email = String(token.email ?? "");
  sessionUser.firstName = String(token.firstName ?? "");
  sessionUser.lastName = String(token.lastName ?? "");
  sessionUser.roleKeys = Array.isArray(token.roleKeys) ? token.roleKeys.map(String) : [];
  sessionUser.permissionKeys = Array.isArray(token.permissionKeys)
    ? token.permissionKeys.map(String)
    : [];
  sessionUser.isImpersonating = Boolean(token.isImpersonating);
  sessionUser.actorUserId =
    typeof token.sub === "string" ? token.sub : undefined;
  sessionUser.actorEmail =
    typeof token.actorEmail === "string" ? token.actorEmail : undefined;
  sessionUser.actorName =
    typeof token.actorName === "string" ? token.actorName : undefined;
  sessionUser.effectiveUserId =
    typeof token.effectiveUserId === "string"
      ? token.effectiveUserId
      : sessionUser.id;
  sessionUser.activeTenantId =
    typeof token.activeTenantId === "string" ? token.activeTenantId : null;
  sessionUser.activeMembershipId =
    typeof token.activeMembershipId === "string" ? token.activeMembershipId : null;
  sessionUser.availableTenants = Array.isArray(token.availableTenants)
    ? token.availableTenants
    : [];

  return session;
}
