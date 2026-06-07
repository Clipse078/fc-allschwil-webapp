/**
 * GET  /api/homepage-blocks  — list all homepage blocks (admin).
 * POST /api/homepage-blocks  — create a new block + homepage instance.
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listHomepageBlocks,
  createHomepageBlock,
  type CreateHomepageBlockInput,
} from "@/lib/homepage/admin-queries";
import { defaultConfigForType, type WebsiteBlockType } from "@/lib/homepage/types";

const VALID_TYPES: WebsiteBlockType[] = [
  "HERO",
  "RICH_TEXT",
  "NEWS",
  "UPCOMING_MATCHES",
  "SPONSORS",
  "CTA",
  "GALLERY",
];

export async function GET(_request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const blocks = await listHomepageBlocks(tenantId);
  return NextResponse.json({ blocks });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type.toUpperCase() : "";
  if (!VALID_TYPES.includes(type as WebsiteBlockType)) {
    return NextResponse.json(
      { error: `Ungültiger Block-Typ. Erlaubt: ${VALID_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `Neuer ${type} Block`;

  const input: CreateHomepageBlockInput = {
    tenantId,
    type: type as WebsiteBlockType,
    title,
    config:
      body.config !== undefined
        ? (body.config as ReturnType<typeof defaultConfigForType>)
        : defaultConfigForType(type as WebsiteBlockType),
  };

  const block = await createHomepageBlock(input);
  return NextResponse.json({ block }, { status: 201 });
}
