import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import {
  assignMatchcenterTeamMapping,
  MatchcenterTeamMappingNotFoundError,
  MatchcenterTeamMappingValidationError,
  type MatchcenterTeamMappingDatabase,
} from "@/lib/matchcenter/team-mapping-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";

type RequestBody = {
  provider?: unknown;
  externalTeamId?: unknown;
  externalSeasonId?: unknown;
  teamId?: unknown;
  providerTeamName?: unknown;
};

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
      },
      {
        status: access.status,
      },
    );
  }

  const tenantId = access.session.user.activeTenantId;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Tenant context is required.",
      },
      {
        status: 403,
      },
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof body.provider !== "string" ||
    typeof body.externalTeamId !== "number" ||
    typeof body.externalSeasonId !== "number" ||
    typeof body.teamId !== "string" ||
    (
      body.providerTeamName !== undefined &&
      body.providerTeamName !== null &&
      typeof body.providerTeamName !== "string"
    )
  ) {
    return NextResponse.json(
      {
        error: "Invalid team mapping payload.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const mapping = await assignMatchcenterTeamMapping(
      prisma as unknown as MatchcenterTeamMappingDatabase,
      {
        tenantId,
        provider: body.provider,
        externalTeamId: body.externalTeamId,
        externalSeasonId: body.externalSeasonId,
        teamId: body.teamId,
        providerTeamName:
          body.providerTeamName ?? null,
      },
    );

    return NextResponse.json(
      {
        mapping,
        requiresScheduleSync: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof
      MatchcenterTeamMappingValidationError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof
      MatchcenterTeamMappingNotFoundError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

    console.error(
      "Matchcenter team mapping assignment failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to assign team mapping.",
      },
      {
        status: 500,
      },
    );
  }
}