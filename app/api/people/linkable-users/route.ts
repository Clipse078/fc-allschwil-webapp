/**
 * GET /api/people/linkable-users — ADMIN-MASTERDATA-UX-01-C1.
 *
 * Returns the eligible universe for the Person detail "Benutzerkonto
 * verknüpfen" picker: active tenant members not already linked to any
 * Person. See lib/roles/tenant-queries.ts#getLinkableTenantUsersForPerson.
 *
 * Permission: roles.manage OR roles.assign (TENANT_ROLES_ASSIGN) — same
 * authority as the link/unlink mutation itself and as tenant role
 * assignment; no new permission is introduced.
 */

import { NextResponse } from "next/server";
import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_ASSIGN } from "@/lib/roles/access";
import { getLinkableTenantUsersForPerson } from "@/lib/roles/tenant-queries";

export async function GET() {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_ASSIGN);
  if (!guard.ok) return guard.response;

  const users = await getLinkableTenantUsersForPerson(guard.context.tenantId);
  return NextResponse.json({ users });
}
