/**
 * lib/assets/club-logo-upload.ts
 *
 * CLUB-DIRECTORY-01 — shared multipart logo-upload executor for
 * ExternalClub and ExternalTeam crests. Mirrors lib/assets/logo-upload.ts
 * (the tenant-branding logo executor) exactly, but persists to
 * ExternalClub.logoUrl / ExternalTeam.logoUrl instead of Tenant.logoUrl and
 * uploads via uploadExternalClubLogo() / uploadExternalTeamLogo().
 *
 * Kept as a separate module from lib/assets/logo-upload.ts because the two
 * executors persist to different Prisma models — but they share every
 * validation rule and the Vercel Blob call path via
 * lib/assets/storage.ts#uploadLogoObject.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateLogoUploadFile } from "./validation";
import {
  deleteOrphanedLogo,
  uploadExternalClubLogo,
  uploadExternalTeamLogo,
} from "./storage";

async function extractValidatedFile(
  req: NextRequest,
): Promise<
  | { ok: true; buffer: Uint8Array; mimeType: string }
  | { ok: false; response: NextResponse }
> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Ungültige Anfrage: multipart/form-data erwartet." },
        { status: 400 },
      ),
    };
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Kein Datei-Feld 'file' im Formular gefunden." },
        { status: 400 },
      ),
    };
  }

  const validation = validateLogoUploadFile(fileEntry);
  if (!validation.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: validation.error }, { status: 400 }),
    };
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  return { ok: true, buffer: new Uint8Array(arrayBuffer), mimeType: validation.mimeType };
}

export type ExternalClubForLogoUpload = {
  id: string;
  logoUrl: string | null;
};

/**
 * Executes a complete logo upload for a pre-resolved, tenant-scoped
 * ExternalClub. The caller owns auth, permission checks, tenant scoping,
 * and 404 resolution — this function owns multipart parsing through the
 * ExternalClub.logoUrl write.
 */
export async function executeExternalClubLogoUpload(
  req: NextRequest,
  tenantKey: string,
  club: ExternalClubForLogoUpload,
): Promise<NextResponse> {
  const extracted = await extractValidatedFile(req);
  if (!extracted.ok) return extracted.response;

  const uploadResult = await uploadExternalClubLogo(
    tenantKey,
    club.id,
    extracted.buffer,
    extracted.mimeType,
  );
  if (!uploadResult.ok) {
    return NextResponse.json({ error: uploadResult.error }, { status: uploadResult.status });
  }

  const newLogoUrl = uploadResult.publicUrl;
  const previousLogoUrl = club.logoUrl;

  await prisma.externalClub.update({
    where: { id: club.id },
    data: { logoUrl: newLogoUrl },
  });

  await deleteOrphanedLogo(previousLogoUrl, newLogoUrl).catch(() => undefined);

  return NextResponse.json({ logoUrl: newLogoUrl });
}

export type ExternalTeamForLogoUpload = {
  id: string;
  logoUrl: string | null;
};

/**
 * Executes a complete logo upload for a pre-resolved, tenant-scoped
 * ExternalTeam override crest.
 */
export async function executeExternalTeamLogoUpload(
  req: NextRequest,
  tenantKey: string,
  team: ExternalTeamForLogoUpload,
): Promise<NextResponse> {
  const extracted = await extractValidatedFile(req);
  if (!extracted.ok) return extracted.response;

  const uploadResult = await uploadExternalTeamLogo(
    tenantKey,
    team.id,
    extracted.buffer,
    extracted.mimeType,
  );
  if (!uploadResult.ok) {
    return NextResponse.json({ error: uploadResult.error }, { status: uploadResult.status });
  }

  const newLogoUrl = uploadResult.publicUrl;
  const previousLogoUrl = team.logoUrl;

  await prisma.externalTeam.update({
    where: { id: team.id },
    data: { logoUrl: newLogoUrl },
  });

  await deleteOrphanedLogo(previousLogoUrl, newLogoUrl).catch(() => undefined);

  return NextResponse.json({ logoUrl: newLogoUrl });
}
