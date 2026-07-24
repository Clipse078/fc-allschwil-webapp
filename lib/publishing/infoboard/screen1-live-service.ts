/**
 * lib/publishing/infoboard/screen1-live-service.ts
 *
 * Reusable composition service for Infoboard Screen 1 live data.
 *
 * Composes:
 *   1. tenant reference (id, key, name, timezone, optional logoUrl);
 *   2. a single request-time `now` value (never calls new Date() internally);
 *   3. an injected PublicationEventLoader<Screen1SourceEvent>;
 *   4. buildInfoboardScreen1Feed() from PP-02A;
 *   5. static presentation extensions (empty — no canonical tournament model);
 *   6. announcement (null — no persisted announcement setting exists);
 *   7. tenant-aware branding resolution.
 *
 * Date window:
 *   dateFrom = now − OVERNIGHT_BUFFER_HOURS (covers events that started
 *              yesterday but may still be ongoing; safe UTC buffer).
 *   dateTo   = now + FORWARD_WINDOW_HOURS   (covers today + tomorrow in all
 *              IANA timezones; no local-midnight calculation used).
 *
 *   OVERNIGHT_BUFFER_HOURS = 26: ensures a match starting at 23:00 local
 *   time the previous day is still loaded if the board queries before midnight.
 *   FORWARD_WINDOW_HOURS   = 48: covers the current and next local calendar
 *   day in all tenant timezones without hard-coding timezone offsets.
 *
 * Design constraints:
 *   - No Prisma import, no DB access, no Next.js, no React.
 *   - `now` is always supplied by the caller — new Date() is never called.
 *   - The loader is called exactly once (delegated to buildInfoboardScreen1Feed).
 *   - No publication rules duplicated — delegated to PP-01B.
 *   - No temporal grouping duplicated — delegated to PP-01A.
 *   - No presentation fallback duplicated — delegated to PP-01C / mapper.
 *   - Inputs are never mutated.
 */

import { buildInfoboardScreen1Feed } from "./screen1-feed-builder";
import type { InfoboardScreen1Feed, InfoboardTenantRef } from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import type { Screen1SourceEvent } from "./screen1-event-mapper";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardEventPresentationExtension,
} from "@/components/infoboard/screen1/screen1-presentation-types";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Hours before `now` used as `dateFrom`.
 * 26 hours provides a safe UTC buffer for events that started yesterday
 * local time but may still be in-progress (e.g. late-evening tournaments).
 */
const OVERNIGHT_BUFFER_HOURS = 26;

/**
 * Hours after `now` used as `dateTo`.
 * 48 hours covers today and tomorrow in any IANA timezone without
 * using server-local midnight calculations.
 */
const FORWARD_WINDOW_HOURS = 48;

/** Path to the SportClubEvo product logo (public directory). */
const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

/** Path to the FC Allschwil club logo (public directory). */
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";

/** Tenant key for FC Allschwil (used for logo resolution only). */
const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Tenant context required by the live service.
 * Extends InfoboardTenantRef with optional branding fields.
 */
export type Screen1TenantContext = InfoboardTenantRef & {
  /** Optional: tenant-configured club logo URL (Tenant.logoUrl). */
  readonly logoUrl?: string | null;
};

/**
 * Branding payload returned in the live payload.
 * structurally compatible with InfoboardScreen1Branding from the component.
 */
export type InfoboardScreen1Branding = {
  readonly clubLogoSrc: string | null;
  readonly productLogoSrc: string | null;
};

/**
 * Complete live payload for Infoboard Screen 1.
 *
 * All values are derived from live tenant data at request time.
 * No preview fixture content is included.
 */
export type InfoboardScreen1LivePayload = {
  readonly feed: InfoboardScreen1Feed;
  readonly eventPresentation: readonly InfoboardEventPresentationExtension[];
  readonly announcement: InfoboardAnnouncementPresentation | null;
  readonly branding: InfoboardScreen1Branding;
  readonly currentTimeIso: string;
};

