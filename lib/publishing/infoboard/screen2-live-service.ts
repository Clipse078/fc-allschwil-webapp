/**
 * lib/publishing/infoboard/screen2-live-service.ts
 *
 * Reusable composition service for Infoboard Screen 2 live data.
 *
 * Composes:
 *   1. Tenant reference (id, key, name, timezone, optional logoUrl).
 *   2. A single request-time `now` value (never calls new Date() internally).
 *   3. An injected Screen2SourceDatabase for event + facility resource queries.
 *   4. buildInfoboardScreen2Feed() with pitch inventory from the DB.
 *   5. Tenant-aware branding resolution (same logic as Screen 1).
 *
 * Pitch inventory:
 *   All active FacilityResource rows with type FULL_PITCH or HALF_PITCH for
 *   the tenant, ordered by (sortOrder ASC, code ASC). Archived resources are
 *   excluded. This is the canonical "configured playing pitches" for the tenant.
 *   No pitches are fabricated from text labels.
 *
 * Design constraints:
 *   - No Prisma import, no DB access, no Next.js, no React.
 *   - `now` is always supplied by the caller.
 *   - No publication rules duplicated.
 *   - No temporal grouping duplicated.
 *   - Inputs are never mutated.
 */

import { buildInfoboardScreen2Feed } from "./screen2-feed-builder";
import type { InfoboardScreen2Feed, InfoboardTenantRef } from "../event-types";
import {
  createScreen1SourceLoader,
  type Screen1SourceDatabase,
  type Screen1DbEventRow,
  type Screen1FacilityResourceRow,
} from "./screen1-source-loader";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";
const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";

// ── DB interface ──────────────────────────────────────────────────────────────

/**
 * Row returned by the pitch inventory query.
 * Extends Screen1FacilityResourceRow with sortOrder and facilityName.
 */
export type Screen2PitchRow = Screen1FacilityResourceRow & {
  readonly sortOrder: number;
  readonly facilityName?: string | null;
  readonly facilityId?: string;
};

/**
 * Injected database contract for the Screen 2 live service.
 *
 * Structurally compatible with Screen1SourceDatabase; differs only in:
 *   - facilityResource is required (not optional).
 *   - facilityResource.findMany accepts an optional orderBy.
 *
 * Callers at the route/composition boundary implement this using the Prisma
 * client. Tests supply lightweight mocks.
 */
export type Screen2SourceDatabase = {
  readonly event: Screen1SourceDatabase["event"];
  readonly facilityResource: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly orderBy?: ReadonlyArray<Record<string, unknown>>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen2PitchRow>>;
  };
};

// ── Public types ──────────────────────────────────────────────────────────────

export type Screen2TenantContext = InfoboardTenantRef & {
  readonly logoUrl?: string | null;
};

export type InfoboardScreen2Branding = {
  readonly clubLogoSrc: string | null;
  readonly productLogoSrc: string | null;
};

export type InfoboardScreen2LivePayload = {
  readonly feed: InfoboardScreen2Feed;
  readonly branding: InfoboardScreen2Branding;
  readonly currentTimeIso: string;
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
  facility: { select: { name: true } },
} as const;

const PITCH_ORDER_BY = [
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
  const pitchRows = await database.facilityResource.findMany({
    where: {
      tenantId: tenant.id,
      type: { in: ["FULL_PITCH", "HALF_PITCH"] },
      status: "ACTIVE",
    },
    orderBy: PITCH_ORDER_BY,
    select: PITCH_SELECT,
  });

  // ── Resolve facility name ───────────────────────────────────────────────────
  // Prefer the DB facility name; fall back to caller-supplied override.
  const resolvedFacilityName =
    (pitchRows[0] as any)?.facility?.name ??
    params.facilityName ??
    tenant.name;

  // ── Map pitch rows to ConfiguredPitch ──────────────────────────────────────
  const pitches = pitchRows.map((row) => ({
    code: row.code,
    name: row.name,
    facilityName: (row as any)?.facility?.name ?? resolvedFacilityName,
  }));

  // ── Build event loader (reuses Screen 1 source loader logic) ───────────────
  // Wrap Screen2SourceDatabase to satisfy Screen1SourceDatabase interface.
  const screen1Db: Screen1SourceDatabase = {
    event: database.event,
    facilityResource: {
      findMany: (args) =>
        database.facilityResource.findMany(args) as unknown as Promise<
          ReadonlyArray<Screen1FacilityResourceRow>
        >,
    },
  };
  const loader = createScreen1SourceLoader(screen1Db);

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
    loader,
  });

  // ── Override facilityName in feed if pitches were loaded ──────────────────
  const feedWithFacility: InfoboardScreen2Feed = {
    ...feed,
    facilityName: resolvedFacilityName,
  };

  // ── Branding ───────────────────────────────────────────────────────────────
  const branding: InfoboardScreen2Branding = {
    clubLogoSrc: resolveClubLogoSrc(tenant),
    productLogoSrc: PRODUCT_LOGO_SRC,
  };

  return {
    feed: feedWithFacility,
    branding,
    currentTimeIso: now.toISOString(),
  };
}
