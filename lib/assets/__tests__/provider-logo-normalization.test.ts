/**
 * MEDIA-LOGO-01B — provider-neutral logo normalization tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const putMock = vi.fn();

vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: vi.fn(),
}));

import {
  ALLOWED_PROVIDER_LOGO_SOURCE_MIME_TYPES,
  computeProviderLogoSourceFingerprint,
  fetchProviderLogoSource,
  MAX_PROVIDER_LOGO_SOURCE_BYTES,
  NORMALIZED_PROVIDER_LOGO_MIME,
  normalizeProviderLogoBytes,
  persistNormalizedProviderClubLogo,
  PROVIDER_LOGO_FETCH_TIMEOUT_MS,
} from "../provider-logo-normalization";

/** Minimal valid 1x1 transparent GIF. */
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Minimal valid 1x1 PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const TRANSPARENT_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
     <rect x="10" y="10" width="80" height="40" fill="red" opacity="0.5"/>
   </svg>`,
  "utf8",
);

const MALFORMED_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
  "utf8",
);

describe("normalizeProviderLogoBytes — happy path", () => {
  it("normalizes a valid provider SVG to PNG", async () => {
    const result = await normalizeProviderLogoBytes(TRANSPARENT_SVG);

    expect(result).not.toBeNull();
    expect(result?.mime).toBe(NORMALIZED_PROVIDER_LOGO_MIME);
  });

  it("returns PNG bytes that sniff as image/png", async () => {
    const gifBuffer = Buffer.from(GIF_BASE64, "base64");
    const result = await normalizeProviderLogoBytes(gifBuffer);

    expect(result).not.toBeNull();
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(result!.buffer);
    expect(detected?.mime).toBe("image/png");
  });

  it("preserves aspect ratio for SVG rasterization", async () => {
    const result = await normalizeProviderLogoBytes(TRANSPARENT_SVG);

    expect(result).not.toBeNull();
    expect(result!.width).toBeGreaterThan(result!.height);
    expect(result!.width / result!.height).toBeCloseTo(2, 0.1);
  });

  it("preserves transparency for transparent SVG sources", async () => {
    const result = await normalizeProviderLogoBytes(TRANSPARENT_SVG);
    expect(result).not.toBeNull();

    const sharp = (await import("sharp")).default;
    const meta = await sharp(result!.buffer).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it("converts GIF provider payloads to PNG", async () => {
    const result = await normalizeProviderLogoBytes(Buffer.from(GIF_BASE64, "base64"));
    expect(result?.mime).toBe(NORMALIZED_PROVIDER_LOGO_MIME);
  });
});

describe("normalizeProviderLogoBytes — safe failure", () => {
  it("returns null for malformed SVG with active script content", async () => {
    expect(await normalizeProviderLogoBytes(MALFORMED_SVG)).toBeNull();
  });

  it("returns null for unsupported media bytes", async () => {
    expect(await normalizeProviderLogoBytes(Buffer.from("not an image"))).toBeNull();
  });

  it("returns null for oversized source payloads", async () => {
    const oversized = Buffer.alloc(MAX_PROVIDER_LOGO_SOURCE_BYTES + 1, 1);
    oversized.write("GIF89a", 0, "ascii");
    expect(await normalizeProviderLogoBytes(oversized)).toBeNull();
  });
});

describe("computeProviderLogoSourceFingerprint", () => {
  it("is stable for unchanged source bytes", () => {
    const buffer = Buffer.from(GIF_BASE64, "base64");
    expect(computeProviderLogoSourceFingerprint(buffer)).toBe(
      computeProviderLogoSourceFingerprint(buffer),
    );
  });
});

describe("fetchProviderLogoSource — safe failure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-http(s) protocols", async () => {
    expect(await fetchProviderLogoSource("file:///etc/passwd")).toBeNull();
    expect(await fetchProviderLogoSource("data:image/png;base64,abc")).toBeNull();
  });

  it("returns null on provider fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }),
    );

    expect(await fetchProviderLogoSource("https://example.com/logo.png")).toBeNull();
  });

  it("rejects oversized downloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === "content-length" ? String(MAX_PROVIDER_LOGO_SOURCE_BYTES + 1) : null),
        },
        body: null,
      }),
    );

    expect(await fetchProviderLogoSource("https://example.com/logo.png")).toBeNull();
  });
});

describe("persistNormalizedProviderClubLogo — idempotency", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    putMock.mockReset();
    putMock.mockResolvedValue({
      url: "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/483.png",
    });
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("skips re-upload when source fingerprint is unchanged", async () => {
    const normalized = await normalizeProviderLogoBytes(Buffer.from(GIF_BASE64, "base64"));
    expect(normalized).not.toBeNull();

    const existingUrl =
      "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/483.png";

    const first = await persistNormalizedProviderClubLogo({
      tenantKey: "fc-allschwil",
      scope: { provider: "SFV", providerClubId: 483 },
      normalizedBuffer: normalized!.buffer,
      sourceFingerprint: normalized!.sourceFingerprint,
    });
    expect(first.ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);

    const second = await persistNormalizedProviderClubLogo({
      tenantKey: "fc-allschwil",
      scope: { provider: "SFV", providerClubId: 483 },
      normalizedBuffer: normalized!.buffer,
      sourceFingerprint: normalized!.sourceFingerprint,
      existingPublicUrl: existingUrl,
      existingSourceFingerprint: normalized!.sourceFingerprint,
    });

    expect(second).toEqual({ ok: true, publicUrl: existingUrl });
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it("allows refresh when source fingerprint changes", async () => {
    const firstNormalized = await normalizeProviderLogoBytes(Buffer.from(GIF_BASE64, "base64"));
    const secondNormalized = await normalizeProviderLogoBytes(Buffer.from(PNG_BASE64, "base64"));
    expect(firstNormalized).not.toBeNull();
    expect(secondNormalized).not.toBeNull();

    await persistNormalizedProviderClubLogo({
      tenantKey: "fc-allschwil",
      scope: { provider: "SFV", providerClubId: 483 },
      normalizedBuffer: firstNormalized!.buffer,
      sourceFingerprint: firstNormalized!.sourceFingerprint,
    });

    await persistNormalizedProviderClubLogo({
      tenantKey: "fc-allschwil",
      scope: { provider: "SFV", providerClubId: 483 },
      normalizedBuffer: secondNormalized!.buffer,
      sourceFingerprint: secondNormalized!.sourceFingerprint,
      existingPublicUrl: "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/483.png",
      existingSourceFingerprint: firstNormalized!.sourceFingerprint,
    });

    expect(putMock).toHaveBeenCalledTimes(2);
  });
});

describe("ALLOWED_PROVIDER_LOGO_SOURCE_MIME_TYPES", () => {
  it("includes svg for provider normalization inputs", () => {
    expect(ALLOWED_PROVIDER_LOGO_SOURCE_MIME_TYPES.has("image/svg+xml")).toBe(true);
  });
});

describe("PROVIDER_LOGO_FETCH_TIMEOUT_MS", () => {
  it("is bounded", () => {
    expect(PROVIDER_LOGO_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(PROVIDER_LOGO_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
