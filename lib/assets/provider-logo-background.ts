/**
 * lib/assets/provider-logo-background.ts
 *
 * MEDIA-LOGO-01C — conservative border-connected near-white background
 * removal for normalized provider crest rasters.
 *
 * Only pixels that are (1) sufficiently opaque, (2) near-white by a
 * conservative RGB threshold with low channel spread, and (3) connected to
 * the image border via 4-neighbour flood-fill are made transparent.
 * Enclosed internal whites (shields, text, highlights) are preserved.
 */

import sharp from "sharp";

/** Minimum R/G/B for a pixel to qualify as near-white background. */
export const NEAR_WHITE_MIN_CHANNEL = 240;

/**
 * Maximum allowed spread between the brightest and darkest RGB channel.
 * Keeps pale cream / tinted crest elements from being erased.
 */
export const NEAR_WHITE_MAX_CHANNEL_SPREAD = 15;

/** Minimum alpha for a pixel to be treated as opaque background. */
export const NEAR_WHITE_MIN_ALPHA = 200;

/** Transparent padding preserved around trimmed artwork after cleanup. */
export const NORMALIZED_LOGO_TRIM_PADDING_PX = 2;

export function isNearWhiteOpaquePixel(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < NEAR_WHITE_MIN_ALPHA) {
    return false;
  }

  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);

  if (minChannel < NEAR_WHITE_MIN_CHANNEL) {
    return false;
  }

  return maxChannel - minChannel <= NEAR_WHITE_MAX_CHANNEL_SPREAD;
}

function pixelOffset(index: number): number {
  return index * 4;
}

function readRgba(
  data: Buffer,
  index: number,
): { r: number; g: number; b: number; a: number } {
  const offset = pixelOffset(index);
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

function collectBorderIndices(width: number, height: number): number[] {
  const indices: number[] = [];

  for (let x = 0; x < width; x++) {
    indices.push(x);
    indices.push((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y++) {
    indices.push(y * width);
    indices.push(y * width + (width - 1));
  }

  return indices;
}

/**
 * Returns true when any border-connected near-white opaque region exists.
 */
export function hasBorderConnectedNearWhiteBackground(
  rgba: Buffer,
  width: number,
  height: number,
): boolean {
  const totalPixels = width * height;
  if (totalPixels === 0 || rgba.length < totalPixels * 4) {
    return false;
  }

  const visited = new Uint8Array(totalPixels);
  const queue: number[] = [];

  for (const index of collectBorderIndices(width, height)) {
    if (visited[index]) {
      continue;
    }

    const { r, g, b, a } = readRgba(rgba, index);
    if (!isNearWhiteOpaquePixel(r, g, b, a)) {
      continue;
    }

    visited[index] = 1;
    queue.push(index);
  }

  if (queue.length === 0) {
    return false;
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % width;
    const y = Math.floor(index / width);

    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];

    for (const neighbour of neighbours) {
      if (neighbour < 0 || visited[neighbour]) {
        continue;
      }

      const { r, g, b, a } = readRgba(rgba, neighbour);
      if (!isNearWhiteOpaquePixel(r, g, b, a)) {
        continue;
      }

      visited[neighbour] = 1;
      queue.push(neighbour);
    }
  }

  return true;
}

/**
 * Makes border-connected near-white opaque pixels transparent.
 * Uses iterative BFS — no recursion.
 */
export function removeBorderConnectedNearWhiteBackground(
  rgba: Buffer,
  width: number,
  height: number,
): { rgba: Buffer; changed: boolean } {
  const totalPixels = width * height;
  const output = Buffer.from(rgba);

  if (totalPixels === 0 || output.length < totalPixels * 4) {
    return { rgba: output, changed: false };
  }

  const visited = new Uint8Array(totalPixels);
  const queue: number[] = [];
  let changed = false;

  for (const index of collectBorderIndices(width, height)) {
    if (visited[index]) {
      continue;
    }

    const { r, g, b, a } = readRgba(output, index);
    if (!isNearWhiteOpaquePixel(r, g, b, a)) {
      continue;
    }

    visited[index] = 1;
    queue.push(index);
  }

  while (queue.length > 0) {
    const index = queue.shift()!;
    const offset = pixelOffset(index);

    if (output[offset + 3] !== 0) {
      output[offset + 3] = 0;
      changed = true;
    }

    const x = index % width;
    const y = Math.floor(index / width);

    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];

    for (const neighbour of neighbours) {
      if (neighbour < 0 || visited[neighbour]) {
        continue;
      }

      const { r, g, b, a } = readRgba(output, neighbour);
      if (!isNearWhiteOpaquePixel(r, g, b, a)) {
        continue;
      }

      visited[neighbour] = 1;
      queue.push(neighbour);
    }
  }

  return { rgba: output, changed };
}

/**
 * Applies border-connected background cleanup to a bounded PNG buffer.
 * Returns the original buffer when no qualifying background is present.
 */
export async function applyProviderLogoBackgroundCleanup(
  pngBuffer: Buffer,
): Promise<Buffer> {
  try {
    const image = sharp(pngBuffer);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (width === 0 || height === 0) {
      return pngBuffer;
    }

    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!hasBorderConnectedNearWhiteBackground(data, info.width, info.height)) {
      return pngBuffer;
    }

    const { rgba, changed } = removeBorderConnectedNearWhiteBackground(
      data,
      info.width,
      info.height,
    );

    if (!changed) {
      return pngBuffer;
    }

    const trimmed = sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 });

    return trimmed
      .extend({
        top: NORMALIZED_LOGO_TRIM_PADDING_PX,
        bottom: NORMALIZED_LOGO_TRIM_PADDING_PX,
        left: NORMALIZED_LOGO_TRIM_PADDING_PX,
        right: NORMALIZED_LOGO_TRIM_PADDING_PX,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, force: true })
      .toBuffer();
  } catch {
    return pngBuffer;
  }
}

/**
 * Lightweight PNG probe for the normalization fast-path.
 */
export async function pngNeedsBorderBackgroundCleanup(
  pngBuffer: Buffer,
): Promise<boolean> {
  try {
    const image = sharp(pngBuffer);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (width === 0 || height === 0) {
      return false;
    }

    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return hasBorderConnectedNearWhiteBackground(data, info.width, info.height);
  } catch {
    return false;
  }
}
