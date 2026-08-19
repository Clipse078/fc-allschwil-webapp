/**
 * Shared person profile-image helpers.
 *
 * Extracted from app/api/account/profile-image/route.ts so that both the
 * self-service account route and the admin people route share identical
 * validation, storage, and audit semantics without drift.
 *
 * Storage namespace: person-photos/{tenantKey}/{personId}.{ext}
 * Allowed MIME:      image/jpeg | image/png | image/webp
 * Max size:          4 MB
 */

import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@/lib/db/prisma";
import { isVercelBlobUrl } from "@/lib/media/upload";
import { logAction } from "@/lib/audit/log-action";

export const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export type UploadPersonImageResult =
  | { ok: true; imageUrl: string }
  | { ok: false; status: 400 | 500 | 503; error: string };

export type RemovePersonImageResult =
  | { ok: true; message: string }
  | { ok: false; status: 404 | 500; error: string };

/**
 * Validate the uploaded file blob and return a typed error or the buffer/mime.
 */
export async function validateImageFile(
  file: Blob,
): Promise<
  | { ok: true; buffer: Buffer; mime: string; ext: string }
  | { ok: false; status: 400; error: string }
> {
  if (file.size > MAX_BYTES) {
    return { ok: false, status: 400, error: "Bild darf maximal 4 MB groß sein." };
  }

  const declaredMime = file.type;
  if (!ALLOWED_IMAGE_MIMES.has(declaredMime)) {
    return {
      ok: false,
      status: 400,
      error: `Nicht erlaubter Dateityp: ${declaredMime}. Erlaubt: JPEG, PNG, WebP.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_IMAGE_MIMES.has(detected.mime)) {
    return { ok: false, status: 400, error: "Dateityp konnte nicht als Bild erkannt werden." };
  }

  if (detected.mime !== declaredMime) {
    return {
      ok: false,
      status: 400,
      error: `Deklarierter Typ (${declaredMime}) stimmt nicht mit erkanntem Typ (${detected.mime}) überein.`,
    };
  }

  const ext = MIME_TO_EXT[detected.mime];
  return { ok: true, buffer, mime: detected.mime, ext };
}

/**
 * Upload or replace a person's profile image.
 *
 * Deletes the old blob (best-effort) before uploading the new one.
 * Updates Person.imageUrl and writes an audit log entry.
 */
export async function uploadPersonProfileImage({
  personId,
  tenantKey,
  currentImageUrl,
  buffer,
  mime,
  ext,
  actorUserId,
  moduleKey = "people",
  token,
}: {
  personId: string;
  tenantKey: string;
  currentImageUrl: string | null | undefined;
  buffer: Buffer;
  mime: string;
  ext: string;
  actorUserId: string | null;
  moduleKey?: string;
  token: string;
}): Promise<UploadPersonImageResult> {
  const storageKey = `person-photos/${tenantKey}/${personId}.${ext}`;

  try {
    if (currentImageUrl && isVercelBlobUrl(currentImageUrl)) {
      try {
        await del(currentImageUrl, { token });
      } catch {
        // Non-fatal — old blob cleanup must not block the new upload
      }
    }

    const blob = await put(storageKey, buffer, {
      access: "public",
      contentType: mime,
      token,
      allowOverwrite: true,
    });

    await prisma.person.update({
      where: { id: personId },
      data: { imageUrl: blob.url },
    });

    await logAction({
      actorUserId,
      moduleKey,
      entityType: "Person",
      entityId: personId,
      action: "profile_image_uploaded",
      afterJson: { imageUrl: blob.url },
    });

    return { ok: true, imageUrl: blob.url };
  } catch (error) {
    console.error("[profile-image-shared] upload failed:", error);
    return { ok: false, status: 500, error: "Bild konnte nicht hochgeladen werden." };
  }
}

/**
 * Remove a person's profile image.
 *
 * Deletes the blob (best-effort), clears Person.imageUrl, and logs the action.
 */
export async function removePersonProfileImage({
  personId,
  currentImageUrl,
  actorUserId,
  moduleKey = "people",
  token,
}: {
  personId: string;
  currentImageUrl: string | null | undefined;
  actorUserId: string | null;
  moduleKey?: string;
  token: string | undefined;
}): Promise<RemovePersonImageResult> {
  if (!currentImageUrl) {
    return { ok: false, status: 404, error: "Kein Profilbild vorhanden." };
  }

  try {
    if (token && isVercelBlobUrl(currentImageUrl)) {
      try {
        await del(currentImageUrl, { token });
      } catch {
        // Non-fatal
      }
    }

    await prisma.person.update({
      where: { id: personId },
      data: { imageUrl: null },
    });

    await logAction({
      actorUserId,
      moduleKey,
      entityType: "Person",
      entityId: personId,
      action: "profile_image_removed",
      beforeJson: { imageUrl: currentImageUrl },
    });

    return { ok: true, message: "Profilbild entfernt." };
  } catch (error) {
    console.error("[profile-image-shared] remove failed:", error);
    return { ok: false, status: 500, error: "Profilbild konnte nicht entfernt werden." };
  }
}
