/**
 * components/infoboard/anlageplan/InfoboardAnlageplan.tsx
 *
 * INFOBOARD-MAP-01 — Public Anlageplan kiosk display.
 *
 * Answers: "Wo muss ich hin?"
 *
 * Layout (16:9, dark premium shell):
 *   ┌──────────────────────────────────────────┐
 *   │ FCA HEADER (logo / name / time / date)   │
 *   ├─────────────────────────────┬────────────┤
 *   │                             │ ANLAGE     │
 *   │  MAP CANVAS                 │ INFO RAIL  │
 *   │  (background image +        │            │
 *   │   resource zones +          │            │
 *   │   markers + activity cards) │            │
 *   ├─────────────────────────────┴────────────┤
 *   │ HEUTE/ALS NÄCHSTES RAIL                  │
 *   └──────────────────────────────────────────┘
 *
 * Invariants:
 *   - Pure server component (no "use client", no effects, no fetch)
 *   - No Prisma imports, no DB access
 *   - No new Date() without argument
 *   - No null/undefined rendered as strings
 *   - 100dvh, no scroll
 *   - DARK theme only (matching FCA brand)
 */

import type { ReactElement } from "react";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type {
  PitchOccupancy,
  PitchEventSummary,
  DressingRoomOccupancy,
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
} from "@/lib/publishing/event-types";
import type {
  AnlageplanConfig,
  AnlageplanElement,
  ResourceZoneElement,
  MarkerElement,
  MarkerType,
} from "@/lib/infoboard/anlageplan-types";
import {
  isResourceZone,
  isMarker,
  isDuBistHier,
  MARKER_LABELS,
  MARKER_ICONS,
} from "@/lib/infoboard/anlageplan-types";
import { LiveClockAnlageplan } from "./LiveClockAnlageplan";

// ── Event time helper ─────────────────────────────────────────────────────────

function fmtTime(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    hour12: false,
  }).format(new Date(isoString));
}

// ── Event type badge ──────────────────────────────────────────────────────────

function eventTypeBadge(type: string): string {
  switch (type) {
    case "MATCH":      return "SPIEL";
    case "TRAINING":   return "TRAINING";
    case "TOURNAMENT": return "TURNIER";
    default:           return "";
  }
}

// ── Component props ───────────────────────────────────────────────────────────

export type InfoboardAnlageplanProps = {
  payload: AnlageplanLivePayload;
  branding: {
    clubLogoSrc?: string | null;
    productLogoSrc?: string | null;
    clubName?: string | null;
    facilityName?: string | null;
  };
};

// ── Main component ────────────────────────────────────────────────────────────

