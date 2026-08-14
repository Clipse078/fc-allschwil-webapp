/**
 * app/api/infoboards/[id]/route.ts
 *
 * Infoboard V2 management API — single board operations.
 *
 * GET    /api/infoboards/[id]  — get a specific Infoboard
 * PATCH  /api/infoboards/[id]  — update a specific Infoboard
 * DELETE /api/infoboards/[id]  — permanently delete a specific Infoboard
 *
 * Permission: INFOBOARD_MANAGE
 * Tenant isolation: from session.user.activeTenantId only.
 * Slug is immutable — updates to name do not affect the kiosk URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getInfoboard,
  updateInfoboard,
  deleteInfoboard,
} from "@/lib/infoboard/queries";
import type { UpdateInfoboardInput, InfoboardStatusValue } from "@/lib/infoboard/types";

const REQUIRED_PERMISSIONS = [PERMISSIONS.INFOBOARD_MANAGE];
const VALID_STATUSES: InfoboardStatusValue[] = ["ACTIVE", "DISABLED", "DRAFT"];
const VALID_THEMES = ["DARK", "LIGHT", null];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const board = await getInfoboard(id, tenantId);
  if (!board) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ board });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 });
  }

  const input: UpdateInfoboardInput = {};

  if ("name" in body) {
    const name = body.name;
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 422 });
    }
    if (name.trim().length > 120) {
      return NextResponse.json({ error: "Name ist zu lang (max. 120 Zeichen)." }, { status: 422 });
    }
    input.name = name.trim();
  }

  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status as InfoboardStatusValue)) {
      return NextResponse.json(
        { error: `Ungültiger Status. Erlaubt: ${VALID_STATUSES.join(", ")}` },
        { status: 422 },
      );
    }
    input.status = body.status as InfoboardStatusValue;
  }

  if ("templateType" in body) {
    if (typeof body.templateType !== "string") {
      return NextResponse.json({ error: "templateType muss ein String sein." }, { status: 422 });
    }
    input.templateType = body.templateType;
  }

  if ("displayTheme" in body) {
    if (!VALID_THEMES.includes(body.displayTheme as string | null)) {
      return NextResponse.json(
        { error: "displayTheme muss 'DARK', 'LIGHT' oder null sein." },
        { status: 422 },
      );
    }
    input.displayTheme = body.displayTheme as string | null;
  }

  // Header config
  if ("headerSubtitleEnabled" in body) {
    input.headerSubtitleEnabled = Boolean(body.headerSubtitleEnabled);
  }
  if ("headerSubtitleText" in body) {
    input.headerSubtitleText =
      body.headerSubtitleText == null
        ? null
        : String(body.headerSubtitleText).slice(0, 200);
  }
  if ("headerShowTime" in body) {
    input.headerShowTime = Boolean(body.headerShowTime);
  }
  if ("headerShowDate" in body) {
    input.headerShowDate = Boolean(body.headerShowDate);
  }
  if ("headerShowWeather" in body) {
    input.headerShowWeather = Boolean(body.headerShowWeather);
  }

  // Announcement
  if ("announcementEnabled" in body) {
    input.announcementEnabled = Boolean(body.announcementEnabled);
  }
  if ("announcementText" in body) {
    input.announcementText =
      body.announcementText == null
        ? null
        : String(body.announcementText).slice(0, 500);
  }
  if ("announcementBgColor" in body) {
    input.announcementBgColor =
      body.announcementBgColor == null ? null : String(body.announcementBgColor);
  }
  if ("announcementTextColor" in body) {
    input.announcementTextColor =
      body.announcementTextColor == null
        ? null
        : String(body.announcementTextColor);
  }

  // Layout JSON (Designer)
  if ("layoutJson" in body) {
    if (body.layoutJson !== null && typeof body.layoutJson !== "string") {
      return NextResponse.json(
        { error: "layoutJson muss ein String oder null sein." },
        { status: 422 },
      );
    }
    // Basic size guard (1 MB)
    if (typeof body.layoutJson === "string" && body.layoutJson.length > 1_048_576) {
      return NextResponse.json(
        { error: "layoutJson ist zu groß (max. 1 MB)." },
        { status: 422 },
      );
    }
    input.layoutJson = body.layoutJson as string | null;
  }

  // Anlageplan JSON (INFOBOARD-MAP-01)
  if ("anlageplanJson" in body) {
    if (body.anlageplanJson !== null && typeof body.anlageplanJson !== "string") {
      return NextResponse.json(
        { error: "anlageplanJson muss ein String oder null sein." },
        { status: 422 },
      );
    }
    if (
      typeof body.anlageplanJson === "string" &&
      body.anlageplanJson.length > 2_097_152
    ) {
      return NextResponse.json(
        { error: "anlageplanJson ist zu groß (max. 2 MB)." },
        { status: 422 },
      );
    }
    input.anlageplanJson = body.anlageplanJson as string | null;
  }

  // Anlageplan background URL (set by the background upload route)
  if ("anlageplanBackgroundUrl" in body) {
    if (
      body.anlageplanBackgroundUrl !== null &&
      typeof body.anlageplanBackgroundUrl !== "string"
    ) {
      return NextResponse.json(
        { error: "anlageplanBackgroundUrl muss ein String oder null sein." },
        { status: 422 },
      );
    }
    input.anlageplanBackgroundUrl = body.anlageplanBackgroundUrl as string | null;
  }

  // Validate: announcement requires text when enabled
  const willBeEnabled =
    input.announcementEnabled !== undefined
      ? input.announcementEnabled
      : undefined;
  if (willBeEnabled === true && input.announcementText === "") {
    return NextResponse.json(
      { error: "Ankündigungstext ist erforderlich wenn die Leiste aktiviert ist." },
      { status: 422 },
    );
  }

  const updated = await updateInfoboard(id, tenantId, input);
  if (!updated) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ board: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const deleted = await deleteInfoboard(id, tenantId);
  if (!deleted) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
