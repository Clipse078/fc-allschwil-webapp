/**
 * Wednesday 26.08.2026 — Screen 1 time-travel acceptance preview.
 *
 * Deterministic preview URLs (Europe/Zurich local times via `at` query param):
 *   /infoboard/screen-1/preview/wednesday-2026-08-26?at=15:45
 *   /infoboard/screen-1/preview/wednesday-2026-08-26?at=17:15
 *   /infoboard/screen-1/preview/wednesday-2026-08-26?at=18:45
 *   /infoboard/screen-1/preview/wednesday-2026-08-26?at=19:45
 *   /infoboard/screen-1/preview/wednesday-2026-08-26?at=20:15
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
  WEDNESDAY_2026_08_26_PREVIEW_TIMES,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

export const metadata: Metadata = {
  title: "Screen 1 Wednesday 26.08.2026 Preview · Infoboard",
};

type PageProps = {
  searchParams?: Promise<{ at?: string }>;
};

export default async function Wednesday20260826PreviewPage({
  searchParams,
}: PageProps) {
  if (!isScreen1AcceptancePreviewAllowed()) {
    notFound();
  }

  const params = (await searchParams) ?? {};
  const at = params.at ?? "15:45";
  const currentTimeIso = resolveWednesdayPreviewCurrentTimeIso(at);
  const feed = buildWednesday20260826Feed(currentTimeIso);

  return (
    <>
      <nav
        aria-label="Wednesday preview times"
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 9999,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          maxWidth: 520,
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        {Object.keys(WEDNESDAY_2026_08_26_PREVIEW_TIMES).map((timeKey) => (
          <Link
            key={timeKey}
            href={`/infoboard/screen-1/preview/wednesday-2026-08-26?at=${timeKey}`}
            aria-current={timeKey === at ? "page" : undefined}
          >
            {timeKey}
          </Link>
        ))}
      </nav>

      <InfoboardScreen1
        feed={feed}
        branding={{
          clubLogoSrc: "/images/logos/fc-allschwil.png",
          productLogoSrc: "/images/branding/sportclubevo_logo.png",
        }}
        currentTimeIso={currentTimeIso}
      />
    </>
  );
}
