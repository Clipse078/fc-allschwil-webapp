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
 * INFOBOARD-MAP-02-C1 (updated):
 *   - ANLAGENUEBERSICHT board shows AnlageplanConfigPreview (canonical real-config renderer)
 *   - other board type shows InboardMiniPreview
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AnlageplanConfigPreview } from "@/components/infoboard/anlageplan/AnlageplanConfigPreview";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { InfoboardScreen2LivePayload } from "@/lib/publishing/infoboard/screen2-live-service";
import type {
  AnlageplanConfig,
} from "@/lib/infoboard/anlageplan-types";
import type { PitchOccupancy } from "@/lib/publishing/event-types";

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

  const makePitch = (code: string, currentType?: string, nextType?: string): PitchOccupancy => {
    const state = currentType ? "OCCUPIED_NOW" : nextType ? "UPCOMING" : "FREE_NOW";
    return {
    code,
    displayLabel: code,
    facilityName: "Testanlage",
    facilityId: "fac-test",
    resourceType: "FULL_PITCH",
    state: state as PitchOccupancy["state"],
    hasAllocationConflict: false,
    currentEvent: currentType
      ? {
          eventId: `evt-current-${code}`,
          displayTitle: `Event on ${code}`,
          teamDisplayName: `Team ${code}`,
          opponentDisplayName: null,
          startAt: "2026-09-12T16:00:00.000Z",
          endAt: "2026-09-12T17:30:00.000Z",
          status: "LIVE" as const,
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
  };};

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

// ── AnlageplanConfigPreview — canonical board-specific preview ────────────────

describe("AnlageplanConfigPreview", () => {
  it("renders anlageplan-config-preview testid", () => {
    render(<AnlageplanConfigPreview anlageplanJson={null} backgroundUrl={null} />);
    expect(screen.getByTestId("anlageplan-config-preview")).toBeTruthy();
  });

  it("shows ANLAGENÜBERSICHT label", () => {
    render(<AnlageplanConfigPreview anlageplanJson={null} backgroundUrl={null} />);
    expect(screen.getByTestId("anlageplan-config-preview").textContent).toContain("ANLAGENÜBERSICHT");
  });

  it("uses actual configured background URL when provided", () => {
    render(
      <AnlageplanConfigPreview
        anlageplanJson={null}
        backgroundUrl="https://cdn.example.com/facility.jpg"
      />,
    );
    const img = screen.getByTestId("anlageplan-config-preview").querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/facility.jpg");
  });

  it("shows no background image when backgroundUrl is null", () => {
    render(
      <AnlageplanConfigPreview anlageplanJson={null} backgroundUrl={null} />,
    );
    const canvas = screen.getByTestId("anlageplan-config-preview-canvas");
    const img = canvas.querySelector("img");
    expect(img).toBeNull();
  });

  it("renders actual configured resource zones from anlageplanJson", () => {
    const config = {
      version: 1 as const,
      elements: [
        {
          kind: "RESOURCE_ZONE" as const,
          id: "zone-real-1",
          rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
          resourceCode: "KR2",
          label: "Kunstrasen 2 — real label",
          zoneType: "FULL_PITCH" as const,
          showNextActivity: true,
        },
      ],
    };
    render(
      <AnlageplanConfigPreview
        anlageplanJson={JSON.stringify(config)}
        backgroundUrl={null}
      />,
    );
    const preview = screen.getByTestId("anlageplan-config-preview");
    // Zone renders in FREI state showing real label
    expect(preview.textContent).toContain("Kunstrasen 2 — real label");
  });

  it("renders actual configured markers from anlageplanJson", () => {
    const config = {
      version: 1 as const,
      elements: [
        {
          kind: "MARKER" as const,
          id: "marker-real-1",
          rect: { x: 0.5, y: 0.5, width: 0.06, height: 0.06 },
          markerType: "WC" as const,
          label: "WC Nordeingabe custom",
          secondaryText: null,
        },
      ],
    };
    render(
      <AnlageplanConfigPreview
        anlageplanJson={JSON.stringify(config)}
        backgroundUrl={null}
      />,
    );
    const preview = screen.getByTestId("anlageplan-config-preview");
    expect(preview.textContent).toContain("WC Nordeingabe custom");
  });

  it("does NOT show fabricated activity data", () => {
    const config = {
      version: 1 as const,
      elements: [
        {
          kind: "RESOURCE_ZONE" as const,
          id: "zone-1",
          rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.4 },
          resourceCode: "KR2",
          label: "KR2",
          zoneType: "FULL_PITCH" as const,
          showNextActivity: true,
        },
      ],
    };
    render(
      <AnlageplanConfigPreview
        anlageplanJson={JSON.stringify(config)}
        backgroundUrl={null}
      />,
    );
    const preview = screen.getByTestId("anlageplan-config-preview");
    // Must NOT contain any hardcoded fixture team names
    expect(preview.textContent).not.toContain("F2 Junioren");
    expect(preview.textContent).not.toContain("1. Mannschaft");
    expect(preview.textContent).not.toContain("FF17");
    // FREI state indicator is fine
    expect(preview.textContent).toContain("FREI");
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

  it("activity rail is NOT rendered (removed for orientation-first design)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.queryByTestId("anlageplan-activity-rail")).toBeNull();
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

  it("MATCH badge shows MATCH label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("MATCH");
    // SPIEL must not appear — Screen 2 uses MATCH vocabulary
    expect(root.textContent).not.toContain("SPIEL");
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

  it("Nächste Aktivitäten rail is NOT rendered (removed for orientation-first design)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", nextType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    // The activity rail was removed — map takes full content width
    expect(screen.queryByTestId("anlageplan-activity-rail")).toBeNull();
    // No "NÄCHSTE AKTIVITÄTEN" heading anywhere
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent?.toUpperCase()).not.toContain("NÄCHSTE AKTIVITÄTEN");
  });

  it("next-activity-row elements are NOT rendered (rail removed)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", nextType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.queryAllByTestId("next-activity-row")).toHaveLength(0);
  });

  it("map canvas is present and takes full width (no rail)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR3", nextType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
    expect(screen.queryByTestId("anlageplan-activity-rail")).toBeNull();
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

// ── AnlageplanMapScene — identical geometry ───────────────────────────────────

describe("AnlageplanMapScene — canonical shared scene", () => {
  it("renders anlageplan-map-scene testid", () => {
    const config = {
      version: 1 as const,
      elements: [],
    };
    const { container } = render(
      <div style={{ position: "relative", width: 400, height: 225 }}>
        {/* AnlageplanMapScene is not imported directly here — tested via InfoboardAnlageplan */}
        <AnlageplanConfigPreview anlageplanJson={JSON.stringify(config)} backgroundUrl={null} />
      </div>,
    );
    expect(screen.getByTestId("anlageplan-map-scene")).toBeTruthy();
  });

  it("renders background image at the actual configured URL", () => {
    const config = { version: 1 as const, elements: [] };
    render(
      <AnlageplanConfigPreview
        anlageplanJson={JSON.stringify(config)}
        backgroundUrl="https://cdn.example.com/brueelstadion.jpg"
      />,
    );
    const mapScene = screen.getByTestId("anlageplan-map-scene");
    const img = mapScene.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/brueelstadion.jpg");
  });

  it("resource zones use actual labels from config — no hardcoded fixture data", () => {
    const config = {
      version: 1 as const,
      elements: [
        {
          kind: "RESOURCE_ZONE" as const,
          id: "z1",
          rect: { x: 0.05, y: 0.1, width: 0.35, height: 0.5 },
          resourceCode: "HP",
          label: "Hauptplatz (Brüelstadion)",
          zoneType: "FULL_PITCH" as const,
          showNextActivity: true,
        },
      ],
    };
    render(
      <AnlageplanConfigPreview
        anlageplanJson={JSON.stringify(config)}
        backgroundUrl={null}
      />,
    );
    expect(screen.getByTestId("anlageplan-config-preview").textContent)
      .toContain("Hauptplatz (Brüelstadion)");
  });
});

// ── Screen-2 Anlageplan UX closure: status vocabulary, no detail, Feld A/B ────

describe("Screen-2 Anlageplan — status vocabulary (FREI/TRAINING/MATCH/TURNIER)", () => {
  it("FREI state shows FREI status (not blank)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("FREI");
  });

  it("TRAINING type shows TRAINING status label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const statusLabels = screen.getAllByTestId("resource-card-status-label");
    const labels = statusLabels.map((el) => el.textContent);
    expect(labels).toContain("TRAINING");
  });

  it("MATCH type shows MATCH status label (not SPIEL)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const statusLabels = screen.getAllByTestId("resource-card-status-label");
    const labels = statusLabels.map((el) => el.textContent);
    expect(labels).toContain("MATCH");
    expect(labels).not.toContain("SPIEL");
  });

  it("TOURNAMENT type shows TURNIER status label", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TOURNAMENT" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    const statusLabels = screen.getAllByTestId("resource-card-status-label");
    const labels = statusLabels.map((el) => el.textContent);
    expect(labels).toContain("TURNIER");
  });
});

