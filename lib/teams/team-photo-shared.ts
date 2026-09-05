/**
 * TEAM-COCKPIT-PREMIUM-01K — shared team photo helpers.
 *
 * Public visual identity asset stored in Vercel Blob.
 * Storage namespace: team-photos/{tenantKey}/{teamId}.{ext}
 * Allowed MIME: image/jpeg | image/png | image/webp
 * Max size: 4 MB (matches person profile photos)
 *
 * Distinct from private TeamDocument storage — never creates TeamDocument rows.
 */

import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@/lib/db/prisma";
import { getTeamPhotoKey } from "@/lib/assets/tenant-paths";
import { deleteOrphanedLogo, isVercelBlobUrl } from "@/lib/assets/storage";
import { logAction } from "@/lib/audit/log-action";

function getSafeErrorCategory(error: unknown): string {
  return error instanceof Error && error.name
    ? error.name
    : "UnknownError";
}

export const ALLOWED_TEAM_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const TEAM_PHOTO_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_TEAM_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export type TeamPhotoValidationResult =
  | { ok: true; buffer: Buffer; mime: string; ext: string }
  | { ok: false; status: 400; error: string };

export type UploadTeamPhotoResult =
  | { ok: true; photoUrl: string }
  | { ok: false; status: 400 | 500 | 503; error: string };

export type RemoveTeamPhotoResult =
  | { ok: true; message: string }
  | { ok: false; status: 404 | 500; error: string };

function extensionFromFilename(filename: string): string | null {
  const match = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

/**
 * Validate an uploaded team photo file (MIME, extension, magic bytes, size).
 */
export async function validateTeamPhotoFile(
  file: Blob,
  filename?: string,
): Promise<TeamPhotoValidationResult> {
  if (file.size === 0) {
    return { ok: false, status: 400, error: "Die Datei ist leer." };
  }

  if (file.size > MAX_TEAM_PHOTO_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "Bild darf maximal 4 MB groß sein.",
    };
  }

  const declaredMime = file.type;
  if (!ALLOWED_TEAM_PHOTO_MIMES.has(declaredMime)) {
    return {
      ok: false,
      status: 400,
      error: `Nicht erlaubter Dateityp: ${declaredMime || "(unbekannt)"}. Erlaubt: JPEG, PNG, WebP.`,
    };
  }

  if (filename) {
    const ext = extensionFromFilename(filename);
    const expectedExt = TEAM_PHOTO_MIME_TO_EXT[declaredMime];
    if (!ext) {
      return {
        ok: false,
        status: 400,
        error: "Nicht unterstützte Dateiendung. Erlaubt: .jpg, .jpeg, .png, .webp.",
      };
    }
    if (ext !== expectedExt) {
      return {
        ok: false,
        status: 400,
        error: "Dateiendung stimmt nicht mit dem Dateityp überein.",
      };
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_TEAM_PHOTO_MIMES.has(detected.mime)) {
    return {
      ok: false,
      status: 400,
      error: "Dateityp konnte nicht als Bild erkannt werden.",
    };
  }

  if (detected.mime !== declaredMime) {
    return {
      ok: false,
      status: 400,
      error: `Deklarierter Typ (${declaredMime}) stimmt nicht mit dem erkannten Typ (${detected.mime}) überein.`,
    };
  }

  const ext = TEAM_PHOTO_MIME_TO_EXT[detected.mime];
  return { ok: true, buffer, mime: detected.mime, ext };
}

/**
 * Upload or replace a team photo.
 *
 * Order: upload new asset → update DB → best-effort delete previous blob.
 * On DB failure after upload, best-effort cleanup of the new blob.
 */
export async function uploadTeamPhoto({
  teamId,
  tenantId,
  tenantKey,
  currentPhotoUrl,
  buffer,
  mime,
  ext,
  actorUserId,
  token,
}: {
  teamId: string;
  tenantId: string;
  tenantKey: string;
  currentPhotoUrl: string | null | undefined;
  buffer: Buffer;
  mime: string;
  ext: string;
  actorUserId: string | null;
  token: string;
}): Promise<UploadTeamPhotoResult> {
  const storageKey = getTeamPhotoKey(tenantKey, teamId, ext);
  const isReplace = Boolean(currentPhotoUrl);
  let uploadedUrl: string | null = null;

  try {
    const blob = await put(storageKey, buffer, {
      access: "public",
      contentType: mime,
      token,
      allowOverwrite: true,
    });
    uploadedUrl = blob.url;

    await prisma.team.update({
      where: { id: teamId, tenantId },
      data: { photoUrl: blob.url },
    });

    await deleteOrphanedLogo(currentPhotoUrl, blob.url);

    await logAction({
      tenantId,
      actorUserId,
      moduleKey: "teams",
      entityType: "Team",
      entityId: teamId,
      action: isReplace ? "team_photo_replaced" : "team_photo_uploaded",
      beforeJson: isReplace ? { photoUrl: currentPhotoUrl } : undefined,
      afterJson: { photoUrl: blob.url },
    });

    return { ok: true, photoUrl: blob.url };
  } catch (error) {
    if (uploadedUrl && isVercelBlobUrl(uploadedUrl)) {
      try {
        await del(uploadedUrl, { token });
      } catch {
        // Best-effort cleanup after failed DB update
      }
    }
    console.error("[team-photo-shared] operation failed", {
      operation: "upload",
      errorCategory: getSafeErrorCategory(error),
    });
    return { ok: false, status: 500, error: "Teamfoto konnte nicht hochgeladen werden." };
  }
}

/**
 * Remove a team photo.
 *
 * Clears Team.photoUrl first, then best-effort blob deletion.
 */
export async function removeTeamPhoto({
  teamId,
  tenantId,
  currentPhotoUrl,
  actorUserId,
  token,
}: {
  teamId: string;
  tenantId: string;
  currentPhotoUrl: string | null | undefined;
  actorUserId: string | null;
  token: string | undefined;
}): Promise<RemoveTeamPhotoResult> {
  if (!currentPhotoUrl) {
    return { ok: false, status: 404, error: "Kein Teamfoto vorhanden." };
  }

  try {
    await prisma.team.update({
      where: { id: teamId, tenantId },
      data: { photoUrl: null },
    });

    if (token && isVercelBlobUrl(currentPhotoUrl)) {
      try {
        await del(currentPhotoUrl, { token });
      } catch (err) {
        console.warn("[team-photo-shared] blob cleanup failed after remove", {
          operation: "delete",
          teamId,
          errorCategory:
            err instanceof Error && err.name ? err.name : "UnknownError",
        });
      }
    }

    await logAction({
      tenantId,
      actorUserId,
      moduleKey: "teams",
      entityType: "Team",
      entityId: teamId,
      action: "team_photo_removed",
      beforeJson: { photoUrl: currentPhotoUrl },
    });

    return { ok: true, message: "Teamfoto entfernt." };
  } catch (error) {
    console.error("[team-photo-shared] operation failed", {
      operation: "remove",
      errorCategory: getSafeErrorCategory(error),
    });
    return { ok: false, status: 500, error: "Teamfoto konnte nicht entfernt werden." };
  }
}
