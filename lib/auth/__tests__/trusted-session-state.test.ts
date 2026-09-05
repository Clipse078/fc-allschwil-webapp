import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { JWT } from "next-auth/jwt";

const mocks = vi.hoisted(() => ({
  resolveTenantMembershipContext: vi.fn(),
  resolveSessionPermissionKeys: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session-context", () => ({
  resolveTenantMembershipContext: mocks.resolveTenantMembershipContext,
  resolveSessionPermissionKeys: mocks.resolveSessionPermissionKeys,
}));

import {
  applyTokenToSessionUser,
  applyTrustedJwtState,
  issueTrustedSessionUpdateIntent,
  trustedUpdatePayload,
} from "@/lib/auth/trusted-session-state";

const prisma = {
  user: { findUnique: mocks.userFindUnique },
} as unknown as PrismaClient;

const actorToken: JWT = {
  sub: "actor-1",
  id: "actor-1",
  email: "actor@example.com",
  firstName: "Alice",
  lastName: "Actor",
  roleKeys: ["member"],
  permissionKeys: ["teams.view"],
  isImpersonating: false,
  actorUserId: "actor-1",
  actorEmail: "actor@example.com",
  actorName: "Alice Actor",
  effectiveUserId: "actor-1",
  activeTenantId: "tenant-a",
  activeMembershipId: "membership-a",
  availableTenants: [{ id: "tenant-a", key: "a", name: "Tenant A" }],
  authorizationContextVersion: 1,
};

function cloneToken(token: JWT = actorToken): JWT {
  return structuredClone(token);
}

function liveUser(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id === "actor-1" ? "Alice" : "Terry",
    lastName: id === "actor-1" ? "Actor" : "Target",
    isActive: true,
    userRoles: [{ role: { key: "member" } }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveTenantMembershipContext.mockImplementation(
    async (_prisma: unknown, userId: string) => ({
      activeTenantId: `tenant-${userId}`,
      activeMembershipId: `membership-${userId}`,
      availableTenants: [
        { id: `tenant-${userId}`, key: userId, name: `Tenant ${userId}` },
      ],
    }),
  );
  mocks.resolveSessionPermissionKeys.mockImplementation(
    async (_prisma: unknown, userId: string) => [`permission:${userId}`],
  );
  mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    liveUser(where.id),
  );
});

describe("generic client session update trust boundary", () => {
  const attackCases = [
    ["canonical user id", { id: "tenant-b-admin" }],
    ["token subject/identity", { sub: "tenant-b-admin", email: "evil@example.com" }],
    ["active tenant", { activeTenantId: "tenant-b" }],
    ["active membership", { activeMembershipId: "membership-b" }],
    [
      "available tenants",
      { availableTenants: [{ id: "tenant-b", key: "b", name: "Tenant B" }] },
    ],
    ["effective user", { effectiveUserId: "tenant-b-admin" }],
    ["roles", { roleKeys: ["super_admin"] }],
    ["permissions", { permissionKeys: ["*"] }],
    ["impersonation state", { isImpersonating: true }],
    ["actor id", { actorUserId: "tenant-b-admin" }],
    ["actor email", { actorEmail: "evil@example.com" }],
    ["actor name", { actorName: "Forged Actor" }],
    ["nonexistent tenant", { activeTenantId: "does-not-exist" }],
  ] as const;

  it.each(attackCases)("ignores forged %s", async (_label, userPayload) => {
    const token = cloneToken();
    const before = cloneToken(token);

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: { user: userPayload },
      },
      prisma,
    );

    expect(token).toEqual(before);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("ignores a combined cross-tenant admin impersonation payload", async () => {
    const token = cloneToken();
    const before = cloneToken(token);

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: {
          __sceTrustedSessionUpdate: "browser-guessed-value",
          user: {
            id: "tenant-b-admin",
            sub: "tenant-b-admin",
            email: "admin@tenant-b.example",
            activeTenantId: "tenant-b",
            activeMembershipId: "membership-b",
            availableTenants: [{ id: "tenant-b", key: "b", name: "Tenant B" }],
            effectiveUserId: "tenant-b-admin",
            roleKeys: ["super_admin"],
            permissionKeys: ["*"],
            isImpersonating: true,
            actorUserId: "tenant-b-admin",
            actorEmail: "admin@tenant-b.example",
            actorName: "Forged Admin",
          },
        },
      },
      prisma,
    );

    expect(token).toEqual(before);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rebuilds pre-boundary tokens from the immutable JWT subject", async () => {
    const token = cloneToken({
      ...actorToken,
      id: "forged-user",
      effectiveUserId: "forged-user",
      activeTenantId: "foreign-tenant",
      permissionKeys: ["*"],
      isImpersonating: true,
      actorUserId: "forged-actor",
      authorizationContextVersion: undefined,
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: { user: { id: "another-forged-user", permissionKeys: ["*"] } },
      },
      prisma,
    );

    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "actor-1" } }),
    );
    expect(token).toMatchObject({
      sub: "actor-1",
      id: "actor-1",
      actorUserId: "actor-1",
      effectiveUserId: "actor-1",
      isImpersonating: false,
      activeTenantId: "tenant-actor-1",
      permissionKeys: ["permission:actor-1"],
      authorizationContextVersion: 1,
    });
  });
});

