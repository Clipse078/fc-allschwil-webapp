/**
 * GET tenant-scoped outbound email history and canonical recipient state.
 */
import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { CommunicationServiceError } from "@/lib/communication/errors";
import { listCommunicationMessages } from "@/lib/communication/message-service";
import { toPublicOutboundEmailMessages } from "@/lib/communication/message-enrichment";
import { resolveCommunicationRecipientForTarget } from "@/lib/communication/recipient-resolver";
import { requireCommunicationThreadForTenant } from "@/lib/communication/thread-service";

type Context = { params: Promise<{ tenantSlug: string; threadId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "TARGET_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Communication email history route failed:", error);
  return NextResponse.json({ error: "E-Mail-Verlauf konnte nicht geladen werden." }, { status: 500 });
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
    const thread = await requireCommunicationThreadForTenant(tenantResult.tenantId, threadId);
    const [messages, recipient] = await Promise.all([
      listCommunicationMessages(tenantResult.tenantId, thread.id),
      resolveCommunicationRecipientForTarget({
        tenantId: tenantResult.tenantId,
        targetType: thread.targetType,
        targetId: thread.targetId,
      }),
    ]);

    return NextResponse.json({
      messages: await toPublicOutboundEmailMessages(tenantResult.tenantId, messages),
      recipient,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
