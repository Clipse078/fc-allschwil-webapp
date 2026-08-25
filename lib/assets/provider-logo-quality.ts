/**
 * lib/assets/provider-logo-quality.ts
 *
 * MEDIA-LOGO-01F — post-normalization quality validation for provider crest PNGs.
 * Detects suspicious residual exterior background without rejecting legitimate
 * internal white artwork.
 */

import sharp from "sharp";

import {
  EXTERIOR_BG_MIN_CHANNEL,
  hasBorderConnectedNearWhiteBackground,
  isExteriorBackgroundCandidate,
} from "@/lib/assets/provider-logo-background";

export type ProviderLogoQualityClassification =
  | "PASS"
  | "REVIEW_REQUIRED"
  | "FAILED_BACKGROUND_REMOVAL";

export type ProviderLogoQualityResult = {
  classification: ProviderLogoQualityClassification;
  transparentPixelCount: number;
  opaquePixelCount: number;
  suspiciousExteriorPixelCount: number;
  flags: string[];
};

const EXTREME_CORNER_PATCH_PX = 6;
const SUSPICIOUS_CORNER_MIN_CHANNEL = EXTERIOR_BG_MIN_CHANNEL;
const SUSPICIOUS_CORNER_MIN_ALPHA = 200;
const FAILED_SUSPICIOUS_EXTERIOR_THRESHOLD = 12;
const REVIEW_SUSPICIOUS_EXTERIOR_THRESHOLD = 2;

function isInExtremeCornerPatch(
  x: number,
  y: number,
  width: number,
  height: number,
  patch: number = EXTREME_CORNER_PATCH_PX,
): boolean {
  const inLeft = x < patch;
  const inRight = x >= width - patch;
  const inTop = y < patch;
  const inBottom = y >= height - patch;

  return (inLeft && inTop) || (inRight && inTop) || (inLeft && inBottom) || (inRight && inBottom);
}

function isSuspiciousExtremeCornerOpaquePixel(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < SUSPICIOUS_CORNER_MIN_ALPHA) {
    return false;
  }

  return Math.min(r, g, b) >= SUSPICIOUS_CORNER_MIN_CHANNEL;
}

function isAdjacentToTransparent(
  rgba: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const index = y * width + x;
  const neighbours = [
    x > 0 ? index - 1 : -1,
    x < width - 1 ? index + 1 : -1,
    y > 0 ? index - width : -1,
    y < height - 1 ? index + width : -1,
  ];

  for (const neighbour of neighbours) {
    if (neighbour < 0) {
      return true;
    }
    if (rgba[neighbour * 4 + 3] < 128) {
      return true;
    }
  }

  return false;
}

function hasTransparencyAdjacentExteriorCandidate(
  rgba: Buffer,
  width: number,
  height: number,
): boolean {
  const totalPixels = width * height;

  for (let index = 0; index < totalPixels; index++) {
    const offset = index * 4;
    const a = rgba[offset + 3];
    if (a < 128) {
      continue;
    }

    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];

    if (!isExteriorBackgroundCandidate(r, g, b, a)) {
      continue;
    }

    if (isAdjacentToTransparent(rgba, index % width, Math.floor(index / width), width, height)) {
      return true;
    }
  }

  return false;
}

/**
 * Assesses normalized PNG RGBA bytes for residual exterior background artefacts.
 */
export function assessProviderLogoQualityFromRgba(
  rgba: Buffer,
  width: number,
  height: number,
): ProviderLogoQualityResult {
  const flags: string[] = [];
  let transparentPixelCount = 0;
  let opaquePixelCount = 0;
  let suspiciousExteriorPixelCount = 0;

  if (hasBorderConnectedNearWhiteBackground(rgba, width, height)) {
    flags.push("border_connected_near_white_remains");
  }

  if (hasTransparencyAdjacentExteriorCandidate(rgba, width, height)) {
    flags.push("transparency_adjacent_exterior_candidate_remains");
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = rgba[index];
      const g = rgba[index + 1];
      const b = rgba[index + 2];
      const a = rgba[index + 3];

      if (a < 128) {
        transparentPixelCount++;
        continue;
      }

      opaquePixelCount++;

      if (
        isInExtremeCornerPatch(x, y, width, height) &&
        isSuspiciousExtremeCornerOpaquePixel(r, g, b, a)
      ) {
        suspiciousExteriorPixelCount++;
        continue;
      }

      if (
        isExteriorBackgroundCandidate(r, g, b, a) &&
        isAdjacentToTransparent(rgba, x, y, width, height)
      ) {
        suspiciousExteriorPixelCount++;
      }
    }
  }

  if (suspiciousExteriorPixelCount > 0) {
    flags.push(`suspicious_exterior_pixels:${suspiciousExteriorPixelCount}`);
  }

  let classification: ProviderLogoQualityClassification = "PASS";

  if (
    flags.includes("border_connected_near_white_remains") ||
    suspiciousExteriorPixelCount >= FAILED_SUSPICIOUS_EXTERIOR_THRESHOLD
  ) {
    classification = "FAILED_BACKGROUND_REMOVAL";
  } else if (
    flags.includes("transparency_adjacent_exterior_candidate_remains") ||
    suspiciousExteriorPixelCount >= REVIEW_SUSPICIOUS_EXTERIOR_THRESHOLD
  ) {
    classification = "REVIEW_REQUIRED";
  }

  return {
    classification,
    transparentPixelCount,
    opaquePixelCount,
    suspiciousExteriorPixelCount,
    flags,
  };
}

/**
 * Assesses a normalized PNG buffer.
 */
export async function assessProviderLogoQuality(
  pngBuffer: Buffer,
): Promise<ProviderLogoQualityResult | null> {
  try {
    const image = sharp(pngBuffer);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (width === 0 || height === 0) {
      return null;
    }

    const { data, info } = await image.ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });

    return assessProviderLogoQualityFromRgba(data, info.width, info.height);
  } catch {
    return null;
  }
}
