import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { create: mocks.auditLogCreate } },
}));

import { logAction } from "@/lib/audit/log-action";

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
          actorUserId: "canonical-actor",
          effectiveUserId: "effective-user",
        },
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
        metadataJson: undefined,
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
});
