/**
 * lib/integrations/sfv/sync/team-logo.ts
 *
 * CLUB-DIRECTORY-02B — SFV logo discovery & enrichment.
 *
 * ─── Investigation result (documented here, not guessed) ──────────────────────
 *
 * SFV exposes exactly one logo-bearing endpoint in the ClubCorner API:
 *
 *   GET /api/team/picture/{teamId}   (see lib/integrations/sfv/client.ts
 *                                     #fetchTeamPicture, already implemented
 *                                     and live-validated in a prior slice)
 *
 * There is:
 *   - NO separate club-level picture/logo endpoint (only team-keyed).
 *   - NO stable, unauthenticated, browser-fetchable image URL — the response
 *     is a JSON-quoted base64 string behind an authenticated, token-gated
 *     request (production observation: content-type is application/json,
 *     not image/*; no cache-control/etag/last-modified/content-length
 *     headers at all — see fetchTeamPicture's doc comment).
 *   - Own teams and opponent teams behave identically; teamId alone is
 *     sufficient (no clubId/seasonId/organisationId required).
 *
 * lib/club-directory/logo.ts already documents (from this same investigation)
 * that the "team picture" is actually the *club* crest, keyed by an
 * arbitrary team id belonging to that club — so it is persisted once at
 * ExternalClub.logoUrl and reused by every ExternalTeam under that club
 * (see resolveExternalTeamLogoUrl / mergeProviderLogoUrl).
 *
 * ─── Why a data: URI, not a new storage subsystem ──────────────────────────────
 *
 * Because there is no stable provider URL to store verbatim, and the task's
 * IMAGE STORAGE constraint forbids adding image downloading/caching/storage
 * unless justified by existing patterns, this module converts the
 * already-fetched base64 payload into a self-contained `data:` URI. That URI
 * is persisted directly into the existing
 * ExternalClub.logoUrl / ExternalTeam.logoUrl / *ProviderMapping.providerLogoUrl
 * string columns (see prisma/schema.prisma) — the very same field the
 * CLUB-DIRECTORY-01 architecture already reserved for "a persisted crest/logo
 * URL". No new column, no new model, no new network round-trip to render it.
 *
 * The existing tenant-upload pipeline (lib/assets/storage.ts, via Vercel
 * Blob) was deliberately considered and rejected for provider-sourced
 * crests: ALLOWED_LOGO_UPLOAD_MIME_TYPES (lib/assets/validation.ts)
 * intentionally excludes GIF for tenant uploads, while SFV crests decode to
 * GIF in every production observation — pushing them through that pipeline
 * would require loosening a deliberate tenant-upload security/format
 * constraint just to accommodate a provider sync path. A `data:` URI needs
 * no such change, no Vercel Blob token, and no extra storage/caching layer.
 *
 * ─── Safety ─────────────────────────────────────────────────────────────────
 *
 *   - Never throws: any SFV error (auth/timeout/404-no-picture/network) or
 *     malformed payload resolves to `null` — a logo enrichment failure must
 *     never block schedule/match synchronization (see
 *     external-team-discovery.ts, the sole caller).
 *   - The decoded byte type is verified via magic-byte sniffing
 *     (`file-type`, already a project dependency — see lib/assets/storage.ts)
 *     rather than trusting the documented-but-unverified "always a GIF"
 *     claim, so a malformed or unexpected payload never produces a broken
 *     `<img>` (see components/admin/club-directory/ClubLogo.tsx).
 *   - Decoded byte size is capped at the same MAX_LOGO_FILE_SIZE_BYTES limit
 *     already enforced for tenant-managed logo uploads (lib/assets/validation.ts)
 *     — a defensive bound against an oversized/corrupted provider payload
 *     bloating the database column, not a new policy.
 */

import { fileTypeFromBuffer } from "file-type";

import { fetchTeamPicture } from "../client";
import { MAX_LOGO_FILE_SIZE_BYTES } from "@/lib/assets/validation";

/** Image formats accepted from a decoded SFV team-picture payload. */
const ALLOWED_PROVIDER_LOGO_MIME_TYPES = new Set([
  "image/gif",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Fetches the SFV team picture for `sfvTeamId` and, when a well-formed image
 * is returned, encodes it as a `data:` URI suitable for
 * ExternalClub/ExternalTeam.logoUrl (see lib/club-directory/logo.ts).
 *
 * Returns `null` when:
 *   - the SFV request fails for any reason (auth, timeout, network, 404/no
 *     picture, unexpected server error) — never throws;
 *   - the endpoint reports no picture (204/empty body);
 *   - the decoded bytes are empty, exceed MAX_LOGO_FILE_SIZE_BYTES, or do not
 *     sniff as one of ALLOWED_PROVIDER_LOGO_MIME_TYPES.
 *
 * Never persists anything itself — the caller (external-team-discovery.ts)
 * decides whether/where to store the result, via the same tenant-managed
 * field-ownership rules already used for every other provider-sourced field
 * (lib/club-directory/provider-sync.ts / mutation-service.ts).
 */
export async function resolveProviderLogoDataUri(sfvTeamId: number): Promise<string | null> {
  try {
    const picture = await fetchTeamPicture(sfvTeamId);
    if (picture === null) {
      return null;
    }

    const base64 = picture.base64.trim();
    if (base64.length === 0) {
      return null;
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_LOGO_FILE_SIZE_BYTES) {
      return null;
    }

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_PROVIDER_LOGO_MIME_TYPES.has(detected.mime)) {
      return null;
    }

    return `data:${detected.mime};base64,${base64}`;
  } catch {
    // Best-effort by design — see module doc comment. Any SFV client error
    // (SfvAuthError, SfvNetworkError, SFV_NOT_FOUND, timeout, …) is swallowed
    // here so a logo lookup can never break external-team discovery or the
    // schedule/match sync that depends on it.
    return null;
  }
}