export function InfoboardAnlageplan({
  payload,
  branding,
}: InfoboardAnlageplanProps): ReactElement {
  const { screen2, anlageplanConfig, backgroundUrl, currentTimeIso } = payload;
  const tz = screen2.feed.tenant.timezone;

  // Build pitch occupancy lookup: resourceCode → PitchOccupancy
  const pitchMap = new Map<string, PitchOccupancy>(
    screen2.feed.pitches.map((p) => [p.code, p]),
  );

  // Collect dressing rooms for the info rail
  const dressingRooms = screen2.feed.dressingRooms;

  // Separate map elements by type
  const zones = anlageplanConfig.elements.filter(isResourceZone);
  const markers = anlageplanConfig.elements.filter(
    (e): e is MarkerElement => isMarker(e) && !isDuBistHier(e),
  );
  const duBistHierEl = anlageplanConfig.elements.find(isDuBistHier) as MarkerElement | undefined;

  // All activities from screen2 feed for the Heute rail
  const allPitchEvents: PitchEventSummary[] = [];
  for (const pitch of screen2.feed.pitches) {
    if (pitch.currentEvent) allPitchEvents.push(pitch.currentEvent);
    if (pitch.nextEvent) allPitchEvents.push(pitch.nextEvent);
  }
  for (const ev of screen2.feed.unallocated) {
    allPitchEvents.push(ev);
  }

  // Current vs next for the rail
  const currentEvents = allPitchEvents.filter((e) => e.temporalRelation === "current");
  const nextEvents = allPitchEvents.filter((e) => e.temporalRelation === "next");

  return (
    <div
      data-theme="dark"
      className="relative flex flex-col w-full bg-[#060B12] text-white"
      style={{ height: "100dvh", overflow: "hidden", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between gap-4 shrink-0"
        style={{
          padding: "0.8vh 2vw",
          background: "linear-gradient(180deg, #0a1020 0%, #060B12 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          height: "12vh",
        }}
      >
        {/* Club identity */}
        <div className="flex items-center gap-3">
          {branding.clubLogoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.clubLogoSrc}
              alt="Club Logo"
              style={{ height: "6vh", width: "auto", objectFit: "contain" }}
            />
          )}
          <div>
            <div
              style={{
                fontSize: "2.2vh",
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {branding.clubName ?? "FC ALLSCHWIL"}
            </div>
            <div
              style={{
                fontSize: "1.3vh",
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
                marginTop: "0.3vh",
              }}
            >
              {branding.facilityName ?? "SPORTANLAGE IM BRÜEL"}
            </div>
          </div>
        </div>

        {/* Centre headline */}
        <div
          style={{
            fontSize: "1.6vh",
            letterSpacing: "0.22em",
            color: "rgba(255,255,255,0.40)",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          HERZLICH WILLKOMMEN
        </div>

        {/* Time / date */}
        <LiveClockAnlageplan initialTimeIso={currentTimeIso} timezone={tz} />
      </header>

      {/* ── BODY: canvas + info rail ──────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0" style={{ padding: "1vh 2vw" }}>
        {/* ── MAP CANVAS ──────────────────────────────────────────────────── */}
        <div
          className="relative flex-1 min-w-0 rounded-xl overflow-hidden"
          style={{
            background: backgroundUrl ? "transparent" : "#0d1520",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Background image */}
          {backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backgroundUrl}
              alt="Sportanlage"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.15)",
                fontSize: "1.4vh",
                letterSpacing: "0.15em",
              }}
            >
              ANLAGEPLAN
            </div>
          )}

          {/* Resource zones with activity cards */}
          {zones.map((zone) => {
            const occupancy = zone.resourceCode
              ? pitchMap.get(zone.resourceCode)
              : null;
            return (
              <ResourceZoneOverlay
                key={zone.id}
                zone={zone}
                occupancy={occupancy ?? null}
                tz={tz}
              />
            );
          })}

          {/* Facility markers */}
          {markers.map((marker) => (
            <FacilityMarker key={marker.id} marker={marker} />
          ))}

          {/* Du bist hier */}
          {duBistHierEl && <DuBistHierMarker marker={duBistHierEl} />}
        </div>

        {/* ── ANLAGE INFO RAIL ─────────────────────────────────────────────── */}
        <aside
          style={{
            width: "18vw",
            minWidth: 180,
            marginLeft: "1vw",
            display: "flex",
            flexDirection: "column",
            gap: "0.6vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "0.9vh",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              marginBottom: "0.4vh",
            }}
          >
            ANLAGE
          </div>

          {/* Dressing rooms */}
          {dressingRooms.map((dr) => (
            <AnlageInfoRow key={dr.code} label={dr.displayLabel} occupied={dr.state === "OCCUPIED_NOW"} />
          ))}

          {/* Static facility markers from config */}
          {markers
            .filter((m) => m.markerType !== "FREIER_MARKER")
            .map((m) => (
              <AnlageInfoRow
                key={m.id}
                icon={MARKER_ICONS[m.markerType]}
                label={m.label ?? MARKER_LABELS[m.markerType]}
              />
            ))}
        </aside>
      </div>

      {/* ── HEUTE / ALS NÄCHSTES RAIL ─────────────────────────────────────── */}
      <footer
        style={{
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "0.8vh 2vw",
          display: "flex",
          gap: "3vw",
          alignItems: "flex-start",
          flexShrink: 0,
          minHeight: "12vh",
          overflow: "hidden",
        }}
      >
        {/* JETZT */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "0.85vh",
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "0.5vh",
            }}
          >
            JETZT
          </div>
          {currentEvents.length === 0 ? (
            <p style={{ fontSize: "1.1vh", color: "rgba(255,255,255,0.25)" }}>–</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3vh" }}>
              {currentEvents.slice(0, 5).map((ev) => (
                <ActivityRailRow key={`c-${ev.eventId}`} event={ev} tz={tz} isCurrent />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(255,255,255,0.08)", alignSelf: "stretch" }} />

        {/* ALS NÄCHSTES */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "0.85vh",
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "0.5vh",
            }}
          >
            ALS NÄCHSTES
          </div>
          {nextEvents.length === 0 ? (
            <p style={{ fontSize: "1.1vh", color: "rgba(255,255,255,0.25)" }}>–</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3vh" }}>
              {nextEvents.slice(0, 5).map((ev) => (
                <ActivityRailRow key={`n-${ev.eventId}`} event={ev} tz={tz} isCurrent={false} />
              ))}
            </div>
          )}
        </div>

        {/* Branding */}
        {branding.productLogoSrc && (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.productLogoSrc}
              alt="SportClubEvo"
              style={{ height: "2.5vh", opacity: 0.3, objectFit: "contain" }}
            />
          </div>
        )}
      </footer>
    </div>
  );
}

// ── ResourceZoneOverlay ───────────────────────────────────────────────────────

function ResourceZoneOverlay({
  zone,
  occupancy,
  tz,
}: {
  zone: ResourceZoneElement;
  occupancy: PitchOccupancy | null;
  tz: string;
}): ReactElement {
  const isOccupied = occupancy?.state === "OCCUPIED_NOW";
  const hasNext = !!occupancy?.nextEvent;

  return (
    <div
      style={{
        position: "absolute",
        left: `${zone.rect.x * 100}%`,
        top: `${zone.rect.y * 100}%`,
        width: `${zone.rect.width * 100}%`,
        height: `${zone.rect.height * 100}%`,
        transform: zone.rect.rotation ? `rotate(${zone.rect.rotation}deg)` : undefined,
        border: `2px solid ${isOccupied ? "rgba(74,222,128,0.7)" : "rgba(148,163,184,0.3)"}`,
        borderRadius: 6,
        background: isOccupied
          ? "rgba(74,222,128,0.08)"
          : "rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      {/* Zone label bar */}
      <div
        style={{
          padding: "1.5% 4%",
          background: "rgba(0,0,0,0.45)",
          fontSize: "clamp(7px, 1vh, 12px)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: isOccupied ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {zone.label ?? zone.resourceCode ?? "Zone"}
      </div>

      {/* Current activity card */}
      {occupancy?.currentEvent && (
        <ActivityCard event={occupancy.currentEvent} tz={tz} isCurrent />
      )}

      {/* Next activity card (subtler) */}
      {zone.showNextActivity && occupancy?.nextEvent && (
        <ActivityCard event={occupancy.nextEvent} tz={tz} isCurrent={false} />
      )}

      {/* Free label */}
      {!occupancy?.currentEvent && !occupancy?.nextEvent && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.15)",
            fontSize: "clamp(6px, 0.9vh, 11px)",
            letterSpacing: "0.18em",
          }}
        >
          FREI
        </div>
      )}
    </div>
  );
}

// ── ActivityCard ──────────────────────────────────────────────────────────────

function ActivityCard({
  event,
  tz,
  isCurrent,
}: {
  event: PitchEventSummary;
  tz: string;
  isCurrent: boolean;
}): ReactElement {
  const badge = eventTypeBadge(event.type);
  const startTime = fmtTime(event.startAt, tz);
  const endTime = event.endAt ? fmtTime(event.endAt, tz) : null;
  const primaryDr = event.dressingRooms[0];

  return (
    <div
      style={{
        padding: "2% 4%",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: isCurrent ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
        flex: isCurrent ? "none" : "none",
      }}
    >
      {/* Badge + time */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "4%",
        }}
      >
        {badge && (
          <span
            style={{
              fontSize: "clamp(5px, 0.7vh, 9px)",
              letterSpacing: "0.14em",
              background: isCurrent ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)",
              color: isCurrent ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.4)",
              borderRadius: 3,
              padding: "0 3px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
        <span
          style={{
            fontSize: "clamp(6px, 0.85vh, 10px)",
            color: isCurrent ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
            fontWeight: 600,
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          {startTime}{endTime ? `–${endTime}` : ""}
        </span>
      </div>

      {/* Team name */}
      <div
        style={{
          fontSize: "clamp(7px, 0.95vh, 12px)",
          fontWeight: isCurrent ? 700 : 500,
          color: isCurrent ? "#fff" : "rgba(255,255,255,0.55)",
          marginTop: "1%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.teamDisplayName ?? event.displayTitle}
      </div>

      {/* Dressing room */}
      {primaryDr && (
        <div
          style={{
            fontSize: "clamp(5px, 0.7vh, 9px)",
            color: "rgba(255,255,255,0.35)",
            marginTop: "1%",
          }}
        >
          {primaryDr.displayLabel}
        </div>
      )}
    </div>
  );
}

// ── FacilityMarker ────────────────────────────────────────────────────────────

function FacilityMarker({ marker }: { marker: MarkerElement }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: `${marker.rect.x * 100}%`,
        top: `${marker.rect.y * 100}%`,
        width: `${marker.rect.width * 100}%`,
        height: `${marker.rect.height * 100}%`,
        transform: marker.rect.rotation ? `rotate(${marker.rect.rotation}deg)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "rgba(10,16,30,0.82)",
          borderRadius: 6,
          padding: "2px 6px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "1px solid rgba(255,255,255,0.12)",
          maxWidth: "100%",
        }}
      >
        <span style={{ fontSize: "clamp(8px, 1.2vh, 16px)" }}>
          {MARKER_ICONS[marker.markerType]}
        </span>
        {marker.label && (
          <span
            style={{
              fontSize: "clamp(5px, 0.7vh, 9px)",
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {marker.label}
          </span>
        )}
        {marker.secondaryText && (
          <span
            style={{
              fontSize: "clamp(4px, 0.6vh, 8px)",
              color: "rgba(255,255,255,0.4)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {marker.secondaryText}
          </span>
        )}
      </div>
    </div>
  );
}

// ── DuBistHierMarker ──────────────────────────────────────────────────────────

function DuBistHierMarker({ marker }: { marker: MarkerElement }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: `${marker.rect.x * 100}%`,
        top: `${marker.rect.y * 100}%`,
        width: `${marker.rect.width * 100}%`,
        height: `${marker.rect.height * 100}%`,
        transform: marker.rect.rotation ? `rotate(${marker.rect.rotation}deg)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(234,179,8,0.15)",
          borderRadius: 8,
          padding: "4px 10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "2px solid rgba(234,179,8,0.7)",
          gap: 2,
        }}
      >
        <span style={{ fontSize: "clamp(10px, 1.8vh, 22px)" }}>📍</span>
        <span
          style={{
            fontSize: "clamp(6px, 0.9vh, 11px)",
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#eab308",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          DU BIST HIER
        </span>
      </div>
    </div>
  );
}

// ── AnlageInfoRow ─────────────────────────────────────────────────────────────

function AnlageInfoRow({
  icon,
  label,
  occupied,
}: {
  icon?: string;
  label: string;
  occupied?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6vw",
        padding: "0.35vh 0.6vw",
        borderRadius: 5,
        background: occupied ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${occupied ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
        overflow: "hidden",
      }}
    >
      {icon && <span style={{ fontSize: "clamp(8px, 1.1vh, 13px)", flexShrink: 0 }}>{icon}</span>}
      <span
        style={{
          fontSize: "clamp(7px, 0.9vh, 11px)",
          color: occupied ? "rgba(74,222,128,0.85)" : "rgba(255,255,255,0.55)",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {occupied && (
        <span
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#4ade80",
          }}
        />
      )}
    </div>
  );
}

// ── ActivityRailRow ───────────────────────────────────────────────────────────

function ActivityRailRow({
  event,
  tz,
  isCurrent,
}: {
  event: PitchEventSummary;
  tz: string;
  isCurrent: boolean;
}): ReactElement {
  const startTime = fmtTime(event.startAt, tz);
  const endTime = event.endAt ? fmtTime(event.endAt, tz) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.8vw",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: "clamp(7px, 0.95vh, 11px)",
          fontWeight: 600,
          color: isCurrent ? "#fff" : "rgba(255,255,255,0.5)",
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {startTime}{endTime ? `–${endTime}` : ""}
      </span>
      <span
        style={{
          fontSize: "clamp(7px, 0.95vh, 11px)",
          color: isCurrent ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {event.teamDisplayName ?? event.displayTitle}
      </span>
      <span
        style={{
          fontSize: "clamp(6px, 0.8vh, 10px)",
          color: "rgba(255,255,255,0.3)",
          flexShrink: 0,
        }}
      >
        {event.dressingRooms[0]?.displayLabel ?? ""}
      </span>
    </div>
  );
}
