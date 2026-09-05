/**
 * lib/club-directory/ops-backup-storage.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — durable pre-mutation backup persistence.
 *
 * WHY NOT /tmp
 *   scripts/club-directory-02c-sfv-consolidation.ts's `--execute` path
 *   writes its pre-change backup to local `.tmp/` (see `writeBackupToDisk`)
 *   — fine for an operator running the CLI on their own machine, but a
 *   Vercel serverless function's `/tmp` is ephemeral (gone once the
 *   invocation ends, never shared across invocations/regions) and is not a
 *   durable, operator-recoverable backup. The temporary execute endpoint
 *   (app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts)
 *   therefore must not reuse `writeBackupToDisk`.
 *
 * WHY VERCEL BLOB
 *   `@vercel/blob` is already a project dependency, already durable/
 *   operator-recoverable, and already used for exactly this kind of
 *   "persist something outside the request lifecycle" need — e.g.
 *   lib/assets/storage.ts (tenant/club/team logos via the general, public
 *   `BLOB_READ_WRITE_TOKEN` store) and lib/workspace/upload-storage.ts (a
 *   second, dedicated private store for the Workspace module).
 *
 * WHY A DEDICATED STORE (OPS_BACKUP_READ_WRITE_TOKEN)
 *   The general `BLOB_READ_WRITE_TOKEN` store (sportclubevo-assets) is
 *   configured for PUBLIC access (it serves logos), and Vercel Blob does
 *   not allow writing a `private` blob into a public store. This backup
 *   contains internal ExternalClub/ExternalTeam/ExternalClubProviderMapping
 *   rows and must stay private, so it is written to a separate, dedicated
 *   PRIVATE store (sportclubevo-ops-backups) via its own connection token,
 *   `OPS_BACKUP_READ_WRITE_TOKEN`. This does not change the public store or
 *   its usage elsewhere.
 *
 * ACCESS LEVEL
 *   `access: "private"` — this snapshot contains internal ExternalClub/
 *   ExternalTeam/ExternalClubProviderMapping rows (ids, names, timestamps),
 *   not a public asset. It must never be served from a public CDN URL the
 *   way logos are.
 *
 * FAIL-CLOSED CONTRACT
 *   Never throws. Returns `{ ok: false }` when OPS_BACKUP_READ_WRITE_TOKEN
 *   is absent or the upload fails, so the caller can refuse to mutate
 *   anything ("no mutation may occur unless the backup has been
 *   successfully created/persisted" — see the execute route).
 */

import { put } from "@vercel/blob";

function getSafeErrorCategory(error: unknown): string {
  return error instanceof Error && error.name
    ? error.name
    : "UnknownError";
}

export type PersistBackupSnapshotResult =
  | { ok: true; url: string; pathname: string }
  | { ok: false; status: number; error: string };

/**
 * Persists `snapshot` (expected: the return value of
 * scripts/club-directory-02c-sfv-consolidation.ts#buildBackupSnapshot) as a
 * private JSON blob at `key` in the project's dedicated, private
 * ops-backup Vercel Blob store (`OPS_BACKUP_READ_WRITE_TOKEN`) — not the
 * general public store used for logos.
 *
 * `key` should be unique per execution attempt (the caller includes a
 * timestamp) so repeated attempts never silently overwrite an earlier
 * backup.
 */
export async function persistConsolidationBackupSnapshot(
  snapshot: unknown,
  key: string,
): Promise<PersistBackupSnapshotResult> {
  const token = process.env.OPS_BACKUP_READ_WRITE_TOKEN?.trim();

  if (!token) {
    return {
      ok: false,
      status: 503,
      error: "Backup-Speicher ist nicht konfiguriert (OPS_BACKUP_READ_WRITE_TOKEN fehlt).",
    };
  }

  try {
    const blob = await put(key, JSON.stringify(snapshot, null, 2), {
      access: "private",
      contentType: "application/json",
      token,
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return { ok: true, url: blob.url, pathname: blob.pathname ?? key };
  } catch (err) {
    console.error("[ops-backup-storage] backup persistence failed", {
      operation: "put",
      errorCategory: getSafeErrorCategory(err),
    });
    return {
      ok: false,
      status: 500,
      error: "Backup konnte nicht gespeichert werden.",
    };
  }
}
