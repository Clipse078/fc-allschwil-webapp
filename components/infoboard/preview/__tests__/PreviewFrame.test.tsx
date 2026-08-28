/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-SCREEN1-STUDIO-02B — PreviewFrame selected-card page retention.
 */

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Screen1StudioCardRef } from "@/components/infoboard/studio/Screen1Studio";

const mocks = vi.hoisted(() => ({
  onPaginationStructureChange: vi.fn(),
  onPageCountChange: vi.fn(),
  onPageChange: vi.fn(),
}));

vi.mock("@/components/infoboard/screen1/InfoboardScreen1", () => ({
  InfoboardScreen1: ({
    previewPagination,
  }: {
    previewPagination?: {
      activePage?: number;
      onPaginationStructureChange?: (
        pages: readonly (readonly Screen1StudioCardRef[])[],
      ) => void;
      onPageCountChange?: (count: number) => void;
      onPageChange?: (page: number) => void;
    };
  }) => {
    mocks.onPaginationStructureChange.mockImplementation(
      previewPagination?.onPaginationStructureChange,
    );
    mocks.onPageCountChange.mockImplementation(
      previewPagination?.onPageCountChange,
    );
    mocks.onPageChange.mockImplementation(previewPagination?.onPageChange);
    return (
      <div data-testid="screen1-preview" data-active-page={previewPagination?.activePage} />
    );
  },
}));

vi.mock("@/components/infoboard/shared/PhysicalInfoboardViewport", () => ({
  PhysicalInfoboardViewport: ({ children }: { children: React.ReactNode }) => children,
}));

const pageOne: Screen1StudioCardRef[] = [
  { key: "a", label: "A", kind: "event" },
  { key: "b", label: "B", kind: "event" },
];
const pageTwo: Screen1StudioCardRef[] = [
  { key: "c", label: "C", kind: "event" },
];

async function renderPreviewFrame() {
  const { PreviewFrameScreen1 } = await import("../PreviewFrame");
  return render(
    <PreviewFrameScreen1
      autoRotate={false}
      tenant={{ id: "tenant", key: "tenant", name: "Tenant", timezone: "Europe/Zurich" }}
      feed={{ isEmpty: false, emptyStateReason: null, displayDate: "2026-08-27", events: [] }}
      branding={null}
      currentTimeIso="2026-08-27T18:00:00.000Z"
      announcement={null}
      eventPresentation={[]}
      theme="DARK"
      headerConfig={null}
      presentation={null}
      weather={null}
      studio={{ cardOverrides: {} }}
    />,
  );
}

describe("PreviewFrameScreen1 page retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("location", { ...window.location, origin: "http://localhost" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not reset to page 1 when studio overrides change for a selected page-2 card", async () => {
    const view = await renderPreviewFrame();

    act(() => {
      mocks.onPageCountChange(2);
      mocks.onPaginationStructureChange([pageOne, pageTwo]);
    });
    act(() => {
      mocks.onPageChange(1);
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "http://localhost",
          data: {
            source: "infoboard-preview-studio",
            type: "SET_STUDIO",
            studio: { cardOverrides: { c: { teamFontSize: "SMALL" } } },
            selectedKey: "c",
          },
        }),
      );
    });

    act(() => {
      mocks.onPaginationStructureChange([pageOne, pageTwo]);
    });

    expect(view.getByTestId("screen1-preview")).toHaveAttribute("data-active-page", "1");
  });

  it("follows selected card when pagination legitimately moves it", async () => {
    const view = await renderPreviewFrame();
    const repacked: Screen1StudioCardRef[][] = [
      [
        { key: "a", label: "A", kind: "event" },
        { key: "c", label: "C", kind: "event" },
      ],
      [{ key: "b", label: "B", kind: "event" }],
    ];

    act(() => {
      mocks.onPageCountChange(2);
      mocks.onPaginationStructureChange([pageOne, pageTwo]);
      mocks.onPageChange(1);
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "http://localhost",
          data: {
            source: "infoboard-preview-studio",
            type: "SET_STUDIO",
            studio: { cardOverrides: { c: { teamFontSize: "SMALL" } } },
            selectedKey: "c",
          },
        }),
      );
    });

    act(() => {
      mocks.onPaginationStructureChange(repacked);
    });

    expect(view.getByTestId("screen1-preview")).toHaveAttribute("data-active-page", "0");
  });

  it("retains numeric page when no card is selected", async () => {
    const view = await renderPreviewFrame();

    act(() => {
      mocks.onPageCountChange(2);
      mocks.onPaginationStructureChange([pageOne, pageTwo]);
      mocks.onPageChange(1);
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "http://localhost",
          data: {
            source: "infoboard-preview-studio",
            type: "SET_STUDIO",
            studio: { cardOverrides: { a: { teamFontSize: "SMALL" } } },
            selectedKey: null,
          },
        }),
      );
    });

    act(() => {
      mocks.onPaginationStructureChange([pageOne, pageTwo]);
    });

    expect(view.getByTestId("screen1-preview")).toHaveAttribute("data-active-page", "1");
  });
});
