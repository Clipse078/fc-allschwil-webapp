/**
 * MEDIA-LOGO-01F — post-normalization quality validation tests.
 */

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  cleanupProviderLogoBackgroundRgba,
  removeTransparencyAdjacentExteriorBackground,
} from "../provider-logo-background";
import {
  assessProviderLogoQualityFromRgba,
  assessProviderLogoQuality,
} from "../provider-logo-quality";
import { normalizeProviderLogoBytes } from "../provider-logo-normalization";

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

function pixelOffset(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

describe("assessProviderLogoQualityFromRgba", () => {
  it("PASS for clean transparent corners", async () => {
    const source = await createSolidCanvasPng(80, 80, { r: 255, g: 255, b: 255 }, [
      {
        left: 25,
        top: 25,
        width: 30,
        height: 30,
        color: { r: 200, g: 0, b: 0 },
      },
    ]);

    const cleaned = await readRawRgba(
      await sharp(
        cleanupProviderLogoBackgroundRgba(
          (await readRawRgba(source)).data,
          80,
          80,
        ).rgba,
        { raw: { width: 80, height: 80, channels: 4 } },
      )
        .png()
        .toBuffer(),
    );

    const result = assessProviderLogoQualityFromRgba(cleaned.data, cleaned.width, cleaned.height);
    expect(result.classification).toBe("PASS");
    expect(result.suspiciousExteriorPixelCount).toBe(0);
  });

  it("FAILED_BACKGROUND_REMOVAL when border-connected near-white remains", async () => {
    const { data, width, height } = await readRawRgba(
      await createSolidCanvasPng(40, 40, { r: 255, g: 255, b: 255 }),
    );

    const result = assessProviderLogoQualityFromRgba(data, width, height);
    expect(result.classification).toBe("FAILED_BACKGROUND_REMOVAL");
    expect(result.flags).toContain("border_connected_near_white_remains");
  });

  it("flags extreme-corner opaque near-white remnants", async () => {
    const source = await createSolidCanvasPng(60, 60, { r: 0, g: 0, b: 0, alpha: 0 }, [
      {
        left: 0,
        top: 0,
        width: 4,
        height: 4,
        color: { r: 250, g: 250, b: 250 },
      },
      {
        left: 20,
        top: 20,
        width: 20,
        height: 20,
        color: { r: 180, g: 0, b: 0 },
      },
    ]);

    const { data, width, height } = await readRawRgba(source);
    const result = assessProviderLogoQualityFromRgba(data, width, height);
    expect(result.suspiciousExteriorPixelCount).toBeGreaterThan(0);
    expect(result.classification).not.toBe("PASS");
  });
});

describe("removeTransparencyAdjacentExteriorBackground", () => {
  it("removes disconnected near-white corner remnant touching transparency", async () => {
    const source = await createSolidCanvasPng(60, 60, { r: 0, g: 0, b: 0, alpha: 0 }, [
      {
        left: 2,
        top: 2,
        width: 8,
        height: 8,
        color: { r: 248, g: 247, b: 246 },
      },
      {
        left: 20,
        top: 20,
        width: 20,
        height: 20,
        color: { r: 20, g: 20, b: 120 },
      },
    ]);

    const { data, width, height } = await readRawRgba(source);
    const { rgba, changed } = removeTransparencyAdjacentExteriorBackground(data, width, height);

    expect(changed).toBe(true);
    expect(rgba[pixelOffset(2, 2, width) + 3]).toBe(0);
    expect(rgba[pixelOffset(30, 30, width)]).toBe(20);
  });

  it("preserves enclosed interior white artwork", async () => {
    const source = await createSolidCanvasPng(80, 80, { r: 0, g: 0, b: 0, alpha: 0 }, [
      {
        left: 20,
        top: 20,
        width: 40,
        height: 40,
        color: { r: 30, g: 30, b: 30 },
      },
      {
        left: 35,
        top: 35,
        width: 10,
        height: 10,
        color: { r: 255, g: 255, b: 255 },
      },
    ]);

    const { data, width, height } = await readRawRgba(source);
    const { rgba } = removeTransparencyAdjacentExteriorBackground(data, width, height);
    const center = pixelOffset(40, 40, width);

    expect(rgba[center]).toBe(255);
    expect(rgba[center + 3]).toBeGreaterThan(200);
  });
});

describe("assessProviderLogoQuality — real fixtures", () => {
  it("HNK Croatia Basel regression passes quality validation", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("./fixtures/provider-logos/hnk-croatia-basel.jpg", import.meta.url),
      ),
    );
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const quality = await assessProviderLogoQuality(normalized!.buffer);
    expect(quality?.classification).toBe("PASS");

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    expect(data[pixelOffset(0, 0, width) + 3]).toBe(0);
    expect(data[pixelOffset(width - 1, height - 1, width) + 3]).toBe(0);
    expect(data[pixelOffset(0, 0, width)]).toBe(0);
  });

  it("FC Aesch preserves internal white football panels", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./fixtures/provider-logos/fc-aesch.gif", import.meta.url)),
    );
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    let whiteOpaque = 0;
    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      if (
        data[offset] === 255 &&
        data[offset + 1] === 255 &&
        data[offset + 2] === 255 &&
        data[offset + 3] > 200
      ) {
        whiteOpaque++;
      }
    }

    expect(whiteOpaque).toBeGreaterThan(20);
    const quality = await assessProviderLogoQuality(normalized!.buffer);
    expect(quality?.classification).toBe("PASS");
  });
});
