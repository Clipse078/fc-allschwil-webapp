-- MATCH-RESULTS-01 — Canonical Match Results Foundation
--
-- Extends EventStatus enum with two new terminal match states required
-- for provider-neutral canonical result representation.
--
-- ABANDONED: Match started but was stopped before completion. The partial
--   or voided result is preserved at the provider level. Canonical score
--   may or may not be valid depending on competition rules.
--
-- FORFEITED: Match result decided administratively (ineligible player,
--   no-show, protest upheld). Canonical score applies as assigned.
--
-- Additive only: no existing rows are affected.
-- Zero downtime: PostgreSQL ALTER TYPE ADD VALUE does not rewrite the table.

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'FORFEITED';
