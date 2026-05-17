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

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Safe upsert helpers – all use findFirst (plain SELECT … LIMIT 1) so they
// never emit ON CONFLICT and therefore never require the DB to have the
// unique constraint declared in the Prisma schema.  Updates are always by
// the @id primary key which is guaranteed to exist.
// ---------------------------------------------------------------------------

async function syncPermission(data: {
  key: string;
  name: string;
  module: PermissionModule;
}) {
  const existing = await prisma.permission.findFirst({ where: { key: data.key } });
  if (existing) {
    await prisma.permission.update({
      where: { id: existing.id },
      data: { name: data.name, module: data.module },
    });
    return existing.id;
  }
  const created = await prisma.permission.create({ data });
  return created.id;
}

async function syncRole(data: { key: string; name: string; description: string }) {
  const existing = await prisma.role.findFirst({ where: { key: data.key } });
  if (existing) {
    await prisma.role.update({
      where: { id: existing.id },
      data: { name: data.name, description: data.description },
    });
    return existing.id;
  }
  const created = await prisma.role.create({ data });
  return created.id;
}

async function syncRolePermission(roleId: string, permissionId: string) {
  const existing = await prisma.rolePermission.findFirst({
    where: { roleId, permissionId },
  });
  if (!existing) {
    await prisma.rolePermission.create({ data: { roleId, permissionId } });
  }
}

async function syncSeason(data: {
  key: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}) {
  const existing = await prisma.season.findFirst({ where: { key: data.key } });
  if (existing) {
    await prisma.season.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive,
      },
    });
    return existing.id;
  }
  const created = await prisma.season.create({ data });
  return created.id;
}

async function syncTeam(data: {
  name: string;
  slug: string;
  category: TeamCategory;
  genderGroup: string;
  ageGroup: string;
  sortOrder: number;
}) {
  const existing = await prisma.team.findFirst({ where: { slug: data.slug } });
  if (existing) {
    await prisma.team.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        category: data.category,
        genderGroup: data.genderGroup,
        ageGroup: data.ageGroup,
        sortOrder: data.sortOrder,
        isActive: true,
        websiteVisible: true,
        infoboardVisible: true,
      },
    });
    return existing.id;
  }
  const created = await prisma.team.create({
    data: {
      ...data,
      isActive: true,
      websiteVisible: true,
      infoboardVisible: true,
    },
  });
  return created.id;
}

async function syncTeamSeason(teamId: string, seasonId: string, displayName: string, shortName: string) {
  const existing = await prisma.teamSeason.findFirst({ where: { teamId, seasonId } });
  if (existing) {
    await prisma.teamSeason.update({
      where: { id: existing.id },
      data: {
        displayName,
        shortName,
        status: TeamSeasonStatus.ACTIVE,
        websiteVisible: true,
        infoboardVisible: true,
      },
    });
    return existing.id;
  }
  const created = await prisma.teamSeason.create({
    data: {
      teamId,
      seasonId,
      displayName,
      shortName,
      status: TeamSeasonStatus.ACTIVE,
      websiteVisible: true,
      infoboardVisible: true,
    },
  });
  return created.id;
}

async function syncUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  isActive: boolean;
}) {
  const existing = await prisma.user.findFirst({ where: { email: data.email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: data.passwordHash,
        isActive: data.isActive,
      },
    });
    return existing.id;
  }
  const created = await prisma.user.create({ data });
  return created.id;
}

