/**
 * lib/integrations/sfv/sync/__tests__/team-logo.test.ts
 *
 * CLUB-DIRECTORY-02B + MEDIA-LOGO-01B — SFV adapter + normalization tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchTeamPicture = vi.fn();
const putMock = vi.fn();

vi.mock("../../client", () => ({
  fetchTeamPicture: (...args: unknown[]) => mockFetchTeamPicture(...args),
}));

vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: vi.fn(),
}));

import {
  resolveClubLogoFromCandidateTeamIds,
  resolveProviderLogoAsset,
  resolveProviderLogoDataUri,
} from "../team-logo";
import { SfvAuthError, SfvNetworkError } from "../../errors";
import { NORMALIZED_PROVIDER_LOGO_MIME } from "@/lib/assets/provider-logo-normalization";

/** Minimal valid 1x1 transparent GIF. */
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Minimal valid 1x1 PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const PERSIST_CONTEXT = {
  tenantKey: "fc-allschwil",
  provider: "SFV",
  providerClubId: 483,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  putMock.mockResolvedValue({
    url: "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/483.png",
  });
});

describe("resolveProviderLogoDataUri — normalized output", () => {
  it("returns a normalized PNG data URI for a GIF crest (not raw GIF)", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: GIF_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result).not.toContain(GIF_BASE64);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(31927);
  });

  it("uploads to blob when persistence context is provided", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: GIF_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927, PERSIST_CONTEXT);

    expect(result).toBe(
      "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/483.png",
    );
    expect(putMock).toHaveBeenCalledWith(
      "clubs/fc-allschwil/provider/sfv/483.png",
      expect.any(Buffer),
      expect.objectContaining({ contentType: NORMALIZED_PROVIDER_LOGO_MIME }),
    );
  });

  it("accepts other sniffed raster formats and normalizes to PNG", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: PNG_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe("resolveProviderLogoDataUri — no picture available", () => {
  it("returns null when fetchTeamPicture returns null (204 / no content)", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(null);

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBeNull();
  });

  it("returns null when the base64 payload is blank/whitespace-only", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: "   ",
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBeNull();
  });
});

describe("resolveProviderLogoDataUri — malformed/unexpected payload guard", () => {
  it("returns null when the decoded bytes do not sniff as a recognised image format", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: Buffer.from("not an image at all").toString("base64"),
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBeNull();
  });

  it("returns null when the base64 string does not decode to any bytes", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: "====",
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBeNull();
  });

  it("returns null when the decoded payload exceeds the max logo size guard", async () => {
    const oversized = Buffer.alloc(3 * 1024 * 1024, 0);
    oversized.write("GIF89a", 0, "ascii");

    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: oversized.toString("base64"),
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBeNull();
  });
});

describe("resolveProviderLogoDataUri — best-effort: never throws", () => {
  it("returns null (never throws) when fetchTeamPicture throws SfvAuthError", async () => {
    mockFetchTeamPicture.mockRejectedValueOnce(
      new SfvAuthError("SFV_UNAUTHORIZED", "unauthorized"),
    );

    await expect(resolveProviderLogoDataUri(31927)).resolves.toBeNull();
  });

  it("returns null (never throws) when fetchTeamPicture throws SFV_NOT_FOUND", async () => {
    mockFetchTeamPicture.mockRejectedValueOnce(
      new SfvNetworkError("SFV_NOT_FOUND", "no picture on file"),
    );

    await expect(resolveProviderLogoDataUri(31927)).resolves.toBeNull();
  });

  it("returns null (never throws) when fetchTeamPicture throws SFV_TIMEOUT", async () => {
    mockFetchTeamPicture.mockRejectedValueOnce(new SfvNetworkError("SFV_TIMEOUT", "timed out"));

    await expect(resolveProviderLogoDataUri(31927)).resolves.toBeNull();
  });

  it("returns null (never throws) when fetchTeamPicture throws an unexpected error", async () => {
    mockFetchTeamPicture.mockRejectedValueOnce(new Error("boom"));

    await expect(resolveProviderLogoDataUri(31927)).resolves.toBeNull();
  });
});

describe("resolveClubLogoFromCandidateTeamIds — first candidate succeeds", () => {
  it("returns the first successful crest and never tries a second candidate", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: GIF_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveClubLogoFromCandidateTeamIds([31927, 31928, 31929]);

    expect(result.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.attemptedTeamIds).toEqual([31927]);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(31927);
  });
});

describe("resolveClubLogoFromCandidateTeamIds — first candidate fails, sibling succeeds", () => {
  it("falls through to a later candidate teamId when an earlier one has no picture on file", async () => {
    mockFetchTeamPicture
      .mockRejectedValueOnce(new SfvNetworkError("SFV_NOT_FOUND", "no picture on file"))
      .mockResolvedValueOnce({
        base64: GIF_BASE64,
        contentType: "application/json",
        contentLength: null,
        etag: null,
        lastModified: null,
        cacheControl: null,
      });

    const result = await resolveClubLogoFromCandidateTeamIds([31927, 31928]);

    expect(result.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.attemptedTeamIds).toEqual([31927, 31928]);
    expect(mockFetchTeamPicture).toHaveBeenNthCalledWith(1, 31927);
    expect(mockFetchTeamPicture).toHaveBeenNthCalledWith(2, 31928);
  });

  it("skips a malformed-payload candidate and succeeds on the next one", async () => {
    mockFetchTeamPicture
      .mockResolvedValueOnce({
        base64: Buffer.from("not an image").toString("base64"),
        contentType: "application/json",
        contentLength: null,
        etag: null,
        lastModified: null,
        cacheControl: null,
      })
      .mockResolvedValueOnce({
        base64: GIF_BASE64,
        contentType: "application/json",
        contentLength: null,
        etag: null,
        lastModified: null,
        cacheControl: null,
      });

    const result = await resolveClubLogoFromCandidateTeamIds([31927, 31928]);

    expect(result.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.attemptedTeamIds).toEqual([31927, 31928]);
  });
});

describe("resolveClubLogoFromCandidateTeamIds — every candidate fails", () => {
  it("returns null with the full attempted-team-id list when no candidate has a crest", async () => {
    mockFetchTeamPicture
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new SfvNetworkError("SFV_NOT_FOUND", "no picture on file"))
      .mockResolvedValueOnce(null);

    const result = await resolveClubLogoFromCandidateTeamIds([31927, 31928, 31929]);

    expect(result.logoUrl).toBeNull();
    expect(result.attemptedTeamIds).toEqual([31927, 31928, 31929]);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(3);
  });

  it("returns null with an empty attempted list for an empty candidate list", async () => {
    const result = await resolveClubLogoFromCandidateTeamIds([]);

    expect(result.logoUrl).toBeNull();
    expect(result.attemptedTeamIds).toEqual([]);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });
});

describe("resolveProviderLogoAsset — source fingerprint", () => {
  it("returns a stable fingerprint for repeated unchanged fetches", async () => {
    mockFetchTeamPicture.mockResolvedValue({
      base64: GIF_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const first = await resolveProviderLogoAsset(31927);
    const second = await resolveProviderLogoAsset(31927);

    expect(first?.sourceFingerprint).toBe(second?.sourceFingerprint);
  });
});
