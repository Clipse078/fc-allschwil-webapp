"use client";

/**
 * components/infoboard/anlageplan/AnlageplanMiniPreview.tsx
 *
 * INFOBOARD-MAP-02 — Compact scaled thumbnail of the Anlageplan kiosk.
 *
 * Shows a representative static preview of the ANLAGENUEBERSICHT board:
 * dark kiosk shell header + large map area + compact activity rail.
 *
 * Uses the same CSS scaling approach as InboardMiniPreview:
 * container-type: inline-size + calc(100cqi / PREVIEW_WIDTH) scale.
 */

import type { ReactElement } from "react";

const PREVIEW_WIDTH = 1920;

type AnlageplanMiniPreviewProps = {
  className?: string;
};

export function AnlageplanMiniPreview({
  className = "",
}: AnlageplanMiniPreviewProps): ReactElement {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ containerType: "inline-size" } as React.CSSProperties}
      aria-hidden="true"
      data-testid="anlageplan-mini-preview"
    >
      <div
        style={{
          width: PREVIEW_WIDTH,
          height: Math.round(PREVIEW_WIDTH / (16 / 9)),
          transformOrigin: "top left",
          transform: `scale(calc(100cqi / ${PREVIEW_WIDTH}))`,
          background: "#060B12",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            height: 90,
            background: "#0A1828",
            borderBottom: "3px solid #e87722",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {/* Club logo placeholder + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                FC ALLSCHWIL
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 3,
                }}
              >
                SPORTANLAGE IM BRÜEL
              </div>
            </div>
          </div>
          {/* Time block */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              12:45
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
              Freitag · 14. August 2026
            </div>
          </div>
        </div>

        {/* Subtitle bar */}
        <div
          style={{
            height: 44,
            background: "#0A1828",
            borderBottom: "1px solid rgba(99,135,175,0.16)",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.16em",
              color: "#6E87A0",
            }}
          >
            ANLAGENÜBERSICHT
          </span>
        </div>

        {/* Body: map + rail */}
        <div style={{ flex: 1, display: "flex", padding: "12px 20px", gap: "1vw" }}>
          {/* Map area (78%) */}
          <div
            style={{
              flex: "1 1 78%",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "#0d1520",
              position: "relative",
            }}
          >
            {/* Simulated pitch cards */}
            <div
              style={{
                position: "absolute",
                left: "8%",
                top: "12%",
                width: "38%",
                height: "55%",
                background: "rgba(74,222,128,0.06)",
                borderRadius: 8,
                border: "1px solid rgba(74,222,128,0.2)",
                padding: "8px 12px",
              }}
            >
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.08em" }}>
                HAUPTPLATZ
              </div>
              <div style={{ fontSize: 9, color: "#4ade80", marginTop: 2, fontWeight: 600 }}>
                1. MANNSCHAFT
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: "52%",
                top: "8%",
                width: "22%",
                height: "30%",
                background: "rgba(59,130,246,0.08)",
                borderRadius: 6,
                border: "1px solid rgba(59,130,246,0.3)",
                padding: "6px 10px",
              }}
            >
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                KR2 · FELD A
              </div>
              <div style={{ fontSize: 8, color: "#93c5fd", marginTop: 2 }}>
                F2 JUNIOREN
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: "52%",
                top: "46%",
                width: "22%",
                height: "30%",
                background: "rgba(59,130,246,0.05)",
                borderRadius: 6,
                border: "1px solid rgba(59,130,246,0.15)",
                padding: "6px 10px",
              }}
            >
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
                KR2 · FELD B
              </div>
            </div>
            {/* Du bist hier marker */}
            <div
              style={{
                position: "absolute",
                right: "5%",
                bottom: "15%",
                background: "rgba(234,179,8,0.14)",
                border: "2px solid rgba(234,179,8,0.7)",
                borderRadius: 6,
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12 }}>📍</span>
              <span style={{ fontSize: 7, fontWeight: 800, color: "#eab308", letterSpacing: "0.1em" }}>
                DU BIST HIER
              </span>
            </div>
          </div>

          {/* Activity rail (22%) */}
          <div
            style={{
              flex: "0 0 22%",
              maxWidth: "22%",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.35)",
                marginBottom: 2,
              }}
            >
              NÄCHSTE AKTIVITÄTEN
            </div>
            {[
              { time: "17:45", team: "E3 JUNIOREN", resource: "KR2 · Feld B", color: "#60a5fa" },
              { time: "18:30", team: "1. MANNSCHAFT", resource: "Hauptplatz", color: "#f87171" },
              { time: "19:00", team: "FF17", resource: "KR3", color: "#60a5fa" },
            ].map((item) => (
              <div
                key={item.time}
                style={{
                  padding: "6px 8px",
                  borderRadius: 5,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `2px solid ${item.color}`,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{item.time}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>
                  {item.team}
                </div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                  {item.resource}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            height: 46,
            background: "#0A1828",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.10em" }}>
            SPORTANLAGE IM BRÜEL
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            POWERED BY SportClubEvo
          </span>
        </div>
      </div>
    </div>
  );
}
