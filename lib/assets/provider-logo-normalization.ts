/**
 * lib/assets/provider-logo-normalization.ts
 *
 * MEDIA-LOGO-01B/01C — provider-neutral club logo normalization foundation.
 *
 * Transforms untrusted provider-supplied crest bytes (or a bounded HTTP(S)
 * fetch) into a canonical SCE-managed transparent PNG suitable for every
 * consumer that resolves ExternalClub/ExternalTeam.logoUrl (Matchcenter,
 * Infoboard, Club Directory, …). Provider adapters supply source bytes;
 * this module knows about media formats, not federation semantics.
 *
 * ─── Dependency: sharp ───────────────────────────────────────────────────────
 *
 * sharp is the smallest mature Node image stack that runs on Vercel serverless
 * (native bindings, widely deployed). It covers SVG rasterization, PNG output,
 * metadata inspection, resize-without-stretch, and alpha preservation. A single
 * library is sufficient for this slice — no canvas / jimp / imagemagick stack.
 *
 * Runtime assumptions:
 *   - Server-side only (Next.js route handlers, sync jobs). Never import from
 *     client components.
 *   - Vercel Node runtime with sharp native binary (default for App Router API
 *     routes and server actions). Edge runtime is NOT targeted.
 *
 * ─── White-background cleanup (01C) ────────────────────────────────────────
 *
 * After bounded resize/rasterization, border-connected near-white opaque
 * backgrounds are removed via lib/assets/provider-logo-background.ts.
 * Internal whites enclosed by artwork are preserved.
 */

import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { applyProviderLogoBackgroundCleanup, pngNeedsBorderBackgroundCleanup } from "@/lib/assets/provider-logo-background";
import { isUnsafeSvgPayload } from "@/lib/assets/provider-logo-svg-safety";
import { isVercelBlobUrl, type UploadLogoResult } from "@/lib/assets/storage";
import type { NormalizedProviderClubLogoScope } from "@/lib/assets/tenant-paths";
import { MAX_LOGO_FILE_SIZE_BYTES } from "@/lib/assets/validation";

/** Canonical normalized output MIME — always PNG in this slice. */
export const NORMALIZED_PROVIDER_LOGO_MIME = "image/png";

/**
 * Maximum bounding box for normalized crests. 512px covers Infoboard XLARGE
 * logo clamps (~56px CSS at 1x) with ample retina headroom without bloating
 * blob storage.
 */
export const NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION = 512;

/** Provider source downloads reuse the tenant upload cap (2 MB). */
export const MAX_PROVIDER_LOGO_SOURCE_BYTES = MAX_LOGO_FILE_SIZE_BYTES;

/** Bounded provider logo HTTP fetch timeout. */
export const PROVIDER_LOGO_FETCH_TIMEOUT_MS = 12_000;

/** Maximum redirect hops when fetching a provider logo URL. */
export const PROVIDER_LOGO_FETCH_MAX_REDIRECTS = 3;

