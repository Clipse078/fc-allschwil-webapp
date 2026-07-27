/**
 * app/api/teams/register/route.ts
 *
 * POST /api/teams/register
 *
 * Canonical Team registration endpoint for the TEAM-CREATE-01 wizard.
 *
 * Enforces:
 *   - Authentication (401 when not authenticated)
 *   - teams.manage permission (403 when unauthorized)
 *   - Tenant availability (400 when no tenant)
 *   - All domain rules via registerTeamSeason()
 *
 * Returns:
 *   201 { teamId, teamSeasonId, slug, createdTeamIdentity }
 *   400 validation error
 *   401 unauthenticated
 *   403 forbidden
 *   409 conflict (duplicate season, slug, federation mapping)
 *   500 server error
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { logAction } from "@/lib/audit/log-action";
import {
  registerTeamSeason,
  type RegisterTeamInput,
} from "@/lib/teams/team-registration-service";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Mandant nicht gefunden. Bitte melde dich erneut an." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Anfragekörper." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfragedaten." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // ── Input extraction and basic coercion ──────────────────────────────────────

  const seasonId = typeof b.seasonId === "string" ? b.seasonId.trim() : "";
  if (!seasonId) {
    return NextResponse.json(
      { error: "Saison ist erforderlich." },
      { status: 400 },
    );
  }

  const rawOrgUnitIds = Array.isArray(b.orgUnitIds) ? b.orgUnitIds : [];
  const orgUnitIds = rawOrgUnitIds
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());

  if (orgUnitIds.length === 0) {
    return NextResponse.json(
      { error: "Mindestens eine Organisationseinheit ist erforderlich." },
      { status: 400 },
    );
  }

  const teamObj = b.team && typeof b.team === "object" ? (b.team as Record<string, unknown>) : {};
  const teamName = typeof teamObj.name === "string" ? teamObj.name.trim() : "";
  if (!teamName) {
    return NextResponse.json(
      { error: "Teamname ist erforderlich." },
      { status: 400 },
    );
  }

  const teamSlug =
    typeof teamObj.slug === "string" ? teamObj.slug.trim() || null : null;
  const teamShortName =
    typeof teamObj.shortName === "string" ? teamObj.shortName.trim() || null : null;
  const teamGenderGroup =
    typeof teamObj.genderGroup === "string" ? teamObj.genderGroup.trim() || null : null;
  const teamAgeGroup =
    typeof teamObj.ageGroup === "string" ? teamObj.ageGroup.trim() || null : null;
  const teamSortOrder =
    typeof teamObj.sortOrder === "number" && Number.isFinite(teamObj.sortOrder)
      ? teamObj.sortOrder
      : 0;

  const existingTeamId =
    typeof b.existingTeamId === "string" ? b.existingTeamId.trim() || null : null;

  const websiteVisible = b.websiteVisible !== false;
  const infoboardVisible = b.infoboardVisible !== false;

  // ── Federation mapping (optional) ──────────────────────────────────────────

  let federationMapping: RegisterTeamInput["federationMapping"] = null;

  if (b.federationMapping && typeof b.federationMapping === "object") {
    const fm = b.federationMapping as Record<string, unknown>;
    const provider =
      typeof fm.provider === "string" ? fm.provider.trim() : "";
    const externalTeamId =
      typeof fm.externalTeamId === "number" ? fm.externalTeamId : NaN;
    const externalSeasonId =
      typeof fm.externalSeasonId === "number" ? fm.externalSeasonId : NaN;

    if (!provider || !Number.isFinite(externalTeamId) || !Number.isFinite(externalSeasonId)) {
      return NextResponse.json(
        {
          error:
            "Ungültige Verbandszuordnung. provider, externalTeamId und externalSeasonId sind erforderlich.",
        },
        { status: 400 },
      );
    }

    federationMapping = {
      provider,
      externalTeamId,
      externalSeasonId,
      providerTeamName:
        typeof fm.providerTeamName === "string" ? fm.providerTeamName : null,
      providerLeagueName:
        typeof fm.providerLeagueName === "string" ? fm.providerLeagueName : null,
    };
  }

  // ── Orchestration ──────────────────────────────────────────────────────────

  const input: RegisterTeamInput = {
    tenantId: tenant.id,
    seasonId,
    orgUnitIds,
    existingTeamId,
    team: {
      name: teamName,
      slug: teamSlug,
      shortName: teamShortName,
      genderGroup: teamGenderGroup,
      ageGroup: teamAgeGroup,
      sortOrder: teamSortOrder,
    },
    federationMapping,
    websiteVisible,
    infoboardVisible,
  };

  const registrationResult = await registerTeamSeason(input);

  if (!registrationResult.ok) {
    const conflictCodes = [
      "TEAM_SEASON_ALREADY_EXISTS",
      "SLUG_CONFLICT",
      "FEDERATION_MAPPING_CONFLICT",
    ];
    const notFoundCodes = [
      "SEASON_NOT_FOUND",
      "ORG_UNIT_NOT_FOUND",
      "TEAM_NOT_FOUND",
    ];

    const status = conflictCodes.includes(registrationResult.code)
      ? 409
      : notFoundCodes.includes(registrationResult.code)
        ? 404
        : registrationResult.code === "TEAM_TENANT_MISMATCH" ||
            registrationResult.code === "ORG_UNIT_TENANT_MISMATCH"
          ? 403
          : 400;

    return NextResponse.json(
      { error: registrationResult.message, code: registrationResult.code },
      { status },
    );
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  await logAction({
    actorUserId:
      access.session.user?.effectiveUserId ?? access.session.user?.id ?? null,
    moduleKey: "teams",
    entityType: registrationResult.createdTeamIdentity ? "Team" : "TeamSeason",
    entityId: registrationResult.createdTeamIdentity
      ? registrationResult.teamId
      : registrationResult.teamSeasonId,
    action: "CREATE",
    afterJson: {
      teamId: registrationResult.teamId,
      teamSeasonId: registrationResult.teamSeasonId,
      slug: registrationResult.slug,
      createdTeamIdentity: registrationResult.createdTeamIdentity,
      seasonId,
      orgUnitIds,
      websiteVisible,
      infoboardVisible,
      hasFederationMapping: federationMapping !== null,
      tenantId: tenant.id,
    },
  });

  return NextResponse.json(
    {
      teamId: registrationResult.teamId,
      teamSeasonId: registrationResult.teamSeasonId,
      slug: registrationResult.slug,
      createdTeamIdentity: registrationResult.createdTeamIdentity,
    },
    { status: 201 },
  );
}
