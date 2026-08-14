/**
 * POST /api/invitations/accept — INVITE-01
 *
 * Public endpoint — no session required. Accepts an invitation by raw token.
 *
 * Body:
 *   {
 *     token: string,          // raw invite token from URL
 *     // Required only if the email has no global User account yet:
 *     firstName?: string,
 *     lastName?: string,
 *     password?: string,
 *   }
 *
 * On success: returns { userId, personId, tenantId, alreadyAccepted }.
 * On error:   400/404/409/410 with { error: string }.
 *
 * Security notes:
 *   - Token is never logged.
 *   - Error responses are opaque (no token echoing).
 *   - Rate limiting: inherits Next.js edge/server rate limiting at the
 *     infrastructure level. Application-level rate limit not added for MVP
 *     (invitation tokens have 256 bits of entropy — brute-force infeasible).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  acceptInvitation,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
  InvitationExpiredError,
} from "@/lib/invitations/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const rawToken = typeof body.token === "string" ? body.token.trim() : "";
  if (!rawToken) {
    return NextResponse.json({ error: "Token ist erforderlich." }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;

  try {
    const result = await acceptInvitation({ rawToken, firstName, lastName, password });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: "Einladung nicht gefunden oder ungültig." }, { status: 404 });
    }
    if (error instanceof InvitationExpiredError) {
      return NextResponse.json({ error: "Einladung ist abgelaufen." }, { status: 410 });
    }
    if (error instanceof InvitationAlreadyRevokedError) {
      return NextResponse.json({ error: "Einladung wurde widerrufen." }, { status: 409 });
    }
    if (error instanceof InvitationAlreadyAcceptedError) {
      // Treat as success (idempotent)
      return NextResponse.json({ alreadyAccepted: true });
    }
    if (error instanceof Error && error.message.includes("erforderlich")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/invitations/accept]", error);
    return NextResponse.json({ error: "Einladung konnte nicht angenommen werden." }, { status: 500 });
  }
}
