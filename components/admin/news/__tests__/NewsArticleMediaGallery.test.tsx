/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsArticleMediaGallery from "@/components/admin/news/NewsArticleMediaGallery";
import type { MediaAssetListItem } from "@/lib/media/types";
import type { NewsArticleMediaItem } from "@/lib/news/admin-queries";

function makeAsset(overrides: Partial<MediaAssetListItem> = {}): MediaAssetListItem {
  return {
    id: "asset-1",
    type: "IMAGE",
    filename: "gallery-1.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 102400,
    url: "https://cdn.example.com/gallery-1.jpg",
    altText: null,
    caption: null,
    width: 800,
    height: 600,
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

function newsMediaItem(asset: MediaAssetListItem, sortOrder = 0): NewsArticleMediaItem {
  return {
    id: `item-${asset.id}`,
    mediaAssetId: asset.id,
    sortOrder,
    caption: null,
    placement: null,
    mediaAsset: {
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      altText: asset.altText,
      type: asset.type,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
    },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

describe("NewsArticleMediaGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("prompts to save the article first when there is no articleId yet", () => {
    render(
      <NewsArticleMediaGallery articleId={undefined} items={[]} onItemsChange={vi.fn()} />,
    );

    expect(
      screen.getByText("Artikel zuerst speichern, um weitere Medien hinzuzufügen."),
    ).toBeTruthy();
  });

  it("opens the shared media library in multi-select mode and appends chosen assets to additional media", async () => {
    const assetA = makeAsset({ id: "asset-a", filename: "away-kit.jpg" });
    const assetB = makeAsset({ id: "asset-b", filename: "home-kit.jpg" });

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/media/folders")) {
        return Promise.resolve(jsonResponse({ folders: [] }));
      }
      if (url.startsWith("/api/media")) {
        return Promise.resolve(
          jsonResponse({ assets: [assetA, assetB], meta: { total: 2 } }),
        );
      }
      if (url.startsWith("/api/news/article-1/media") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        const asset = [assetA, assetB].find((a) => a.id === body.mediaAssetId)!;
        return Promise.resolve(
          jsonResponse({ item: newsMediaItem(asset) }, 201),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    const onItemsChange = vi.fn();
    render(
      <NewsArticleMediaGallery
        articleId="article-1"
        items={[]}
        onItemsChange={onItemsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aus Mediathek auswählen" }));

    const buttonA = await screen.findByText("away-kit.jpg");
    const buttonB = await screen.findByText("home-kit.jpg");

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
      expect(onItemsChange).toHaveBeenCalledTimes(1);
    });

    const appended = onItemsChange.mock.calls[0][0] as NewsArticleMediaItem[];
    const appendedIds = appended.map((i) => i.mediaAssetId).sort();
    expect(appendedIds).toEqual(["asset-a", "asset-b"]);
  });

  it("skips assets that are already attached when confirming a multi-select", async () => {
    const existingAsset = makeAsset({ id: "asset-existing", filename: "existing.jpg" });
    const newAsset = makeAsset({ id: "asset-new", filename: "new.jpg" });
    const existingItem = newsMediaItem(existingAsset);

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/media/folders")) {
        return Promise.resolve(jsonResponse({ folders: [] }));
      }
      if (url.startsWith("/api/media")) {
        return Promise.resolve(
          jsonResponse({ assets: [existingAsset, newAsset], meta: { total: 2 } }),
        );
      }
      if (url.startsWith("/api/news/article-1/media") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ item: newsMediaItem(newAsset) }, 201),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    const onItemsChange = vi.fn();
    render(
      <NewsArticleMediaGallery
        articleId="article-1"
        items={[existingItem]}
        onItemsChange={onItemsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aus Mediathek auswählen" }));

    const existingButton = await screen.findByText("existing.jpg");
    const newButton = await screen.findByText("new.jpg");

    await act(async () => {
      fireEvent.click(existingButton);
      fireEvent.click(newButton);
    });

    const confirmButton = await screen.findByRole("button", {
      name: /Übernehmen \(2\)/,
    });

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(onItemsChange).toHaveBeenCalledTimes(1);
    });

    const postCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).startsWith("/api/news/article-1/media") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    // Only the not-yet-attached asset should be posted to the API.
    expect(postCalls).toHaveLength(1);

    const appended = onItemsChange.mock.calls[0][0] as NewsArticleMediaItem[];
    expect(appended.map((i) => i.mediaAssetId)).toEqual(["asset-existing", "asset-new"]);
  });
});
