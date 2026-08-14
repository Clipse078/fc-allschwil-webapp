/**
 * Self-service profile image API — MEIN-KONTO-02
 *
 * POST   /api/account/profile-image  — upload / replace profile picture
 * DELETE /api/account/profile-image  — remove profile picture
 *
 * Auth: any authenticated session with an active tenant context and a linked
 * Person in that tenant.  Users without a linked Person cannot set a photo
 * because Person.imageUrl is the canonical organisational profile image source.
 * Future player/trainer profiles reuse the same Person.imageUrl field.
 *
 * Storage: Vercel Blob, namespace  person-photos/{tenantKey}/{personId}.{ext}
 * This namespace is separate from the shared media library (media/{tenantKey}/…)
 * and from branding logos — intentional separation.
 *
 * Allowed MIME types: image/jpeg, image/png, image/webp
 * Max size:            4 MB
 */

import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { isVercelBlobUrl } from "@/lib/media/upload";
import { logAction } from "@/lib/audit/log-action";

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireSessionWithLinkedPerson() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, error: "Nicht authentifiziert." };
  }

  const activeTenantId = session.user.activeTenantId;
  if (!activeTenantId) {
    return { ok: false as const, status: 403 as const, error: "Kein aktiver Mandant." };
  }

  // Find the Person linked to this user in the active tenant
  const person = await prisma.person.findFirst({
    where: { userId: session.user.id, tenantId: activeTenantId },
    select: { id: true, imageUrl: true, tenantId: true },
  });

  if (!person) {
    return {
      ok: false as const,
      status: 403 as const,
      error:
        "Kein verknüpftes Profil in diesem Verein. Profilbild kann nur gesetzt werden wenn ein Person-Profil vorhanden ist.",
    };
  }

  // Resolve tenant key for the storage path
  const tenant = await prisma.tenant.findUnique({
    where: { id: activeTenantId },
    select: { key: true },
  });

  if (!tenant) {
    return { ok: false as const, status: 403 as const, error: "Mandant nicht gefunden." };
  }

  return { ok: true as const, session, person, tenantKey: tenant.key };
}

// ── POST — upload / replace ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Profilbild-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert).",
      },
      { status: 503 },
    );
  }

  const check = await requireSessionWithLinkedPerson();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { session, person, tenantKey } = check;

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Keine Bilddatei übermittelt." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Bild darf maximal 4 MB groß sein." },
      { status: 400 },
    );
  }

  const declaredMime = file.type;
  if (!ALLOWED_IMAGE_MIMES.has(declaredMime)) {
    return NextResponse.json(
      { error: `Nicht erlaubter Dateityp: ${declaredMime}. Erlaubt: JPEG, PNG, WebP.` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_IMAGE_MIMES.has(detected.mime)) {
    return NextResponse.json(
      { error: "Dateityp konnte nicht als Bild erkannt werden." },
      { status: 400 },
    );
  }

  if (detected.mime !== declaredMime) {
    return NextResponse.json(
      {
        error: `Deklarierter Typ (${declaredMime}) stimmt nicht mit erkanntem Typ (${detected.mime}) überein.`,
      },
      { status: 400 },
    );
  }

  const ext = MIME_TO_EXT[detected.mime];
  const storageKey = `person-photos/${tenantKey}/${person.id}.${ext}`;

  try {
    // Delete old blob if it was stored by us (best-effort)
    if (person.imageUrl && isVercelBlobUrl(person.imageUrl)) {
      try {
        await del(person.imageUrl, { token });
      } catch {
        // Non-fatal — old blob cleanup failure must not block the new upload
      }
    }

    const blob = await put(storageKey, buffer, {
      access: "public",
      contentType: detected.mime,
      token,
      allowOverwrite: true,
    });

    await prisma.person.update({
      where: { id: person.id },
      data: { imageUrl: blob.url },
    });

    await logAction({
      actorUserId: session.user.id,
      moduleKey: "account",
      entityType: "Person",
      entityId: person.id,
      action: "profile_image_uploaded",
      afterJson: { imageUrl: blob.url },
    });

    return NextResponse.json({ imageUrl: blob.url });
  } catch (error) {
    console.error("[account/profile-image] POST failed:", error);
    return NextResponse.json(
      { error: "Bild konnte nicht hochgeladen werden." },
      { status: 500 },
    );
  }
}

// ── DELETE — remove ───────────────────────────────────────────────────────────

export async function DELETE() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const check = await requireSessionWithLinkedPerson();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { session, person } = check;

  if (!person.imageUrl) {
    return NextResponse.json({ message: "Kein Profilbild vorhanden." });
  }

  try {
    // Best-effort deletion of the blob
    if (token && isVercelBlobUrl(person.imageUrl)) {
      try {
        await del(person.imageUrl, { token });
      } catch {
        // Non-fatal
      }
    }

    await prisma.person.update({
      where: { id: person.id },
      data: { imageUrl: null },
    });

    await logAction({
      actorUserId: session.user.id,
      moduleKey: "account",
      entityType: "Person",
      entityId: person.id,
      action: "profile_image_removed",
      beforeJson: { imageUrl: person.imageUrl },
    });

    return NextResponse.json({ message: "Profilbild entfernt." });
  } catch (error) {
    console.error("[account/profile-image] DELETE failed:", error);
    return NextResponse.json(
      { error: "Profilbild konnte nicht entfernt werden." },
      { status: 500 },
    );
  }
}
