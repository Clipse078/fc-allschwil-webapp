/**
 * PREVIEW-ONLY: INFOBOARD-TEAMNAME-01A — explicit Infoboard team display names.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { Screen1AcceptancePreviewNav } from "@/components/infoboard/screen1/Screen1AcceptancePreviewNav";
import { PREVIEW_FIXTURE_TEAMNAME_ACCEPTANCE } from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 · Teamname Acceptance · Infoboard",
};

export default function Screen1TeamnamePreviewPage() {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  return (
    <>
      <Screen1AcceptancePreviewNav active="teamname" />
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TEAMNAME_ACCEPTANCE}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={PREVIEW_FIXTURE_TEAMNAME_ACCEPTANCE.generatedAt}
      />
    </>
  );
}
