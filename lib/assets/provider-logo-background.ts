/**
 * lib/assets/provider-logo-background.ts
 *
 * MEDIA-LOGO-01C/01F — conservative spatial background removal for normalized
 * provider crest rasters.
 *
 * Two-phase deterministic cleanup:
 *   1. Border-connected near-white flood-fill (conservative threshold).
 *   2. Transparency-adjacent exterior flood-fill (JPEG-tuned threshold) to
 *      remove disconnected corner remnants, halos, and fringe pixels without
 *      erasing enclosed internal whites.
 *
 * Transparent pixels always have RGB cleared to avoid ghost artefacts in
 * consumers that mishandle zero-alpha colour data.
 */

import sharp from "sharp";

/** Minimum R/G/B for a pixel to qualify as near-white background (border BFS). */
export const NEAR_WHITE_MIN_CHANNEL = 240;

/**
 * Maximum allowed spread between the brightest and darkest RGB channel.
 * Keeps pale cream / tinted crest elements from being erased.
 */
export const NEAR_WHITE_MAX_CHANNEL_SPREAD = 15;

/** Minimum alpha for a pixel to be treated as opaque background. */
export const NEAR_WHITE_MIN_ALPHA = 200;

/**
 * JPEG-tuned exterior background threshold — used only for transparency-adjacent
 * flood-fill where spatial context already proves exterior placement.
 */
export const EXTERIOR_BG_MIN_CHANNEL = 232;

/** Slightly wider spread allowance for JPEG compression fringe pixels. */
export const EXTERIOR_BG_MAX_CHANNEL_SPREAD = 20;

/** Minimum alpha for exterior fringe candidates. */
export const EXTERIOR_BG_MIN_ALPHA = 180;

/** Bright fringe halo cleanup — transparency-adjacent only. */
export const EXTERIOR_FRINGE_MIN_CHANNEL = 225;

export const EXTERIOR_FRINGE_MAX_CHANNEL_SPREAD = 35;

export const EXTERIOR_FRINGE_MIN_LUMINANCE = 225;

export const EXTERIOR_FRINGE_MIN_ALPHA = 160;

/** Corner band ratio for quality validation sampling. */
export const EXTERIOR_CORNER_BAND_RATIO = 0.12;

/** Minimum corner band size in pixels. */
export const EXTERIOR_CORNER_BAND_MIN_PX = 4;

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

/**
 * Permissive exterior-background candidate for transparency-adjacent cleanup.
 * Only safe when reached from transparent exterior via spatial flood-fill.
 */
export function isExteriorBackgroundCandidate(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < EXTERIOR_BG_MIN_ALPHA) {
    return false;
  }

  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);

  if (minChannel < EXTERIOR_BG_MIN_CHANNEL) {
    return false;
  }

  return maxChannel - minChannel <= EXTERIOR_BG_MAX_CHANNEL_SPREAD;
}

/**
 * Permissive bright fringe candidate for halo cleanup adjacent to transparency.
 */
export function isExteriorFringeCandidate(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < EXTERIOR_FRINGE_MIN_ALPHA) {
    return false;
  }

  const minChannel = Math.min(r, g, b);
  const maxChannel = Math.max(r, g, b);

  if (minChannel < EXTERIOR_FRINGE_MIN_CHANNEL) {
    return false;
  }

  if (maxChannel - minChannel > EXTERIOR_FRINGE_MAX_CHANNEL_SPREAD) {
    return false;
  }

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= EXTERIOR_FRINGE_MIN_LUMINANCE;
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

