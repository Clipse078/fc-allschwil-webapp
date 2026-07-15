import { prisma } from "@/lib/db/prisma";
import type {
  WorkspaceFolderDto,
  WorkspaceFolderRecord,
} from "@/lib/workspace/dto";
import { buildWorkspaceFolderTree } from "@/lib/workspace/tree";

const WORKSPACE_FOLDER_SELECT = {
  id: true,
  parentId: true,
  name: true,
  description: true,
  displayOrder: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeTenantId(tenantId: string): string {
  const normalizedTenantId = tenantId.trim();

  if (!normalizedTenantId) {
    throw new Error("Workspace query requires an authenticated tenant.");
  }

  return normalizedTenantId;
}

function toWorkspaceFolderDto(
  folder: WorkspaceFolderRecord,
): WorkspaceFolderDto {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    description: folder.description,
    displayOrder: folder.displayOrder,
    createdByUserId: folder.createdByUserId,
    updatedByUserId: folder.updatedByUserId,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
    children: [],
  };
}

/**
 * Returns the active Workspace folder tree for exactly one tenant.
 */
export async function getWorkspaceFolderTree(
  tenantId: string,
): Promise<WorkspaceFolderDto[]> {
  const normalizedTenantId = normalizeTenantId(tenantId);

  const folders = await prisma.workspaceFolder.findMany({
    where: {
      tenantId: normalizedTenantId,
      archivedAt: null,
    },
    orderBy: [
      { displayOrder: "asc" },
      { name: "asc" },
      { id: "asc" },
    ],
    select: WORKSPACE_FOLDER_SELECT,
  });

  return buildWorkspaceFolderTree(
    folders satisfies WorkspaceFolderRecord[],
  );
}

/**
 * Returns one active Workspace folder belonging to exactly one tenant.
 *
 * A folder from another tenant is returned as null.
 */
export async function getWorkspaceFolderById(
  tenantId: string,
  folderId: string,
): Promise<WorkspaceFolderDto | null> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedFolderId = folderId.trim();

  if (!normalizedFolderId) {
    return null;
  }

  const folder = await prisma.workspaceFolder.findFirst({
    where: {
      id: normalizedFolderId,
      tenantId: normalizedTenantId,
      archivedAt: null,
    },
    select: WORKSPACE_FOLDER_SELECT,
  });

  if (!folder) {
    return null;
  }

  return toWorkspaceFolderDto(
    folder satisfies WorkspaceFolderRecord,
  );
}
