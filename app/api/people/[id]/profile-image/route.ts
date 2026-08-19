/**
 * PERSON-UX-09 — Admin person profile-image API.
 *
 * POST   /api/people/[id]/profile-image  — upload / replace photo
 * DELETE /api/people/[id]/profile-image  — remove photo
 *
 * Auth: requires people.manage permission.
 * Tenant isolation: target Person must belong to the caller's active tenant.
 *
 * Storage namespace is identical to the self-service account route:
 *   person-photos/{tenantKey}/{personId}.{ext}
 *
 * Upload/validation logic is shared via lib/people/profile-image-shared.ts
 * to prevent the two routes from drifting.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  validateImageFile,
  uploadPersonProfileImage,
  removePersonProfileImage,
} from "@/lib/people/profile-image-shared";

type Context = { params: Promise<{ id: string }> };

// ── Shared auth + resolution ──────────────────────────────────────────────────

async function resolveAuthorizedPerson(personId: string) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error };

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return { ok: false as const, status: tenantResult.status, error: tenantResult.error };
  }
  const { tenantId } = tenantResult;

  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId },
    select: { id: true, imageUrl: true, tenantId: true },
  });

  if (!person) {
    return { ok: false as const, status: 404 as const, error: "Person nicht gefunden." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { key: true },
  });

  if (!tenant) {
    return { ok: false as const, status: 403 as const, error: "Mandant nicht gefunden." };
  }

  const actorUserId =
    access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  return { ok: true as const, person, tenantKey: tenant.key, actorUserId };
}

// ── POST — upload / replace ───────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Context) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Profilbild-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert)." },
      { status: 503 },
    );
  }

  const { id: personId } = await params;
  const resolved = await resolveAuthorizedPerson(personId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { person, tenantKey, actorUserId } = resolved;

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

  const validation = await validateImageFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const result = await uploadPersonProfileImage({
    personId: person.id,
    tenantKey,
    currentImageUrl: person.imageUrl,
    buffer: validation.buffer,
    mime: validation.mime,
    ext: validation.ext,
    actorUserId,
    moduleKey: "people",
    token,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ imageUrl: result.imageUrl });
}

// ── DELETE — remove ───────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Context) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const { id: personId } = await params;
  const resolved = await resolveAuthorizedPerson(personId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { person, actorUserId } = resolved;

  const result = await removePersonProfileImage({
    personId: person.id,
    currentImageUrl: person.imageUrl,
    actorUserId,
    moduleKey: "people",
    token,
  });

  if (!result.ok) {
    if (result.status === 404) {
      return NextResponse.json({ message: "Kein Profilbild vorhanden." });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message });
}
