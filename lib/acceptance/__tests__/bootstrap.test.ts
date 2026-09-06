import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTANCE_CONFIRMATION,
  ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_FIXTURE,
  ACCEPTANCE_OPERATION_AUTHORIZATION,
  type AcceptancePasswords,
  assertAcceptanceBootstrapEnvironment,
  bootstrapAcceptanceData,
  getAcceptancePermissionDefinitions,
} from "@/lib/acceptance/bootstrap";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const DATABASE_URL =
  `postgresql://acceptance:secret@acceptance-db.example.com:5432/${ACCEPTANCE_DATABASE_NAME}`;

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ENV: "acceptance",
    VERCEL_TARGET_ENV: "acceptance",
    DATABASE_URL,
    ACCEPTANCE_DATABASE_HOST: "acceptance-db.example.com",
    ACCEPTANCE_BOOTSTRAP_CONFIRM: ACCEPTANCE_CONFIRMATION,
    SCE_OPERATION_AUTHORIZATION: ACCEPTANCE_OPERATION_AUTHORIZATION,
  };
}

const passwords = Object.fromEntries(
  Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
    user.passwordEnv,
    `test-${user.passwordEnv}-credential`,
  ]),
) as AcceptancePasswords;

type Row = Record<string, unknown> & { id: string };

function createMemoryTransaction() {
  const state = {
    permissions: new Map<string, Row>(),
    roles: new Map<string, Row>(),
    rolePermissions: new Map<string, Row>(),
    tenants: new Map<string, Row>(),
    users: new Map<string, Row>(),
    memberships: new Map<string, Row>(),
    userRoles: [] as Row[],
    orgUnits: new Map<string, Row>(),
    persons: new Map<string, Row>(),
    assignments: new Map<string, Row>(),
    personMemberships: new Map<string, Row>(),
  };
  let sequence = 0;
  const withId = (data: Record<string, unknown>): Row => ({
    id: (data.id as string | undefined) ?? `generated-${++sequence}`,
    ...data,
  });

  const tx = {
    permission: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        state.permissions.get(where.key) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.permissions.set(String(data.key), row);
        return row;
      }),
    },
    role: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        state.roles.get(where.key) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.roles.set(String(data.key), row);
        return row;
      }),
    },
    rolePermission: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { roleId_permissionId: { roleId: string; permissionId: string } };
        }) => {
          const key = `${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`;
          return state.rolePermissions.get(key) ?? null;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { roleId: string; permissionId: string };
        }) => {
          const row = withId(data);
          state.rolePermissions.set(`${data.roleId}:${data.permissionId}`, row);
          return row;
        },
      ),
    },
    tenant: {
      findFirst: vi.fn(async () => {
        return (
          [...state.tenants.values()].find((tenant) =>
            !String(tenant.key).startsWith("sce-acceptance-"),
          ) ?? null
        );
      }),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        state.tenants.get(where.key) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.tenants.set(String(data.key), row);
        return row;
      }),
    },
    user: {
      findFirst: vi.fn(async () => {
        return (
          [...state.users.values()].find((user) =>
            !String(user.email).endsWith("@acceptance.sportclubevo.com"),
          ) ?? null
        );
      }),
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) =>
        state.users.get(where.email) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.users.set(String(data.email), row);
        return row;
      }),
    },
    tenantMembership: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { tenantId_userId: { tenantId: string; userId: string } };
        }) => {
          const pair = where.tenantId_userId;
          return state.memberships.get(`${pair.tenantId}:${pair.userId}`) ?? null;
        },
      ),
      create: vi.fn(
        async ({ data }: { data: { tenantId: string; userId: string } }) => {
          const row = withId(data);
          state.memberships.set(`${data.tenantId}:${data.userId}`, row);
          return row;
        },
      ),
    },
    userRole: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            roleId: string;
            tenantId: string | null;
          };
        }) =>
          state.userRoles.find(
            (row) =>
              row.userId === where.userId &&
              row.roleId === where.roleId &&
              (row.tenantId ?? null) === where.tenantId,
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.userRoles.push(row);
        return row;
      }),
    },
    orgUnit: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { tenantId_key: { tenantId: string; key: string } };
        }) => {
          const compound = where.tenantId_key;
          return state.orgUnits.get(`${compound.tenantId}:${compound.key}`) ?? null;
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.orgUnits.set(`${data.tenantId}:${data.key}`, row);
        return row;
      }),
    },
    person: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.persons.get(where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.persons.set(row.id, row);
        return row;
      }),
    },
    personAssignment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.assignments.get(where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.assignments.set(row.id, row);
        return row;
      }),
    },
    personMembership: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.personMemberships.get(where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = withId(data);
        state.personMemberships.set(row.id, row);
        return row;
      }),
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    state,
    spies: tx,
  };
}

