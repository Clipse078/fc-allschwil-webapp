import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  FacilityResourceType,
  FacilityType,
  PermissionModule,
  PrismaClient,
  TenantStatus,
} from "@prisma/client";
import { Pool } from "pg";
import { PLATFORM_BRANDING } from "@/lib/tenant-runtime/branding";

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

  const permissions = [
    { key: "users.manage", name: "Manage users", module: PermissionModule.USERS },
    { key: "users.impersonate", name: "Impersonate users", module: PermissionModule.USERS },

    { key: "seasons.view", name: "View seasons", module: PermissionModule.SEASONS },
    { key: "seasons.manage", name: "Manage seasons", module: PermissionModule.SEASONS },

    { key: "teams.view", name: "View teams", module: PermissionModule.TEAMS },
    { key: "teams.manage", name: "Manage teams", module: PermissionModule.TEAMS },

    { key: "people.view", name: "View people", module: PermissionModule.PEOPLE },
    { key: "people.manage", name: "Manage people", module: PermissionModule.PEOPLE },

    { key: "events.view", name: "View events", module: PermissionModule.EVENTS },
    { key: "events.manage", name: "Manage events", module: PermissionModule.EVENTS },
    { key: "events.import", name: "Import events", module: PermissionModule.EVENTS },
    { key: "events.publish_website", name: "Publish events to website", module: PermissionModule.EVENTS },
    { key: "events.publish_infoboard", name: "Publish events to infoboard", module: PermissionModule.EVENTS },

    { key: "fixtures.view", name: "View fixtures", module: PermissionModule.FIXTURES },
    { key: "fixtures.create", name: "Create fixtures", module: PermissionModule.FIXTURES },
    { key: "fixtures.edit_all", name: "Edit all fixtures", module: PermissionModule.FIXTURES },
    {
      key: "fixtures.submit_for_publication",
      name: "Submit fixtures for publication",
      module: PermissionModule.FIXTURES,
    },
    {
      key: "fixtures.publish_website",
      name: "Publish fixtures to website",
      module: PermissionModule.FIXTURES,
    },
    {
      key: "fixtures.publish_infoboard",
      name: "Publish fixtures to infoboard",
      module: PermissionModule.FIXTURES,
    },

    { key: "wochenplan.manage", name: "Manage Wochenplan", module: PermissionModule.WOCHENPLAN },
    { key: "news.manage", name: "Manage news", module: PermissionModule.NEWS },
    { key: "website.manage", name: "Manage website content", module: PermissionModule.WEBSITE },
    { key: "infoboard.manage", name: "Manage infoboard", module: PermissionModule.INFOBOARD },
    { key: "functions.manage", name: "Manage functions", module: PermissionModule.FUNCTIONS },

    { key: "targets.view", name: "View targets", module: PermissionModule.TARGETS },
    { key: "targets.manage", name: "Manage targets", module: PermissionModule.TARGETS },

    { key: "meetings.view", name: "View meetings", module: PermissionModule.MEETINGS },
    { key: "meetings.manage", name: "Manage meetings", module: PermissionModule.MEETINGS },

    { key: "initiatives.view", name: "View initiatives", module: PermissionModule.INITIATIVES },
    { key: "initiatives.manage", name: "Manage initiatives", module: PermissionModule.INITIATIVES },

    { key: "templates.view", name: "View templates", module: PermissionModule.TEMPLATES },
    { key: "templates.manage", name: "Manage templates", module: PermissionModule.TEMPLATES },

    { key: "registrations.view", name: "View registrations", module: PermissionModule.REGISTRATIONS },
    { key: "registrations.edit", name: "Edit registrations", module: PermissionModule.REGISTRATIONS },

    { key: "tenants.view", name: "View tenants", module: PermissionModule.TENANTS },
    { key: "tenants.manage", name: "Manage tenants", module: PermissionModule.TENANTS },

    { key: "org.view", name: "View organisations", module: PermissionModule.ORG },
    { key: "org.manage", name: "Manage organisations", module: PermissionModule.ORG },

    { key: "facilities.view", name: "View facilities & resources", module: PermissionModule.FACILITIES },
    { key: "facilities.manage", name: "Manage facilities & resources", module: PermissionModule.FACILITIES },

    { key: "trainings.view", name: "View training allocations", module: PermissionModule.TRAININGS },
    { key: "trainings.manage", name: "Manage training allocations", module: PermissionModule.TRAININGS },
  ] as const;

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        module: permission.module,
      },
      create: {
        key: permission.key,
        name: permission.name,
        module: permission.module,
      },
    });
  }

  const roleDefinitions = [
    {
      key: "super_admin",
      name: "Super Admin",
      description: "Full platform access",
      permissionKeys: permissions.map((permission) => permission.key),
    },
    {
      key: "match_coordinator",
      name: "Match Coordinator",
      description: "Operational fixture owner",
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
      },
      create: {
        key: roleDefinition.key,
        name: roleDefinition.name,
        description: roleDefinition.description,
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
