/**
 * MEDIA-LOGO-01C — border-connected background cleanup tests.
 */

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  applyProviderLogoBackgroundCleanup,
  hasBorderConnectedNearWhiteBackground,
  isNearWhiteOpaquePixel,
  NEAR_WHITE_MAX_CHANNEL_SPREAD,
  NEAR_WHITE_MIN_ALPHA,
  NEAR_WHITE_MIN_CHANNEL,
  NORMALIZED_LOGO_TRIM_PADDING_PX,
  removeBorderConnectedNearWhiteBackground,
} from "../provider-logo-background";
import {
  NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION,
  normalizeProviderLogoBytes,
} from "../provider-logo-normalization";

async function createSolidCanvasPng(
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha?: number },
  overlays: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
    color: { r: number; g: number; b: number; alpha?: number };
  }> = [],
): Promise<Buffer> {
  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...background, alpha: background.alpha ?? 1 },
    },
  });

  if (overlays.length === 0) {
    return base.png().toBuffer();
  }

  const composites = await Promise.all(
    overlays.map(async (overlay) => ({
      input: await sharp({
        create: {
          width: overlay.width,
          height: overlay.height,
          channels: 4,
          background: { ...overlay.color, alpha: overlay.color.alpha ?? 1 },
        },
      })
        .png()
        .toBuffer(),
      left: overlay.left,
      top: overlay.top,
    })),
  );

  return base.composite(composites).png().toBuffer();
}

async function readRawRgba(buffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: meta.height ?? info.height };
}

describe("isNearWhiteOpaquePixel", () => {
  it("accepts pure white opaque pixels", () => {
    expect(isNearWhiteOpaquePixel(255, 255, 255, 255)).toBe(true);
  });

  it("accepts slightly off-white opaque pixels", () => {
    expect(isNearWhiteOpaquePixel(250, 248, 246, 255)).toBe(true);
  });

  it("rejects pale non-white crest tones", () => {
    expect(isNearWhiteOpaquePixel(220, 220, 220, 255)).toBe(false);
    expect(isNearWhiteOpaquePixel(255, 250, 220, 255)).toBe(false);
  });
});

