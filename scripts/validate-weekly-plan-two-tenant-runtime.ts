import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getWeeklyPlanPublicationState } from "../lib/weekly-plan/publication-state";
import {
  getLatestPublishedWochenplan,
  getWochenplanPublication,
  upsertWochenplanPublication,
} from "../lib/wochenplan/publication-queries";
import { getGroupedWochenplan } from "../lib/events/public-event-feed";

const TEST_PREFIX = "sce_3c_3e_d_runtime";
const WEEK_ID = "2099-W37";

function assertCheck(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const createdTenantIds: string[] = [];

  try {
    console.log("=== Weekly Plan Two-Tenant Runtime Validation ===");
    console.log("");

    await prisma.wochenplanPublication.deleteMany({
      where: { weekId: WEEK_ID },
    });

    await prisma.event.deleteMany({
      where: {
        title: { startsWith: TEST_PREFIX },
      },
    });

    await prisma.tenant.deleteMany({
      where: {
        key: { startsWith: TEST_PREFIX },
      },
    });

    const season = await prisma.season.upsert({
      where: { key: "2099-runtime-validation" },
      update: {
        name: "2099 Runtime Validation",
        startDate: new Date("2099-01-01T00:00:00.000Z"),
        endDate: new Date("2099-12-31T23:59:59.999Z"),
        isActive: false,
      },
      create: {
        key: "2099-runtime-validation",
        name: "2099 Runtime Validation",
        startDate: new Date("2099-01-01T00:00:00.000Z"),
        endDate: new Date("2099-12-31T23:59:59.999Z"),
        isActive: false,
      },
    });

    const tenantA = await prisma.tenant.create({
      data: {
        key: `${TEST_PREFIX}_tenant_a`,
        name: "Runtime Validation Tenant A",
        websiteEnabled: true,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: {
        key: `${TEST_PREFIX}_tenant_b`,
        name: "Runtime Validation Tenant B",
        websiteEnabled: true,
      },
    });

    createdTenantIds.push(tenantA.id, tenantB.id);

    const eventA = await prisma.event.create({
      data: {
        tenantId: tenantA.id,
        seasonId: season.id,
        type: "TRAINING",
        source: "MANUAL",
        status: "SCHEDULED",
        reviewStage: "PUBLISHED",
        title: `${TEST_PREFIX} Tenant A Training`,
        startAt: new Date("2099-09-08T18:00:00.000Z"),
        endAt: new Date("2099-09-08T19:30:00.000Z"),
        websiteVisible: true,
        wochenplanVisible: false,
      },
    });

    const eventB = await prisma.event.create({
      data: {
        tenantId: tenantB.id,
        seasonId: season.id,
        type: "TRAINING",
        source: "MANUAL",
        status: "SCHEDULED",
        reviewStage: "PUBLISHED",
        title: `${TEST_PREFIX} Tenant B Training`,
        startAt: new Date("2099-09-08T18:00:00.000Z"),
        endAt: new Date("2099-09-08T19:30:00.000Z"),
        websiteVisible: true,
        wochenplanVisible: false,
      },
    });

    console.log("Check 1: initial draft/unpublished state");

    assertCheck(
      (await getWeeklyPlanPublicationState({ tenantId: tenantA.id, weekId: WEEK_ID })).isPublished === false,
      "Tenant A starts unpublished",
    );

    assertCheck(
      (await getWeeklyPlanPublicationState({ tenantId: tenantB.id, weekId: WEEK_ID })).isPublished === false,
      "Tenant B starts unpublished",
    );

    console.log("");
    console.log("Check 2: publish Tenant A only");

    await prisma.event.updateMany({
      where: { id: eventA.id, tenantId: tenantA.id },
      data: { wochenplanVisible: true },
    });

    await upsertWochenplanPublication({
      tenantId: tenantA.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant A Standardplan",
      isPublished: true,
    });

    const tenantAPublished = await getWochenplanPublication(tenantA.id, WEEK_ID);
    const tenantBStillDraft = await getWochenplanPublication(tenantB.id, WEEK_ID);

    assertCheck(
      tenantAPublished?.isPublished === true &&
        tenantAPublished.variantLabel === "Tenant A Standardplan",
      "Tenant A publication is active",
    );

    assertCheck(
      tenantBStillDraft === null || tenantBStillDraft.isPublished === false,
      "Tenant B remains unpublished for same week",
    );

    console.log("");
    console.log("Check 3: public feed after Tenant A publish");

    const tenantADaysAfterPublish = await getGroupedWochenplan({
      tenantId: tenantA.id,
      dateFrom: "2099-09-01",
      dateTo: "2099-09-15",
      limit: 50,
    });

    const tenantBDaysAfterTenantAPublish = await getGroupedWochenplan({
      tenantId: tenantB.id,
      dateFrom: "2099-09-01",
      dateTo: "2099-09-15",
      limit: 50,
    });

    const tenantAEventsAfterPublish = tenantADaysAfterPublish.flatMap((day) => day.events);
    const tenantBEventsAfterTenantAPublish = tenantBDaysAfterTenantAPublish.flatMap((day) => day.events);

    assertCheck(
      tenantAEventsAfterPublish.some((event) => event.id === eventA.id),
      "Tenant A feed contains Tenant A event after publish",
    );

    assertCheck(
      !tenantAEventsAfterPublish.some((event) => event.id === eventB.id),
      "Tenant A feed excludes Tenant B event",
    );

    assertCheck(
      !tenantBEventsAfterTenantAPublish.some((event) => event.id === eventA.id),
      "Tenant B feed excludes Tenant A event",
    );

    assertCheck(
      !tenantBEventsAfterTenantAPublish.some((event) => event.id === eventB.id),
      "Tenant B feed remains empty before Tenant B publish",
    );

    console.log("");
    console.log("Check 4: publish Tenant B independently for same week");

    await prisma.event.updateMany({
      where: { id: eventB.id, tenantId: tenantB.id },
      data: { wochenplanVisible: true },
    });

    await upsertWochenplanPublication({
      tenantId: tenantB.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant B Schlechtwetterplan",
      isPublished: true,
    });

    const tenantAAfterTenantBPublish = await getWochenplanPublication(tenantA.id, WEEK_ID);
    const tenantBAfterPublish = await getWochenplanPublication(tenantB.id, WEEK_ID);

    assertCheck(
      tenantAAfterTenantBPublish?.variantLabel === "Tenant A Standardplan",
      "Publishing Tenant B does not mutate Tenant A label",
    );

    assertCheck(
      tenantBAfterPublish?.isPublished === true &&
        tenantBAfterPublish.variantLabel === "Tenant B Schlechtwetterplan",
      "Tenant B publication is active independently",
    );

    console.log("");
    console.log("Check 5: latest published state remains tenant-scoped");

    const latestA = await getLatestPublishedWochenplan(tenantA.id);
    const latestB = await getLatestPublishedWochenplan(tenantB.id);

    assertCheck(
      latestA?.weekId === WEEK_ID && latestA.variantLabel === "Tenant A Standardplan",
      "Tenant A latest publication resolves Tenant A state",
    );

    assertCheck(
      latestB?.weekId === WEEK_ID && latestB.variantLabel === "Tenant B Schlechtwetterplan",
      "Tenant B latest publication resolves Tenant B state",
    );

    console.log("");
    console.log("Check 6: unpublish Tenant A only");

    await prisma.event.updateMany({
      where: { id: eventA.id, tenantId: tenantA.id },
      data: { wochenplanVisible: false },
    });

    await upsertWochenplanPublication({
      tenantId: tenantA.id,
      weekId: WEEK_ID,
      variantLabel: "Tenant A Standardplan",
      isPublished: false,
    });

    const tenantAAfterUnpublish = await getWochenplanPublication(tenantA.id, WEEK_ID);
    const tenantBAfterTenantAUnpublish = await getWochenplanPublication(tenantB.id, WEEK_ID);

    assertCheck(
      tenantAAfterUnpublish?.isPublished === false,
      "Tenant A publication is unpublished",
    );

    assertCheck(
      tenantBAfterTenantAUnpublish?.isPublished === true,
      "Tenant B remains published after Tenant A unpublish",
    );

    const tenantADaysAfterUnpublish = await getGroupedWochenplan({
      tenantId: tenantA.id,
      dateFrom: "2099-09-01",
      dateTo: "2099-09-15",
      limit: 50,
    });

    const tenantBDaysAfterTenantAUnpublish = await getGroupedWochenplan({
      tenantId: tenantB.id,
      dateFrom: "2099-09-01",
      dateTo: "2099-09-15",
      limit: 50,
    });

    const tenantAEventsAfterUnpublish = tenantADaysAfterUnpublish.flatMap((day) => day.events);
    const tenantBEventsAfterTenantAUnpublish = tenantBDaysAfterTenantAUnpublish.flatMap((day) => day.events);

    assertCheck(
      !tenantAEventsAfterUnpublish.some((event) => event.id === eventA.id),
      "Tenant A feed no longer contains unpublished Tenant A event",
    );

    assertCheck(
      tenantBEventsAfterTenantAUnpublish.some((event) => event.id === eventB.id),
      "Tenant B feed still contains Tenant B event",
    );

    console.log("");
    console.log("Check 7: cross-tenant eventIds cannot be published by Tenant A-style scoped update");

    const crossTenantUpdate = await prisma.event.updateMany({
      where: {
        id: { in: [eventB.id] },
        tenantId: tenantA.id,
      },
      data: { wochenplanVisible: false },
    });

    const eventBAfterCrossTenantAttempt = await prisma.event.findUnique({
      where: { id: eventB.id },
      select: { wochenplanVisible: true, tenantId: true },
    });

    assertCheck(
      crossTenantUpdate.count === 0,
      "Tenant A scoped update cannot touch Tenant B event",
    );

    assertCheck(
      eventBAfterCrossTenantAttempt?.tenantId === tenantB.id &&
        eventBAfterCrossTenantAttempt.wochenplanVisible === true,
      "Tenant B event remains unchanged after Tenant A scoped update",
    );

    console.log("");
    console.log("===========================================================");
    console.log("Weekly plan two-tenant runtime validation passed.");
    console.log("===========================================================");
  } finally {
    await prisma.wochenplanPublication.deleteMany({
      where: { tenantId: { in: createdTenantIds } },
    });

    await prisma.event.deleteMany({
      where: { tenantId: { in: createdTenantIds } },
    });

    await prisma.tenant.deleteMany({
      where: { id: { in: createdTenantIds } },
    });

    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
