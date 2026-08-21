/**
 * PATCH /api/tenants/[tenantSlug]/communications/threads/[threadId]/comments/[commentId]
 * DELETE /api/tenants/[tenantSlug]/communications/threads/[threadId]/comments/[commentId]
 *
 * COMM-01B: Edit and soft-delete internal comments (author-only).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { CommunicationServiceError } from "@/lib/communication/errors";
import {
  softDeleteInternalComment,
  updateInternalComment,
} from "@/lib/communication/comment-service";
import { enrichInternalComments } from "@/lib/communication/comment-enrichment";

type Context = {
  params: Promise<{ tenantSlug: string; threadId: string; commentId: string }>;
};

function mapServiceError(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "COMMENT_NOT_FOUND"
        ? 404
        : error.code === "TENANT_FORBIDDEN" ||
            error.code === "MENTION_FORBIDDEN" ||
            error.code === "COMMENT_FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("Communication comment mutation route failed:", error);
  return NextResponse.json({ error: "Kommentar konnte nicht verarbeitet werden." }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenantSlug, threadId, commentId } = await context.params;

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

    const comment = await updateInternalComment(
      tenantResult.tenantId,
      threadId,
      commentId,
      actorUserId,
      body.body,
      body.mentionedUserIds ?? [],
    );

    const [enriched] = await enrichInternalComments(tenantResult.tenantId, [comment]);
    return NextResponse.json({ comment: enriched });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { tenantSlug, threadId, commentId } = await context.params;

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
    const comment = await softDeleteInternalComment(
      tenantResult.tenantId,
      threadId,
      commentId,
      actorUserId,
    );

    const [enriched] = await enrichInternalComments(tenantResult.tenantId, [comment]);
    return NextResponse.json({ comment: enriched });
  } catch (error) {
    return mapServiceError(error);
  }
}
