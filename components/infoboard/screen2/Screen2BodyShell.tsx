/**
 * components/infoboard/screen2/Screen2BodyShell.tsx
 *
 * INFOBOARD-TRANSPORT-01B — shared Screen 2 body composition:
 * LEFT SPONSOR | CENTER CONTENT | RIGHT SPONSOR
 *
 * Header and footer remain outside this shell. The center slot is owned
 * separately so static map + ÖV content can evolve without touching sponsor
 * rails or the shared kiosk shell.
 */

import type { ReactElement, ReactNode, CSSProperties } from "react";
import { SCREEN2_BODY_SHELL_CSS_VARS } from "@/lib/infoboard/screen2-body-shell-sizing";
import { Screen2SponsorRail } from "./Screen2SponsorRail";
import styles from "./Screen2BodyShell.module.css";

export type Screen2BodyShellProps = {
  center: ReactNode;
};

export function Screen2BodyShell({ center }: Screen2BodyShellProps): ReactElement {
  return (
    <div
      className={styles.shell}
      data-testid="screen2-body-shell"
      style={SCREEN2_BODY_SHELL_CSS_VARS as CSSProperties}
    >
      <Screen2SponsorRail side="left" />
      <div className={styles.center} data-testid="screen2-center-content">
        {center}
      </div>
      <Screen2SponsorRail side="right" />
    </div>
  );
}
