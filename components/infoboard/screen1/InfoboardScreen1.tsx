"use client";
/**
 * components/infoboard/screen1/InfoboardScreen1.tsx
 *
 * Infoboard Screen 1 — full-screen TV event schedule board.
 *
 * Design (INFOBOARD-04B — premium dark card-based redesign):
 *   - Full dark stadium palette; dark navy header and footer.
 *   - Each event is a full-width card with three zones:
 *       LEFT ZONE   — status label (JETZT / ALS NÄCHSTES) + start time
 *       CENTER ZONE — event type, dominant team/tournament name, opponent
 *                     (logos placed beside club name for matches only)
 *       RIGHT ZONE  — destination: pitch value + dressing-room assignments
 *   - No countdown text; only JETZT / ALS NÄCHSTES.
 *   - No column dividers; card-based visual separation.
 *   - Club branding large in dark header, left side.
 *   - Clock and date in header center-right zone.
 *   - Alexa-safe zone in header far right — intentionally empty.
 *   - SportClubEvo branding in footer, not in header.
 *
 * Invariants:
 *   - Presentational component — no fetch, DB, URL parameters, or browser storage.
 *   - Live expiry filtering uses the kiosk clock so events disappear at end time
 *     without requiring a full page reload on long-running TV sessions.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone is always taken explicitly from feed.tenant.timezone.
 *   - No new Date() without an argument; no server-local or browser-local TZ.
 *   - null / undefined values are never rendered as strings.
 *   - No placeholder dashes, "Unknown", "TBD", "N/A", or empty badges.
 *   - Inputs are never mutated.
 *   - Reusable: FC Allschwil content lives only in the preview fixture.
 *   - No referee dressing-room display (Screen 1 wayfinding contract).
 *   - currentTimeIso is always supplied explicitly; never implicitly derived.
 *   - No countdown text (IN X MIN.); temporal labels are JETZT or ALS NÄCHSTES.
 */

