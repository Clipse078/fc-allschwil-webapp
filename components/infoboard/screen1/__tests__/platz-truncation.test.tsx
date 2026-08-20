/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/screen1/__tests__/platz-truncation.test.tsx
 *
 * INFOBOARD-FINAL-C — Focused regression tests for Screen 1 Platz truncation.
 *
 * Physical STAGE TV acceptance exposed a defect where canonical pitch
 * designations such as "KR 3 – FELD A" were truncated to "KR 3 – F…"
 * when rendered in the training group pitch zone.
 *
 * Covers:
 *   - Long pitch designations (KR 2 – FELD A/B, KR 3 – FELD A/B) are
 *     rendered in full — no ellipsis, no silent clipping
 *   - Short pitch values (STADION, KR 1) are rendered correctly
 *   - pitch-value data-testid contains the full label
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InfoboardScreen1 } from "../InfoboardScreen1";
import type { InfoboardScreen1Feed, InfoboardScreen1Event } from "@/lib/publishing/event-types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/infoboard/screen1/LiveClockScreen1", () => ({
  LiveClockScreen1: () => <span data-testid="live-clock" />,
}));
vi.mock("@/components/infoboard/screen1/AnnouncementTicker", () => ({
  AnnouncementTicker: ({ text }: { text: string }) => (
    <span data-testid="announcement-ticker">{text}</span>
  ),
}));

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTrainingEvent(
  id: string,
  pitchLabel: string | null,
): InfoboardScreen1Event {
  return {
    id,
    type: "TRAINING",
    startAt: "2024-01-01T09:00:00Z",
    endAt: "2024-01-01T10:30:00Z",
    displayTitle: "Training FC Allschwil",
    teamDisplayName: "1. Mannschaft",
    opponentDisplayName: null,
    opponentLogoUrl: null,
    organizerDisplayName: null,
    competitionLabel: null,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    seasonKey: "2024-25",
    allocation: {
      homeDressingRoomLabel: "KA 1",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
      pitchLabel,
    },
  };
}

function makeFeed(currentEvents: InfoboardScreen1Event[]): InfoboardScreen1Feed {
  return {
    generatedAt: "2024-01-01T09:00:00Z",
    displayDate: "2024-01-01",
    isStale: false,
    wochenplanVariantBadge: null,
    tenant: {
      id: "t1",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    current: currentEvents,
    next: [],
    later: [],
    isEmpty: currentEvents.length === 0,
    emptyStateReason: currentEvents.length === 0 ? "NO_EVENTS_TODAY" : null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderWithPitch(pitchLabel: string | null) {
  const feed = makeFeed([makeTrainingEvent("e1", pitchLabel)]);
  render(<InfoboardScreen1 feed={feed} currentTimeIso="2024-01-01T09:00:00Z" />);
}

describe("Screen 1 — Platz truncation fix", () => {
  it("renders 'KR 3 – FELD A' in full without truncation", () => {
    renderWithPitch("KR 3 – FELD A");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "KR 3 – FELD A")).toBe(true);
  });

  it("renders 'KR 3 – FELD B' in full without truncation", () => {
    renderWithPitch("KR 3 – FELD B");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "KR 3 – FELD B")).toBe(true);
  });

  it("renders 'KR 2 – FELD A' in full without truncation", () => {
    renderWithPitch("KR 2 – FELD A");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "KR 2 – FELD A")).toBe(true);
  });

  it("renders 'KR 2 – FELD B' in full without truncation", () => {
    renderWithPitch("KR 2 – FELD B");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "KR 2 – FELD B")).toBe(true);
  });

  it("renders short pitch 'STADION' correctly", () => {
    renderWithPitch("STADION");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "STADION")).toBe(true);
  });

  it("renders short pitch 'KR 1' correctly", () => {
    renderWithPitch("KR 1");
    const pitchValues = screen.getAllByTestId("pitch-value");
    const labels = pitchValues.map((el) => el.textContent ?? "");
    expect(labels.some((l) => l === "KR 1")).toBe(true);
  });

  it("pitch-value textContent is the full canonical label (no ellipsis)", () => {
    renderWithPitch("KR 3 – FELD A");
    const pitchValues = screen.getAllByTestId("pitch-value");
    // textContent must be the complete label, not truncated
    pitchValues.forEach((el) => {
      const text = el.textContent ?? "";
      expect(text).not.toMatch(/\.\.\.$/);
      expect(text).not.toMatch(/…$/);
      if (text.startsWith("KR 3")) {
        expect(text).toContain("FELD A");
      }
    });
  });
});
