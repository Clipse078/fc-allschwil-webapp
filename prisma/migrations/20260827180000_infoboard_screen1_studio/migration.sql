-- Migration artifact only — NOT applied to STAGE.
-- Screen-1 Studio per-card overrides and soft pagination preferences.
-- JSON may include softBreakAfterKeys (stable predecessor display-item keys).

ALTER TABLE "Infoboard" ADD COLUMN "screen1StudioJson" TEXT;
