/**
 * lib/cms/layout-schemas.ts
 *
 * Shared Zod validation schema for SectionLayout.
 *
 * Used by every block config schema in lib/homepage/config-schemas.ts
 * to validate the `_layout` field that each block's JSON config may carry.
 *
 * Import sectionLayoutSchema and add it as:
 *   _layout: sectionLayoutSchema,
 * to any block config schema.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const sectionWidthSchema = z
  .enum(["narrow", "normal", "wide", "full"])
  .optional();

export const sectionSpacingSchema = z
  .enum(["none", "sm", "md", "lg", "xl"])
  .optional();

export const sectionThemeSchema = z
  .enum(["light", "soft", "dark", "club"])
  .optional();

export const sectionHAlignSchema = z
  .enum(["left", "center", "right"])
  .optional();

export const sectionVAlignSchema = z
  .enum(["top", "center", "bottom", "stretch"])
  .optional();

export const sectionColumnsSchema = z
  .enum(["single", "50/50", "33/66", "66/33", "25/75", "75/25"])
  .optional();

export const sectionBackgroundSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("none") }),
    z.object({ type: z.literal("solid"), color: z.string().max(50) }),
    z.object({
      type: z.literal("gradient"),
      gradientPreset: z.string().max(100),
    }),
    z.object({
      type: z.literal("image"),
      mediaAssetId: z.string().max(200),
      overlay: z.enum(["none", "light", "dark"]),
      overlayOpacity: z.number().int().min(0).max(100).optional(),
      /** Focal point set by FocalPointControl (Slice K). 0–100 per axis. */
      position: z
        .object({
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
        })
        .optional(),
      /**
       * Zoom level set by zoom slider in FocalPointControl (Slice K.1). 100–200.
       * 100 = cover (default). Values above 100 scale the image proportionally.
       */
      zoom: z.number().min(100).max(200).optional(),
    }),
  ])
  .optional();

export const sectionResponsiveSchema = z
  .object({
    stackOnMobile: z.boolean().optional(),
    reverseStackOnMobile: z.boolean().optional(),
    hideImageOnMobile: z.boolean().optional(),
    equalHeights: z.boolean().optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// Canonical shared layout schema
// ---------------------------------------------------------------------------

/**
 * Validates a SectionLayout object.
 *
 * All fields are optional. An empty object `{}` is always valid and renders
 * with DEFAULT_SECTION_LAYOUT values applied by the renderer/SectionShell.
 */
export const sectionLayoutSchema = z
  .object({
    width: sectionWidthSchema,
    spacingTop: sectionSpacingSchema,
    spacingBottom: sectionSpacingSchema,
    paddingX: sectionSpacingSchema,
    theme: sectionThemeSchema,
    hAlign: sectionHAlignSchema,
    vAlign: sectionVAlignSchema,
    columns: sectionColumnsSchema,
    background: sectionBackgroundSchema,
    responsive: sectionResponsiveSchema,
  })
  .optional();

export type SectionLayoutInput = z.infer<typeof sectionLayoutSchema>;
