import type {
  PermissionModule,
  PermissionScope,
  Prisma,
  RoleScope,
} from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PERSON_FUNCTIONS } from "@/lib/people/functions";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { PLATFORM_SUPERADMIN_ROLE_KEY } from "@/lib/security/platform-superadmin";

export const ACCEPTANCE_DATABASE_NAME = "sce_acceptance";
export const ACCEPTANCE_EMAIL_DOMAIN = "acceptance.sportclubevo.com";
export const ACCEPTANCE_CONFIRMATION = "BOOTSTRAP_ISOLATED_ACCEPTANCE";
export const ACCEPTANCE_OPERATION_AUTHORIZATION =
  "bootstrap-acceptance:acceptance";

const FIXTURE_PREFIX = "sce-acceptance-";

export const ACCEPTANCE_FIXTURE = {
  tenants: {
    alpha: {
      id: `${FIXTURE_PREFIX}tenant-alpha`,
      key: `${FIXTURE_PREFIX}club-alpha`,
      name: "SCE Acceptance Club Alpha",
      configured: true,
    },
    beta: {
      id: `${FIXTURE_PREFIX}tenant-beta`,
      key: `${FIXTURE_PREFIX}club-beta`,
      name: "SCE Acceptance Club Beta",
      configured: true,
    },
    attention: {
      id: `${FIXTURE_PREFIX}tenant-attention`,
      key: `${FIXTURE_PREFIX}club-attention`,
      name: "SCE Acceptance Club Attention",
      configured: false,
    },
  },
  users: {
    superadmin: {
      id: `${FIXTURE_PREFIX}user-superadmin`,
      email: `superadmin@${ACCEPTANCE_EMAIL_DOMAIN}`,
      firstName: "Acceptance",
      lastName: "Superadmin",
      tenant: "alpha",
      passwordEnv: "ACCEPTANCE_SUPERADMIN_PASSWORD",
    },
    alphaAdmin: {
      id: `${FIXTURE_PREFIX}user-alpha-admin`,
      email: `club-admin-alpha@${ACCEPTANCE_EMAIL_DOMAIN}`,
      firstName: "Alpha",
      lastName: "Club Admin",
      tenant: "alpha",
      passwordEnv: "ACCEPTANCE_ALPHA_ADMIN_PASSWORD",
    },
    alphaMember: {
      id: `${FIXTURE_PREFIX}user-alpha-member`,
      email: `member-alpha@${ACCEPTANCE_EMAIL_DOMAIN}`,
      firstName: "Alpha",
      lastName: "Member",
      tenant: "alpha",
      passwordEnv: "ACCEPTANCE_ALPHA_MEMBER_PASSWORD",
    },
    betaAdmin: {
      id: `${FIXTURE_PREFIX}user-beta-admin`,
      email: `club-admin-beta@${ACCEPTANCE_EMAIL_DOMAIN}`,
      firstName: "Beta",
      lastName: "Club Admin",
      tenant: "beta",
      passwordEnv: "ACCEPTANCE_BETA_ADMIN_PASSWORD",
    },
    betaMember: {
      id: `${FIXTURE_PREFIX}user-beta-member`,
      email: `member-beta@${ACCEPTANCE_EMAIL_DOMAIN}`,
      firstName: "Beta",
      lastName: "Member",
      tenant: "beta",
      passwordEnv: "ACCEPTANCE_BETA_MEMBER_PASSWORD",
    },
  },
} as const;

export type AcceptancePasswordEnvName =
  (typeof ACCEPTANCE_FIXTURE.users)[keyof typeof ACCEPTANCE_FIXTURE.users]["passwordEnv"];
export type AcceptancePasswords = Record<AcceptancePasswordEnvName, string>;

const PLATFORM_PERMISSION_KEYS = new Set<string>([
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.USERS_IMPERSONATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.TENANTS_VIEW,
  PERMISSIONS.TENANTS_MANAGE,
  PERMISSIONS.TENANTS_DELETE,
]);

const PERMISSION_MODULES: Record<string, PermissionModule> = {
  users: "USERS",
  seasons: "SEASONS",
  teams: "TEAMS",
  competitions: "COMPETITIONS",
  trainings: "TRAININGS",
  people: "PEOPLE",
  events: "EVENTS",
  matches: "EVENTS",
  tournaments: "EVENTS",
  fixtures: "FIXTURES",
  wochenplan: "WOCHENPLAN",
  news: "NEWS",
  website: "WEBSITE",
  infoboard: "INFOBOARD",
  functions: "FUNCTIONS",
  targets: "TARGETS",
  meetings: "MEETINGS",
  initiatives: "INITIATIVES",
  templates: "TEMPLATES",
  registrations: "REGISTRATIONS",
  tenants: "TENANTS",
  org: "ORG",
  facilities: "FACILITIES",
  workspace: "WORKSPACE",
  roles: "ROLES",
};

