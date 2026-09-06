import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import type { SmokeScenario } from "@/lib/acceptance/security-smoke/types";

const FIXTURE_PREFIX = "sce-acceptance-";

export const ACCEPTANCE_FIXTURE_IDS = {
  tenants: {
    alpha: ACCEPTANCE_FIXTURE.tenants.alpha.id,
    beta: ACCEPTANCE_FIXTURE.tenants.beta.id,
  },
  tenantSlugs: {
    alpha: ACCEPTANCE_FIXTURE.tenants.alpha.key,
    beta: ACCEPTANCE_FIXTURE.tenants.beta.key,
  },
  orgUnits: {
    alpha: `${FIXTURE_PREFIX}org-alpha-club`,
    beta: `${FIXTURE_PREFIX}org-beta-club`,
  },
  persons: {
    alphaAdmin: `${FIXTURE_PREFIX}person-alpha-admin`,
    alphaMember: `${FIXTURE_PREFIX}person-alpha-member`,
    betaAdmin: `${FIXTURE_PREFIX}person-beta-admin`,
    betaMember: `${FIXTURE_PREFIX}person-beta-member`,
  },
} as const;

export const SUPER_ADMIN_PLATFORM_NOTES = [
  "Super Admin currently holds the platform-scoped superadmin role with TENANTS_VIEW, TENANTS_MANAGE, USERS_DELETE, and USERS_IMPERSONATE.",
  "Super Admin has an active TenantMembership only in SCE Acceptance Club Alpha; there is no dedicated SCE Super Admin control plane yet.",
  "Slug-scoped tenant routes authorize against membership in the URL tenant, not the session active tenant.",
  "Session-scoped routes authorize against session.user.activeTenantId only.",
] as const;

function isSafeDenialStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function readSessionUser(session: Record<string, unknown> | null) {
  const user = session?.user;
  if (!user || typeof user !== "object") return null;
  return user as Record<string, unknown>;
}

function orgUnitsPath(): string {
  return "/api/org-units";
}

function adminUsersPath(): string {
  return "/api/admin/users";
}

function tenantRegistrationsPath(tenantSlug: string): string {
  return `/api/tenants/${tenantSlug}/registrations`;
}

function personPath(personId: string): string {
  return `/api/people/${personId}`;
}

function tenantsListPath(): string {
  return "/api/tenants";
}

