/**
 * app/infoboard/preview/screen-1-1event/page.tsx
 *
 * PREVIEW-ONLY: Screen 1 with 1-event hero card layout.
 * Demonstrates the large hero card density for a single current event.
 */

import type { Metadata } from "next";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE_1EVENT,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 1 Preview · 1 Event · Infoboard",
};

export default function InfoboardScreen1Preview1EventPage() {
  return (
    <InfoboardScreen1
      feed={PREVIEW_FIXTURE_1EVENT}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
    />
  );
}