describe("trusted login, session, and refresh behavior", () => {
  it("creates a normal token with an immutable canonical actor", async () => {
    const token: JWT = { sub: "actor-1" };

    await applyTrustedJwtState(
      {
        token,
        user: {
          id: "actor-1",
          email: "actor@example.com",
          firstName: "Alice",
          lastName: "Actor",
          roleKeys: ["member"],
          permissionKeys: ["teams.view"],
          activeTenantId: "tenant-a",
          activeMembershipId: "membership-a",
          availableTenants: [{ id: "tenant-a", key: "a", name: "Tenant A" }],
        },
      },
      prisma,
    );

    expect(token).toMatchObject({
      sub: "actor-1",
      id: "actor-1",
      actorUserId: "actor-1",
      effectiveUserId: "actor-1",
      isImpersonating: false,
      authorizationContextVersion: 1,
    });
  });

  it("creates the client session explicitly from trusted token fields", () => {
    const session = applyTokenToSessionUser({ user: {} }, cloneToken());

    expect(session.user).toEqual({
      id: "actor-1",
      email: "actor@example.com",
      firstName: "Alice",
      lastName: "Actor",
      roleKeys: ["member"],
      permissionKeys: ["teams.view"],
      isImpersonating: false,
      actorUserId: "actor-1",
      actorEmail: "actor@example.com",
      actorName: "Alice Actor",
      effectiveUserId: "actor-1",
      activeTenantId: "tenant-a",
      activeMembershipId: "membership-a",
      availableTenants: [{ id: "tenant-a", key: "a", name: "Tenant A" }],
    });
  });

  it("leaves a normal session refresh unchanged", async () => {
    const token = cloneToken();
    const before = cloneToken(token);
    await applyTrustedJwtState({ token }, prisma);
    expect(token).toEqual(before);
  });

  it("refreshes presentation and authorization fields from live server state", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(
      liveUser("actor-1", { firstName: "Updated", lastName: "Name" }),
    );
    const token = cloneToken();
    const capability = issueTrustedSessionUpdateIntent({
      kind: "refresh-effective-user",
      actorUserId: "actor-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toMatchObject({
      firstName: "Updated",
      lastName: "Name",
      actorName: "Updated Name",
      activeTenantId: "tenant-actor-1",
      permissionKeys: ["permission:actor-1"],
    });
  });
});

describe("trusted impersonation lifecycle", () => {
  it("starts impersonation with server-derived effective identity and tenant", async () => {
    const token = cloneToken();
    const capability = issueTrustedSessionUpdateIntent({
      kind: "start-impersonation",
      actorUserId: "actor-1",
      targetUserId: "target-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toMatchObject({
      sub: "actor-1",
      actorUserId: "actor-1",
      actorEmail: "actor@example.com",
      id: "target-1",
      effectiveUserId: "target-1",
      isImpersonating: true,
      activeTenantId: "tenant-target-1",
      activeMembershipId: "membership-target-1",
      permissionKeys: ["permission:target-1"],
    });
  });

  it("does not start impersonation without a capability issued for this actor", async () => {
    const token = cloneToken();
    const before = cloneToken(token);
    const capability = issueTrustedSessionUpdateIntent({
      kind: "start-impersonation",
      actorUserId: "different-actor",
      targetUserId: "target-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toEqual(before);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("fails closed when the target user is inactive", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(liveUser("target-1", { isActive: false }));
    const token = cloneToken();
    const before = cloneToken(token);
    const capability = issueTrustedSessionUpdateIntent({
      kind: "start-impersonation",
      actorUserId: "actor-1",
      targetUserId: "target-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toEqual(before);
  });

  it("exposes no tenant or permissions when the target has no live membership", async () => {
    mocks.resolveTenantMembershipContext.mockResolvedValueOnce({
      activeTenantId: null,
      activeMembershipId: null,
      availableTenants: [],
    });
    mocks.resolveSessionPermissionKeys.mockResolvedValueOnce([]);
    const token = cloneToken();
    const capability = issueTrustedSessionUpdateIntent({
      kind: "start-impersonation",
      actorUserId: "actor-1",
      targetUserId: "target-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toMatchObject({
      effectiveUserId: "target-1",
      activeTenantId: null,
      activeMembershipId: null,
      availableTenants: [],
      permissionKeys: [],
    });
  });

  it("stops impersonation by restoring the subject actor from live state", async () => {
    const token = cloneToken({
      ...actorToken,
      id: "target-1",
      email: "target-1@example.com",
      firstName: "Terry",
      lastName: "Target",
      effectiveUserId: "target-1",
      isImpersonating: true,
      activeTenantId: "tenant-target-1",
      activeMembershipId: "membership-target-1",
    });
    const capability = issueTrustedSessionUpdateIntent({
      kind: "stop-impersonation",
      actorUserId: "actor-1",
    });

    await applyTrustedJwtState(
      {
        token,
        trigger: "update",
        session: trustedUpdatePayload(capability),
      },
      prisma,
    );

    expect(token).toMatchObject({
      sub: "actor-1",
      actorUserId: "actor-1",
      id: "actor-1",
      effectiveUserId: "actor-1",
      isImpersonating: false,
      activeTenantId: "tenant-actor-1",
      permissionKeys: ["permission:actor-1"],
    });
  });
});