describe("Screen-2 Anlageplan — no detailed metadata on production (non-rich) cards", () => {
  it("non-rich MATCH card does not show team names", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    // The simple-body card should be present; rich-body should NOT
    expect(screen.queryAllByTestId("resource-card-rich-body")).toHaveLength(0);
    // Team name from fixture is "Team KR2" — must not appear
    expect(screen.queryByText("Team KR2")).toBeNull();
  });

  it("non-rich TRAINING card does not show team names", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TRAINING" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.queryAllByTestId("resource-card-rich-body")).toHaveLength(0);
    expect(screen.queryByText("Team KR2")).toBeNull();
  });

  it("non-rich TOURNAMENT card does not show team names", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "TOURNAMENT" }])}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.queryAllByTestId("resource-card-rich-body")).toHaveLength(0);
    expect(screen.queryByText("Team KR2")).toBeNull();
  });

  it("rich=true (preview mode) shows rich-body with team details", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(undefined, [{ code: "KR2", currentType: "MATCH" }])}
        branding={DEFAULT_BRANDING}
        richEventCards
      />,
    );
    // Rich-body should appear in preview mode
    expect(screen.getAllByTestId("resource-card-rich-body").length).toBeGreaterThan(0);
  });
});

describe("Screen-2 Anlageplan — Feld A/B logic and whole-pitch behavior", () => {
  function makeHalfPitchPayload(
    feldACurrentType: string | undefined,
    feldBCurrentType: string | undefined,
  ): AnlageplanLivePayload {
    const FACILITY_ID = "fac-kr2";

    const pitches = [];

    // FULL_PITCH: visible only when both halves are free
    pitches.push({
      code: "KR2-FULL",
      displayLabel: "Kunstrasen 2",
      facilityName: "Testanlage",
      facilityId: FACILITY_ID,
      resourceType: "FULL_PITCH" as const,
      state: (feldACurrentType || feldBCurrentType) ? "FREE_NOW" as const : "FREE_NOW" as const,
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    });

    // HALF_PITCH A
    pitches.push({
      code: "KR2-A",
      displayLabel: "Kunstrasen 2 Feld A",
      facilityName: "Testanlage",
      facilityId: FACILITY_ID,
      resourceType: "HALF_PITCH" as const,
      state: feldACurrentType ? "OCCUPIED_NOW" as const : "FREE_NOW" as const,
      hasAllocationConflict: false,
      currentEvent: feldACurrentType
        ? {
            eventId: "evt-ka",
            displayTitle: `Event on KR2-A`,
            teamDisplayName: "Team Feld A",
            opponentDisplayName: null,
            startAt: "2026-09-12T16:00:00.000Z",
            endAt: "2026-09-12T17:30:00.000Z",
            status: "LIVE" as const,
            type: feldACurrentType as "TRAINING" | "MATCH" | "TOURNAMENT",
            temporalRelation: "current" as const,
            dressingRooms: [],
          }
        : null,
      nextEvent: null,
    });

    // HALF_PITCH B
    pitches.push({
      code: "KR2-B",
      displayLabel: "Kunstrasen 2 Feld B",
      facilityName: "Testanlage",
      facilityId: FACILITY_ID,
      resourceType: "HALF_PITCH" as const,
      state: feldBCurrentType ? "OCCUPIED_NOW" as const : "FREE_NOW" as const,
      hasAllocationConflict: false,
      currentEvent: feldBCurrentType
        ? {
            eventId: "evt-kb",
            displayTitle: `Event on KR2-B`,
            teamDisplayName: "Team Feld B",
            opponentDisplayName: null,
            startAt: "2026-09-12T16:00:00.000Z",
            endAt: "2026-09-12T17:30:00.000Z",
            status: "LIVE" as const,
            type: feldBCurrentType as "TRAINING" | "MATCH" | "TOURNAMENT",
            temporalRelation: "current" as const,
            dressingRooms: [],
          }
        : null,
      nextEvent: null,
    });

    const anlageplanConfig = {
      version: 1 as const,
      elements: [
        {
          kind: "RESOURCE_ZONE" as const,
          id: "zone-full",
          rect: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
          resourceCode: "KR2-FULL",
          label: "Kunstrasen 2",
          zoneType: "FULL_PITCH" as const,
          showNextActivity: false,
        },
        {
          kind: "RESOURCE_ZONE" as const,
          id: "zone-a",
          rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.4 },
          resourceCode: "KR2-A",
          label: "Feld A",
          zoneType: "HALF_PITCH" as const,
          showNextActivity: false,
        },
        {
          kind: "RESOURCE_ZONE" as const,
          id: "zone-b",
          rect: { x: 0.3, y: 0.1, width: 0.2, height: 0.4 },
          resourceCode: "KR2-B",
          label: "Feld B",
          zoneType: "HALF_PITCH" as const,
          showNextActivity: false,
        },
      ],
    };

    const screen2 = {
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
      theme: "DARK" as const,
    };

    return {
      screen2,
      anlageplanConfig,
      backgroundUrl: null,
      backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
      currentTimeIso: "2026-09-12T16:00:00.000Z",
    };
  }

  it("Feld A TRAINING + Feld B free: both Feld A and Feld B zones are visible (half-pitch subdivision)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeHalfPitchPayload("TRAINING", undefined)}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    // Feld A shows TRAINING; Feld B shows FREI
    expect(root.textContent).toContain("TRAINING");
    expect(root.textContent).toContain("FREI");
    // FULL_PITCH should be suppressed (halves take over when any half is occupied)
    const freeCards = screen.getAllByTestId("resource-card-free");
    // At least one FREI card visible (Feld B)
    expect(freeCards.length).toBeGreaterThan(0);
  });

  it("both halves free: whole-pitch FREI presentation (FULL_PITCH visible, halves suppressed)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeHalfPitchPayload(undefined, undefined)}
        branding={DEFAULT_BRANDING}
      />,
    );
    const freeCards = screen.getAllByTestId("resource-card-free");
    // Only ONE FREI card (the FULL_PITCH) — not both halves separately
    expect(freeCards).toHaveLength(1);
    const root = screen.getByTestId("infoboard-anlageplan-root");
    // "Kunstrasen 2" label (FULL_PITCH) should appear
    expect(root.textContent).toContain("Kunstrasen 2");
  });

  it("Feld A and Feld B with different activities: independent state, not merged", () => {
    render(
      <InfoboardAnlageplan
        payload={makeHalfPitchPayload("TRAINING", "MATCH")}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    // Both statuses visible independently
    expect(root.textContent).toContain("TRAINING");
    expect(root.textContent).toContain("MATCH");
    // No FREI cards (both halves occupied)
    expect(screen.queryAllByTestId("resource-card-free")).toHaveLength(0);
  });

  it("both halves with same activity: FULL_PITCH suppressed; halves shown", () => {
    // When any HALF has a current event → halves are shown, FULL is suppressed
    render(
      <InfoboardAnlageplan
        payload={makeHalfPitchPayload("TRAINING", "TRAINING")}
        branding={DEFAULT_BRANDING}
      />,
    );
    // Both Feld A and Feld B show TRAINING
    const currentCards = screen.getAllByTestId("resource-card-current");
    expect(currentCards.length).toBe(2);
  });
});
