import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  EventSource,
  EventStatus,
  EventType,
  PermissionModule,
  PrismaClient,
  TeamCategory,
  TeamSeasonStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Explicit data-shape types ─────────────────────────────────────────────

type TenantDefaults = {
  name: string;
  displayName: string;
  countryCode: string;
  sportType: string;
  primaryColor: string;
};

type SeasonDefinition = {
  key: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};

type TeamDefinition = {
  name: string;
  slug: string;
  category: TeamCategory;
  genderGroup: string;
  ageGroup: string;
  sortOrder: number;
};

// ─── Sync helpers ──────────────────────────────────────────────────────────

async function syncTenant(slug: string, defaults: TenantDefaults) {
  const existing = await prisma.tenant.findUnique({ where: { slug } });

  if (existing) {
    return prisma.tenant.update({
      where: { slug },
      data: {
        name: defaults.name,
        displayName: defaults.displayName,
        countryCode: defaults.countryCode,
        sportType: defaults.sportType,
        primaryColor: defaults.primaryColor,
        isActive: true,
      },
    });
  }

  return prisma.tenant.create({
    data: {
      slug,
      name: defaults.name,
      displayName: defaults.displayName,
      countryCode: defaults.countryCode,
      sportType: defaults.sportType,
      primaryColor: defaults.primaryColor,
      isActive: true,
    },
  });
}

