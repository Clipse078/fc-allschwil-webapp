import { prisma } from "@/lib/db/prisma";
import type {
  WorkspaceFolderDto,
  WorkspaceFolderRecord,
} from "@/lib/workspace/dto";
import { buildWorkspaceFolderTree } from "@/lib/workspace/tree";

/**
 * Returns the active Workspace folder tree for exactly one tenant.
 *
 * The tenant ID must come from the authenticated server session. Never accept
 * a tenant ID supplied by a browser request body, form field, or query string.
 */
export async function getWorkspaceFolderTree(
  tenantId: string,
): Promise<WorkspaceFolderDto[]> {
  const normalizedTenantId = tenantId.trim();

  if (!normalizedTenantId) {
    throw new Error("Workspace folder query requires an authenticated tenant.");
  }

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
    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      displayOrder: true,
      createdByUserId: true,
      updatedByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return buildWorkspaceFolderTree(
    folders satisfies WorkspaceFolderRecord[],
  );
}
