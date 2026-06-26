/**
 * PATCH /api/homepage-sections/[id]/schedule
 *
 * Schedules a future publish for a homepage section.
 *
 * Request body: { "scheduledPublishAt": "<ISO 8601 datetime string>" }
 *
 * Sets publishStatus = "DRAFT" and scheduledPublishAt to the given future date.
 * The public homepage API will treat the section as published once
 * scheduledPublishAt <= now().
 *
 * To cancel a pending schedule, unpublish the section via PATCH .../unpublish,
 * which clears scheduledPublishAt along with setting publishStatus = "DRAFT".
 *
 * Approval gate (CMS V2 Slice 6):
 *   Only sections with approvalStatus APPROVED or NOT_REQUIRED may be scheduled.
 *   DRAFT, IN_REVIEW, and CHANGES_REQUESTED sections are blocked.
 *   Returns HTTP 422 with a descriptive error if the gate is not satisfied.
 *
 * Constraints:
 *   - scheduledPublishAt must be a valid ISO 8601 datetime string.
 *   - scheduledPublishAt must be in the future.
 *
 * Note: The background scheduler worker that would pro-actively flip
 * publishStatus to "PUBLISHED" at scheduledPublishAt is deferred.
 * Until then, the public API applies the scheduled filter at query time
 * (scheduledPublishAt <= now()), so sections go live automatically without
 * any background worker.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified via tenant-scoped lookup.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  scheduleHomepageSectionPublish,
  APPROVAL_STATUS_LABELS,
} from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // ── Validate scheduledPublishAt ───────────────────────────────────────────
  if (!("scheduledPublishAt" in body)) {
    return NextResponse.json(
      { error: "scheduledPublishAt ist erforderlich." },
      { status: 400 },
    );
  }

  const raw = body.scheduledPublishAt;
  if (typeof raw !== "string" || raw.trim() === "") {
    return NextResponse.json(
      { error: "scheduledPublishAt muss eine ISO-8601-Datumszeichenkette sein." },
      { status: 400 },
    );
  }

  const scheduledAt = new Date(raw);
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json(
      { error: "scheduledPublishAt ist kein gültiges Datum." },
      { status: 400 },
    );
  }

  if (scheduledAt <= new Date()) {
    return NextResponse.json(
      { error: "scheduledPublishAt muss in der Zukunft liegen." },
      { status: 400 },
    );
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const { id } = await params;

  const result = await scheduleHomepageSectionPublish(tenantId, id, scheduledAt);

  if (result === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  if ("blocked" in result) {
    const label = APPROVAL_STATUS_LABELS[result.approvalStatus];
    return NextResponse.json(
      {
        error: `Planung blockiert: Freigabestatus ist «${label}». Nur freigegebene oder freigabefreie Sektionen können geplant werden.`,
        approvalStatus: result.approvalStatus,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ section: result });
}
