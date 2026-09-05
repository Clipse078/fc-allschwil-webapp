import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { create: mocks.auditLogCreate } },
}));

import {
  buildAuditData,
  logAction,
  logSecurityAction,
} from "@/lib/audit/log-action";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditLogCreate.mockResolvedValue({});
});

describe("logAction impersonation accountability", () => {
  it("records the canonical actor and effective user during impersonation", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "effective-user",
        effectiveUserId: "effective-user",
        actorUserId: "canonical-actor",
        isImpersonating: true,
      },
    });

    await logAction({
      actorUserId: "effective-user",
      tenantId: "tenant-1",
      moduleKey: "teams",
      entityType: "Team",
      entityId: "team-1",
      action: "updated",
      metadataJson: { source: "route" },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "canonical-actor",
        metadataJson: {
          source: "route",
          outcome: "SUCCESS",
          actorUserId: "canonical-actor",
          effectiveUserId: "effective-user",
        },
        tenantId: "tenant-1",
      }),
    });
  });

  it("keeps the supplied actor for a normal authenticated session", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        actorUserId: "user-1",
        isImpersonating: false,
      },
    });

    await logAction({
      actorUserId: "user-1",
      moduleKey: "account",
      entityType: "User",
      entityId: "user-1",
      action: "updated",
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        metadataJson: { outcome: "SUCCESS" },
      }),
    });
  });

  it("preserves explicit trusted actors when request auth is unavailable", async () => {
    mocks.auth.mockRejectedValue(new Error("no request context"));

    await logAction({
      actorUserId: "script-actor",
      moduleKey: "maintenance",
      entityType: "Job",
      entityId: "job-1",
      action: "completed",
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorUserId: "script-actor" }),
    });
  });

  it("does not attach a browser session to system audit events", async () => {
    await logAction({
      actorUserId: null,
      moduleKey: "email",
      entityType: "Message",
      entityId: "message-1",
      action: "received",
    });

    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorUserId: null }),
    });
  });

  it("derives tenant scope from the trusted request session", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        actorUserId: "user-1",
        effectiveUserId: "user-1",
        activeTenantId: "tenant-session",
        isImpersonating: false,
      },
    });

    await logAction({
      actorUserId: "user-1",
      moduleKey: "roles",
      entityType: "Role",
      entityId: "role-1",
      action: "CREATE",
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-session" }),
    });
  });

  it("rejects an explicit cross-tenant audit scope", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        effectiveUserId: "user-1",
        activeTenantId: "tenant-session",
        isImpersonating: false,
      },
    });

    await expect(
      logSecurityAction({
        actorUserId: "user-1",
        tenantId: "tenant-attacker",
        moduleKey: "roles",
        entityType: "Role",
        entityId: "role-1",
        action: "CREATE",
      }),
    ).rejects.toThrow("Audit tenant does not match the active tenant");
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});

describe("audit payload safety", () => {
  it("removes credentials, hashes, reset/invite tokens, capabilities, and URLs", () => {
    const data = buildAuditData({
      actorUserId: "actor-1",
      effectiveUserId: "effective-1",
      tenantId: "tenant-1",
      moduleKey: "security",
      entityType: "User",
      entityId: "user-1",
      action: "PASSWORD_RESET_COMPLETED",
      beforeJson: {
        passwordHash: "bcrypt-secret",
        nested: { apiKey: "api-secret", keep: "safe" },
      },
      afterJson: {
        resetToken: "raw-reset-token",
        inviteToken: "raw-invite-token",
        signedUrl: "https://blob.example/private?token=secret",
      },
      metadataJson: {
        capability: "signed-capability",
        targetUserId: "user-1",
      },
    });

    expect(JSON.stringify(data)).not.toContain("bcrypt-secret");
    expect(JSON.stringify(data)).not.toContain("raw-reset-token");
    expect(JSON.stringify(data)).not.toContain("raw-invite-token");
    expect(JSON.stringify(data)).not.toContain("signed-capability");
    expect(JSON.stringify(data)).not.toContain("blob.example");
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      beforeJson: { nested: { keep: "safe" } },
      afterJson: {},
      metadataJson: {
        targetUserId: "user-1",
        outcome: "SUCCESS",
        actorUserId: "actor-1",
        effectiveUserId: "effective-1",
      },
    });
  });

  it("records explicit denied outcomes without copying rejected secrets", () => {
    const data = buildAuditData({
      actorUserId: "actor-1",
      tenantId: null,
      moduleKey: "security",
      entityType: "Role",
      entityId: "role-1",
      action: "PLATFORM_PERMISSION_CHANGE_REJECTED",
      outcome: "DENIED",
      metadataJson: {
        reasonCode: "INVALID_PERMISSION_SCOPE",
        submittedToken: "must-not-persist",
      },
    });

    expect(data.metadataJson).toEqual({
      reasonCode: "INVALID_PERMISSION_SCOPE",
      outcome: "DENIED",
    });
  });
});
