import type { ReactElement } from "react";

import type {
  PitchEventSummary,
  PitchOccupancy,
} from "@/lib/publishing/event-types";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";

type Props = {
  payload: AnlageplanLivePayload;
};

function time(
  iso: string | null | undefined,
  timezone: string,
): string {
  if (!iso) return "";

  return new Intl.DateTimeFormat("de-CH", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function range(
  event: PitchEventSummary,
  timezone: string,
): string {
  const start = time(event.startAt, timezone);
  const end = time(event.endAt, timezone);

  if (!end) return start;

  return `${start}–${end}`;
}

function eventLabel(event: PitchEventSummary): string {
  if (event.type === "MATCH") return "SPIEL";
  if (event.type === "TOURNAMENT") return "TURNIER";
  return "TRAINING";
}

function competitionLabel(
  event: PitchEventSummary,
): string | null {
  if (event.type !== "MATCH") return null;

  /*
   * Preview fixture uses representative match detail.
   * This text is deliberately preview-only.
   */
  return "MEISTERSCHAFT";
}

function nextLabel(event: PitchEventSummary): string {
  if (event.type === "MATCH") return "NÄCHSTES SPIEL";
  if (event.type === "TRAINING") return "NÄCHSTES TRAINING";
  if (event.type === "TOURNAMENT") return "NÄCHSTES TURNIER";

  return "NÄCHSTE AKTIVITÄT";
}

function accent(event: PitchEventSummary): string {
  if (event.type === "MATCH") return "#ef4444";
  if (event.type === "TOURNAMENT") return "#f59e0b";
  return "#3b82f6";
}

function tournamentTeams(
  event: PitchEventSummary,
): readonly string[] {
  /*
   * Preview-only physical-TV dataset.
   *
   * Production data modeling is NOT changed here.
   */
  if (event.type !== "TOURNAMENT") return [];

  return [
    "FC Allschwil Junioren E",
    "FC Binningen E",
    "FC Aesch E",
    "SC Dornach E",
  ];
}

function CurrentDetail({
  pitch,
  timezone,
}: {
  pitch: PitchOccupancy;
  timezone: string;
}): ReactElement {
  const current = pitch.currentEvent;

  if (!current) {
    return (
      <div
        style={{
          fontSize: "clamp(15px, 1.1vw, 23px)",
          fontWeight: 800,
          color: "#7ddc8a",
        }}
      >
        FREI
      </div>
    );
  }

  const teams = tournamentTeams(current);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.8vw",
          alignItems: "center",
          marginBottom: "0.5vh",
        }}
      >
        <div
          style={{
            color: accent(current),
            fontWeight: 900,
            fontSize: "clamp(10px, 0.72vw, 15px)",
            letterSpacing: "0.08em",
          }}
        >
          {competitionLabel(current) ?? eventLabel(current)}
        </div>

        <div
          style={{
            color: accent(current),
            fontWeight: 900,
            fontSize: "clamp(9px, 0.62vw, 13px)",
            letterSpacing: "0.06em",
          }}
        >
          {eventLabel(current)}
        </div>
      </div>

      {current.type === "MATCH" ? (
        <div>
          <div
            style={{
              fontSize: "clamp(15px, 1.28vw, 27px)",
              lineHeight: 1.08,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {current.teamDisplayName ?? current.displayTitle}
          </div>

          <div
            style={{
              margin: "0.25vh 0",
              fontSize: "clamp(10px, 0.78vw, 16px)",
              color: "#8795a8",
              fontWeight: 800,
            }}
          >
            vs.
          </div>

          <div
            style={{
              fontSize: "clamp(15px, 1.28vw, 27px)",
              lineHeight: 1.08,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {current.opponentDisplayName ?? "Gegner"}
          </div>
        </div>
      ) : current.type === "TOURNAMENT" ? (
        <div>
          <div
            style={{
              fontSize: "clamp(15px, 1.28vw, 27px)",
              lineHeight: 1.08,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {current.displayTitle}
          </div>

          {teams.length > 0 ? (
            <div
              style={{
                marginTop: "0.7vh",
                paddingTop: "0.7vh",
                borderTop:
                  "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  color: "#f59e0b",
                  fontSize: "clamp(9px, 0.62vw, 13px)",
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  marginBottom: "0.35vh",
                }}
              >
                TEILNEHMENDE TEAMS
              </div>

              {teams.map((team) => (
                <div
                  key={team}
                  style={{
                    fontSize:
                      "clamp(10px, 0.76vw, 16px)",
                    lineHeight: 1.35,
                    color: "#d8e0eb",
                  }}
                >
                  • {team}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            fontSize: "clamp(15px, 1.28vw, 27px)",
            lineHeight: 1.08,
            fontWeight: 900,
            color: "#fff",
          }}
        >
          {current.teamDisplayName ?? current.displayTitle}
        </div>
      )}

      <div
        style={{
          marginTop: "0.7vh",
          fontSize: "clamp(11px, 0.82vw, 17px)",
          color: "#abb6c5",
          fontWeight: 700,
        }}
      >
        {range(current, timezone)}
      </div>
    </>
  );
}

function NextDetail({
  event,
  pitch,
  timezone,
}: {
  event: PitchEventSummary;
  pitch: PitchOccupancy;
  timezone: string;
}): ReactElement {
  return (
    <div
      style={{
        marginTop: "0.75vh",
        paddingTop: "0.7vh",
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          color: accent(event),
          fontWeight: 900,
          fontSize: "clamp(9px, 0.62vw, 13px)",
          letterSpacing: "0.06em",
        }}
      >
        {nextLabel(event)}
      </div>

      <div
        style={{
          marginTop: "0.25vh",
          fontWeight: 800,
          color: "#f1f5f9",
          fontSize: "clamp(11px, 0.82vw, 17px)",
          lineHeight: 1.2,
        }}
      >
        {event.type === "MATCH"
          ? `${event.teamDisplayName ?? event.displayTitle} vs. ${
              event.opponentDisplayName ?? ""
            }`
          : event.teamDisplayName ?? event.displayTitle}
      </div>

      <div
        style={{
          marginTop: "0.22vh",
          fontSize: "clamp(9px, 0.67vw, 14px)",
          color: "#8e9bad",
        }}
      >
        {pitch.displayLabel ?? pitch.code} ·{" "}
        {range(event, timezone)}
      </div>
    </div>
  );
}

export function Screen2PhysicalTvPreview({
  payload,
}: Props): ReactElement {
  const timezone = payload.screen2.feed.tenant.timezone;

  const { visiblePitches } =
    groupFacilityPitches(
      payload.screen2.feed.pitches,
    );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "12px",
        width: "100%",
      }}
    >
      {visiblePitches.map((pitch) => (
        <div
          key={pitch.code}
          style={{
            background:
              "linear-gradient(180deg,#111a25,#0b1119)",
            border:
              "1px solid rgba(255,255,255,0.12)",
            borderLeft:
              pitch.currentEvent
                ? `4px solid ${accent(
                    pitch.currentEvent,
                  )}`
                : "4px solid #3c8d53",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow:
              "0 8px 22px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              color: "#e5e7eb",
              fontSize: "clamp(10px, 0.72vw, 15px)",
              fontWeight: 900,
              letterSpacing: "0.07em",
              marginBottom: "0.55vh",
            }}
          >
            {pitch.displayLabel ?? pitch.code}
          </div>

          <CurrentDetail
            pitch={pitch}
            timezone={timezone}
          />

          {pitch.nextEvent ? (
            <NextDetail
              event={pitch.nextEvent}
              pitch={pitch}
              timezone={timezone}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}