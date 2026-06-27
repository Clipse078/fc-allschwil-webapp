/**
 * PATCH /api/reusable-components/[id]/workflow
 *
 * Handles editorial approval workflow transitions:
 *   action: "request-review" | "approve" | "reject" | "reset-to-draft"
 *
 * Body: { action: string; note?: string }
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  applyWorkflowAction,
  type WorkflowAction,
} from "@/lib/reusable-components/queries";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_ACTIONS: WorkflowAction[] = [
  "request-review",
  "approve",
  "reject",
  "reset-to-draft",
];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? (body.action as WorkflowAction) : null;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Ungültige Aktion. Erlaubt: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;

  const { id } = await params;
  const component = await applyWorkflowAction(tenantId, id, action, actorUserId, note);

  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ component });
}
