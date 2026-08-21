/**
 * GET  /api/tenants/[tenantSlug]/communications/threads/[threadId]/comments
 * POST /api/tenants/[tenantSlug]/communications/threads/[threadId]/comments
 *
 * COMM-01A: Tenant-scoped internal comments API foundation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { CommunicationServiceError } from "@/lib/communication/errors";
import { createInternalComment, listInternalComments } from "@/lib/communication/comment-service";

type Context = { params: Promise<{ tenantSlug: string; threadId: string }> };

function mapServiceError(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "COMMENT_NOT_FOUND"
        ? 404
        : error.code === "TENANT_FORBIDDEN" || error.code === "MENTION_FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("Communication comments route failed:", error);
  return NextResponse.json({ error: "Kommentare konnten nicht verarbeitet werden." }, { status: 500 });
}

export async function GET(_request: NextRequest, context: Context) {
  const { tenantSlug, threadId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const comments = await listInternalComments(tenantResult.tenantId, threadId);
    return NextResponse.json({ comments });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, threadId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission([PERMISSIONS.REGISTRATIONS_EDIT], tenantResult.tenantId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  if (!actorUserId) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      body?: string;
      mentionedUserIds?: string[];
    };

    if (!body.body?.trim()) {
      return NextResponse.json({ error: "body ist erforderlich." }, { status: 400 });
    }

    const comment = await createInternalComment(
      tenantResult.tenantId,
      threadId,
      actorUserId,
      body.body,
      body.mentionedUserIds ?? [],
    );

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return mapServiceError(error);
  }
}
