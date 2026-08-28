/**
 * components/infoboard/shared/KioskShellFooter.tsx
 *
 * INFOBOARD-MAP-02 â€” Canonical shared kiosk footer.
 *
 * Used by BOTH InfoboardScreen1 and InfoboardAnlageplan â€” the source of truth
 * for the kiosk shell bottom bar.
 *
 * Behavior (matching Screen 1 canonical footer):
 *   LEFT  â€” fixed announcement icon + AnnouncementTicker when announcement active;
 *            otherwise optional board/facility label
 *   RIGHT — SportClubEvo product logo branding
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
 *   - Inline styles â€” no CSS module coupling
 *   - No new Date() without argument
 */

import type { ReactElement } from "react";
import { AnnouncementTicker } from "@/components/infoboard/screen1/AnnouncementTicker";
import { KIOSK_SHELL_CSS_VARS } from "@/lib/infoboard/kiosk-shell-sizing";

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  const layoutStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${KIOSK_SHELL_CSS_VARS["--kiosk-shell-padding-x"]}`,
    minHeight: KIOSK_SHELL_CSS_VARS["--kiosk-shell-footer-height"],
    flexShrink: 0,
    overflow: "hidden",
    gap: "16px",
    ...KIOSK_SHELL_CSS_VARS,
  };

  return (
    <footer
      data-testid={announcementEnabled ? "announcement-bar" : "kiosk-shell-footer"}
      className="bg-[#0A1828]"
      style={hasInlineStyle ? { ...footerInlineStyle, ...layoutStyle } : layoutStyle}
    >
      {/* LEFT: announcement or board label */}
      <div
        data-testid="kiosk-footer-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
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
              fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-footer-ticker-font"],
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
          gap: "8px",
          flexShrink: 0,
        }}
      >
          <img
            src="/images/branding/sportclubevo_logo_alt.png"
            alt="SportClubEvo"
            style={{
              display: "block",
              width: "auto",
              height: "auto",
              maxHeight: KIOSK_SHELL_CSS_VARS["--kiosk-shell-branding-height"],
              maxWidth: KIOSK_SHELL_CSS_VARS["--kiosk-shell-branding-width"],
              objectFit: "contain",
              marginLeft: "auto",
            }}
          />
        </div>
    </footer>
  );
}


