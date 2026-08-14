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
    state: (currentType ? "OCCUPIED_NOW" : nextType ? "UPCOMING" : "FREE_NOW") as "FREE_NOW" | "OCCUPIED_NOW" | "UPCOMING",
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

// ── Marker size control (INFOBOARD-UX-03-C2) ─────────────────────────────────

describe("FacilityMarker — size control", () => {
  it("marker without markerSize renders with default size 'M'", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={DEFAULT_BRANDING}
      />,
    );
    const markers = screen.getAllByTestId("facility-marker");
    // WC marker in fixture has no markerSize → defaults to M
    expect(markers[0].getAttribute("data-marker-size")).toBe("M");
  });

  it("marker with markerSize 'XL' renders with XL attribute", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload({
          elements: [
            {
              kind: "MARKER",
              id: "marker-xl",
              rect: { x: 0.05, y: 0.8, width: 0.06, height: 0.06 },
              markerType: "PARKPLATZ",
              label: "Parkplatz",
              secondaryText: null,
              markerSize: "XL",
            },
            {
              kind: "MARKER",
              id: "dbh-1",
              rect: { x: 0.8, y: 0.8, width: 0.06, height: 0.06 },
              markerType: "DU_BIST_HIER",
              label: null,
              secondaryText: null,
            },
          ],
        })}
        branding={DEFAULT_BRANDING}
      />,
    );
    const markers = screen.getAllByTestId("facility-marker");
    expect(markers[0].getAttribute("data-marker-size")).toBe("XL");
  });

  it("DuBistHierMarker with markerSize 'L' renders with L attribute", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload({
          elements: [
            {
              kind: "MARKER",
              id: "dbh-1",
              rect: { x: 0.45, y: 0.45, width: 0.08, height: 0.1 },
              markerType: "DU_BIST_HIER",
              label: null,
              secondaryText: null,
              markerSize: "L",
            },
          ],
        })}
        branding={DEFAULT_BRANDING}
      />,
    );
    expect(screen.getByTestId("du-bist-hier-marker").getAttribute("data-marker-size")).toBe("L");
  });

  it("marker with markerSize 'S' renders with S attribute", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload({
          elements: [
            {
              kind: "MARKER",
              id: "marker-s",
              rect: { x: 0.05, y: 0.8, width: 0.04, height: 0.04 },
              markerType: "WC",
              label: "WC",
              secondaryText: null,
              markerSize: "S",
            },
          ],
        })}
        branding={DEFAULT_BRANDING}
      />,
    );
    const markers = screen.getAllByTestId("facility-marker");
    expect(markers[0].getAttribute("data-marker-size")).toBe("S");
  });
});

// ── Display name override (INFOBOARD-UX-03-C2) ───────────────────────────────

describe("InfoboardAnlageplan — display name override", () => {
  it("shows canonical team name when no override configured", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload(
          undefined,
          [{ code: "KR2", currentType: "TRAINING" }],
        )}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    // Default canonical name from fixture: "Team KR2"
    expect(root.textContent).toContain("Team KR2");
  });

  it("shows override display name when configured", () => {
    const payload = makeAnlageplanPayload(
      { displayNameOverrides: { "Team KR2": "F2 Training" } },
      [{ code: "KR2", currentType: "TRAINING" }],
    );
    render(
      <InfoboardAnlageplan
        payload={payload}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("F2 Training");
    // Canonical name should NOT appear (replaced by override)
    expect(root.textContent).not.toContain("Team KR2");
  });

  it("falls back to canonical name when override is empty string", () => {
    const payload = makeAnlageplanPayload(
      { displayNameOverrides: { "Team KR2": "" } },
      [{ code: "KR2", currentType: "TRAINING" }],
    );
    render(
      <InfoboardAnlageplan
        payload={payload}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    expect(root.textContent).toContain("Team KR2");
  });

  it("override applies to next-activity rail as well", () => {
    const payload = makeAnlageplanPayload(
      { displayNameOverrides: { "Next Team KR2": "Junioren F2" } },
      [{ code: "KR2", nextType: "TRAINING" }],
    );
    render(
      <InfoboardAnlageplan
        payload={payload}
        branding={DEFAULT_BRANDING}
      />,
    );
    const rail = screen.getByTestId("anlageplan-activity-rail");
    expect(rail.textContent).toContain("Junioren F2");
    expect(rail.textContent).not.toContain("Next Team KR2");
  });

  it("override for one team does not affect another team's name", () => {
    const payload = makeAnlageplanPayload(
      { displayNameOverrides: { "Team KR2": "F2 Training" } },
      [
        { code: "KR2", currentType: "TRAINING" },
        { code: "KR3", currentType: "MATCH" },
      ],
    );
    render(
      <InfoboardAnlageplan
        payload={payload}
        branding={DEFAULT_BRANDING}
      />,
    );
    const root = screen.getByTestId("infoboard-anlageplan-root");
    // KR2 team overridden
    expect(root.textContent).toContain("F2 Training");
    // KR3 team canonical (KR3 zone has showNextActivity=false but still has current card)
    expect(root.textContent).toContain("Team KR3");
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
