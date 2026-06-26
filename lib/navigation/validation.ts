/**
 * lib/navigation/validation.ts
 *
 * Validation helpers for navigation item fields.
 *
 * Rules:
 *  - All validators return a string error message on failure, or null on success.
 *  - URL validation is intentionally lenient (no regex library dependency).
 *  - Internal paths must start with /.
 *  - External URLs must start with https:// or http://.
 *  - Custom links may be any non-empty string.
 */

import { NAV_LINK_TYPE, type NavLinkType } from "./constants";

// ---------------------------------------------------------------------------
// URL / href validators
// ---------------------------------------------------------------------------

/**
 * Validates an href value based on the link type.
 * Returns null when valid, or an error string when invalid.
 */
export function validateNavHref(
  href: string | null | undefined,
  linkType: NavLinkType,
): string | null {
  // Null/empty href is acceptable for CUSTOM (parent-only items with no link)
  if (!href || href.trim() === "") {
    if (linkType === NAV_LINK_TYPE.CUSTOM) return null;
    return "Der Link darf nicht leer sein.";
  }

  const trimmed = href.trim();

  switch (linkType) {
    case NAV_LINK_TYPE.INTERNAL: {
      if (!trimmed.startsWith("/")) {
        return "Interne Links müssen mit / beginnen (z.B. /news).";
      }
      // Prevent protocol injection
      if (trimmed.includes("://")) {
        return "Interne Links dürfen kein Protokoll enthalten. Verwende einen relativen Pfad (z.B. /news).";
      }
      return null;
    }
    case NAV_LINK_TYPE.EXTERNAL: {
      if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
        return "Externe Links müssen mit https:// oder http:// beginnen.";
      }
      // Basic sanity check — must have a host part
      try {
        const url = new URL(trimmed);
        if (!url.hostname) {
          return "Der externe Link enthält keinen gültigen Host.";
        }
      } catch {
        return "Der externe Link ist keine gültige URL.";
      }
      return null;
    }
    case NAV_LINK_TYPE.CUSTOM: {
      return null; // Any non-empty string is valid for CUSTOM
    }
    default: {
      return "Unbekannter Link-Typ.";
    }
  }
}

/**
 * Normalises an href value:
 *  - Trims whitespace.
 *  - Returns null for empty strings.
 */
export function normaliseNavHref(href: string | null | undefined): string | null {
  if (!href || href.trim() === "") return null;
  return href.trim();
}

// ---------------------------------------------------------------------------
// Label validation
// ---------------------------------------------------------------------------

export function validateNavLabel(label: string | null | undefined): string | null {
  if (!label || label.trim() === "") {
    return "Das Label darf nicht leer sein.";
  }
  if (label.trim().length > 120) {
    return "Das Label darf maximal 120 Zeichen lang sein.";
  }
  return null;
}
