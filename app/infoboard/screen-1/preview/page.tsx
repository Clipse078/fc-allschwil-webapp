/**
 * app/infoboard/screen-1/preview/page.tsx
 *
 * PREVIEW-ONLY visual acceptance route for INFOBOARD-LOGO-02 (Screen 1).
 *
 * Renders the real InfoboardScreen1 component with the deterministic mixed
 * fixture (MATCH + TRAINING + TOURNAMENT + MATCH + TRAINING). Not available
 * in production deployments.
 *
 * Constraints:
 *   - No fetch, no API calls, no database access.
 *   - Production /infoboard/screen-1 is not modified.
 *   - Fixture imports stay out of production feed builders.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { Screen1AcceptancePreviewNav } from "@/components/infoboard/screen1/Screen1AcceptancePreviewNav";
import {
  PREVIEW_ANNOUNCEMENT,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_FIXTURE,
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 Acceptance Preview · Infoboard",
};

export default function Screen1AcceptancePreviewPage() {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  return (
    <>
      <Screen1AcceptancePreviewNav active="mixed" />
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={PREVIEW_ANNOUNCEMENT}
        eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
      />
    </>
  );
}
