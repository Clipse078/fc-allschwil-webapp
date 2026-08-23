/**
 * PREVIEW-ONLY: INFOBOARD-LAYOUT-01 Case C — one small Tournament.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { Screen1AcceptancePreviewNav } from "@/components/infoboard/screen1/Screen1AcceptancePreviewNav";
import {
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_FIXTURE_SMALL_TOURNAMENT,
  PREVIEW_SMALL_TOURNAMENT_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 · Small Tournament · Infoboard",
};

export default function Screen1SmallTournamentPreviewPage() {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  return (
    <>
      <Screen1AcceptancePreviewNav active="small-tournament" />
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_SMALL_TOURNAMENT}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        eventPresentation={PREVIEW_SMALL_TOURNAMENT_EXTENSIONS}
      />
    </>
  );
}
