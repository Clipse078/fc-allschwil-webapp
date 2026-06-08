-- ═══════════════════════════════════════════════════════════════════════════════
-- STAGE DB PATCH: Add registrations.view + registrations.edit permissions
-- Target DB   : STAGE_DB_URL  (ep-silent-bird-a9c00txa / runtime DATABASE_URL)
-- Author      : Cursor Agent  2026-06-08
-- Safe to run : YES — fully idempotent via ON CONFLICT DO NOTHING
-- Touches     : Permission (2 rows), RolePermission (6 rows max)
-- Does NOT    : delete, update, or alter any existing row
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── SECTION 0: PREFLIGHT (read-only, run first, expect 0 rows) ───────────────

-- 0a. Confirm permissions do NOT yet exist (expect 0 rows → safe to proceed)
SELECT 'PRE: registrations permissions present' AS check_name, COUNT(*) AS count
FROM "Permission"
WHERE key IN ('registrations.view', 'registrations.edit');

-- 0b. Confirm all 3 target roles exist (expect exists = true for all 3)
SELECT r.key, r.name, r.id IS NOT NULL AS "exists"
FROM (VALUES
    ('super_admin'),
    ('club_admin'),
    ('koordinator_neu_anmeldungen')
) AS t(key)
LEFT JOIN "Role" r ON r.key = t.key
ORDER BY t.key;

-- 0c. Confirm REGISTRATIONS enum value is usable (expect 1 row)
SELECT 'REGISTRATIONS'::\"PermissionModule\" AS enum_check;

-- 0d. Confirm 0 RolePermission links for registrations.* already exist
SELECT r.key AS role_key, p.key AS perm_key
FROM "RolePermission" rp
JOIN "Role"       r ON r.id = rp."roleId"
JOIN "Permission" p ON p.id = rp."permissionId"
WHERE p.key IN ('registrations.view', 'registrations.edit')
ORDER BY r.key, p.key;


-- ── SECTION 1: THE PATCH ─────────────────────────────────────────────────────
-- Execute only after confirming SECTION 0 checks look correct.

BEGIN;

-- Step 1: Insert the two Permission rows.
-- ON CONFLICT (key) DO NOTHING makes this safe to re-run.
-- gen_random_uuid()::text is used for the id to guarantee uniqueness;
-- the value is text-typed (matching the CUID pattern used elsewhere).
INSERT INTO "Permission" (id, key, name, module, "createdAt", "updatedAt")
VALUES
    (
        gen_random_uuid()::text,
        'registrations.view',
        'View registrations',
        'REGISTRATIONS'::"PermissionModule",
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid()::text,
        'registrations.edit',
        'Edit registrations',
        'REGISTRATIONS'::"PermissionModule",
        NOW(),
        NOW()
    )
ON CONFLICT (key) DO NOTHING;

-- Step 2: Link both permissions to the 3 target roles.
-- Uses a CROSS JOIN so all 6 combinations (3 roles × 2 permissions) are covered.
-- ON CONFLICT ("roleId", "permissionId") DO NOTHING makes this safe to re-run.
INSERT INTO "RolePermission" (id, "roleId", "permissionId", "createdAt")
SELECT
    gen_random_uuid()::text AS id,
    r.id                    AS "roleId",
    p.id                    AS "permissionId",
    NOW()                   AS "createdAt"
FROM "Role"       r
CROSS JOIN "Permission" p
WHERE r.key IN ('super_admin', 'club_admin', 'koordinator_neu_anmeldungen')
  AND p.key IN ('registrations.view', 'registrations.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;


-- ── SECTION 2: POSTFLIGHT (run immediately after COMMIT) ─────────────────────

-- 2a. Confirm both Permission rows now exist (expect 2 rows)
SELECT 'POST: registrations permissions' AS check_name,
       key, module, "createdAt"
FROM "Permission"
WHERE key IN ('registrations.view', 'registrations.edit')
ORDER BY key;

-- 2b. Confirm all 6 RolePermission links were created (expect 6 rows)
SELECT r.key AS role_key, p.key AS perm_key, rp."createdAt"
FROM "RolePermission" rp
JOIN "Role"       r ON r.id = rp."roleId"
JOIN "Permission" p ON p.id = rp."permissionId"
WHERE p.key IN ('registrations.view', 'registrations.edit')
ORDER BY r.key, p.key;

-- 2c. Confirm admin user's full permission set includes registrations (expect 38+ rows)
SELECT p.key AS effective_permission
FROM "User"           u
JOIN "UserRole"       ur ON ur."userId" = u.id
JOIN "Role"           r  ON r.id        = ur."roleId"
JOIN "RolePermission" rp ON rp."roleId" = r.id
JOIN "Permission"     p  ON p.id        = rp."permissionId"
WHERE u.email = 'admin@fcallschwil.ch'
ORDER BY p.key;


-- ── SECTION 3: ROLLBACK (only if you need to undo) ──────────────────────────
-- Run these statements ONLY if you want to revert the patch.
-- They are NOT part of the forward patch — do not run them during normal apply.

-- ROLLBACK_BEGIN (do not uncomment unless reverting):
-- BEGIN;
--
-- DELETE FROM "RolePermission"
-- WHERE "permissionId" IN (
--     SELECT id FROM "Permission"
--     WHERE key IN ('registrations.view', 'registrations.edit')
-- );
--
-- DELETE FROM "Permission"
-- WHERE key IN ('registrations.view', 'registrations.edit');
--
-- COMMIT;
-- ROLLBACK_END
