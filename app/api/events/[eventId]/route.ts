/**
 * CLUB-EVENTS-01: Individual event operations (Veranstaltungen / type=OTHER).
 *
 * GET    /api/events/[eventId]  — Fetch a single event (tenant-scoped).
 * PATCH  /api/events/[eventId]  — Update a Veranstaltung (archive/restore/edit).
 * DELETE /api/events/[eventId]  — Archive (soft-delete) or permanently delete.
 *
 * Authorization:
 *   GET                         — EVENTS_VIEW or EVENTS_MANAGE
 *   PATCH (edit / archive /restore) — EVENTS_MANAGE
 *   DELETE (archive, no ?permanent) — EVENTS_MANAGE
 *   DELETE ?permanent=true      — EVENTS_DELETE (via hasTenantDeletionAuthority,
 *                                  NOT EVENTS_MANAGE — follows ADMIN-DELETE-02A pattern)
 *
 * CLUB-EVENTS-01-C1: permanent deletion requires the explicit events.delete
 * permission resolved against the event's own DB-stored tenantId. The
 * session's activeTenantId is never used as the authorization target for
 * this path — the event's real owning tenant is always resolved from the DB.
 *
 * Tenant isolation: enforced at every layer; type=OTHER restriction prevents
 * this route from operating on Matches, Tournaments, or Trainings.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getClubEvent,
  updateClubEvent,
  archiveClubEvent,
  restoreClubEvent,
  deleteClubEvent,
  ClubEventNotFoundError,
  ClubEventValidationError,
} from "@/lib/events/club-events-service";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ eventId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const access = await requireApiAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandanten-Kontext." },
      { status: 403 },
    );
  }

  const { eventId } = await params;
  const event = await getClubEvent(tenantId, eventId);

  if (!event) {
    return NextResponse.json(
      { error: "Veranstaltung nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({ event });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.EVENTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandanten-Kontext." },
      { status: 403 },
    );
  }

  const actorUserId =
    access.session.user.effectiveUserId ?? access.session.user.id ?? null;
  const { eventId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // Handle archive/restore action — both remain under EVENTS_MANAGE
  if (raw.action === "archive") {
    try {
      const event = await archiveClubEvent(tenantId, eventId);
      await logAction({
        actorUserId,
        moduleKey: "veranstaltungen",
        entityType: "Event",
        entityId: eventId,
        action: "ARCHIVE",
        afterJson: { status: "ARCHIVED" },
      });
      return NextResponse.json({ event });
    } catch (err) {
      if (err instanceof ClubEventNotFoundError) {
        return NextResponse.json(
          { error: "Veranstaltung nicht gefunden." },
          { status: 404 },
        );
      }
      if (err instanceof ClubEventValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      console.error("[veranstaltungen] PATCH archive error:", err);
      return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
    }
  }

  if (raw.action === "restore") {
    try {
      const event = await restoreClubEvent(tenantId, eventId);
      await logAction({
        actorUserId,
        moduleKey: "veranstaltungen",
        entityType: "Event",
        entityId: eventId,
        action: "RESTORE",
        afterJson: { status: "SCHEDULED" },
      });
      return NextResponse.json({ event });
    } catch (err) {
      if (err instanceof ClubEventNotFoundError) {
        return NextResponse.json(
          { error: "Veranstaltung nicht gefunden." },
          { status: 404 },
        );
      }
      console.error("[veranstaltungen] PATCH restore error:", err);
      return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
    }
  }

  // Core field update — remains under EVENTS_MANAGE
  const startAtRaw =
    raw.startAt !== undefined && raw.startAt !== null && raw.startAt !== ""
      ? String(raw.startAt)
      : undefined;

  const endAtRaw =
    raw.endAt === null
      ? null
      : raw.endAt !== undefined && raw.endAt !== ""
        ? String(raw.endAt)
        : undefined;

  const input: Parameters<typeof updateClubEvent>[2] = {};

  if (raw.title !== undefined) input.title = String(raw.title ?? "");
  if (raw.description !== undefined)
    input.description =
      raw.description === null ? null : String(raw.description) || null;
  if (raw.location !== undefined)
    input.location = raw.location === null ? null : String(raw.location) || null;
  if (startAtRaw !== undefined) input.startAt = new Date(startAtRaw);
  if (endAtRaw !== undefined) input.endAt = endAtRaw === null ? null : new Date(endAtRaw as string);
  if (raw.organizerName !== undefined)
    input.organizerName =
      raw.organizerName === null ? null : String(raw.organizerName) || null;
  if (raw.remarks !== undefined)
    input.remarks = raw.remarks === null ? null : String(raw.remarks) || null;
  if (raw.websiteVisible !== undefined)
    input.websiteVisible = Boolean(raw.websiteVisible);
  if (raw.infoboardVisible !== undefined)
    input.infoboardVisible = Boolean(raw.infoboardVisible);
  if (raw.homepageVisible !== undefined)
    input.homepageVisible = Boolean(raw.homepageVisible);
  if (raw.wochenplanVisible !== undefined)
    input.wochenplanVisible = Boolean(raw.wochenplanVisible);
  if (raw.trainingsplanVisible !== undefined)
    input.trainingsplanVisible = Boolean(raw.trainingsplanVisible);
  if (raw.teamPageVisible !== undefined)
    input.teamPageVisible = Boolean(raw.teamPageVisible);

  try {
    const event = await updateClubEvent(tenantId, eventId, input);
    await logAction({
      actorUserId,
      moduleKey: "veranstaltungen",
      entityType: "Event",
      entityId: eventId,
      action: "UPDATE",
      afterJson: input,
    });
    return NextResponse.json({ event });
  } catch (err) {
    if (err instanceof ClubEventNotFoundError) {
      return NextResponse.json(
        { error: "Veranstaltung nicht gefunden." },
        { status: 404 },
      );
    }
    if (err instanceof ClubEventValidationError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }
    console.error("[veranstaltungen] PATCH error:", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
//
// CLUB-EVENTS-01-C1 authorization split:
//   ?permanent=true  → requires events.delete via hasTenantDeletionAuthority,
//                       resolved against the event's own DB tenantId.
//   (no ?permanent)  → archive (soft-delete), requires events.manage.
//
// The permanent path intentionally does NOT call requireApiPermission first —
// a caller holding only events.delete (without events.manage) must still be
// able to permanently delete. The archive path uses requireApiPermission
// (events.manage) independently.

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const permanent = url.searchParams.get("permanent") === "true";
  const { eventId } = await params;

  // ── Permanent delete path: events.delete required ─────────────────────────
  if (permanent) {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the event and its tenantId strictly from DB — never from the
    // client or from session.activeTenantId. Scoped to type=OTHER so this
    // path can never permanently delete a Match/Tournament/Training.
    const eventRow = await prisma.event.findFirst({
      where: { id: eventId, type: "OTHER" },
      select: { id: true, tenantId: true },
    });

    if (!eventRow || !eventRow.tenantId) {
      return NextResponse.json(
        { error: "Veranstaltung nicht gefunden." },
        { status: 404 },
      );
    }

    const eventTenantId = eventRow.tenantId;

    const resolver = createEffectivePermissionResolver(prisma);
    const authorized = await resolver.hasTenantDeletionAuthority({
      userId: session.user.id,
      permission: PERMISSIONS.EVENTS_DELETE,
      tenantId: eventTenantId,
    });

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actorUserId =
      session.user.effectiveUserId ?? session.user.id ?? null;

    try {
      await deleteClubEvent(eventTenantId, eventId);
      await logAction({
        actorUserId,
        moduleKey: "veranstaltungen",
        entityType: "Event",
        entityId: eventId,
        action: "DELETE_PERMANENT",
        afterJson: { tenantId: eventTenantId },
      });
      return NextResponse.json({ deleted: true });
    } catch (err) {
      if (err instanceof ClubEventNotFoundError) {
        return NextResponse.json(
          { error: "Veranstaltung nicht gefunden." },
          { status: 404 },
        );
      }
      console.error("[veranstaltungen] DELETE permanent error:", err);
      return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
    }
  }

  // ── Archive (soft-delete) path: events.manage required ───────────────────
  const access = await requireApiPermission(PERMISSIONS.EVENTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandanten-Kontext." },
      { status: 403 },
    );
  }

  const actorUserId =
    access.session.user.effectiveUserId ?? access.session.user.id ?? null;

  try {
    const event = await archiveClubEvent(tenantId, eventId);
    await logAction({
      actorUserId,
      moduleKey: "veranstaltungen",
      entityType: "Event",
      entityId: eventId,
      action: "ARCHIVE",
      afterJson: { status: "ARCHIVED" },
    });
    return NextResponse.json({ event });
  } catch (err) {
    if (err instanceof ClubEventNotFoundError) {
      return NextResponse.json(
        { error: "Veranstaltung nicht gefunden." },
        { status: 404 },
      );
    }
    if (err instanceof ClubEventValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[veranstaltungen] DELETE archive error:", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
