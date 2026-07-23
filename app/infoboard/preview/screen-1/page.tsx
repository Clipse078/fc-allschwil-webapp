/**
 * app/infoboard/preview/screen-1/page.tsx
 *
 * PREVIEW-ONLY isolated page for Infoboard Screen 1 visual prototype.
 *
 * Renders the InfoboardScreen1 component with the deterministic preview
 * fixture and verified existing logo assets.
 *
 * Constraints:
 *   - No fetch, no API calls, no database access, no authentication change.
 *   - Production /infoboard route is not modified.
 *   - This page must not be used as a production kiosk route.
 *   - No layout-breaking explanatory text around the board.
 */

import type { Metadata } from "next";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { PREVIEW_FIXTURE } from "@/components/infoboard/screen1/screen1-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 1 Preview · Infoboard",
};

export default function InfoboardScreen1PreviewPage() {
  return (
    <InfoboardScreen1
      feed={PREVIEW_FIXTURE}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
    />
  );
}
