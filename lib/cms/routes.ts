/**
 * lib/cms/routes.ts
 *
 * Single source of truth for all CMS / Website Management route definitions.
 *
 * Rules:
 *  - Import from here wherever a CMS route is referenced — never hardcode.
 *  - Keys are stable identifiers; hrefs may evolve independently.
 *  - Permissions are informational only — enforcement lives in page.tsx files.
 */

export const CMS_ROUTES = {
  // ── Hub ────────────────────────────────────────────────────────────────────
  overview: "/dashboard/website",

  // ── Content ────────────────────────────────────────────────────────────────
  news: "/dashboard/website/news",
  newsNew: "/dashboard/website/news/new",
  pages: "/dashboard/website/pages",
  pagesNew: "/dashboard/website/pages/new",
  media: "/dashboard/website/media",

  // ── Publishing ─────────────────────────────────────────────────────────────
  publishing: "/dashboard/website/publishing",

  // ── Configuration ──────────────────────────────────────────────────────────
  settings: "/dashboard/website/settings",
} as const;

export type CmsRouteKey = keyof typeof CMS_ROUTES;