import { useMemo, type ReactElement, type CSSProperties } from "react";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardTeamAllocationPresentation,
  InfoboardEventPresentationExtension,
} from "./screen1-presentation-types";
import type { InfoboardMatchSidePresentation } from "@/lib/publishing/event-types";
import {
  DEFAULT_INFOBOARD_DISPLAY_THEME,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { InfoboardPageRotator } from "./InfoboardPageRotator";
import { useKioskClock } from "@/components/infoboard/kiosk-clock";
import { filterExpiredScreen1Feed } from "@/lib/publishing/infoboard/screen1-feed-expiry";
import { admitDisplayItemsByCapacity } from "@/lib/publishing/infoboard/screen1-capacity-admission";
import {
  DEFAULT_SCREEN1_LOGO_PRESENTATION,
  MATCH_LOGO_SIZE_CSS,
  TOURNAMENT_LOGO_SIZE_CSS,
  type Screen1LogoPresentationConfig,
} from "@/lib/infoboard/screen1-logo-settings";
import styles from "./InfoboardScreen1.module.css";

// ── Public types ──────────────────────────────────────────────────────────────

export type InfoboardScreen1Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen1Props = {
  feed: InfoboardScreen1Feed;
  branding?: InfoboardScreen1Branding;
  /** Tenant-configurable announcement bar. Not persisted. */
  announcement?: InfoboardAnnouncementPresentation;
  /**
   * Optional presentation extensions for individual events.
   * Used to supply multi-team allocation data until a canonical feed contract
   * is added in a future Publishing Platform slice.
   */
  eventPresentation?: readonly InfoboardEventPresentationExtension[];
  /**
   * Current moment as a UTC ISO-8601 string, supplied by the caller.
   * When absent, no clock is displayed and the date falls back to
   * feed.displayDate. Never call new Date() without an argument.
   */
  currentTimeIso?: string | null;
  /** Shared kiosk-header weather. */
  weather?: WeatherResult | null;
  /**
   * Display theme (INFOBOARD-INTEGRATION-01B). Defaults to "DARK" — the
   * existing premium stadium theme — when omitted, so every existing caller
   * (previews, tests) is unaffected. Presentation only: never changes feed
   * content, layout, or content hierarchy — only CSS custom-property values
   * via the rendered `data-theme` attribute.
   */
  theme?: InfoboardDisplayTheme;
  /**
   * Per-board header configuration (INFOBOARD-V2).
   * Controls subtitle, time, date, weather visibility and subtitle text.
   */
  headerConfig?: {
    readonly subtitleEnabled?: boolean;
    readonly subtitleText?: string | null;
    readonly showTime?: boolean;
    readonly showDate?: boolean;
    readonly showWeather?: boolean;
  };
  /** Per-board Match/Tournament logo presentation settings. */
  logoPresentation?: Screen1LogoPresentationConfig;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Prototype max events rendered before showing overflow warning. */
const PROTOTYPE_CAPACITY = 12;

// ── Content-demand layout model ───────────────────────────────────────────────
//
// Each card receives flex-grow proportional to its semantic content demand.
// Denser cards (e.g. 6-row training groups) get proportionally more of the
// available viewport height. This replaces the old fragile count-specific
// flex-grow rules (training-count=4/5/6, tournament fixed grow, etc.).
//
// Exported for regression testing.

/** Base demand for any training-group card (regardless of row count). */
export const CARD_DEMAND_TRAINING_BASE = 1.0;
/** Added demand per training row — drives proportional height growth. */
export const CARD_DEMAND_TRAINING_ROW = 0.55;
/**
 * Content-safe baseline demand for a simple Match card.
 * Reflects the full vertical presentation stack (type label, home/away
 * identity with logos, VS., time, Kabine, Platz) — not logo presence alone.
 */
export const CARD_DEMAND_MATCH = 2.2;
/** Added demand per team sub-name line (e.g. "E1") in match identity. */
export const CARD_DEMAND_MATCH_SUB_TEAM = 0.22;
/** Added demand when an end time is shown in the TIME zone. */
export const CARD_DEMAND_MATCH_END_TIME = 0.12;
/** Base demand for a tournament card. */
export const CARD_DEMAND_TOURNAMENT_BASE = 1.5;
/**
 * Added demand per centre participant display row for small tournaments
 * (< 3 participants, logo strip only — no KABINE allocation matrix).
 */
export const CARD_DEMAND_TOURNAMENT_DISPLAY_ROW = 0.25;
/** Added demand per KABINE allocation row (≥ 3 participants). */
export const CARD_DEMAND_TOURNAMENT_PARTICIPANT = 0.3;
/** Centre participant grid columns — matches tournamentParticipants CSS. */
export const TOURNAMENT_PARTICIPANT_DISPLAY_COLUMNS = 2;
/**
 * Maximum total demand per rendered page.
 * When the visible set exceeds this threshold the display list is split
 * into pages and rotated automatically. Normal days produce a single page.
 */
export const CARD_DEMAND_PAGE_MAX = 12.0;

/**
 * Demand for a training-group card with `rowCount` simultaneous training rows.
 * Exported for regression testing.
 */
export function computeTrainingGroupDemand(rowCount: number): number {
  const rows = Math.max(1, rowCount);
  const rowWeight = rows >= 4 ? 0.62 : CARD_DEMAND_TRAINING_ROW;
  return CARD_DEMAND_TRAINING_BASE + rows * rowWeight;
}

/**
 * Per-card density for grouped training rows.
 * Sparse groups (1–3 rows) keep normal typography; 4+ rows tighten spacing.
 *
 * Exported for regression testing.
 */
export function trainingGroupDensityTier(
  rowCount: number,
): "normal" | "compact" | "dense" {
  if (rowCount >= 6) return "dense";
  if (rowCount >= 4) return "compact";
  return "normal";
}

/**
 * Centre participant display rows for tournament identity presentation.
 * Reflects the two-column grid used when participant names are shown.
 * Exported for regression testing.
 */
export function computeTournamentParticipantDisplayRows(
  participantCount: number,
): number {
  if (participantCount <= 0) return 0;
  return Math.ceil(participantCount / TOURNAMENT_PARTICIPANT_DISPLAY_COLUMNS);
}

export function computeMatchDemand(event: InfoboardScreen1Event): number {
  let demand = CARD_DEMAND_MATCH;
  if (event.endAt !== null && event.endAt !== event.startAt) {
    demand += CARD_DEMAND_MATCH_END_TIME;
  }
  return demand;
}

/**
 * Content-safe minimum demand for a MATCH card — the floor used before
 * proportional viewport distribution. Equals computeMatchDemand() because
 * the baseline already encodes the full safe presentation stack.
 * Exported for regression testing.
 */
export function computeMatchContentSafeMinimum(
  event: InfoboardScreen1Event,
): number {
  return computeMatchDemand(event);
}

/**
 * Semantic demand for a TOURNAMENT card.
 * Small tournaments (< 3 participants) use centre display-row demand only.
 * Larger tournaments use KABINE allocation-row demand to avoid double-counting
 * the same participant information shown in both zones.
 * Exported for regression testing.
 */
export function computeTournamentDemand(
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined,
): number {
  const count = participantAllocations?.length ?? 0;
  if (count === 0) return CARD_DEMAND_TOURNAMENT_BASE;
  if (count < 3) {
    return (
      CARD_DEMAND_TOURNAMENT_BASE
      + computeTournamentParticipantDisplayRows(count) * CARD_DEMAND_TOURNAMENT_DISPLAY_ROW
    );
  }
  return CARD_DEMAND_TOURNAMENT_BASE + count * CARD_DEMAND_TOURNAMENT_PARTICIPANT;
}

/**
 * Demand for a non-training event card (legacy test helper).
 * Prefer computeMatchDemand / computeTournamentDemand for semantic inputs.
 * Exported for regression testing.
 */
export function computeEventDemand(
  type: string,
  participantCount: number = 0,
): number {
  if (type === "TOURNAMENT") {
    if (participantCount === 0) return CARD_DEMAND_TOURNAMENT_BASE;
    if (participantCount < 3) {
      const synthetic = Array.from({ length: participantCount }, (_, i) => ({
        id: `p${i}`,
        teamDisplayName: `Team ${i}`,
        dressingRoomLabel: null,
      }));
      return computeTournamentDemand(synthetic);
    }
    return CARD_DEMAND_TOURNAMENT_BASE + participantCount * CARD_DEMAND_TOURNAMENT_PARTICIPANT;
  }
  return CARD_DEMAND_MATCH;
}

/**
 * Maps total page demand to an adaptive internal-spacing tier.
 * Each tier applies progressively tighter padding/row-height via CSS.
 *
 *   normal — generous spacing for low-density displays.
 *   dense  — modestly tightened for moderate-density displays.
 *   ultra  — significantly tightened when approaching the page limit.
 *
 * Exported for regression testing.
 */
export function densityTier(totalDemand: number): "normal" | "dense" | "ultra" {
  if (totalDemand > 11) return "ultra";
  if (totalDemand > 8) return "dense";
  return "normal";
}

/**
 * Maps total page demand to a layout distribution mode.
 *
 * SPARSE days (1–2 low-demand cards) must not absorb all remaining
 * viewport height. Cards should appear comfortably sized with the
 * unused board background visible below the activity stack.
 *
 * FILL days (multiple or high-demand cards) distribute the full
 * available viewport proportionally via flex-grow so the content
 * cannot be clipped.
 *
 * The threshold (4.0) is placed above the maximum demand any single
 * low-content card can produce (~1.55 for a 1-row training, ~2.2 for
 * a simple match) so solo cards and low-demand sparse pages use bounded mode.
 * A 1-training-group with 6 rows produces demand ≥ 4.3 and therefore
 * correctly uses FILL mode.
 *
 *   sparse — bounded: max-height capped at demand × 25vh per card.
 *            Unused space shows as dark board background below cards.
 *   fill   — proportional: flex-grow distributes full viewport height
 *            (existing behaviour; preserves no-clipping guarantee).
 *
 * Exported for regression testing.
 */
export const LAYOUT_MODE_SPARSE_THRESHOLD = 4.0;

export function layoutModeTier(totalDemand: number): "sparse" | "fill" {
  return totalDemand < LAYOUT_MODE_SPARSE_THRESHOLD ? "sparse" : "fill";
}

// ── Event-type labels (presentation-only, German) ─────────────────────────────

const EVENT_TYPE_LABELS: Record<PublishingEventType, string> = {
  TRAINING: "TRAINING",
  MATCH: "SPIEL",
  TOURNAMENT: "TURNIER",
  OTHER: "EVENT",
  VACATION_PERIOD: "FERIENBLOCK",
};

// ── Temporal types ────────────────────────────────────────────────────────────

type TemporalBucket = "current" | "next" | "later";

export type FlatEvent = {
  event: InfoboardScreen1Event;
  temporal: TemporalBucket;
};

/**
 * A displayable unit in the rendered card list.
 *
 *   "event"          — a single non-training event (or single training at a
 *                      unique start time), rendered with the standard EventCard.
 *   "training-group" — two or more TRAINING events sharing the same startAt,
 *                      collapsed into one aggregate TrainingGroupCard.
 *
 * Exported for regression testing of demand computation and pagination.
 */
export type DisplayItem =
  | { kind: "event"; item: FlatEvent }
  | { kind: "training-group"; items: FlatEvent[]; temporal: TemporalBucket };

/**
 * Splits a display list into pages whose total content demand does not exceed
 * `maxDemand`. Never splits a card in the middle. Current/next activities
 * appear first (input order preserved).
 *
 * Returns a single-element array on normal days. Returns an empty array when
 * `items` is empty.
 *
 * Exported for regression testing.
 */
export function paginateDisplayList(
  items: readonly DisplayItem[],
  demands: readonly number[],
  maxDemand: number = CARD_DEMAND_PAGE_MAX,
): DisplayItem[][] {
  if (items.length === 0) return [];
  const pages: DisplayItem[][] = [];
  let currentPage: DisplayItem[] = [];
  let currentDemand = 0;
  for (let i = 0; i < items.length; i++) {
    const d = demands[i] ?? 1.0;
    if (currentPage.length > 0 && currentDemand + d > maxDemand) {
      pages.push(currentPage);
      currentPage = [items[i]];
      currentDemand = d;
    } else {
      currentPage.push(items[i]);
      currentDemand += d;
    }
  }
  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

// ── Time / date formatting ────────────────────────────────────────────────────

function formatTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(isoString));
}

function formatDressingRoomLabel(label: string): string {
  return label.replace(/^kabine\s+/i, "").trim();
}

function formatDisplayDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Temporal status helpers ───────────────────────────────────────────────────

/**
 * Returns the inline status label for an event card.
 *   current → "JETZT"
 *   next    → "ALS NÄCHSTES"
 *   later   → null (no label)
 *
 * No countdown text is ever returned; only JETZT or ALS NÄCHSTES.
 */
function statusLabel(temporal: TemporalBucket): string | null {
  if (temporal === "current") return "JETZT";
  if (temporal === "next") return "ALS NÄCHSTES";
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findEventExtension(
  eventId: string,
  extensions: readonly InfoboardEventPresentationExtension[] | undefined,
): InfoboardEventPresentationExtension | null {
  if (extensions === undefined) return null;
  for (const ext of extensions) {
    if (ext.eventId === eventId) return ext;
  }
  return null;
}

function buildFlatList(feed: InfoboardScreen1Feed): FlatEvent[] {
  const result: FlatEvent[] = [];
  for (const event of feed.current) {
    result.push({ event, temporal: "current" });
  }
  for (const event of feed.next) {
    result.push({ event, temporal: "next" });
  }
  for (const event of feed.later) {
    result.push({ event, temporal: "later" });
  }
  return result;
}

/**
 * Groups TRAINING events that share an identical startAt ISO string into a
 * single training-group display item.
 *
 * ALL trainings — including solo ones — use the training-group card so the
 * visual language is consistent regardless of how many teams share a start
 * time. This satisfies the "one training and six simultaneous trainings
 * should feel like the same component" requirement.
 */
function buildDisplayList(flatList: FlatEvent[]): DisplayItem[] {
  // First pass: bucket ALL training events by startAt
  const trainingByStart = new Map<string, FlatEvent[]>();
  for (const item of flatList) {
    if (item.event.type === "TRAINING") {
      const key = item.event.startAt;
      let bucket = trainingByStart.get(key);
      if (bucket === undefined) {
        bucket = [];
        trainingByStart.set(key, bucket);
      }
      bucket.push(item);
    }
  }

  // Second pass: emit display items preserving original list order
  const emitted = new Set<string>();
  const result: DisplayItem[] = [];

  for (const item of flatList) {
    if (item.event.type === "TRAINING") {
      const key = item.event.startAt;
      if (emitted.has(key)) continue; // already emitted as part of a group
      emitted.add(key);

      const group = trainingByStart.get(key)!;
      // All training groups (including solo) use training-group card.
      result.push({ kind: "training-group", items: group, temporal: item.temporal });
    } else {
      result.push({ kind: "event", item });
    }
  }

  return result;
}

function displayItemTemporal(item: DisplayItem): TemporalBucket {
  return item.kind === "training-group" ? item.temporal : item.item.temporal;
}

/**
 * Strips a club name prefix from a team display name for Infoboard rendering.
 *
 * Example: "FC ALLSCHWIL JUNIOREN D-9 D1" → "JUNIOREN D-9 D1"
 *
 * The club identity is already established in the header, so repeating it
 * on every training row is redundant. This is a presentation-only
 * transformation — canonical team names are never mutated.
 *
 * Matching is case-insensitive. Returns the original name when no match.
 */
function stripClubPrefix(teamName: string, clubName: string): string {
  if (!clubName) return teamName;
  const prefixLower = clubName.toUpperCase();
  const nameLower = teamName.toUpperCase();
  if (nameLower.startsWith(prefixLower)) {
    const stripped = teamName.slice(clubName.length).trimStart();
    return stripped.length > 0 ? stripped : teamName;
  }
  return teamName;
}

/** Event-family accent key for the card left stripe. */
function stripeKey(type: PublishingEventType): string {
  if (type === "MATCH") return "red";
  if (type === "TOURNAMENT") return "orange";
  return "blue";
}

type MatchClubLogoProps = {
  logoUrl: string | null | undefined;
  clubName: string;
  testId?: string;
  presentation?: "match" | "tournament";
  showLogos?: boolean;
};

/**
 * Reserved-size club crest slot for MATCH / TOURNAMENT presentation.
 * When showLogos is false the slot is omitted entirely (space reclaimed).
 * When enabled but no URL: empty placeholder preserves layout stability.
 */
function MatchClubLogo({
  logoUrl,
  clubName,
  testId,
  presentation = "match",
  showLogos = true,
}: MatchClubLogoProps): ReactElement | null {
  if (!showLogos) return null;

  const logoClassName =
    presentation === "tournament"
      ? logoUrl
        ? styles.tournamentClubLogo
        : styles.tournamentClubLogoPlaceholder
      : logoUrl
        ? styles.matchClubLogo
        : styles.matchClubLogoPlaceholder;

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tenant-managed crest URLs from SCE configuration.
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className={logoClassName}
        data-testid={testId}
      />
    );
  }

  return (
    <span
      className={logoClassName}
      aria-hidden="true"
      data-testid={testId ? `${testId}-placeholder` : undefined}
      title={clubName}
    />
  );
}