function writeTransparentPixel(data: Buffer, index: number): void {
  const offset = pixelOffset(index);
  data[offset] = 0;
  data[offset + 1] = 0;
  data[offset + 2] = 0;
  data[offset + 3] = 0;
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

function isTransparentPixel(a: number): boolean {
  return a < 128;
}

function collectNeighbourIndices(index: number, width: number, height: number): number[] {
  const x = index % width;
  const y = Math.floor(index / width);

  return [
    x > 0 ? index - 1 : -1,
    x < width - 1 ? index + 1 : -1,
    y > 0 ? index - width : -1,
    y < height - 1 ? index + width : -1,
  ];
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

    for (const neighbour of collectNeighbourIndices(index, width, height)) {
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

    if (output[pixelOffset(index) + 3] !== 0) {
      writeTransparentPixel(output, index);
      changed = true;
    }

    for (const neighbour of collectNeighbourIndices(index, width, height)) {
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

function floodFillFromTransparency(
  rgba: Buffer,
  width: number,
  height: number,
  isCandidate: (r: number, g: number, b: number, a: number) => boolean,
): { rgba: Buffer; changed: boolean } {
  const totalPixels = width * height;
  const output = Buffer.from(rgba);

  if (totalPixels === 0 || output.length < totalPixels * 4) {
    return { rgba: output, changed: false };
  }

  const exterior = new Uint8Array(totalPixels);
  const queue: number[] = [];
  let changed = false;

  for (let index = 0; index < totalPixels; index++) {
    const { a } = readRgba(output, index);
    if (!isTransparentPixel(a)) {
      continue;
    }
    exterior[index] = 1;
    queue.push(index);
  }

  while (queue.length > 0) {
    const index = queue.shift()!;

    for (const neighbour of collectNeighbourIndices(index, width, height)) {
      if (neighbour < 0 || exterior[neighbour]) {
        continue;
      }

      const { r, g, b, a } = readRgba(output, neighbour);
      if (!isCandidate(r, g, b, a)) {
        continue;
      }

      exterior[neighbour] = 1;
      queue.push(neighbour);

      if (output[pixelOffset(neighbour) + 3] !== 0) {
        writeTransparentPixel(output, neighbour);
        changed = true;
      }
    }
  }

  return { rgba: output, changed };
}

/**
 * Removes exterior background pixels reachable from transparent areas through
 * permissive near-white candidates. Preserves enclosed internal whites.
 */
export function removeTransparencyAdjacentExteriorBackground(
  rgba: Buffer,
  width: number,
  height: number,
): { rgba: Buffer; changed: boolean } {
  return floodFillFromTransparency(rgba, width, height, isExteriorBackgroundCandidate);
}

/**
 * Removes bright exterior fringe / halo pixels adjacent to transparency.
 */
export function removeTransparencyAdjacentExteriorFringe(
  rgba: Buffer,
  width: number,
  height: number,
): { rgba: Buffer; changed: boolean } {
  return floodFillFromTransparency(rgba, width, height, isExteriorFringeCandidate);
}

/** Clears RGB for all fully transparent pixels. */
export function clearTransparentPixelRgb(
  rgba: Buffer,
  width: number,
  height: number,
): { rgba: Buffer; changed: boolean } {
  const totalPixels = width * height;
  const output = Buffer.from(rgba);
  let changed = false;

  for (let index = 0; index < totalPixels; index++) {
    const offset = pixelOffset(index);
    if (output[offset + 3] !== 0) {
      continue;
    }

    if (output[offset] !== 0 || output[offset + 1] !== 0 || output[offset + 2] !== 0) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      changed = true;
    }
  }

  return { rgba: output, changed };
}

/**
 * Full deterministic background cleanup pipeline on raw RGBA buffers.
 */
export function cleanupProviderLogoBackgroundRgba(
  rgba: Buffer,
  width: number,
  height: number,
): { rgba: Buffer; changed: boolean } {
  let current = Buffer.from(rgba);
  let changed = false;

  const border = removeBorderConnectedNearWhiteBackground(current, width, height);
  if (border.changed) {
    current = Buffer.from(border.rgba);
    changed = true;
  }

  const adjacent = removeTransparencyAdjacentExteriorBackground(current, width, height);
  if (adjacent.changed) {
    current = Buffer.from(adjacent.rgba);
    changed = true;
  }

  const fringe = removeTransparencyAdjacentExteriorFringe(current, width, height);
  if (fringe.changed) {
    current = Buffer.from(fringe.rgba);
    changed = true;
  }

  const cleared = clearTransparentPixelRgb(current, width, height);
  if (cleared.changed) {
    current = Buffer.from(cleared.rgba);
    changed = true;
  }

  return { rgba: current, changed };
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

    const needsBorderCleanup = hasBorderConnectedNearWhiteBackground(
      data,
      info.width,
      info.height,
    );

    const { rgba, changed } = cleanupProviderLogoBackgroundRgba(
      data,
      info.width,
      info.height,
    );

    if (!needsBorderCleanup && !changed) {
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
