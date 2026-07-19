-- Workspace folder sibling-name uniqueness
--
-- Adds a database-level guarantee that no two active (archivedAt IS NULL)
-- folders in the same parent scope share the same name, regardless of case
-- or surrounding whitespace.
--
-- Root folders have parentId = NULL.  A standard composite UNIQUE constraint
-- on (tenantId, parentId, LOWER(TRIM(name))) would not catch root-level
-- duplicates because PostgreSQL treats two NULL values as distinct in a
-- UNIQUE index.  The COALESCE trick replaces NULL with '' (empty string)
-- so root folders are compared within the same key space as child folders.
--
-- The partial index (WHERE "archivedAt" IS NULL) means archived folders do
-- not block reuse of their name by a new active folder.
--
-- ─────────────────────────────────────────────────────────────────────────
-- BEFORE APPLYING THIS MIGRATION run the following READ-ONLY diagnostic
-- to check for any existing duplicate sibling names in the live database.
-- If the query returns rows, those duplicates must be resolved manually
-- before this migration can succeed.
--
--   SELECT
--     "tenantId",
--     COALESCE("parentId", '(root)') AS "parentScope",
--     LOWER(TRIM("name"))            AS "normalizedName",
--     COUNT(*)                       AS "duplicateCount",
--     ARRAY_AGG("id" ORDER BY "createdAt") AS "folderIds"
--   FROM "WorkspaceFolder"
--   WHERE "archivedAt" IS NULL
--   GROUP BY "tenantId", COALESCE("parentId", ''), LOWER(TRIM("name"))
--   HAVING COUNT(*) > 1;
--
-- ─────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "WorkspaceFolder_sibling_name_unique_idx"
  ON "WorkspaceFolder" (
    "tenantId",
    COALESCE("parentId", ''),
    LOWER(TRIM("name"))
  )
  WHERE "archivedAt" IS NULL;
