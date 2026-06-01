import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  CommunicationTemplateCategory,
  CommunicationTemplateStatus,
  EventSource,
  EventStatus,
  EventType,
  InitiativeStatus,
  MeetingStatus,
  OrgUnitStatus,
  OrgUnitType,
  PermissionModule,
  PrismaClient,
  TargetCategory,
  TargetDirection,
  TargetMetricType,
  TargetPeriod,
  TargetStatus,
  TenantStatus,
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
  await prisma.tenant.upsert({
    where: { key: "fc-allschwil" },
    update: {
      name: "FC Allschwil",
      status: TenantStatus.ACTIVE,
    },
    create: {
      key: "fc-allschwil",
      name: "FC Allschwil",
      status: TenantStatus.ACTIVE,
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

    // Strategic modules — now all three have PermissionModule values
    { key: "targets.view", name: "View targets", module: PermissionModule.TARGETS },
    { key: "targets.manage", name: "Manage targets", module: PermissionModule.TARGETS },

    { key: "meetings.view", name: "View meetings", module: PermissionModule.MEETINGS },
    { key: "meetings.manage", name: "Manage meetings", module: PermissionModule.MEETINGS },

    { key: "initiatives.view", name: "View initiatives", module: PermissionModule.INITIATIVES },
    { key: "initiatives.manage", name: "Manage initiatives", module: PermissionModule.INITIATIVES },

    { key: "templates.view", name: "View templates", module: PermissionModule.TEMPLATES },
    { key: "templates.manage", name: "Manage templates", module: PermissionModule.TEMPLATES },
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

  // ─── Strategic Modules Seed ───────────────────────────────────────────────

  // Targets: skip if any demo targets already exist (moduleKey = "demo" marks seed data)
  const demoTargetCount = await prisma.target.count({ where: { moduleKey: "demo" } });

  if (demoTargetCount === 0) {
    await prisma.target.create({
      data: {
        title: "Frauenfussball ausbauen",
        description: "Anzahl Spielerinnen und aktive Frauenteams gezielt steigern.",
        category: TargetCategory.MITGLIEDERWACHSTUM,
        status: TargetStatus.ACTIVE,
        period: TargetPeriod.SEASON,
        periodLabel: "Saison 2025/26",
        moduleKey: "demo",
        sportCategory: "Fussball",
        ageGroupHint: "Frauen / Mädchen",
        metrics: {
          create: [
            {
              label: "Aktive Spielerinnen",
              type: TargetMetricType.NUMERIC,
              direction: TargetDirection.INCREASE,
              targetValue: 30,
              currentValue: 12,
              unit: "Spielerinnen",
              sortOrder: 0,
            },
            {
              label: "Frauenteams",
              type: TargetMetricType.NUMERIC,
              direction: TargetDirection.INCREASE,
              targetValue: 2,
              currentValue: 0,
              unit: "Teams",
              sortOrder: 1,
            },
          ],
        },
      },
    });

    await prisma.target.create({
      data: {
        title: "Sponsoring-Einnahmen steigern",
        description: "Gesamte Sponsoring-Einnahmen gegenüber Vorjahr erhöhen.",
        category: TargetCategory.FINANZEN,
        status: TargetStatus.ACTIVE,
        period: TargetPeriod.YEAR,
        periodLabel: "2026",
        moduleKey: "demo",
        metrics: {
          create: [
            {
              label: "Sponsoring-Einnahmen",
              type: TargetMetricType.CURRENCY,
              direction: TargetDirection.INCREASE,
              targetValue: 30000,
              currentValue: 18500,
              unit: "CHF",
              sortOrder: 0,
            },
          ],
        },
      },
    });

    await prisma.target.create({
      data: {
        title: "Junioren Techniktraining steigern",
        description: "Anteil technischer Trainingseinheiten bei Junioren erhöhen.",
        category: TargetCategory.SPORTLICHE_ENTWICKLUNG,
        status: TargetStatus.ACTIVE,
        period: TargetPeriod.SEASON,
        periodLabel: "Saison 2025/26",
        moduleKey: "demo",
        sportCategory: "Fussball",
        ageGroupHint: "U10–U17",
        metrics: {
          create: [
            {
              label: "Anteil Techniktraining",
              type: TargetMetricType.PERCENTAGE,
              direction: TargetDirection.INCREASE,
              targetValue: 40,
              currentValue: 25,
              unit: "%",
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  // Meetings: upsert by slug (idempotent — safe to re-run at any time)
  const meetingsData = [
    {
      slug: "vorstandssitzung-april",
      title: "Vorstandssitzung April",
      description: "Monatliche Vorstandssitzung mit Protokoll und Beschlüssen.",
      meetingDate: new Date("2024-04-16T18:00:00.000Z"),
      location: "Clubhaus, Sitzungszimmer 1",
      attendeeCount: 5,
      status: MeetingStatus.COMPLETED,
    },
    {
      slug: "trainer-rapport-rueckrunde",
      title: "Trainer-Rapport Rückrunde",
      description: "Trainer-Rapport zur Saisonplanung und Teamentwicklung.",
      meetingDate: new Date("2024-04-15T16:30:00.000Z"),
      location: "Clubhaus",
      attendeeCount: 3,
      status: MeetingStatus.COMPLETED,
    },
    {
      slug: "medienkoordination-saisonstart",
      title: "Medienkoordination Saisonstart",
      description: "Koordination der Medienkommunikation zum Saisonstart.",
      meetingDate: new Date("2024-04-10T17:00:00.000Z"),
      location: "Clubhaus",
      attendeeCount: 4,
      status: MeetingStatus.COMPLETED,
    },
  ] as const;

  for (const meetingData of meetingsData) {
    await prisma.meeting.upsert({
      where: { slug: meetingData.slug },
      update: {
        title: meetingData.title,
        description: meetingData.description,
        meetingDate: meetingData.meetingDate,
        location: meetingData.location,
        attendeeCount: meetingData.attendeeCount,
        status: meetingData.status,
      },
      create: {
        slug: meetingData.slug,
        title: meetingData.title,
        description: meetingData.description,
        meetingDate: meetingData.meetingDate,
        location: meetingData.location,
        attendeeCount: meetingData.attendeeCount,
        status: meetingData.status,
      },
    });
  }

  // Initiatives: upsert by slug (idempotent — safe to re-run at any time)
  const initiativesData = [
    {
      slug: "website-relaunch",
      title: "Website Relaunch",
      summary: "Vollständige Überarbeitung der Vereinswebsite.",
      status: InitiativeStatus.IN_PROGRESS,
      owner: "Michael Weber",
      progress: 65,
    },
    {
      slug: "neues-clubhaus-konzept",
      title: "Neues Clubhaus Konzept",
      summary: "Konzepterstellung für die Modernisierung des Clubhauses.",
      status: InitiativeStatus.PLANNED,
      owner: "Sarah Meier",
      progress: 10,
    },
    {
      slug: "sponsorenlauf-2025",
      title: "Sponsorenlauf 2025",
      summary: "Jährlicher Sponsorenlauf zur Vereinsfinanzierung.",
      status: InitiativeStatus.ON_TRACK,
      owner: "Thomas Schmid",
      progress: 80,
    },
  ] as const;

  for (const initiativeData of initiativesData) {
    await prisma.initiative.upsert({
      where: { slug: initiativeData.slug },
      update: {
        title: initiativeData.title,
        summary: initiativeData.summary,
        status: initiativeData.status,
        owner: initiativeData.owner,
        progress: initiativeData.progress,
      },
      create: {
        slug: initiativeData.slug,
        title: initiativeData.title,
        summary: initiativeData.summary,
        status: initiativeData.status,
        owner: initiativeData.owner,
        progress: initiativeData.progress,
      },
    });
  }

  // OrgUnits: upsert by key (idempotent — safe to re-run at any time)
  const orgUnitsData = [
    {
      key: "vorstand",
      name: "Vorstand",
      type: OrgUnitType.COMMITTEE,
      status: OrgUnitStatus.ACTIVE,
      level: 0,
      sortOrder: 0,
      description: "Vorstand des Vereins — oberstes Führungsorgan.",
    },
    {
      key: "sportkommission",
      name: "Sportkommission",
      type: OrgUnitType.COMMITTEE,
      status: OrgUnitStatus.ACTIVE,
      level: 1,
      sortOrder: 10,
      description: "Koordination und Entwicklung des Sportbetriebs.",
    },
  ] as const;

  for (const ou of orgUnitsData) {
    await prisma.orgUnit.upsert({
      where: { key: ou.key },
      update: { name: ou.name, description: ou.description },
      create: {
        key: ou.key,
        name: ou.name,
        type: ou.type,
        status: ou.status,
        level: ou.level,
        sortOrder: ou.sortOrder,
        description: ou.description,
      },
    });
  }

  // CommunicationTemplates: upsert by slug (idempotent — safe to re-run)
  const templatesData = [
    {
      slug: "einladung-vorstandssitzung",
      title: "Einladung Vorstandssitzung",
      category: CommunicationTemplateCategory.MEETING_FOLLOWUP,
      status: CommunicationTemplateStatus.ACTIVE,
      subject: "Einladung zur Vorstandssitzung — {{meetingDate}}",
      bodyMarkdown: `Liebe Vorstandsmitglieder,

wir laden euch herzlich zur nächsten Vorstandssitzung ein.

**Datum:** {{meetingDate}}
**Ort:** {{location}}
**Traktanden:** {{agendaItems}}

Bitte bestätigt eure Teilnahme bis {{rsvpDeadline}}.

Sportliche Grüsse
{{senderName}}`,
    },
    {
      slug: "update-initiative",
      title: "Initiative Update",
      category: CommunicationTemplateCategory.INITIATIVE_UPDATE,
      status: CommunicationTemplateStatus.ACTIVE,
      subject: "Statusupdate: {{initiativeTitle}}",
      bodyMarkdown: `Liebe Mitglieder,

hier ein kurzes Update zur Initiative **{{initiativeTitle}}**.

**Aktueller Stand:** {{progress}}%
**Status:** {{status}}
**Nächste Schritte:** {{nextSteps}}

Bei Fragen meldet euch bei {{ownerName}}.

Sportliche Grüsse
{{senderName}}`,
    },
  ] as const;

  for (const tpl of templatesData) {
    await prisma.communicationTemplate.upsert({
      where: { slug: tpl.slug },
      update: { title: tpl.title, subject: tpl.subject, bodyMarkdown: tpl.bodyMarkdown },
      create: {
        slug: tpl.slug,
        title: tpl.title,
        category: tpl.category,
        status: tpl.status,
        subject: tpl.subject,
        bodyMarkdown: tpl.bodyMarkdown,
      },
    });
  }

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