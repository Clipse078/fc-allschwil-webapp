/**
 * Demo Seed Script
 *
 * Loads representative demo data into the database for local development and
 * staging environments. All personal data in this file is entirely synthetic —
 * no real names, emails, or phone numbers are used.
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts
 *
 * This script does NOT run as part of `prisma db seed`. It must be invoked
 * explicitly. Run `npm run db:seed` first to ensure reference data exists.
 */

import "dotenv/config";

import { assertDemoSeedAllowed } from "@/lib/demo/seed-guard";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

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
  PrismaClient,
  RegistrationStatus,
  RegistrationType,
  TargetCategory,
  TargetDirection,
  TargetMetricType,
  TargetPeriod,
  TargetStatus,
  TeamCategory,
  TeamSeasonStatus,
} from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

assertDemoSeedAllowed();
assertOperationalMutationAllowed({
  operationId: "demo-seed",
  databaseUrl: connectionString,
  explicitIntent: true,
  allowedRemoteEnvironments: ["stage"],
});

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type RegistrationSeedRecord = {
  id: string;
  type: RegistrationType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthYear: number;
  contactName?: string;
  message?: string;
};

async function main() {
  const fcAllschwilTenant = await prisma.tenant.findUnique({
    where: { key: "fc-allschwil" },
  });

  if (!fcAllschwilTenant) {
    throw new Error(
      "Tenant fc-allschwil not found. Run `npm run db:seed` first."
    );
  }

  // ─── Synthetic Registration Demo Data ────────────────────────────────────────
  // All entries use @example.com emails and placeholder Swiss-style phone numbers.

  const registrationSeedData: RegistrationSeedRecord[] = [
    {
      id: "seed-demo-registration-001",
      type: RegistrationType.PROBETRAINING,
      firstName: "Luca",
      lastName: "Muster",
      email: "kontakt.muster.001@example.com",
      phone: "+41 79 000 00 01",
      birthYear: 2020,
      contactName: "M. Muster",
      message: "Anmeldung gemeinsam mit Bruder.",
    },
    {
      id: "seed-demo-registration-002",
      type: RegistrationType.PROBETRAINING,
      firstName: "Noah",
      lastName: "Muster",
      email: "kontakt.muster.001@example.com",
      phone: "+41 79 000 00 01",
      birthYear: 2019,
      contactName: "M. Muster",
      message: "Anmeldung gemeinsam mit Bruder.",
    },
    {
      id: "seed-demo-registration-003",
      type: RegistrationType.PROBETRAINING,
      firstName: "Emma",
      lastName: "Beispiel",
      email: "kontakt.beispiel.003@example.com",
      phone: "+41 79 000 00 03",
      birthYear: 2019,
      contactName: "O. Beispiel",
      message: "Anfrage für Probetraining und Trainingszeiten.",
    },
    {
      id: "seed-demo-registration-004",
      type: RegistrationType.PROBETRAINING,
      firstName: "Jonas",
      lastName: "Demo",
      email: "kontakt.demo.004@example.com",
      phone: "+41 76 000 00 04",
      birthYear: 2017,
      contactName: "R. Demo",
    },
    {
      id: "seed-demo-registration-005",
      type: RegistrationType.PROBETRAINING,
      firstName: "Lars",
      lastName: "Testfall",
      email: "kontakt.testfall.005@example.com",
      phone: "+41 79 000 00 05",
      birthYear: 2016,
      contactName: "R. Testfall",
      message: "Bereits auf der Warteliste.",
    },
    {
      id: "seed-demo-registration-006",
      type: RegistrationType.PROBETRAINING,
      firstName: "Kiran",
      lastName: "Synthese",
      email: "kontakt.synthese.006@example.com",
      phone: "+41 78 000 00 06",
      birthYear: 2016,
      contactName: "T. Synthese",
    },
    {
      id: "seed-demo-registration-007",
      type: RegistrationType.PROBETRAINING,
      firstName: "Elisa",
      lastName: "Probe",
      email: "kontakt.probe.007@example.com",
      phone: "+41 78 000 00 07",
      birthYear: 2016,
      contactName: "A. Probe",
    },
    {
      id: "seed-demo-registration-008",
      type: RegistrationType.PROBETRAINING,
      firstName: "Sofia",
      lastName: "Fiktiv",
      email: "kontakt.fiktiv.008@example.com",
      phone: "+41 78 000 00 08",
      birthYear: 2016,
      contactName: "C. Fiktiv",
    },
    {
      id: "seed-demo-registration-009",
      type: RegistrationType.PROBETRAINING,
      firstName: "Noel",
      lastName: "Platzhalter",
      email: "kontakt.platzhalter.009@example.com",
      phone: "+41 79 000 00 09",
      birthYear: 2020,
      contactName: "R. Platzhalter",
    },
    {
      id: "seed-demo-registration-010",
      type: RegistrationType.PROBETRAINING,
      firstName: "Arsenio",
      lastName: "Dummydata",
      email: "kontakt.dummydata.010@example.com",
      phone: "+41 76 000 00 10",
      birthYear: 2013,
      contactName: "B. Dummydata",
    },
    {
      id: "seed-demo-registration-011",
      type: RegistrationType.PROBETRAINING,
      firstName: "Isaiah",
      lastName: "Testuser",
      email: "kontakt.testuser.011@example.com",
      phone: "+41 76 000 00 11",
      birthYear: 2014,
      contactName: "B. Testuser",
      message: "Bruder spielt bereits im C1.",
    },
    {
      id: "seed-demo-registration-012",
      type: RegistrationType.PROBETRAINING,
      firstName: "Leon",
      lastName: "Sampledata",
      email: "kontakt.sampledata.012@example.com",
      phone: "+41 79 000 00 12",
      birthYear: 2013,
      contactName: "N. Sampledata",
      message: "Aktuell D9 Promotion beim Demo FC.",
    },
    {
      id: "seed-demo-registration-013",
      type: RegistrationType.PROBETRAINING,
      firstName: "Marie",
      lastName: "Testdaten",
      email: "kontakt.testdaten.013@example.com",
      phone: "+41 79 000 00 13",
      birthYear: 2011,
      contactName: "A. Testdaten",
    },
    {
      id: "seed-demo-registration-014",
      type: RegistrationType.PROBETRAINING,
      firstName: "Ecrin",
      lastName: "Anfrage",
      email: "kontakt.anfrage.014@example.com",
      phone: "+41 78 000 00 14",
      birthYear: 2013,
      message: "Interesse an einem Probetraining bei den D- oder C-Junioren.",
    },
    {
      id: "seed-demo-registration-015",
      type: RegistrationType.SPIELERANMELDUNG,
      firstName: "Tobias",
      lastName: "Spielertest",
      email: "kontakt.spielertest.015@example.com",
      phone: "+41 77 000 00 15",
      birthYear: 2003,
      message: `Demo FC U13-U14
Demo FC U18
Demo FC Aktive`,
    },
    {
      id: "seed-demo-registration-016",
      type: RegistrationType.SPIELERANMELDUNG,
      firstName: "Claudio",
      lastName: "Demospieler",
      email: "kontakt.demospieler.016@example.com",
      phone: "+41 78 000 00 16",
      birthYear: 1990,
      message: "Ehemaliger Leistungsfussballer mit Interesse an einem ambitionierten Team.",
    },
  ];

  for (const registration of registrationSeedData) {
    await prisma.registration.upsert({
      where: { id: registration.id },
      update: {
        tenantId: fcAllschwilTenant.id,
        type: registration.type,
        status: RegistrationStatus.NEW,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        phone: registration.phone,
        birthYear: registration.birthYear,
        message: registration.message ?? null,
        payloadJson: registration.contactName
          ? { contactName: registration.contactName }
          : undefined,
        source: "WEBSITE",
      },
      create: {
        id: registration.id,
        tenantId: fcAllschwilTenant.id,
        type: registration.type,
        status: RegistrationStatus.NEW,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        phone: registration.phone,
        birthYear: registration.birthYear,
        message: registration.message ?? null,
        payloadJson: registration.contactName
          ? { contactName: registration.contactName }
          : undefined,
        source: "WEBSITE",
      },
    });
  }

  // ─── Teams ────────────────────────────────────────────────────────────────────

  const activeSeason = await prisma.season.findUnique({
    where: { key: "2025-2026" },
  });

  if (!activeSeason) {
    throw new Error(
      "Active season 2025-2026 not found. Run `npm run db:seed` first."
    );
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

  const createdTeams: Record<
    string,
    { id: string; name: string; slug: string; teamSeasonId: string }
  > = {};

  for (const teamData of teams) {
    // TEAM-CORE-02: slug uniqueness is now tenant-scoped.
    // Use compound key (tenantId_slug) for upsert instead of global slug.
    const team = await prisma.team.upsert({
      where: {
        tenantId_slug: {
          tenantId: fcAllschwilTenant.id,
          slug: teamData.slug,
        },
      },
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
        tenantId: fcAllschwilTenant.id,
      },
    });

    const teamSeason = await prisma.teamSeason.upsert({
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

    createdTeams[team.slug] = {
      id: team.id,
      name: team.name,
      slug: team.slug,
      teamSeasonId: teamSeason.id,
    };
  }

  // ─── Demo Events ──────────────────────────────────────────────────────────────

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
        teamSeasonId: createdTeams["e4"].teamSeasonId,
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

  // ─── Demo Targets ─────────────────────────────────────────────────────────────

  const demoTargetCount = await prisma.target.count({
    where: { tenantId: fcAllschwilTenant.id, moduleKey: "demo" },
  });

  if (demoTargetCount === 0) {
    await prisma.target.create({
      data: {
        tenantId: fcAllschwilTenant.id,
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
        tenantId: fcAllschwilTenant.id,
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
        tenantId: fcAllschwilTenant.id,
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

  // ─── Demo Meetings ────────────────────────────────────────────────────────────

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

  // ─── Demo Initiatives ─────────────────────────────────────────────────────────

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

  // ─── OrgUnits ─────────────────────────────────────────────────────────────────

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
    // Slice 11.2: OrgUnit.key is now tenant-scoped (@@unique([tenantId, key])).
    // Use composite unique key for upsert; always assign tenantId.
    await prisma.orgUnit.upsert({
      where: { tenantId_key: { tenantId: fcAllschwilTenant.id, key: ou.key } },
      update: { name: ou.name, description: ou.description },
      create: {
        tenantId: fcAllschwilTenant.id,
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

  // ─── Communication Templates ──────────────────────────────────────────────────

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

  console.log("Demo seed finished successfully.");
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
