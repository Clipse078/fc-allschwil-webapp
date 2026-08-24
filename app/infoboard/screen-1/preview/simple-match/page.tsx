/**
 * PREVIEW-ONLY: INFOBOARD-LAYOUT-01 Case A — one simple Match.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { Screen1AcceptancePreviewNav } from "@/components/infoboard/screen1/Screen1AcceptancePreviewNav";
import {
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_FIXTURE_SIMPLE_MATCH,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 · Simple Match · Infoboard",
};

export default function Screen1SimpleMatchPreviewPage() {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  return (
    <>
      <Screen1AcceptancePreviewNav active="simple-match" />
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_SIMPLE_MATCH}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />
    </>
  );
}