// ── Branding resolver ─────────────────────────────────────────────────────────

/**
 * Resolves the club logo source path for the given tenant.
 *
 * Resolution order:
 *   1. Tenant.logoUrl (DB-configured custom logo URL) — highest priority.
 *   2. Known public path for FC Allschwil, identified by tenant.key.
 *   3. null — component renders without a club logo.
 *
 * Only uses the FC Allschwil known path when the resolved tenant key matches
 * exactly. No other tenant-to-path mapping is hardcoded.
 */
function resolveClubLogoSrc(tenant: Screen1TenantContext): string | null {
  if (tenant.logoUrl) return tenant.logoUrl;
  if (tenant.key === FC_ALLSCHWIL_TENANT_KEY) return FC_ALLSCHWIL_LOGO_SRC;
  return null;
}

// ── buildScreen1LivePayload ───────────────────────────────────────────────────

/**
 * Builds the complete Screen 1 live payload for a given tenant and moment.
 *
 * The caller is responsible for:
 *   - resolving the tenant (including timezone) before calling this function;
 *   - creating `now` exactly once at the request boundary and passing it here.
 *
 * The same `now` value is used for:
 *   - the `dateFrom` / `dateTo` query window boundaries;
 *   - temporal grouping (current / next / later);
 *   - `generatedAt` in the feed;
 *   - `currentTimeIso` in the payload.
 *
 * @throws {RangeError} When `tenant.timezone` is not a valid IANA identifier
 *   (propagated from buildInfoboardScreen1Feed → toLocalDateKey).
 * @throws Any error thrown by the loader propagates unchanged.
 */
export async function buildScreen1LivePayload(params: {
  readonly tenant: Screen1TenantContext;
  readonly now: Date;
  readonly loader: PublicationEventLoader<Screen1SourceEvent>;
}): Promise<InfoboardScreen1LivePayload> {
  const { tenant, now, loader } = params;

  // ── Bounded date window ───────────────────────────────────────────────────
  // No server-local midnight calculation. Fixed UTC offsets relative to `now`.
  const dateFrom = new Date(now.getTime() - OVERNIGHT_BUFFER_HOURS * 60 * 60 * 1000);
  const dateTo = new Date(now.getTime() + FORWARD_WINDOW_HOURS * 60 * 60 * 1000);

  // ── Assemble tenant reference (without implementation-specific fields) ──
  const tenantRef: InfoboardTenantRef = {
    id: tenant.id,
    key: tenant.key,
    name: tenant.name,
    timezone: tenant.timezone,
  };

  // ── Build Screen 1 feed ───────────────────────────────────────────────────
  // buildInfoboardScreen1Feed calls the loader exactly once internally via
  // selectEventsForPublication (PP-01B).
  const feed = await buildInfoboardScreen1Feed(loader, {
    tenant: tenantRef,
    timeZone: tenant.timezone,
    now,
    dateFrom,
    dateTo,
  });

  // ── Presentation extensions ───────────────────────────────────────────────
  // No canonical TournamentParticipant / EventParticipant model exists.
  // Return an empty array. When the model is added, populate extensions here.
  const eventPresentation: readonly InfoboardEventPresentationExtension[] = [];

  // ── Announcement ─────────────────────────────────────────────────────────
  // No persisted announcement setting exists in the current schema.
  // Return null. When a tenant announcement setting is introduced, resolve it
  // here and return InfoboardAnnouncementPresentation.
  const announcement: InfoboardAnnouncementPresentation | null = null;

  // ── Branding ──────────────────────────────────────────────────────────────
  const branding: InfoboardScreen1Branding = {
    clubLogoSrc: resolveClubLogoSrc(tenant),
    productLogoSrc: PRODUCT_LOGO_SRC,
  };

  return {
    feed,
    eventPresentation,
    announcement,
    branding,
    currentTimeIso: now.toISOString(),
  };
}
