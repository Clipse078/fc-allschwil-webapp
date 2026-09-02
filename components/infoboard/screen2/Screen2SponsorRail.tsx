/**
 * components/infoboard/screen2/Screen2SponsorRail.tsx
 *
 * INFOBOARD-TRANSPORT-01B — structural sponsor placeholder rail.
 * V1 only: reserved advertising surface, no live sponsor data.
 */

import type { ReactElement } from "react";
import { Handshake } from "lucide-react";
import styles from "./Screen2BodyShell.module.css";

export type Screen2SponsorRailProps = {
  side: "left" | "right";
};

export function Screen2SponsorRail({ side }: Screen2SponsorRailProps): ReactElement {
  return (
    <aside
      className={styles.rail}
      data-testid={`screen2-sponsor-rail-${side}`}
      aria-label={side === "left" ? "Sponsorfläche links" : "Sponsorfläche rechts"}
    >
      <div className={styles.railIcon} aria-hidden="true">
        <Handshake size={26} strokeWidth={1.75} />
      </div>
      <div className={styles.railHeadline}>IHRE WERBUNG</div>
      <div className={styles.railSubline}>HIER</div>
      <div className={styles.railLabel}>SPONSOR</div>
    </aside>
  );
}
