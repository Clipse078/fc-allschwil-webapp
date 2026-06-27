/**
 * lib/homepage/config-schemas.ts
 *
 * Zod validation schemas for each homepage section type's config object.
 *
 * Rules:
 *   - Each schema uses `.strict()` — unknown keys are rejected with a
 *     clear error message.
 *   - All fields are optional; an empty object is always valid.
 *   - String fields have sensible max-length limits to prevent abuse.
 *   - Number fields enforce the same ranges documented in section-types.ts
 *     and docs/cms-block-library.md.
 *
 * Usage:
 *   import { validateSectionConfig } from "@/lib/homepage/config-schemas";
 *   const result = validateSectionConfig("hero", rawConfig);
 *   if (!result.success) { ... result.errors }
 */

import { z } from "zod";
import type { HomepageSectionTypeKey } from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Per-type config schemas
// ---------------------------------------------------------------------------

export const heroConfigSchema = z
  .object({
    title: z.string().max(200).optional(),
    subtitle: z.string().max(500).optional(),
    ctaLabel: z.string().max(100).optional(),
    ctaUrl: z.string().max(2000).optional(),
  })
  .strict();

export const newsTeaserConfigSchema = z
  .object({
    itemCount: z.number().int().min(1).max(10).optional(),
    heading: z.string().max(200).optional(),
  })
  .strict();

export const eventsTeaserConfigSchema = z
  .object({
    itemCount: z.number().int().min(1).max(20).optional(),
    surface: z.enum(["homepage", "all"]).optional(),
    heading: z.string().max(200).optional(),
  })
  .strict();

export const teamsTeaserConfigSchema = z
  .object({
    itemCount: z.number().int().min(1).max(20).optional(),
    seasonKey: z.string().max(100).optional(),
    heading: z.string().max(200).optional(),
  })
  .strict();

export const sponsorsTeaserConfigSchema = z
  .object({
    heading: z.string().max(200).optional(),
  })
  .strict();

export const weekplanTeaserConfigSchema = z
  .object({
    heading: z.string().max(200).optional(),
  })
  .strict();

export const callToActionConfigSchema = z
  .object({
    title: z.string().max(200).optional(),
    body: z.string().max(2000).optional(),
    primaryLabel: z.string().max(100).optional(),
    primaryUrl: z.string().max(2000).optional(),
    secondaryLabel: z.string().max(100).optional(),
    secondaryUrl: z.string().max(2000).optional(),
  })
  .strict();

export const customContentPlaceholderConfigSchema = z.object({}).strict();

// ---------------------------------------------------------------------------
// splitContentCards schema
// ---------------------------------------------------------------------------

const richTextValueSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  })
  .nullable()
  .optional();

const splitContentCardSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(200),
  body: z.string().max(2000),
  variant: z.enum(["orange", "blue", "red", "neutral"]),
  icon: z.string().max(50).optional(),
});

const splitContentImageRefSchema = z.object({
  mediaAssetId: z.string().max(200),
  alt: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
});

const splitContentStyleSchema = z
  .object({
    theme: z.enum(["light", "soft", "dark", "club"]).optional(),
    spacingTop: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    spacingBottom: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    width: z.enum(["narrow", "normal", "wide", "full"]).optional(),
    alignment: z.enum(["left", "center"]).optional(),
  })
  .optional();

const splitContentBackgroundSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("none") }),
    z.object({ type: z.literal("solid"), color: z.string().max(50) }),
    z.object({ type: z.literal("gradient"), gradientPreset: z.string().max(100) }),
    z.object({
      type: z.literal("image"),
      mediaAssetId: z.string().max(200),
      overlay: z.enum(["none", "light", "dark"]),
    }),
  ])
  .optional();

export const splitContentCardsConfigSchema = z.object({
  eyebrow: z.string().max(200).optional(),
  headline: z.string().max(300).optional(),
  bodyRichText: richTextValueSchema,
  layout: z
    .enum(["TEXT_LEFT_CARDS_RIGHT", "CARDS_LEFT_TEXT_RIGHT"])
    .optional(),
  mediaPlacement: z
    .enum(["NONE", "WITH_TEXT", "WITH_CARDS", "OPPOSITE_TEXT"])
    .optional(),
  images: z.array(splitContentImageRefSchema).max(10).optional(),
  cards: z.array(splitContentCardSchema).max(20).optional(),
  style: splitContentStyleSchema,
  background: splitContentBackgroundSchema,
});

// ---------------------------------------------------------------------------
// Schema map by type key
// ---------------------------------------------------------------------------

export const CONFIG_SCHEMAS = {
  hero: heroConfigSchema,
  newsTeaser: newsTeaserConfigSchema,
  eventsTeaser: eventsTeaserConfigSchema,
  teamsTeaser: teamsTeaserConfigSchema,
  sponsorsTeaser: sponsorsTeaserConfigSchema,
  weekplanTeaser: weekplanTeaserConfigSchema,
  callToAction: callToActionConfigSchema,
  splitContentCards: splitContentCardsConfigSchema,
  customContentPlaceholder: customContentPlaceholderConfigSchema,
} as const satisfies Record<HomepageSectionTypeKey, z.ZodTypeAny>;

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

export type ConfigValidationResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; errors: string[] };

/**
 * Validates a raw config object against the Zod schema for the given
 * section type. Returns a typed result with either the parsed data or
 * a flat list of human-readable error messages.
 *
 * Returns `{ success: false, errors: ["Unbekannter Sektionstyp."] }` for
 * unrecognised type keys — callers should 400 in that case.
 */
export function validateSectionConfig(
  type: string,
  rawConfig: unknown,
): ConfigValidationResult {
  const schema = CONFIG_SCHEMAS[type as HomepageSectionTypeKey];
  if (!schema) {
    return { success: false, errors: ["Unbekannter Sektionstyp."] };
  }

  const result = schema.safeParse(rawConfig);
  if (!result.success) {
    const flat = result.error.flatten();
    const msgs: string[] = [
      ...flat.formErrors,
      ...Object.entries(flat.fieldErrors).flatMap(([key, errs]) =>
        (errs ?? []).map((e: string) => `${key}: ${e}`),
      ),
    ];
    return { success: false, errors: msgs.length > 0 ? msgs : ["Ungültige Konfiguration."] };
  }

  return { success: true, data: result.data as Record<string, unknown> };
}
