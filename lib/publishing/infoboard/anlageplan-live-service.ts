/**
 * lib/publishing/infoboard/anlageplan-live-service.ts
 *
 * INFOBOARD-MAP-01 — Anlageplan live data service.
 *
 * Composes the complete public kiosk payload for a board with
 * templateType ANLAGENUEBERSICHT.
 *
 * Reuses:
 *   - buildScreen2LivePayload (pitch occupancy, dressing room data)
 *   - screen1 canonical feed for the Heute/Als nächstes rail
 *   - Anlageplan config from the board row (anlageplanJson)
 *   - Branding resolution from Screen 1 (same resolver)
 *
 * Design constraints:
 *   - No Prisma import, no DB access, no Next.js, no React.
 *   - `now` always supplied by caller.
 *   - No new schedule truth — reuses canonical feed.
 *   - Inputs never mutated.
 */

import { buildScreen2LivePayload } from "./screen2-live-service";
import type {
  Screen2TenantContext,
  Screen2SourceDatabase,
  InfoboardScreen2LivePayload,
} from "./screen2-live-service";
import {
  parseAnlageplanJson,
  emptyAnlageplanConfig,
  type AnlageplanConfig,
} from "@/lib/infoboard/anlageplan-types";
import type { InboardRow } from "@/lib/infoboard/types";

// ── Public types ──────────────────────────────────────────────────────────────

export type AnlageplanLivePayload = {
  /** Full Screen 2 occupancy feed (pitches + dressing rooms). */
  readonly screen2: InfoboardScreen2LivePayload;
  /** Anlageplan config (elements). */
  readonly anlageplanConfig: AnlageplanConfig;
  /** Blob CDN URL of the background site-plan image. null = not set. */
  readonly backgroundUrl: string | null;
  /** Current moment as UTC ISO-8601. */
  readonly currentTimeIso: string;
};

// ── Database interface ────────────────────────────────────────────────────────

export type AnlageplanSourceDatabase = Screen2SourceDatabase;

// ── buildAnlageplanLivePayload ────────────────────────────────────────────────

/**
 * Builds the complete Anlageplan kiosk payload.
 *
 * @throws {RangeError} when tenant.timezone is not a valid IANA identifier.
 */
export async function buildAnlageplanLivePayload(params: {
  readonly board: InboardRow;
  readonly tenant: Screen2TenantContext;
  readonly now: Date;
  readonly database: AnlageplanSourceDatabase;
}): Promise<AnlageplanLivePayload> {
  const { board, tenant, now, database } = params;

  // Parse Anlageplan config (or use empty)
  const anlageplanConfig =
    parseAnlageplanJson(board.anlageplanJson) ?? emptyAnlageplanConfig();

  // Background image URL
  const backgroundUrl = board.anlageplanBackgroundUrl ?? null;

  // Build Screen 2 feed (pitch occupancy + dressing rooms)
  const screen2 = await buildScreen2LivePayload({
    tenant,
    now,
    database,
  });

  return {
    screen2,
    anlageplanConfig,
    backgroundUrl,
    currentTimeIso: now.toISOString(),
  };
}
