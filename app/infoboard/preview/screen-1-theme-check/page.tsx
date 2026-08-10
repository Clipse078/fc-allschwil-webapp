/**
 * app/infoboard/preview/screen-1-theme-check/page.tsx
 *
 * PREVIEW-ONLY: Infoboard Screen 1 combined manual-verification scenario
 * (INFOBOARD-INTEGRATION-01B).
 *
 * Renders one training (dressing room intentionally missing — restrained
 * amber warning) plus one upcoming HOME match (fully allocated), so both
 * the Dark and Light display themes can be manually verified against a
 * single representative scenario via `?theme=dark|light`.
 *
 * Constraints:
 *   - No fetch, no API calls, no database access, no authentication change.
 *   - Production /infoboard/screen-1 route is not modified.
 *   - This page must not be used as a production kiosk route.
 */

import type { Metadata } from "next";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  resolveInfoboardDisplayTheme,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import {
  PREVIEW_FIXTURE_THEME_CHECK,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 1 Preview · Theme Check · Infoboard",
};

type PreviewPageProps = {
  searchParams?: Promise<{ theme?: string }>;
};

export default async function InfoboardScreen1ThemeCheckPreviewPage({
  searchParams,
}: PreviewPageProps) {
  const params = (await searchParams) ?? {};
  const theme: InfoboardDisplayTheme = resolveInfoboardDisplayTheme(params.theme);

  return (
    <InfoboardScreen1
      feed={PREVIEW_FIXTURE_THEME_CHECK}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      theme={theme}
    />
  );
}