/** Raster / vector inputs accepted from providers before normalization. */
export const ALLOWED_PROVIDER_LOGO_SOURCE_MIME_TYPES = new Set([
  "image/gif",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export type NormalizeProviderLogoResult = {
  buffer: Buffer;
  mime: typeof NORMALIZED_PROVIDER_LOGO_MIME;
  sourceFingerprint: string;
  width: number;
  height: number;
};

export type ProviderLogoSourceBytes = {
  buffer: Buffer;
  mime: string;
};

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isAllowedProviderLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function sniffProviderSourceMime(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (detected && ALLOWED_PROVIDER_LOGO_SOURCE_MIME_TYPES.has(detected.mime)) {
    return detected.mime;
  }

  const trimmed = buffer.toString("utf8", 0, Math.min(buffer.length, 256)).trimStart();
  if (trimmed.startsWith("<") && /svg/i.test(trimmed.slice(0, 256))) {
    return "image/svg+xml";
  }

  return null;
}

/**
 * Stable fingerprint of the *provider source bytes* before normalization.
 * Used for idempotent persistence without new Prisma fields.
 */
export function computeProviderLogoSourceFingerprint(buffer: Buffer): string {
  return sha256Hex(buffer);
}

/**
 * Converts provider crest bytes into a canonical transparent PNG.
 * Returns null on any unsupported, oversized, or unsafe input — never throws.
 */
export async function normalizeProviderLogoBytes(
  sourceBuffer: Buffer,
): Promise<NormalizeProviderLogoResult | null> {
  if (
    sourceBuffer.length === 0 ||
    sourceBuffer.length > MAX_PROVIDER_LOGO_SOURCE_BYTES
  ) {
    return null;
  }

  const sourceMime = await sniffProviderSourceMime(sourceBuffer);
  if (sourceMime === null) {
    return null;
  }

  if (sourceMime === "image/svg+xml" && isUnsafeSvgPayload(sourceBuffer)) {
    return null;
  }

  const sourceFingerprint = computeProviderLogoSourceFingerprint(sourceBuffer);

  try {
    if (
      sourceMime === "image/png" &&
      !(await needsProviderLogoRasterProcessing(sourceBuffer))
    ) {
      const meta = await sharp(sourceBuffer).metadata();
      return {
        buffer: sourceBuffer,
        mime: NORMALIZED_PROVIDER_LOGO_MIME,
        sourceFingerprint,
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      };
    }

    const pipeline = sharp(sourceBuffer, {
      animated: sourceMime === "image/gif",
      limitInputPixels: NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION * NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION * 16,
    })
      .resize(NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION, NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, force: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    if (data.length === 0 || data.length > MAX_PROVIDER_LOGO_SOURCE_BYTES) {
      return null;
    }

    const cleaned = await applyProviderLogoBackgroundCleanup(data);
    const cleanedMeta = await sharp(cleaned).metadata();

    const detected = await fileTypeFromBuffer(cleaned);
    if (detected?.mime !== NORMALIZED_PROVIDER_LOGO_MIME) {
      return null;
    }

    if (cleaned.length > MAX_PROVIDER_LOGO_SOURCE_BYTES) {
      return null;
    }

    return {
      buffer: cleaned,
      mime: NORMALIZED_PROVIDER_LOGO_MIME,
      sourceFingerprint,
      width: cleanedMeta.width ?? info.width,
      height: cleanedMeta.height ?? info.height,
    };
  } catch {
    return null;
  }
}

async function needsProviderLogoRasterProcessing(buffer: Buffer): Promise<boolean> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const maxDim = Math.max(width, height);

  if (maxDim > NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION) {
    return true;
  }

  if (!meta.hasAlpha) {
    return true;
  }

  return pngNeedsBorderBackgroundCleanup(buffer);
}

/**
 * Bounded HTTP(S) fetch for URL-based provider crests (future adapters).
 * Never throws; rejects oversize bodies, bad protocols, redirect abuse, and
 * unsupported media.
 */
export async function fetchProviderLogoSource(
  url: string,
): Promise<ProviderLogoSourceBytes | null> {
  if (!isAllowedProviderLogoUrl(url)) {
    return null;
  }

  let currentUrl = url;

  for (let redirect = 0; redirect <= PROVIDER_LOGO_FETCH_MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_LOGO_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "image/*" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect >= PROVIDER_LOGO_FETCH_MAX_REDIRECTS) {
          return null;
        }
        const nextUrl = new URL(location, currentUrl).href;
        if (!isAllowedProviderLogoUrl(nextUrl)) {
          return null;
        }
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength !== null) {
        const parsedLength = Number.parseInt(contentLength, 10);
        if (Number.isFinite(parsedLength) && parsedLength > MAX_PROVIDER_LOGO_SOURCE_BYTES) {
          return null;
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return null;
      }

      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        total += value.length;
        if (total > MAX_PROVIDER_LOGO_SOURCE_BYTES) {
          return null;
        }
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);
      const mime = await sniffProviderSourceMime(buffer);
      if (mime === null) {
        return null;
      }

      return { buffer, mime };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export type PersistNormalizedProviderClubLogoInput = {
  tenantKey: string;
  scope: NormalizedProviderClubLogoScope;
  normalizedBuffer: Buffer;
  sourceFingerprint: string;
  /** When unchanged, reuse an existing blob URL instead of re-uploading. */
  existingPublicUrl?: string | null;
  existingSourceFingerprint?: string | null;
};

/**
 * Persists a normalized provider club crest to Vercel Blob at a deterministic
 * tenant-scoped key (provider club id when known). Overwrites the same key on
 * refresh so changed sources replace prior bytes without orphan storms.
 */
export async function persistNormalizedProviderClubLogo(
  input: PersistNormalizedProviderClubLogoInput,
): Promise<UploadLogoResult> {
  const { uploadNormalizedProviderClubLogo } = await import("@/lib/assets/storage");

  if (
    input.existingPublicUrl &&
    isVercelBlobUrl(input.existingPublicUrl) &&
    input.existingSourceFingerprint &&
    input.existingSourceFingerprint === input.sourceFingerprint
  ) {
    return { ok: true, publicUrl: input.existingPublicUrl };
  }

  const detected = await fileTypeFromBuffer(input.normalizedBuffer);
  if (detected?.mime !== NORMALIZED_PROVIDER_LOGO_MIME) {
    return {
      ok: false,
      status: 400,
      error: "Normalisiertes Provider-Logo ist kein gültiges PNG.",
    };
  }

  return uploadNormalizedProviderClubLogo(
    input.tenantKey,
    input.scope,
    input.normalizedBuffer,
  );
}
