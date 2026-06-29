/**
 * lib/news/news-content.ts
 *
 * Centralised content resolution for NewsArticle.
 *
 * Rendering priority:
 *   1. contentJson (structured TipTap/ProseMirror JSON) → richTextToHtml()
 *   2. content     (legacy Markdown / plain-text string) → returned as-is
 *   3. empty string
 *
 * Consumers (public API, renderers) import this helper to apply the priority
 * consistently without duplicating logic.
 */

import { isRichTextValue, richTextToHtml, type RichTextValue } from "@/lib/cms/rich-text";

export type NewsContentSource = {
  contentJson: unknown;
  content: string;
};

/**
 * Resolves the canonical HTML for a news article.
 *
 * - If contentJson is a valid RichTextValue, returns rendered HTML.
 * - Otherwise, returns the legacy content string (plain text / Markdown).
 * - If neither exists, returns an empty string.
 */
export function resolveNewsContentHtml(source: NewsContentSource): string {
  if (isRichTextValue(source.contentJson)) {
    return richTextToHtml(source.contentJson as RichTextValue);
  }
  return source.content ?? "";
}

/**
 * Returns true when the article has structured rich-text content
 * (i.e. contentJson is set and valid).
 */
export function newsArticleHasRichText(source: NewsContentSource): boolean {
  return isRichTextValue(source.contentJson);
}
