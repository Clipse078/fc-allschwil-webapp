/**
 * lib/publishing/infoboard/screen2-live-service.ts
 *
 * Reusable composition service for Infoboard Screen 2 live data.
 *
 * Composes:
 *   1. Tenant reference (id, key, name, timezone, optional logoUrl).
 *   2. A single request-time `now` value (never calls new Date() internally).
 *   3. An injected Screen2SourceDatabase for event + facility resource queries.
 *   4. buildInfoboardScreen2Feed() with pitch AND dressing-room inventory
 *      from the DB.
 *   5. Tenant-aware branding resolution (same logic as Screen 1).
 *   6. Tenant-aware display-theme resolution (same resolver as Screen 1 —
 *      INFOBOARD-INTEGRATION-01B/01C — never a second theme mechanism).
 *
 * Pitch inventory:
 *   All active FacilityResource rows with type FULL_PITCH or HALF_PITCH for
 *   the tenant, ordered by (sortOrder ASC, code ASC). Archived resources are
 *   excluded. This is the canonical "configured playing pitches" for the tenant.
 *   No pitches are fabricated from text labels.
 *
 * Dressing-room inventory (INFOBOARD-INTEGRATION-01C):
 *   All active FacilityResource rows with type DRESSING_ROOM for the tenant,
 *   ordered the same way. Same query shape as the pitch inventory — no
 *   parallel facility model, no fabricated rooms.
 *
 * Design constraints:
 *   - No Prisma import, no DB access, no Next.js, no React.
 *   - `now` is always supplied by the caller.
 *   - No publication rules duplicated.
 *   - No temporal grouping duplicated.
 *   - Inputs are never mutated.
 */

import { buildInfoboardScreen2Feed } from "./screen2-feed-builder";
import type { ConfiguredDressingRoom } from "./screen2-feed-builder";
import type { InfoboardScreen2Feed, InfoboardTenantRef } from "../event-types";
import {
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "./canonical-source-loader";
import type { Screen1FacilityResourceRow } from "./screen1-source-loader";
import {
  resolveInfoboardDisplayTheme,
  type InfoboardDisplayTheme,
} from "./display-theme";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";
const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";

// ── DB interface ──────────────────────────────────────────────────────────────

/**
 * Row returned by the pitch inventory query.
 * Extends Screen1FacilityResourceRow with sortOrder, facilityId, type, and
 * the parent facility data needed for hierarchy grouping.
 */
export type Screen2PitchRow = Screen1FacilityResourceRow & {
  readonly sortOrder: number;
  readonly type: string;
  readonly facilityId: string;
  readonly facility: {
    readonly id: string;
    readonly name: string;
  };
};

/** Row returned by the dressing-room inventory query. */
export type Screen2DressingRoomRow = Screen1FacilityResourceRow & {
  readonly sortOrder: number;
};

/**
 * Injected database contract for the Screen 2 live service.
 *
 * `event` / `trainingSession` are the same canonical publication-policy
 * metadata lookups CanonicalInfoboardPolicyDatabase requires (see
 * canonical-source-loader.ts) — Screen 2 shares the exact same canonical
 * Weekplanner-backed loader as Screen 1, never a second event/planning
 * query. `facilityResource` additionally supplies the pitch AND
 * dressing-room inventory (queried separately by resource type — see
 * PITCH_SELECT / DRESSING_ROOM_SELECT below).
 *
 * Callers at the route/composition boundary implement this using the Prisma
 * client. Tests supply lightweight mocks.
 */
export type Screen2SourceDatabase = CanonicalInfoboardPolicyDatabase & {
  readonly facilityResource: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly orderBy?: ReadonlyArray<Record<string, unknown>>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen2PitchRow | Screen2DressingRoomRow>>;
  };
};

// ── Public types ──────────────────────────────────────────────────────────────

export type Screen2TenantContext = InfoboardTenantRef & {
  readonly logoUrl?: string | null;
  /**
   * Optional: raw persisted display-theme preference (Tenant.infoboardDisplayTheme).
   * Resolved via resolveInfoboardDisplayTheme() — presentation only, never
   * affects planning data, publication policy, or resource allocation.
   * Same tenant-level preference Screen 1 already resolves (INFOBOARD-INTEGRATION-01B).
   */
  readonly infoboardDisplayTheme?: string | null;
};

export type InfoboardScreen2Branding = {
  readonly clubLogoSrc: string | null;
  readonly productLogoSrc: string | null;
};

export type InfoboardScreen2LivePayload = {
  readonly feed: InfoboardScreen2Feed;
  readonly branding: InfoboardScreen2Branding;
  readonly currentTimeIso: string;
  /**
   * Resolved display theme (DARK default). Presentation only — does not
   * influence feed content in any way; see resolveInfoboardDisplayTheme().
   */
  readonly theme: InfoboardDisplayTheme;
};

// ── Branding resolver ─────────────────────────────────────────────────────────

