/**
 * components/infoboard/screen2/Screen2TransportSlide.tsx
 *
 * INFOBOARD-TRANSPORT-02 — normalized transport departures presentation.
 */

import type { ReactElement } from "react";
import { resolveTransportLineColor } from "@/lib/transport/transport-line-colors";
import type {
  TransportDeparture,
  TransportDirectionGroup,
  TransportResult,
} from "@/lib/transport/transport-types";
import {
  computeMinutesUntil,
  formatRelativeWaitLabel,
  resolveWaitTimeTone,
} from "@/lib/transport/transport-wait-time";
import styles from "./Screen2TransportSlide.module.css";

export type Screen2TransportSlideProps = {
  transport: TransportResult | null | undefined;
  timezone: string;
  nowIso?: string;
  /** Compact embedded panel below the Sportanlage map. */
  compact?: boolean;
};

function formatMinutesUntil(
  departure: TransportDeparture,
  nowMs: number,
  timezone: string,
): {
  minutesLabel: string;
  waitTimeTone: ReturnType<typeof resolveWaitTimeTone>;
  absoluteTime: string;
  delayLabel: string | null;
} {
  const effectiveIso = departure.realtimeDeparture ?? departure.plannedDeparture;
  const effectiveMs = Date.parse(effectiveIso);
  const diffMinutes = computeMinutesUntil(effectiveMs, nowMs);
  const minutesLabel = formatRelativeWaitLabel(diffMinutes);
  const waitTimeTone = resolveWaitTimeTone(diffMinutes);

  const absoluteTime = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(effectiveIso));

  const delayLabel =
    departure.delayMinutes && departure.delayMinutes > 0
      ? `+${departure.delayMinutes}`
      : null;

  return { minutesLabel, waitTimeTone, absoluteTime, delayLabel };
}

function resolveDepartures(transport: TransportResult | null | undefined): {
  departures: TransportDeparture[];
  directionGroups: TransportDirectionGroup[];
  stationDisplayName: string;
  isStale: boolean;
  hasRealtimeData: boolean;
  unavailable: boolean;
  empty: boolean;
} {
  if (!transport) {
    return {
      departures: [],
      directionGroups: [],
      stationDisplayName: "",
      isStale: false,
      hasRealtimeData: false,
      unavailable: true,
      empty: false,
    };
  }

  if (transport.isAvailable) {
    return {
      departures: transport.departures,
      directionGroups: transport.directionGroups,
      stationDisplayName: transport.stationDisplayName,
      isStale: transport.isStale,
      hasRealtimeData: transport.hasRealtimeData,
      unavailable: false,
      empty: transport.departures.length === 0,
    };
  }

  const cached = transport.cachedDepartures ?? [];
  if (cached.length > 0) {
    return {
      departures: cached,
      directionGroups: [],
      stationDisplayName: transport.stationDisplayName,
      isStale: true,
      hasRealtimeData: cached.some((departure) => departure.hasRealtime),
      unavailable: false,
      empty: false,
    };
  }

  return {
    departures: [],
    directionGroups: [],
    stationDisplayName: transport.stationDisplayName,
    isStale: false,
    hasRealtimeData: false,
    unavailable: true,
    empty: false,
  };
}

function formatDirectionHeading(group: TransportDirectionGroup): string {
  const label = group.displayName.toUpperCase();
  if (group.orientation === "left") {
    return `← ${label}`;
  }
  return `${label} →`;
}

