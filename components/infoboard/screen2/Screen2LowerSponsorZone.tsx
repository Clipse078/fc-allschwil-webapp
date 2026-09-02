/**
 * components/infoboard/screen2/Screen2LowerSponsorZone.tsx
 *
 * INFOBOARD-TRANSPORT-02-UX1 — lower center sponsor placeholder on the
 * Anlageplan slide only. Reuses the Screen 2 sponsor rail visual system.
 */

import type { ReactElement } from "react";
import { Handshake } from "lucide-react";
import styles from "./Screen2BodyShell.module.css";
import zoneStyles from "./Screen2LowerSponsorZone.module.css";

export function Screen2LowerSponsorZone(): ReactElement {
  return (
    <aside
      className={zoneStyles.zone}
      data-testid="screen2-lower-sponsor-zone"
      aria-label="Sponsorfläche unterhalb der Sportanlage"
    >
      <div className={`${styles.rail} ${zoneStyles.placeholder}`}>
        <div className={styles.railIcon} aria-hidden="true">
          <Handshake size={26} strokeWidth={1.75} />
        </div>
        <div className={styles.railHeadline}>IHRE WERBUNG</div>
        <div className={styles.railSubline}>HIER</div>
        <div className={styles.railLabel}>SPONSOR</div>
      </div>
    </aside>
  );
}
