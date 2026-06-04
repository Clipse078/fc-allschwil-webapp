/**
 * lib/website/slug-utils.ts
 *
 * Shared slug generation utility for website news articles.
 * Client-safe: no Prisma imports, no server-only dependencies.
 * Imported by both WebsiteNewsForm (client) and news-queries (server).
 */

/**
 * Generates a URL-safe slug from a title string.
 * Replaces German umlauts, collapses non-alphanumeric runs to hyphens,
 * strips leading/trailing hyphens, and truncates at 80 characters.
 */
export function generateNewsSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