function TransportDepartureRow({
  departure,
  nowMs,
  timezone,
}: {
  departure: TransportDeparture;
  nowMs: number;
  timezone: string;
}): ReactElement {
  const timing = formatMinutesUntil(departure, nowMs, timezone);
  const lineColor = resolveTransportLineColor(departure.line);
  const minutesClassName = [
    styles.minutes,
    timing.waitTimeTone === "soon"
      ? styles.minutesSoon
      : timing.waitTimeTone === "medium"
        ? styles.minutesMedium
        : styles.minutesLong,
    timing.minutesLabel === "Jetzt" ? styles.minutesImminent : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.row} data-testid="screen2-transport-row">
      <div className={styles.lineBlock}>
        <span className={styles.category}>{departure.categoryLabel}</span>
        <span
          className={styles.lineBadge}
          data-testid="screen2-transport-line-badge"
          style={{
            backgroundColor: lineColor.background,
            color: lineColor.foreground,
          }}
        >
          {departure.line}
        </span>
      </div>
      <div className={styles.destination}>{departure.destination}</div>
      <div className={styles.departureBlock}>
        <span
          className={minutesClassName}
          data-testid="screen2-transport-wait-time"
          data-wait-tone={timing.waitTimeTone}
        >
          {timing.minutesLabel}
        </span>
        <span className={styles.absoluteTime} data-testid="screen2-transport-absolute-time">
          {timing.absoluteTime}
          {timing.delayLabel ? (
            <span className={styles.delayInline} data-testid="screen2-transport-delay">
              {" "}
              {timing.delayLabel}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function TransportDirectionColumn({
  group,
  nowMs,
  timezone,
}: {
  group: TransportDirectionGroup;
  nowMs: number;
  timezone: string;
}): ReactElement {
  return (
    <section
      className={styles.directionColumn}
      data-testid={`screen2-transport-direction-${group.id}`}
      data-orientation={group.orientation}
    >
      <h3 className={styles.directionHeading}>{formatDirectionHeading(group)}</h3>
      {group.departures.length === 0 ? (
        <div className={styles.directionEmpty} data-testid="screen2-transport-direction-empty">
          Keine nächsten Verbindungen
        </div>
      ) : (
        <div className={styles.directionRows}>
          {group.departures.map((departure, index) => (
            <TransportDepartureRow
              key={`${group.id}-${departure.line}-${departure.destination}-${departure.plannedDeparture}-${index}`}
              departure={departure}
              nowMs={nowMs}
              timezone={timezone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function Screen2TransportSlide({
  transport,
  timezone,
  nowIso,
  compact = false,
}: Screen2TransportSlideProps): ReactElement {
  const nowMs = Date.parse(nowIso ?? new Date().toISOString());
  const resolved = resolveDepartures(transport);
  const hasDirectionGroups = resolved.directionGroups.length > 0;

  return (
    <div
      className={`${styles.slide}${compact ? ` ${styles.compact}` : ""}`}
      data-testid="screen2-transport-slide"
      data-compact={compact ? "true" : "false"}
      data-stale={resolved.isStale ? "true" : "false"}
    >
      <div className={styles.header}>
        <div className={styles.eyebrow}>ÖV-ABFAHRTEN</div>
        <div className={styles.station}>{resolved.stationDisplayName || "—"}</div>
      </div>

      {resolved.unavailable ? (
        <div className={styles.unavailableState} data-testid="screen2-transport-unavailable">
          Abfahrten vorübergehend nicht verfügbar
        </div>
      ) : resolved.empty && !hasDirectionGroups ? (
        <div className={styles.emptyState} data-testid="screen2-transport-empty">
          Keine nächsten Verbindungen verfügbar
        </div>
      ) : hasDirectionGroups ? (
        <div className={styles.directionColumns} data-testid="screen2-transport-direction-columns">
          {resolved.directionGroups.map((group) => (
            <TransportDirectionColumn
              key={group.id}
              group={group}
              nowMs={nowMs}
              timezone={timezone}
            />
          ))}
        </div>
      ) : (
        <div className={styles.rows} data-testid="screen2-transport-rows">
          {resolved.departures.map((departure, index) => (
            <TransportDepartureRow
              key={`${departure.line}-${departure.destination}-${departure.plannedDeparture}-${index}`}
              departure={departure}
              nowMs={nowMs}
              timezone={timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
