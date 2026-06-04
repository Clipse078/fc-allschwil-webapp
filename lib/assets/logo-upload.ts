/**
 * Shared Logo Upload Executor — canonical single source of truth.
 *
 * Used by every API route that accepts a multipart logo upload:
 *   - POST /api/branding/logo             (self-service; USERS_MANAGE)
 *   - POST /api/tenants/[slug]/logo       (super-admin;  TENANTS_MANAGE)
 *
 * After the caller resolves and validates the target tenant (permission check,
 * existence, active status), this function owns all remaining upload steps:
 *   1. Parse multipart/form-data and extract the "file" field.
 *   2. First-pass MIME + size validation (validateLogoUploadFile).
 *   3. Read bytes for magic-byte check.
 *   4. Upload to Vercel Blob via uploadTenantLogo (includes magic-byte check).
 *   5. Persist the returned public URL to Tenant.logoUrl.
 *   6. Best-effort orphan cleanup of the previous Vercel Blob URL.
 *   7. Return JSON { logoUrl } or a structured error response.
 *
 * Design:
 * - Caller owns: auth, permission check, tenant resolution, archived guard.
 * - This function owns: everything from multipart parse to DB write.
 * - Returns a NextResponse directly so callers can `return executeLogoUpload(...)`.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateLogoUploadFile } from "./validation";
import { uploadTenantLogo, deleteOrphanedLogo } from "./storage";

export type TenantForLogoUpload = {
  id: string;
  key: string;
  logoUrl: string | null;
};

/**
 * Executes a complete logo upload for the given pre-resolved tenant.
 *
 * The caller is responsible for:
 *   - Verifying the user is authenticated and has the required permission.
 *   - Resolving the tenant from the session or URL slug.
 *   - Returning early with 404 if the tenant does not exist.
 *   - Returning early with 409 if the tenant is archived.
 *
 * @param req     The incoming NextRequest (must be multipart/form-data).
 * @param tenant  Resolved tenant with id, key, and current logoUrl.
 * @returns       NextResponse with `{ logoUrl: string }` on success, or an
 *                error payload with the appropriate HTTP status code.
 */
export async function executeLogoUpload(
  req: NextRequest,
  tenant: TenantForLogoUpload,
): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage: multipart/form-data erwartet." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Kein Datei-Feld 'file' im Formular gefunden." },
      { status: 400 },
    );
  }

  const validation = validateLogoUploadFile(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const uploadResult = await uploadTenantLogo(tenant.key, buffer, validation.mimeType);
  if (!uploadResult.ok) {
    return NextResponse.json(
      { error: uploadResult.error },
      { status: uploadResult.status },
    );
  }

  const newLogoUrl = uploadResult.publicUrl;
  const previousLogoUrl = tenant.logoUrl;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { logoUrl: newLogoUrl },
  });

  // Best-effort orphan cleanup — do not fail the request if delete fails.
  await deleteOrphanedLogo(previousLogoUrl, newLogoUrl).catch(() => undefined);

  return NextResponse.json({ logoUrl: newLogoUrl });
}
