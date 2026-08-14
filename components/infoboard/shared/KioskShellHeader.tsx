/**
 * components/infoboard/shared/KioskShellHeader.tsx
 *
 * INFOBOARD-MAP-02 — Canonical shared kiosk header.
 *
 * Used by BOTH InfoboardScreen1 and InfoboardAnlageplan — the source of truth
 * for the kiosk shell top bar.
 *
 * Structure (matches Screen 1 layout):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ LEFT (logo + name) │ CENTER (clock/date) │ RIGHT (slot) │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ [optional subtitle bar]                                 │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Data-testid parity with InfoboardScreen1 (backward-compatible):
 *   kiosk-shell-header  — the <header> element (new canonical id)
 *   kiosk-header-left   — left branding zone
 *   header-center       — center clock zone (matches Screen1 tests)
 *   alexa-safe-zone     — right zone / Alexa reserved area
 *   board-title         — subtitle bar (matches Screen1 tests)
 *
 * Invariants:
 *   - Pure server component (no "use client", no effects, no fetch)
 *   - Inline styles — no CSS module coupling
 *   - LiveClockScreen1 (PR #405 canonical clock) always used
 *   - No new Date() without argument; no implicit timezone
 *   - null / undefined never rendered as strings
 */

import type { ReactElement, ReactNode } from "react";
import { LiveClockScreen1 } from "@/components/infoboard/screen1/LiveClockScreen1";

// ── Props ─────────────────────────────────────────────────────────────────────

export type KioskShellHeaderProps = {
  clubLogoSrc?: string | null;
  clubName: string;
  /** Optional small text rendered below the club name (facility / location). */
  facilityLine?: string | null;
  /** Subtitle bar text shown below the main header row. */
  subtitle?: string | null;
  subtitleEnabled?: boolean;
  /** Current moment as UTC ISO-8601. When absent the clock is omitted. */
  initialTimeIso?: string | null;
  timezone: string;
  showTime?: boolean;
  showDate?: boolean;
  /** Static date fallback used when initialTimeIso is null. */
  staticDateFallback?: string | null;
  /**
   * Optional content placed in the RIGHT zone (Alexa-reserved zone by default).
   * When null/undefined the zone renders empty — preserving the Alexa safe area.
   */
  rightContent?: ReactNode;
};

// ── Shared constants ──────────────────────────────────────────────────────────

const HEADER_BG = "#0A1828";
const HEADER_BORDER = "3px solid #e87722";
const SUBTITLE_BORDER = "1px solid rgba(99, 135, 175, 0.16)";
const MUTED_TEXT = "#6E87A0";

// ── Component ─────────────────────────────────────────────────────────────────

export function KioskShellHeader({
  clubLogoSrc,
  clubName,
  facilityLine,
  subtitle,
  subtitleEnabled = true,
  initialTimeIso,
  timezone,
  showTime = true,
  showDate = true,
  staticDateFallback,
  rightContent,
}: KioskShellHeaderProps): ReactElement {
  const showSubtitle = subtitleEnabled === true && subtitle != null && subtitle.length > 0;

  return (
    <div data-testid="kiosk-shell-header" style={{ flexShrink: 0 }}>
      {/* ── Main header row ─────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "clamp(8px, 1.5vw, 24px)",
          padding: "0 clamp(12px, 2vw, 32px)",
          background: HEADER_BG,
          borderBottom: HEADER_BORDER,
          height: "clamp(60px, 7.5vh, 90px)",
          flexShrink: 0,
        }}
      >
        {/* LEFT: club identity */}
        <div
          data-testid="kiosk-header-left"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(8px, 1vw, 16px)",
            flexShrink: 0,
          }}
        >
          {clubLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clubLogoSrc}
              alt={`${clubName} Wappen`}
              style={{
                height: "clamp(36px, 5.5vh, 64px)",
                width: "auto",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                height: "clamp(36px, 5.5vh, 64px)",
                width: "clamp(36px, 5.5vh, 64px)",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(12px, 2vh, 22px)",
                fontWeight: 800,
                color: "rgba(255,255,255,0.55)",
                flexShrink: 0,
              }}
            >
              {clubName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              data-testid="kiosk-header-club-name"
              style={{
                fontSize: "clamp(1.1rem, 2vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "#ffffff",
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              {clubName}
            </span>
            {facilityLine && (
              <span
                style={{
                  fontSize: "clamp(0.58rem, 0.78vw, 0.88rem)",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                }}
              >
                {facilityLine}
              </span>
            )}
          </div>
        </div>

        {/* CENTER: live clock (canonical — LiveClockScreen1) */}
        <div
          data-testid="header-center"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initialTimeIso != null ? (
            <LiveClockScreen1
              initialTimeIso={initialTimeIso}
              timezone={timezone}
              showTime={showTime}
              showDate={showDate}
            />
          ) : staticDateFallback != null && showDate ? (
            <span
              style={{
                fontSize: "clamp(0.7rem, 0.9vw, 1rem)",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {staticDateFallback}
            </span>
          ) : null}
        </div>

        {/* RIGHT: optional content or empty Alexa-safe zone */}
        <div
          data-testid="alexa-safe-zone"
          aria-hidden={rightContent == null ? "true" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexShrink: 0,
            minWidth: "clamp(60px, 6vw, 120px)",
          }}
        >
          {rightContent ?? null}
        </div>
      </header>

      {/* ── Subtitle bar (optional — like Screen 1's boardTitle) ──────── */}
      {showSubtitle && (
        <div
          data-testid="board-title"
          style={{
            display: "flex",
            alignItems: "center",
            height: "clamp(28px, 3.8vh, 46px)",
            padding: "0 clamp(12px, 2vw, 32px)",
            borderBottom: SUBTITLE_BORDER,
            background: HEADER_BG,
            flexShrink: 0,
          }}
        >
          <span
            data-testid="board-title-text"
            style={{
              fontSize: "clamp(0.78rem, 1.0vw, 1.2rem)",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: MUTED_TEXT,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
