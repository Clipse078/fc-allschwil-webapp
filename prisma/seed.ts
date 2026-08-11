import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  FacilityResourceType,
  FacilityType,
  PermissionModule,
  PermissionScope,
  PrismaClient,
  RoleScope,
  TenantStatus,
} from "@prisma/client";
import { Pool } from "pg";
import { PLATFORM_BRANDING } from "@/lib/tenant-runtime/branding";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.tenant.upsert({
    where: { key: "fc-allschwil" },
    update: {
      name: "FC Allschwil",
      status: TenantStatus.ACTIVE,
      // Config v1 — safe to apply on re-seed; only overwrites if values differ
      countryCode: "CH",
      sportCategory: "FOOTBALL",
      locale: "de-CH",
      timezone: "Europe/Zurich",
      currency: "CHF",
      seasonStartMonth: 8,
      seasonTransitionDay: 1,
      seasonTransitionMonth: 8,
      // Branding v1 — Slice 10.6: use PLATFORM_BRANDING — single source of truth.
      primaryColor: PLATFORM_BRANDING.primaryColor,
      secondaryColor: PLATFORM_BRANDING.secondaryColor,
    },
    create: {
      key: "fc-allschwil",
      name: "FC Allschwil",
      status: TenantStatus.ACTIVE,
      countryCode: "CH",
      sportCategory: "FOOTBALL",
      locale: "de-CH",
      timezone: "Europe/Zurich",
      currency: "CHF",
      seasonStartMonth: 8,
      seasonTransitionDay: 1,
      seasonTransitionMonth: 8,
      // Branding v1 — Slice 10.6: use PLATFORM_BRANDING — single source of truth.
      primaryColor: PLATFORM_BRANDING.primaryColor,
      secondaryColor: PLATFORM_BRANDING.secondaryColor,
    },
  });

  // RPERM-02: permissions now carry scope and grantableByAdmin metadata.
  // Platform-only permissions (users.manage, users.impersonate, tenants.view,
  // tenants.manage) are scope=PLATFORM, grantableByAdmin=false.
  // All other permissions are scope=TENANT, grantableByAdmin=true.
  const permissions = [
    // ── PLATFORM-scoped permissions (not grantable by club admins) ─────────
    { key: "users.manage", name: "Manage users", module: PermissionModule.USERS, scope: PermissionScope.PLATFORM, grantableByAdmin: false },
    { key: "users.impersonate", name: "Impersonate users", module: PermissionModule.USERS, scope: PermissionScope.PLATFORM, grantableByAdmin: false },
    { key: "tenants.view", name: "View tenants", module: PermissionModule.TENANTS, scope: PermissionScope.PLATFORM, grantableByAdmin: false },
    { key: "tenants.manage", name: "Manage tenants", module: PermissionModule.TENANTS, scope: PermissionScope.PLATFORM, grantableByAdmin: false },

    // ── RPERM-02: new user-management keys ────────────────────────────────
    { key: "users.view", name: "View users", module: PermissionModule.USERS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "users.invite", name: "Invite users", module: PermissionModule.USERS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "users.manage_memberships", name: "Manage user memberships", module: PermissionModule.USERS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    // ── RPERM-02: new role management keys ───────────────────────────────
    { key: "roles.view", name: "View roles", module: PermissionModule.ROLES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "roles.manage", name: "Manage roles", module: PermissionModule.ROLES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "roles.assign", name: "Assign roles", module: PermissionModule.ROLES, scope: PermissionScope.TENANT, grantableByAdmin: true },

    // ── TENANT-scoped permissions ─────────────────────────────────────────
    { key: "seasons.view", name: "View seasons", module: PermissionModule.SEASONS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "seasons.manage", name: "Manage seasons", module: PermissionModule.SEASONS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "teams.view", name: "View teams", module: PermissionModule.TEAMS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "teams.manage", name: "Manage teams", module: PermissionModule.TEAMS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    // ADMIN-DELETE-01A: canonical permanent-deletion permission foundation.
    // Deliberately separate from "teams.manage" so permanent deletion is
    // never implicitly granted by create/edit/archive access — it must be
    // held (directly or delegated via a custom tenant role) on its own.
    { key: "teams.delete", name: "Permanently delete teams", module: PermissionModule.TEAMS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "people.view", name: "View people", module: PermissionModule.PEOPLE, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "people.manage", name: "Manage people", module: PermissionModule.PEOPLE, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "events.view", name: "View events", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "events.manage", name: "Manage events", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "events.import", name: "Import events", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "events.publish_website", name: "Publish events to website", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "events.publish_infoboard", name: "Publish events to infoboard", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    // ADMIN-DELETE-02A: canonical permanent-deletion permissions for the
    // MatchCenter/TournamentCenter modules — both operate on the canonical
    // Event model (type=MATCH / type=TOURNAMENT), so they use the EVENTS
    // module like the other events.* keys. Deliberately separate from
    // events.manage: create/edit/cancel access must never implicitly grant
    // permanent deletion. Mirrors teams.delete (ADMIN-DELETE-01A).
    { key: "matches.delete", name: "Permanently delete matches", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "tournaments.delete", name: "Permanently delete tournaments", module: PermissionModule.EVENTS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "fixtures.view", name: "View fixtures", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "fixtures.create", name: "Create fixtures", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "fixtures.edit_all", name: "Edit all fixtures", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "fixtures.submit_for_publication", name: "Submit fixtures for publication", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "fixtures.publish_website", name: "Publish fixtures to website", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "fixtures.publish_infoboard", name: "Publish fixtures to infoboard", module: PermissionModule.FIXTURES, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "wochenplan.manage", name: "Manage Wochenplan", module: PermissionModule.WOCHENPLAN, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "news.manage", name: "Manage news", module: PermissionModule.NEWS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "website.manage", name: "Manage website content", module: PermissionModule.WEBSITE, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "infoboard.manage", name: "Manage infoboard", module: PermissionModule.INFOBOARD, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "functions.manage", name: "Manage functions", module: PermissionModule.FUNCTIONS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "targets.view", name: "View targets", module: PermissionModule.TARGETS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "targets.manage", name: "Manage targets", module: PermissionModule.TARGETS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "meetings.view", name: "View meetings", module: PermissionModule.MEETINGS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "meetings.manage", name: "Manage meetings", module: PermissionModule.MEETINGS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "initiatives.view", name: "View initiatives", module: PermissionModule.INITIATIVES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "initiatives.manage", name: "Manage initiatives", module: PermissionModule.INITIATIVES, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "templates.view", name: "View templates", module: PermissionModule.TEMPLATES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "templates.manage", name: "Manage templates", module: PermissionModule.TEMPLATES, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "registrations.view", name: "View registrations", module: PermissionModule.REGISTRATIONS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "registrations.edit", name: "Edit registrations", module: PermissionModule.REGISTRATIONS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "org.view", name: "View organisations", module: PermissionModule.ORG, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "org.manage", name: "Manage organisations", module: PermissionModule.ORG, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "facilities.view", name: "View facilities & resources", module: PermissionModule.FACILITIES, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "facilities.manage", name: "Manage facilities & resources", module: PermissionModule.FACILITIES, scope: PermissionScope.TENANT, grantableByAdmin: true },

    { key: "trainings.view", name: "View training allocations", module: PermissionModule.TRAININGS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "trainings.manage", name: "Manage training allocations", module: PermissionModule.TRAININGS, scope: PermissionScope.TENANT, grantableByAdmin: true },
    // ADMIN-DELETE-02A: canonical permanent-deletion permission for the
    // TrainingCenter module (canonical TrainingSeries entity). Deliberately
    // separate from trainings.manage. Mirrors teams.delete (ADMIN-DELETE-01A).
    { key: "trainings.delete", name: "Permanently delete trainings", module: PermissionModule.TRAININGS, scope: PermissionScope.TENANT, grantableByAdmin: true },

    // ── RPERM-05: Workspace/Documents permissions ─────────────────────────
    // Previously only created out-of-band by scripts/sync-workspace-permissions.ts
    // (and only ever assigned to super_admin there). Adding them to the
    // canonical seed list closes the gap that prevented every tenant
    // club_admin role from ever receiving Documents access: the tenant
    // club_admin permission set below (`tenantPermissionKeys`) is derived by
    // filtering this exact array to scope=TENANT, so these two keys now flow
    // through the same, already-accepted "club_admin owns every TENANT
    // permission" seeding policy — no new automatic-assignment policy.
    { key: "workspace.view", name: "View workspace", module: PermissionModule.WORKSPACE, scope: PermissionScope.TENANT, grantableByAdmin: true },
    { key: "workspace.manage", name: "Manage workspace", module: PermissionModule.WORKSPACE, scope: PermissionScope.TENANT, grantableByAdmin: true },
  ] as const;

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        module: permission.module,
        scope: permission.scope,
        grantableByAdmin: permission.grantableByAdmin,
      },
      create: {
        key: permission.key,
        name: permission.name,
        module: permission.module,
        scope: permission.scope,
        grantableByAdmin: permission.grantableByAdmin,
      },
    });
  }

  // RPERM-02: role definitions now carry scope/isSystem/isTemplate metadata.
  // super_admin: platform-scoped system role — never reassigned or deleted.
  // club_admin: platform-scoped template-only role — never directly assignable.
  //   Actual per-tenant club_admin roles are created in RPERM-04.
  const roleDefinitions = [
    {
      key: "super_admin",
      name: "Super Admin",
      description: "Full platform access",
      scope: RoleScope.PLATFORM,
      isSystem: true,
      isTemplate: false,
      permissionKeys: permissions.map((permission) => permission.key),
    },
    {
      key: "club_admin",
      name: "Club Admin",
      description: "Template for tenant club administrator role — not directly assignable",
      scope: RoleScope.PLATFORM,
      isSystem: true,
      isTemplate: true,
      permissionKeys: [] as string[],
    },
    {
      key: "match_coordinator",
      name: "Match Coordinator",
      description: "Operational fixture owner",
      scope: RoleScope.PLATFORM,
      isSystem: false,
      isTemplate: false,
      permissionKeys: [
        "seasons.view",
        "teams.view",
        "people.view",
        "events.view",
        "events.manage",
        "events.import",
        "events.publish_website",
        "events.publish_infoboard",
        "fixtures.view",
        "fixtures.create",
        "fixtures.edit_all",
        "fixtures.submit_for_publication",
        "fixtures.publish_website",
        "fixtures.publish_infoboard",
        "wochenplan.manage",
        "infoboard.manage",
        "facilities.view",
        "facilities.manage",
      ],
    },
    {
      key: "website_publisher",
      name: "Website Publisher",
      description: "Publishes public-facing content",
      scope: RoleScope.PLATFORM,
      isSystem: false,
      isTemplate: false,
      permissionKeys: [
        "seasons.view",
        "events.view",
        "events.import",
        "events.publish_website",
        "fixtures.view",
        "fixtures.publish_website",
        "news.manage",
        "website.manage",
      ],
    },
    {
      key: "trainer",
      name: "Trainer",
      description: "Basic operational access",
      scope: RoleScope.PLATFORM,
      isSystem: false,
      isTemplate: false,
      permissionKeys: [
        "seasons.view",
        "teams.view",
        "people.view",
        "events.view",
        "events.manage",
        "fixtures.view",
        "fixtures.create",
        "fixtures.submit_for_publication",
        // trainings.view and trainings.manage deliberately excluded.
        // STAGE-OPS-03B policy: automatic training-permission bootstrap is
        // limited to super_admin only. No canonical club-admin role exists yet.
        // Trainers and all other operational users receive training permissions
        // only through explicit assignment via a custom role created in
        // /dashboard/roles by a super_admin. The future Roles & Permissions
        // module is the canonical place for club admins to manage this.
      ],
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only access",
      scope: RoleScope.PLATFORM,
      isSystem: false,
      isTemplate: false,
      permissionKeys: [
        "seasons.view",
        "teams.view",
        "people.view",
        "events.view",
        "fixtures.view",
        "facilities.view",
      ],
    },
  ] as const;

  for (const roleDefinition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { key: roleDefinition.key },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        scope: roleDefinition.scope,
        isSystem: roleDefinition.isSystem,
        isTemplate: roleDefinition.isTemplate,
      },
      create: {
        key: roleDefinition.key,
        name: roleDefinition.name,
        description: roleDefinition.description,
        scope: roleDefinition.scope,
        isSystem: roleDefinition.isSystem,
        isTemplate: roleDefinition.isTemplate,
      },
    });

    for (const permissionKey of roleDefinition.permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: { key: permissionKey },
      });

      if (!permission) {
        throw new Error("Permission not found during seeding: " + permissionKey);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // ── RPERM-04: materialize the tenant-scoped club_admin role ────────────────
  // The PLATFORM club_admin role above is a template only (isTemplate: true,
  // never directly assignable). Every tenant needs its own TENANT-scoped
  // club_admin role, owning every TENANT-scoped permission, so that a tenant
  // administrator's operational access comes from a real TenantMembership +
  // tenant-scoped UserRole — never from inheriting a PLATFORM role's
  // permissions. See lib/permissions/services/effective-permission-resolver.ts.
  const fcaTenantForRoles = await prisma.tenant.findUnique({
    where: { key: "fc-allschwil" },
    select: { id: true, key: true },
  });

  if (fcaTenantForRoles) {
    const tenantPermissionKeys = permissions
      .filter((permission) => permission.scope === PermissionScope.TENANT)
      .map((permission) => permission.key);

    const tenantClubAdminRole = await prisma.role.upsert({
      where: { key: getTenantClubAdminRoleKey(fcaTenantForRoles.key) },
      update: {
        name: "Club Admin",
        description: "Full operational access within this club",
        scope: RoleScope.TENANT,
        tenantId: fcaTenantForRoles.id,
        isSystem: true,
        isTemplate: false,
        isArchived: false,
      },
      create: {
        key: getTenantClubAdminRoleKey(fcaTenantForRoles.key),
        name: "Club Admin",
        description: "Full operational access within this club",
        scope: RoleScope.TENANT,
        tenantId: fcaTenantForRoles.id,
        isSystem: true,
        isTemplate: false,
      },
    });

    for (const permissionKey of tenantPermissionKeys) {
      const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });

      if (!permission) {
        throw new Error("Permission not found during tenant club_admin seeding: " + permissionKey);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: tenantClubAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: tenantClubAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  await prisma.season.updateMany({
    data: { isActive: false },
  });

  const seasons = [
    {
      key: "2025-2026",
      name: "Saison 2025/2026",
      startDate: new Date("2025-07-15T00:00:00.000Z"),
      endDate: new Date("2026-07-14T23:59:59.999Z"),
      isActive: true,
    },
    {
      key: "2026-2027",
      name: "Saison 2026/2027",
      startDate: new Date("2026-07-15T00:00:00.000Z"),
      endDate: new Date("2027-07-14T23:59:59.999Z"),
      isActive: false,
    },
    {
      key: "2027-2028",
      name: "Saison 2027/2028",
      startDate: new Date("2027-07-15T00:00:00.000Z"),
      endDate: new Date("2028-07-14T23:59:59.999Z"),
      isActive: false,
    },
  ] as const;

  for (const seasonData of seasons) {
    await prisma.season.upsert({
      where: { key: seasonData.key },
      update: {
        name: seasonData.name,
        startDate: seasonData.startDate,
        endDate: seasonData.endDate,
        isActive: seasonData.isActive,
      },
      create: {
        key: seasonData.key,
        name: seasonData.name,
        startDate: seasonData.startDate,
        endDate: seasonData.endDate,
        isActive: seasonData.isActive,
      },
    });
  }

  // ── FC Allschwil: Facility & Resource defaults ──────────────────────────────
  // Seeds the canonical FCA pitch and dressing-room configuration into the DB.
  // Display helpers first check these tenant-scoped records before falling back
  // to the static FCA registries in lib/facilities/pitches.ts and dressing-rooms.ts.
  const fcaTenant = await prisma.tenant.findUnique({ where: { key: "fc-allschwil" }, select: { id: true } });

  if (fcaTenant) {
    const facilitySeedData: Array<{
      name: string;
      type: FacilityType;
      sortOrder: number;
      resources: Array<{ name: string; code: string; type: FacilityResourceType; sortOrder: number }>;
    }> = [
      {
        name: "Hauptplatz",
        type: FacilityType.PITCH,
        sortOrder: 10,
        resources: [
          { name: "Hauptplatz", code: "STADION", type: FacilityResourceType.FULL_PITCH, sortOrder: 10 },
          { name: "Hauptplatz A", code: "STADION_A", type: FacilityResourceType.HALF_PITCH, sortOrder: 20 },
          { name: "Hauptplatz B", code: "STADION_B", type: FacilityResourceType.HALF_PITCH, sortOrder: 30 },
        ],
      },
      {
        name: "Kunstrasen 2",
        type: FacilityType.PITCH,
        sortOrder: 20,
        resources: [
          { name: "Kunstrasen 2", code: "KUNSTRASEN_2", type: FacilityResourceType.FULL_PITCH, sortOrder: 10 },
          { name: "Kunstrasen 2 A", code: "KUNSTRASEN_2_A", type: FacilityResourceType.HALF_PITCH, sortOrder: 20 },
          { name: "Kunstrasen 2 B", code: "KUNSTRASEN_2_B", type: FacilityResourceType.HALF_PITCH, sortOrder: 30 },
        ],
      },
      {
        name: "Kunstrasen 3",
        type: FacilityType.PITCH,
        sortOrder: 30,
        resources: [
          { name: "Kunstrasen 3", code: "KUNSTRASEN_3", type: FacilityResourceType.FULL_PITCH, sortOrder: 10 },
          { name: "Kunstrasen 3 A", code: "KUNSTRASEN_3_A", type: FacilityResourceType.HALF_PITCH, sortOrder: 20 },
          { name: "Kunstrasen 3 B", code: "KUNSTRASEN_3_B", type: FacilityResourceType.HALF_PITCH, sortOrder: 30 },
        ],
      },
      {
        name: "Garderoben",
        type: FacilityType.DRESSING_ROOM_BLOCK,
        sortOrder: 40,
        resources: [
          { name: "E1", code: "E1", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 10 },
          { name: "E2", code: "E2", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 20 },
          { name: "E3", code: "E3", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 30 },
          { name: "E4", code: "E4", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 40 },
          { name: "O1", code: "O1", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 50 },
          { name: "O2", code: "O2", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 60 },
          { name: "O3", code: "O3", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 70 },
          { name: "O4", code: "O4", type: FacilityResourceType.DRESSING_ROOM, sortOrder: 80 },
        ],
      },
    ];

    for (const facilityDef of facilitySeedData) {
      // Upsert by (tenantId, name) — safe to re-run
      const existing = await prisma.facility.findFirst({
        where: { tenantId: fcaTenant.id, name: facilityDef.name },
        select: { id: true },
      });

      const facility = existing
        ? await prisma.facility.update({
            where: { id: existing.id },
            data: { type: facilityDef.type, sortOrder: facilityDef.sortOrder },
          })
        : await prisma.facility.create({
            data: {
              tenantId: fcaTenant.id,
              name: facilityDef.name,
              type: facilityDef.type,
              sortOrder: facilityDef.sortOrder,
            },
          });

      for (const resourceDef of facilityDef.resources) {
        await prisma.facilityResource.upsert({
          where: { tenantId_code: { tenantId: fcaTenant.id, code: resourceDef.code } },
          update: { name: resourceDef.name, type: resourceDef.type, sortOrder: resourceDef.sortOrder, facilityId: facility.id },
          create: {
            tenantId: fcaTenant.id,
            facilityId: facility.id,
            name: resourceDef.name,
            code: resourceDef.code,
            type: resourceDef.type,
            sortOrder: resourceDef.sortOrder,
          },
        });
      }
    }
  }

  console.log("Seed finished successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
