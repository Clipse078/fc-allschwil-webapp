/**
 * @vitest-environment jsdom
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MediaPickerDialog from "@/components/admin/media/MediaPickerDialog";
import type { MediaAssetListItem } from "@/lib/media/types";

function makeAsset(overrides: Partial<MediaAssetListItem> = {}): MediaAssetListItem {
  return {
    id: "asset-1",
    type: "IMAGE",
    filename: "sunset.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 204800,
    url: "https://cdn.example.com/sunset.jpg",
    altText: null,
    caption: null,
    width: 1600,
    height: 900,
    durationSec: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    description: null,
    copyright: null,
    photographer: null,
    folderId: null,
    tags: [],
    ...overrides,
  };
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

function mockFetchWithAssets(assets: MediaAssetListItem[]) {
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/media/folders")) {
      return Promise.resolve(jsonResponse({ folders: [] }));
    }
    if (url.startsWith("/api/media")) {
      return Promise.resolve(
        jsonResponse({ assets, meta: { total: assets.length } }),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MediaPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    mockFetchWithAssets([]);
    const { container } = render(
      <MediaPickerDialog open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("single mode: selecting an asset calls onSelect with a one-item array and closes", async () => {
    const asset = makeAsset();
    mockFetchWithAssets([asset]);
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <MediaPickerDialog
        open
        onClose={onClose}
        selectionMode="single"
        onSelect={onSelect}
      />,
    );

    const assetButton = await screen.findByText("sunset.jpg");
    await act(async () => {
      fireEvent.click(assetButton);
    });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith([asset]);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("multiple mode: toggling several assets and confirming calls onSelect with all chosen assets", async () => {
    const assetA = makeAsset({ id: "asset-a", filename: "team-photo.jpg" });
    const assetB = makeAsset({ id: "asset-b", filename: "stadium.jpg" });
    mockFetchWithAssets([assetA, assetB]);
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <MediaPickerDialog
        open
        onClose={onClose}
        selectionMode="multiple"
        onSelect={onSelect}
      />,
    );

    const buttonA = await screen.findByText("team-photo.jpg");
    const buttonB = await screen.findByText("stadium.jpg");

    await act(async () => {
      fireEvent.click(buttonA);
      fireEvent.click(buttonB);
    });

    const confirmButton = await screen.findByRole("button", {
      name: /Übernehmen \(2\)/,
    });

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.arrayContaining([assetA, assetB]),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("multiple mode: does not confirm selection immediately on click (requires explicit confirm)", async () => {
    const asset = makeAsset();
    mockFetchWithAssets([asset]);
    const onSelect = vi.fn();

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        selectionMode="multiple"
        onSelect={onSelect}
      />,
    );

    const assetButton = await screen.findByText("sunset.jpg");
    await act(async () => {
      fireEvent.click(assetButton);
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("mediaTypes=['image'] restricts the picker to images (filters the /api/media request)", async () => {
    const fetchMock = mockFetchWithAssets([makeAsset()]);

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        selectionMode="single"
        mediaTypes={["image"]}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      const mediaCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/media?"),
      );
      expect(mediaCalls.length).toBeGreaterThan(0);
      expect(String(mediaCalls[0][0])).toContain("type=IMAGE");
    });

    // With a fixed filterType, the ALL/IMAGE/VIDEO toggle is hidden.
    expect(screen.queryByText("Alle")).toBeNull();
  });

  it("closes the dialog when Escape is pressed", async () => {
    mockFetchWithAssets([]);
    const onClose = vi.fn();

    render(
      <MediaPickerDialog open onClose={onClose} onSelect={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("defaults to single selection mode when selectionMode is omitted", async () => {
    const asset = makeAsset();
    mockFetchWithAssets([asset]);
    const onSelect = vi.fn();

    render(<MediaPickerDialog open onClose={vi.fn()} onSelect={onSelect} />);

    // No "Übernehmen" confirm button in single mode.
    await screen.findByText("sunset.jpg");
    expect(screen.queryByText(/Übernehmen/)).toBeNull();
  });
});
