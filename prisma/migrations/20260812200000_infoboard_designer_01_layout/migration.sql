-- Migration: 20260812200000_infoboard_designer_01_layout
--
-- Adds layoutJson to Infoboard for Designer-01 widget layout persistence.
-- Stores InboardLayout v1 JSON: widget instances with type, enabled,
-- position, size, variant, and settings.
--
-- null = use getDefaultLayout() derived from flat fields (backward compatible).

ALTER TABLE "Infoboard" ADD COLUMN "layoutJson" TEXT;
