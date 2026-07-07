const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required lifecycle file: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function assertContains(name, text, patterns) {
  const missing = patterns.filter((pattern) => !pattern.test(text));

  if (missing.length > 0) {
    throw new Error(
      `FAILED ${name}: missing ${missing.map((pattern) => pattern.toString()).join(", ")}`
    );
  }

  console.log(`OK  ${name}`);
}

console.log("Weekly Plan Real Lifecycle Validation");
console.log("");

const plannerActions = read(
  "app/(admin)/dashboard/planner/actions.ts"
);

const publishRoute = read(
  "app/api/wochenplan/publish/route.ts"
);

const legacyPublicRoute = read(
  "app/api/public/wochenplan/route.ts"
);

const tenantPublicRoute = read(
  "app/api/public/[tenant]/website/weekplan/route.ts"
);

const allocationRoute = read(
  "app/api/wochenplan/[eventId]/allocation/route.ts"
);

const publicationState = read(
  "lib/weekly-plan/publication-state.ts"
);

const publicationQueries = read(
  "lib/wochenplan/publication-queries.ts"
);

const schema = read(
  "prisma/schema.prisma"
);

assertContains(
  "planner creation uses real scheduled lifecycle",
  plannerActions,
  [
    /EventStatus\.SCHEDULED/,
    /tenantId:\s*actorTenantId/,
  ]
);

assertContains(
  "publish route is permission protected and tenant scoped",
  publishRoute,
  [
    /requireApiAnyPermission/,
    /WOCHENPLAN_MANAGE/,
    /EVENTS_MANAGE/,
    /actorTenantId/,
    /tenantId:\s*actorTenantId/,
    /wochenplanVisible/,
  ]
);

assertContains(
  "publish route persists week publication state",
  publishRoute,
  [
    /weekId/,
    /variantLabel/,
    /isPublished:\s*wochenplanVisible/,
    /publishedByUserId/,
  ]
);

assertContains(
  "publication state supports publish and unpublish semantics",
  publicationState,
  [
    /isPublished/,
    /publishedAt/,
    /publishedByUserId/,
  ]
);

assertContains(
  "publication queries are tenant scoped",
  publicationQueries,
  [
    /tenantId/,
    /isPublished:\s*true/,
  ]
);

assertContains(
  "legacy public Wochenplan route requires published week state",
  legacyPublicRoute,
  [
    /isPublished/,
    /publishedAt/,
  ]
);

assertContains(
  "tenant website weekplan route resolves tenant and gates publication",
  tenantPublicRoute,
  [
    /tenantSlug/,
    /resolveTenantFromParams/,
    /tenant\.id/,
    /isPublished/,
  ]
);

assertContains(
  "allocation route is permission protected and fail-closed on tenant context",
  allocationRoute,
  [
    /requireApiAnyPermission/,
    /WOCHENPLAN_MANAGE/,
    /EVENTS_MANAGE/,
    /actorTenantId/,
    /Tenant context is required/,
  ]
);

assertContains(
  "schema contains week publication persistence model",
  schema,
  [
    /model WochenplanPublication/,
    /tenantId/,
    /weekId/,
    /isPublished/,
    /publishedAt/,
    /publishedByUserId/,
  ]
);

console.log("");
console.log("Weekly plan real lifecycle validation passed.");
