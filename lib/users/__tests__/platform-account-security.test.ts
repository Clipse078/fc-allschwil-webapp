import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userRoleCount: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
    userRole: { count: mocks.userRoleCount },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import {
  PlatformAccountDomainError,
  normalizePlatformAccountEmail,
  updatePlatformAccount,
} from "@/lib/users/platform-account-service";

function target(id: string, isActive = true) {
  return {
    id,
    firstName: "Platform",
    lastName: id,
    email: `${id}@example.test`,
    isActive,
    userRoles: [{ id: `super-${id}` }],
  };
}

function installTransaction() {
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: mocks.queryRaw,
        user: {
          findUnique: mocks.userFindUnique,
          update: mocks.userUpdate,
        },
        userRole: { count: mocks.userRoleCount },
      }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  installTransaction();
  mocks.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  mocks.logAction.mockResolvedValue(undefined);
});

describe("platform account lifecycle safety", () => {
  it("blocks disabling the last usable platform Superadmin", async () => {
    mocks.userFindUnique.mockResolvedValue(target("admin-a"));
    mocks.userRoleCount.mockResolvedValue(0);

    await expect(
      updatePlatformAccount({
        userId: "admin-a",
        firstName: "Platform",
        lastName: "A",
        email: "admin-a@example.test",
        isActive: false,
        actorUserId: "actor",
      }),
    ).rejects.toMatchObject<Partial<PlatformAccountDomainError>>({
      code: "LAST_SUPER_ADMIN",
    });

    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("allows disabling one Superadmin when another remains and revokes sessions", async () => {
    mocks.userFindUnique.mockResolvedValue(target("admin-a"));
    mocks.userRoleCount.mockResolvedValue(1);
    mocks.userUpdate.mockImplementation(({ data }) => ({
      id: "admin-a",
      ...target("admin-a"),
      ...data,
    }));

    await updatePlatformAccount({
      userId: "admin-a",
      firstName: "Platform",
      lastName: "A",
      email: "admin-a@example.test",
      isActive: false,
      actorUserId: "actor",
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("normalizes a safe email change and revokes prior sessions", async () => {
    mocks.userFindUnique.mockResolvedValue(target("admin-a"));
    mocks.userUpdate.mockImplementation(({ data }) => ({
      id: "admin-a",
      ...target("admin-a"),
      ...data,
    }));

    const result = await updatePlatformAccount({
      userId: "admin-a",
      firstName: "Platform",
      lastName: "A",
      email: "  NEW-ADMIN@Example.Test ",
      isActive: true,
      actorUserId: "actor",
    });

    expect(result.email).toBe("new-admin@example.test");
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new-admin@example.test",
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects an invalid privileged identity before opening a transaction", () => {
    expect(() => normalizePlatformAccountEmail("not-an-email")).toThrow(
      PlatformAccountDomainError,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("serializes concurrent disables so exactly one usable Superadmin remains", async () => {
    const active = new Map([
      ["admin-a", true],
      ["admin-b", true],
    ]);
    let queue = Promise.resolve();

    mocks.transaction.mockImplementation(
      <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const run = queue.then(() =>
          callback({
            $queryRawUnsafe: mocks.queryRaw,
            user: {
              findUnique: vi.fn(({ where }) =>
                target(where.id, active.get(where.id)),
              ),
              update: vi.fn(({ where, data }) => {
                active.set(where.id, data.isActive);
                return { ...target(where.id, data.isActive), ...data };
              }),
            },
            userRole: {
              count: vi.fn(({ where }) =>
                [...active].filter(
                  ([id, isActive]) => isActive && id !== where.userId.not,
                ).length,
              ),
            },
          }),
        );
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    );

    const disable = (userId: string) =>
      updatePlatformAccount({
        userId,
        firstName: "Platform",
        lastName: userId,
        email: `${userId}@example.test`,
        isActive: false,
        actorUserId: "actor",
      });
    const results = await Promise.allSettled([
      disable("admin-a"),
      disable("admin-b"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect([...active.values()].filter(Boolean)).toHaveLength(1);
  });
});