export type AcceptancePermissionDefinition = {
  key: string;
  name: string;
  module: PermissionModule;
  scope: PermissionScope;
  grantableByAdmin: boolean;
};

export function getAcceptancePermissionDefinitions(): AcceptancePermissionDefinition[] {
  return Object.values(PERMISSIONS).map((key) => {
    const prefix = key.split(".")[0];
    const module = PERMISSION_MODULES[prefix];
    if (!module) {
      throw new Error(`No canonical PermissionModule mapping for ${key}.`);
    }
    const isPlatform = PLATFORM_PERMISSION_KEYS.has(key);
    return {
      key,
      name: key,
      module,
      scope: isPlatform ? "PLATFORM" : "TENANT",
      grantableByAdmin: !isPlatform,
    };
  });
}

export function getAcceptanceDatabaseIdentity(rawUrl: string): {
  host: string;
  database: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Acceptance bootstrap requires a valid PostgreSQL DATABASE_URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Acceptance bootstrap requires a PostgreSQL DATABASE_URL.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  return { host: parsed.hostname.toLowerCase(), database };
}

export function assertAcceptanceDatabaseTarget(
  databaseUrl: string,
  expectedHosts: readonly (string | undefined)[],
): { host: string; database: string } {
  const identity = getAcceptanceDatabaseIdentity(databaseUrl);
  const allowlistedHosts = expectedHosts
    .map((host) => host?.trim().toLowerCase())
    .filter((host): host is string => Boolean(host));
  if (
    !allowlistedHosts.includes(identity.host) ||
    identity.database !== ACCEPTANCE_DATABASE_NAME ||
    identity.host === "localhost" ||
    identity.host === "127.0.0.1" ||
    identity.host === "::1"
  ) {
    throw new Error(
      `Database identity is not an explicitly allowlisted remote ${ACCEPTANCE_DATABASE_NAME} database.`,
    );
  }
  return identity;
}

