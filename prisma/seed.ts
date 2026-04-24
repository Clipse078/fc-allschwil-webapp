import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  EventSource,
  EventStatus,
  EventType,
  PermissionModule,
  PlanningResourceType,
  PrismaClient,
  TeamCategory,
  TeamSeasonStatus,
  VereinsleitungMeetingApprovalStatus,
  VereinsleitungMeetingMode,
  VereinsleitungMeetingProvider,
  VereinsleitungTeamsSyncStatus,
  VereinsleitungInitiativeStatus,
  VereinsleitungInitiativeWorkItemAssigneeMode,
  VereinsleitungInitiativeWorkItemStatus,
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
    { key: "vereinsleitung.meetings.review", name: "Review Vereinsleitung meetings", module: PermissionModule.FUNCTIONS },
    { key: "vereinsleitung.meetings.approve", name: "Approve Vereinsleitung meetings", module: PermissionModule.FUNCTIONS },
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
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: permissions.map((permission) => permission.key),
    },
    {
      key: "president",
      name: "PrÃƒÆ’Ã‚Â¤sident",
      description: "Vereinsleitung",
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
        "vereinsleitung.kpi.view",
        "vereinsleitung.pendenzen.view",
        "vereinsleitung.pendenzen.manage",
        "vereinsleitung.meetings.view",
        "vereinsleitung.meetings.manage",
        "vereinsleitung.meetings.review",
        "vereinsleitung.meetings.approve",
        "vereinsleitung.initiatives.view",
        "vereinsleitung.initiatives.manage",
      ],
    },
    {
      key: "vice_president",
      name: "Vize-PrÃƒÆ’Ã‚Â¤sident",
      description: "Vereinsleitung",
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
        "vereinsleitung.kpi.view",
        "vereinsleitung.pendenzen.view",
        "vereinsleitung.pendenzen.manage",
        "vereinsleitung.meetings.view",
        "vereinsleitung.meetings.review",
        "vereinsleitung.meetings.approve",
        "vereinsleitung.initiatives.view",
        "vereinsleitung.initiatives.manage",
      ],
    },
    {
      key: "sekretaer",
      name: "SekretÃƒÆ’Ã‚Â¤r",
      description: "Vereinsleitung",
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
        "vereinsleitung.kpi.view",
        "vereinsleitung.pendenzen.view",
        "vereinsleitung.meetings.view",
        "vereinsleitung.meetings.manage",
        "vereinsleitung.meetings.review",
        "vereinsleitung.initiatives.view",
      ],
    },
    {
      key: "beisitz",
      name: "Beisitz",
      description: "Vereinsleitung",
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
        "vereinsleitung.kpi.view",
        "vereinsleitung.pendenzen.view",
        "vereinsleitung.meetings.view",
        "vereinsleitung.initiatives.view",
      ],
    },
    {
      key: "ressortleiter_organisation_vereinsentwicklung",
      name: "Ressortleiter Organisation & Vereinsentwicklung",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
        "vereinsleitung.kpi.view",
        "vereinsleitung.pendenzen.view",
        "vereinsleitung.pendenzen.manage",
        "vereinsleitung.meetings.view",
        "vereinsleitung.meetings.manage",
        "vereinsleitung.meetings.review",
        "vereinsleitung.initiatives.view",
        "vereinsleitung.initiatives.manage",
        "website.manage",
        "news.manage",
      ],
    },
    {
      key: "fussballorganisatorische_leiter",
      name: "Fussballorganisatorische Leiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "events.view",
        "events.manage",
        "fixtures.view",
        "fixtures.create",
        "fixtures.edit_all",
        "wochenplan.manage",
      ],
    },
    {
      key: "it_admin",
      name: "IT admin",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "users.manage",
        "users.impersonate",
        "people.view",
        "website.manage",
        "infoboard.manage",
      ],
    },
    {
      key: "finanzleiter",
      name: "Finanzleiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "vereinsleitung.view",
      ],
    },
    {
      key: "materialleiter",
      name: "Materialleiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "faciliteits_leiter",
      name: "Faciliteits leiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "redaktor",
      name: "Redaktor",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "news.manage",
        "website.manage",
      ],
    },
    {
      key: "content_creator",
      name: "Content Creator",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "news.manage",
        "website.manage",
      ],
    },
    {
      key: "aktivitaetenkommission_leiter",
      name: "AktivitÃƒÆ’Ã‚Â¤tenkommision Leiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "aktivitaetenkommission_mitglied",
      name: "AktivitÃƒÆ’Ã‚Â¤tenkommision Mitgelied",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "business_club_leiter",
      name: "Business Club Leiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "business_club_mitglied",
      name: "Business Club Mitgelied",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "archivkommission_leiter",
      name: "Archivkommision Leiter",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "archivkommission_mitglied",
      name: "Archivkommision Mitgelied",
      description: "Organisatorische Leitung / Operations",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
      ],
    },
    {
      key: "leiter_technische_kommission",
      name: "Leiter Technische Kommission",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "technische_kommission_mitglied",
      name: "Technische Kommission Mitgelied",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_damen",
      name: "Koordinator Damen",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_senioren",
      name: "Koordinator Senioren",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_junioren",
      name: "Koordinator Junioren",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_kifu",
      name: "Koordinator KiFu",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_trainingsgruppen",
      name: "Koordinator Trainingsgruppen",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
        "events.view",
      ],
    },
    {
      key: "koordinator_neu_anmeldungen",
      name: "Koordinator Neu Anmeldungen",
      description: "Technische Kommission",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
      permissionKeys: [
        "people.view",
        "teams.view",
      ],
    },
    {
      key: "match_coordinator",
      name: "Match Coordinator",
      description: "Operational fixture owner",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
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
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
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
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: true,
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
      key: "player",
      name: "Player",
      description: "Player role label",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
      permissionKeys: [],
    },
    {
      key: "contact_person_sponsor",
      name: "Contact persons (Sponsors)",
      description: "External contact",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
      permissionKeys: [],
    },
    {
      key: "contact_person_supplier",
      name: "Contact persons (Suppliers)",
      description: "External contact",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
      permissionKeys: [],
    },
    {
      key: "contact_person_gemeinde",
      name: "Contact persons (Gemeinde)",
      description: "External contact",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
      permissionKeys: [],
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only access",
      canAccessVereinsleitung: false,
      canAttendVereinsleitungMeetings: false,
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
        canAccessVereinsleitung: roleDefinition.canAccessVereinsleitung,
        canAttendVereinsleitungMeetings: roleDefinition.canAttendVereinsleitungMeetings,
      },
      create: {
        key: roleDefinition.key,
        name: roleDefinition.name,
        description: roleDefinition.description,
        canAccessVereinsleitung: roleDefinition.canAccessVereinsleitung,
        canAttendVereinsleitungMeetings: roleDefinition.canAttendVereinsleitungMeetings,
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
    "E4 FrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hlingsturnier Aesch",
    "E4 Training Dienstag",
    "Sponsor ApÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ro FrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hling 2026",
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
        description: "Demo Match fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r Spielplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im BrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hl",
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
        title: "E4 FrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hlingsturnier Aesch",
        description: "Demo Turnier fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r Website, Wochenplan, Teamseite und Infoboard.",
        location: "Sportanlage Aesch",
        startAt: new Date("2026-05-02T07:30:00.000Z"),
        endAt: new Date("2026-05-02T15:30:00.000Z"),
        organizerName: "FC Aesch",
        competitionLabel: "FrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hlingsturnier",
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
        description: "Demo Training fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r Trainingsplan, Wochenplan, Teamseite und Infoboard.",
        location: "Sportplatz im BrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hl",
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
      title: "Sponsor ApÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ro FrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼hling 2026",
      description: "Demo weiteres Event fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r die Website Events Seite.",
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

  const planningResources = [
    { key: "stadion-feld-a", name: "Stadion Feld A", type: PlanningResourceType.PITCH, sortOrder: 10 },
    { key: "stadion-feld-b", name: "Stadion Feld B", type: PlanningResourceType.PITCH, sortOrder: 20 },
    { key: "kunstrasen-2-feld-a", name: "Kunstrasen 2 Feld A", type: PlanningResourceType.PITCH, sortOrder: 30 },
    { key: "kunstrasen-2-feld-b", name: "Kunstrasen 2 Feld B", type: PlanningResourceType.PITCH, sortOrder: 40 },
    { key: "kunstrasen-3-feld-a", name: "Kunstrasen 3 Feld A", type: PlanningResourceType.PITCH, sortOrder: 50 },
    { key: "kunstrasen-3-feld-b", name: "Kunstrasen 3 Feld B", type: PlanningResourceType.PITCH, sortOrder: 60 },
    { key: "garderobe-e1", name: "Garderobe E1", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 110 },
    { key: "garderobe-e2", name: "Garderobe E2", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 120 },
    { key: "garderobe-e3", name: "Garderobe E3", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 130 },
    { key: "garderobe-e4", name: "Garderobe E4", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 140 },
    { key: "garderobe-o1", name: "Garderobe O1", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 210 },
    { key: "garderobe-o2", name: "Garderobe O2", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 220 },
    { key: "garderobe-o3", name: "Garderobe O3", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 230 },
    { key: "garderobe-o4", name: "Garderobe O4", type: PlanningResourceType.DRESSING_ROOM, sortOrder: 240 },
  ] as const;

  for (const resource of planningResources) {
    await prisma.planningResource.upsert({
      where: { key: resource.key },
      update: {
        name: resource.name,
        type: resource.type,
        sortOrder: resource.sortOrder,
        isActive: true,
      },
      create: {
        key: resource.key,
        name: resource.name,
        type: resource.type,
        sortOrder: resource.sortOrder,
        isActive: true,
      },
    });
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
  });

  if (!superAdminRole) {
    throw new Error("Super Admin role not found during seeding.");
  }

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const existingAdminPerson = await prisma.person.findFirst({
    where: { email: "admin@fcallschwil.ch" },
    select: { id: true },
  });

  const adminPerson = existingAdminPerson
    ? await prisma.person.update({
        where: { id: existingAdminPerson.id },
        data: {
          firstName: "FC",
          lastName: "Admin",
          displayName: "FC Admin",
          email: "admin@fcallschwil.ch",
          isActive: true,
          notes: "System-linked admin person for user/person relation and Vereinsleitung access foundation.",
        },
      })
    : await prisma.person.create({
        data: {
          firstName: "FC",
          lastName: "Admin",
          displayName: "FC Admin",
          email: "admin@fcallschwil.ch",
          isActive: true,
          notes: "System-linked admin person for user/person relation and Vereinsleitung access foundation.",
        },
      });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      accessState: "ACTIVE",
      personId: adminPerson.id,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      accessState: "ACTIVE",
      personId: adminPerson.id,
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

  
  await prisma.vereinsleitungInitiative.deleteMany({
    where: {
      slug: "website-relaunch-initiative",
    },
  });

  await prisma.vereinsleitungInitiative.create({
    data: {
      title: "Website Relaunch",
      slug: "website-relaunch-initiative",
      subtitle: "Initiativen Details",
      description:
        "Der aktuelle Webauftritt des FC Allschwil ist technisch veraltet, nicht mobil-optimiert und reprÃƒÂ¤sentiert den Verein nicht mehr zeitgemÃƒÂ¤ss. Ziel dieser Initiative ist die Konzeption, Gestaltung und Entwicklung einer neuen, modernen Website, die als zentraler Kommunikationskanal fÃƒÂ¼r Mitglieder, Fans und Sponsoren dient.",
      status: VereinsleitungInitiativeStatus.IN_PROGRESS,
      ownerPersonId: adminPerson.id,
      ownerRoleLabel: "Ressortleiter Organisation & Vereinsentwicklung",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      targetDate: new Date("2026-09-30T23:59:59.999Z"),
      workItems: {
        create: [
          {
            title: "Phase 6 | Retainer for Additional Requests",
            priority: "MAJOR",
            assigneeMode: VereinsleitungInitiativeWorkItemAssigneeMode.PERSON,
            assigneePersonId: adminPerson.id,
            status: VereinsleitungInitiativeWorkItemStatus.BACKLOG,
            sortOrder: 0,
          },
          {
            title: "v3.7 Customer feedback - part 3",
            priority: "MAJOR",
            assigneeMode: VereinsleitungInitiativeWorkItemAssigneeMode.NONE,
            status: VereinsleitungInitiativeWorkItemStatus.RESOLVED,
            sortOrder: 1,
          },
          {
            title: "Show additional Qualification status on RFRFQ",
            priority: "MAJOR",
            assigneeMode: VereinsleitungInitiativeWorkItemAssigneeMode.EXTERNAL,
            externalAssigneeLabel: "External",
            status: VereinsleitungInitiativeWorkItemStatus.RESOLVED,
            sortOrder: 2,
          },
          {
            title: "Supplier | Spend Data | Adjust Lead Buyers",
            priority: "MAJOR",
            assigneeMode: VereinsleitungInitiativeWorkItemAssigneeMode.NONE,
            status: VereinsleitungInitiativeWorkItemStatus.RESOLVED,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  await prisma.vereinsleitungMeeting.deleteMany({
    where: {
      title: {
        in: ["Demo Vereinsleitung Hybrid Meeting", "Demo Vereinsleitung Online Meeting"],
      },
    },
  });

  await prisma.vereinsleitungMeeting.create({
    data: {
      title: "Demo Vereinsleitung Hybrid Meeting",
      slug: "demo-vereinsleitung-hybrid-meeting",
      subtitle: "Teams-ready Demo Meeting",
      description: "Seeded demo meeting for Teams-ready structure and participant access foundation.",
      status: "PLANNED",
      approvalStatus: VereinsleitungMeetingApprovalStatus.DRAFT,
      location: "Clubhaus FC Allschwil",
      meetingMode: VereinsleitungMeetingMode.HYBRID,
      meetingProvider: VereinsleitungMeetingProvider.MICROSOFT_TEAMS,
      teamsSyncStatus: VereinsleitungTeamsSyncStatus.NOT_CONFIGURED,
      teamsOrganizerUserId: adminUser.id,
      startAt: new Date("2026-05-06T17:30:00.000Z"),
      endAt: new Date("2026-05-06T19:00:00.000Z"),
      participants: {
        create: [
          {
            personId: adminPerson.id,
            displayName: "FC Admin",
            roleLabel: "System Admin",
            status: "INVITED",
            sortOrder: 0,
            remarks: "Linked seeded admin person",
          },
        ],
      },
    },
  });

  await prisma.vereinsleitungMeeting.create({
    data: {
      title: "Demo Vereinsleitung Online Meeting",
      slug: "demo-vereinsleitung-online-meeting",
      subtitle: "External fallback demo",
      description: "Seeded demo meeting keeping backward compatibility with manual online links.",
      status: "PLANNED",
      approvalStatus: VereinsleitungMeetingApprovalStatus.DRAFT,
      meetingMode: VereinsleitungMeetingMode.ONLINE,
      meetingProvider: VereinsleitungMeetingProvider.EXTERNAL,
      onlineMeetingUrl: "https://teams.microsoft.com/",
      externalMeetingUrl: "https://teams.microsoft.com/",
      teamsSyncStatus: VereinsleitungTeamsSyncStatus.MANUAL,
      teamsOrganizerUserId: adminUser.id,
      startAt: new Date("2026-05-13T17:30:00.000Z"),
      endAt: new Date("2026-05-13T18:30:00.000Z"),
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
