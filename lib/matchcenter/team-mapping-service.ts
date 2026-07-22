import type { Prisma } from "@prisma/client";

export type MatchcenterTeamMappingInput = {
  tenantId: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  teamId: string;
  providerTeamName?: string | null;
};

type TeamRecord = {
  id: string;
  tenantId: string | null;
  isActive: boolean;
};

type ExistingMappingRecord = {
  id: string;
  teamId: string;
};

type TeamMappingRecord = {
  id: string;
  tenantId: string;
  teamId: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date;
};

type MatchcenterTeamMappingDatabase = {
  team: {
    findFirst(args: object): Promise<TeamRecord | null>;
  };
  teamExternalMapping: {
    findUnique(args: object): Promise<ExistingMappingRecord | null>;
    create(args: object): Promise<TeamMappingRecord>;
    update(args: object): Promise<TeamMappingRecord>;
  };
};

export class MatchcenterTeamMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchcenterTeamMappingValidationError";
  }
}

export class MatchcenterTeamMappingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchcenterTeamMappingNotFoundError";
  }
}

function requireIdentifier(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new MatchcenterTeamMappingValidationError(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function requirePositiveInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new MatchcenterTeamMappingValidationError(
      `${fieldName} must be a positive integer.`,
    );
  }

  return value;
}

export async function assignMatchcenterTeamMapping(
  database: MatchcenterTeamMappingDatabase,
  input: MatchcenterTeamMappingInput,
  now: Date = new Date(),
): Promise<TeamMappingRecord> {
  const tenantId = requireIdentifier(
    input.tenantId,
    "tenantId",
  );

  const provider = requireIdentifier(
    input.provider,
    "provider",
  ).toUpperCase();

  const teamId = requireIdentifier(
    input.teamId,
    "teamId",
  );

  const externalTeamId = requirePositiveInteger(
    input.externalTeamId,
    "externalTeamId",
  );

  const externalSeasonId = requirePositiveInteger(
    input.externalSeasonId,
    "externalSeasonId",
  );

  const team = await database.team.findFirst({
    where: {
      id: teamId,
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      tenantId: true,
      isActive: true,
    },
  });

  if (!team) {
    throw new MatchcenterTeamMappingNotFoundError(
      "Active tenant team not found.",
    );
  }

  const uniqueKey = {
    tenantId_provider_externalTeamId_externalSeasonId: {
      tenantId,
      provider,
      externalTeamId,
      externalSeasonId,
    },
  };

  const existing =
    await database.teamExternalMapping.findUnique({
      where: uniqueKey,
      select: {
        id: true,
        teamId: true,
      },
    });

  const data = {
    teamId,
    providerTeamName:
      input.providerTeamName?.trim() || null,
    providerIsActive: true,
    lastSyncedAt: now,
  };

  if (existing) {
    return database.teamExternalMapping.update({
      where: {
        id: existing.id,
      },
      data,
    });
  }

  return database.teamExternalMapping.create({
    data: {
      tenantId,
      provider,
      externalTeamId,
      externalSeasonId,
      ...data,
    },
  });
}

export type {
  MatchcenterTeamMappingDatabase,
  TeamMappingRecord,
};