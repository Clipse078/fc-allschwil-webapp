/**
 * lib/integrations/sfv/sync/team-logo.ts
 *
 * CLUB-DIRECTORY-02B — SFV logo discovery & enrichment.
 * MEDIA-LOGO-01B — provider logo normalization to canonical PNG assets.
 *
 * SFV exposes team-keyed base64 crest bytes (see fetchTeamPicture). This
 * adapter fetches those bytes, normalizes them through the provider-neutral
 * pipeline in lib/assets/provider-logo-normalization.ts, and returns either a
 * Vercel Blob HTTPS URL (when persistence context + token are available) or a
 * self-contained normalized `data:image/png` URI as a safe fallback.
 *
 * Club-level crest semantics and tenant-managed field ownership are unchanged
 * (see lib/club-directory/logo.ts / provider-sync.ts).
 */

import { fileTypeFromBuffer } from "file-type";

import {
  computeProviderLogoSourceFingerprint,
  normalizeProviderLogoBytes,
  NORMALIZED_PROVIDER_LOGO_MIME,
  persistNormalizedProviderClubLogo,
  type NormalizeProviderLogoResult,
} from "@/lib/assets/provider-logo-normalization";
import { MAX_LOGO_FILE_SIZE_BYTES } from "@/lib/assets/validation";
import { fetchTeamPicture } from "../client";

/** Image formats accepted from a decoded SFV team-picture payload. */
const ALLOWED_PROVIDER_LOGO_MIME_TYPES = new Set([
  "image/gif",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type ProviderLogoPersistContext = {
  tenantKey: string;
  provider: string;
  providerClubId: number | null;
  /** Reuse an existing normalized blob when the source fingerprint is unchanged. */
  existingNormalizedLogoUrl?: string | null;
  existingSourceFingerprint?: string | null;
};

export type ClubLogoCandidateResolution = {
  logoUrl: string | null;
  attemptedTeamIds: number[];
  /** Present when normalization succeeded — for downstream idempotency hints. */
  sourceFingerprint?: string | null;
};

export async function resolveClubLogoFromCandidateTeamIds(
  candidateTeamIds: readonly number[],
  persistContext?: ProviderLogoPersistContext,
): Promise<ClubLogoCandidateResolution> {
  const attemptedTeamIds: number[] = [];

  for (const teamId of candidateTeamIds) {
    attemptedTeamIds.push(teamId);
    const resolved = await resolveProviderLogoAsset(teamId, persistContext);
    if (resolved !== null) {
      return {
        logoUrl: resolved.logoUrl,
        attemptedTeamIds,
        sourceFingerprint: resolved.sourceFingerprint,
      };
    }
  }

  return { logoUrl: null, attemptedTeamIds };
}

export type ResolvedProviderLogoAsset = {
  logoUrl: string;
  sourceFingerprint: string;
};

/**
 * Fetches SFV team-picture bytes, normalizes to PNG, and returns a canonical
 * URL string suitable for ExternalClub/ExternalTeam.logoUrl.
 */
export async function resolveProviderLogoAsset(
  sfvTeamId: number,
  persistContext?: ProviderLogoPersistContext,
): Promise<ResolvedProviderLogoAsset | null> {
  try {
    const sourceBuffer = await fetchProviderTeamPictureBytes(sfvTeamId);
    if (sourceBuffer === null) {
      return null;
    }

    const normalized = await normalizeProviderLogoBytes(sourceBuffer);
    if (normalized === null) {
      return null;
    }

    return await materializeNormalizedProviderLogo(normalized, persistContext);
  } catch {
    return null;
  }
}

/**
 * Backward-compatible alias used by existing wiring tests and callers.
 * Returns a normalized PNG URL (blob HTTPS or data: URI), never the raw GIF.
 */
export async function resolveProviderLogoDataUri(
  sfvTeamId: number,
  persistContext?: ProviderLogoPersistContext,
): Promise<string | null> {
  const resolved = await resolveProviderLogoAsset(sfvTeamId, persistContext);
  return resolved?.logoUrl ?? null;
}

async function fetchProviderTeamPictureBytes(sfvTeamId: number): Promise<Buffer | null> {
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

  return buffer;
}

async function materializeNormalizedProviderLogo(
  normalized: NormalizeProviderLogoResult,
  persistContext?: ProviderLogoPersistContext,
): Promise<ResolvedProviderLogoAsset | null> {
  if (
    persistContext &&
    persistContext.providerClubId !== null &&
    persistContext.tenantKey.trim().length > 0
  ) {
    const upload = await persistNormalizedProviderClubLogo({
      tenantKey: persistContext.tenantKey,
      scope: {
        provider: persistContext.provider,
        providerClubId: persistContext.providerClubId,
      },
      normalizedBuffer: normalized.buffer,
      sourceFingerprint: normalized.sourceFingerprint,
      existingPublicUrl: persistContext.existingNormalizedLogoUrl,
      existingSourceFingerprint: persistContext.existingSourceFingerprint,
    });

    if (upload.ok) {
      return {
        logoUrl: upload.publicUrl,
        sourceFingerprint: normalized.sourceFingerprint,
      };
    }
  }

  return {
    logoUrl: `data:${NORMALIZED_PROVIDER_LOGO_MIME};base64,${normalized.buffer.toString("base64")}`,
    sourceFingerprint: normalized.sourceFingerprint,
  };
}
