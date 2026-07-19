import type {
  WorkspaceFolderDto,
  WorkspaceFolderRecord,
} from "@/lib/workspace/dto";

function compareFolders(
  left: WorkspaceFolderDto,
  right: WorkspaceFolderDto,
): number {
  return (
    left.displayOrder - right.displayOrder ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Builds a folder hierarchy from one tenant-scoped flat result set.
 *
 * Orphaned rows are returned as roots rather than being silently discarded.
 * Cross-tenant protection is enforced by the database query before this
 * function is called.
 */
export function buildWorkspaceFolderTree(
  records: WorkspaceFolderRecord[],
): WorkspaceFolderDto[] {
  const foldersById = new Map<string, WorkspaceFolderDto>();

  for (const record of records) {
    foldersById.set(record.id, {
      id: record.id,
      parentId: record.parentId,
      name: record.name,
      description: record.description,
      displayOrder: record.displayOrder,
      createdByUserId: record.createdByUserId,
      updatedByUserId: record.updatedByUserId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      children: [],
    });
  }

  const roots: WorkspaceFolderDto[] = [];

  for (const folder of foldersById.values()) {
    if (!folder.parentId) {
      roots.push(folder);
      continue;
    }

    const parent = foldersById.get(folder.parentId);

    if (!parent || parent.id === folder.id) {
      roots.push(folder);
      continue;
    }

    parent.children.push(folder);
  }

  function sortBranch(branch: WorkspaceFolderDto[]): void {
    branch.sort(compareFolders);

    for (const folder of branch) {
      sortBranch(folder.children);
    }
  }

  sortBranch(roots);

  return roots;
}