function resolveClubLogoSrc(tenant: Screen2TenantContext): string | null {
  if (tenant.logoUrl) return tenant.logoUrl;
  if (tenant.key === FC_ALLSCHWIL_TENANT_KEY) return FC_ALLSCHWIL_LOGO_SRC;
  return null;
}

// ── Pitch inventory query ─────────────────────────────────────────────────────

const PITCH_SELECT = {
  code: true,
  name: true,
  sortOrder: true,
  type: true,
  facilityId: true,
  facility: { select: { id: true, name: true } },
} as const;

const DRESSING_ROOM_SELECT = {
  code: true,
  name: true,
  sortOrder: true,
} as const;

const RESOURCE_ORDER_BY = [
  { sortOrder: "asc" },
  { code: "asc" },
] as const;

// ── buildScreen2LivePayload ───────────────────────────────────────────────────

/**
 * Builds the complete Screen 2 live payload for a given tenant and moment.
 *
 * The caller is responsible for:
 *   - Resolving the tenant (including timezone) before calling this function.
 *   - Creating `now` exactly once at the request boundary.
 *
 * @throws {RangeError} When `tenant.timezone` is not a valid IANA identifier.
 * @throws Any DB error propagates unchanged.
 */
export async function buildScreen2LivePayload(params: {
  readonly tenant: Screen2TenantContext;
  readonly now: Date;
  readonly database: Screen2SourceDatabase;
  /** Optional: name of the primary facility to show when no pitches are found. */
  readonly facilityName?: string;
}): Promise<InfoboardScreen2LivePayload> {
  const { tenant, now, database } = params;

  // ── Load pitch inventory ────────────────────────────────────────────────────
  const pitchRows = (await database.facilityResource.findMany({
    where: {
      tenantId: tenant.id,
      type: { in: ["FULL_PITCH", "HALF_PITCH"] },
      status: "ACTIVE",
    },
    orderBy: RESOURCE_ORDER_BY,
    select: PITCH_SELECT,
  })) as ReadonlyArray<Screen2PitchRow>;

  // ── Load dressing-room inventory (INFOBOARD-INTEGRATION-01C) ───────────────
  const dressingRoomRows = (await database.facilityResource.findMany({
    where: {
      tenantId: tenant.id,
      type: "DRESSING_ROOM",
      status: "ACTIVE",
    },
    orderBy: RESOURCE_ORDER_BY,
    select: DRESSING_ROOM_SELECT,
  })) as ReadonlyArray<Screen2DressingRoomRow>;

  // ── Resolve facility name ───────────────────────────────────────────────────
  // Prefer the DB facility name; fall back to caller-supplied override.
  const resolvedFacilityName =
    pitchRows[0]?.facility?.name ??
    params.facilityName ??
    tenant.name;

  // ── Map pitch rows to ConfiguredPitch ──────────────────────────────────────
  const pitches = pitchRows.map((row) => ({
    code: row.code,
    name: row.name,
    facilityName: row.facility?.name ?? resolvedFacilityName,
    facilityId: row.facilityId,
    resourceType: (row.type === "HALF_PITCH" ? "HALF_PITCH" : "FULL_PITCH") as "FULL_PITCH" | "HALF_PITCH",
  }));

  // ── Map dressing-room rows to ConfiguredDressingRoom ───────────────────────
  const dressingRooms: ConfiguredDressingRoom[] = dressingRoomRows.map((row) => ({
    code: row.code,
    name: row.name,
  }));

  // ── Build event loader (shares the canonical Screen 1 source loader) ───────
  // Screen 2 consumes the SAME canonical Weekplanner-backed effective
  // activities as Screen 1 — never a second event/planning query.
  const loader = createCanonicalInfoboardSourceLoader(database);

  // ── Tenant reference ────────────────────────────────────────────────────────
  const tenantRef: InfoboardTenantRef = {
    id: tenant.id,
    key: tenant.key,
    name: tenant.name,
    timezone: tenant.timezone,
  };

  // ── Build Screen 2 feed ────────────────────────────────────────────────────
  const feed = await buildInfoboardScreen2Feed({
    tenant: tenantRef,
    timeZone: tenant.timezone,
    now,
    pitches,
    dressingRooms,
    loader,
  });

  // ── Resolve final facility name for the feed header ──────────────────────
  const feedWithFacility: InfoboardScreen2Feed = {
    ...feed,
    facilityName: resolvedFacilityName,
  };

  // ── Branding ───────────────────────────────────────────────────────────────
  const branding: InfoboardScreen2Branding = {
    clubLogoSrc: resolveClubLogoSrc(tenant),
    productLogoSrc: PRODUCT_LOGO_SRC,
  };

  // ── Display theme ────────────────────────────────────────────────────────
  // Presentation only — resolved from the persisted preference, defaulting
  // to DARK. Never influences the feed built above. Same resolver Screen 1
  // uses (lib/publishing/infoboard/display-theme.ts) — no second theme
  // mechanism.
  const theme = resolveInfoboardDisplayTheme(tenant.infoboardDisplayTheme);

  return {
    feed: feedWithFacility,
    branding,
    currentTimeIso: now.toISOString(),
    theme,
  };
}
