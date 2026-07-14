import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getConflictRulesForFacility,
  createConflictRule,
  validateConflictRuleResources,
  conflictRuleExists,
} from "@/lib/facilities/queries";

type Params = { params: Promise<{ facilityId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.FACILITIES_VIEW,
    PERMISSIONS.FACILITIES_MANAGE,
  ]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { facilityId } = await params;
  const rules = await getConflictRulesForFacility(facilityId, tenantId);
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.FACILITIES_MANAGE]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // tenantId and facilityId come exclusively from the auth session and URL param —
  // never from the request body.
  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { facilityId } = await params;

  // ── 1. Parse and validate body shape ────────────────────────────────────────

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.resourceAId !== "string" ||
    !body.resourceAId.trim() ||
    typeof body.resourceBId !== "string" ||
    !body.resourceBId.trim()
  ) {
    return NextResponse.json(
      { error: "resourceAId and resourceBId are required" },
      { status: 400 },
    );
  }

  const resourceAId: string = body.resourceAId.trim();
  const resourceBId: string = body.resourceBId.trim();

  // ── 2. Self-conflict guard ───────────────────────────────────────────────────

  if (resourceAId === resourceBId) {
    return NextResponse.json(
      { error: "A resource cannot conflict with itself" },
      { status: 400 },
    );
  }

  // ── 3. Precondition validation (facility + resource ownership, ACTIVE status)
  //
  // Cross-tenant IDs are treated as not found.
  // Resources not belonging to the route facilityId are treated as not found.

  const validation = await validateConflictRuleResources({
    tenantId,
    facilityId,
    resourceAId,
    resourceBId,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  // ── 4. Duplicate check (application-layer, controlled 409) ──────────────────

  const duplicate = await conflictRuleExists({ facilityId, resourceAId, resourceBId });
  if (duplicate) {
    return NextResponse.json({ error: "This conflict rule already exists." }, { status: 409 });
  }

  // ── 5. Create ────────────────────────────────────────────────────────────────
  //
  // createConflictRule enforces canonical ordering (lexicographic by ID).
  // The try/catch below handles the unlikely race between steps 4 and 5.

  try {
    const rule = await createConflictRule({
      tenantId,
      facilityId,
      resourceAId,
      resourceBId,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: "This conflict rule already exists." }, { status: 409 });
    }
    throw err;
  }
}
