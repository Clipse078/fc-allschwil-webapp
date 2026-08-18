/**
 * PERSON-UX-05: Tenant development criteria API.
 *
 * GET  /api/people/criteria  — list active criteria for the active tenant
 * POST /api/people/criteria  — create a new DevelopmentCriterion
 *
 * This is the minimal criterion infrastructure needed to support real
 * assessments. A full criterion administration module is deferred.
 *
 * Authorization:
 *   VIEW:   requires people.assessments.view (read criteria for form population)
 *   CREATE: requires people.assessments.manage
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { getTenantActiveCriteria } from "@/lib/people/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const criteria = await getTenantActiveCriteria(tenantResult.tenantId);
  return NextResponse.json({ criteria });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "Name darf maximal 120 Zeichen haben." }, { status: 400 });
  }

  const description = String(body.description ?? "").trim() || null;
  const category = String(body.category ?? "").trim() || null;
  const sortOrder = typeof body.sortOrder === "number" ? Math.round(body.sortOrder) : 0;
  const isActive = body.isActive !== false;

  const criterion = await prisma.developmentCriterion.create({
    data: { tenantId, name, description, category, sortOrder, isActive },
    select: { id: true, name: true, description: true, category: true, sortOrder: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ criterion }, { status: 201 });
}
