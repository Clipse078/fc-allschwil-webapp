/**
 * PERSON-UX-09 — Person-domain squad membership removal.
 *
 * DELETE /api/people/[id]/squad-memberships/[squadMemberId]
 *
 * Removes a PlayerSquadMember record via the Person workspace.
 * Auth: people.manage permission (person-domain authority).
 * Tenant isolation: target Person and squad membership must belong to the
 * caller's active tenant.
 *
 * Invariants preserved:
 *   - Only this one PlayerSquadMember record is deleted.
 *   - The Person record is never deleted.
 *   - Other squad/trainer memberships remain untouched.
 *   - Historical records for other seasons remain.
 *   - The underlying PlayerSquadMember must belong to the given personId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = { params: Promise<{ id: string; squadMemberId: string }> };

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

  const { id: personId, squadMemberId } = await params;

  // Verify person belongs to tenant
  const person = await prisma.person.findFirst({
    where: { id: personId, tenantId },
    select: { id: true, firstName: true, lastName: true, displayName: true },
  });

  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  // Verify squad membership belongs to this person
  const squadMember = await prisma.playerSquadMember.findFirst({
    where: {
      id: squadMemberId,
      personId,
      teamSeason: { team: { tenantId } },
    },
    select: {
      id: true,
      personId: true,
      teamSeasonId: true,
      status: true,
      shirtNumber: true,
      positionLabel: true,
      isCaptain: true,
      isViceCaptain: true,
      teamSeason: {
        select: {
          id: true,
          team: { select: { id: true, name: true } },
          season: { select: { id: true, name: true, key: true } },
        },
      },
    },
  });

  if (!squadMember) {
    return NextResponse.json({ error: "Kader-Eintrag nicht gefunden." }, { status: 404 });
  }

  const actorUserId =
    access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  await prisma.playerSquadMember.delete({ where: { id: squadMemberId } });

  const personName =
    person.displayName ?? `${person.firstName} ${person.lastName}`;

  await logAction({
    actorUserId,
    moduleKey: "people",
    entityType: "PlayerSquadMember",
    entityId: squadMemberId,
    action: "squad_membership_removed_from_person_workspace",
    beforeJson: {
      id: squadMember.id,
      personId: squadMember.personId,
      teamSeasonId: squadMember.teamSeasonId,
      status: squadMember.status,
      shirtNumber: squadMember.shirtNumber,
      positionLabel: squadMember.positionLabel,
      isCaptain: squadMember.isCaptain,
    },
    metadataJson: {
      personId,
      personName,
      teamId: squadMember.teamSeason.team.id,
      teamName: squadMember.teamSeason.team.name,
      seasonId: squadMember.teamSeason.season.id,
      seasonKey: squadMember.teamSeason.season.key,
      seasonName: squadMember.teamSeason.season.name,
    },
  });

  return NextResponse.json({
    message: `Spieler-Zuordnung zu ${squadMember.teamSeason.team.name} (${squadMember.teamSeason.season.name}) wurde entfernt.`,
  });
}
