/**
 * lib/cms/types.ts
 *
 * Shared CMS feature status types and display helpers.
 *
 * Used across the CMS hub overview and any future CMS dashboards.
 * Status values represent the readiness of each CMS capability.
 */

/**
 * Readiness level of a CMS capability card.
 *
 *  available          — fully functional, usable today
 *  foundation         — data model + workflow exists, UX may be basic
 *  coming_next        — planned for the next roadmap slice
 *  future             — longer-term roadmap item, not yet scheduled
 */
export type CmsFeatureStatus = "available" | "foundation" | "coming_next" | "future";

export type CmsFeatureSection =
  | "content"
  | "publishing"
  | "structure"
  | "governance"
  | "configuration";

export type CmsFeature = {
  key: string;
  label: string;
  description: string;
  status: CmsFeatureStatus;
  href?: string;
  /** Permission keys required to access this feature (informational). */
  requiredPermissions?: string[];
};

export type CmsSection = {
  key: CmsFeatureSection;
  label: string;
  description: string;
  features: CmsFeature[];
};

// ── Display helpers ───────────────────────────────────────────────────────────

export const CMS_STATUS_LABEL: Record<CmsFeatureStatus, string> = {
  available: "Verfügbar",
  foundation: "Foundation",
  coming_next: "Kommt als nächstes",
  future: "Roadmap",
};

export const CMS_STATUS_BADGE_CLASS: Record<CmsFeatureStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  foundation: "bg-blue-50 text-blue-700 border-blue-200",
  coming_next: "bg-amber-50 text-amber-700 border-amber-200",
  future: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
};

export const CMS_STATUS_DOT_CLASS: Record<CmsFeatureStatus, string> = {
  available: "bg-emerald-500",
  foundation: "bg-blue-500",
  coming_next: "bg-amber-500",
  future: "bg-gray-300",
};
