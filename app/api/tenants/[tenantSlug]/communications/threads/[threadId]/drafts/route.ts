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
import { createCommunicationDraft } from "@/lib/communication/draft-service";
import { toPublicOutboundEmailMessages } from "@/lib/communication/message-enrichment";
import { MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE } from "@/lib/communication/attachment-validation";

type Context = { params: Promise<{ tenantSlug: string; threadId: string }> };

const draftInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(MAX_EMAIL_SUBJECT_LENGTH),
    bodyText: z.string().trim().min(1).max(MAX_EMAIL_BODY_LENGTH),
    attachmentIds: z
      .array(z.string().trim().min(1))
      .max(MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE)
      .default([]),
  })
  .strict();

function errorResponse(error: unknown) {
  if (error instanceof CommunicationServiceError) {
    const status =
      error.code === "THREAD_NOT_FOUND" || error.code === "TARGET_NOT_FOUND"
        ? 404
        : error.code === "SEND_FORBIDDEN" || error.code === "TENANT_FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Communication draft create route failed:", error);
  return NextResponse.json(
    { error: "Fehler beim Speichern des Entwurfs." },
    { status: 500 },
  );
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

  const parsed = draftInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Betreff oder Nachricht ist ungültig." },
      { status: 400 },
    );
  }

  try {
    const draft = await createCommunicationDraft({
      tenantId: tenantResult.tenantId,
      threadId,
      actorUserId,
      subject: parsed.data.subject,
      bodyText: parsed.data.bodyText,
      attachmentIds: parsed.data.attachmentIds,
    });
    const [publicDraft] = await toPublicOutboundEmailMessages(
      tenantResult.tenantId,
      [draft],
    );
    return NextResponse.json({ draft: publicDraft }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
