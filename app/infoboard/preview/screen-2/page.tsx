/**
 * app/infoboard/preview/screen-2/page.tsx
 *
 * PREVIEW-ONLY isolated page for Infoboard Screen 2 visual prototype.
 *
 * Renders InfoboardScreen2 with:
 *   - Deterministic preview fixture (mixed pitch occupancy)
 *   - Placeholder sponsor data
 *   - Fixed current-time (17:35 Zurich)
 *   - Existing FC Allschwil branding assets
 *
 * Constraints:
 *   - No fetch, no API calls, no database access.
 *   - This page must not be used as a production kiosk route.
 *   - No layout-breaking text around the board.
 */

import type { Metadata } from "next";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_SPONSORS,
  PREVIEW_CURRENT_TIME_ISO_S2,
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
      sponsors={PREVIEW_SPONSORS}
    />
  );
}
