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

async function main() {
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

    { key: "vereinsleitung.view", name: "View Vereinsleitung", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.kpi.view", name: "View Vereinsleitung KPI", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.pendenzen.view", name: "View Vereinsleitung pendenzen", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.pendenzen.manage", name: "Manage Vereinsleitung pendenzen", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.meetings.view", name: "View Vereinsleitung meetings", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.meetings.manage", name: "Manage Vereinsleitung meetings", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.initiatives.view", name: "View Vereinsleitung initiatives", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.initiatives.manage", name: "Manage Vereinsleitung initiatives", module: PermissionModule.FUNCTIONS },
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

  const activeSeason = await prisma.season.findUnique({
    where: { key: "2025-2026" },
  });

  if (!activeSeason) {
    throw new Error("Active season 2025-2026 not found during seeding.");
  }

  const teams = [
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
  ] as const;

  const createdTeams: Record<string, { id: string; name: string; slug: string }> = {};

  for (const teamData of teams) {
    const team = await prisma.team.upsert({
      where: { slug: teamData.slug },
      update: {
        name: teamData.name,
        category: teamData.category,
        genderGroup: teamData.genderGroup,
        ageGroup: teamData.ageGroup,
        sortOrder: teamData.sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
      },
      create: {
        name: teamData.name,
        slug: teamData.slug,
        category: teamData.category,
        genderGroup: teamData.genderGroup,
        ageGroup: teamData.ageGroup,
        sortOrder: teamData.sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
      },
    });

    createdTeams[team.slug] = {
      id: team.id,
      name: team.name,
      slug: team.slug,
    };

    await prisma.teamSeason.upsert({
      where: {
        teamId_seasonId: {
          teamId: team.id,
          seasonId: activeSeason.id,
        },
      },
      update: {
        displayName: "FC Allschwil " + teamData.name,
        shortName: teamData.name,
        status: TeamSeasonStatus.ACTIVE,
        websiteVisible: true,
        infoboardVisible: true,
      },
      create: {
        teamId: team.id,
        seasonId: activeSeason.id,
        displayName: "FC Allschwil " + teamData.name,
        shortName: teamData.name,
        status: TeamSeasonStatus.ACTIVE,
        websiteVisible: true,
        infoboardVisible: true,
      },
    });
  }

  const demoTitles = [
    "FC Allschwil E4 vs FC Concordia Basel",
    "E4 Frühlingsturnier Aesch",
    "E4 Training Dienstag",
    "Sponsor Apéro Frühling 2026",
  ];

  await prisma.event.deleteMany({
    where: {
      seasonId: activeSeason.id,
      title: {
        in: demoTitles,
      },
    },
  });

  if (createdTeams["e4"]) {
    await prisma.event.create({
      data: {
        seasonId: activeSeason.id,
        teamId: createdTeams["e4"].id,
        type: EventType.MATCH,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        title: "FC Allschwil E4 vs FC Concordia Basel",
        description: "Demo Match für Spielplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brühl",
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
        seasonId: activeSeason.id,
        teamId: createdTeams["e4"].id,
        type: EventType.TOURNAMENT,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
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
        seasonId: activeSeason.id,
        teamId: createdTeams["e4"].id,
        type: EventType.TRAINING,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        title: "E4 Training Dienstag",
        description: "Demo Training für Trainingsplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brühl",
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
      seasonId: activeSeason.id,
      type: EventType.OTHER,
      source: EventSource.MANUAL,
      status: EventStatus.SCHEDULED,
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

  console.log("Seed finished successfully.");
  console.log("Admin login:");
  console.log("Email: admin@fcallschwil.ch");
  console.log("Password: ChangeMe123! -> change immediately after first login.");
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
