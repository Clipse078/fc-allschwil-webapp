/**
 * MEDIA-LOGO-01F — confirms production normalization has zero club-specific logic.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assessProviderLogoQualityFromRgba } from "../provider-logo-quality";
import {
  cleanupProviderLogoBackgroundRgba,
  isExteriorBackgroundCandidate,
  isExteriorFringeCandidate,
  isNearWhiteOpaquePixel,
} from "../provider-logo-background";
import { normalizeProviderLogoBytes } from "../provider-logo-normalization";

const FIXTURES_DIR = join(__dirname, "fixtures", "provider-logos");

const FORBIDDEN_PRODUCTION_IDENTIFIERS = [
  "HNK",
  "Croatia",
  "Aesch",
  "Boca",
  "Rossoneri",
  "Therwil",
  "Concordia",
  "providerClubId",
  "clubName",
  "top-left",
  "bottom-right",
  "topLeft",
  "bottomRight",
];

function readProductionSource(relativePath: string): string {
  return readFileSync(join(__dirname, "..", relativePath), "utf8");
}

describe("generic algorithm contract — no club-specific production logic", () => {
  it("provider-logo-background.ts contains no club-specific identifiers", () => {
    const source = readProductionSource("provider-logo-background.ts");
    for (const token of FORBIDDEN_PRODUCTION_IDENTIFIERS) {
      expect(source.includes(token)).toBe(false);
    }
  });

  it("provider-logo-quality.ts contains no club-specific identifiers", () => {
    const source = readProductionSource("provider-logo-quality.ts");
    for (const token of FORBIDDEN_PRODUCTION_IDENTIFIERS) {
      expect(source.includes(token)).toBe(false);
    }
  });

  it("provider-logo-normalization.ts contains no club-specific identifiers", () => {
    const source = readProductionSource("provider-logo-normalization.ts");
    for (const token of FORBIDDEN_PRODUCTION_IDENTIFIERS) {
      expect(source.includes(token)).toBe(false);
    }
  });

  it("background detection is purely pixel/spatial property based", () => {
    expect(isNearWhiteOpaquePixel(255, 255, 255, 255)).toBe(true);
    expect(isNearWhiteOpaquePixel(100, 150, 200, 255)).toBe(false);
    expect(isExteriorBackgroundCandidate(248, 247, 246, 255)).toBe(true);
    expect(isExteriorFringeCandidate(255, 231, 227, 255)).toBe(true);
    expect(isExteriorFringeCandidate(220, 220, 220, 255)).toBe(false);
  });
});

describe("regression fixtures — generic pipeline outcomes", () => {
  it("HNK JPEG regression: transparent extreme corners, internal whites preserved", async () => {
    const source = readFileSync(join(FIXTURES_DIR, "hnk-croatia-basel.jpg"));
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(normalized!.buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const patch = 6;

    for (const [x, y] of [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ]) {
      const offset = (y * w + x) * 4;
      expect(data[offset + 3]).toBe(0);
      expect(data[offset]).toBe(0);
      expect(data[offset + 1]).toBe(0);
      expect(data[offset + 2]).toBe(0);
    }

    let interiorNearWhite = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (data[o + 3] > 200 && data[o] > 240 && data[o + 1] > 230 && data[o + 2] > 230) {
        interiorNearWhite++;
      }
    }
    expect(interiorNearWhite).toBeGreaterThan(50);

    const quality = assessProviderLogoQualityFromRgba(data, w, h);
    expect(quality.classification).toBe("PASS");
  });

  it("FC Aesch GIF regression: internal white football panels preserved", async () => {
    const source = readFileSync(join(FIXTURES_DIR, "fc-aesch.gif"));
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(normalized!.buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let pureWhiteOpaque = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const o = i * 4;
      if (
        data[o] === 255 &&
        data[o + 1] === 255 &&
        data[o + 2] === 255 &&
        data[o + 3] > 200
      ) {
        pureWhiteOpaque++;
      }
    }
    expect(pureWhiteOpaque).toBeGreaterThan(20);
  });

  it("Boca Bretzwil JPEG regression: detached stars remain opaque artwork", async () => {
    const source = readFileSync(join(FIXTURES_DIR, "boca-bretzwil.jpg"));
    const normalized = await normalizeProviderLogoBytes(source);
    expect(normalized).not.toBeNull();

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(normalized!.buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    let redOpaque = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (data[o + 3] < 200) continue;
        if (data[o] > 180 && data[o + 1] < 100 && data[o + 2] < 100) {
          redOpaque++;
        }
      }
    }
    expect(redOpaque).toBeGreaterThan(30);
  });

  it("synthetic detached star crest survives generic cleanup", async () => {
    const sharp = (await import("sharp")).default;
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
              width: 40,
              height: 50,
              channels: 4,
              background: { r: 0, g: 80, b: 180, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 30,
          top: 35,
        },
        {
          input: await sharp({
            create: {
              width: 12,
              height: 12,
              channels: 4,
              background: { r: 220, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 8,
          top: 10,
        },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { rgba } = cleanupProviderLogoBackgroundRgba(
      base.data,
      base.info.width,
      base.info.height,
    );

    let detachedStarOpaque = 0;
    for (let y = 8; y < 22; y++) {
      for (let x = 8; x < 22; x++) {
        const o = (y * width + x) * 4;
        if (rgba[o + 3] > 200 && rgba[o] > 200) {
          detachedStarOpaque++;
        }
      }
    }

    expect(detachedStarOpaque).toBeGreaterThan(20);
    expect(rgba[0 * 4 + 3]).toBe(0);
  });
});
