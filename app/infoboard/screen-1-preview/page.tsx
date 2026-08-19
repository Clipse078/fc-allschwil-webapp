/**
 * app/infoboard/screen-1-preview/page.tsx
 *
 * PREVIEW-ONLY — Screen 1 acceptance harness.
 *
 * Route: /infoboard/screen-1-preview?scenario=<id>
 *
 * Available scenarios:
 *   one-match     — single match, sparse mode
 *   one-training  — single training, sparse mode
 *   two-matches   — two matches, sparse mode
 *   dense         — mixed events, fill mode
 *   long-text     — long team/pitch/room names
 *   alignment     — Match + Turnier side-by-side alignment check
 *
 * Architecture:
 *   - Server component that reads searchParams.scenario
 *   - Renders real InfoboardScreen1 inside a 1920×1080 TV frame
 *   - Shows a scenario selector panel outside the TV frame
 *   - Shows a layout debug readout outside the TV frame
 *   - All scenario data is deterministic — no DB, no fetch
 *
 * NOT available in production (notFound() unless NODE_ENV=development or STAGE).
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { TvScaleWrapper } from "@/components/infoboard/preview/TvScaleWrapper";
import {
  ACCEPTANCE_SCENARIOS_S1,
  DEFAULT_SCENARIO_S1,
  LAYOUT_MODE_SPARSE_THRESHOLD,
  getAcceptanceFixtureS1,
  computeTotalDemandS1,
  layoutModeS1,
  ACCEPTANCE_CURRENT_TIME_ISO_S1,
} from "@/components/infoboard/screen1/screen1-acceptance-fixtures";

export const metadata: Metadata = {
  title: "Screen 1 — Acceptance Preview",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ scenario?: string }>;
};

export default async function InfoboardScreen1PreviewPage({
  searchParams,
}: PageProps) {
  const previewAllowed =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_GIT_COMMIT_REF === "STAGE";

  if (!previewAllowed) {
    notFound();
  }

  const params = await searchParams;
  const scenarioId = params.scenario ?? DEFAULT_SCENARIO_S1;

  const { feed, eventPresentation } = getAcceptanceFixtureS1(scenarioId);

  // Compute demand values for the debug readout.
  // These use the real production demand functions — no duplication.
  const totalDemand = computeTotalDemandS1(feed, eventPresentation);
  const layoutMode = layoutModeS1(totalDemand);

  const currentScenario =
    ACCEPTANCE_SCENARIOS_S1.find((s) => s.id === scenarioId) ??
    ACCEPTANCE_SCENARIOS_S1[0];

  const weather = {
    isAvailable: true as const,
    temperatureC: 22,
    conditionCode: 2,
    conditionLabel: "Teilweise bewölkt",
    windKmh: 6,
    precipitationProbability: null,
    observedAt: "2026-09-12T15:30:00.000Z",
  };

  return (
    <div
      data-testid="screen1-preview-root"
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
          {ACCEPTANCE_SCENARIOS_S1.map((scenario) => {
            const isActive = scenario.id === scenarioId;
            return (
              <Link
                key={scenario.id}
                href={`/infoboard/screen-1-preview?scenario=${scenario.id}`}
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
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {scenario.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── LAYOUT DEBUG READOUT (outside TV frame) ─────────────────────── */}
      <div
        data-testid="layout-debug-readout"
        style={{
          fontSize: "0.7rem",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          color: "rgba(255,255,255,0.45)",
          padding: "0.3rem 0.75rem",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.06)",
          whiteSpace: "nowrap",
          overflow: "auto",
        }}
      >
        <span>
          Scenario: <strong style={{ color: "#93c5fd" }}>{currentScenario?.label ?? scenarioId}</strong>
          {" | "}
          Demand: <strong style={{ color: "#fde68a" }}>{totalDemand.toFixed(2)}</strong>
          {" | "}
          Mode: <strong style={{ color: layoutMode === "fill" ? "#86efac" : "#fca5a5" }}>{layoutMode}</strong>
          {" | "}
          Threshold: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{LAYOUT_MODE_SPARSE_THRESHOLD.toFixed(2)}</strong>
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
          <InfoboardScreen1
            weather={weather}
            feed={feed}
            eventPresentation={eventPresentation}
            currentTimeIso={ACCEPTANCE_CURRENT_TIME_ISO_S1}
            branding={{
              clubLogoSrc: "/images/logos/fc-allschwil.png",
              productLogoSrc: "/images/branding/sportclubevo_logo.png",
            }}
            announcement={{
              enabled: true,
              text: "WIR LEBEN FUSSBALL · FAIRNESS · RESPEKT · LEIDENSCHAFT · FC ALLSCHWIL · WILLKOMMEN AUF DER SPORTANLAGE",
              backgroundColor: null,
              textColor: null,
            }}
          />
        </TvScaleWrapper>
      </div>
    </div>
  );
}
