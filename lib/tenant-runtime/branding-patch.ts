/**
 * Shared Branding PATCH Body Parser — canonical single source of truth.
 *
 * Used by every API route that accepts a branding update:
 *   - PATCH /api/branding         (self-service; USERS_MANAGE)
 *   - PATCH /api/tenants/[slug]   (super-admin; TENANTS_MANAGE — branding fields only)
 *
 * Parses { logoUrl?, primaryColor?, secondaryColor? } from a raw request body,
 * applies consistent normalisation (toLowerCase for hex), validates hex colors
 * via the canonical isValidHexColor(), and returns a typed result.
 *
 * Design:
 * - Callers own the "no fields" / empty-patch guard — this parser succeeds with
 *   an empty data object when none of the three branding keys are present.
 * - Does NOT validate that a tenant exists, is active, or is accessible — that
 *   is the caller's responsibility.
 * - Safe to import from server routes only (no browser bundle impact).
 */

import { isValidHexColor } from "./branding-validation";

export type BrandingPatchData = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export type BrandingPatchResult =
  | { ok: true; data: BrandingPatchData }
  | { ok: false; error: string };

/**
 * Parses branding fields from a raw JSON body object.
 *
 * Rules:
 *   - Field absent from body → not included in data (no-op for that field).
 *   - null or empty string → stored as null (clear the value).
 *   - Non-empty string after trim → validated; hex colors normalised to lowercase.
 *   - Invalid hex color → { ok: false } with a descriptive German error message.
 */
export function parseBrandingPatch(body: Record<string, unknown>): BrandingPatchResult {
  const data: BrandingPatchData = {};

  if ("logoUrl" in body) {
    const raw = body.logoUrl;
    if (raw === null || raw === "") {
      data.logoUrl = null;
    } else {
      const v = String(raw).trim();
      data.logoUrl = v || null;
    }
  }

  if ("primaryColor" in body) {
    const raw = body.primaryColor;
    if (raw === null || raw === "") {
      data.primaryColor = null;
    } else {
      const v = String(raw).trim().toLowerCase();
      if (!isValidHexColor(v)) {
        return {
          ok: false,
          error: "primaryColor muss ein gültiger 6-stelliger Hex-Farbwert sein (z.B. #0b4aa2).",
        };
      }
      data.primaryColor = v;
    }
  }

  if ("secondaryColor" in body) {
    const raw = body.secondaryColor;
    if (raw === null || raw === "") {
      data.secondaryColor = null;
    } else {
      const v = String(raw).trim().toLowerCase();
      if (!isValidHexColor(v)) {
        return {
          ok: false,
          error: "secondaryColor muss ein gültiger 6-stelliger Hex-Farbwert sein (z.B. #c7332c).",
        };
      }
      data.secondaryColor = v;
    }
  }

  return { ok: true, data };
}
