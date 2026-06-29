-- CMS V4.2a — News Rich Text Foundation
--
-- Adds a nullable JSON column to NewsArticle for storing structured TipTap /
-- ProseMirror content from the shared RichTextEditor.
--
-- Changes (additive only, zero destructive operations):
--   1. NewsArticle — add contentJson JSONB column (nullable, no default).
--
-- Backward compatibility:
--   - contentJson is nullable; existing rows keep NULL — no data loss.
--   - content (plain text / Markdown) column is unchanged and remains in place.
--   - No data is rewritten, no columns are dropped.
--   - Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.

-- ── 1. Add contentJson to NewsArticle ─────────────────────────────────────────

ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "contentJson" JSONB;
