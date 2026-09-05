/**
 * PERSON-UX-09 — Person-domain trainer membership removal.
 *
 * DELETE /api/people/[id]/trainer-memberships/[trainerMemberId]
 *
 * Removes a TrainerTeamMember record via the Person workspace.
 * Auth: people.manage permission (person-domain authority).
 * Tenant isolation: target Person and trainer membership must belong to the
 * caller's active tenant.
 *
 * Invariants preserved:
 *   - Only this one TrainerTeamMember record is deleted.
 *   - The Person record is never deleted.
 *   - Other squad/trainer memberships remain untouched.
 *   - Historical records for other seasons remain.
 *   - The underlying TrainerTeamMember must belong to the given personId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = { params: Promise<{ id: string; trainerMemberId: string }> };

export async function DELETE(_request: NextRequest, { params }: Context) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const { id: personId, trainerMemberId } = await params;

  // Verify person belongs to tenant
  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId },
    select: { id: true, firstName: true, lastName: true, displayName: true },
  });

  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  // Verify trainer membership belongs to this person
  const trainerMember = await prisma.trainerTeamMember.findFirst({
    where: {
      id: trainerMemberId,
      personId,
      teamSeason: { team: { tenantId } },
    },
    select: {
      id: true,
      personId: true,
      teamSeasonId: true,
      status: true,
      roleLabel: true,
      isWebsiteVisible: true,
      sortOrder: true,
      remarks: true,
      teamSeason: {
        select: {
          id: true,
          team: { select: { id: true, name: true } },
          season: { select: { id: true, name: true, key: true } },
        },
      },
    },
  });

  if (!trainerMember) {
    return NextResponse.json({ error: "Trainerteam-Eintrag nicht gefunden." }, { status: 404 });
  }

  const actorUserId =
    access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  await prisma.trainerTeamMember.delete({
    where: {
      id: trainerMemberId,
      personId,
      teamSeason: { team: { tenantId } },
    },
  });

  const personName =
    person.displayName ?? `${person.firstName} ${person.lastName}`;

  await logAction({
    actorUserId,
    moduleKey: "people",
    entityType: "TrainerTeamMember",
    entityId: trainerMemberId,
    action: "trainer_membership_removed_from_person_workspace",
    beforeJson: {
      id: trainerMember.id,
      personId: trainerMember.personId,
      teamSeasonId: trainerMember.teamSeasonId,
      status: trainerMember.status,
      roleLabel: trainerMember.roleLabel,
    },
    metadataJson: {
      personId,
      personName,
      teamId: trainerMember.teamSeason.team.id,
      teamName: trainerMember.teamSeason.team.name,
      seasonId: trainerMember.teamSeason.season.id,
      seasonKey: trainerMember.teamSeason.season.key,
      seasonName: trainerMember.teamSeason.season.name,
    },
  });

  return NextResponse.json({
    message: `Trainer-Zuordnung zu ${trainerMember.teamSeason.team.name} (${trainerMember.teamSeason.season.name}) wurde entfernt.`,
  });
}
