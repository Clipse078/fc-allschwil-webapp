import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { getGroupedWochenplan } from "../lib/events/public-event-feed";
import {
  getWeeklyPlanPublicationState,
  upsertWeeklyPlanPublicationState,
} from "../lib/weekly-plan/publication-state";
import {
  getWochenplanPublication,
  getLatestPublishedWochenplan,
} from "../lib/wochenplan/publication-queries";

const TENANT_KEYS = [
  "weekly-plan-isolation-test-a",
  "weekly-plan-isolation-test-b",
];

const SEASON_KEYS = [
  "weekly-plan-isolation-season-a",
  "weekly-plan-isolation-season-b",
];

const WEEK_ID = "2031-W24";

let passed = 0;
let failed = 0;

function assertCheck(
  name: string,
  condition: boolean,
  note: string,
) {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${name}`);
    return;
  }

  failed += 1;
  console.error(`  FAIL: ${name} — ${note}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  async function cleanup() {
    const tenants = await prisma.tenant.findMany({
      where: {
        key: {
          in: TENANT_KEYS,
        },
      },
      select: {
        id: true,
      },
    });

    const tenantIds = tenants.map((tenant) => tenant.id);

    if (tenantIds.length > 0) {
      await prisma.event.deleteMany({
        where: {
          tenantId: {
            in: tenantIds,
          },
        },
      });

      await prisma.wochenplanPublication.deleteMany({
        where: {
          tenantId: {
            in: tenantIds,
          },
        },
      });

      await prisma.tenant.deleteMany({
        where: {
          id: {
            in: tenantIds,
          },
        },
      });
    }

    await prisma.season.deleteMany({
      where: {
        key: {
          in: SEASON_KEYS,
        },
      },
    });
  }

  try {
    console.log(
      "\n=== Weekly Plan Tenant-Isolation Validation ===\n",
    );

    await cleanup();

    const tenantA = await prisma.tenant.create({
      data: {
        key: TENANT_KEYS[0],
        name: "Weekly Plan Isolation Test Tenant A",
        status: "ACTIVE",
        websiteEnabled: true,
        approvedDataOnly: false,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: {
        key: TENANT_KEYS[1],
        name: "Weekly Plan Isolation Test Tenant B",
        status: "ACTIVE",
        websiteEnabled: true,
        approvedDataOnly: false,
      },
    });

    const seasonA = await prisma.season.create({
      data: {
        key: SEASON_KEYS[0],
        name: "Weekly Plan Isolation Season A",
        startDate: new Date("2031-01-01T00:00:00.000Z"),
        endDate: new Date("2031-12-31T23:59:59.999Z"),
        isActive: false,
      },
    });

    const seasonB = await prisma.season.create({
      data: {
        key: SEASON_KEYS[1],
        name: "Weekly Plan Isolation Season B",
        startDate: new Date("2031-01-01T00:00:00.000Z"),
        endDate: new Date("2031-12-31T23:59:59.999Z"),
        isActive: false,
      },
    });

    const eventA = await prisma.event.create({
      data: {
        tenantId: tenantA.id,
        seasonId: seasonA.id,
        type: "TRAINING",
        source: "MANUAL",
        status: "SCHEDULED",
        reviewStage: "PUBLISHED",
        title: "Tenant A Weekly Plan Training",
        location: "Tenant A Pitch",
        startAt: new Date("2031-06-10T16:00:00.000Z"),
        endAt: new Date("2031-06-10T17:30:00.000Z"),
        websiteVisible: true,
        wochenplanVisible: true,
        trainingsplanVisible: true,
      },
    });

    const eventB = await prisma.event.create({
      data: {
        tenantId: tenantB.id,
        seasonId: seasonB.id,
        type: "TRAINING",
        source: "MANUAL",
        status: "SCHEDULED",
        reviewStage: "PUBLISHED",
        title: "Tenant B Weekly Plan Training",
        location: "Tenant B Pitch",
        startAt: new Date("2031-06-11T17:00:00.000Z"),
        endAt: new Date("2031-06-11T18:30:00.000Z"),
        websiteVisible: true,
        wochenplanVisible: true,
        trainingsplanVisible: true,
      },
    });


    // ============================================================
    // CHECK 1: PUBLICATION WRITE ISOLATION
    // ============================================================

    console.log("\nCheck 1: publication write isolation");

    await upsertWeeklyPlanPublicationState({
      tenantId: tenantA.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant A Standard",
      isPublished: true,
      publishedByUserId: null,
    });

    await upsertWeeklyPlanPublicationState({
      tenantId: tenantB.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant B Schlechtwetter",
      isPublished: false,
      publishedByUserId: null,
    });

    const publicationA = await prisma.wochenplanPublication.findUnique({
      where: {
        tenantId_weekId: {
          tenantId: tenantA.id,
          weekId: WEEK_ID,
        },
      },
    });

    const publicationB = await prisma.wochenplanPublication.findUnique({
      where: {
        tenantId_weekId: {
          tenantId: tenantB.id,
          weekId: WEEK_ID,
        },
      },
    });

    assertCheck(
      "Tenant A publication row exists independently",
      publicationA?.variantLabel === "Tenant A Standard" &&
        publicationA.isPublished === true,
      JSON.stringify(publicationA),
    );

    assertCheck(
      "Tenant B publication row exists independently",
      publicationB?.variantLabel === "Tenant B Schlechtwetter" &&
        publicationB.isPublished === false,
      JSON.stringify(publicationB),
    );


    // ============================================================
    // CHECK 2: NEW PUBLICATION RESOLVER READ ISOLATION
    // ============================================================

    console.log("\nCheck 2: publication-state resolver isolation");

    const stateA = await getWeeklyPlanPublicationState({
      tenantId: tenantA.id,
      weekId: WEEK_ID,
    });

    const stateB = await getWeeklyPlanPublicationState({
      tenantId: tenantB.id,
      weekId: WEEK_ID,
    });

    assertCheck(
      "Resolver returns Tenant A state only",
      stateA.tenantId === tenantA.id &&
        stateA.variantLabel === "Tenant A Standard" &&
        stateA.isPublished === true,
      JSON.stringify(stateA),
    );

    assertCheck(
      "Resolver returns Tenant B state only",
      stateB.tenantId === tenantB.id &&
        stateB.variantLabel === "Tenant B Schlechtwetter" &&
        stateB.isPublished === false,
      JSON.stringify(stateB),
    );


    // ============================================================
    // CHECK 3: LEGACY PUBLICATION QUERY ISOLATION
    // ============================================================

    console.log("\nCheck 3: legacy publication query isolation");

    const legacyA = await getWochenplanPublication(
      tenantA.id,
      WEEK_ID,
    );

    const legacyB = await getWochenplanPublication(
      tenantB.id,
      WEEK_ID,
    );

    assertCheck(
      "Legacy query returns Tenant A label only",
      legacyA?.variantLabel === "Tenant A Standard",
      JSON.stringify(legacyA),
    );

    assertCheck(
      "Legacy query returns Tenant B label only",
      legacyB?.variantLabel === "Tenant B Schlechtwetter",
      JSON.stringify(legacyB),
    );


    // ============================================================
    // CHECK 4: LATEST PUBLISHED QUERY ISOLATION
    // ============================================================

    console.log("\nCheck 4: latest published query isolation");

    const latestA = await getLatestPublishedWochenplan(
      tenantA.id,
    );

    const latestB = await getLatestPublishedWochenplan(
      tenantB.id,
    );

    assertCheck(
      "Tenant A latest published week is visible",
      latestA?.weekId === WEEK_ID &&
        latestA.variantLabel === "Tenant A Standard",
      JSON.stringify(latestA),
    );

    assertCheck(
      "Tenant B unpublished week is not returned",
      latestB === null,
      JSON.stringify(latestB),
    );


    // ============================================================
    // CHECK 5: PUBLIC WEEKLY PLAN EVENT ISOLATION
    // ============================================================

    console.log("\nCheck 5: public event feed isolation");

    const daysA = await getGroupedWochenplan({
      tenantId: tenantA.id,
      seasonKey: seasonA.key,
      teamSlug: null,
      dateFrom: "2031-06-09",
      dateTo: "2031-06-15",
      limit: 100,
    });

    const daysB = await getGroupedWochenplan({
      tenantId: tenantB.id,
      seasonKey: seasonB.key,
      teamSlug: null,
      dateFrom: "2031-06-09",
      dateTo: "2031-06-15",
      limit: 100,
    });

    const eventsA = daysA.flatMap((day) => day.events);
    const eventsB = daysB.flatMap((day) => day.events);

    assertCheck(
      "Tenant A feed contains Tenant A event",
      eventsA.some((event) => event.id === eventA.id),
      `Tenant A event ids: ${eventsA.map((event) => event.id).join(", ")}`,
    );

    assertCheck(
      "Tenant A feed excludes Tenant B event",
      !eventsA.some((event) => event.id === eventB.id),
      `Tenant A event ids: ${eventsA.map((event) => event.id).join(", ")}`,
    );

    assertCheck(
      "Tenant B feed contains Tenant B event",
      eventsB.some((event) => event.id === eventB.id),
      `Tenant B event ids: ${eventsB.map((event) => event.id).join(", ")}`,
    );

    assertCheck(
      "Tenant B feed excludes Tenant A event",
      !eventsB.some((event) => event.id === eventA.id),
      `Tenant B event ids: ${eventsB.map((event) => event.id).join(", ")}`,
    );


    // ============================================================
    // CHECK 6: CROSS-TENANT UPDATE DOES NOT COLLIDE
    // ============================================================

    console.log("\nCheck 6: same weekId remains tenant-independent");

    await upsertWeeklyPlanPublicationState({
      tenantId: tenantB.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant B Published Variant",
      isPublished: true,
      publishedByUserId: null,
    });

    const stateAAfterBUpdate = await getWeeklyPlanPublicationState({
      tenantId: tenantA.id,
      weekId: WEEK_ID,
    });

    const stateBAfterUpdate = await getWeeklyPlanPublicationState({
      tenantId: tenantB.id,
      weekId: WEEK_ID,
    });

    assertCheck(
      "Updating Tenant B does not mutate Tenant A",
      stateAAfterBUpdate.variantLabel === "Tenant A Standard" &&
        stateAAfterBUpdate.isPublished === true,
      JSON.stringify(stateAAfterBUpdate),
    );

    assertCheck(
      "Tenant B update applies only to Tenant B",
      stateBAfterUpdate.variantLabel === "Tenant B Published Variant" &&
        stateBAfterUpdate.isPublished === true,
      JSON.stringify(stateBAfterUpdate),
    );


    // ============================================================
    // SUMMARY
    // ============================================================

    console.log("\n===========================================================");
    console.log(`Total: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log("===========================================================\n");

    if (failed > 0) {
      throw new Error(
        `Weekly-plan tenant-isolation validation failed: ${failed} check(s) failed.`,
      );
    }
  } finally {
    try {
      await cleanup();
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});