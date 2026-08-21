/**
 * POST /api/webhooks/resend/inbound
 *
 * COMM-02: Resend inbound email replies.
 *
 * - Verifies webhook signature (Standard Webhooks / Svix headers)
 * - Fetches full inbound email via Resend Receiving API
 * - Normalizes into provider-independent shape
 * - Persists tenant-safe inbound reply into CommunicationThread/CommunicationMessage
 *
 * Security:
 * - Never trusts tenantId from payload; tenant is derived from inbound reply token.
 * - Never logs full email bodies or secrets.
 * - Idempotent via (provider, providerMessageId) uniqueness.
 */

import { NextRequest, NextResponse } from "next/server";
import { persistInboundEmailReply } from "@/lib/communication/inbound-email-service";
import {
  getResendWebhookEventId,
  ResendWebhookVerificationError,
  verifyResendWebhookPayload,
} from "@/lib/communication/providers/resend/webhook-verification";
import {
  normalizeResendEmailReceivedEvent,
  ResendInboundEmailFetchError,
} from "@/lib/communication/providers/resend/received-normalization";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";

  let rawPayload = "";
  try {
    rawPayload = await request.text();
  } catch (err) {
    console.error("Resend inbound webhook: failed to read body:", err);
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  let verifiedEvent: unknown;
  try {
    verifiedEvent = verifyResendWebhookPayload({
      rawPayload,
      headers: request.headers,
      webhookSecret,
    });
  } catch (err) {
    if (err instanceof ResendWebhookVerificationError) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
    console.error("Resend inbound webhook: signature verification crashed:", err);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const providerEventId = getResendWebhookEventId(request.headers);

  try {
    const normalized = await normalizeResendEmailReceivedEvent({
      event: verifiedEvent,
      providerEventId,
    });
    if (!normalized) {
      // Verified but unsupported event type.
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const result = await persistInboundEmailReply(normalized);
    if (!result.ok) {
      return NextResponse.json({ error: "Invalid inbound email." }, { status: 400 });
    }

    // Unknown tokens are accepted but ignored (safe retry behavior).
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ResendInboundEmailFetchError) {
      console.error("Resend inbound webhook: receiving.get failed:", err.message);
      return NextResponse.json({ error: "Upstream provider unavailable." }, { status: 502 });
    }
    console.error("Resend inbound webhook: processing failed:", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
