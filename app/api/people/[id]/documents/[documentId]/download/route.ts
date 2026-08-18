/**
 * PERSON-UX-07 — GET /api/people/[id]/documents/[documentId]/download
 *
 * Server-side streaming download for a PersonDocument.
 *
 * Security guarantees:
 *   - Authenticated session required.
 *   - Active tenant context required.
 *   - Person must belong to that tenant (cross-tenant isolation).
 *   - Document must belong to that person + tenant.
 *   - Requires people.private_documents.view (NOT merely people.view).
 *   - Capacity flags do NOT grant download access.
 *   - Team-scope does NOT grant identity-document download access.
 *   - The raw storage key/URL is NEVER returned to the client.
 *   - Binary data streams through this authorized server-side endpoint only.
 *   - Knowing or guessing the document ID does NOT bypass authorization.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import {
  downloadPersonDocument,
  PersonDocumentServiceError,
} from "@/lib/people/person-document-service";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

async function resolveTenantPerson(personId: string, tenantId: string) {
  const p = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!p || p.tenantId !== tenantId) return null;
  return p;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_VIEW,
    PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id: personId, documentId } = await params;
  const { tenantId } = tenantResult;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  try {
    const result = await downloadPersonDocument({ tenantId, personId, documentId });

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": result.contentDisposition,
        "Content-Length": String(result.sizeBytes),
        ...(result.etag ? { ETag: result.etag } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      const status = err.code === "DOCUMENT_NOT_FOUND" ? 404 : 503;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
