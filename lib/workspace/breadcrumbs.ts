import type { WorkspaceFolderDto } from "@/lib/workspace/dto";

export type BreadcrumbItem = {
  id: string;
  name: string;
};

/**
 * Builds an ordered array of ancestor folders from the root down to
 * `targetFolderId` by traversing the nested tree in-memory.
 *
 * Returns an empty array when the target is not found.
 */
export function buildWorkspaceBreadcrumbs(
  tree: WorkspaceFolderDto[],
  targetFolderId: string,
): BreadcrumbItem[] {
  function search(
    nodes: WorkspaceFolderDto[],
    path: BreadcrumbItem[],
  ): BreadcrumbItem[] | null {
    for (const node of nodes) {
      const next = [...path, { id: node.id, name: node.name }];

      if (node.id === targetFolderId) {
        return next;
      }

      if (node.children.length > 0) {
        const found = search(node.children, next);

        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return search(tree, []) ?? [];
}
