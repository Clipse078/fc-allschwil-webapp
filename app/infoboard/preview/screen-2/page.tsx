/**
 * app/infoboard/preview/screen-2/page.tsx
 *
 * PREVIEW-ONLY isolated page for Infoboard Screen 2 visual prototype.
 *
 * Renders InfoboardScreen2 with:
 *   - Deterministic preview fixture (mixed pitch occupancy)
 *   - Sample weather data (non-production, clearly labelled in fixture)
 *   - Placeholder sponsor data
 *   - Fixed current-time (17:35 Zurich)
 *   - Existing FC Allschwil branding assets
 *
 * Constraints:
 *   - No fetch, no API calls, no database access.
 *   - No live weather API calls — uses PREVIEW_WEATHER fixture only.
 *   - This page must not be used as a production kiosk route.
 *   - No layout-breaking text around the board.
 *   - No cabin / dressing-room assignments rendered (INFOBOARD-05).
 */

import type { Metadata } from "next";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_SPONSORS,
  PREVIEW_CURRENT_TIME_ISO_S2,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 2 Preview · Infoboard",
};

export default function InfoboardScreen2PreviewPage() {
  return (
    <InfoboardScreen2
      feed={PREVIEW_FIXTURE_SCREEN2}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      weather={PREVIEW_WEATHER}
      sponsors={PREVIEW_SPONSORS}
    />
  );
}
