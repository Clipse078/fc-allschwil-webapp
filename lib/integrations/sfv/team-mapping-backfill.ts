/**
 * lib/integrations/sfv/team-mapping-backfill.ts
 *
 * TEAM-SFV-01B — safe TeamExternalMapping.teamSeasonId backfill preparation.
 *
 * Classifies unlinked mappings and provides an idempotent backfill executor
 * for authorized operational runs. This slice prepares the capability only —
 * do NOT execute against STAGE without explicit authorization.
 */

import { prisma } from "@/lib/db/prisma";
import { SFV_PROVIDER } from "./season-bridge";
import { resolveTeamSeasonForExternalMapping } from "./team-season-resolution";

export type BackfillCandidateClassification =
  | "eligible"
  | "ambiguous"
  | "missing_team_season"
  | "already_linked"
  | "season_not_found"
  | "team_tenant_mismatch"
  | "team_not_found"
  | "unsupported_provider";

export type BackfillCandidateRow = {
  mappingId: string;
  teamId: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  classification: BackfillCandidateClassification;
  resolvedTeamSeasonId: string | null;
  message: string | null;
};

export type TeamMappingBackfillReport = {
  tenantId: string;
  provider: string;
  externalSeasonId: number | null;
  eligible: BackfillCandidateRow[];
  ambiguous: BackfillCandidateRow[];
  missingTeamSeason: BackfillCandidateRow[];
  alreadyLinked: BackfillCandidateRow[];
  blocked: BackfillCandidateRow[];
  totalScanned: number;
};

export type TeamMappingBackfillExecutionResult = {
  dryRun: boolean;
  updated: number;
  skipped: number;
  failed: number;
  report: TeamMappingBackfillReport;
};

export type ClassifyTeamMappingBackfillInput = {
  tenantId: string;
  provider?: string;
  externalSeasonId?: number;
};

export type ExecuteTeamMappingBackfillInput = ClassifyTeamMappingBackfillInput & {
  dryRun?: boolean;
};

function bucketForClassification(
  classification: BackfillCandidateClassification,
): keyof Pick<
  TeamMappingBackfillReport,
  "eligible" | "ambiguous" | "missingTeamSeason" | "alreadyLinked" | "blocked"
> {
  switch (classification) {
    case "eligible":
      return "eligible";
    case "ambiguous":
      return "ambiguous";
    case "missing_team_season":
      return "missingTeamSeason";
    case "already_linked":
      return "alreadyLinked";
    default:
      return "blocked";
  }
}

/**
 * Classifies TeamExternalMapping rows where teamSeasonId IS NULL.
 *
 * Read-only — safe to run for operational planning and reporting.
 */
export async function classifyTeamExternalMappingBackfill(
  input: ClassifyTeamMappingBackfillInput,
): Promise<TeamMappingBackfillReport> {
  const provider = input.provider ?? SFV_PROVIDER;

  const mappings = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId: input.tenantId,
      provider,
      ...(input.externalSeasonId !== undefined
        ? { externalSeasonId: input.externalSeasonId }
        : {}),
    },
    select: {
      id: true,
      teamId: true,
      externalTeamId: true,
      externalSeasonId: true,
      providerTeamName: true,
      teamSeasonId: true,
    },
    orderBy: [{ externalSeasonId: "asc" }, { externalTeamId: "asc" }],
  });

  const report: TeamMappingBackfillReport = {
    tenantId: input.tenantId,
    provider,
    externalSeasonId: input.externalSeasonId ?? null,
    eligible: [],
    ambiguous: [],
    missingTeamSeason: [],
    alreadyLinked: [],
    blocked: [],
    totalScanned: mappings.length,
  };

  for (const mapping of mappings) {
    const baseRow = {
      mappingId: mapping.id,
      teamId: mapping.teamId,
      externalTeamId: mapping.externalTeamId,
      externalSeasonId: mapping.externalSeasonId,
      providerTeamName: mapping.providerTeamName,
    };

    if (mapping.teamSeasonId !== null) {
      const row: BackfillCandidateRow = {
        ...baseRow,
        classification: "already_linked",
        resolvedTeamSeasonId: mapping.teamSeasonId,
        message: null,
      };
      report.alreadyLinked.push(row);
      continue;
    }

    const resolution = await resolveTeamSeasonForExternalMapping({
      tenantId: input.tenantId,
      teamId: mapping.teamId,
      provider,
      externalSeasonId: mapping.externalSeasonId,
    });

    if (resolution.ok) {
      const row: BackfillCandidateRow = {
        ...baseRow,
        classification: "eligible",
        resolvedTeamSeasonId: resolution.teamSeasonId,
        message: null,
      };
      report.eligible.push(row);
      continue;
    }

    const classificationMap: Record<
      typeof resolution.reason,
      BackfillCandidateClassification
    > = {
      UNSUPPORTED_PROVIDER: "unsupported_provider",
      SEASON_NOT_FOUND: "season_not_found",
      TEAM_NOT_FOUND: "team_not_found",
      TEAM_TENANT_MISMATCH: "team_tenant_mismatch",
      TEAM_SEASON_NOT_FOUND: "missing_team_season",
      AMBIGUOUS: "ambiguous",
    };

    const row: BackfillCandidateRow = {
      ...baseRow,
      classification: classificationMap[resolution.reason],
      resolvedTeamSeasonId: null,
      message: resolution.message,
    };

    report[bucketForClassification(row.classification)].push(row);
  }

  return report;
}

/**
 * Executes (or dry-runs) idempotent teamSeasonId backfill for eligible rows.
 *
 * Never remaps mappings that already have teamSeasonId set.
 * Fail closed on ambiguity — only exactly-one TeamSeason candidates are updated.
 */
export async function backfillTeamExternalMappingTeamSeasonIds(
  input: ExecuteTeamMappingBackfillInput,
): Promise<TeamMappingBackfillExecutionResult> {
  const dryRun = input.dryRun ?? true;
  const report = await classifyTeamExternalMappingBackfill(input);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of report.eligible) {
    if (candidate.resolvedTeamSeasonId === null) {
      skipped++;
      continue;
    }

    if (dryRun) {
      updated++;
      continue;
    }

    try {
      const result = await prisma.teamExternalMapping.updateMany({
        where: {
          id: candidate.mappingId,
          tenantId: input.tenantId,
          teamSeasonId: null,
        },
        data: { teamSeasonId: candidate.resolvedTeamSeasonId },
      });

      if (result.count === 1) {
        updated++;
      } else {
        skipped++;
      }
    } catch {
      failed++;
    }
  }

  return { dryRun, updated, skipped, failed, report };
}
