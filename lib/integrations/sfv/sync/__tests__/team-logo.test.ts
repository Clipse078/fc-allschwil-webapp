/**
 * lib/integrations/sfv/sync/__tests__/team-logo.test.ts
 *
 * CLUB-DIRECTORY-02B — unit tests for resolveProviderLogoDataUri(), the
 * SFV-specific adapter that turns a fetchTeamPicture() response into a
 * data: URI (see module doc comment in ../team-logo.ts for the
 * investigation result: SFV has no stable logo URL, only an authenticated
 * base64 team-picture endpoint).
 *
 * fetchTeamPicture itself (client.ts) already has exhaustive live-contract
 * coverage in lib/integrations/sfv/__tests__/team-picture.test.ts — this
 * file mocks it and focuses purely on the conversion/guard logic added here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchTeamPicture = vi.fn();
vi.mock("../../client", () => ({
  fetchTeamPicture: (...args: unknown[]) => mockFetchTeamPicture(...args),
}));

import { resolveClubLogoFromCandidateTeamIds, resolveProviderLogoDataUri } from "../team-logo";
import { SfvAuthError, SfvNetworkError } from "../../errors";

/** Minimal valid 1x1 transparent GIF — same fixture used by team-picture.test.ts. */
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Minimal valid 1x1 PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveProviderLogoDataUri — happy path", () => {
  it("returns a data: URI built from the fetched base64 payload for a GIF crest", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: GIF_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBe(`data:image/gif;base64,${GIF_BASE64}`);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(31927);
  });

  it("accepts other sniffed image formats too (not hard-coded to GIF)", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce({
      base64: PNG_BASE64,
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
    });

    const result = await resolveProviderLogoDataUri(31927);

    expect(result).toBe(`data:image/png;base64,${PNG_BASE64}`);
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
    // GIF magic header so it would otherwise pass the format sniff.
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

// ── CLUB-DIRECTORY-02C — multi-candidate club logo resolution ────────────────

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

    expect(result.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
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

    expect(result.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
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

    expect(result.logoUrl).toBe(`data:image/gif;base64,${GIF_BASE64}`);
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