describe("border-connected background cleanup", () => {
  it("A. white square canvas + dark crest → external white canvas transparent", async () => {
    const source = await createSolidCanvasPng(100, 100, { r: 255, g: 255, b: 255 }, [
      {
        left: 30,
        top: 30,
        width: 40,
        height: 40,
        color: { r: 20, g: 20, b: 80 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const { data, width, height } = await readRawRgba(cleaned);

    expect(hasBorderConnectedNearWhiteBackground(data, width, height)).toBe(false);
    expect(data[pixelOffset(0, 0, width) + 3]).toBe(0);
    expect(data[pixelOffset(35, 35, width)]).toBeGreaterThan(0);
  });

  it("B. off-white canvas + crest → qualifying connected background transparent", async () => {
    const source = await createSolidCanvasPng(80, 80, { r: 248, g: 247, b: 246 }, [
      {
        left: 20,
        top: 20,
        width: 40,
        height: 40,
        color: { r: 10, g: 10, b: 10 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const { data, width, height } = await readRawRgba(cleaned);

    expect(hasBorderConnectedNearWhiteBackground(data, width, height)).toBe(false);
    expect(data[pixelOffset(0, 0, width) + 3]).toBe(0);
  });

  it("C. crest contains enclosed white center → enclosed white retained", async () => {
    const source = await createSolidCanvasPng(100, 100, { r: 255, g: 255, b: 255 }, [
      {
        left: 20,
        top: 20,
        width: 60,
        height: 60,
        color: { r: 30, g: 30, b: 30 },
      },
      {
        left: 40,
        top: 40,
        width: 20,
        height: 20,
        color: { r: 255, g: 255, b: 255 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const { data, width, height } = await readRawRgba(cleaned);

    let foundEnclosedWhite = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = pixelOffset(x, y, width);
        if (
          data[offset] === 255 &&
          data[offset + 1] === 255 &&
          data[offset + 2] === 255 &&
          data[offset + 3] > 200
        ) {
          foundEnclosedWhite = true;
        }
      }
    }

    expect(foundEnclosedWhite).toBe(true);
    expect(hasBorderConnectedNearWhiteBackground(data, width, height)).toBe(false);
  });

  it("D. white area touching outer border and is truly background → removed", async () => {
    const source = await createSolidCanvasPng(60, 60, { r: 255, g: 255, b: 255 }, [
      {
        left: 25,
        top: 25,
        width: 10,
        height: 10,
        color: { r: 0, g: 0, b: 0 },
      },
    ]);

    const { data, width, height } = await readRawRgba(source);
    const { rgba } = removeBorderConnectedNearWhiteBackground(data, width, height);

    expect(rgba[pixelOffset(0, 0, width) + 3]).toBe(0);
    expect(rgba[pixelOffset(10, 10, width) + 3]).toBe(0);
    expect(rgba[pixelOffset(30, 30, width) + 3]).toBeGreaterThan(0);
  });

  it("E. pale non-white crest region → preserved with conservative threshold", async () => {
    const source = await createSolidCanvasPng(80, 80, { r: 255, g: 255, b: 255 }, [
      {
        left: 10,
        top: 10,
        width: 60,
        height: 60,
        color: { r: 220, g: 220, b: 220 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const { data, width } = await readRawRgba(cleaned);
    const crest = pixelOffset(40, 40, width);

    expect(data[crest]).toBe(220);
    expect(data[crest + 3]).toBeGreaterThan(200);
  });

  it("F. already transparent PNG → preserved", async () => {
    const transparent = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 20,
              height: 20,
              channels: 4,
              background: { r: 180, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 10,
          top: 10,
        },
      ])
      .png()
      .toBuffer();

    const cleaned = await applyProviderLogoBackgroundCleanup(transparent);
    expect(cleaned.equals(transparent)).toBe(true);
  });

  it("G. clean PNG normalized twice → idempotent output", async () => {
    const source = await createSolidCanvasPng(64, 64, { r: 255, g: 255, b: 255 }, [
      {
        left: 16,
        top: 16,
        width: 32,
        height: 32,
        color: { r: 0, g: 64, b: 128 },
      },
    ]);

    const first = await normalizeProviderLogoBytes(source);
    const second = await normalizeProviderLogoBytes(first!.buffer);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.buffer.equals(first!.buffer)).toBe(true);
  });

  it("H. background cleanup does not alter dimensions/aspect unexpectedly", async () => {
    const source = await createSolidCanvasPng(120, 80, { r: 255, g: 255, b: 255 }, [
      {
        left: 40,
        top: 20,
        width: 40,
        height: 40,
        color: { r: 0, g: 0, b: 0 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const meta = await sharp(cleaned).metadata();

    expect(meta.width).toBe(40 + NORMALIZED_LOGO_TRIM_PADDING_PX * 2);
    expect(meta.height).toBe(40 + NORMALIZED_LOGO_TRIM_PADDING_PX * 2);
    expect((meta.width ?? 0) / (meta.height ?? 0)).toBeCloseTo(1, 5);
  });

  it("I. crest artwork is not cropped", async () => {
    const source = await createSolidCanvasPng(100, 100, { r: 255, g: 255, b: 255 }, [
      {
        left: 25,
        top: 25,
        width: 50,
        height: 50,
        color: { r: 200, g: 0, b: 0 },
      },
    ]);

    const cleaned = await applyProviderLogoBackgroundCleanup(source);
    const { data, width } = await readRawRgba(cleaned);
    const crest = pixelOffset(NORMALIZED_LOGO_TRIM_PADDING_PX, NORMALIZED_LOGO_TRIM_PADDING_PX, width);

    expect(data[crest]).toBe(200);
    expect(data[crest + 3]).toBeGreaterThan(200);
  });
});

describe("threshold documentation", () => {
  it("exports conservative near-white constants", () => {
    expect(NEAR_WHITE_MIN_CHANNEL).toBeGreaterThanOrEqual(240);
    expect(NEAR_WHITE_MAX_CHANNEL_SPREAD).toBeLessThanOrEqual(20);
    expect(NEAR_WHITE_MIN_ALPHA).toBeGreaterThanOrEqual(200);
    expect(NORMALIZED_PROVIDER_LOGO_MAX_DIMENSION).toBe(512);
  });
});

function pixelOffset(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}
