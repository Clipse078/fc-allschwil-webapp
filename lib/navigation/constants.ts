/**
 * lib/navigation/constants.ts
 *
 * Single source of truth for all navigation domain constants.
 *
 * Rules:
 *  - Import from here whenever navigation area, link type, target, or
 *    visibility mode strings are needed — never hardcode these values.
 *  - Labels are German (admin UI language).
 *  - No logic lives here — only data definitions.
 */

// ---------------------------------------------------------------------------
// Navigation area
// ---------------------------------------------------------------------------

export const NAV_AREA = {
  HEADER: "HEADER",
  FOOTER: "FOOTER",
  UTILITY: "UTILITY",
} as const;

export type NavArea = (typeof NAV_AREA)[keyof typeof NAV_AREA];

export const NAV_AREA_LABEL: Record<NavArea, string> = {
  HEADER: "Hauptnavigation (Header)",
  FOOTER: "Footer-Navigation",
  UTILITY: "Utility-Navigation",
};

export const NAV_AREA_SHORT_LABEL: Record<NavArea, string> = {
  HEADER: "Header",
  FOOTER: "Footer",
  UTILITY: "Utility",
};

/** Ordered list of areas for consistent display in the admin UI. */
export const NAV_AREA_ORDER: NavArea[] = [
  NAV_AREA.HEADER,
  NAV_AREA.FOOTER,
  NAV_AREA.UTILITY,
];

// ---------------------------------------------------------------------------
// Link type
// ---------------------------------------------------------------------------

export const NAV_LINK_TYPE = {
  INTERNAL: "INTERNAL",
  EXTERNAL: "EXTERNAL",
  CUSTOM: "CUSTOM",
} as const;

export type NavLinkType = (typeof NAV_LINK_TYPE)[keyof typeof NAV_LINK_TYPE];

export const NAV_LINK_TYPE_LABEL: Record<NavLinkType, string> = {
  INTERNAL: "Interner Link (Pfad)",
  EXTERNAL: "Externer Link (URL)",
  CUSTOM: "Eigener Link",
};

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

export const NAV_TARGET = {
  SELF: "SELF",
  BLANK: "BLANK",
} as const;

export type NavTarget = (typeof NAV_TARGET)[keyof typeof NAV_TARGET];

export const NAV_TARGET_LABEL: Record<NavTarget, string> = {
  SELF: "Gleicher Tab",
  BLANK: "Neuer Tab",
};

// ---------------------------------------------------------------------------
// Visibility mode
// ---------------------------------------------------------------------------

export const NAV_VISIBILITY_MODE = {
  ALWAYS: "ALWAYS",
  AUTHENTICATED: "AUTHENTICATED",
  ANONYMOUS: "ANONYMOUS",
} as const;

export type NavVisibilityMode =
  (typeof NAV_VISIBILITY_MODE)[keyof typeof NAV_VISIBILITY_MODE];

export const NAV_VISIBILITY_MODE_LABEL: Record<NavVisibilityMode, string> = {
  ALWAYS: "Immer sichtbar",
  AUTHENTICATED: "Nur eingeloggte Nutzer",
  ANONYMOUS: "Nur anonyme Nutzer",
};

// ---------------------------------------------------------------------------
// Depth limits
// ---------------------------------------------------------------------------

/** Maximum nesting depth for navigation items (root = depth 0, child = depth 1). */
export const NAV_MAX_DEPTH = 2;
