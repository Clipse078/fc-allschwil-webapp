/**
 * app/infoboard/preview/screen-1/page.tsx
 *
 * PREVIEW-ONLY isolated page for Infoboard Screen 1 visual prototype.
 *
 * Renders the InfoboardScreen1 component with:
 *   - The deterministic 5-row preview fixture (PP-02B-H target scenario)
 *   - Tournament participant allocations for the Sommer-Cup Junioren E row
 *   - Verified existing logo assets
 *   - Fixed current-time (17:35 Zurich; evt-2 at 18:00 shows ALS NÄCHSTES)
 *   - Tenant announcement matching the target image
 *
 * Optional `?theme=dark|light` query param (INFOBOARD-INTEGRATION-01B):
 * lets a reviewer manually verify both display themes against the same
 * deterministic fixture. Defaults to "dark" when absent/invalid — this is a
 * preview-only convenience, not the persisted tenant preference used by the
 * production route.
 *
 * Constraints:
 *   - No fetch, no API calls, no database access, no authentication change.
 *   - Production /infoboard route is not modified.
 *   - This page must not be used as a production kiosk route.
 *   - No layout-breaking explanatory text around the board.
 */

import type { Metadata } from "next";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  resolveInfoboardDisplayTheme,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_ANNOUNCEMENT,
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 1 Preview · Infoboard",
};

type PreviewPageProps = {
  searchParams?: Promise<{ theme?: string }>;
};

export default async function InfoboardScreen1PreviewPage({
  searchParams,
}: PreviewPageProps) {
  const params = (await searchParams) ?? {};
  const theme: InfoboardDisplayTheme = resolveInfoboardDisplayTheme(params.theme);

  return (
    <InfoboardScreen1
      feed={PREVIEW_FIXTURE}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      announcement={PREVIEW_ANNOUNCEMENT}
      eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      theme={theme}
    />
  );
}
