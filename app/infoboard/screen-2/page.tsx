/**
 * app/infoboard/screen-2/page.tsx
 *
 * Infoboard Screen 2 — Facility Orientation Screen.
 *
 * Route: /infoboard/screen-2
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - Screen 2 live feed builder is pending a future backend slice.
 *   - Until the live service is wired, this page renders a static
 *     placeholder using a minimal empty feed with tenant branding.
 *   - Sponsor data is placeholder until the Business Club API is wired.
 *
 * Note:
 *   This page intentionally defers live data to a future slice.
 *   The presentation component (InfoboardScreen2) is fully functional
 *   and tested; only the data pipeline is pending.
 */

import type { Metadata } from "next";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import type { InfoboardScreen2Feed } from "@/lib/publishing/event-types";

export const metadata: Metadata = {
  title: "Infoboard — Screen 2",
};

export default function InfoboardScreen2Page() {
  const now = new Date();
  const placeholderFeed: InfoboardScreen2Feed = {
    generatedAt: now.toISOString(),
    tenant: {
      id: "placeholder",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    displayDate: now.toISOString().slice(0, 10),
    isStale: false,
    facilityName: "Brüelstadion",
    pitches: [],
    dressingRooms: [],
  };

  return (
    <InfoboardScreen2
      feed={placeholderFeed}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      sponsors={[]}
    />
  );
}
