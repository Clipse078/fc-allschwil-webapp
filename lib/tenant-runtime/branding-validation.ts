/**
 * Canonical Branding Validation — Slice 10.9
 *
 * Single source of truth for all client-side branding field validation.
 * Used by BrandingPreviewCard, form helpers, and any future branding UI.
 *
 * ─── Principles ─────────────────────────────────────────────────────────────
 *
 * - One validator per field type. No duplication across components.
 * - Pure functions — no DOM, no React, no prisma.
 * - Safe to import from client or server components.
 * - API-side validation remains in app/api/tenants/[tenantSlug]/route.ts.
 *   These helpers mirror that logic for immediate UI feedback only.
 */

// ── Hex color ─────────────────────────────────────────────────────────────────

/** Matches a 6-digit hex color: #rrggbb (upper or lowercase). */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Returns true when `value` is a valid 6-digit hex color string.
 * Null / undefined / empty string → false (treat as "not configured").
 */
export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return HEX_COLOR_RE.test(value.trim());
}

// ── Logo URL ──────────────────────────────────────────────────────────────────

/**
 * Returns true when `value` is a plausible logo URL.
 *
 * Accepts:
 *   • Absolute HTTP/HTTPS URLs (https://cdn.example.com/logo.svg)
 *   • Root-relative paths (/images/logo.png)
 *
 * Rejects null, empty string, and strings that cannot be parsed as URL/path.
 * No network request is made — format check only.
 */
export function isValidLogoUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;

  // Root-relative path: /something
  if (v.startsWith("/")) return v.length > 1;

  // Absolute URL
  try {
    const url = new URL(v);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

export type BrandingHealthItem = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type BrandingHealth = {
  items: BrandingHealthItem[];
  /** true when every item is ok */
  allOk: boolean;
  /** true when at least one item is ok */
  anyOk: boolean;
};

/**
 * Returns a structured branding health report for the given raw branding fields.
 *
 * Intended use: BrandingPreviewCard health status display.
 * Pass the raw nullable fields directly — resolution/fallbacks are NOT applied
 * here so the report reflects what the tenant has actually configured.
 *
 * @example
 *   const health = getBrandingHealth({ logoUrl, primaryColor, secondaryColor });
 *   // health.items → [{ label: "Logo configured", ok: true }, ...]
 */
export function getBrandingHealth(cfg: {
  logoUrl: string | null | undefined;
  primaryColor: string | null | undefined;
  secondaryColor: string | null | undefined;
}): BrandingHealth {
  const items: BrandingHealthItem[] = [
    {
      label: "Logo configured",
      ok: isValidLogoUrl(cfg.logoUrl),
      detail: cfg.logoUrl ? undefined : "No logoUrl set — fallback icon shown.",
    },
    {
      label: "Primary color configured",
      ok: isValidHexColor(cfg.primaryColor),
      detail: cfg.primaryColor
        ? isValidHexColor(cfg.primaryColor)
          ? cfg.primaryColor
          : "Invalid hex value"
        : "Using platform default.",
    },
    {
      label: "Secondary color configured",
      ok: isValidHexColor(cfg.secondaryColor),
      detail: cfg.secondaryColor
        ? isValidHexColor(cfg.secondaryColor)
          ? cfg.secondaryColor
          : "Invalid hex value"
        : "Using platform default.",
    },
  ];

  return {
    items,
    allOk: items.every((i) => i.ok),
    anyOk: items.some((i) => i.ok),
  };
}
