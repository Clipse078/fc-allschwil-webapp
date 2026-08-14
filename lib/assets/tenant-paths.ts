/**
 * Canonical Tenant Asset Path / Key Helpers — Slice 10.10
 *
 * Single source of truth for tenant-scoped asset key and public URL
 * construction. No call site builds paths directly — import from here.
 *
 * ─── Storage-adapter-ready, not runtime-write-ready ──────────────────────────
 *
 * These helpers define the naming convention for tenant assets so that a
 * future persistent storage adapter (Vercel Blob, S3-compatible, etc.) has
 * a canonical key format to write to and read from.
 *
 * What is NOT here (intentionally):
 *   - No fs.writeFile / fs.mkdir calls.
 *   - No runtime writes to public/. Writing to public/ at runtime is not
 *     persistent on Vercel or any read-only / ephemeral filesystem deployment.
 *     The physical upload implementation belongs in Slice 10.11
 *     (Persistent Logo Storage Adapter).
 *
 * ─── Convention ──────────────────────────────────────────────────────────────
 *
 *   Storage key:  logos/{tenantKey}.{ext}
 *   Public URL:   /images/logos/{tenantKey}.{ext}   (local dev / CDN prefix)
 *
 * One key per tenant per extension — uploading a new file always overwrites
 * the same key, guaranteeing no orphaned duplicates by construction.
 */

/**
 * Returns the storage object key for a tenant logo.
 * Used as the key/path within a storage bucket or CDN namespace.
 *
 * Example: getTenantLogoKey("fc-allschwil", "png") → "logos/fc-allschwil.png"
 */
export function getTenantLogoKey(tenantKey: string, ext: string): string {
  return `logos/${tenantKey}.${ext}`;
}

// ── CLUB-DIRECTORY-01: external club/team crest paths ─────────────────────────
//
// Same convention as tenant logos, tenant-scoped and keyed by the canonical
// record id so a re-upload always overwrites the same key (no orphans by
// construction). Club and team crests share the "clubs/" prefix because a
// team crest is, in practice, almost always the parent club's crest (see
// lib/club-directory/logo.ts) — keeping them in one namespace makes that
// relationship visible in storage, not just in the database.
//
//   Club crest key:  clubs/{tenantKey}/{externalClubId}.{ext}
//   Team crest key:  clubs/{tenantKey}/teams/{externalTeamId}.{ext}

export function getExternalClubLogoKey(
  tenantKey: string,
  externalClubId: string,
  ext: string,
): string {
  return `clubs/${tenantKey}/${externalClubId}.${ext}`;
}

export function getExternalTeamLogoKey(
  tenantKey: string,
  externalTeamId: string,
  ext: string,
): string {
  return `clubs/${tenantKey}/teams/${externalTeamId}.${ext}`;
}

// ── INFOBOARD-MAP-01: Anlageplan background paths ─────────────────────────────
//
// Background images are stored in the public sportclubevo-assets store under
// the "infoboards/" namespace, scoped by tenant and board.
//
//   Key: infoboards/{tenantKey}/{infoboardId}/anlageplan/{infoboardId}.{ext}

export function getAnlageplanBgKey(
  tenantKey: string,
  infoboardId: string,
  ext: string,
): string {
  return `infoboards/${tenantKey}/${infoboardId}/anlageplan/${infoboardId}.${ext}`;
}
