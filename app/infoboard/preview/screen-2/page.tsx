/**
 * app/infoboard/preview/screen-2/page.tsx
 *
 * PREVIEW-ONLY isolated page for Infoboard Screen 2 visual prototype.
 *
 * Renders InfoboardScreen2 with:
 *   - Deterministic preview fixture (mixed pitch occupancy, dressing rooms,
 *     one unallocated activity — see screen2-preview-fixture.ts)
 *   - Sample weather data (non-production, clearly labelled in fixture),
 *     rendered compactly in the header (INFOBOARD-INTEGRATION-01C-C1)
 *   - Fixed current-time (17:35 Zurich)
 *   - Existing FC Allschwil branding assets
 *   - Optional `?theme=dark|light` query param for manual DARK/LIGHT
 *     verification (INFOBOARD-INTEGRATION-01C) — mirrors the same
 *     resolveInfoboardDisplayTheme() pipeline the production route uses.
 *
 * Constraints:
 *   - No fetch, no API calls, no database access.
 *   - No live weather API calls — uses PREVIEW_WEATHER fixture only.
 *   - This page must not be used as a production kiosk route.
 *   - No layout-breaking text around the board.
 */

import type { Metadata } from "next";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  resolveInfoboardDisplayTheme,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import {
  PREVIEW_FIXTURE_SCREEN2,
  PREVIEW_CURRENT_TIME_ISO_S2,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 2 Preview · Infoboard",
};

type PreviewPageProps = {
  searchParams?: Promise<{ theme?: string }>;
};

export default async function InfoboardScreen2PreviewPage({
  searchParams,
}: PreviewPageProps) {
  const params = (await searchParams) ?? {};
  const theme: InfoboardDisplayTheme = resolveInfoboardDisplayTheme(params.theme);

  return (
    <InfoboardScreen2
      feed={PREVIEW_FIXTURE_SCREEN2}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO_S2}
      weather={PREVIEW_WEATHER}
      theme={theme}
    />
  );
}
