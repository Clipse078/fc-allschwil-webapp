/**
 * scripts/media-logo-01f-visual-qa.ts
 *
 * MEDIA-LOGO-01F — non-mutating visual QA contact sheet generation.
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/media-logo-01f-visual-qa.ts
 */

import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import sharp from "sharp";

import {
  decodeProviderLogoDataUri,
  type LogoBackfillCandidatePlan,
} from "@/lib/assets/provider-logo-backfill-planner";
import { normalizeProviderLogoBytes } from "@/lib/assets/provider-logo-normalization";
import { assessProviderLogoQuality } from "@/lib/assets/provider-logo-quality";
import { runProviderLogoBackfillDryRun } from "./media-logo-01d2-provider-logo-backfill-dry-run";

export const VISUAL_QA_CLUBS = [
  "AC Rossoneri",
  "FC Aesch",
  "FC Concordia Basel",
  "FC Therwil",
  "Boca Bretzwil",
  "HNK Croatia Basel",
] as const;

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 220;
const LABEL_HEIGHT = 28;

async function renderPanel(
  label: string,
  imageBuffer: Buffer | null,
  background: { r: number; g: number; b: number },
): Promise<Buffer> {
  const canvas = sharp({
    create: {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT + LABEL_HEIGHT,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  });

  const composites: Array<{ input: Buffer; top?: number; left?: number }> = [];

  if (imageBuffer) {
    const fitted = await sharp(imageBuffer)
      .resize(PANEL_WIDTH, PANEL_HEIGHT, {
        fit: "contain",
        background,
      })
      .png()
      .toBuffer();
    composites.push({ input: fitted, top: 0, left: 0 });
  }

  const labelSvg = Buffer.from(
    `<svg width="${PANEL_WIDTH}" height="${LABEL_HEIGHT}">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="8" y="18" font-family="Arial" font-size="12" fill="#222">${label}</text>
    </svg>`,
  );

  composites.push({ input: labelSvg, top: PANEL_HEIGHT, left: 0 });

  return canvas.composite(composites).png().toBuffer();
}

async function buildCheckerboardBackground(width: number, height: number): Promise<Buffer> {
  const tile = 16;
  const tiles: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      const light = ((x / tile + y / tile) % 2) === 0;
      tiles.push({
        input: await sharp({
          create: {
            width: Math.min(tile, width - x),
            height: Math.min(tile, height - y),
            channels: 3,
            background: light ? { r: 204, g: 204, b: 204 } : { r: 255, g: 255, b: 255 },
          },
        })
          .png()
          .toBuffer(),
        left: x,
        top: y,
      });
    }
  }

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(tiles)
    .png()
    .toBuffer();
}

async function renderOnCheckerboard(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? PANEL_WIDTH;
  const height = meta.height ?? PANEL_HEIGHT;
  const background = await buildCheckerboardBackground(width, height);

  return sharp(background)
    .composite([{ input: imageBuffer }])
    .png()
    .toBuffer();
}

async function renderOnDark(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? PANEL_WIDTH;
  const height = meta.height ?? PANEL_HEIGHT;

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 30, b: 40 },
    },
  })
    .composite([{ input: imageBuffer }])
    .png()
    .toBuffer();
}

async function buildClubRow(
  clubName: string,
  sourceBuffer: Buffer,
  normalizedBuffer: Buffer,
): Promise<Buffer> {
  const sourcePanel = await renderPanel("SOURCE", sourceBuffer, { r: 255, g: 255, b: 255 });
  const checkerPanel = await renderPanel(
    "CHECKERBOARD",
    await renderOnCheckerboard(normalizedBuffer),
    { r: 255, g: 255, b: 255 },
  );
  const darkPanel = await renderPanel(
    "DARK BG",
    await renderOnDark(normalizedBuffer),
    { r: 30, g: 30, b: 40 },
  );

  const rowWidth = PANEL_WIDTH * 3;
  const rowHeight = PANEL_HEIGHT + LABEL_HEIGHT;

  return sharp({
    create: {
      width: rowWidth,
      height: rowHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: sourcePanel, left: 0, top: 0 },
      { input: checkerPanel, left: PANEL_WIDTH, top: 0 },
      { input: darkPanel, left: PANEL_WIDTH * 2, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function findCandidate(
  candidates: readonly LogoBackfillCandidatePlan[],
  clubName: string,
): Promise<LogoBackfillCandidatePlan | undefined> {
  return candidates.find((candidate) => candidate.clubName === clubName);
}

export async function generateVisualQaContactSheet(input: {
  candidates: readonly LogoBackfillCandidatePlan[];
  outputDirectory: string;
}): Promise<{
  outputDirectory: string;
  rows: Array<{ clubName: string; quality: string; outputPath: string | null }>;
  contactSheetPath: string | null;
}> {
  await mkdir(input.outputDirectory, { recursive: true });

  const rows: Array<{ clubName: string; quality: string; outputPath: string | null }> = [];
  const rowBuffers: Buffer[] = [];

  for (const clubName of VISUAL_QA_CLUBS) {
    const candidate = await findCandidate(input.candidates, clubName);
    if (!candidate?.currentLogoUrl) {
      rows.push({ clubName, quality: "missing", outputPath: null });
      continue;
    }

    const decoded = decodeProviderLogoDataUri(candidate.currentLogoUrl);
    if (!decoded) {
      rows.push({ clubName, quality: "decode_failed", outputPath: null });
      continue;
    }

    const normalized = await normalizeProviderLogoBytes(decoded.buffer);
    if (!normalized) {
      rows.push({ clubName, quality: "normalize_failed", outputPath: null });
      continue;
    }

    const quality = await assessProviderLogoQuality(normalized.buffer);
    const row = await buildClubRow(clubName, decoded.buffer, normalized.buffer);
    const safeName = clubName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const outputPath = join(input.outputDirectory, `${safeName}_row.png`);
    await writeFile(outputPath, row);

    if (clubName === "HNK Croatia Basel") {
      const large = await sharp(row).resize({ width: PANEL_WIDTH * 3 * 2 }).png().toBuffer();
      await writeFile(join(input.outputDirectory, `${safeName}_large_comparison.png`), large);
    }

    rows.push({
      clubName,
      quality: quality?.classification ?? "unknown",
      outputPath,
    });
    rowBuffers.push(row);
  }

  let contactSheetPath: string | null = null;
  if (rowBuffers.length > 0) {
    const rowHeight = PANEL_HEIGHT + LABEL_HEIGHT;
    const sheetHeight = rowHeight * rowBuffers.length;
    const composites = rowBuffers.map((buffer, index) => ({
      input: buffer,
      top: index * rowHeight,
      left: 0,
    }));

    const sheet = await sharp({
      create: {
        width: PANEL_WIDTH * 3,
        height: sheetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    contactSheetPath = join(input.outputDirectory, "media-logo-01f-contact-sheet.png");
    await writeFile(contactSheetPath, sheet);
  }

  return {
    outputDirectory: input.outputDirectory,
    rows,
    contactSheetPath,
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[media-logo-01f-visual-qa] ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const outputDirectory = join("/opt/cursor/artifacts", "media-logo-01f-visual-qa");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const plan = await runProviderLogoBackfillDryRun(prisma);
    const report = await generateVisualQaContactSheet({
      candidates: plan.candidates,
      outputDirectory,
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && process.argv[1].endsWith("media-logo-01f-visual-qa.ts");

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[media-logo-01f-visual-qa] FATAL: ${message}`);
    process.exit(1);
  });
}
