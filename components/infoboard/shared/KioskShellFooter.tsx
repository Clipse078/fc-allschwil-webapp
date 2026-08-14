/**
 * components/infoboard/shared/KioskShellFooter.tsx
 *
 * INFOBOARD-MAP-02 — Canonical shared kiosk footer.
 *
 * Used by BOTH InfoboardScreen1 and InfoboardAnlageplan — the source of truth
 * for the kiosk shell bottom bar.
 *
 * Behavior (matching Screen 1 canonical footer):
 *   LEFT  — fixed announcement icon + AnnouncementTicker when announcement active;
 *            otherwise optional board/facility label
 *   RIGHT — "POWERED BY SportClubEvo" product branding
 *
 * When announcement is active, the root element receives
 * data-testid="announcement-bar" (backward-compat with Screen 1 tests) and
 * any configured backgroundColor / textColor inline styles.
 *
 * Without active announcement, the root element receives
 * data-testid="kiosk-shell-footer".
 *
 * Invariants:
 *   - Server component wrapper; AnnouncementTicker is a client sub-component
 *   - Inline styles — no CSS module coupling
 *   - No new Date() without argument
 */

import type { ReactElement } from "react";
import { AnnouncementTicker } from "@/components/infoboard/screen1/AnnouncementTicker";

// ── Props ─────────────────────────────────────────────────────────────────────

export type KioskShellFooterAnnouncement = {
  enabled: boolean;
  text: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
};

export type KioskShellFooterProps = {
  productLogoSrc?: string | null;
  leftLabel?: string | null;
  announcement?: KioskShellFooterAnnouncement | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function KioskShellFooter({
  productLogoSrc,
  leftLabel,
  announcement,
}: KioskShellFooterProps): ReactElement {
  const announcementEnabled =
    announcement?.enabled === true &&
    typeof announcement?.text === "string" &&
    (announcement.text as string).trim().length > 0;

  // Inline style for custom announcement bar colors (Screen 1 compat)
  const footerInlineStyle: React.CSSProperties = {};
  if (announcementEnabled && announcement) {
    if (announcement.backgroundColor?.trim()) {
      footerInlineStyle.backgroundColor = announcement.backgroundColor;
    }
    if (announcement.textColor?.trim()) {
      footerInlineStyle.color = announcement.textColor;
    }
  }
  const hasInlineStyle = Object.keys(footerInlineStyle).length > 0;

  return (
    <footer
      data-testid={announcementEnabled ? "announcement-bar" : "kiosk-shell-footer"}
      className="bg-[#0A1828]"
      style={hasInlineStyle ? {
        ...footerInlineStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(12px, 2vw, 32px)",
        minHeight: "clamp(36px, 4.5vh, 54px)",
        flexShrink: 0,
        overflow: "hidden",
        gap: "1vw",
      } : {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(12px, 2vw, 32px)",
        minHeight: "clamp(36px, 4.5vh, 54px)",
        flexShrink: 0,
        overflow: "hidden",
        gap: "1vw",
      }}
    >
      {/* LEFT: announcement or board label */}
      <div
        data-testid="kiosk-footer-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6vw",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {announcementEnabled && announcement?.text ? (
          <>
            <span
              data-testid="announcement-icon"
              aria-hidden="true"
              style={{
                flexShrink: 0,
                color: "rgba(255,255,255,0.6)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </span>
            <AnnouncementTicker text={announcement.text} />
          </>
        ) : leftLabel ? (
          <span
            style={{
              fontSize: "clamp(0.65rem, 0.85vw, 1rem)",
              letterSpacing: "0.10em",
              color: "rgba(255,255,255,0.40)",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {leftLabel}
          </span>
        ) : null}
      </div>

      {/* RIGHT: product branding */}
      <div
        data-testid="product-branding"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5vw",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "clamp(0.55rem, 0.7vw, 0.82rem)",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.30)",
            textTransform: "uppercase",
          }}
        >
          POWERED BY
        </span>
        {productLogoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={productLogoSrc}
            alt="SportClubEvo"
            style={{
              height: "clamp(16px, 2.2vh, 28px)",
              width: "auto",
              objectFit: "contain",
              opacity: 0.7,
            }}
          />
        ) : (
          <span
            data-testid="kiosk-footer-product-fallback"
            style={{
              fontSize: "clamp(0.55rem, 0.7vw, 0.82rem)",
              color: "rgba(255,255,255,0.30)",
              fontWeight: 600,
            }}
          >
            SportClubEvo
          </span>
        )}
      </div>
    </footer>
  );
}
