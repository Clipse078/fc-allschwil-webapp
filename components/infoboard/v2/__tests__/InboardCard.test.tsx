/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/v2/__tests__/InboardCard.test.tsx
 *
 * INFOBOARD-OVERVIEW-01 — overview card uses live route previews.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InboardCard } from "../InboardCard";
import type { InfoboardListItem } from "@/lib/infoboard/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../InboardRoutePreview", () => ({
  InboardRoutePreview: ({ route, title }: { route: string; title: string }) => (
    <div data-testid="route-preview-mock" data-route={route} data-title={title} />
  ),
}));

const BASE_BOARD: InfoboardListItem = {
  id: "board-1",
  tenantId: "tenant-fca",
  name: "Tagesübersicht",
  slug: "screen-1",
  status: "ACTIVE",
  templateType: "TAGESUEBERSICHT",
  displayTheme: null,
  headerSubtitleEnabled: true,
  announcementEnabled: false,
  sortOrder: 0,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  anlageplanJson: null,
  anlageplanBackgroundUrl: null,
};

const noopAsync = async () => {};

describe("InboardCard — INFOBOARD-OVERVIEW-01", () => {
  it("renders a live route preview for active boards", () => {
    render(
      <InboardCard
        board={BASE_BOARD}
        onDuplicate={noopAsync}
        onToggleStatus={noopAsync}
      />,
    );

    const preview = screen.getByTestId("route-preview-mock");
    expect(preview.getAttribute("data-route")).toBe("/infoboard/screen-1");
    expect(screen.queryByTestId("inboard-mini-preview")).toBeNull();
    expect(screen.queryByTestId("anlageplan-config-preview")).toBeNull();
  });

  it("renders inactive placeholder instead of live preview for non-active boards", () => {
    render(
      <InboardCard
        board={{ ...BASE_BOARD, status: "DRAFT" }}
        onDuplicate={noopAsync}
        onToggleStatus={noopAsync}
      />,
    );

    expect(screen.getByTestId("inboard-inactive-preview")).toBeTruthy();
    expect(screen.queryByTestId("route-preview-mock")).toBeNull();
  });

  it("shows board metadata and actions below the preview", () => {
    render(
      <InboardCard
        board={BASE_BOARD}
        onDuplicate={noopAsync}
        onToggleStatus={noopAsync}
      />,
    );

    expect(screen.getByRole("heading", { name: "Tagesübersicht" })).toBeTruthy();
    expect(screen.getByText("Tagesübersicht", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Aktiv")).toBeTruthy();
    expect(screen.getByText("/infoboard/screen-1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Öffnen" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bearbeiten" })).toBeTruthy();
  });

  it("uses the canonical route for Anlagenübersicht boards", () => {
    render(
      <InboardCard
        board={{
          ...BASE_BOARD,
          id: "board-2",
          name: "Anlagenübersicht",
          slug: "screen-2",
          templateType: "ANLAGENUEBERSICHT",
        }}
        onDuplicate={noopAsync}
        onToggleStatus={noopAsync}
      />,
    );

    expect(screen.getByTestId("route-preview-mock").getAttribute("data-route")).toBe(
      "/infoboard/screen-2",
    );
    expect(screen.getByText("Anlagenübersicht", { selector: "p" })).toBeTruthy();
  });
});
