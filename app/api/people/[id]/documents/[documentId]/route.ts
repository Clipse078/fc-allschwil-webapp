/**
 * PERSON-UX-07 — GET/PATCH/DELETE /api/people/[id]/documents/[documentId]
 *
 * GET    — Fetch single document metadata.
 *           Requires: people.private_documents.view
 *
 * PATCH  — Update document metadata (title, category, dates, notes).
 *           Requires: people.private_documents.manage
 *
 * DELETE — Delete document record + blob from private storage.
 *           Requires: people.private_documents.manage
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { PersonDocumentCategory } from "@prisma/client";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import {
  updatePersonDocument,
  deletePersonDocument,
  listPersonDocuments,
  PersonDocumentServiceError,
} from "@/lib/people/person-document-service";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

const VALID_CATEGORIES: PersonDocumentCategory[] = [
  "IDENTITY_DOCUMENT", "CONSENT", "CERTIFICATE", "QUALIFICATION",
  "CONTRACT", "PERMIT", "CORRESPONDENCE", "OTHER",
];

function isValidCategory(v: unknown): v is PersonDocumentCategory {
  return typeof v === "string" && (VALID_CATEGORIES as string[]).includes(v);
}

async function resolveTenantPerson(personId: string, tenantId: string) {
  const p = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!p || p.tenantId !== tenantId) return null;
  return p;
}

// ── GET ────────────────────────────────────────────────────────────────────────

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

  const { id: personId, documentId } = await params;
  const { tenantId } = tenantResult;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  try {
    const docs = await listPersonDocuments(tenantId, personId);
    const doc = docs.find((d) => d.id === documentId);
    if (!doc) {
      return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _storageKey: _sk, ...clientDoc } = doc;
    return NextResponse.json({ document: clientDoc });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE);
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  function parseOptionalDate(raw: unknown): Date | null | undefined {
    if (!(raw !== undefined)) return undefined; // field not present
    if (typeof raw !== "string" || !raw.trim()) return null;
    const d = new Date(raw.trim());
    return isNaN(d.getTime()) ? null : d;
  }

  try {
    const updated = await updatePersonDocument({
      tenantId,
      personId,
      documentId,
      actorUserId: access.session.user.id,
      ...(isValidCategory(body.category) ? { category: body.category } : {}),
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...("issueDate" in body ? { issueDate: parseOptionalDate(body.issueDate) } : {}),
      ...("expiryDate" in body ? { expiryDate: parseOptionalDate(body.expiryDate) } : {}),
      ...("notes" in body ? { notes: typeof body.notes === "string" ? body.notes : null } : {}),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _storageKey: _sk2, ...clientDoc } = updated;
    return NextResponse.json({ document: clientDoc });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      const status = err.code === "DOCUMENT_NOT_FOUND" ? 404 : err.code === "INVALID_INPUT" ? 400 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE);
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
    await deletePersonDocument({
      tenantId,
      personId,
      documentId,
      actorUserId: access.session.user.id,
    });
    return NextResponse.json({ message: "Dokument gelöscht." });
  } catch (err) {
    if (err instanceof PersonDocumentServiceError) {
      const status = err.code === "DOCUMENT_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