export const ACCEPTANCE_SECURITY_SMOKE_SCENARIOS: SmokeScenario[] = [
  {
    id: "unauthenticated-org-units-denied",
    name: "Unauthenticated org-units request is denied",
    category: "session-auth",
    async run({ clients }) {
      const response = await clients.anonymous.get(orgUnitsPath());
      if (response.status !== 401) {
        throw new Error(`Expected HTTP 401, received ${response.status}.`);
      }
      return "Unauthenticated request returned HTTP 401.";
    },
  },
  {
    id: "unauthenticated-admin-users-denied",
    name: "Unauthenticated admin users request is denied",
    category: "session-auth",
    async run({ clients }) {
      const response = await clients.anonymous.get(adminUsersPath());
      if (response.status !== 401) {
        throw new Error(`Expected HTTP 401, received ${response.status}.`);
      }
      return "Unauthenticated request returned HTTP 401.";
    },
  },
  {
    id: "alpha-admin-can-authenticate",
    name: "Alpha Club Admin can authenticate",
    category: "session-auth",
    async run({ clients }) {
      const session = await clients.alphaAdmin.getSession();
      const user = readSessionUser(session);
      if (!user?.email) {
        throw new Error("Authenticated session did not include a user email.");
      }
      if (user.email !== ACCEPTANCE_FIXTURE.users.alphaAdmin.email) {
        throw new Error("Authenticated session email did not match the Alpha Club Admin fixture.");
      }
      return "Alpha Club Admin authenticated successfully.";
    },
  },
  {
    id: "beta-admin-can-authenticate",
    name: "Beta Club Admin can authenticate",
    category: "session-auth",
    async run({ clients }) {
      const session = await clients.betaAdmin.getSession();
      const user = readSessionUser(session);
      if (user?.email !== ACCEPTANCE_FIXTURE.users.betaAdmin.email) {
        throw new Error("Authenticated session email did not match the Beta Club Admin fixture.");
      }
      return "Beta Club Admin authenticated successfully.";
    },
  },
  {
    id: "session-active-tenant-bound-alpha",
    name: "Alpha Club Admin session remains tenant-bound to Alpha",
    category: "session-auth",
    async run({ clients }) {
      const session = await clients.alphaAdmin.getSession();
      const user = readSessionUser(session);
      if (user?.activeTenantId !== ACCEPTANCE_FIXTURE_IDS.tenants.alpha) {
        throw new Error("Alpha Club Admin active tenant did not resolve to the Alpha fixture tenant.");
      }
      return "Session activeTenantId is bound to SCE Acceptance Club Alpha.";
    },
  },
  {
    id: "session-active-tenant-bound-beta",
    name: "Beta Club Admin session remains tenant-bound to Beta",
    category: "session-auth",
    async run({ clients }) {
      const session = await clients.betaAdmin.getSession();
      const user = readSessionUser(session);
      if (user?.activeTenantId !== ACCEPTANCE_FIXTURE_IDS.tenants.beta) {
        throw new Error("Beta Club Admin active tenant did not resolve to the Beta fixture tenant.");
      }
      return "Session activeTenantId is bound to SCE Acceptance Club Beta.";
    },
  },
  {
    id: "alpha-admin-accesses-alpha-org-units",
    name: "Alpha Club Admin can access Alpha tenant org units",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.alphaAdmin.get(orgUnitsPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      const payload = response.json() as { orgUnits?: Array<{ id?: string }> } | null;
      const ids = (payload?.orgUnits ?? []).map((unit) => unit.id).filter(Boolean);
      if (!ids.includes(ACCEPTANCE_FIXTURE_IDS.orgUnits.alpha)) {
        throw new Error("Alpha org unit was not returned for the Alpha Club Admin session.");
      }
      if (ids.includes(ACCEPTANCE_FIXTURE_IDS.orgUnits.beta)) {
        throw new Error("Beta org unit leaked into the Alpha Club Admin response.");
      }
      return "Alpha Club Admin received only Alpha tenant org units.";
    },
  },
  {
    id: "alpha-admin-cannot-access-beta-slug-registrations",
    name: "Alpha Club Admin cannot access Beta slug registrations",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.alphaAdmin.get(
        tenantRegistrationsPath(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.beta),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant slug request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "alpha-member-cannot-access-beta-slug-registrations",
    name: "Alpha Member cannot access Beta slug registrations",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.alphaMember.get(
        tenantRegistrationsPath(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.beta),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant slug request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "beta-admin-accesses-beta-org-units",
    name: "Beta Club Admin can access Beta tenant org units",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.betaAdmin.get(orgUnitsPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      const payload = response.json() as { orgUnits?: Array<{ id?: string }> } | null;
      const ids = (payload?.orgUnits ?? []).map((unit) => unit.id).filter(Boolean);
      if (!ids.includes(ACCEPTANCE_FIXTURE_IDS.orgUnits.beta)) {
        throw new Error("Beta org unit was not returned for the Beta Club Admin session.");
      }
      if (ids.includes(ACCEPTANCE_FIXTURE_IDS.orgUnits.alpha)) {
        throw new Error("Alpha org unit leaked into the Beta Club Admin response.");
      }
      return "Beta Club Admin received only Beta tenant org units.";
    },
  },
  {
    id: "beta-admin-cannot-access-alpha-slug-registrations",
    name: "Beta Club Admin cannot access Alpha slug registrations",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.betaAdmin.get(
        tenantRegistrationsPath(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.alpha),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant slug request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "beta-member-cannot-access-alpha-slug-registrations",
    name: "Beta Member cannot access Alpha slug registrations",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.betaMember.get(
        tenantRegistrationsPath(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.alpha),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant slug request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "alpha-admin-cross-tenant-person-id-denied",
    name: "Alpha Club Admin cannot read Beta person by direct ID",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.alphaAdmin.get(
        personPath(ACCEPTANCE_FIXTURE_IDS.persons.betaAdmin),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant person ID request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "beta-admin-cross-tenant-person-id-denied",
    name: "Beta Club Admin cannot read Alpha person by direct ID",
    category: "tenant-isolation",
    async run({ clients }) {
      const response = await clients.betaAdmin.get(
        personPath(ACCEPTANCE_FIXTURE_IDS.persons.alphaAdmin),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Cross-tenant person ID request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "alpha-member-cannot-access-admin-users",
    name: "Alpha Member cannot access Alpha admin users API",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.alphaMember.get(adminUsersPath());
      if (response.status !== 403) {
        throw new Error(`Expected HTTP 403, received ${response.status}.`);
      }
      return "Alpha Member was denied by server authorization for admin users.";
    },
  },
  {
    id: "alpha-member-cannot-create-org-unit",
    name: "Alpha Member cannot create org units",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.alphaMember.post(orgUnitsPath(), {
        name: "Acceptance Smoke Org Unit",
        key: "acceptance-smoke-org-unit",
      });
      if (response.status !== 403) {
        throw new Error(`Expected HTTP 403, received ${response.status}.`);
      }
      return "Alpha Member was denied by server authorization for org unit creation.";
    },
  },
  {
    id: "beta-member-cannot-access-admin-users",
    name: "Beta Member cannot access Beta admin users API",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.betaMember.get(adminUsersPath());
      if (response.status !== 403) {
        throw new Error(`Expected HTTP 403, received ${response.status}.`);
      }
      return "Beta Member was denied by server authorization for admin users.";
    },
  },
  {
    id: "beta-member-cannot-create-org-unit",
    name: "Beta Member cannot create org units",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.betaMember.post(orgUnitsPath(), {
        name: "Acceptance Smoke Org Unit",
        key: "acceptance-smoke-org-unit",
      });
      if (response.status !== 403) {
        throw new Error(`Expected HTTP 403, received ${response.status}.`);
      }
      return "Beta Member was denied by server authorization for org unit creation.";
    },
  },
  {
    id: "alpha-admin-can-access-admin-users",
    name: "Alpha Club Admin can access Alpha admin users API",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.alphaAdmin.get(adminUsersPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      return "Alpha Club Admin can read tenant admin users via API.";
    },
  },
  {
    id: "beta-admin-can-access-admin-users",
    name: "Beta Club Admin can access Beta admin users API",
    category: "role-isolation",
    async run({ clients }) {
      const response = await clients.betaAdmin.get(adminUsersPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      return "Beta Club Admin can read tenant admin users via API.";
    },
  },
  {
    id: "superadmin-can-authenticate",
    name: "Super Admin can authenticate",
    category: "super-admin",
    async run({ clients }) {
      const session = await clients.superadmin.getSession();
      const user = readSessionUser(session);
      if (user?.email !== ACCEPTANCE_FIXTURE.users.superadmin.email) {
        throw new Error("Authenticated session email did not match the Super Admin fixture.");
      }
      return "Super Admin authenticated successfully.";
    },
  },
  {
    id: "superadmin-active-tenant-is-alpha",
    name: "Super Admin session active tenant is Alpha",
    category: "super-admin",
    async run({ clients }) {
      const session = await clients.superadmin.getSession();
      const user = readSessionUser(session);
      if (user?.activeTenantId !== ACCEPTANCE_FIXTURE_IDS.tenants.alpha) {
        throw new Error("Super Admin active tenant is not the Alpha fixture tenant.");
      }
      return "Super Admin currently lands in the Alpha tenant dashboard context.";
    },
  },
  {
    id: "superadmin-can-access-alpha-org-units",
    name: "Super Admin can access Alpha session-scoped org units",
    category: "super-admin",
    async run({ clients }) {
      const response = await clients.superadmin.get(orgUnitsPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      return "Super Admin can access Alpha session-scoped org units.";
    },
  },
  {
    id: "superadmin-cannot-access-beta-slug-registrations",
    name: "Super Admin cannot access Beta slug registrations without Beta membership",
    category: "super-admin",
    async run({ clients }) {
      const response = await clients.superadmin.get(
        tenantRegistrationsPath(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.beta),
      );
      if (!isSafeDenialStatus(response.status)) {
        throw new Error(`Expected safe denial (401/403/404), received ${response.status}.`);
      }
      return `Super Admin cross-tenant slug request denied with HTTP ${response.status}.`;
    },
  },
  {
    id: "superadmin-platform-tenants-list",
    name: "Super Admin can list tenants via platform authorization",
    category: "super-admin",
    async run({ clients }) {
      const response = await clients.superadmin.get(tenantsListPath());
      if (response.status !== 200) {
        throw new Error(`Expected HTTP 200, received ${response.status}.`);
      }
      const payload = response.json() as { tenants?: Array<{ key?: string }> } | null;
      const keys = new Set((payload?.tenants ?? []).map((tenant) => tenant.key));
      if (!keys.has(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.alpha)) {
        throw new Error("Tenant list did not include the Alpha fixture tenant.");
      }
      if (!keys.has(ACCEPTANCE_FIXTURE_IDS.tenantSlugs.beta)) {
        throw new Error("Tenant list did not include the Beta fixture tenant.");
      }
      return "Super Admin platform TENANTS_VIEW authorization returned the tenant directory.";
    },
  },
];
