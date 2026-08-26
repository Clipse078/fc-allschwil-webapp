/**
 * MEDIA-LOGO-01G — interior white preservation regression tests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  cleanupProviderLogoBackgroundRgba,
  countInteriorNearWhiteOpaquePixels,
  hasBorderConnectedNearWhiteBackground,
  isNearWhiteCrestBridgePixel,
  isNearWhiteOpaquePixel,
  removeBorderConnectedNearWhiteBackground,
  removeTransparencyAdjacentExteriorBackground,
  removeTransparencyAdjacentExteriorFringe,
} from "../provider-logo-background";
import { normalizeProviderLogoBytes } from "../provider-logo-normalization";
import {
  assessProviderLogoQuality,
  assessProviderLogoQualityFromRgba,
} from "../provider-logo-quality";

const FIXTURES_DIR = join(__dirname, "fixtures", "provider-logos");

async function readRawRgba(buffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return { data, width: info.width, height: info.height };
}

function countNearWhiteOpaque(data: Buffer): number {
  let count = 0;
  for (let i = 0; i < data.length / 4; i++) {
    const o = i * 4;
    if (
      isNearWhiteOpaquePixel(data[o], data[o + 1], data[o + 2], data[o + 3])
    ) {
      count++;
    }
  }
  return count;
}

function centerNearWhiteOpaque(
  data: Buffer,
  width: number,
  height: number,
  radius = 30,
): number {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  let count = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const o = (y * width + x) * 4;
      if (
        isNearWhiteOpaquePixel(data[o], data[o + 1], data[o + 2], data[o + 3])
      ) {
        count++;
      }
    }
  }

  return count;
}

describe("SV Muttenz regression fixture", () => {
  const source = readFileSync(join(FIXTURES_DIR, "sv-muttenz.gif"));

  it("TEST A — central white S retained", async () => {
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    const centerWhite = centerNearWhiteOpaque(data, width, height);
    expect(centerWhite).toBeGreaterThan(300);

    const resized = await sharp(source, { animated: true })
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const expectedInterior = countInteriorNearWhiteOpaquePixels(
      resized.data,
      resized.info.width,
      resized.info.height,
    );
    expect(countNearWhiteOpaque(data)).toBeGreaterThanOrEqual(
      Math.floor(expectedInterior * 0.9),
    );
  });

  it("TEST B — exterior matte removed", async () => {
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    expect(hasBorderConnectedNearWhiteBackground(data, width, height)).toBe(false);
    expect(data[0 * 4 + 3]).toBe(0);
    expect(data[(height - 1) * width * 4 + 3]).toBe(0);
  });
});

describe("FC Reinach regression control", () => {
  const source = readFileSync(join(FIXTURES_DIR, "fc-reinach.gif"));

  it("TEST C — internal white crest field retained", async () => {
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const resized = await sharp(source, { animated: true })
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const expectedInterior = countInteriorNearWhiteOpaquePixels(
      resized.data,
      resized.info.width,
      resized.info.height,
    );

    const { data } = await readRawRgba(normalized!.buffer);
    expect(countNearWhiteOpaque(data)).toBeGreaterThanOrEqual(
      Math.floor(expectedInterior * 0.9),
    );
    expect(expectedInterior).toBeGreaterThan(500);
  });

  it("TEST D — exterior matte removed", async () => {
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    expect(hasBorderConnectedNearWhiteBackground(data, width, height)).toBe(false);
    expect(data[0 * 4 + 3]).toBe(0);
  });
});

describe("FC Black Stars positive control", () => {
  const source = readFileSync(join(FIXTURES_DIR, "fc-black-stars.gif"));

  it("TEST E — white-heavy crest preserved", async () => {
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const { data, width, height } = await readRawRgba(normalized!.buffer);
    let opaque = 0;
    let darkOpaque = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      if (data[o + 3] < 128) continue;
      opaque++;
      if (data[o] < 120 && data[o + 1] < 120 && data[o + 2] < 120) {
        darkOpaque++;
      }
    }

    expect(opaque).toBeGreaterThan(200);
    expect(darkOpaque).toBeGreaterThan(80);

    const quality = await assessProviderLogoQuality(normalized!.buffer, source);
    expect(quality?.classification).not.toBe("FAILED_BACKGROUND_REMOVAL");
  });
});

describe("crest bridge topology", () => {
  it("TEST F — fringe cleanup cannot propagate through crest bridges into enclosed whites", async () => {
    const width = 100;
    const height = 100;

    const base = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 60,
              height: 60,
              channels: 4,
              background: { r: 20, g: 40, b: 160, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 20,
          top: 20,
        },
        {
          input: await sharp({
            create: {
              width: 24,
              height: 24,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 38,
          top: 38,
        },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const phase1 = removeBorderConnectedNearWhiteBackground(
      base.data,
      base.info.width,
      base.info.height,
    );
    const phase2 = removeTransparencyAdjacentExteriorBackground(
      phase1.rgba,
      base.info.width,
      base.info.height,
    );
    const phase3 = removeTransparencyAdjacentExteriorFringe(
      phase2.rgba,
      base.info.width,
      base.info.height,
    );

    const centerOffset = (48 * width + 48) * 4;
    expect(phase3.rgba[centerOffset + 3]).toBeGreaterThan(200);
    expect(phase3.rgba[centerOffset]).toBe(255);
    expect(base.data[0 * 4 + 3]).toBe(255);
    expect(phase3.rgba[0 * 4 + 3]).toBe(0);
  });

  it("flags anti-aliased crest boundary pixels as bridge barriers", async () => {
    const width = 40;
    const height = 40;
    const rgba = Buffer.alloc(width * height * 4, 0);

    const crestOffset = (20 * width + 20) * 4;
    rgba[crestOffset] = 20;
    rgba[crestOffset + 1] = 40;
    rgba[crestOffset + 2] = 180;
    rgba[crestOffset + 3] = 255;

    const bridgeOffset = (20 * width + 21) * 4;
    rgba[bridgeOffset] = 248;
    rgba[bridgeOffset + 1] = 248;
    rgba[bridgeOffset + 2] = 248;
    rgba[bridgeOffset + 3] = 255;

    expect(isNearWhiteCrestBridgePixel(rgba, 20 * width + 21, width, height)).toBe(true);
  });
});

describe("quality gate interior retention", () => {
  it("TEST G — detects intentionally damaged internal-white fixture", async () => {
    const source = readFileSync(join(FIXTURES_DIR, "sv-muttenz.gif"));
    const resized = await sharp(source, { animated: true })
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const damaged = Buffer.from(resized.data);
    for (let i = 0; i < resized.info.width * resized.info.height; i++) {
      const o = i * 4;
      if (
        isNearWhiteOpaquePixel(
          damaged[o],
          damaged[o + 1],
          damaged[o + 2],
          damaged[o + 3],
        )
      ) {
        damaged[o + 3] = 0;
      }
    }

    const sourceInterior = countInteriorNearWhiteOpaquePixels(
      resized.data,
      resized.info.width,
      resized.info.height,
    );

    const result = assessProviderLogoQualityFromRgba(
      damaged,
      resized.info.width,
      resized.info.height,
      sourceInterior,
    );

    expect(result.classification).toBe("FAILED_BACKGROUND_REMOVAL");
    expect(result.flags).toContain("interior_near_white_loss");
  });

  it("TEST H — uncertain foreground loss classified REVIEW_REQUIRED", async () => {
    const width = 80;
    const height = 80;
    const pristine = Buffer.alloc(width * height * 4, 0);

    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 60; x++) {
        const o = (y * width + x) * 4;
        pristine[o] = 20;
        pristine[o + 1] = 40;
        pristine[o + 2] = 180;
        pristine[o + 3] = 255;
      }
    }

    for (let y = 30; y < 50; y++) {
      for (let x = 30; x < 50; x++) {
        const o = (y * width + x) * 4;
        pristine[o] = 255;
        pristine[o + 1] = 255;
        pristine[o + 2] = 255;
        pristine[o + 3] = 255;
      }
    }

    const sourceInterior = countInteriorNearWhiteOpaquePixels(pristine, width, height);
    const rgba = Buffer.from(pristine);

    for (let y = 34; y < 46; y++) {
      for (let x = 34; x < 46; x++) {
        const o = (y * width + x) * 4;
        rgba[o + 3] = 0;
      }
    }

    const result = assessProviderLogoQualityFromRgba(
      rgba,
      width,
      height,
      sourceInterior,
    );

    expect(result.classification).toBe("REVIEW_REQUIRED");
    expect(result.flags).toContain("interior_near_white_uncertain");
  });

  it("SV Muttenz passes quality gate with source comparison", async () => {
    const source = readFileSync(join(FIXTURES_DIR, "sv-muttenz.gif"));
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const quality = await assessProviderLogoQuality(normalized!.buffer, source);
    expect(quality?.classification).toBe("PASS");
    expect(quality?.interiorNearWhiteRetentionRatio).toBeGreaterThan(0.9);
  });
});

describe("safe failure paths", () => {
  it("TEST I — existing transparent PNG remains safe", async () => {
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

    const result = await normalizeProviderLogoBytes(transparent);
    expect(result).not.toBeNull();
    expect(result!.buffer.length).toBeGreaterThan(0);
  });

  it("TEST J — invalid/corrupt input remains safe", async () => {
    expect(await normalizeProviderLogoBytes(Buffer.from("not an image"))).toBeNull();
    expect(await normalizeProviderLogoBytes(Buffer.alloc(0))).toBeNull();
  });
});

describe("WARN control clubs — no crest erosion", () => {
  const controls = [
    "fc-brugg.gif",
    "fc-frenkendorf.gif",
    "fc-reinach-a.gif",
    "fc-zwingen.gif",
    "sc-binningen.gif",
  ];

  for (const fixture of controls) {
    it(`preserves interior whites for ${fixture}`, async () => {
      const source = readFileSync(join(FIXTURES_DIR, fixture));
      const normalized = await normalizeProviderLogoBytes(source);
      expect(normalized).not.toBeNull();

      const resized = await sharp(source, { animated: true })
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const expectedInterior = countInteriorNearWhiteOpaquePixels(
        resized.data,
        resized.info.width,
        resized.info.height,
      );

      if (expectedInterior < 24) {
        return;
      }

      const { data } = await readRawRgba(normalized!.buffer);
      const outputNearWhite = countNearWhiteOpaque(data);
      expect(outputNearWhite / expectedInterior).toBeGreaterThan(0.85);
    });
  }
});