export function assertAcceptanceBootstrapEnvironment(
  env: NodeJS.ProcessEnv,
): { databaseUrl: string; expectedHost: string } {
  if (
    env.APP_ENV?.trim().toLowerCase() !== "acceptance" ||
    env.VERCEL_TARGET_ENV?.trim().toLowerCase() !== "acceptance" ||
    env.NODE_ENV !== "production"
  ) {
    throw new Error(
      "Acceptance bootstrap requires APP_ENV=acceptance, VERCEL_TARGET_ENV=acceptance, and NODE_ENV=production.",
    );
  }
  if (env.ACCEPTANCE_BOOTSTRAP_CONFIRM !== ACCEPTANCE_CONFIRMATION) {
    throw new Error("Acceptance bootstrap confirmation is missing or invalid.");
  }
  if (env.SCE_OPERATION_AUTHORIZATION !== ACCEPTANCE_OPERATION_AUTHORIZATION) {
    throw new Error("Acceptance bootstrap operation authorization is missing or invalid.");
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  const expectedHost = env.ACCEPTANCE_DATABASE_HOST?.trim().toLowerCase();
  if (!databaseUrl || !expectedHost) {
    throw new Error(
      "DATABASE_URL and the non-secret ACCEPTANCE_DATABASE_HOST allowlist are required.",
    );
  }
  const identity = assertAcceptanceDatabaseTarget(databaseUrl, [expectedHost]);

  const operationalUrlNames = [
    "STAGE_DB_URL",
    "STAGE_DIRECT_URL",
    "PROD_DB_URL",
    "PROD_DIRECT_URL",
    "PRODUCTION_DATABASE_URL",
  ] as const;
  for (const name of operationalUrlNames) {
    const candidate = env[name]?.trim();
    if (!candidate) continue;
    const operational = getAcceptanceDatabaseIdentity(candidate);
    if (
      operational.host === identity.host &&
      operational.database === identity.database
    ) {
      throw new Error(`Acceptance database matches the protected ${name} target.`);
    }
  }

  return { databaseUrl, expectedHost };
}

export function readAcceptancePasswords(env: NodeJS.ProcessEnv): AcceptancePasswords {
  const result = {} as AcceptancePasswords;
  for (const fixture of Object.values(ACCEPTANCE_FIXTURE.users)) {
    const password = env[fixture.passwordEnv] ?? "";
    if (password.length < 12) {
      throw new Error(
        `${fixture.passwordEnv} is required and must contain at least 12 characters.`,
      );
    }
    result[fixture.passwordEnv] = password;
  }
  return result;
}

type BootstrapTransaction = Prisma.TransactionClient;
type TenantKey = keyof typeof ACCEPTANCE_FIXTURE.tenants;
type UserKey = keyof typeof ACCEPTANCE_FIXTURE.users;
type PasswordHasher = (password: string) => Promise<string>;

async function assertAcceptanceOnlyData(tx: BootstrapTransaction): Promise<void> {
  const [nonAcceptanceTenant, nonAcceptanceUser] = await Promise.all([
    tx.tenant.findFirst({
      where: { key: { not: { startsWith: FIXTURE_PREFIX } } },
      select: { id: true },
    }),
    tx.user.findFirst({
      where: { email: { not: { endsWith: `@${ACCEPTANCE_EMAIL_DOMAIN}` } } },
      select: { id: true },
    }),
  ]);
  if (nonAcceptanceTenant || nonAcceptanceUser) {
    throw new Error(
      "Database contains non-Acceptance tenant or user data; no bootstrap changes were made.",
    );
  }
}

async function ensurePermission(
  tx: BootstrapTransaction,
  definition: AcceptancePermissionDefinition,
) {
  const existing = await tx.permission.findUnique({ where: { key: definition.key } });
  if (existing) {
    if (
      existing.module !== definition.module ||
      existing.scope !== definition.scope ||
      existing.grantableByAdmin !== definition.grantableByAdmin
    ) {
      throw new Error(`Existing permission ${definition.key} is not canonical.`);
    }
    return existing;
  }
  return tx.permission.create({ data: definition });
}

async function ensureRole(
  tx: BootstrapTransaction,
  input: {
    id: string;
    key: string;
    name: string;
    scope: RoleScope;
    tenantId: string | null;
    isSystem: boolean;
    isTemplate?: boolean;
  },
) {
  const existing = await tx.role.findUnique({ where: { key: input.key } });
  if (existing) {
    if (
      existing.id !== input.id ||
      existing.scope !== input.scope ||
      existing.tenantId !== input.tenantId ||
      existing.isArchived
    ) {
      throw new Error(`Existing role ${input.key} does not match the Acceptance fixture.`);
    }
    return existing;
  }
  return tx.role.create({
    data: {
      ...input,
      isTemplate: input.isTemplate ?? false,
      isArchived: false,
    },
  });
}

async function ensureRolePermission(
  tx: BootstrapTransaction,
  roleId: string,
  permissionId: string,
) {
  const existing = await tx.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
  });
  if (!existing) {
    await tx.rolePermission.create({ data: { roleId, permissionId } });
  }
}

async function ensureTenant(tx: BootstrapTransaction, key: TenantKey) {
  const fixture = ACCEPTANCE_FIXTURE.tenants[key];
  const existing = await tx.tenant.findUnique({ where: { key: fixture.key } });
  if (existing) {
    if (existing.id !== fixture.id) {
      throw new Error(`Existing tenant ${fixture.key} is not the Acceptance fixture.`);
    }
    return existing;
  }
  return tx.tenant.create({
    data: {
      id: fixture.id,
      key: fixture.key,
      name: fixture.name,
      status: "ACTIVE",
      ...(fixture.configured
        ? {
            countryCode: "CH",
            sportCategory: "FOOTBALL",
            locale: "de-CH",
            timezone: "Europe/Zurich",
            currency: "CHF",
          }
        : {}),
      websiteEnabled: false,
      approvedDataOnly: true,
    },
  });
}

async function ensureUser(
  tx: BootstrapTransaction,
  key: UserKey,
  tenantId: string,
  passwords: AcceptancePasswords,
  passwordHasher: PasswordHasher,
) {
  const fixture = ACCEPTANCE_FIXTURE.users[key];
  const existing = await tx.user.findUnique({ where: { email: fixture.email } });
  if (existing) {
    if (existing.id !== fixture.id || existing.tenantId !== tenantId) {
      throw new Error(`Existing user ${fixture.email} is not the Acceptance fixture.`);
    }
    return existing;
  }
  const passwordHash = await passwordHasher(passwords[fixture.passwordEnv]);
  return tx.user.create({
    data: {
      id: fixture.id,
      email: fixture.email,
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      passwordHash,
      isActive: true,
      tenantId,
    },
  });
}