type MatchSideIdentityProps = {
  side: InfoboardMatchSidePresentation;
  rowTestId: string;
  logoTestId: string;
  primaryClassName: string;
  showLogos?: boolean;
};

function MatchSideIdentity({
  side,
  rowTestId,
  logoTestId,
  primaryClassName,
  showLogos = true,
}: MatchSideIdentityProps): ReactElement {
  return (
    <div className={styles.matchTeamRow} data-testid={rowTestId}>
      <MatchClubLogo
        logoUrl={side.clubLogoUrl}
        clubName={side.clubDisplayName}
        testId={logoTestId}
        showLogos={showLogos}
      />
      <div className={styles.matchTeamText}>
        <span className={primaryClassName}>{side.clubDisplayName}</span>
      </div>
    </div>
  );
}

// ── Tournament allocation block ───────────────────────────────────────────────

type ParticipantAllocationBlockProps = {
  allocations: readonly InfoboardTeamAllocationPresentation[];
};

/**
 * Compact allocation matrix for tournaments with ≥ 3 participating teams.
 * Each team is paired explicitly with its dressing room on the same row.
 */
function ParticipantAllocationBlock({
  allocations,
}: ParticipantAllocationBlockProps): ReactElement {
  return (
    <div
      className={styles.participantAllocationBlock}
      data-testid="participant-allocation-block"
    >
      {allocations.map((alloc) => (
        <div
          key={alloc.id}
          className={
            alloc.isHomeTeam === true
              ? `${styles.participantAllocationRow} ${styles.homeTeamEmphasis}`
              : styles.participantAllocationRow
          }
        >
          <span className={styles.participantRoomValue}>
            {alloc.dressingRoomLabel !== null
              ? formatDressingRoomLabel(alloc.dressingRoomLabel)
              : "—"}
          </span>
          <span className={styles.participantTeamName}>
            {alloc.teamDisplayName}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Match destination block (RIGHT zone) ─────────────────────────────────────

type MatchDestinationProps = {
  event: InfoboardScreen1Event;
};

function MatchDestination({ event }: MatchDestinationProps): ReactElement {
  const {
    homeDressingRoomLabel,
    awayDressingRoomLabel,
    pitchLabel,
  } = event.allocation;

  const hasHome = homeDressingRoomLabel !== null;
  const hasAway = awayDressingRoomLabel !== null;

  return (
    <>
      <div
        className={styles.cardDressingRoomZone}
        data-testid="match-allocation"
      >
        <span className={styles.destLabel}>KABINE</span>

        {hasHome || hasAway ? (
          <div className={styles.matchAllocation}>
            {hasHome && (
              <div className={styles.matchAllocRow}>
                <span className={styles.matchAllocRoom}>
                  {formatDressingRoomLabel(homeDressingRoomLabel)}
                </span>
                <span className={styles.matchAllocRole}>Heim</span>
              </div>
            )}

            {hasAway && (
              <div className={styles.matchAllocRow}>
                <span className={styles.matchAllocRoom}>
                  {formatDressingRoomLabel(awayDressingRoomLabel)}
                </span>
                <span className={styles.matchAllocRole}>Gast</span>
              </div>
            )}
          </div>
        ) : (
          <span
            className={styles.dressingRoomMissing}
            data-testid="dressing-room-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      <div className={styles.cardPitchZone}>
        <span className={styles.destLabel}>PLATZ</span>

        {pitchLabel !== null ? (
          <span
            className={styles.destPitchValue}
            data-testid="pitch-value"
          >
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>
    </>
  );
}
// ── Training destination block (RIGHT zone) ──────────────────────────────────

type TrainingDestinationProps = {
  event: InfoboardScreen1Event;
};

function TrainingDestination({ event }: TrainingDestinationProps): ReactElement {
  const {
    homeDressingRoomLabel,
    pitchLabel,
  } = event.allocation;

  return (
    <>
      <div
        className={styles.cardDressingRoomZone}
        data-testid="training-allocation"
      >
        <span className={styles.destLabel}>KABINE</span>

        {homeDressingRoomLabel !== null ? (
          <span className={styles.destRoomValue}>
            {formatDressingRoomLabel(homeDressingRoomLabel)}
          </span>
        ) : (
          <span
            className={styles.dressingRoomMissing}
            data-testid="dressing-room-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      <div className={styles.cardPitchZone}>
        <span className={styles.destLabel}>PLATZ</span>

        {pitchLabel !== null ? (
          <span
            className={styles.destPitchValue}
            data-testid="pitch-value"
          >
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>
    </>
  );
}
// ── Tournament destination block (RIGHT zone) ────────────────────────────────

type TournamentDestinationProps = {
  event: InfoboardScreen1Event;
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined;
};

function TournamentDestination({
  event,
  participantAllocations,
}: TournamentDestinationProps): ReactElement {
  const { pitchLabel } = event.allocation;

  return (
    <>
      <div className={styles.cardDressingRoomZone}>
        <span
          className={styles.destLabel}
        >
          KABINE
        </span>

        {participantAllocations !== undefined &&
        participantAllocations.length >= 3 ? (
          <ParticipantAllocationBlock allocations={participantAllocations} />
        ) : (
          <span
            className={styles.dressingRoomMissing}
            data-testid="dressing-room-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      <div className={styles.cardPitchZone}>
        <span
          className={styles.destLabel}
        >
          PLATZ
        </span>

        {pitchLabel !== null ? (
          <span
            className={styles.destPitchValue}
            data-testid="pitch-value"
          >
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>
    </>
  );
}
// ── Training group card ───────────────────────────────────────────────────────

type TrainingGroupCardProps = {
  items: FlatEvent[];
  timeZone: string;
  /** Content-demand value driving flex-grow on this card. */
  demand: number;
  /** Club name for prefix stripping from team display names. */
  clubName: string;
};

/**
 * Aggregated card for two or more TRAINING events sharing the same start time.
 *
 * Layout:
 *   LEFT ZONE  — JETZT / ALS NÄCHSTES status label + start time + shared end
 *                time (shown once when all trainings end at the same time).
 *   BODY ZONE  — spans the event + destination columns; renders a column-header
 *                row followed by one compact row per team (TEAM | PLATZ | KABINE).
 *
 * Invariants (matching EventCard):
 *   - data-testid="event-row" is preserved so row counts remain testable.
 *   - Missing pitch/dressing-room → NICHT ZUGETEILT warning (amber).
 *   - No referee data rendered.
 *   - No club shirt colours from the mockup — no canonical data source.
 */
function TrainingGroupCard({
  items,
  timeZone,
  demand,
  clubName,
}: TrainingGroupCardProps): ReactElement {
  const first = items[0];
  const temporal = first.temporal;
  const startAt = first.event.startAt;
  const startTime = formatTime(startAt, timeZone);
  const label = statusLabel(temporal);
  const stripe = stripeKey("TRAINING");
  const groupDensity = trainingGroupDensityTier(items.length);

  // Shared end time is displayed once in the TIME zone when all grouped
  // trainings end together. Differing end times remain visible per team row.
  const firstEndAt = first.event.endAt;
  const allSameEnd = items.every((it) => it.event.endAt === firstEndAt);
  const commonEndTime =
    allSameEnd && firstEndAt !== null ? formatTime(firstEndAt, timeZone) : null;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-row"
      data-type="TRAINING"
      data-temporal={temporal}
      data-stripe={stripe}
      data-training-count={items.length}
      data-group-density={groupDensity}
      data-card-demand={demand.toFixed(2)}
      style={{ "--ib-card-demand": demand } as CSSProperties}
    >
      {/* TIME */}
      <div className={styles.cardTimeZone}>
        {label !== null && (
          <span
            className={styles.statusLabel}
            data-testid={`status-label-${temporal}`}
            data-status={temporal === "current" ? "current" : "next"}
          >
            {label}
          </span>
        )}

        <time className={styles.eventTime} dateTime={startAt}>
          {startTime}
        </time>

        {commonEndTime !== null && (
          <span className={styles.eventEndTime} aria-label="Bis">
            bis {commonEndTime}
          </span>
        )}
      </div>

      {/* EVENT */}
      <div
        className={`${styles.cardEventZone} ${styles.trainingGroupZone}`}
        data-testid="training-group"
      >
        <span
          className={styles.eventTypeLabel}
          data-event-type="TRAINING"
        >
          TRAINING
        </span>

        <div className={styles.trainingGroupRows}>
          {items.map((it) => {
            const rowEndAt = it.event.endAt;
            const rowEndTime =
              !allSameEnd && rowEndAt !== null
                ? formatTime(rowEndAt, timeZone)
                : null;

            return (
              <div
                key={it.event.id}
                className={styles.trainingGroupAlignedRow}
                data-testid="training-group-row"
              >
                <span className={styles.trainingGroupTeamName}>
                  {stripClubPrefix(
                    it.event.teamDisplayName ?? it.event.displayTitle,
                    clubName,
                  )}

                  {rowEndTime !== null && (
                    <span
                      className={styles.trainingGroupRowEndTime}
                      aria-label="Bis"
                    >
                      {" "}bis {rowEndTime}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* KABINE */}
      <div className={`${styles.cardDressingRoomZone} ${styles.trainingGroupZone}`}>
        <span className={styles.destLabel}>KABINE</span>

        <div className={styles.trainingGroupRows}>
          {items.map((it) => {
            const { homeDressingRoomLabel } = it.event.allocation;

            return (
              <div
                key={it.event.id}
                className={styles.trainingGroupAlignedRow}
              >
                {homeDressingRoomLabel !== null ? (
                  <span className={styles.trainingGroupRoomValue}>
                    {formatDressingRoomLabel(homeDressingRoomLabel)}
                  </span>
                ) : (
                  <span
                    className={styles.dressingRoomMissing}
                    data-testid="dressing-room-unassigned-warning"
                  >
                    NICHT ZUGETEILT
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PLATZ */}
      <div className={`${styles.cardPitchZone} ${styles.trainingGroupZone}`}>
        <span className={styles.destLabel}>PLATZ</span>

        <div className={styles.trainingGroupRows}>
          {items.map((it) => {
            const { pitchLabel } = it.event.allocation;

            return (
              <div
                key={it.event.id}
                className={styles.trainingGroupAlignedRow}
              >
                {pitchLabel !== null ? (
                  <span
                    className={styles.trainingGroupPitchValue}
                    data-testid="pitch-value"
                  >
                    {pitchLabel}
                  </span>
                ) : (
                  <span
                    className={styles.pitchMissing}
                    data-testid="pitch-unassigned-warning"
                  >
                    NICHT ZUGETEILT
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </li>
  );
}
// ── Event card ────────────────────────────────────────────────────────────────

type EventCardProps = {
  item: FlatEvent;
  timeZone: string;
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined;
  /** Content-demand value driving flex-grow on this card. */
  demand: number;
  logoPresentation?: Screen1LogoPresentationConfig;
};

function EventCard({
  item,
  timeZone,
  participantAllocations,
  demand,
  logoPresentation = DEFAULT_SCREEN1_LOGO_PRESENTATION,
}: EventCardProps): ReactElement {
  const { event, temporal } = item;
  const startTime = formatTime(event.startAt, timeZone);
  const rawEndTime = event.endAt !== null ? formatTime(event.endAt, timeZone) : null;
  // Do not show a fake/meaningless duration: suppress endTime when it equals
  // startTime (e.g. endAt was set to startAt in the source) or when no explicit
  // end is recorded. Training sessions with genuine endAt pass this guard.
  const endTime = rawEndTime !== null && rawEndTime !== startTime ? rawEndTime : null;
  const isMatch = event.type === "MATCH";
  const isTournament = event.type === "TOURNAMENT";

  const label = statusLabel(temporal);
  const stripe = stripeKey(event.type);

  const typeDisplayLabel = isMatch
    ? (event.competitionLabel ?? EVENT_TYPE_LABELS["MATCH"])
    : EVENT_TYPE_LABELS[event.type] ?? event.type;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-row"
      data-type={event.type}
      data-temporal={temporal}
      data-stripe={stripe}
      data-card-demand={demand.toFixed(2)}
      style={{ "--ib-card-demand": demand } as CSSProperties}
    >
      {/* ── LEFT ZONE: Status + Time ─────────────────────────────────── */}
      <div className={styles.cardTimeZone}>
        {label !== null && (
          <span
            className={styles.statusLabel}
            data-testid={`status-label-${temporal}`}
            data-status={temporal === "current" ? "current" : "next"}
          >
            {label}
          </span>
        )}
        <time className={styles.eventTime} dateTime={event.startAt}>
          {startTime}
        </time>
        {endTime !== null && (
          <span className={styles.eventEndTime} aria-label="Bis">
            bis {endTime}
          </span>
        )}
      </div>

      {/* ── CENTER ZONE: Event identity ──────────────────────────────── */}
      <div className={styles.cardEventZone}>
        <span
          className={styles.eventTypeLabel}
          data-event-type={event.type}
        >
          {typeDisplayLabel}
        </span>

        {isMatch ? (
          <div className={styles.matchIdentity}>
            {event.matchPresentation ? (
              <>
                <MatchSideIdentity
                  side={event.matchPresentation.home}
                  rowTestId="match-home-team-row"
                  logoTestId="home-team-logo"
                  primaryClassName={styles.eventTeamMain}
                  showLogos={logoPresentation.matchShowLogos}
                />
                <span className={styles.vsLabel} aria-hidden="true">vs.</span>
                {event.matchPresentation.away !== null && (
                  <MatchSideIdentity
                    side={event.matchPresentation.away}
                    rowTestId="match-away-team-row"
                    logoTestId="away-team-logo"
                    primaryClassName={styles.eventTeamOpponent}
                    showLogos={logoPresentation.matchShowLogos}
                  />
                )}
              </>
            ) : (
              <>
                <div className={styles.matchTeamRow} data-testid="match-home-team-row">
                  <span className={styles.eventTeamMain}>
                    {event.teamDisplayName}
                  </span>
                </div>
                <span className={styles.vsLabel} aria-hidden="true">vs.</span>
                {event.opponentDisplayName !== null && (
                  <div className={styles.matchTeamRow} data-testid="match-away-team-row">
                    <span className={styles.eventTeamOpponent}>
                      {event.opponentDisplayName}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : isTournament ? (
          <div className={styles.tournamentIdentity}>
            <span className={styles.tournamentTitle}>{event.displayTitle}</span>

            {participantAllocations !== undefined && participantAllocations.length > 0 && (
              <div
                className={styles.tournamentParticipantLogos}
                data-testid="tournament-participants"
              >
                {participantAllocations.slice(0, 4).map((participant) => (
                  <MatchClubLogo
                    key={participant.id}
                    logoUrl={participant.clubLogoUrl ?? null}
                    clubName={participant.teamDisplayName}
                    testId={`tournament-participant-logo-${participant.id}`}
                    presentation="tournament"
                    showLogos={logoPresentation.tournamentShowLogos}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {event.teamDisplayName !== null ? (
              <span className={styles.eventTeamMain}>{event.teamDisplayName}</span>
            ) : (
              event.displayTitle !== null && (
                <span className={styles.eventTeamMain}>{event.displayTitle}</span>
              )
            )}
            {event.organizerDisplayName !== null && (
              <span className={styles.eventTeamSubtitle}>
                {event.organizerDisplayName}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── KABINE + PLATZ ─────────────────────────────────────────── */}
      {isMatch ? (
        <MatchDestination event={event} />
      ) : isTournament ? (
        <TournamentDestination
          event={event}
          participantAllocations={participantAllocations}
        />
      ) : (
        <TrainingDestination event={event} />
      )}
    </li>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen1({
  feed,
  branding,
  announcement,
  eventPresentation,
  currentTimeIso,
  weather,
  theme = DEFAULT_INFOBOARD_DISPLAY_THEME,
  headerConfig,
  logoPresentation: logoPresentationProp,
}: InfoboardScreen1Props): ReactElement {
  const logoPresentation = logoPresentationProp ?? DEFAULT_SCREEN1_LOGO_PRESENTATION;
  const { tenant } = feed;
  const timeZone = tenant.timezone;
  const themeAttr = theme.toLowerCase();

  const clockSeed = currentTimeIso ?? feed.generatedAt;
  const liveTimeIso = useKioskClock(clockSeed);
  const visibleFeed = useMemo(() => {
    if (currentTimeIso == null) return feed;
    return filterExpiredScreen1Feed(feed, new Date(liveTimeIso));
  }, [feed, liveTimeIso, currentTimeIso]);

  // Header visibility settings (per-board config or defaults)
  const showTime = headerConfig?.showTime !== false;
  const showDate = headerConfig?.showDate !== false;
  const showWeather = headerConfig?.showWeather === true;
  const subtitleEnabled = headerConfig?.subtitleEnabled !== false;
  const subtitleText = headerConfig?.subtitleText?.trim() ?? null;

  // Club name for prefix stripping (presentation-only)
  const clubNameUpper = tenant.name.toUpperCase();

  const flatList = buildFlatList(visibleFeed);
  const rawDisplayList = buildDisplayList(flatList);

  // Pre-compute demands for capacity admission (tournament extensions resolved once).
  const rawItemDemands: number[] = rawDisplayList.map((item) => {
    if (item.kind === "training-group") {
      return computeTrainingGroupDemand(item.items.length);
    }
    const event = item.item.event;
    if (event.type === "MATCH") {
      return computeMatchDemand(event);
    }
    if (event.type === "TOURNAMENT") {
      const ext = findEventExtension(event.id, eventPresentation);
      return computeTournamentDemand(ext?.participantAllocations);
    }
    return computeEventDemand(event.type);
  });

  const displayList = admitDisplayItemsByCapacity(
    rawDisplayList,
    rawItemDemands,
    displayItemTemporal,
    CARD_DEMAND_PAGE_MAX,
  );

  const totalCards = displayList.length;

  const overflowCount =
    totalCards > PROTOTYPE_CAPACITY ? totalCards - PROTOTYPE_CAPACITY : 0;
  const visibleDisplayList = overflowCount > 0
    ? displayList.slice(0, PROTOTYPE_CAPACITY)
    : displayList;

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  // Static date fallback used only when currentTimeIso is absent.
  const staticDateLine =
    currentTimeIso == null ? formatDisplayDate(feed.displayDate) : null;

  // ── Content-demand pre-computation for pagination ────────────────────────
  const itemDemands: number[] = visibleDisplayList.map((item) => {
    const rawIndex = rawDisplayList.indexOf(item);
    return rawIndex >= 0 ? rawItemDemands[rawIndex] ?? 1.0 : 1.0;
  });

  // Split into pages based on demand. Normal days: single page (no rotation).
  const pages = paginateDisplayList(visibleDisplayList, itemDemands);

  // ── Page renderer (used for each page in the rotator) ────────────────────
  function renderPage(pageItems: DisplayItem[], pageIndex: number): ReactElement {
    // Collect per-item demands for this page's subset
    const pageStartIndex = visibleDisplayList.indexOf(pageItems[0]);
    const pageDemands = pageItems.map((_, j) => itemDemands[pageStartIndex + j] ?? 1.0);
    const pageTotalDemand = pageDemands.reduce((sum, d) => sum + d, 0);
    const pageDensity = densityTier(pageTotalDemand);
    const pageLayoutMode = layoutModeTier(pageTotalDemand);

    return (
      <ul
        key={pageIndex}
        className={styles.eventList}
        role="list"
        data-testid={pageIndex === 0 ? "event-list" : `event-list-page-${pageIndex}`}
        data-count={pageItems.length}
        data-density={pageDensity}
        data-layout-mode={pageLayoutMode}
        style={{ "--ib-page-demand-max": CARD_DEMAND_PAGE_MAX } as CSSProperties}
      >
        {pageItems.map((displayItem, j) => {
          const demand = pageDemands[j];
          if (displayItem.kind === "training-group") {
            return (
              <TrainingGroupCard
                key={displayItem.items.map((it) => it.event.id).join(":")}
                items={displayItem.items}
                timeZone={timeZone}
                demand={demand}
                clubName={clubNameUpper}
              />
            );
          }
          const { item } = displayItem;
          const extension = findEventExtension(item.event.id, eventPresentation);
          const allocs = extension?.participantAllocations;
          const participantAllocations =
            allocs !== undefined && allocs.length > 0 ? allocs : undefined;
          return (
            <EventCard
              key={item.event.id}
              item={item}
              timeZone={timeZone}
              participantAllocations={participantAllocations}
              demand={demand}
              logoPresentation={logoPresentation}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen1-root"
      data-theme={themeAttr}
      style={
        {
          "--ib-match-logo-size": MATCH_LOGO_SIZE_CSS[logoPresentation.matchLogoSize],
          "--ib-tournament-logo-size":
            TOURNAMENT_LOGO_SIZE_CSS[logoPresentation.tournamentLogoSize],
        } as CSSProperties
      }
    >
      {/* ── Shared kiosk header (INFOBOARD-MAP-02) ──────────────────────── */}
      <KioskShellHeader
        clubLogoSrc={clubLogoSrc}
        clubName={tenant.name}
        initialTimeIso={currentTimeIso}
        timezone={timeZone}
        weather={showWeather ? weather : null}
        showTime={showTime}
        showDate={showDate}
        staticDateFallback={staticDateLine}
        subtitle={subtitleText != null ? subtitleText.toUpperCase() : null}
        subtitleEnabled={subtitleEnabled}
      />

      {/* ── Main: event list (demand-paginated, rotated when multi-page) ── */}
      <main className={styles.main}>
        {visibleFeed.isEmpty ? (
          <div className={styles.emptyFull} data-testid="empty-state-full">
            <p className={styles.emptyFullMessage}>
              {visibleFeed.emptyStateReason === "DAY_COMPLETED"
                ? "Heute keine weiteren Trainings, Heimspiele oder Turniere."
                : "Heute sind keine Trainings, Heimspiele oder Turniere geplant."}
            </p>
          </div>
        ) : (
          <>
            <InfoboardPageRotator intervalMs={12_000}>
              {pages.map((pageItems, pageIndex) => renderPage(pageItems, pageIndex))}
            </InfoboardPageRotator>

            {overflowCount > 0 && (
              <p
                className={styles.overflowWarning}
                data-testid="overflow-warning"
                role="status"
              >
                WEITERE TERMINE VORHANDEN
              </p>
            )}
          </>
        )}
      </main>

      {/* ── Shared kiosk footer (INFOBOARD-MAP-02) ──────────────────────── */}
      <KioskShellFooter
        productLogoSrc={productLogoSrc}
        announcement={announcement}
      />
    </div>
  );
}
