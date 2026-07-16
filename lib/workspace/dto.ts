/**
 * Tenant-safe, serializable Workspace folder representation.
 *
 * Database models must not be returned directly to UI consumers.
 */
export type WorkspaceFolderDto = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  displayOrder: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  children: WorkspaceFolderDto[];
};

export type WorkspaceFolderRecord = Omit<
  WorkspaceFolderDto,
  "children" | "createdAt" | "updatedAt"
> & {
  createdAt: Date;
  updatedAt: Date;
};
export type WorkspaceArchivedFolderDto = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  archivedAt: string;
  updatedAt: string;
};
