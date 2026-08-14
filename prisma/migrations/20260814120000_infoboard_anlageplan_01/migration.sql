-- Migration: 20260814120000_infoboard_anlageplan_01
--
-- INFOBOARD-MAP-01: Anlageplan Designer
--
-- Adds two columns to Infoboard for the Anlageplan (facility map) mode:
--
--   anlageplanBackgroundUrl  — Vercel Blob CDN URL of the uploaded site-plan
--                              image. null = no image uploaded yet.
--
--   anlageplanJson           — AnlageplanConfig v1 JSON: map elements
--                              (ResourceZone + Marker) with normalized
--                              coordinates relative to the 16:9 canvas.
--                              null = no configuration yet (designer not
--                              opened or cleared).
--
-- Backward compatible: both columns default to null.
-- templateType "ANLAGENUEBERSICHT" was already supported in the type enum
-- (lib/infoboard/types.ts) — only the kiosk rendering and config storage
-- were missing. No data migration needed.

ALTER TABLE "Infoboard" ADD COLUMN "anlageplanBackgroundUrl" TEXT;
ALTER TABLE "Infoboard" ADD COLUMN "anlageplanJson"          TEXT;