async function syncUserRole(userId: string, roleId: string) {
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId } });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId } });
  }
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  // ── 1. Permissions ────────────────────────────────────────────────────────
  const permissionDefs = [
    { key: "users.manage",     name: "Manage users",                    module: PermissionModule.USERS },
    { key: "users.impersonate",name: "Impersonate users",               module: PermissionModule.USERS },

    { key: "seasons.view",     name: "View seasons",                    module: PermissionModule.SEASONS },
    { key: "seasons.manage",   name: "Manage seasons",                  module: PermissionModule.SEASONS },

    { key: "teams.view",       name: "View teams",                      module: PermissionModule.TEAMS },
    { key: "teams.manage",     name: "Manage teams",                    module: PermissionModule.TEAMS },

    { key: "people.view",      name: "View people",                     module: PermissionModule.PEOPLE },
    { key: "people.manage",    name: "Manage people",                   module: PermissionModule.PEOPLE },

    { key: "events.view",               name: "View events",                          module: PermissionModule.EVENTS },
    { key: "events.manage",             name: "Manage events",                        module: PermissionModule.EVENTS },
    { key: "events.import",             name: "Import events",                        module: PermissionModule.EVENTS },
    { key: "events.publish_website",    name: "Publish events to website",            module: PermissionModule.EVENTS },
    { key: "events.publish_infoboard",  name: "Publish events to infoboard",         module: PermissionModule.EVENTS },

    { key: "fixtures.view",                    name: "View fixtures",                         module: PermissionModule.FIXTURES },
    { key: "fixtures.create",                  name: "Create fixtures",                       module: PermissionModule.FIXTURES },
    { key: "fixtures.edit_all",                name: "Edit all fixtures",                     module: PermissionModule.FIXTURES },
    { key: "fixtures.submit_for_publication",  name: "Submit fixtures for publication",       module: PermissionModule.FIXTURES },
    { key: "fixtures.publish_website",         name: "Publish fixtures to website",           module: PermissionModule.FIXTURES },
    { key: "fixtures.publish_infoboard",       name: "Publish fixtures to infoboard",        module: PermissionModule.FIXTURES },

    { key: "wochenplan.manage", name: "Manage Wochenplan",         module: PermissionModule.WOCHENPLAN },
    { key: "news.manage",       name: "Manage news",               module: PermissionModule.NEWS },
    { key: "website.manage",    name: "Manage website content",    module: PermissionModule.WEBSITE },
    { key: "infoboard.manage",  name: "Manage infoboard",          module: PermissionModule.INFOBOARD },
    { key: "functions.manage",  name: "Manage functions",          module: PermissionModule.FUNCTIONS },
  ] as const;

  const permissionIdByKey: Record<string, string> = {};
  for (const perm of permissionDefs) {
    permissionIdByKey[perm.key] = await syncPermission(perm);
  }

  // ── 2. Roles + role-permission assignments ────────────────────────────────
  const allPermissionKeys = permissionDefs.map((p) => p.key);

  const roleDefinitions = [
    {
      key: "super_admin",
      name: "Super Admin",
      description: "Full platform access",
      permissionKeys: allPermissionKeys,
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

  const roleIdByKey: Record<string, string> = {};
  for (const roleDef of roleDefinitions) {
    const roleId = await syncRole({
      key: roleDef.key,
      name: roleDef.name,
      description: roleDef.description,
    });
    roleIdByKey[roleDef.key] = roleId;

    for (const permKey of roleDef.permissionKeys) {
      const permId = permissionIdByKey[permKey];
      if (!permId) {
        throw new Error(`Permission id not found for key during role wiring: ${permKey}`);
      }
      await syncRolePermission(roleId, permId);
    }
  }

  // ── 3. Seasons ────────────────────────────────────────────────────────────
  // Deactivate all first (safe — no unique constraint needed).
  await prisma.season.updateMany({ data: { isActive: false } });

  const seasonDefs = [
    {
      key: "2025-2026",
      name: "Saison 2025/2026",
      startDate: new Date("2025-07-15T00:00:00.000Z"),
      endDate:   new Date("2026-07-14T23:59:59.999Z"),
      isActive: true,
    },
    {
      key: "2026-2027",
      name: "Saison 2026/2027",
      startDate: new Date("2026-07-15T00:00:00.000Z"),
      endDate:   new Date("2027-07-14T23:59:59.999Z"),
      isActive: false,
    },
    {
      key: "2027-2028",
      name: "Saison 2027/2028",
      startDate: new Date("2027-07-15T00:00:00.000Z"),
      endDate:   new Date("2028-07-14T23:59:59.999Z"),
      isActive: false,
    },
  ] as const;

  for (const s of seasonDefs) {
    await syncSeason(s);
  }

  const activeSeason = await prisma.season.findFirst({ where: { key: "2025-2026" } });
  if (!activeSeason) {
    throw new Error("Active season 2025-2026 not found after seeding seasons.");
  }

  // ── 4. Teams + TeamSeasons ────────────────────────────────────────────────
  const teamDefs = [
    { name: "E4",              slug: "e4",              category: TeamCategory.KINDERFUSSBALL, genderGroup: "Mixed", ageGroup: "E",      sortOrder: 10  },
    { name: "1. Mannschaft",   slug: "1-mannschaft",    category: TeamCategory.AKTIVE,         genderGroup: "Men",   ageGroup: "Aktive", sortOrder: 100 },
    { name: "Trainingsgruppe", slug: "trainingsgruppe", category: TeamCategory.TRAININGSGRUPPE,genderGroup: "Mixed", ageGroup: "30+",    sortOrder: 200 },
  ] as const;

  const teamIdBySlug: Record<string, string> = {};
  for (const teamData of teamDefs) {
    const teamId = await syncTeam(teamData);
    teamIdBySlug[teamData.slug] = teamId;
    await syncTeamSeason(
      teamId,
      activeSeason.id,
      "FC Allschwil " + teamData.name,
      teamData.name,
    );
  }

  // ── 5. Demo events ────────────────────────────────────────────────────────
  // Delete-then-recreate by title + seasonId so the block is idempotent
  // without relying on any unique constraint.
  const demoTitles = [
    "FC Allschwil E4 vs FC Concordia Basel",
    "E4 Frühlingsturnier Aesch",
    "E4 Training Dienstag",
    "Sponsor Apéro Frühling 2026",
  ];

  await prisma.event.deleteMany({
    where: { seasonId: activeSeason.id, title: { in: demoTitles } },
  });

  const e4TeamId = teamIdBySlug["e4"];
  if (e4TeamId) {
    await prisma.event.create({
      data: {
        seasonId: activeSeason.id,
        teamId: e4TeamId,
        type: EventType.MATCH,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        title: "FC Allschwil E4 vs FC Concordia Basel",
        description: "Demo Match für Spielplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brüel",
        startAt: new Date("2026-04-18T08:30:00.000Z"),
        endAt:   new Date("2026-04-18T10:00:00.000Z"),
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
        teamId: e4TeamId,
        type: EventType.TOURNAMENT,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        title: "E4 Frühlingsturnier Aesch",
        description: "Demo Turnier für Website, Wochenplan, Teamseite und Infoboard.",
        location: "Sportanlage Aesch",
        startAt: new Date("2026-05-02T07:30:00.000Z"),
        endAt:   new Date("2026-05-02T15:30:00.000Z"),
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
        teamId: e4TeamId,
        type: EventType.TRAINING,
        source: EventSource.MANUAL,
        status: EventStatus.SCHEDULED,
        title: "E4 Training Dienstag",
        description: "Demo Training für Trainingsplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im Brüel",
        startAt: new Date("2026-04-21T15:30:00.000Z"),
        endAt:   new Date("2026-04-21T17:00:00.000Z"),
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
      endAt:   new Date("2026-05-14T20:00:00.000Z"),
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

  // ── 6. Superadmin user ────────────────────────────────────────────────────
  const superAdminRoleId = roleIdByKey["super_admin"];
  if (!superAdminRoleId) {
    throw new Error("super_admin role id not found after seeding roles.");
  }

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const adminUserId = await syncUser({
    email: "admin@fcallschwil.ch",
    firstName: "Platform",
    lastName: "Admin",
    passwordHash,
    isActive: true,
  });

  await syncUserRole(adminUserId, superAdminRoleId);

  console.log("\nSeed finished successfully.");
  console.log("Superadmin login:");
  console.log("  Email:    admin@fcallschwil.ch");
  console.log("  Password: ChangeMe123!  (change immediately after first login)");
  console.log("  Role:     super_admin\n");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
