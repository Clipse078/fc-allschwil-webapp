/**
 * COMM-03A: Retry a failed tenant-scoped outbound email.
 *
 * Creates a new outbound attempt and preserves the original failed record.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { CommunicationServiceError } from "@/lib/communication/errors";
import { toPublicOutboundEmailMessages } from "@/lib/communication/message-enrichment";
import { retryFailedOutboundEmailForThread } from "@/lib/communication/outbound-email-service";

type Context = {
  params: Promise<{
    tenantSlug: string;
    threadId: string;
    messageId: string;
  }>;
};

function errorResponse(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "MESSAGE_NOT_FOUND"
        ? 404
        : error.code === "SEND_FORBIDDEN"
          ? 403
          : error.code === "PROVIDER_FAILED"
            ? 502
            : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Communication email retry route failed:", error);
  return NextResponse.json(
    { error: "Die E-Mail konnte nicht erneut gesendet werden." },
    { status: 500 },
  );
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, threadId, messageId } = await context.params;
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json(
      { error: tenantResult.error },
      { status: tenantResult.status },
    );
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  if (!actorUserId) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
  if (!idempotencyKey.trim()) {
    return NextResponse.json(
      { error: "Idempotency-Key ist erforderlich." },
      { status: 400 },
    );
  }

  try {
    const result = await retryFailedOutboundEmailForThread({
      tenantId: tenantResult.tenantId,
      threadId,
      actorUserId,
      sourceMessageId: messageId,
      idempotencyKey,
    });
    const [publicMessage] = await toPublicOutboundEmailMessages(
      tenantResult.tenantId,
      [result.message],
    );
    return NextResponse.json(
      { message: publicMessage },
      { status: result.kind === "DUPLICATE" ? 200 : 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