async function ensureMembership(
  tx: BootstrapTransaction,
  tenantId: string,
  userId: string,
) {
  const existing = await tx.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!existing) {
    await tx.tenantMembership.create({ data: { tenantId, userId, isActive: true } });
  }
}

async function ensureUserRole(
  tx: BootstrapTransaction,
  input: { userId: string; roleId: string; tenantId?: string },
) {
  const existing = await tx.userRole.findFirst({
    where: {
      userId: input.userId,
      roleId: input.roleId,
      tenantId: input.tenantId ?? null,
      orgUnitId: null,
    },
  });
  if (!existing) {
    await tx.userRole.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        tenantId: input.tenantId,
      },
    });
  }
}

async function ensurePersonAndAssignment(
  tx: BootstrapTransaction,
  input: {
    suffix: string;
    tenantId: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    orgUnitId: string;
    functionKey: string;
    isPlayer: boolean;
  },
) {
  const personId = `${FIXTURE_PREFIX}person-${input.suffix}`;
  const existingPerson = await tx.person.findUnique({ where: { id: personId } });
  if (!existingPerson) {
    await tx.person.create({
      data: {
        id: personId,
        tenantId: input.tenantId,
        userId: input.userId,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`,
        email: input.email,
        isActive: true,
        isPlayer: input.isPlayer,
        isFunctionary: !input.isPlayer,
      },
    });
  } else if (
    existingPerson.tenantId !== input.tenantId ||
    existingPerson.userId !== input.userId
  ) {
    throw new Error(`Existing Person ${personId} is not the Acceptance fixture.`);
  }

  const assignmentId = `${FIXTURE_PREFIX}assignment-${input.suffix}`;
  const existingAssignment = await tx.personAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!existingAssignment) {
    await tx.personAssignment.create({
      data: {
        id: assignmentId,
        tenantId: input.tenantId,
        personId,
        orgUnitId: input.orgUnitId,
        functionKey: input.functionKey,
        status: "ACTIVE",
      },
    });
  }

  const personMembershipId = `${FIXTURE_PREFIX}person-membership-${input.suffix}`;
  const existingMembership = await tx.personMembership.findUnique({
    where: { id: personMembershipId },
  });
  if (!existingMembership) {
    await tx.personMembership.create({
      data: {
        id: personMembershipId,
        tenantId: input.tenantId,
        personId,
        membershipType: "ACTIVE_MEMBER",
        status: "ACTIVE",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
  }
}

export async function bootstrapAcceptanceData(
  tx: BootstrapTransaction,
  passwords: AcceptancePasswords,
  passwordHasher: PasswordHasher = hashPassword,
): Promise<void> {
  await assertAcceptanceOnlyData(tx);

  const permissionRows = new Map<string, { id: string }>();
  for (const definition of getAcceptancePermissionDefinitions()) {
    permissionRows.set(definition.key, await ensurePermission(tx, definition));
  }

  const superadminRole = await ensureRole(tx, {
    id: `${FIXTURE_PREFIX}role-superadmin`,
    key: PLATFORM_SUPERADMIN_ROLE_KEY,
    name: "Super Admin",
    scope: "PLATFORM",
    tenantId: null,
    isSystem: true,
  });
  for (const permission of permissionRows.values()) {
    await ensureRolePermission(tx, superadminRole.id, permission.id);
  }

  const clubAdminTemplate = await ensureRole(tx, {
    id: `${FIXTURE_PREFIX}role-club-admin-template`,
    key: "club_admin",
    name: "Club Admin",
    scope: "PLATFORM",
    tenantId: null,
    isSystem: true,
    isTemplate: true,
  });
  void clubAdminTemplate;

  const tenants = {
    alpha: await ensureTenant(tx, "alpha"),
    beta: await ensureTenant(tx, "beta"),
    attention: await ensureTenant(tx, "attention"),
  };

  const tenantPermissionRows = getAcceptancePermissionDefinitions()
    .filter((permission) => permission.scope === "TENANT")
    .map((permission) => permissionRows.get(permission.key)!);
  const representativePermissionKeys = [
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.WORKSPACE_VIEW,
  ];

  const roles = {} as Record<
    "alphaAdmin" | "betaAdmin" | "alphaMember" | "betaMember",
    { id: string }
  >;
  for (const tenantKey of ["alpha", "beta"] as const) {
    const tenant = tenants[tenantKey];
    const adminRole = await ensureRole(tx, {
      id: `${FIXTURE_PREFIX}role-${tenantKey}-admin`,
      key: getTenantClubAdminRoleKey(tenant.key),
      name: "Club Admin",
      scope: "TENANT",
      tenantId: tenant.id,
      isSystem: true,
    });
    for (const permission of tenantPermissionRows) {
      await ensureRolePermission(tx, adminRole.id, permission.id);
    }
    roles[`${tenantKey}Admin`] = adminRole;

    const memberRole = await ensureRole(tx, {
      id: `${FIXTURE_PREFIX}role-${tenantKey}-member`,
      key: `${FIXTURE_PREFIX}member__${tenant.key}`,
      name: "Acceptance Member",
      scope: "TENANT",
      tenantId: tenant.id,
      isSystem: false,
    });
    for (const permissionKey of representativePermissionKeys) {
      await ensureRolePermission(
        tx,
        memberRole.id,
        permissionRows.get(permissionKey)!.id,
      );
    }
    roles[`${tenantKey}Member`] = memberRole;
  }

  const orgUnits = {
    alpha: await tx.orgUnit.upsert({
      where: { tenantId_key: { tenantId: tenants.alpha.id, key: "club" } },
      update: {},
      create: {
        id: `${FIXTURE_PREFIX}org-alpha-club`,
        tenantId: tenants.alpha.id,
        key: "club",
        name: "SCE Acceptance Club Alpha",
        type: "CLUB",
        status: "ACTIVE",
      },
    }),
    beta: await tx.orgUnit.upsert({
      where: { tenantId_key: { tenantId: tenants.beta.id, key: "club" } },
      update: {},
      create: {
        id: `${FIXTURE_PREFIX}org-beta-club`,
        tenantId: tenants.beta.id,
        key: "club",
        name: "SCE Acceptance Club Beta",
        type: "CLUB",
        status: "ACTIVE",
      },
    }),
  };

  const users = {
    superadmin: await ensureUser(
      tx,
      "superadmin",
      tenants.alpha.id,
      passwords,
      passwordHasher,
    ),
    alphaAdmin: await ensureUser(
      tx,
      "alphaAdmin",
      tenants.alpha.id,
      passwords,
      passwordHasher,
    ),
    alphaMember: await ensureUser(
      tx,
      "alphaMember",
      tenants.alpha.id,
      passwords,
      passwordHasher,
    ),
    betaAdmin: await ensureUser(
      tx,
      "betaAdmin",
      tenants.beta.id,
      passwords,
      passwordHasher,
    ),
    betaMember: await ensureUser(
      tx,
      "betaMember",
      tenants.beta.id,
      passwords,
      passwordHasher,
    ),
  };

  await ensureUserRole(tx, {
    userId: users.superadmin.id,
    roleId: superadminRole.id,
  });
  for (const tenantKey of ["alpha", "beta"] as const) {
    const admin = users[`${tenantKey}Admin`];
    const member = users[`${tenantKey}Member`];
    const tenant = tenants[tenantKey];
    await ensureMembership(tx, tenant.id, admin.id);
    await ensureMembership(tx, tenant.id, member.id);
    await ensureUserRole(tx, {
      userId: admin.id,
      roleId: roles[`${tenantKey}Admin`].id,
      tenantId: tenant.id,
    });
    await ensureUserRole(tx, {
      userId: member.id,
      roleId: roles[`${tenantKey}Member`].id,
      tenantId: tenant.id,
    });
  }

  await ensureMembership(tx, tenants.alpha.id, users.superadmin.id);
  await ensureUserRole(tx, {
    userId: users.superadmin.id,
    roleId: roles.alphaAdmin.id,
    tenantId: tenants.alpha.id,
  });

  for (const tenantKey of ["alpha", "beta"] as const) {
    for (const userKind of ["Admin", "Member"] as const) {
      const userKey = `${tenantKey}${userKind}` as
        | "alphaAdmin"
        | "alphaMember"
        | "betaAdmin"
        | "betaMember";
      const fixture = ACCEPTANCE_FIXTURE.users[userKey];
      await ensurePersonAndAssignment(tx, {
        suffix: `${tenantKey}-${userKind.toLowerCase()}`,
        tenantId: tenants[tenantKey].id,
        userId: users[userKey].id,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        email: fixture.email,
        orgUnitId: orgUnits[tenantKey].id,
        functionKey:
          userKind === "Admin"
            ? PERSON_FUNCTIONS.PRESIDENT
            : PERSON_FUNCTIONS.PLAYER,
        isPlayer: userKind === "Member",
      });
    }
  }
}