describe("Acceptance bootstrap environment guard", () => {
  it("configures the canonical bootstrap transaction with an explicit extended timeout", () => {
    expect(ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it("accepts only the explicit Acceptance classification and database identity", () => {
    expect(assertAcceptanceBootstrapEnvironment(validEnvironment())).toEqual({
      databaseUrl: DATABASE_URL,
      expectedHost: "acceptance-db.example.com",
    });
  });

  it.each([
    ["APP_ENV", "stage"],
    ["APP_ENV", "prod"],
    ["VERCEL_TARGET_ENV", "preview"],
    ["NODE_ENV", "development"],
  ])("refuses %s=%s", (name, value) => {
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        ...validEnvironment(),
        [name]: value,
      }),
    ).toThrow();
  });

  it("refuses a STAGE URL even when Acceptance flags are present", () => {
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        ...validEnvironment(),
        STAGE_DB_URL: DATABASE_URL,
      }),
    ).toThrow(/protected STAGE_DB_URL/);
  });

  it("refuses an unexpected host, database name, or missing confirmation", () => {
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        ...validEnvironment(),
        ACCEPTANCE_DATABASE_HOST: "stage-db.example.com",
      }),
    ).toThrow(/identity/);
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        ...validEnvironment(),
        DATABASE_URL:
          "postgresql://acceptance:secret@acceptance-db.example.com:5432/neondb",
      }),
    ).toThrow(/identity/);
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        ...validEnvironment(),
        ACCEPTANCE_BOOTSTRAP_CONFIRM: undefined,
      }),
    ).toThrow(/confirmation/);
  });
});

describe("Acceptance bootstrap data", () => {
  it("covers every canonical permission key exactly once", () => {
    const definitions = getAcceptancePermissionDefinitions();
    expect(definitions.map((definition) => definition.key).sort()).toEqual(
      Object.values(PERMISSIONS).sort(),
    );
    expect(new Set(definitions.map((definition) => definition.key)).size).toBe(
      Object.values(PERMISSIONS).length,
    );
  });

  it("is idempotent, preserves credentials, and creates isolated tenant fixtures", async () => {
    const memory = createMemoryTransaction();
    const hasher = vi.fn(async (password: string) => `hash:${password}`);

    await bootstrapAcceptanceData(memory.tx, passwords, hasher);
    const firstHashes = new Map(
      [...memory.state.users.entries()].map(([email, user]) => [
        email,
        user.passwordHash,
      ]),
    );
    const firstCounts = {
      tenants: memory.state.tenants.size,
      users: memory.state.users.size,
      memberships: memory.state.memberships.size,
      userRoles: memory.state.userRoles.length,
      persons: memory.state.persons.size,
      assignments: memory.state.assignments.size,
    };

    await bootstrapAcceptanceData(memory.tx, passwords, hasher);

    expect(hasher).toHaveBeenCalledTimes(5);
    expect(
      new Map(
        [...memory.state.users.entries()].map(([email, user]) => [
          email,
          user.passwordHash,
        ]),
      ),
    ).toEqual(firstHashes);
    expect({
      tenants: memory.state.tenants.size,
      users: memory.state.users.size,
      memberships: memory.state.memberships.size,
      userRoles: memory.state.userRoles.length,
      persons: memory.state.persons.size,
      assignments: memory.state.assignments.size,
    }).toEqual(firstCounts);

    const alphaMember = ACCEPTANCE_FIXTURE.users.alphaMember;
    const betaMember = ACCEPTANCE_FIXTURE.users.betaMember;
    const alphaTenant = ACCEPTANCE_FIXTURE.tenants.alpha;
    const betaTenant = ACCEPTANCE_FIXTURE.tenants.beta;
    expect(
      memory.state.memberships.has(`${alphaTenant.id}:${alphaMember.id}`),
    ).toBe(true);
    expect(
      memory.state.memberships.has(`${betaTenant.id}:${betaMember.id}`),
    ).toBe(true);
    expect(
      memory.state.memberships.has(`${alphaTenant.id}:${betaMember.id}`),
    ).toBe(false);
    expect(
      memory.state.memberships.has(`${betaTenant.id}:${alphaMember.id}`),
    ).toBe(false);
    expect(memory.state.persons.get("sce-acceptance-person-alpha-member")).toMatchObject({
      tenantId: alphaTenant.id,
      userId: alphaMember.id,
    });
    expect(memory.state.persons.get("sce-acceptance-person-beta-member")).toMatchObject({
      tenantId: betaTenant.id,
      userId: betaMember.id,
    });
  });

  it("refuses a database containing operational-looking data before writes", async () => {
    const memory = createMemoryTransaction();
    memory.state.tenants.set("fc-allschwil", {
      id: "operational-tenant",
      key: "fc-allschwil",
    });

    await expect(
      bootstrapAcceptanceData(
        memory.tx,
        passwords,
        vi.fn(async () => "unused"),
      ),
    ).rejects.toThrow(/non-Acceptance/);
    expect(memory.spies.permission.create).not.toHaveBeenCalled();
    expect(memory.spies.user.create).not.toHaveBeenCalled();
  });
});
