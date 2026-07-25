/**
 * app/infoboard/screen-2/page.tsx
 *
 * Infoboard Screen 2 — Facility Orientation Screen.
 *
 * Route: /infoboard/screen-2
 *
 * LIVE DATA STATUS: PENDING
 *
 * The Screen 2 live feed builder requires a dedicated backend slice
 * (see follow-up task below). Until that slice is shipped, this route
 * renders the facility screen with live header/clock and an explicit
 * "KEINE FELDDATEN VERFÜGBAR" state in the pitch overview.
 *
 * The presentation component (InfoboardScreen2) is fully functional;
 * only the data pipeline is pending.
 *
 * REQUIRED FOLLOW-UP SLICE: "INFOBOARD-05 — Screen 2 live data"
 *   - Implement buildInfoboardScreen2Feed() in lib/publishing/infoboard/
 *   - Compose: getFacilitiesForTenant() for pitch list
 *             + Screen1 event loader for occupancy and dressing rooms
 *   - Map PitchOccupancy state from temporal grouping of events per pitch
 *   - Map DressingRoomAssignment from event.homeDressingRoom / awayDressingRoom
 *   - Implement screen2-live-service.ts (mirrors screen1-live-service pattern)
 *   - Wire sponsor data when BusinessClub API is available
 *   - No new publication rules or event-selection policy
 *   - Tenant-scoped; Europe/Zurich consistent
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - No Prisma import, no DB access in this file.
 *   - The pending state is explicit and honest: empty pitch grid is
 *     shown with an appropriate UI message (not false operational data).
 */

import type { Metadata } from "next";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import type { InfoboardScreen2Feed } from "@/lib/publishing/event-types";

export const metadata: Metadata = {
  title: "Infoboard — Screen 2",
};

export default function InfoboardScreen2Page() {
  const now = new Date();
  const currentTimeIso = now.toISOString();

  const pendingFeed: InfoboardScreen2Feed = {
    generatedAt: currentTimeIso,
    tenant: {
      id: "fc-allschwil",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    displayDate: currentTimeIso.slice(0, 10),
    isStale: false,
    facilityName: "Brüelstadion",
    // Live feed builder pending — pitches are empty, empty-state UI shown
    pitches: [],
    dressingRooms: [],
  };

  return (
    <InfoboardScreen2
      feed={pendingFeed}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={currentTimeIso}
      sponsors={[]}
    />
  );
}
