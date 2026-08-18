/**
 * PERSON-UX-07 — GET/POST /api/people/[id]/documents
 *
 * GET  — List PersonDocuments (metadata only; no storage URLs returned).
 *         Requires: people.private_documents.view
 *
 * POST — Upload a new PersonDocument (multipart/form-data).
 *         Requires: people.private_documents.manage
 *
 * Security:
 *   - Authenticated session required.
 *   - Active tenant context required; person must belong to that tenant.
 *   - Capacity flags do NOT grant document access.
 *   - Team-scoped grants do NOT grant identity-document access.
 *   - Storage URLs are never returned to clients.
 *   - All downloads go through the /download sub-route (server-side streaming).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { PersonDocumentCategory } from "@prisma/client";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { prisma } from "@/lib/db/prisma";
import {
  createPersonDocument,
  listPersonDocuments,
  PersonDocumentServiceError,
  validateWorkspaceUploadFile,
} from "@/lib/people/person-document-service";

type RouteContext = { params: Promise<{ id: string }> };

const PERSON_DOCUMENT_CATEGORIES: PersonDocumentCategory[] = [
  "IDENTITY_DOCUMENT",
  "CONSENT",
  "CERTIFICATE",
  "QUALIFICATION",
  "CONTRACT",
  "PERMIT",
  "CORRESPONDENCE",
  "OTHER",
];

function isValidCategory(v: unknown): v is PersonDocumentCategory {
  return typeof v === "string" && (PERSON_DOCUMENT_CATEGORIES as string[]).includes(v);
}

/** Resolve person — tenant isolation check included. */
async function resolveTenantPerson(personId: string, tenantId: string) {
  const p = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!p || p.tenantId !== tenantId) return null;
  return p;
}

// ── GET — list ────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
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

  const { id: personId } = await params;
  const { tenantId } = tenantResult;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  try {
    const docs = await listPersonDocuments(tenantId, personId);
    // Strip _storageKey before sending to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const clientDocs = docs.map(({ _storageKey: _sk, ...rest }) => rest);
    return NextResponse.json({ documents: clientDocs });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}

// ── POST — upload ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id: personId } = await params;
  const { tenantId } = tenantResult;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  // Fetch tenant key for storage path
  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Datei ist erforderlich." }, { status: 400 });
  }

  const validation = validateWorkspaceUploadFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error, code: "WORKSPACE_UPLOAD_INVALID_FILE" }, { status: 400 });
  }

  const titleRaw = formData.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim() : validation.filename;
  if (!title) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const categoryRaw = formData.get("category");
  const category: PersonDocumentCategory = isValidCategory(categoryRaw) ? categoryRaw : "OTHER";

  const issueDateRaw = formData.get("issueDate");
  const expiryDateRaw = formData.get("expiryDate");
  const notesRaw = formData.get("notes");

  function parseOptionalDate(raw: unknown): Date | null {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const d = new Date(raw.trim());
    return isNaN(d.getTime()) ? null : d;
  }

  const issueDate = parseOptionalDate(issueDateRaw);
  const expiryDate = parseOptionalDate(expiryDateRaw);
  const notes = typeof notesRaw === "string" ? notesRaw.trim() || null : null;

  const fileBuffer = new Uint8Array(await file.arrayBuffer());

  try {
    const doc = await createPersonDocument({
      tenantId,
      personId,
      actorUserId: access.session.user.id,
      tenantKey: tenant.key,
      category,
      title,
      fileBuffer,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      issueDate,
      expiryDate,
      notes,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _storageKey: _sk2, ...clientDoc } = doc;
    return NextResponse.json({ document: clientDoc }, { status: 201 });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      const status =
        err.code === "PERSON_NOT_FOUND" ? 404 :
        err.code === "INVALID_INPUT" ? 400 :
        err.code === "STORAGE_NOT_CONFIGURED" ? 503 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
