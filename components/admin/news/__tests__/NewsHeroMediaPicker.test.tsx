/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsHeroMediaPicker from "@/components/admin/news/NewsHeroMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";

function makeAsset(overrides: Partial<MediaAssetListItem> = {}): MediaAssetListItem {
  return {
    id: "asset-hero-1",
    type: "IMAGE",
    filename: "hero-shot.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 512000,
    url: "https://cdn.example.com/hero-shot.jpg",
    altText: "Team celebrating",
    caption: null,
    width: 1920,
    height: 1080,
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
  return { ok: true, status: 200, json: async () => data } as Response;
}

function mockFetchWithAssets(assets: MediaAssetListItem[]) {
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/media/folders")) {
      return Promise.resolve(jsonResponse({ folders: [] }));
    }
    if (url.startsWith("/api/media")) {
      return Promise.resolve(jsonResponse({ assets, meta: { total: assets.length } }));
    }
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NewsHeroMediaPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the empty state with the expected action buttons when no hero image is set", () => {
    mockFetchWithAssets([]);
    render(<NewsHeroMediaPicker value={null} onChange={vi.fn()} />);

    expect(screen.getByText("Kein Headerbild gewählt")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Aus Mediathek auswählen" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Neues Bild hochladen/ }),
    ).toBeTruthy();
    // No "remove" action when nothing is selected yet.
    expect(screen.queryByRole("button", { name: "Headerbild entfernen" })).toBeNull();
  });

  it("shows a 'remove hero image' action once an image is selected", () => {
    mockFetchWithAssets([]);
    render(
      <NewsHeroMediaPicker
        value={{ id: "a1", url: "https://cdn.example.com/a1.jpg", altText: null, filename: "a1.jpg" }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Headerbild entfernen" }),
    ).toBeTruthy();
  });

  it("calling onChange(null) removes the hero image", () => {
    mockFetchWithAssets([]);
    const onChange = vi.fn();
    render(
      <NewsHeroMediaPicker
        value={{ id: "a1", url: "https://cdn.example.com/a1.jpg", altText: null, filename: "a1.jpg" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Headerbild entfernen" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("opens the shared media library and immediately assigns the selected asset as the hero image", async () => {
    const asset = makeAsset();
    mockFetchWithAssets([asset]);
    const onChange = vi.fn();

    render(<NewsHeroMediaPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Aus Mediathek auswählen" }));

    const assetButton = await screen.findByText("hero-shot.jpg");
    await act(async () => {
      fireEvent.click(assetButton);
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        id: asset.id,
        url: asset.url,
        altText: asset.altText,
        filename: asset.filename,
      });
    });
  });

  it("restricts the shared media picker to images only (filters the /api/media request)", async () => {
    const fetchMock = mockFetchWithAssets([makeAsset()]);
    render(<NewsHeroMediaPicker value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Aus Mediathek auswählen" }));

    await waitFor(() => {
      const mediaCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/media?"),
      );
      expect(mediaCalls.length).toBeGreaterThan(0);
      expect(String(mediaCalls[0][0])).toContain("type=IMAGE");
    });
  });
});
