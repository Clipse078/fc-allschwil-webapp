import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { updateWebsiteSectionStatus } from "@/lib/website/queries";
import { prisma } from "@/lib/db/prisma";
import type { WebsitePublishStatus } from "@prisma/client";

const VALID_STATUSES: WebsitePublishStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "UNPUBLISHED",
];

/**
 * PATCH /api/website/sections/[sectionId]
 *
 * Updates a single WebsiteSection's status and/or isEnabled flag.
 * Requires: website.manage
 * Tenant isolation: sectionId ownership is verified against session.user.tenantId.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found for session user." }, { status: 400 });
  }

  const { sectionId } = await params;

  // Verify ownership: section must belong to the session tenant.
  const section = await prisma.websiteSection.findFirst({
    where: { id: sectionId, tenantId },
    select: { id: true, tenantId: true, status: true },
  });

  if (!section) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { status, isEnabled } = body;

  // Validate status if provided
  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as WebsitePublishStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}.`,
        },
        { status: 400 },
      );
    }
  }

  // Validate isEnabled if provided
  if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
    return NextResponse.json({ error: "isEnabled must be a boolean." }, { status: 400 });
  }

  const userId = access.session.user?.id ?? null;

  try {
    if (status !== undefined) {
      const updated = await updateWebsiteSectionStatus(
        tenantId,
        sectionId,
        status as WebsitePublishStatus,
        userId,
      );
      return NextResponse.json(updated);
    }

    if (isEnabled !== undefined) {
      const updated = await prisma.websiteSection.update({
        where: { id: sectionId, tenantId },
        data: { isEnabled: isEnabled as boolean },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  } catch (err) {
    console.error("[api/website/sections/[sectionId]]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
