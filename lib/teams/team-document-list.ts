import { prisma } from "@/lib/db/prisma";
import {
  formatTeamDocumentDate,
  formatTeamDocumentFileSize,
  formatTeamDocumentFileType,
} from "@/lib/teams/team-document-formatters";
import {
  listTeamDocuments,
  type TeamDocumentRecord,
} from "@/lib/teams/team-document-service";
import {
  resolveWorkspaceFileType,
  type WorkspaceFileCategory,
} from "@/lib/workspace/file-type-util";

export type TeamDocumentListItem = {
  id: string;
  title: string;
  originalFilename: string;
  fileTypeLabel: string;
  fileTypeCategory: WorkspaceFileCategory;
  sizeLabel: string;
  uploadedAtLabel: string;
  uploadedByLabel: string | null;
  showOriginalFilename: boolean;
};

function normalizeComparableName(value: string): string {
  return value.trim().toLowerCase();
}

export function shouldShowOriginalFilename(
  title: string,
  originalFilename: string,
): boolean {
  return (
    normalizeComparableName(title) !== normalizeComparableName(originalFilename)
  );
}

export function formatUserDisplayName(input: {
  firstName: string;
  lastName: string;
}): string {
  return `${input.firstName} ${input.lastName}`.trim();
}

export function mapTeamDocumentToListItem(
  record: TeamDocumentRecord,
  uploadedByLabel: string | null,
): TeamDocumentListItem {
  return {
    id: record.id,
    title: record.title,
    originalFilename: record.originalFilename,
    fileTypeLabel: formatTeamDocumentFileType(
      record.mimeType,
      record.originalFilename,
    ),
    fileTypeCategory: resolveWorkspaceFileType(
      record.mimeType,
      record.originalFilename,
    ).category,
    sizeLabel: formatTeamDocumentFileSize(record.sizeBytes),
    uploadedAtLabel: formatTeamDocumentDate(record.createdAt),
    uploadedByLabel,
    showOriginalFilename: shouldShowOriginalFilename(
      record.title,
      record.originalFilename,
    ),
  };
}

/**
 * Server-side view model for the read-only Team Documents workspace.
 * Uses listTeamDocuments for tenant/team scoping, then enriches uploader names
 * in a single batch query to avoid N+1 lookups.
 */
export async function getTeamDocumentListItems(
  tenantId: string,
  teamId: string,
): Promise<TeamDocumentListItem[]> {
  const records = await listTeamDocuments(tenantId, teamId);
  const uploaderIds = [
    ...new Set(
      records
        .map((record) => record.uploadedByUserId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];

  const uploaderNames = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    for (const uploader of uploaders) {
      const displayName = formatUserDisplayName(uploader);
      if (displayName) {
        uploaderNames.set(uploader.id, displayName);
      }
    }
  }

  return records.map((record) =>
    mapTeamDocumentToListItem(
      record,
      record.uploadedByUserId
        ? (uploaderNames.get(record.uploadedByUserId) ?? null)
        : null,
    ),
  );
}
