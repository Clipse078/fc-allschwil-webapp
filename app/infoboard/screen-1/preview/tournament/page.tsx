/**
 * app/infoboard/screen-1/preview/tournament/page.tsx
 *
 * PREVIEW-ONLY visual acceptance route for the four-participant tournament
 * presentation (INFOBOARD-LOGO-02). Not available in production deployments.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { Screen1AcceptancePreviewNav } from "@/components/infoboard/screen1/Screen1AcceptancePreviewNav";
import {
  PREVIEW_FIXTURE_TOURNAMENT_4TEAM,
  PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 Tournament Acceptance Preview · Infoboard",
};

export default function Screen1TournamentAcceptancePreviewPage() {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  return (
    <>
      <Screen1AcceptancePreviewNav active="tournament" />
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={PREVIEW_FIXTURE_TOURNAMENT_4TEAM.generatedAt}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />
    </>
  );
}
