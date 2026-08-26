/**
 * lib/assets/provider-logo-quality.ts
 *
 * MEDIA-LOGO-01F/01G — post-normalization quality validation for provider crest PNGs.
 * Detects suspicious residual exterior background and meaningful crest-content loss
 * without rejecting legitimate internal white artwork.
 */

import sharp from "sharp";

import {
  countInteriorNearWhiteOpaquePixels,
  EXTERIOR_BG_MIN_CHANNEL,
  hasBorderConnectedNearWhiteBackground,
  isExteriorBackgroundCandidate,
  isNearWhiteCrestBridgePixel,
  isNearWhiteOpaquePixel,
} from "@/lib/assets/provider-logo-background";
import { NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION } from "@/lib/assets/provider-logo-normalization";

export type ProviderLogoQualityClassification =
  | "PASS"
  | "REVIEW_REQUIRED"
  | "FAILED_BACKGROUND_REMOVAL";

export type ProviderLogoQualityResult = {
  classification: ProviderLogoQualityClassification;
  transparentPixelCount: number;
  opaquePixelCount: number;
  suspiciousExteriorPixelCount: number;
  interiorNearWhiteRetentionRatio: number | null;
  flags: string[];
};

const EXTREME_CORNER_PATCH_PX = 6;
const SUSPICIOUS_CORNER_MIN_CHANNEL = EXTERIOR_BG_MIN_CHANNEL;
const SUSPICIOUS_CORNER_MIN_ALPHA = 200;
const FAILED_SUSPICIOUS_EXTERIOR_THRESHOLD = 12;
const REVIEW_SUSPICIOUS_EXTERIOR_THRESHOLD = 2;
const MIN_SOURCE_INTERIOR_NEAR_WHITE_FOR_RETENTION = 24;
const FAILED_INTERIOR_NEAR_WHITE_RETENTION = 0.55;
const REVIEW_INTERIOR_NEAR_WHITE_RETENTION = 0.8;

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

    if (isNearWhiteCrestBridgePixel(rgba, index, width, height)) {
      continue;
    }

    if (isAdjacentToTransparent(rgba, index % width, Math.floor(index / width), width, height)) {
      return true;
    }
  }

  return false;
}

function countNearWhiteOpaquePixels(rgba: Buffer, width: number, height: number): number {
  let count = 0;
  const totalPixels = width * height;

  for (let index = 0; index < totalPixels; index++) {
    const offset = index * 4;
    if (
      isNearWhiteOpaquePixel(
        rgba[offset],
        rgba[offset + 1],
        rgba[offset + 2],
        rgba[offset + 3],
      )
    ) {
      count++;
    }
  }

  return count;
}

async function resizeSourceForQualityComparison(sourceBuffer: Buffer): Promise<{
  rgba: Buffer;
  width: number;
  height: number;
} | null> {
  try {
    const { data, info } = await sharp(sourceBuffer, { animated: true })
      .resize(NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION, NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return { rgba: data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/**
 * Assesses normalized PNG RGBA bytes for residual exterior background artefacts.
 */
export function assessProviderLogoQualityFromRgba(
  rgba: Buffer,
  width: number,
  height: number,
  sourceInteriorNearWhiteCount?: number | null,
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

      if (isNearWhiteCrestBridgePixel(rgba, Math.floor(index / 4), width, height)) {
        continue;
      }

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

  let interiorNearWhiteRetentionRatio: number | null = null;
  if (
    sourceInteriorNearWhiteCount !== undefined &&
    sourceInteriorNearWhiteCount !== null &&
    sourceInteriorNearWhiteCount >= MIN_SOURCE_INTERIOR_NEAR_WHITE_FOR_RETENTION
  ) {
    const outputNearWhite = countNearWhiteOpaquePixels(rgba, width, height);
    interiorNearWhiteRetentionRatio = outputNearWhite / sourceInteriorNearWhiteCount;
    flags.push(
      `interior_near_white_retention:${outputNearWhite}/${sourceInteriorNearWhiteCount}`,
    );

    if (interiorNearWhiteRetentionRatio < FAILED_INTERIOR_NEAR_WHITE_RETENTION) {
      flags.push("interior_near_white_loss");
    } else if (interiorNearWhiteRetentionRatio < REVIEW_INTERIOR_NEAR_WHITE_RETENTION) {
      flags.push("interior_near_white_uncertain");
    }
  }

  let classification: ProviderLogoQualityClassification = "PASS";

  if (
    flags.includes("border_connected_near_white_remains") ||
    flags.includes("interior_near_white_loss")
  ) {
    classification = "FAILED_BACKGROUND_REMOVAL";
  } else if (
    flags.includes("interior_near_white_uncertain") ||
    flags.includes("transparency_adjacent_exterior_candidate_remains") ||
    suspiciousExteriorPixelCount >= REVIEW_SUSPICIOUS_EXTERIOR_THRESHOLD
  ) {
    classification = "REVIEW_REQUIRED";
  } else if (suspiciousExteriorPixelCount >= FAILED_SUSPICIOUS_EXTERIOR_THRESHOLD) {
    classification = "FAILED_BACKGROUND_REMOVAL";
  }

  return {
    classification,
    transparentPixelCount,
    opaquePixelCount,
    suspiciousExteriorPixelCount,
    interiorNearWhiteRetentionRatio,
    flags,
  };
}

/**
 * Assesses a normalized PNG buffer.
 */
export async function assessProviderLogoQuality(
  pngBuffer: Buffer,
  sourceBuffer?: Buffer | null,
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

    let sourceInteriorNearWhiteCount: number | null = null;
    if (sourceBuffer) {
      const resizedSource = await resizeSourceForQualityComparison(sourceBuffer);
      if (resizedSource) {
        sourceInteriorNearWhiteCount = countInteriorNearWhiteOpaquePixels(
          resizedSource.rgba,
          resizedSource.width,
          resizedSource.height,
        );
      }
    }

    return assessProviderLogoQualityFromRgba(
      data,
      info.width,
      info.height,
      sourceInteriorNearWhiteCount,
    );
  } catch {
    return null;
  }
}
