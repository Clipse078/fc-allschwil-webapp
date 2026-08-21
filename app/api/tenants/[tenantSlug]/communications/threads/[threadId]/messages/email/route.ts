/**
 * POST a tenant-scoped outbound email. Recipient, sender and provider are
 * deliberately absent from the accepted client payload.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import {
  MAX_EMAIL_BODY_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
} from "@/lib/communication/constants";
import { CommunicationServiceError } from "@/lib/communication/errors";
import { toPublicOutboundEmailMessages } from "@/lib/communication/message-enrichment";
import { sendOutboundEmailForThread } from "@/lib/communication/outbound-email-service";

type Context = { params: Promise<{ tenantSlug: string; threadId: string }> };

const emailInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(MAX_EMAIL_SUBJECT_LENGTH),
    bodyText: z.string().trim().min(1).max(MAX_EMAIL_BODY_LENGTH),
  })
  .strict();

function errorResponse(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "TARGET_NOT_FOUND"
        ? 404
        : error.code === "SEND_FORBIDDEN"
          ? 403
          : error.code === "PROVIDER_FAILED"
            ? 502
            : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Communication email send route failed:", error);
  return NextResponse.json({ error: "Die E-Mail konnte nicht gesendet werden." }, { status: 500 });
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, threadId } = await context.params;
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
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

  try {
    const parsed = emailInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Betreff oder Nachricht ist ungültig." },
        { status: 400 },
      );
    }

    const message = await sendOutboundEmailForThread({
      tenantId: tenantResult.tenantId,
      threadId,
      actorUserId,
      subject: parsed.data.subject,
      bodyText: parsed.data.bodyText,
    });
    const [publicMessage] = await toPublicOutboundEmailMessages(
      tenantResult.tenantId,
      [message],
    );
    return NextResponse.json({ message: publicMessage }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
