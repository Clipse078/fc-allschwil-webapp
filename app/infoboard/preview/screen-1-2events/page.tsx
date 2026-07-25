/**
 * app/infoboard/preview/screen-1-2events/page.tsx
 *
 * PREVIEW-ONLY: Screen 1 with 2-event balanced card layout.
 * Demonstrates two cards: one current training + one upcoming match.
 */

import type { Metadata } from "next";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE_2EVENTS,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 1 Preview · 2 Events · Infoboard",
};

export default function InfoboardScreen1Preview2EventsPage() {
  return (
    <InfoboardScreen1
      feed={PREVIEW_FIXTURE_2EVENTS}
      branding={{
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      }}
      currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
    />
  );
}
