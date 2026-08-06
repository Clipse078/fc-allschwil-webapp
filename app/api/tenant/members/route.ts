/**
 * /api/tenant/members — eligible tenant members for role assignment.
 *
 * GET → active TenantMembership-backed members of the caller's active
 *       tenant, each with their currently assigned TENANT role ids. This is
 *       the sole data source for the RPERM-05 assignment picker — never
 *       User.tenantId.
 *       Permission: roles.view OR roles.manage OR roles.assign.
 */

import { NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";

const VIEW_OR_ASSIGN = [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.ROLES_ASSIGN];

export async function GET() {
  const guard = await requireTenantRoleApiContext(VIEW_OR_ASSIGN);
  if (!guard.ok) return guard.response;

  const members = await getEligibleTenantMembers(guard.context.tenantId);
  return NextResponse.json({ members });
}