async function syncSeason(tenantId: string, data: SeasonDefinition) {
  const now = new Date();
  const existing = await prisma.season.findUnique({ where: { key: data.key } });

  if (existing) {
    return prisma.season.update({
      where: { key: data.key },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive,
        updatedAt: now,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  return prisma.season.create({
    data: {
      key: data.key,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: data.isActive,
      updatedAt: now,
      tenant: { connect: { id: tenantId } },
    },
  });
}

async function syncTeam(tenantId: string, data: TeamDefinition) {
  const now = new Date();
  const existing = await prisma.team.findUnique({ where: { slug: data.slug } });

  if (existing) {
    return prisma.team.update({
      where: { slug: data.slug },
      data: {
        name: data.name,
        category: data.category,
        genderGroup: data.genderGroup,
        ageGroup: data.ageGroup,
        sortOrder: data.sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
        updatedAt: now,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  return prisma.team.create({
    data: {
      name: data.name,
      slug: data.slug,
      category: data.category,
      genderGroup: data.genderGroup,
      ageGroup: data.ageGroup,
      sortOrder: data.sortOrder,
      isActive: true,
      websiteVisible: true,
      infoboardVisible: true,
      updatedAt: now,
      tenant: { connect: { id: tenantId } },
    },
  });
}

async function syncTeamSeason(
  seasonId: string,
  teamId: string,
  displayName: string,
  shortName: string,
) {
  const now = new Date();
  const existing = await prisma.teamSeason.findUnique({
    where: { teamId_seasonId: { teamId, seasonId } },
  });

  if (existing) {
    return prisma.teamSeason.update({
      where: { teamId_seasonId: { teamId, seasonId } },
      data: {
        displayName,
        shortName,
        status: TeamSeasonStatus.ACTIVE,
        websiteVisible: true,
        infoboardVisible: true,
        updatedAt: now,
      },
    });
  }

  return prisma.teamSeason.create({
    data: {
      teamId,
      seasonId,
      displayName,
      shortName,
      status: TeamSeasonStatus.ACTIVE,
      websiteVisible: true,
      infoboardVisible: true,
      updatedAt: now,
    },
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Permissions ──────────────────────────────────────────────────────
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

    { key: "tenants.manage", name: "Manage tenants", module: PermissionModule.TENANTS },
  ];

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

  // ── 2. Roles ─────────────────────────────────────────────────────────────
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
      ],
    },
  ];

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

  // ── 3. Tenant ─────────────────────────────────────────────────────────────
  const tenant = await syncTenant("fc-allschwil", {
    name: "FC Allschwil",
    displayName: "FC Allschwil",
    countryCode: "CH",
    sportType: "football",
    primaryColor: "#0b4aa2",
  });

  console.log(`✓ Tenant resolved for seed: ${tenant.displayName ?? tenant.name}`);

  // ── 4. Seasons ────────────────────────────────────────────────────────────
  await prisma.season.updateMany({
    data: { isActive: false },
  });

  const seasonDefinitions: SeasonDefinition[] = [
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
  ];

  for (const seasonData of seasonDefinitions) {
    await syncSeason(tenant.id, seasonData);
  }

  const activeSeason = await prisma.season.findUnique({
    where: { key: "2025-2026" },
  });

  if (!activeSeason) {
    throw new Error("Active season 2025-2026 not found during seeding.");
  }

  // ── 5. Teams + TeamSeasons ─────────────────────────────────────────────────
  const teamDefinitions: TeamDefinition[] = [
    {
      name: "E4",
      slug: "e4",
      category: TeamCategory.KINDERFUSSBALL,
      genderGroup: "Mixed",
      ageGroup: "E",
      sortOrder: 10,
    },
    {
      name: "1. Mannschaft",
      slug: "1-mannschaft",
      category: TeamCategory.AKTIVE,
      genderGroup: "Men",
      ageGroup: "Aktive",
      sortOrder: 100,
    },
    {
      name: "Trainingsgruppe",
      slug: "trainingsgruppe",
      category: TeamCategory.TRAININGSGRUPPE,
      genderGroup: "Mixed",
      ageGroup: "30+",
      sortOrder: 200,
    },
  ];

  const createdTeams: Record<string, { id: string; name: string; slug: string }> = {};

  for (const teamData of teamDefinitions) {
    const team = await syncTeam(tenant.id, teamData);

    createdTeams[team.slug] = {
      id: team.id,
      name: team.name,
      slug: team.slug,
    };

    await syncTeamSeason(
      activeSeason.id,
      team.id,
      `FC Allschwil ${teamData.name}`,
      teamData.name,
    );
  }

  // ── 6. Demo Events ────────────────────────────────────────────────────────
  const demoTitles = [
    "FC Allschwil E4 vs FC Concordia Basel",
    "E4 Frühlingsturnier Aesch",
    "E4 Training Dienstag",
    "Sponsor Apéro Frühling 2026",
  ];

  await prisma.event.deleteMany({
    where: {
      seasonId: activeSeason.id,
      title: { in: demoTitles },
    },
  });

  const eventNow = new Date();

  if (createdTeams["e4"]) {
    await prisma.event.create({
      data: {
        season: { connect: { id: activeSeason.id } },
        team: { connect: { id: createdTeams["e4"].id } },
        tenant: { connect: { id: tenant.id } },
        type: EventType.MATCH,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        updatedAt: eventNow,
        title: "FC Allschwil E4 vs FC Concordia Basel",
        description: "Demo Match für Spielplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brüel",
        startAt: new Date("2026-04-18T08:30:00.000Z"),
        endAt: new Date("2026-04-18T10:00:00.000Z"),
        opponentName: "FC Concordia Basel",
        competitionLabel: "Freundschaftsspiel",
        homeAway: "HOME",
        websiteVisible: true,
        infoboardVisible: true,
        homepageVisible: true,
        wochenplanVisible: true,
        trainingsplanVisible: false,
        teamPageVisible: true,
        sortOrder: 10,
      },
    });

    await prisma.event.create({
      data: {
        season: { connect: { id: activeSeason.id } },
        team: { connect: { id: createdTeams["e4"].id } },
        tenant: { connect: { id: tenant.id } },
        type: EventType.TOURNAMENT,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        updatedAt: eventNow,
        title: "E4 Frühlingsturnier Aesch",
        description: "Demo Turnier für Website, Wochenplan, Teamseite und Infoboard.",
        location: "Sportanlage Aesch",
        startAt: new Date("2026-05-02T07:30:00.000Z"),
        endAt: new Date("2026-05-02T15:30:00.000Z"),
        organizerName: "FC Aesch",
        competitionLabel: "Frühlingsturnier",
        websiteVisible: true,
        infoboardVisible: true,
        homepageVisible: true,
        wochenplanVisible: true,
        trainingsplanVisible: false,
        teamPageVisible: true,
        sortOrder: 20,
      },
    });

    await prisma.event.create({
      data: {
        season: { connect: { id: activeSeason.id } },
        team: { connect: { id: createdTeams["e4"].id } },
        tenant: { connect: { id: tenant.id } },
        type: EventType.TRAINING,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        updatedAt: eventNow,
        title: "E4 Training Dienstag",
        description: "Demo Training für Trainingsplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brüel",
        startAt: new Date("2026-04-21T15:30:00.000Z"),
        endAt: new Date("2026-04-21T17:00:00.000Z"),
        meetingTime: new Date("2026-04-21T15:15:00.000Z"),
        websiteVisible: true,
        infoboardVisible: true,
        homepageVisible: false,
        wochenplanVisible: true,
        trainingsplanVisible: true,
        teamPageVisible: true,
        sortOrder: 30,
      },
    });
  }

  await prisma.event.create({
    data: {
      season: { connect: { id: activeSeason.id } },
      tenant: { connect: { id: tenant.id } },
      type: EventType.OTHER,
      source: EventSource.MANUAL,
      status: EventStatus.SCHEDULED,
      updatedAt: eventNow,
      title: "Sponsor Apéro Frühling 2026",
      description: "Demo weiteres Event für die Website Events Seite.",
      location: "Clubhaus FC Allschwil",
      startAt: new Date("2026-05-14T16:30:00.000Z"),
      endAt: new Date("2026-05-14T20:00:00.000Z"),
      organizerName: "FC Allschwil Business Club",
      websiteVisible: true,
      infoboardVisible: false,
      homepageVisible: true,
      wochenplanVisible: false,
      trainingsplanVisible: false,
      teamPageVisible: false,
      sortOrder: 40,
    },
  });

  // ── 7. Admin user ─────────────────────────────────────────────────────────
  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
  });

  if (!superAdminRole) {
    throw new Error("Super Admin role not found during seeding.");
  }

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  // ── 8. Admin → FC Allschwil UserTenant ────────────────────────────────────
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tenant.id,
      },
    },
    update: { isActive: true, role: "super_admin" },
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: "super_admin",
      isActive: true,
    },
  });

  console.log("✓ Admin user linked to tenant: FC Allschwil");
  console.log("Seed finished successfully.");
  console.log("Admin login:");
  console.log("  Email:    admin@fcallschwil.ch");
  console.log("  Password: ChangeMe123! → change immediately after first login.");
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
