/**
 * GET  /api/tenants/[tenantSlug]/communications/threads?targetType=&targetId=
 * POST /api/tenants/[tenantSlug]/communications/threads
 *
 * COMM-01A: Tenant-scoped communication thread API foundation.
 *
 * GET  — returns the canonical thread for a validated target (404 when none exists).
 * POST — get-or-create thread for a validated target.
 *
 * Authorization (temporary): registrations.view (read) / registrations.edit (write).
 */

import { NextRequest, NextResponse } from "next/server";
import type { CommunicationTargetType } from "@prisma/client";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { CommunicationServiceError } from "@/lib/communication/errors";
import {
  getCommunicationThreadForTarget,
  getOrCreateCommunicationThreadForTarget,
} from "@/lib/communication/thread-service";
import { toPublicCommunicationThread } from "@/lib/communication/public-thread";

type Context = { params: Promise<{ tenantSlug: string }> };

function parseTargetType(value: string | null): CommunicationTargetType | null {
  if (!value) return null;
  return value as CommunicationTargetType;
}

function mapServiceError(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "TARGET_NOT_FOUND" || error.code === "THREAD_NOT_FOUND"
        ? 404
        : error.code === "TENANT_FORBIDDEN" || error.code === "MENTION_FORBIDDEN"
          ? 403
          : error.code === "UNSUPPORTED_TARGET_TYPE"
            ? 400
            : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("Communication thread route failed:", error);
  return NextResponse.json({ error: "Kommunikations-Thread konnte nicht verarbeitet werden." }, { status: 500 });
}

export async function GET(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

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

  const { searchParams } = new URL(request.url);
  const targetType = parseTargetType(searchParams.get("targetType"));
  const targetId = searchParams.get("targetId");

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "targetType und targetId sind erforderlich." }, { status: 400 });
  }

  try {
    const thread = await getCommunicationThreadForTarget(tenantSlug, targetType, targetId);
    if (!thread) {
      return NextResponse.json({ error: "Kein Kommunikations-Thread für dieses Ziel." }, { status: 404 });
    }

    return NextResponse.json({ thread: toPublicCommunicationThread(thread) });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

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

  try {
    const body = (await request.json()) as {
      targetType?: CommunicationTargetType;
      targetId?: string;
    };

    if (!body.targetType || !body.targetId) {
      return NextResponse.json({ error: "targetType und targetId sind erforderlich." }, { status: 400 });
    }

    const thread = await getOrCreateCommunicationThreadForTarget(
      tenantSlug,
      body.targetType,
      body.targetId,
      actorUserId,
    );

    return NextResponse.json({ thread: toPublicCommunicationThread(thread) }, { status: 201 });
  } catch (error) {
    return mapServiceError(error);
  }
}
