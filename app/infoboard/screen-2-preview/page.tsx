/**
 * app/infoboard/screen-2-preview/page.tsx
 *
 * PREVIEW-ONLY — Screen 2 / Anlageplan acceptance harness.
 *
 * Route: /infoboard/screen-2-preview?scenario=<id>
 *
 * Available scenarios:
 *   alles-frei      — STADION, KR2, KR3 all free
 *   feld-a-training — KR2 Feld A TRAINING, Feld B free
 *   feld-b-match    — KR2 Feld A free, Feld B MATCH
 *   beide-frei      — KR2 Feld A + B both free (one full free pitch)
 *   beide-belegt    — KR2 Feld A TRAINING, Feld B MATCH
 *   turnier         — KR3 TURNIER
 *   mixed-anlage    — STADION MATCH, KR2-A TRAINING, KR2-B FREI, KR3 TURNIER (default)
 *
 * Architecture:
 *   - Server component that reads searchParams.scenario
 *   - Uses entirely self-contained fixture data — no DB queries
 *   - Renders the real production InfoboardAnlageplan component
 *   - Shows a scenario selector panel outside the TV frame
 *
 * NOT available in production (notFound() unless NODE_ENV=development or STAGE).
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { TvScaleWrapper } from "@/components/infoboard/preview/TvScaleWrapper";
import {
  ACCEPTANCE_SCENARIOS_S2,
  DEFAULT_SCENARIO_S2,
  getAcceptancePayloadS2,
  ACCEPTANCE_CURRENT_TIME_ISO_S2,
} from "@/components/infoboard/screen2/screen2-acceptance-fixtures";
import { PREVIEW_WEATHER } from "@/components/infoboard/screen2/screen2-preview-fixture";

export const metadata: Metadata = {
  title: "Screen 2 — Acceptance Preview",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ scenario?: string }>;
};

function previewAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_GIT_COMMIT_REF === "STAGE"
  );
}

export default async function InfoboardScreen2PreviewPage({
  searchParams,
}: PageProps) {
  if (!previewAllowed()) {
    notFound();
  }

  const params = await searchParams;
  const scenarioId = params.scenario ?? DEFAULT_SCENARIO_S2;

  const payload = getAcceptancePayloadS2(scenarioId);

  const currentScenario =
    ACCEPTANCE_SCENARIOS_S2.find((s) => s.id === scenarioId) ??
    ACCEPTANCE_SCENARIOS_S2[0];

  return (
    <div
      data-testid="screen2-preview-root"
      style={{
        minHeight: "100dvh",
        background: "#0a0e1a",
        color: "#e8eef4",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.75rem",
      }}
    >
      {/* ── PREVIEW CONTROLS (outside TV frame) ─────────────────────────── */}
      <div
        data-testid="preview-controls"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem 1rem",
          padding: "0.5rem 0.75rem",
          background: "rgba(255,255,255,0.04)",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Scenario selector */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              marginRight: "0.25rem",
              whiteSpace: "nowrap",
            }}
          >
            SZENARIO:
          </span>
          {ACCEPTANCE_SCENARIOS_S2.map((scenario) => {
            const isActive = scenario.id === scenarioId;
            return (
              <Link
                key={scenario.id}
                href={`/infoboard/screen-2-preview?scenario=${scenario.id}`}
                data-testid={`scenario-link-${scenario.id}`}
                data-active={isActive ? "true" : "false"}
                style={{
                  display: "inline-block",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.05em",
                  textDecoration: "none",
                  background: isActive
                    ? "rgba(96, 165, 250, 0.25)"
                    : "rgba(255,255,255,0.06)",
                  color: isActive
                    ? "#93c5fd"
                    : "rgba(255,255,255,0.6)",
                  border: isActive
                    ? "1px solid rgba(96,165,250,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {scenario.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── SCENARIO DESCRIPTION ─────────────────────────────────────────── */}
      <div
        data-testid="scenario-description"
        style={{
          fontSize: "0.7rem",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          color: "rgba(255,255,255,0.45)",
          padding: "0.3rem 0.75rem",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span>
          Scenario: <strong style={{ color: "#93c5fd" }}>{currentScenario?.label ?? scenarioId}</strong>
          {" · "}
          <span>{currentScenario?.description}</span>
          {" · "}
          <span style={{ color: "rgba(255,255,255,0.3)" }}>Simplified status contract: FREI · TRAINING · MATCH · TURNIER</span>
        </span>
      </div>

      {/* ── TV VIEWPORT LABEL ─────────────────────────────────────────────── */}
      <div
        data-testid="tv-viewport-label"
        style={{
          fontSize: "0.65rem",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          paddingLeft: "0.25rem",
        }}
      >
        TV viewport: 1920 × 1080 &nbsp;·&nbsp; Aspect: 16:9
      </div>

      {/* ── 1920×1080 TV FRAME ────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: "8px",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      >
        <TvScaleWrapper>
          <InfoboardAnlageplan
            payload={payload}
            weather={PREVIEW_WEATHER}
            richEventCards={false}
            branding={{
              clubLogoSrc: "/images/logos/fc-allschwil.png",
              productLogoSrc: "/images/branding/sportclubevo_logo.png",
              clubName: "FC ALLSCHWIL",
              facilityName: "SPORTANLAGE IM BRÜEL",
            }}
          />
        </TvScaleWrapper>
      </div>
    </div>
  );
}
