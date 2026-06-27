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
  homepage: "/dashboard/website/homepage",
  blocks: "/dashboard/website/blocks",

  // ── Publishing ─────────────────────────────────────────────────────────────
  publishing: "/dashboard/website/publishing",

  // ── Editorial Center ───────────────────────────────────────────────────────
  editorial: "/dashboard/website/editorial",

  // ── Review ─────────────────────────────────────────────────────────────────
  review: "/dashboard/website/review",

  // ── Structure ──────────────────────────────────────────────────────────────
  navigation: "/dashboard/website/navigation",

  // ── Reusable Components ────────────────────────────────────────────────────
  components: "/dashboard/website/components",
  componentsNew: "/dashboard/website/components/new",

  // ── Configuration ──────────────────────────────────────────────────────────
  settings: "/dashboard/website/settings",
} as const;

/**
 * Generates the edit URL for a reusable component.
 */
export function componentEditHref(componentId: string): string {
  return `/dashboard/website/components/${componentId}/edit`;
}

/**
 * Generates the Page Builder URL for a given page ID.
 * Used wherever a "Builder" action link is needed for a page.
 */
export function pageBuilderHref(pageId: string): string {
  return `/dashboard/website/pages/${pageId}/builder`;
}

/**
 * Generates the News article edit URL for a given article ID.
 */
export function newsEditHref(newsId: string): string {
  return `/dashboard/website/news/${newsId}/edit`;
}

export type CmsRouteKey = keyof typeof CMS_ROUTES;
