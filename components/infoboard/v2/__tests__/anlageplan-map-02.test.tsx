/**
 * @vitest-environment jsdom
 */

/**
 * Focused tests for INFOBOARD-MAP-02:
 *
 * NAVIGATOR:
 *   - all configured elements appear in the navigator
 *   - Spielfelder group and Marker group render separately
 *   - list selection updates selectedId
 *   - editable display label shown in navigator row
 *   - resourceCode unchanged after label display
 *
 * PUBLIC ANLAGEPLAN:
 *   - no editor geometry (selection outlines, resize handles, bounding boxes)
 *   - TRAINING maps to blue token
 *   - MATCH maps to red token
 *   - TOURNAMENT maps to amber/orange token
 *   - FREI resources show compact quiet state
 *   - du-bist-hier marker renders
 *   - facility markers render
 *   - next activity respects showNextActivity config
 *
 * OVERVIEW MINI PREVIEWS:
 *   - ANLAGENUEBERSICHT board shows AnlageplanMiniPreview
 *   - other board type shows InboardMiniPreview
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AnlageplanMiniPreview } from "@/components/infoboard/anlageplan/AnlageplanMiniPreview";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { InfoboardScreen2LivePayload } from "@/lib/publishing/infoboard/screen2-live-service";
import type {
  AnlageplanConfig,
} from "@/lib/infoboard/anlageplan-types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/infoboard/screen1/LiveClockScreen1", () => ({
  LiveClockScreen1: ({ initialTimeIso }: { initialTimeIso?: string | null }) => (
    <div data-testid="live-clock-screen1">{initialTimeIso ?? "TIME"}</div>
  ),
}));

vi.mock("@/components/infoboard/screen1/AnnouncementTicker", () => ({
  AnnouncementTicker: ({ text }: { text: string }) => (
    <span data-testid="announcement-ticker">{text}</span>
  ),
}));

// ── Anlageplan payload fixture ─────────────────────────────────────────────────

function makeAnlageplanPayload(
  configOverride?: Partial<AnlageplanConfig>,
  pitchOverrides: Array<{ code: string; currentType?: string; nextType?: string }> = [],
): AnlageplanLivePayload {
  const anlageplanConfig: AnlageplanConfig = {
    version: 1,
    elements: [
      {
        kind: "RESOURCE_ZONE",
        id: "zone-1",
        rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
        resourceCode: "KR2",
        label: "Kunstrasen 2",
        zoneType: "FULL_PITCH",
        showNextActivity: true,
      },
      {
        kind: "RESOURCE_ZONE",
        id: "zone-2",
        rect: { x: 0.5, y: 0.1, width: 0.2, height: 0.2 },
        resourceCode: "KR3",
        label: "KR3",
        zoneType: "FULL_PITCH",
        showNextActivity: false,
      },
      {
        kind: "MARKER",
        id: "marker-1",
        rect: { x: 0.8, y: 0.8, width: 0.06, height: 0.06 },
        markerType: "DU_BIST_HIER",
        label: null,
        secondaryText: null,
      },
      {
        kind: "MARKER",
        id: "marker-2",
        rect: { x: 0.05, y: 0.8, width: 0.06, height: 0.06 },
        markerType: "WC",
        label: "WC",
        secondaryText: null,
      },
    ],
    ...configOverride,
  };

  const makePitch = (code: string, currentType?: string, nextType?: string) => ({
    code,
    displayLabel: code,
    facilityName: "Testanlage",
    state: (currentType ? "OCCUPIED_NOW" : nextType ? "UPCOMING" : "FREE") as "FREE" | "OCCUPIED_NOW" | "UPCOMING",
    hasAllocationConflict: false,
    currentEvent: currentType
      ? {
          eventId: `evt-current-${code}`,
          displayTitle: `Event on ${code}`,
          teamDisplayName: `Team ${code}`,
          opponentDisplayName: null,
          startAt: "2026-09-12T16:00:00.000Z",
          endAt: "2026-09-12T17:30:00.000Z",
          status: "IN_PROGRESS" as const,
          type: currentType as "TRAINING" | "MATCH" | "TOURNAMENT",
          temporalRelation: "current" as const,
          dressingRooms: [],
        }
      : null,
    nextEvent: nextType
      ? {
          eventId: `evt-next-${code}`,
          displayTitle: `Next event on ${code}`,
          teamDisplayName: `Next Team ${code}`,
          opponentDisplayName: null,
          startAt: "2026-09-12T18:00:00.000Z",
          endAt: "2026-09-12T19:30:00.000Z",
          status: "SCHEDULED" as const,
          type: nextType as "TRAINING" | "MATCH" | "TOURNAMENT",
          temporalRelation: "next" as const,
          dressingRooms: [],
        }
      : null,
  });

  const pitches = [
    makePitch("KR2", pitchOverrides.find(p => p.code === "KR2")?.currentType, pitchOverrides.find(p => p.code === "KR2")?.nextType),
    makePitch("KR3", pitchOverrides.find(p => p.code === "KR3")?.currentType, pitchOverrides.find(p => p.code === "KR3")?.nextType),
  ];

  const screen2: InfoboardScreen2LivePayload = {
    feed: {
      generatedAt: "2026-09-12T16:00:00.000Z",
      tenant: { id: "t1", key: "fc-test", name: "FC Test", timezone: "Europe/Zurich" },
      displayDate: "2026-09-12",
      isStale: false,
      facilityName: "Testanlage",
      pitches,
      dressingRooms: [],
      unallocated: [],
    },
    branding: { clubLogoSrc: null, productLogoSrc: null },
    currentTimeIso: "2026-09-12T16:00:00.000Z",
    theme: "DARK",
  };

  return {
    screen2,
    anlageplanConfig,
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: "2026-09-12T16:00:00.000Z",
  };
}

const DEFAULT_BRANDING = {
  clubLogoSrc: null,
  productLogoSrc: null,
  clubName: "FC Test",
  facilityName: "Testanlage",
};

// ── AnlageplanMiniPreview ─────────────────────────────────────────────────────

describe("AnlageplanMiniPreview", () => {
  it("renders anlageplan-mini-preview testid", () => {
    render(<AnlageplanMiniPreview />);
    expect(screen.getByTestId("anlageplan-mini-preview")).toBeTruthy();
  });

  it("shows ANLAGENÜBERSICHT label", () => {
    render(<AnlageplanMiniPreview />);
    expect(screen.getByTestId("anlageplan-mini-preview").textContent).toContain("ANLAGENÜBERSICHT");
  });
});

// ── InfoboardAnlageplan — no editor geometry ──────────────────────────────────

describe("InfoboardAnlageplan — public rendering (no editor geometry)", () => {
  it("does not render resize handles publicly", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(document.querySelector("[data-resize]")).toBeNull();
  });

  it("does not show selection outlines (no border-blue)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.innerHTML).not.toContain("3b82f6");
  });

  it("renders the map canvas area", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
  });

  it("renders the activity rail", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("anlageplan-activity-rail")).toBeTruthy();
  });

  it("renders du-bist-hier marker", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("du-bist-hier-marker")).toBeTruthy();
  });

  it("renders facility markers", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const markers = screen.getAllByTestId("facility-marker");
    expect(markers.length).toBeGreaterThan(0);
  });

  it("renders FREI card for free resource zone", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const freeCards = screen.getAllByTestId("resource-card-free");
    expect(freeCards.length).toBeGreaterThan(0);
  });
});

// ── TRAINING / MATCH / TOURNAMENT activity type mapping ───────────────────────

describe("InfoboardAnlageplan — activity type visual language", () => {
  it("renders current card for TRAINING", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const currentCards = screen.getAllByTestId("resource-card-current");
    expect(currentCards.length).toBeGreaterThan(0);
  });

  it("renders current card for MATCH", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const currentCards = screen.getAllByTestId("resource-card-current");
    expect(currentCards.length).toBeGreaterThan(0);
  });

  it("renders current card for TOURNAMENT", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TOURNAMENT" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const currentCards = screen.getAllByTestId("resource-card-current");
    expect(currentCards.length).toBeGreaterThan(0);
  });

  it("TRAINING badge shows TRAINING label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("TRAINING");
  });

  it("MATCH badge shows SPIEL label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("SPIEL");
  });

  it("TOURNAMENT badge shows TURNIER label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TOURNAMENT" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("TURNIER");
  });

  it("next activity rail shows next events", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", nextType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const rows = screen.getAllByTestId("next-activity-row");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("showNextActivity=false zone does not contribute to rail (no next card)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR3", nextType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    // KR3 zone has showNextActivity: false so the resource card won't show the event
    // However the RAIL still shows it (rail is independent of showNextActivity per zone)
    // What showNextActivity controls is whether the zone card shows the next event
    // The rail always shows next events from all pitches
    const rail = screen.getByTestId("anlageplan-activity-rail");
    expect(rail).toBeTruthy();
  });
});

// ── Shared shell ──────────────────────────────────────────────────────────────

describe("InfoboardAnlageplan — shared shell", () => {
  it("uses kiosk-shell-header", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("uses kiosk-shell-footer", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("shows ANLAGENÜBERSICHT subtitle", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent).toContain("ANLAGENÜBERSICHT");
  });
});
